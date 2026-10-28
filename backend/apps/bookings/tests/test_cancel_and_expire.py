from datetime import timedelta
from io import StringIO

import pytest
from django.core.management import call_command

from apps.bookings import services
from apps.bookings.models import Booking, BookingEvent, BookingStatus

from .helpers import MON, NOW, at, configure, open_mondays


@pytest.fixture
def booked(business, resource, service):
    open_mondays(business, resource)

    def _book(starts_at=None, phone="987654321", now=NOW):
        booking, _ = services.create_booking(
            business=business,
            service=service,
            starts_at=starts_at or at(MON, 19),
            customer_name="Ana",
            customer_phone=phone,
            now=now,
        )
        return booking

    return _book


# --- cancelling -----------------------------------------------------------


@pytest.mark.parametrize(
    "mode, wait",
    [("manual", timedelta(minutes=30)), ("automatic", timedelta(days=1))],
)
def test_customer_can_cancel_before_the_deadline(business, booked, mode, wait):
    configure(business, confirmation_mode=mode)
    booking = booked()

    cancelled = services.cancel_booking_by_customer(booking, now=NOW + wait)

    assert cancelled.status == BookingStatus.CANCELLED
    event = cancelled.events.last()
    assert (event.to_status, event.actor) == (BookingStatus.CANCELLED, BookingEvent.Actor.CUSTOMER)


def test_cancelling_frees_the_slot(booked):
    booking = booked()
    services.cancel_booking_by_customer(booking, now=NOW + timedelta(hours=1))

    booked(phone="912345678", now=NOW + timedelta(hours=1))


def test_deadline_is_the_configured_notice_before_the_start(business, booked):
    configure(business, confirmation_mode="automatic", cancellation_notice_minutes=24 * 60)
    booking = booked(starts_at=at(MON, 19))
    deadline = at(MON, 19) - timedelta(hours=24)

    services.cancel_booking_by_customer(booking, now=deadline)


def test_confirmed_booking_cannot_be_cancelled_after_the_deadline(business, booked):
    configure(business, confirmation_mode="automatic", cancellation_notice_minutes=24 * 60)
    booking = booked()
    too_late = at(MON, 19) - timedelta(hours=24) + timedelta(minutes=1)

    with pytest.raises(services.CancellationWindowClosed):
        services.cancel_booking_by_customer(booking, now=too_late)

    booking.refresh_from_db()
    assert booking.status == BookingStatus.CONFIRMED


def test_pending_booking_can_be_cancelled_inside_the_notice_period(business, booked):
    configure(business, cancellation_notice_minutes=24 * 60)
    booking = booked()
    Booking.objects.filter(pk=booking.pk).update(expires_at=at(MON, 18, 30))

    cancelled = services.cancel_booking_by_customer(booking, now=at(MON, 17))

    assert cancelled.status == BookingStatus.CANCELLED


def test_notice_can_be_shortened_by_the_business(business, booked):
    configure(business, confirmation_mode="automatic", cancellation_notice_minutes=60)
    booking = booked()

    services.cancel_booking_by_customer(booking, now=at(MON, 17, 30))


@pytest.mark.parametrize(
    "status", [BookingStatus.CANCELLED, BookingStatus.COMPLETED, BookingStatus.NO_SHOW]
)
def test_finished_bookings_cannot_be_cancelled(booked, status):
    booking = booked()
    Booking.objects.filter(pk=booking.pk).update(status=status)

    with pytest.raises(services.NotCancellable):
        services.cancel_booking_by_customer(booking, now=NOW)


def test_cancelling_twice_is_refused(booked):
    booking = booked()
    services.cancel_booking_by_customer(booking, now=NOW)

    with pytest.raises(services.NotCancellable):
        services.cancel_booking_by_customer(booking, now=NOW)


def test_overdue_pending_booking_cannot_be_cancelled_and_becomes_expired(booked):
    booking = booked()

    with pytest.raises(services.NotCancellable):
        services.cancel_booking_by_customer(booking, now=NOW + timedelta(hours=3))

    booking.refresh_from_db()
    assert booking.status == BookingStatus.EXPIRED


# --- expiring -------------------------------------------------------------


def test_expire_stale_bookings_only_touches_overdue_pending_ones(business, booked):
    overdue = booked(starts_at=at(MON, 18))
    still_held = booked(starts_at=at(MON, 19), now=NOW + timedelta(hours=2))
    configure(business, confirmation_mode="automatic")
    confirmed = booked(starts_at=at(MON, 20))

    count = services.expire_stale_bookings(now=NOW + timedelta(hours=3))

    assert count == 1
    for booking in (overdue, still_held, confirmed):
        booking.refresh_from_db()
    assert overdue.status == BookingStatus.EXPIRED
    assert still_held.status == BookingStatus.PENDING
    assert confirmed.status == BookingStatus.CONFIRMED


def test_expiring_can_be_limited_to_one_business(business, booked):
    from apps.businesses.models import Business

    booked()
    other = Business.objects.create(slug="otro", name="Otro")

    assert services.expire_stale_bookings(now=NOW + timedelta(hours=3), business=other) == 0
    assert services.expire_stale_bookings(now=NOW + timedelta(hours=3), business=business) == 1


def test_expiring_is_recorded_and_not_repeated(booked):
    booking = booked()
    later = NOW + timedelta(hours=3)

    first = services.expire_stale_bookings(now=later)
    second = services.expire_stale_bookings(now=later)

    assert (first, second) == (1, 0)
    assert booking.events.filter(to_status=BookingStatus.EXPIRED).count() == 1


def test_refresh_if_stale_expires_an_overdue_booking(booked):
    booking = booked()

    refreshed = services.refresh_if_stale(booking, now=NOW + timedelta(hours=3))

    assert refreshed.status == BookingStatus.EXPIRED
    booking.refresh_from_db()
    assert booking.status == BookingStatus.EXPIRED


def test_a_hold_extended_elsewhere_is_not_expired_from_a_stale_copy(booked):
    booking = booked()
    # Another process extended the hold after this copy was loaded.
    Booking.objects.filter(pk=booking.pk).update(expires_at=NOW + timedelta(hours=5))

    services.refresh_if_stale(booking, now=NOW + timedelta(hours=3))

    booking.refresh_from_db()
    assert booking.status == BookingStatus.PENDING


def test_refresh_if_stale_leaves_a_held_booking_alone(booked):
    booking = booked()

    refreshed = services.refresh_if_stale(booking, now=NOW + timedelta(hours=1))

    assert refreshed.status == BookingStatus.PENDING


def test_management_command_expires_overdue_bookings(booked, monkeypatch):
    booking = booked()
    monkeypatch.setattr("django.utils.timezone.now", lambda: NOW + timedelta(hours=3))
    out = StringIO()

    call_command("expire_pending_bookings", stdout=out)

    booking.refresh_from_db()
    assert booking.status == BookingStatus.EXPIRED
    assert "Expired 1" in out.getvalue()
