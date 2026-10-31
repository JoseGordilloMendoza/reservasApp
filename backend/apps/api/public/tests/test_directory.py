from datetime import timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.billing import services as billing
from apps.businesses.models import Business


@pytest.fixture
def api(db):
    return APIClient()


def make(name, **fields):
    return Business.objects.create(name=name, slug=name.lower().replace(" ", "-"), **fields)


def directory(api):
    response = api.get(reverse("public-directory"))
    assert response.status_code == 200
    return [item["slug"] for item in response.json()["results"]]


def test_a_new_business_appears_without_its_owner_doing_anything(api):
    make("Canchas Los Andes")

    assert directory(api) == ["canchas-los-andes"]


def test_one_that_asked_not_to_appear_is_left_out(api):
    make("Canchas Los Andes", listed=False)

    assert directory(api) == []


def test_the_newest_come_first(api):
    for name in ("Primera", "Segunda", "Tercera"):
        make(name)

    assert directory(api) == ["tercera", "segunda", "primera"]


def test_at_most_twelve_are_shown(api):
    for number in range(15):
        make(f"Cancha {number:02d}")

    assert len(directory(api)) == 12


def test_a_business_not_taking_bookings_does_not_use_up_a_place(api):
    make("Cancha Buena")
    for number in range(15):
        make(f"Cancha Cerrada {number:02d}", status=Business.Status.SUSPENDED)

    assert directory(api) == ["cancha-buena"]


def test_one_whose_subscription_ran_out_is_left_out(api):
    business = make("Canchas Los Andes")
    billing.start_subscription(
        business=business, price=Decimal("80"), valid_until=billing.platform_today() - timedelta(days=30)
    )

    assert directory(api) == []


def test_only_what_is_public_is_shown(api):
    make("Canchas Los Andes", address="Av. Ejército 123", phone="+51987654321", description="Grass")

    item = api.get(reverse("public-directory")).json()["results"][0]

    assert set(item) == {"name", "slug", "business_type", "accent", "address", "description"}
    assert item["description"] == "Grass"


def test_needs_no_login(db):
    make("Canchas Los Andes")

    assert directory(APIClient()) == ["canchas-los-andes"]
