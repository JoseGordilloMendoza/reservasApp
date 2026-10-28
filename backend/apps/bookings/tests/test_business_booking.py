from datetime import timedelta

import pytest

from apps.availability.models import Block
from apps.bookings import services
from apps.bookings.models import Booking, BookingEvent, BookingStatus
from apps.businesses.models import Business
from apps.customers.models import Customer

from .helpers import MON, NOW, at, configure, open_mondays


@pytest.fixture
def book_manually(business, service):
    def _book(starts_at=None, phone="987654321", name="Ana", now=NOW, **overrides):
        return services.create_booking_by_business(
            business=business,
            service=service,
            starts_at=starts_at or at(MON, 19),
            customer_name=name,
            customer_phone=phone,
            now=now,
            **overrides,
        )

    return _book


def test_manual_booking_is_confirmed_right_away(book_manually):
    booking, token = book_manually()

    assert booking.status == BookingStatus.CONFIRMED
    assert booking.expires_at is None
    assert booking.source == Booking.Source.BUSINESS
    assert services.find_booking_by_token(token) == booking


def test_manual_booking_is_recorded_as_made_by_the_business(book_manually):
    booking, _ = book_manually()

    event = booking.events.get()
    assert (event.to_status, event.actor) == (BookingStatus.CONFIRMED, BookingEvent.Actor.BUSINESS)


def test_manual_booking_keeps_the_price_and_duration(service, book_manually):
    service.reference_price = "50.00"
    service.save()

    booking, _ = book_manually()

    assert str(booking.price_snapshot) == "50.00"
    assert booking.duration_snapshot == 60


def test_manual_booking_may_fall_outside_opening_hours(business, resource, book_manually):
    open_mondays(business, resource)  # 18:00-22:00

    booking, _ = book_manually(starts_at=at(MON, 9))

    assert booking.starts_at == at(MON, 9)


def test_manual_booking_ignores_the_minimum_notice(business, book_manually):
    configure(business, min_booking_notice_minutes=24 * 60)

    book_manually(starts_at=at(MON, 19), now=at(MON, 18, 50))


def test_manual_booking_ignores_the_buffer(business, book_manually):
    configure(business, buffer_minutes=30)
    book_manually()

    book_manually(starts_at=at(MON, 20), phone="912345678")


def test_manual_booking_is_allowed_for_a_blocked_customer(business, book_manually):
    Customer.objects.create(business=business, name="Ana", phone="+51987654321", is_blocked=True)

    booking, _ = book_manually()

    assert booking.status == BookingStatus.CONFIRMED


def test_manual_booking_ignores_the_active_bookings_cap(business, book_manually):
    configure(business, max_active_bookings_per_customer=1)

    for hour in (18, 19, 20):
        book_manually(starts_at=at(MON, hour))

    assert Booking.objects.count() == 3


def test_phone_is_normalized(business, book_manually):
    book_manually(phone="987 654 321")

    assert Customer.objects.get().phone == "+51987654321"


def test_invalid_phone_is_rejected(book_manually):
    with pytest.raises(ValueError):
        book_manually(phone="123")

    assert Booking.objects.count() == 0


# --- what it still cannot do ---------------------------------------------------


def test_manual_booking_cannot_overlap_another_booking(book_manually):
    book_manually()

    with pytest.raises(services.SlotUnavailable):
        book_manually(starts_at=at(MON, 19, 30), phone="912345678")


def test_manual_booking_can_reuse_a_slot_held_by_an_overdue_pending_booking(
    business, resource, service, book_manually
):
    open_mondays(business, resource)
    old, _ = services.create_booking(
        business=business,
        service=service,
        starts_at=at(MON, 19),
        customer_name="Luis",
        customer_phone="912345678",
        now=NOW,
    )

    book_manually(now=NOW + timedelta(hours=3))

    old.refresh_from_db()
    assert old.status == BookingStatus.EXPIRED


def test_manual_booking_cannot_overlap_a_block_on_its_resource(business, resource, book_manually):
    Block.objects.create(
        business=business, resource=resource, starts_at=at(MON, 18), ends_at=at(MON, 20)
    )

    with pytest.raises(services.SlotBlocked):
        book_manually()


def test_manual_booking_cannot_overlap_a_business_wide_block(business, book_manually):
    Block.objects.create(business=business, starts_at=at(MON, 0), ends_at=at(MON, 23))

    with pytest.raises(services.SlotBlocked):
        book_manually()


def test_a_block_on_another_resource_does_not_matter(business, other_resource, book_manually):
    Block.objects.create(
        business=business, resource=other_resource, starts_at=at(MON, 18), ends_at=at(MON, 20)
    )

    book_manually()


def test_manual_booking_cannot_be_in_the_past(book_manually):
    with pytest.raises(services.SlotInPast):
        book_manually(starts_at=NOW - timedelta(days=1))


def test_manual_booking_that_is_still_running_is_allowed(book_manually):
    booking, _ = book_manually(starts_at=NOW - timedelta(minutes=30))

    assert booking.status == BookingStatus.CONFIRMED


def test_suspended_business_cannot_take_manual_bookings(business, book_manually):
    business.status = Business.Status.SUSPENDED
    business.save()

    with pytest.raises(services.SlotUnavailable):
        book_manually()


def test_inactive_service_cannot_be_booked_manually(service, book_manually):
    service.is_active = False
    service.save()

    with pytest.raises(services.SlotUnavailable):
        book_manually()


def test_service_of_another_business_is_rejected(service):
    other = Business.objects.create(slug="otro", name="Otro")

    with pytest.raises(ValueError):
        services.create_booking_by_business(
            business=other,
            service=service,
            starts_at=at(MON, 19),
            customer_name="Ana",
            customer_phone="987654321",
            now=NOW,
        )
