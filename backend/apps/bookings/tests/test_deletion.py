import pytest
from django.db.models import RestrictedError

from apps.bookings.models import Booking
from apps.businesses.models import Business
from apps.catalog.models import Resource, Service
from apps.customers.models import Customer


def test_a_resource_with_bookings_cannot_be_deleted(resource, make_booking):
    make_booking()

    with pytest.raises(RestrictedError):
        resource.delete()


def test_a_service_with_bookings_cannot_be_deleted(service, make_booking):
    make_booking()

    with pytest.raises(RestrictedError):
        service.delete()


def test_a_customer_with_bookings_cannot_be_deleted(customer, make_booking):
    make_booking()

    with pytest.raises(RestrictedError):
        customer.delete()


def test_deleting_a_whole_business_removes_everything_it_owns(business, make_booking):
    make_booking()

    business.delete()

    assert not Business.objects.exists()
    assert not Booking.objects.exists()
    assert not Resource.objects.exists()
    assert not Service.objects.exists()
    assert not Customer.objects.exists()
