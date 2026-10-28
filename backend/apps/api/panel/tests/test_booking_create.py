from datetime import datetime, timedelta, timezone

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Membership
from apps.availability.models import Block
from apps.bookings.models import Booking, BookingStatus
from apps.bookings.services import find_booking_by_token
from apps.catalog.models import Resource, Service
from apps.customers.models import Customer

UTC = timezone.utc
START = datetime(2030, 1, 8, 0, 0, tzinfo=UTC)


def body(service, /, **overrides):
    data = {
        "service": service.pk,
        "starts_at": START.isoformat(),
        "customer": {"name": "Ana", "phone": "987 654 321"},
    }
    data.update(overrides)
    return data


def create(panel, service, /, **overrides):
    return panel.post(reverse("panel-bookings"), body(service, **overrides), format="json")


def test_owner_records_a_booking_taken_by_phone(panel, service):
    response = create(panel, service)

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "confirmed"
    assert data["source"] == "business"
    assert data["expires_at"] is None
    assert data["customer"]["phone"] == "+51987654321"
    assert [(e["to_status"], e["actor"]) for e in data["events"]] == [("confirmed", "business")]


def test_the_customer_link_token_is_returned_once(panel, service):
    data = create(panel, service).json()

    booking = find_booking_by_token(data["manage_token"])

    assert booking.id == data["id"]
    assert "manage_token" not in panel.get(reverse("panel-booking", kwargs={"pk": data["id"]})).json()


def test_it_works_without_any_opening_hours_configured(panel, service):
    # No availability rules exist at all in this fixture.
    assert create(panel, service).status_code == 201


def test_the_new_booking_shows_up_in_the_list(panel, service):
    created = create(panel, service).json()

    listed = panel.get(reverse("panel-bookings")).json()["results"]

    assert [item["id"] for item in listed] == [created["id"]]


def test_an_existing_customer_is_reused(panel, service, customer):
    create(panel, service, customer={"name": "Ana", "phone": "987654321"})

    assert Customer.objects.count() == 1


def test_it_cannot_overlap_another_booking(panel, service, make_booking):
    make_booking(starts_at=START, status=BookingStatus.CONFIRMED)

    response = create(panel, service)

    assert response.status_code == 409
    assert response.json()["code"] == "slot_unavailable"


def test_it_cannot_overlap_a_block(panel, service, business, resource):
    Block.objects.create(
        business=business, resource=resource, starts_at=START - timedelta(hours=1), ends_at=START + timedelta(hours=2)
    )

    response = create(panel, service)

    assert response.status_code == 409
    assert response.json()["code"] == "slot_blocked"


def test_it_cannot_be_entirely_in_the_past(panel, service):
    response = create(panel, service, starts_at="2020-01-01T10:00:00Z")

    assert response.status_code == 400
    assert response.json()["code"] == "slot_in_past"


@pytest.mark.parametrize(
    "overrides",
    [
        {"customer": {"name": "Ana", "phone": "123"}},
        {"customer": {"name": "", "phone": "987654321"}},
        {"customer": None},
        {"starts_at": "ayer"},
        {"service": "x"},
    ],
)
def test_invalid_data_is_rejected(panel, service, overrides):
    response = create(panel, service, **overrides)

    assert response.status_code == 400
    assert Booking.objects.count() == 0


def test_a_service_of_another_business_is_not_found(panel, other_business):
    resource = Resource.objects.create(business=other_business, name="Cancha X")
    foreign = Service.objects.create(
        business=other_business, resource=resource, name="Ajeno", duration_minutes=60
    )

    response = create(panel, foreign)

    assert response.status_code == 404
    assert Booking.objects.count() == 0


def test_an_inactive_service_is_not_found(panel, service):
    service.is_active = False
    service.save()

    assert create(panel, service).status_code == 404


def test_it_requires_a_signed_in_user(service):
    response = APIClient().post(reverse("panel-bookings"), body(service), format="json")

    assert response.status_code == 401


def test_staff_can_record_bookings(owner, service):
    Membership.objects.filter(user=owner).update(role=Membership.Role.STAFF)
    client = APIClient()
    client.force_authenticate(owner)

    assert create(client, service).status_code == 201


def test_creating_a_booking_appears_in_the_api_docs(panel):
    paths = panel.get("/api/schema/", {"format": "json"}).json()["paths"]

    assert "post" in paths["/api/v1/panel/bookings/"]
