import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Membership
from apps.businesses.models import Business
from apps.businesses.settings_schema import effective_settings


def patch(client, **data):
    return client.patch(reverse("panel-business"), data, format="json")


def test_the_business_shows_its_contact_details_and_a_suggested_duration(panel, business):
    business.description = "Canchas de grass"
    business.phone = "+51987654321"
    business.save()

    data = panel.get(reverse("panel-business")).json()

    assert data["description"] == "Canchas de grass"
    assert data["phone"] == "+51987654321"
    assert data["suggested_service_duration_minutes"] == 60


def test_the_suggested_duration_follows_the_business_type(panel, business):
    business.business_type = Business.BusinessType.PSYCHOLOGIST
    business.save()

    assert panel.get(reverse("panel-business")).json()["suggested_service_duration_minutes"] == 50


def test_owner_edits_the_public_page(panel, business):
    response = patch(
        panel, name="Canchas Los Andes", description="Grass sintético", address="Av. Ejército 123"
    )

    assert response.status_code == 200
    data = response.json()
    assert (data["name"], data["description"], data["address"]) == (
        "Canchas Los Andes",
        "Grass sintético",
        "Av. Ejército 123",
    )
    business.refresh_from_db()
    assert business.name == "Canchas Los Andes"


@pytest.mark.parametrize("field", ["phone", "whatsapp"])
def test_phone_numbers_are_normalized(panel, business, field):
    response = patch(panel, **{field: "987 654 321"})

    assert response.json()[field] == "+51987654321"


@pytest.mark.parametrize("field", ["phone", "whatsapp"])
def test_an_invalid_number_is_rejected(panel, business, field):
    response = patch(panel, **{field: "123"})

    assert response.status_code == 400
    assert field in response.json()


def test_a_number_can_be_cleared(panel, business):
    patch(panel, phone="987654321")

    assert patch(panel, phone="").json()["phone"] == ""


def test_the_accent_color_can_be_chosen_from_the_available_ones(panel, business):
    assert panel.get(reverse("panel-business")).json()["accent"] == "lime"

    response = patch(panel, accent="rose")

    assert response.status_code == 200
    assert response.json()["accent"] == "rose"
    business.refresh_from_db()
    assert business.accent == "rose"


@pytest.mark.parametrize("accent", ["purple", "", "#ff00ff"])
def test_an_unknown_accent_is_rejected(panel, business, accent):
    response = patch(panel, accent=accent)

    assert response.status_code == 400
    assert "accent" in response.json()
    business.refresh_from_db()
    assert business.accent == "lime"


def test_the_name_cannot_be_empty(panel):
    assert patch(panel, name="").status_code == 400


def test_the_link_type_timezone_and_status_cannot_be_changed(panel, business):
    patch(
        panel,
        slug="otro-link",
        business_type="psychologist",
        timezone="Europe/Madrid",
        status="suspended",
        name="Nuevo nombre",
    )

    business.refresh_from_db()
    assert business.slug == "cancha-los-andes"
    assert business.business_type == "generic"
    assert business.timezone == "America/Lima"
    assert business.status == "active"
    assert business.name == "Nuevo nombre"


# --- settings -------------------------------------------------------------------------


def test_settings_are_merged_not_replaced(panel, business):
    before = dict(business.settings)

    response = patch(panel, settings={"buffer_minutes": 15, "confirmation_mode": "automatic"})

    assert response.status_code == 200
    business.refresh_from_db()
    assert business.settings["buffer_minutes"] == 15
    assert business.settings["confirmation_mode"] == "automatic"
    assert business.settings["pending_hold_minutes"] == before["pending_hold_minutes"]
    assert response.json()["settings"]["buffer_minutes"] == 15


def test_changed_settings_take_effect(panel, business):
    patch(panel, settings={"slot_interval_minutes": 30})
    business.refresh_from_db()

    assert effective_settings(business)["slot_interval_minutes"] == 30


@pytest.mark.parametrize(
    "settings",
    [
        {"unknown_option": 1},
        {"buffer_minutes": -1},
        {"buffer_minutes": "diez"},
        {"confirmation_mode": "maybe"},
        {"booking_horizon_days": 9999},
    ],
)
def test_invalid_settings_are_rejected_and_nothing_changes(panel, business, settings):
    before = dict(business.settings)

    response = patch(panel, name="Cambio", settings=settings)

    assert response.status_code == 400
    assert "settings" in response.json()
    business.refresh_from_db()
    assert business.settings == before
    assert business.name == "Cancha Los Andes"


def test_settings_must_be_an_object(panel):
    assert patch(panel, settings=["buffer_minutes"]).status_code == 400


# --- who can do it ---------------------------------------------------------------------


def test_editing_does_not_touch_another_business(panel, other_business):
    patch(panel, name="Solo el mío", settings={"buffer_minutes": 30})

    other_business.refresh_from_db()
    assert other_business.name == "Otro Negocio"
    assert other_business.settings["buffer_minutes"] == 0


def test_staff_can_edit_too(owner):
    Membership.objects.filter(user=owner).update(role=Membership.Role.STAFF)
    client = APIClient()
    client.force_authenticate(owner)

    assert patch(client, description="Hecho por el personal").status_code == 200


def test_editing_requires_a_signed_in_user(db):
    assert patch(APIClient(), name="X").status_code == 401


def test_a_suspended_business_can_still_be_edited_by_its_owner(panel, business):
    business.status = Business.Status.SUSPENDED
    business.save()

    assert patch(panel, description="Aún puedo editar").status_code == 200


def test_editing_appears_in_the_api_docs(panel):
    paths = panel.get("/api/schema/", {"format": "json"}).json()["paths"]

    assert "patch" in paths["/api/v1/panel/business/"]
