from datetime import datetime, timezone
from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Membership
from apps.businesses.models import Business
from apps.catalog.models import Resource, Service

START = datetime(2030, 1, 8, 0, 0, tzinfo=timezone.utc)


def create(panel, **data):
    return panel.post(reverse("panel-services"), data, format="json")


def detail(pk):
    return reverse("panel-service", kwargs={"pk": pk})


def listed(panel, **params):
    return panel.get(reverse("panel-services"), params).json()["results"]


def test_list_shows_the_services_with_their_resource(panel, service):
    item = listed(panel)[0]

    assert item["id"] == service.id
    assert item["name"] == "Alquiler 1 hora"
    assert item["duration_minutes"] == 60
    assert item["resource"] == {"id": service.resource_id, "name": "Cancha 1"}
    assert item["is_active"] is True


def test_list_can_be_filtered_by_resource(panel, business, resource, other_resource, service):
    other = Service.objects.create(
        business=business, resource=other_resource, name="Otro", duration_minutes=30
    )

    assert [i["id"] for i in listed(panel, resource=other_resource.id)] == [other.id]
    assert [i["id"] for i in listed(panel, resource=resource.id)] == [service.id]


def test_list_never_includes_another_business(panel, service, other_business):
    foreign_resource = Resource.objects.create(business=other_business, name="Ajena")
    Service.objects.create(
        business=other_business, resource=foreign_resource, name="Ajeno", duration_minutes=60
    )

    assert [i["name"] for i in listed(panel)] == ["Alquiler 1 hora"]


def test_owner_creates_a_service(panel, business, resource):
    response = create(
        panel, resource_id=resource.id, name="Alquiler 90 min", duration_minutes=90, reference_price="75.50"
    )

    assert response.status_code == 201
    created = Service.objects.get(pk=response.json()["id"])
    assert (created.business, created.resource) == (business, resource)
    assert (created.duration_minutes, created.reference_price) == (90, Decimal("75.50"))
    assert "resource_id" not in response.json()


def test_the_duration_defaults_to_what_the_business_type_suggests(panel, business, resource):
    business.business_type = Business.BusinessType.PSYCHOLOGIST
    business.save()

    assert create(panel, resource_id=resource.id, name="Sesión").json()["duration_minutes"] == 50


def test_the_price_is_optional(panel, resource):
    response = create(panel, resource_id=resource.id, name="Consulta", duration_minutes=45)

    assert response.status_code == 201
    assert response.json()["reference_price"] is None


def test_a_resource_is_required(panel):
    response = create(panel, name="Huérfano", duration_minutes=60)

    assert response.status_code == 400
    assert "resource_id" in response.json()


def test_a_resource_of_another_business_is_rejected_like_a_missing_one(panel, other_business):
    foreign = Resource.objects.create(business=other_business, name="Ajena")

    foreign_response = create(panel, resource_id=foreign.id, name="X", duration_minutes=60)
    missing_response = create(panel, resource_id=999999, name="X", duration_minutes=60)

    assert foreign_response.status_code == missing_response.status_code == 400
    assert foreign_response.json() == missing_response.json()
    assert not Service.objects.filter(name="X").exists()


@pytest.mark.parametrize(
    "overrides",
    [
        {"duration_minutes": 0},
        {"duration_minutes": 4},
        {"duration_minutes": 1441},
        {"reference_price": "-1"},
        {"reference_price": "mucho"},
        {"name": ""},
        {"settings": {"unknown_option": 1}},
        {"settings": {"buffer_minutes": -5}},
    ],
)
def test_invalid_services_are_rejected(panel, resource, overrides):
    data = {"resource_id": resource.id, "name": "Servicio", "duration_minutes": 60, **overrides}

    assert create(panel, **data).status_code == 400
    assert not Service.objects.filter(name="Servicio").exists()


def test_a_service_can_override_the_business_options(panel, resource):
    response = create(
        panel,
        resource_id=resource.id,
        name="Sesión virtual",
        duration_minutes=40,
        settings={"confirmation_mode": "automatic", "buffer_minutes": 0},
    )

    assert response.status_code == 201
    assert response.json()["settings"] == {"confirmation_mode": "automatic", "buffer_minutes": 0}


# --- editing ----------------------------------------------------------------------------


def test_a_service_can_be_edited(panel, service):
    response = panel.patch(
        detail(service.pk),
        {"name": "Alquiler 2 horas", "duration_minutes": 120, "reference_price": "100", "is_active": False},
        format="json",
    )

    assert response.status_code == 200
    service.refresh_from_db()
    assert (service.name, service.duration_minutes, service.is_active) == ("Alquiler 2 horas", 120, False)
    assert service.reference_price == Decimal("100.00")


def test_editing_a_service_does_not_alter_existing_bookings(panel, service, make_booking):
    booking = make_booking(starts_at=START)

    panel.patch(detail(service.pk), {"duration_minutes": 120, "reference_price": "999"}, format="json")

    booking.refresh_from_db()
    assert booking.duration_snapshot == 60
    assert booking.price_snapshot is None


def test_a_service_cannot_be_moved_to_another_resource(panel, service, other_resource):
    response = panel.patch(detail(service.pk), {"resource_id": other_resource.id}, format="json")

    assert response.status_code == 400
    service.refresh_from_db()
    assert service.resource_id != other_resource.id


def test_sending_the_same_resource_again_is_harmless(panel, service, resource):
    assert panel.patch(detail(service.pk), {"resource_id": resource.id}, format="json").status_code == 200


def test_a_deactivated_service_disappears_from_the_public_page(panel, business, service):
    panel.patch(detail(service.pk), {"is_active": False}, format="json")

    public = APIClient().get(reverse("public-business", kwargs={"slug": business.slug})).json()

    assert public["resources"][0]["services"] == []


# --- deleting ----------------------------------------------------------------------------


def test_a_service_without_bookings_can_be_deleted(panel, service):
    assert panel.delete(detail(service.pk)).status_code == 204
    assert not Service.objects.filter(pk=service.pk).exists()


def test_a_service_with_bookings_cannot_be_deleted(panel, service, make_booking):
    make_booking(starts_at=START)

    response = panel.delete(detail(service.pk))

    assert response.status_code == 409
    assert response.json()["code"] == "has_bookings"
    assert Service.objects.filter(pk=service.pk).exists()


# --- isolation and access ---------------------------------------------------------------


def test_a_service_of_another_business_is_not_reachable(panel, other_business):
    foreign_resource = Resource.objects.create(business=other_business, name="Ajena")
    foreign = Service.objects.create(
        business=other_business, resource=foreign_resource, name="Ajeno", duration_minutes=60
    )

    assert panel.get(detail(foreign.pk)).status_code == 404
    assert panel.patch(detail(foreign.pk), {"name": "Mío"}, format="json").status_code == 404
    assert panel.delete(detail(foreign.pk)).status_code == 404
    foreign.refresh_from_db()
    assert foreign.name == "Ajeno"


def test_staff_can_manage_services(owner, resource):
    Membership.objects.filter(user=owner).update(role=Membership.Role.STAFF)
    client = APIClient()
    client.force_authenticate(owner)

    assert create(client, resource_id=resource.id, name="Hecho por staff", duration_minutes=60).status_code == 201


def test_service_endpoints_require_a_signed_in_user(db):
    assert APIClient().get(reverse("panel-services")).status_code == 401


@pytest.mark.parametrize("path", ["/api/v1/panel/services/", "/api/v1/panel/services/{id}/"])
def test_service_endpoints_appear_in_the_api_docs(panel, path):
    assert path in panel.get("/api/schema/", {"format": "json"}).json()["paths"]
