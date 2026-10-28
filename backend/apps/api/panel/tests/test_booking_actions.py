from datetime import datetime, timedelta, timezone

import pytest
from django.urls import reverse
from django.utils import timezone as dj_timezone
from rest_framework.test import APIClient

from apps.accounts.models import Membership
from apps.bookings.models import Booking, BookingStatus
from apps.catalog.models import Resource, Service
from apps.customers.models import Customer

UTC = timezone.utc
FUTURE = datetime(2030, 1, 8, 0, 0, tzinfo=UTC)


def act(client, name, booking):
    return client.post(reverse(f"panel-booking-{name}", kwargs={"pk": booking.pk}))


def stored(booking):
    return Booking.objects.get(pk=booking.pk).status


@pytest.fixture
def started(make_booking):
    """A confirmed booking that began an hour ago."""
    start = dj_timezone.now() - timedelta(hours=1)
    return make_booking(starts_at=start, status=BookingStatus.CONFIRMED)


@pytest.fixture
def foreign_booking(other_business):
    resource = Resource.objects.create(business=other_business, name="Cancha X")
    service = Service.objects.create(
        business=other_business, resource=resource, name="Ajeno", duration_minutes=60
    )
    customer = Customer.objects.create(business=other_business, name="Intruso", phone="+51911111111")
    return Booking.objects.create(
        business=other_business,
        resource=resource,
        service=service,
        customer=customer,
        starts_at=FUTURE,
        ends_at=FUTURE + timedelta(hours=1),
        duration_snapshot=60,
        expires_at=dj_timezone.now() + timedelta(hours=1),
    )


# --- confirm / reject / cancel --------------------------------------------------


def test_confirming_returns_the_updated_booking_with_its_history(panel, make_booking):
    booking = make_booking(starts_at=FUTURE, expires_at=dj_timezone.now() + timedelta(hours=1))

    response = act(panel, "confirm", booking)

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "confirmed"
    assert data["expires_at"] is None
    assert [(e["to_status"], e["actor"]) for e in data["events"]] == [("confirmed", "business")]


def test_confirming_twice_is_a_conflict(panel, make_booking):
    booking = make_booking(starts_at=FUTURE, expires_at=dj_timezone.now() + timedelta(hours=1))
    act(panel, "confirm", booking)

    response = act(panel, "confirm", booking)

    assert response.status_code == 409
    assert response.json()["code"] == "invalid_transition"


def test_an_overdue_booking_cannot_be_confirmed(panel, make_booking):
    booking = make_booking(starts_at=FUTURE, expires_at=dj_timezone.now() - timedelta(hours=1))

    response = act(panel, "confirm", booking)

    assert response.status_code == 409
    assert response.json()["code"] == "booking_expired"
    assert stored(booking) == BookingStatus.EXPIRED


def test_rejecting_a_pending_booking(panel, make_booking):
    booking = make_booking(starts_at=FUTURE, expires_at=dj_timezone.now() + timedelta(hours=1))

    assert act(panel, "reject", booking).json()["status"] == "cancelled"


def test_a_confirmed_booking_cannot_be_rejected(panel, make_booking):
    booking = make_booking(starts_at=FUTURE, status=BookingStatus.CONFIRMED)

    assert act(panel, "reject", booking).status_code == 409


@pytest.mark.parametrize("status", [BookingStatus.PENDING, BookingStatus.CONFIRMED])
def test_cancelling_pending_or_confirmed_bookings(panel, make_booking, status):
    booking = make_booking(
        starts_at=FUTURE, status=status, expires_at=dj_timezone.now() + timedelta(hours=1)
    )

    assert act(panel, "cancel", booking).json()["status"] == "cancelled"


def test_a_cancelled_booking_cannot_be_cancelled_again(panel, make_booking):
    booking = make_booking(starts_at=FUTURE, status=BookingStatus.CANCELLED)

    assert act(panel, "cancel", booking).status_code == 409


# --- complete / no-show ---------------------------------------------------------


def test_completing_a_started_booking(panel, started):
    assert act(panel, "complete", started).json()["status"] == "completed"


def test_marking_a_no_show(panel, started):
    assert act(panel, "no-show", started).json()["status"] == "no_show"


@pytest.mark.parametrize("name", ["complete", "no-show"])
def test_these_wait_until_the_booking_starts(panel, make_booking, name):
    booking = make_booking(starts_at=FUTURE, status=BookingStatus.CONFIRMED)

    response = act(panel, name, booking)

    assert response.status_code == 409
    assert response.json()["code"] == "not_started_yet"
    assert stored(booking) == BookingStatus.CONFIRMED


@pytest.mark.parametrize("name", ["complete", "no-show"])
def test_a_pending_booking_cannot_be_completed(panel, make_booking, name):
    booking = make_booking(
        starts_at=dj_timezone.now() - timedelta(hours=1),
        expires_at=dj_timezone.now() + timedelta(hours=1),
    )

    assert act(panel, name, booking).status_code == 409


# --- isolation and access ---------------------------------------------------------


@pytest.mark.parametrize("name", ["confirm", "reject", "cancel", "complete", "no-show"])
def test_a_business_cannot_act_on_another_ones_booking(panel, foreign_booking, name):
    response = act(panel, name, foreign_booking)

    assert response.status_code == 404
    assert stored(foreign_booking) == BookingStatus.PENDING


@pytest.mark.parametrize("name", ["confirm", "reject", "cancel", "complete", "no-show"])
def test_actions_require_a_signed_in_user(make_booking, name):
    booking = make_booking(starts_at=FUTURE)

    assert act(APIClient(), name, booking).status_code == 401


def test_actions_only_accept_post(panel, make_booking):
    booking = make_booking(starts_at=FUTURE)

    response = panel.get(reverse("panel-booking-confirm", kwargs={"pk": booking.pk}))

    assert response.status_code == 405


def test_staff_can_manage_bookings_too(owner, make_booking):
    Membership.objects.filter(user=owner).update(role=Membership.Role.STAFF)
    client = APIClient()
    client.force_authenticate(owner)
    booking = make_booking(starts_at=FUTURE, expires_at=dj_timezone.now() + timedelta(hours=1))

    assert act(client, "confirm", booking).status_code == 200


def test_actions_appear_in_the_api_docs(panel):
    paths = panel.get("/api/schema/", {"format": "json"}).json()["paths"]

    for name in ("confirm", "reject", "cancel", "complete", "no-show"):
        assert f"/api/v1/panel/bookings/{{id}}/{name}/" in paths
