import pytest
from django.urls import reverse
from rest_framework.test import APIClient

BASE = "https://images.example.dev"


@pytest.fixture(autouse=True)
def public_address(settings):
    settings.IMAGES_BASE_URL = BASE


@pytest.fixture
def api(db):
    return APIClient()


def test_a_business_without_pictures_gives_none(api, business):
    data = api.get(reverse("public-business", kwargs={"slug": business.slug})).json()

    assert data["logo_url"] is None
    assert data["cover_url"] is None


def test_the_business_page_gives_the_address_of_its_logo_and_cover(api, business):
    business.logo = "b1/logo-aaaa.webp"
    business.cover = "b1/cover-bbbb.webp"
    business.save()

    data = api.get(reverse("public-business", kwargs={"slug": business.slug})).json()

    assert data["logo_url"] == f"{BASE}/b1/logo-aaaa.webp"
    assert data["cover_url"] == f"{BASE}/b1/cover-bbbb.webp"


def test_the_directory_card_shows_the_logo_and_uses_the_cover_as_its_picture(api, business):
    business.logo = "b1/logo-aaaa.webp"
    business.cover = "b1/cover-bbbb.webp"
    business.save()

    (card,) = api.get(reverse("public-directory")).json()["results"]

    assert card["logo_url"] == f"{BASE}/b1/logo-aaaa.webp"
    assert card["cover_url"] == f"{BASE}/b1/cover-bbbb.webp"


def test_search_results_stay_small_and_carry_no_cover(api, business):
    business.cover = "b1/cover-bbbb.webp"
    business.save()

    (found,) = api.get(reverse("public-search"), {"q": "cancha"}).json()["results"]

    assert "cover_url" not in found


def test_search_results_show_the_logo(api, business):
    business.logo = "b1/logo-aaaa.webp"
    business.save()

    (found,) = api.get(reverse("public-search"), {"q": "cancha"}).json()["results"]

    assert found["logo_url"] == f"{BASE}/b1/logo-aaaa.webp"


def test_without_a_public_address_no_picture_is_offered(api, business, settings):
    settings.IMAGES_BASE_URL = ""
    business.logo = "b1/logo-aaaa.webp"
    business.save()

    assert api.get(reverse("public-business", kwargs={"slug": business.slug})).json()["logo_url"] is None
