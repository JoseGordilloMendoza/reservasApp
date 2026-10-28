from datetime import datetime, timedelta, timezone

import pytest

from apps.bookings.models import Booking, BookingStatus
from apps.businesses.models import Business
from apps.catalog.models import Resource, Service
from apps.customers.models import Customer

BASE_START = datetime(2030, 1, 1, 18, 0, tzinfo=timezone.utc)


@pytest.fixture
def business(db):
    return Business.objects.create(slug="cancha-los-andes", name="Cancha Los Andes")


@pytest.fixture
def resource(business):
    return Resource.objects.create(business=business, name="Cancha 1")


@pytest.fixture
def other_resource(business):
    return Resource.objects.create(business=business, name="Cancha 2")


@pytest.fixture
def service(business, resource):
    return Service.objects.create(
        business=business, resource=resource, name="Alquiler 1 hora", duration_minutes=60
    )


@pytest.fixture
def customer(business):
    return Customer.objects.create(business=business, name="Ana", phone="+51987654321")


@pytest.fixture
def make_booking(business, resource, service, customer):
    def _make(starts_at=BASE_START, minutes=60, status=BookingStatus.PENDING, **overrides):
        fields = {
            "business": business,
            "resource": resource,
            "service": service,
            "customer": customer,
            "starts_at": starts_at,
            "ends_at": starts_at + timedelta(minutes=minutes),
            "duration_snapshot": minutes,
            "status": status,
        }
        fields.update(overrides)
        return Booking.objects.create(**fields)

    return _make
