from datetime import timedelta

import pytest

from apps.bookings import services
from apps.bookings.models import Booking, BookingEvent, BookingStatus
from apps.businesses.models import Business
from apps.customers.models import Customer

from .helpers import MON, NOW, at, configure, open_mondays


@pytest.fixture
def open_business(business, resource):
    open_mondays(business, resource)
    return business


@pytest.fixture
def book(open_business, service):
    def _book(starts_at=None, phone="987654321", name="Ana", now=NOW, **overrides):
        return services.create_booking(
            business=open_business,
            service=service,
            starts_at=starts_at or at(MON, 19),
            customer_name=name,
            customer_phone=phone,
            now=now,
            **overrides,
        )

    return _book


def test_manual_confirmation_creates_a_pending_booking_that_expires(book):
    booking, _ = book()

    assert booking.status == BookingStatus.PENDING
    assert booking.expires_at == NOW + timedelta(minutes=120)
    assert booking.starts_at == at(MON, 19)
    assert booking.ends_at == at(MON, 20)


def test_automatic_confirmation_creates_a_confirmed_booking(open_business, book):
    configure(open_business, confirmation_mode="automatic")

    booking, _ = book()

    assert booking.status == BookingStatus.CONFIRMED
    assert booking.expires_at is None


def test_booking_keeps_the_price_and_duration_of_the_moment(service, book):
    service.reference_price = "40.00"
    service.save()

    booking, _ = book()
    service.reference_price = "99.00"
    service.duration_minutes = 30
    service.save()
    booking.refresh_from_db()

    assert str(booking.price_snapshot) == "40.00"
    assert booking.duration_snapshot == 60


def test_only_the_hash_of_the_token_is_stored(book):
    booking, token = book()
    booking.refresh_from_db()

    assert booking.manage_token_hash == services.hash_token(token)
    assert token not in booking.manage_token_hash
    assert services.find_booking_by_token(token) == booking
    assert services.find_booking_by_token("not-a-token") is None


def test_every_booking_gets_a_different_token(book):
    _, first = book()
    _, second = book(starts_at=at(MON, 20))

    assert first != second


def test_creation_is_recorded_as_an_event(book):
    booking, _ = book()

    event = booking.events.get()
    assert (event.from_status, event.to_status) == ("", BookingStatus.PENDING)
    assert event.actor == BookingEvent.Actor.CUSTOMER


def test_phone_is_normalized_and_the_customer_is_reused(book):
    first, _ = book(phone="987 654 321", name="Ana")
    second, _ = book(phone="+51987654321", name="Ana María", starts_at=at(MON, 20))

    assert first.customer_id == second.customer_id
    assert Customer.objects.get().phone == "+51987654321"
    assert Customer.objects.get().name == "Ana María"


def test_same_phone_in_two_businesses_is_two_customers(book, service):
    other = Business.objects.create(slug="otro", name="Otro")
    Customer.objects.create(business=other, name="Ana", phone="+51987654321")
    book()

    assert Customer.objects.filter(phone="+51987654321").count() == 2


def test_invalid_phone_is_rejected(book):
    with pytest.raises(ValueError):
        book(phone="12345")


# --- who can book ---------------------------------------------------------


def test_blocked_customer_cannot_book(open_business, book):
    Customer.objects.create(
        business=open_business, name="Ana", phone="+51987654321", is_blocked=True
    )

    with pytest.raises(services.BookingNotAllowed):
        book()
    assert Booking.objects.count() == 0


def test_blocked_message_does_not_reveal_the_block():
    assert "bloque" not in services.BookingNotAllowed.message.lower()


def test_active_bookings_are_capped_per_customer(book):
    for hour in (18, 19, 20):
        book(starts_at=at(MON, hour))

    with pytest.raises(services.TooManyActiveBookings):
        book(starts_at=at(MON, 21))


def test_the_cap_is_configurable(open_business, book):
    configure(open_business, max_active_bookings_per_customer=1)
    book()

    with pytest.raises(services.TooManyActiveBookings):
        book(starts_at=at(MON, 20))


def test_the_cap_is_per_customer(book):
    for hour in (18, 19, 20):
        book(starts_at=at(MON, hour))

    book(starts_at=at(MON, 21), phone="912345678")


def test_cancelled_bookings_do_not_count_towards_the_cap(open_business, book):
    configure(open_business, max_active_bookings_per_customer=1)
    first, _ = book()
    Booking.objects.filter(pk=first.pk).update(status=BookingStatus.CANCELLED)

    book(starts_at=at(MON, 20))


def test_past_bookings_do_not_count_towards_the_cap(open_business, book):
    configure(open_business, max_active_bookings_per_customer=1)
    book()
    next_monday = MON + timedelta(days=7)

    # Once the first booking is over, the customer can book again.
    book(starts_at=at(next_monday, 19), now=at(MON, 21))


# --- which slots can be booked --------------------------------------------


@pytest.mark.parametrize(
    "starts_at",
    [
        at(MON, 17),  # before opening
        at(MON, 18, 30),  # not on the hourly grid
        at(MON, 22),  # at closing time
        at(MON, 21, 30),  # would end after closing
    ],
)
def test_only_offered_slots_can_be_booked(book, starts_at):
    with pytest.raises(services.SlotUnavailable):
        book(starts_at=starts_at)


def test_a_taken_slot_cannot_be_booked_again(book):
    book()

    with pytest.raises(services.SlotUnavailable):
        book(phone="912345678")


def test_a_slot_that_is_too_soon_cannot_be_booked(book):
    with pytest.raises(services.SlotUnavailable):
        book(starts_at=at(MON, 19), now=at(MON, 18, 30))


def test_buffer_between_bookings_is_enforced(open_business, book):
    configure(open_business, buffer_minutes=10)
    book()

    with pytest.raises(services.SlotUnavailable):
        book(starts_at=at(MON, 20), phone="912345678")


def test_suspended_business_cannot_receive_bookings(open_business, book):
    open_business.status = Business.Status.SUSPENDED
    open_business.save()

    with pytest.raises(services.SlotUnavailable):
        book()


def test_inactive_service_cannot_be_booked(service, book):
    service.is_active = False
    service.save()

    with pytest.raises(services.SlotUnavailable):
        book()


def test_service_of_another_business_is_rejected(business, service):
    other = Business.objects.create(slug="otro", name="Otro")

    with pytest.raises(ValueError):
        services.create_booking(
            business=other,
            service=service,
            starts_at=at(MON, 19),
            customer_name="Ana",
            customer_phone="987654321",
            now=NOW,
        )


def test_failed_attempt_leaves_nothing_behind(book):
    with pytest.raises(services.SlotUnavailable):
        book(starts_at=at(MON, 17))

    assert Booking.objects.count() == 0
    assert Customer.objects.count() == 0


# --- stale pending bookings -----------------------------------------------


def test_overdue_pending_booking_is_expired_and_its_slot_reused(book):
    old, _ = book()
    later = NOW + timedelta(hours=3)  # past the 2 hour hold

    new, _ = book(phone="912345678", now=later)

    old.refresh_from_db()
    assert old.status == BookingStatus.EXPIRED
    assert new.status == BookingStatus.PENDING
    expired_event = old.events.last()
    assert expired_event.to_status == BookingStatus.EXPIRED
    assert expired_event.actor == BookingEvent.Actor.SYSTEM


def test_pending_booking_within_its_hold_still_blocks(book):
    book()

    with pytest.raises(services.SlotUnavailable):
        book(phone="912345678", now=NOW + timedelta(hours=1))


# --- pending expiry -------------------------------------------------------


def test_pending_expiry_is_now_plus_hold_when_far_from_the_start():
    starts_at = NOW + timedelta(days=3)

    assert services.pending_expiry(NOW, starts_at, timedelta(hours=2)) == NOW + timedelta(hours=2)


def test_pending_expiry_stops_half_an_hour_before_the_start():
    starts_at = NOW + timedelta(hours=1)

    assert services.pending_expiry(NOW, starts_at, timedelta(hours=2)) == starts_at - timedelta(
        minutes=30
    )


def test_pending_expiry_never_goes_past_the_start_when_booked_very_late():
    starts_at = NOW + timedelta(minutes=20)

    assert services.pending_expiry(NOW, starts_at, timedelta(hours=2)) == starts_at


def test_pending_expiry_has_a_minimum_hold():
    starts_at = NOW + timedelta(minutes=2)

    assert services.pending_expiry(NOW, starts_at, timedelta(hours=2)) == NOW + timedelta(minutes=5)
