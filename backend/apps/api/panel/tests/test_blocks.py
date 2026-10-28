from datetime import datetime, timedelta, timezone

import pytest
from django.urls import reverse
from django.utils import timezone as dj_timezone
from rest_framework.test import APIClient

from apps.accounts.models import Membership
from apps.availability.models import AvailabilityRule, Block
from apps.availability.slots import get_available_slots
from apps.bookings.models import Booking, BookingStatus
from apps.catalog.models import Resource

UTC = timezone.utc
START = datetime(2030, 1, 8, 0, 0, tzinfo=UTC)  # Jan 7, 19:00 in Lima


@pytest.fixture
def staff_panel(owner):
    Membership.objects.filter(user=owner).update(role=Membership.Role.STAFF)
    client = APIClient()
    client.force_authenticate(owner)
    return client


def block_body(resource=None, starts=START, hours=2, **extra):
    body = {
        "resource": resource.pk if resource else None,
        "starts_at": starts.isoformat(),
        "ends_at": (starts + timedelta(hours=hours)).isoformat(),
        "reason": "Mantenimiento",
    }
    body.update(extra)
    return body


def create(panel, **kwargs):
    return panel.post(reverse("panel-blocks"), block_body(**kwargs), format="json")


def listed(panel, **params):
    return panel.get(reverse("panel-blocks"), params).json()["results"]


# --- creating ----------------------------------------------------------------------


def test_owner_blocks_a_resource(panel, resource):
    response = create(panel, resource=resource)

    assert response.status_code == 201
    data = response.json()
    assert data["resource"] == {"id": resource.id, "name": "Cancha 1"}
    assert data["reason"] == "Mantenimiento"
    assert data["conflicting_bookings"] == []
    assert Block.objects.get().business.slug == "cancha-los-andes"


def test_owner_closes_the_whole_business(panel):
    data = create(panel).json()

    assert data["resource"] is None
    assert Block.objects.get().resource is None


def test_existing_bookings_in_the_period_are_reported_but_not_cancelled(
    panel, resource, make_booking
):
    inside = make_booking(starts_at=START, status=BookingStatus.CONFIRMED)
    pending = make_booking(
        starts_at=START + timedelta(hours=1), expires_at=dj_timezone.now() + timedelta(hours=1)
    )
    make_booking(starts_at=START + timedelta(hours=5), status=BookingStatus.CONFIRMED)  # later
    make_booking(starts_at=START - timedelta(hours=3), status=BookingStatus.CONFIRMED)  # earlier
    make_booking(starts_at=START + timedelta(hours=2), status=BookingStatus.CANCELLED)  # not active

    data = create(panel, resource=resource).json()

    assert [c["id"] for c in data["conflicting_bookings"]] == [inside.id, pending.id]
    assert data["conflicting_bookings"][0]["customer_name"] == "Ana"
    assert Booking.objects.filter(status=BookingStatus.CANCELLED).count() == 1


def test_a_resource_block_ignores_bookings_of_other_resources(panel, resource, other_resource, make_booking):
    make_booking(starts_at=START, resource=other_resource, status=BookingStatus.CONFIRMED)

    assert create(panel, resource=resource).json()["conflicting_bookings"] == []


def test_a_business_wide_block_reports_bookings_on_every_resource(panel, other_resource, make_booking):
    make_booking(starts_at=START, status=BookingStatus.CONFIRMED)
    make_booking(starts_at=START, resource=other_resource, status=BookingStatus.CONFIRMED)

    assert len(create(panel).json()["conflicting_bookings"]) == 2


def test_the_block_closes_the_slots_in_the_availability_calculation(
    panel, business, resource, service
):
    AvailabilityRule.objects.create(
        business=business, resource=resource, weekday=0, start_time=datetime(2000, 1, 1, 18).time(),
        end_time=datetime(2000, 1, 1, 22).time(),
    )
    now = datetime(2030, 1, 1, 12, 0, tzinfo=UTC)
    monday = START.date() - timedelta(days=1)  # Jan 7, a Monday in Lima

    before = get_available_slots(resource, service, monday, now=now)
    create(panel, resource=resource)
    after = get_available_slots(resource, service, monday, now=now)

    assert len(before) == 4
    assert len(after) == 2  # 19:00-21:00 Lima is closed


@pytest.mark.parametrize(
    "overrides",
    [
        {"ends_at": "2030-01-07T10:00:00Z", "starts_at": "2030-01-08T10:00:00Z"},
        {"ends_at": "2030-01-08T00:00:00Z", "starts_at": "2030-01-08T00:00:00Z"},
        {"starts_at": "ayer"},
        {"reason": "x" * 201},
    ],
)
def test_invalid_blocks_are_rejected(panel, overrides):
    response = panel.post(reverse("panel-blocks"), block_body(**overrides), format="json")

    assert response.status_code == 400
    assert not Block.objects.exists()


def test_a_resource_of_another_business_is_rejected(panel, other_business):
    foreign = Resource.objects.create(business=other_business, name="Cancha X")

    response = create(panel, resource=foreign)

    assert response.status_code == 400
    assert "resource" in response.json()
    assert not Block.objects.exists()


def test_an_unknown_resource_looks_the_same_as_a_foreign_one(panel, other_business):
    foreign = Resource.objects.create(business=other_business, name="Cancha X")
    unknown = panel.post(
        reverse("panel-blocks"), {**block_body(), "resource": 999999}, format="json"
    )

    assert create(panel, resource=foreign).json() == unknown.json()


# --- listing -----------------------------------------------------------------------


def test_list_shows_only_upcoming_blocks_by_default(panel):
    future = dj_timezone.now() + timedelta(days=2)
    past = dj_timezone.now() - timedelta(days=5)
    create(panel, starts=future)
    create(panel, starts=past)

    assert len(listed(panel)) == 1
    assert len(listed(panel, include_past="true")) == 2


def test_list_is_ordered_by_start(panel):
    later = dj_timezone.now() + timedelta(days=9)
    sooner = dj_timezone.now() + timedelta(days=2)
    create(panel, starts=later)
    create(panel, starts=sooner)

    starts = [item["starts_at"] for item in listed(panel)]

    assert starts == sorted(starts)


def test_filtering_by_resource_includes_business_wide_blocks(panel, resource, other_resource):
    future = dj_timezone.now() + timedelta(days=2)
    create(panel, resource=resource, starts=future)
    create(panel, resource=other_resource, starts=future)
    create(panel, starts=future)

    found = listed(panel, resource=resource.id)

    assert sorted((item["resource"] or {}).get("id", 0) for item in found) == [0, resource.id]


def test_list_never_includes_another_business(panel, other_panel):
    future = dj_timezone.now() + timedelta(days=2)
    create(other_panel, starts=future)

    assert listed(panel) == []


def test_staff_can_see_the_blocks(staff_panel, business):
    soon = dj_timezone.now() + timedelta(days=2)
    Block.objects.create(business=business, starts_at=soon, ends_at=soon + timedelta(hours=1))

    assert len(listed(staff_panel)) == 1


# --- removing ----------------------------------------------------------------------


def remove(client, block):
    return client.delete(reverse("panel-block", kwargs={"pk": block.pk}))


def test_owner_removes_a_block(panel, business):
    block = Block.objects.create(business=business, starts_at=START, ends_at=START + timedelta(hours=1))

    assert remove(panel, block).status_code == 204
    assert not Block.objects.exists()


def test_a_block_of_another_business_cannot_be_removed(panel, other_business):
    foreign = Block.objects.create(
        business=other_business, starts_at=START, ends_at=START + timedelta(hours=1)
    )

    assert remove(panel, foreign).status_code == 404
    assert Block.objects.filter(pk=foreign.pk).exists()


# --- permissions -------------------------------------------------------------------


def test_staff_cannot_create_blocks(staff_panel):
    response = create(staff_panel)

    assert response.status_code == 403
    assert "dueño" in response.json()["detail"]
    assert not Block.objects.exists()


def test_staff_cannot_remove_blocks(staff_panel, business):
    block = Block.objects.create(business=business, starts_at=START, ends_at=START + timedelta(hours=1))

    assert remove(staff_panel, block).status_code == 403
    assert Block.objects.exists()


def test_blocks_require_a_signed_in_user(db):
    assert APIClient().get(reverse("panel-blocks")).status_code == 401
    assert APIClient().post(reverse("panel-blocks"), {}, format="json").status_code == 401


def test_block_endpoints_appear_in_the_api_docs(panel):
    paths = panel.get("/api/schema/", {"format": "json"}).json()["paths"]

    assert {"get", "post"} <= set(paths["/api/v1/panel/blocks/"])
    assert "delete" in paths["/api/v1/panel/blocks/{id}/"]
