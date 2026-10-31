from datetime import datetime, timedelta, timezone

import pytest
from django.core.cache import cache
from django.test import override_settings

from apps.bookings.models import Booking, BookingStatus
from apps.businesses.models import Business
from apps.businesses.presets import preset_settings
from apps.catalog.models import Resource, Service
from apps.customers.models import Customer

BASE_START = datetime(2030, 1, 1, 18, 0, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def emails_in_the_foreground():
    # Background threads would make assertions about the outbox race with the test.
    # override_settings, not the settings fixture: some tests use "settings" as a parameter name.
    with override_settings(EMAIL_IN_BACKGROUND=False):
        yield


@pytest.fixture(autouse=True)
def clear_cache():
    # Throttle counters live in the cache; start every test with a clean slate.
    cache.clear()


# The rules for customers who are not yet trusted (a shorter wait, one active booking) would get in the way of
# tests about everything else, so this business treats everyone alike. The tests of those rules start from
# the platform defaults instead (see apps/bookings/tests/test_trust.py).
EVERYONE_ALIKE = {"unverified_hold_minutes": 120, "max_active_bookings_unverified": 3}


@pytest.fixture
def business(db):
    return Business.objects.create(slug="cancha-los-andes", name="Cancha Los Andes", settings={**preset_settings("generic"), **EVERYONE_ALIKE})


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
