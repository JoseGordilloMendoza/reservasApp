from datetime import timedelta

import pytest

from apps.bookings import services
from apps.bookings.models import Booking, BookingEvent, BookingStatus

from .helpers import MON, NOW, at, configure, open_mondays

START = at(MON, 19)
AFTER_START = START + timedelta(minutes=5)


@pytest.fixture
def pending(business, resource, service):
    open_mondays(business, resource)
    booking, _ = services.create_booking(
        business=business,
        service=service,
        starts_at=START,
        customer_name="Ana",
        customer_phone="987654321",
        now=NOW,
    )
    return booking


@pytest.fixture
def confirmed(pending):
    return services.confirm_booking(pending, now=NOW)


def stored_status(booking):
    return Booking.objects.get(pk=booking.pk).status


# --- confirming and rejecting ------------------------------------------------


def test_business_confirms_a_pending_booking(pending):
    booking = services.confirm_booking(pending, now=NOW + timedelta(minutes=10))

    assert booking.status == BookingStatus.CONFIRMED
    assert booking.expires_at is None
    event = booking.events.last()
    assert (event.from_status, event.to_status) == (BookingStatus.PENDING, BookingStatus.CONFIRMED)
    assert event.actor == BookingEvent.Actor.BUSINESS


def test_an_overdue_booking_cannot_be_confirmed(pending):
    with pytest.raises(services.BookingExpired):
        services.confirm_booking(pending, now=NOW + timedelta(hours=3))

    assert stored_status(pending) == BookingStatus.EXPIRED


def test_confirming_twice_is_refused(confirmed):
    with pytest.raises(services.InvalidTransition):
        services.confirm_booking(confirmed, now=NOW)


def test_business_rejects_a_pending_booking(pending):
    booking = services.reject_booking(pending, now=NOW)

    assert booking.status == BookingStatus.CANCELLED
    assert booking.events.last().actor == BookingEvent.Actor.BUSINESS


def test_a_confirmed_booking_cannot_be_rejected(confirmed):
    with pytest.raises(services.InvalidTransition):
        services.reject_booking(confirmed, now=NOW)


def test_an_overdue_booking_cannot_be_rejected(pending):
    with pytest.raises(services.BookingExpired):
        services.reject_booking(pending, now=NOW + timedelta(hours=3))


# --- cancelling ----------------------------------------------------------------


@pytest.mark.parametrize("make_confirmed", [False, True])
def test_business_cancels_a_pending_or_confirmed_booking(pending, make_confirmed):
    booking = services.confirm_booking(pending, now=NOW) if make_confirmed else pending

    cancelled = services.cancel_booking_by_business(booking, now=NOW)

    assert cancelled.status == BookingStatus.CANCELLED


def test_business_can_cancel_inside_the_customers_notice_period(business, confirmed):
    configure(business, cancellation_notice_minutes=24 * 60)

    cancelled = services.cancel_booking_by_business(confirmed, now=START - timedelta(minutes=10))

    assert cancelled.status == BookingStatus.CANCELLED


def test_cancelling_frees_the_slot(business, service, confirmed):
    services.cancel_booking_by_business(confirmed, now=NOW)

    services.create_booking(
        business=business,
        service=service,
        starts_at=START,
        customer_name="Luis",
        customer_phone="912345678",
        now=NOW,
    )


@pytest.mark.parametrize(
    "status", [BookingStatus.CANCELLED, BookingStatus.COMPLETED, BookingStatus.NO_SHOW]
)
def test_finished_bookings_cannot_be_cancelled(confirmed, status):
    Booking.objects.filter(pk=confirmed.pk).update(status=status)

    with pytest.raises(services.InvalidTransition):
        services.cancel_booking_by_business(confirmed, now=NOW)


# --- after the booking started ---------------------------------------------------


def test_business_completes_a_booking_after_it_started(confirmed):
    booking = services.complete_booking(confirmed, now=AFTER_START)

    assert booking.status == BookingStatus.COMPLETED


def test_business_marks_a_no_show_after_the_start(confirmed):
    booking = services.mark_no_show(confirmed, now=AFTER_START)

    assert booking.status == BookingStatus.NO_SHOW


@pytest.mark.parametrize("action", [services.complete_booking, services.mark_no_show])
def test_these_cannot_be_recorded_before_the_start(confirmed, action):
    with pytest.raises(services.NotStartedYet):
        action(confirmed, now=START - timedelta(minutes=1))

    assert stored_status(confirmed) == BookingStatus.CONFIRMED


@pytest.mark.parametrize("action", [services.complete_booking, services.mark_no_show])
def test_a_pending_booking_cannot_be_completed_or_marked_no_show(pending, action):
    with pytest.raises(services.InvalidTransition):
        action(pending, now=AFTER_START - timedelta(hours=10))


def test_completed_bookings_still_occupy_their_slot(business, service, confirmed):
    services.complete_booking(confirmed, now=AFTER_START)

    with pytest.raises(services.SlotUnavailable):
        services.create_booking(
            business=business,
            service=service,
            starts_at=START,
            customer_name="Luis",
            customer_phone="912345678",
            now=NOW,
        )


# --- history ------------------------------------------------------------------------


def test_every_change_is_recorded_in_order(pending):
    services.confirm_booking(pending, now=NOW)
    services.complete_booking(pending, now=AFTER_START)

    history = [(e.from_status, e.to_status, e.actor) for e in pending.events.all()]

    assert history == [
        ("", "pending", "customer"),
        ("pending", "confirmed", "business"),
        ("confirmed", "completed", "business"),
    ]
