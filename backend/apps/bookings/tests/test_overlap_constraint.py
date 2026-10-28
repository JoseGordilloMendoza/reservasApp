from datetime import timedelta

import pytest
from django.db import IntegrityError, transaction

from apps.bookings.models import BookingStatus
from conftest import BASE_START

BLOCKING = [
    BookingStatus.PENDING,
    BookingStatus.CONFIRMED,
    BookingStatus.COMPLETED,
    BookingStatus.NO_SHOW,
]
RELEASING = [BookingStatus.CANCELLED, BookingStatus.EXPIRED]


@pytest.mark.parametrize("existing_status", BLOCKING)
def test_overlapping_booking_on_same_resource_is_rejected(make_booking, existing_status):
    make_booking(status=existing_status)

    with pytest.raises(IntegrityError), transaction.atomic():
        make_booking(starts_at=BASE_START + timedelta(minutes=30))


def test_identical_time_on_same_resource_is_rejected(make_booking):
    make_booking()

    with pytest.raises(IntegrityError), transaction.atomic():
        make_booking()


def test_contained_booking_is_rejected(make_booking):
    make_booking(minutes=120)

    with pytest.raises(IntegrityError), transaction.atomic():
        make_booking(starts_at=BASE_START + timedelta(minutes=30), minutes=30)


def test_back_to_back_bookings_are_allowed(make_booking):
    make_booking()

    make_booking(starts_at=BASE_START + timedelta(minutes=60))
    make_booking(starts_at=BASE_START - timedelta(minutes=60))


def test_same_time_on_different_resources_is_allowed(make_booking, other_resource):
    make_booking()

    make_booking(resource=other_resource)


@pytest.mark.parametrize("released_status", RELEASING)
def test_cancelled_or_expired_booking_frees_the_slot(make_booking, released_status):
    make_booking(status=released_status)

    make_booking()


def test_changing_status_to_cancelled_frees_the_slot(make_booking):
    booking = make_booking(status=BookingStatus.CONFIRMED)
    booking.status = BookingStatus.CANCELLED
    booking.save()

    make_booking()


def test_reactivating_a_booking_over_a_taken_slot_is_rejected(make_booking):
    cancelled = make_booking(status=BookingStatus.CANCELLED)
    make_booking()

    cancelled.status = BookingStatus.CONFIRMED
    with pytest.raises(IntegrityError), transaction.atomic():
        cancelled.save()


def test_booking_must_end_after_it_starts(make_booking):
    with pytest.raises(IntegrityError), transaction.atomic():
        make_booking(minutes=0)
