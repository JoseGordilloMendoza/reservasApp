"""A subscription past its grace days stops new bookings everywhere they can start (RN-18)."""

from datetime import date, timedelta
from decimal import Decimal

import pytest

from apps.availability.slots import get_available_slots
from apps.billing import services as billing
from apps.bookings import services
from apps.bookings.models import Booking
from apps.bookings.tests.helpers import MON, NOW, at, open_mondays

START = at(MON, 19)


@pytest.fixture(autouse=True)
def open_hours(business, resource):
    open_mondays(business, resource)


def subscribe(business, valid_until):
    return billing.start_subscription(business=business, price=Decimal("80"), valid_until=valid_until)


def slots(resource, service):
    return get_available_slots(resource, service, MON, now=NOW)


def book(business, service, by="customer"):
    make = services.create_booking if by == "customer" else services.create_booking_by_business
    return make(
        business=business,
        service=service,
        starts_at=START,
        customer_name="Ana",
        customer_phone="987654321",
        now=NOW,
    )


def test_slots_are_offered_while_covered_and_in_grace(business, resource, service):
    subscribe(business, NOW.date() - timedelta(days=3))  # lapsed, inside the grace days

    assert slots(resource, service)


def test_no_slots_past_the_grace_days(business, resource, service):
    subscribe(business, NOW.date() - timedelta(days=30))

    assert slots(resource, service) == []


def test_a_customer_cannot_book_past_the_grace_days(business, service):
    subscribe(business, NOW.date() - timedelta(days=30))

    with pytest.raises(services.SlotUnavailable):
        book(business, service)
    assert Booking.objects.count() == 0


def test_the_owner_cannot_write_down_a_booking_past_the_grace_days_either(business, service):
    subscribe(business, NOW.date() - timedelta(days=30))

    with pytest.raises(services.SlotUnavailable):
        book(business, service, by="business")


def test_bookings_made_before_it_lapsed_are_kept(business, service):
    subscription = subscribe(business, date(2030, 1, 31))
    booking, _ = book(business, service)

    subscription.valid_until = date(2029, 6, 1)
    subscription.save()

    booking.refresh_from_db()
    assert booking.status == "pending"
    assert Booking.objects.count() == 1


def test_a_payment_makes_booking_possible_again(business, resource, service):
    subscribe(business, NOW.date() - timedelta(days=30))
    assert slots(resource, service) == []

    billing.register_payment(
        business=business, amount=Decimal("80"), method="cash", months=1, paid_on=NOW.date(), recorded_by=None
    )

    assert slots(resource, service)
    assert book(business, service)[0].pk
