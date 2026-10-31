from io import StringIO

import pytest
from django.contrib.auth import get_user_model
from django.core.management import CommandError, call_command
from django.urls import reverse
from rest_framework.test import APIClient

from apps.availability.models import AvailabilityRule
from apps.billing import services as billing
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
    assert (court.business_type, court.accent) == ("court", "poppy")
    assert (therapist.business_type, therapist.accent) == ("psychologist", "sky")
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


def test_the_demo_subscriptions_show_both_a_paid_up_and_a_lapsed_business():
    seed()

    court = billing.standing(Business.objects.get(slug="canchas-los-andes"))
    therapist = billing.standing(Business.objects.get(slug="consultorio-lucia"))

    assert (court.state, court.days_left) == ("active", 20)
    assert therapist.state == "grace"  # so the warning can be seen without waiting


def test_a_lapsed_demo_business_still_takes_bookings_while_in_grace():
    seed()

    data = APIClient().get(reverse("public-business", kwargs={"slug": "consultorio-lucia"})).json()

    assert data["accepting_bookings"] is True


def test_a_member_of_the_platform_team_is_created_and_can_sign_in():
    output = seed()

    response = APIClient().post(
        reverse("auth-login"), {"email": "equipo@demo.pe", "password": "demo12345"}, format="json"
    )

    assert response.status_code == 200
    user = response.json()["user"]
    assert user["is_platform_admin"] is True
    assert user["memberships"] == []
    assert "/plataforma" in output


def test_the_team_member_is_not_duplicated_and_keeps_a_changed_password():
    seed()
    team = get_user_model().objects.get(email="equipo@demo.pe")
    team.set_password("otra-clave-123")
    team.save()

    output = seed()

    assert get_user_model().objects.filter(email="equipo@demo.pe").count() == 1
    assert get_user_model().objects.get(email="equipo@demo.pe").check_password("otra-clave-123")
    assert "equipo@demo.pe: already exists" in output


def test_the_demo_businesses_can_be_found_from_the_home_page_search():
    seed()

    results = APIClient().get(reverse("public-search"), {"q": "lucia"}).json()["results"]

    assert [item["slug"] for item in results] == ["consultorio-lucia"]
