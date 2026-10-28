from io import StringIO

import pytest
from django.contrib.auth import get_user_model
from django.core.management import CommandError, call_command
from django.urls import reverse
from rest_framework.test import APIClient

from apps.availability.models import AvailabilityRule
from apps.businesses.models import Business
from apps.catalog.models import Resource, Service

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def development(settings):
    settings.DEBUG = True


def seed():
    out = StringIO()
    call_command("seed_demo", stdout=out)
    return out.getvalue()


def test_creates_a_court_and_a_therapist_ready_to_book():
    seed()

    court = Business.objects.get(slug="canchas-los-andes")
    therapist = Business.objects.get(slug="consultorio-lucia")
    assert (court.business_type, court.accent) == ("court", "lime")
    assert (therapist.business_type, therapist.accent) == ("psychologist", "cobalt")
    assert Resource.objects.filter(business=court).count() == 2
    assert Service.objects.filter(business=therapist).get().duration_minutes == 50
    assert AvailabilityRule.objects.filter(business=court, resource__name="Cancha 1").count() == 7
    assert AvailabilityRule.objects.filter(business=therapist).count() == 10


def test_running_it_twice_does_not_duplicate_anything():
    seed()
    output = seed()

    assert Business.objects.count() == 2
    assert Resource.objects.count() == 3
    assert "already exists" in output


def test_the_owners_can_sign_in_to_the_panel():
    seed()

    response = APIClient().post(
        reverse("auth-login"), {"email": "canchas@demo.pe", "password": "demo12345"}, format="json"
    )

    assert response.status_code == 200
    assert response.json()["user"]["memberships"][0]["business"]["slug"] == "canchas-los-andes"


def test_the_public_page_has_something_to_book():
    seed()

    data = APIClient().get(reverse("public-business", kwargs={"slug": "canchas-los-andes"})).json()

    assert [r["name"] for r in data["resources"]] == ["Cancha 1", "Cancha 2"]
    assert data["resources"][0]["services"][0]["reference_price"] == "60.00"


def test_it_refuses_to_run_outside_development(settings):
    settings.DEBUG = False

    with pytest.raises(CommandError):
        seed()

    assert not get_user_model().objects.exists()
