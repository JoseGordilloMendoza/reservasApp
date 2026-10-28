from datetime import datetime, timezone

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Membership
from apps.catalog.models import Resource

START = datetime(2030, 1, 8, 0, 0, tzinfo=timezone.utc)


def create(panel, **data):
    return panel.post(reverse("panel-resources"), data, format="json")


def detail(pk):
    return reverse("panel-resource", kwargs={"pk": pk})


def names(response):
    return [item["name"] for item in response.json()["results"]]


def test_list_shows_the_resources_of_the_business(panel, resource, other_resource):
    response = panel.get(reverse("panel-resources"))

    assert response.status_code == 200
    assert names(response) == ["Cancha 1", "Cancha 2"]
    assert response.json()["results"][0] == {
        "id": resource.id,
        "name": "Cancha 1",
        "is_active": True,
        "position": 0,
    }


def test_list_includes_inactive_resources(panel, resource):
    resource.is_active = False
    resource.save()

    assert panel.get(reverse("panel-resources")).json()["results"][0]["is_active"] is False


def test_list_never_includes_another_business(panel, resource, other_business):
    Resource.objects.create(business=other_business, name="Ajena")

    assert names(panel.get(reverse("panel-resources"))) == ["Cancha 1"]


def test_owner_creates_a_resource(panel, business):
    response = create(panel, name="Cancha 3")

    assert response.status_code == 201
    created = Resource.objects.get(pk=response.json()["id"])
    assert created.business == business
    assert created.is_active


def test_new_resources_go_to_the_end_of_the_order(panel, resource):
    first = create(panel, name="Segunda").json()
    second = create(panel, name="Tercera").json()

    assert second["position"] == first["position"] + 1


def test_the_position_can_be_chosen(panel):
    assert create(panel, name="Primera", position=7).json()["position"] == 7


def test_names_are_unique_within_a_business(panel, resource):
    response = create(panel, name="Cancha 1")

    assert response.status_code == 400
    assert "name" in response.json()


def test_another_business_may_use_the_same_name(panel, other_panel, resource):
    assert create(other_panel, name="Cancha 1").status_code == 201


def test_a_name_is_required(panel):
    assert create(panel, name="").status_code == 400
    assert create(panel).status_code == 400


def test_a_resource_can_be_renamed_and_deactivated(panel, resource):
    response = panel.patch(detail(resource.pk), {"name": "Cancha Principal", "is_active": False}, format="json")

    assert response.status_code == 200
    resource.refresh_from_db()
    assert (resource.name, resource.is_active) == ("Cancha Principal", False)


def test_renaming_to_its_own_name_is_fine(panel, resource):
    assert panel.patch(detail(resource.pk), {"name": "Cancha 1"}, format="json").status_code == 200


def test_renaming_to_another_resources_name_is_refused(panel, resource, other_resource):
    response = panel.patch(detail(resource.pk), {"name": "Cancha 2"}, format="json")

    assert response.status_code == 400


def test_a_deactivated_resource_disappears_from_the_public_page(panel, resource, service, business):
    panel.patch(detail(resource.pk), {"is_active": False}, format="json")

    public = APIClient().get(reverse("public-business", kwargs={"slug": business.slug})).json()

    assert public["resources"] == []


def test_a_resource_without_bookings_can_be_deleted(panel, resource):
    assert panel.delete(detail(resource.pk)).status_code == 204
    assert not Resource.objects.filter(pk=resource.pk).exists()


def test_a_resource_with_bookings_cannot_be_deleted(panel, resource, make_booking):
    make_booking(starts_at=START)

    response = panel.delete(detail(resource.pk))

    assert response.status_code == 409
    assert response.json()["code"] == "has_bookings"
    assert Resource.objects.filter(pk=resource.pk).exists()


def test_deleting_a_resource_removes_its_services_and_schedule(panel, resource, service):
    panel.delete(detail(resource.pk))

    from apps.catalog.models import Service

    assert not Service.objects.filter(pk=service.pk).exists()


def test_a_resource_of_another_business_is_not_reachable(panel, other_business):
    foreign = Resource.objects.create(business=other_business, name="Ajena")

    assert panel.get(detail(foreign.pk)).status_code == 404
    assert panel.patch(detail(foreign.pk), {"name": "Mía"}, format="json").status_code == 404
    assert panel.delete(detail(foreign.pk)).status_code == 404
    foreign.refresh_from_db()
    assert foreign.name == "Ajena"


def test_staff_can_manage_resources(owner):
    Membership.objects.filter(user=owner).update(role=Membership.Role.STAFF)
    client = APIClient()
    client.force_authenticate(owner)

    assert create(client, name="Cancha 9").status_code == 201


def test_resource_endpoints_require_a_signed_in_user(db):
    assert APIClient().get(reverse("panel-resources")).status_code == 401
    assert APIClient().post(reverse("panel-resources"), {"name": "X"}, format="json").status_code == 401


@pytest.mark.parametrize("path", ["/api/v1/panel/resources/", "/api/v1/panel/resources/{id}/"])
def test_resource_endpoints_appear_in_the_api_docs(panel, path):
    assert path in panel.get("/api/schema/", {"format": "json"}).json()["paths"]
