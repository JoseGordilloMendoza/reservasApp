import hashlib
import secrets
from datetime import timedelta
from zoneinfo import ZoneInfo

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from apps.availability.models import Block
from apps.availability.slots import get_available_slots
from apps.businesses.models import Business
from apps.businesses.settings_schema import effective_settings
from apps.catalog.models import Resource
from apps.customers.models import Customer
from apps.notifications import events

from .models import ACTIVE_STATUSES, Booking, BookingEvent, BookingStatus
from .phone import normalize_phone

def _notify_after_commit(notify, *args):
    """Run a notice once the surrounding change is committed, so a rollback sends nothing.

    robust=True logs a failing notice instead of raising it: the change has already happened.
    It must be a real function, not a partial: Django names the callback when it logs a failure.
    """

    def send_notice():
        notify(*args)

    transaction.on_commit(send_notice, robust=True)


# A pending booking should not hold the slot into the last half hour before it starts.
PENDING_EXPIRY_CUTOFF = timedelta(minutes=30)
MIN_PENDING_HOLD = timedelta(minutes=5)


class BookingError(Exception):
    """A rule of the booking flow was not met. `code` is stable for API clients."""

    code = "booking_error"
    message = "No se pudo completar la operación."

    def __init__(self, message=None):
        self.message = message or self.message
        super().__init__(self.message)


class SlotUnavailable(BookingError):
    code = "slot_unavailable"
    message = "Ese horario ya no está disponible. Elige otro."


class SlotBlocked(BookingError):
    code = "slot_blocked"
    message = "Ese horario está bloqueado. Quita el bloqueo para poder reservarlo."


class SlotInPast(BookingError):
    code = "slot_in_past"
    message = "Ese horario ya pasó."


class BookingNotAllowed(BookingError):
    # Deliberately vague: it must not reveal that the customer was blocked.
    code = "booking_not_allowed"
    message = "No es posible completar la reserva. Contacta directamente al negocio."


class TooManyActiveBookings(BookingError):
    code = "too_many_active_bookings"
    message = "Ya tienes el máximo de reservas activas en este negocio."


class NotCancellable(BookingError):
    code = "not_cancellable"
    message = "Esta reserva ya no se puede cancelar."


class CancellationWindowClosed(BookingError):
    code = "cancellation_window_closed"
    message = "Ya no es posible cancelar en línea. Contacta directamente al negocio."


class InvalidTransition(BookingError):
    code = "invalid_transition"
    message = "Esta reserva no puede pasar a ese estado."


class BookingExpired(InvalidTransition):
    code = "booking_expired"
    message = "La reserva venció y su horario fue liberado. Crea una nueva."


class NotStartedYet(BookingError):
    code = "not_started_yet"
    message = "La reserva aún no ha comenzado."


def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


def find_booking_by_token(token):
    return (
        Booking.objects.select_related("business", "resource", "service", "customer")
        .filter(manage_token_hash=hash_token(token))
        .first()
    )


def pending_expiry(now, starts_at, hold):
    """When a pending booking stops holding its slot."""
    expiry = now + hold
    cutoff = starts_at - PENDING_EXPIRY_CUTOFF
    expiry = min(expiry, cutoff if cutoff > now else starts_at)
    return max(expiry, now + MIN_PENDING_HOLD)


def cancellation_deadline(booking):
    minutes = effective_settings(booking.business, booking.service)["cancellation_notice_minutes"]
    return booking.starts_at - timedelta(minutes=minutes)


def record_event(booking, from_status, to_status, actor):
    BookingEvent.objects.create(
        booking=booking, from_status=from_status, to_status=to_status, actor=actor
    )


def create_booking(
    *, business, service, starts_at, customer_name, customer_phone, customer_email="", now=None
):
    """Create a booking for a slot that is currently offered. Returns (booking, token).

    The raw token is only available here; the database keeps its hash.
    """
    if service.business_id != business.id:
        raise ValueError("The service does not belong to the business")

    now = now or timezone.now()
    phone = normalize_phone(customer_phone)
    token = secrets.token_urlsafe(32)

    if business.status != Business.Status.ACTIVE or not service.is_active:
        raise SlotUnavailable()

    with transaction.atomic():
        # Bookings for one resource are created one at a time. That makes the buffer
        # between bookings safe to check; the exclusion constraint stays as a backstop.
        resource = Resource.objects.select_for_update().get(pk=service.resource_id)
        resource.business = business
        if not resource.is_active:
            raise SlotUnavailable()

        config = effective_settings(business, service)
        customer = _lock_customer(business, phone, customer_name, customer_email)

        if customer.is_blocked:
            raise BookingNotAllowed()
        active = Booking.objects.filter(
            customer=customer, status__in=ACTIVE_STATUSES, ends_at__gt=now
        ).count()
        if active >= config["max_active_bookings_per_customer"]:
            raise TooManyActiveBookings()

        ends_at = starts_at + timedelta(minutes=service.duration_minutes)
        _expire_stale_overlapping(resource, starts_at, ends_at, now)

        local_date = starts_at.astimezone(ZoneInfo(business.timezone)).date()
        offered = {slot.starts_at for slot in get_available_slots(resource, service, local_date, now=now)}
        if starts_at not in offered:
            raise SlotUnavailable()

        if config["confirmation_mode"] == "automatic":
            status, expires_at = BookingStatus.CONFIRMED, None
        else:
            hold = timedelta(minutes=config["pending_hold_minutes"])
            status, expires_at = BookingStatus.PENDING, pending_expiry(now, starts_at, hold)

        booking = _insert_booking(
            business=business,
            resource=resource,
            service=service,
            customer=customer,
            starts_at=starts_at,
            ends_at=ends_at,
            status=status,
            expires_at=expires_at,
            source=Booking.Source.CUSTOMER,
            token=token,
            actor=BookingEvent.Actor.CUSTOMER,
        )

    booking.manage_token = token
    _notify_after_commit(events.booking_created_online, booking, token)
    return booking, token


def create_booking_by_business(
    *, business, service, starts_at, customer_name, customer_phone, customer_email="", now=None
):
    """Record a booking the business took itself (phone, WhatsApp). Returns (booking, token).

    It is confirmed straight away. Unlike a customer's booking it may fall outside opening
    hours and notice limits, ignores the buffer, and is allowed for a blocked customer or one
    over the cap: the owner decides. It still cannot overlap another booking or a block.
    """
    if service.business_id != business.id:
        raise ValueError("The service does not belong to the business")

    now = now or timezone.now()
    phone = normalize_phone(customer_phone)
    token = secrets.token_urlsafe(32)
    ends_at = starts_at + timedelta(minutes=service.duration_minutes)

    if business.status != Business.Status.ACTIVE or not service.is_active:
        raise SlotUnavailable()
    if ends_at <= now:
        raise SlotInPast()

    with transaction.atomic():
        resource = Resource.objects.select_for_update().get(pk=service.resource_id)
        if not resource.is_active:
            raise SlotUnavailable()

        customer = _lock_customer(business, phone, customer_name, customer_email)
        _expire_stale_overlapping(resource, starts_at, ends_at, now)

        closed = Block.objects.filter(
            Q(resource=resource) | Q(resource__isnull=True),
            business=business,
            starts_at__lt=ends_at,
            ends_at__gt=starts_at,
        ).exists()
        if closed:
            raise SlotBlocked()

        booking = _insert_booking(
            business=business,
            resource=resource,
            service=service,
            customer=customer,
            starts_at=starts_at,
            ends_at=ends_at,
            status=BookingStatus.CONFIRMED,
            expires_at=None,
            source=Booking.Source.BUSINESS,
            token=token,
            actor=BookingEvent.Actor.BUSINESS,
        )

    booking.manage_token = token
    _notify_after_commit(events.booking_created_by_business, booking, token)
    return booking, token


def _insert_booking(
    *, business, resource, service, customer, starts_at, ends_at, status, expires_at, source, token, actor
):
    try:
        with transaction.atomic():
            booking = Booking.objects.create(
                business=business,
                resource=resource,
                service=service,
                customer=customer,
                starts_at=starts_at,
                ends_at=ends_at,
                status=status,
                expires_at=expires_at,
                price_snapshot=service.reference_price,
                duration_snapshot=service.duration_minutes,
                source=source,
                manage_token_hash=hash_token(token),
            )
    except IntegrityError:
        # The exclusion constraint caught an overlap the checks above missed.
        raise SlotUnavailable()

    record_event(booking, "", booking.status, actor)
    return booking


def cancel_booking_by_customer(booking, now=None):
    now = now or timezone.now()

    # Expire first and outside the transaction below, so refusing does not undo it.
    refresh_if_stale(booking, now)

    with transaction.atomic():
        booking = Booking.objects.select_for_update(of=("self",)).select_related(
            "business", "service"
        ).get(pk=booking.pk)

        if booking.status not in ACTIVE_STATUSES:
            raise NotCancellable()

        # The notice period protects the business from late cancellations of confirmed
        # bookings. A pending one is not a commitment yet and frees itself soon anyway.
        if booking.status == BookingStatus.CONFIRMED and now > cancellation_deadline(booking):
            raise CancellationWindowClosed()

        previous = booking.status
        booking.status = BookingStatus.CANCELLED
        booking.save(update_fields=["status"])
        record_event(booking, previous, BookingStatus.CANCELLED, BookingEvent.Actor.CUSTOMER)

    _notify_after_commit(events.booking_cancelled_by_customer, booking)
    return booking


def confirm_booking(booking, now=None):
    return _change_status(
        booking,
        BookingStatus.CONFIRMED,
        (BookingStatus.PENDING,),
        now,
        clear_hold=True,
        notify=events.booking_confirmed,
    )


def reject_booking(booking, now=None):
    return _change_status(
        booking,
        BookingStatus.CANCELLED,
        (BookingStatus.PENDING,),
        now,
        notify=events.booking_rejected,
    )


def cancel_booking_by_business(booking, now=None):
    """The business can cancel at any time; the customer's notice period does not apply."""
    return _change_status(
        booking,
        BookingStatus.CANCELLED,
        ACTIVE_STATUSES,
        now,
        notify=events.booking_cancelled_by_business,
    )


def complete_booking(booking, now=None):
    return _change_status(
        booking, BookingStatus.COMPLETED, (BookingStatus.CONFIRMED,), now, require_started=True
    )


def mark_no_show(booking, now=None):
    return _change_status(
        booking, BookingStatus.NO_SHOW, (BookingStatus.CONFIRMED,), now, require_started=True
    )


def _change_status(
    booking, to_status, allowed_from, now, *, clear_hold=False, require_started=False, notify=None
):
    """Move a booking to a new status; `notify`, when given, tells whoever needs to know."""
    now = now or timezone.now()

    # Expire first and outside the transaction below, so refusing does not undo it.
    refresh_if_stale(booking, now)

    with transaction.atomic():
        booking = Booking.objects.select_for_update(of=("self",)).get(pk=booking.pk)

        if booking.status == BookingStatus.EXPIRED and BookingStatus.PENDING in allowed_from:
            raise BookingExpired()
        if booking.status not in allowed_from:
            raise InvalidTransition()
        if require_started and now < booking.starts_at:
            raise NotStartedYet()

        previous = booking.status
        booking.status = to_status
        fields = ["status"]
        if clear_hold:
            booking.expires_at = None
            fields.append("expires_at")
        booking.save(update_fields=fields)
        record_event(booking, previous, to_status, BookingEvent.Actor.BUSINESS)

    if notify is not None:
        _notify_after_commit(notify, booking)
    return booking


def refresh_if_stale(booking, now=None):
    """Expire a pending booking whose hold ran out, so readers never see it as pending."""
    now = now or timezone.now()
    if _is_stale_pending(booking, now) and _mark_expired(booking.pk, now):
        booking.status = BookingStatus.EXPIRED
    return booking


def expire_stale_bookings(now=None, *, business=None):
    """Expire pending bookings whose hold ran out, of one business or of all.

    Returns how many were expired.
    """
    now = now or timezone.now()
    stale = Booking.objects.filter(status=BookingStatus.PENDING, expires_at__lte=now)
    if business is not None:
        stale = stale.filter(business=business)
    return sum(_mark_expired(pk, now) for pk in list(stale.values_list("pk", flat=True)))


def _is_stale_pending(booking, now):
    return (
        booking.status == BookingStatus.PENDING
        and booking.expires_at is not None
        and booking.expires_at <= now
    )


def _mark_expired(booking_id, now):
    # The hold is re-checked in the database, not taken from a possibly outdated
    # object, so two processes cannot both expire it or expire one that was extended.
    with transaction.atomic():
        updated = Booking.objects.filter(
            pk=booking_id, status=BookingStatus.PENDING, expires_at__lte=now
        ).update(status=BookingStatus.EXPIRED)
        if updated:
            BookingEvent.objects.create(
                booking_id=booking_id,
                from_status=BookingStatus.PENDING,
                to_status=BookingStatus.EXPIRED,
                actor=BookingEvent.Actor.SYSTEM,
            )
            _notify_after_commit(events.booking_expired, booking_id)
    return updated


def _expire_stale_overlapping(resource, starts_at, ends_at, now):
    # An overdue pending booking still occupies its slot in the database until it is
    # marked, so release the ones in the way before inserting.
    ids = Booking.objects.filter(
        resource=resource,
        status=BookingStatus.PENDING,
        expires_at__lte=now,
        starts_at__lt=ends_at,
        ends_at__gt=starts_at,
    ).values_list("pk", flat=True)
    for pk in list(ids):
        _mark_expired(pk, now)


def _lock_customer(business, phone, name, email):
    customer, created = Customer.objects.get_or_create(
        business=business, phone=phone, defaults={"name": name, "email": email}
    )
    customer = Customer.objects.select_for_update().get(pk=customer.pk)
    if not created:
        changed = []
        if name and customer.name != name:
            customer.name = name
            changed.append("name")
        if email and customer.email != email:
            customer.email = email
            changed.append("email")
        if changed:
            customer.save(update_fields=changed)
    return customer
