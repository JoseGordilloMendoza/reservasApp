from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from apps.billing import services as billing
from apps.businesses.models import Business


@pytest.fixture
def api(db):
    return APIClient()


def make(name, slug=None, **fields):
    fields.setdefault("listed", True)
    return Business.objects.create(name=name, slug=slug or name.lower().replace(" ", "-"), **fields)


def search(api, q):
    response = api.get(reverse("public-search"), {"q": q})
    assert response.status_code == 200
    return [item["slug"] for item in response.json()["results"]]


class TestWhatIsFound:
    def test_finds_by_part_of_the_name(self, api):
        make("Canchas Los Andes")

        assert search(api, "andes") == ["canchas-los-andes"]
        assert search(api, "Canchas Los") == ["canchas-los-andes"]

    def test_ignores_case_and_accents_in_both_directions(self, api):
        make("Consultorio Lucía Quispe", "consultorio-lucia")

        assert search(api, "LUCIA") == ["consultorio-lucia"]
        assert search(api, "lucía") == ["consultorio-lucia"]
        assert search(api, "  luCÍa   quispe ") == ["consultorio-lucia"]

    def test_a_business_that_did_not_opt_in_is_never_shown(self, api):
        make("Canchas Los Andes", listed=False)

        assert search(api, "andes") == []

    def test_a_suspended_business_is_not_shown(self, api):
        make("Canchas Los Andes", status=Business.Status.SUSPENDED)

        assert search(api, "andes") == []

    def test_nor_one_past_its_grace_days(self, api):
        business = make("Canchas Los Andes")
        billing.start_subscription(
            business=business, price=Decimal("80"), valid_until=billing.platform_today() - timedelta(days=30)
        )

        assert search(api, "andes") == []

    def test_one_in_its_grace_days_still_is(self, api):
        business = make("Canchas Los Andes")
        billing.start_subscription(
            business=business, price=Decimal("80"), valid_until=billing.platform_today() - timedelta(days=2)
        )

        assert search(api, "andes") == ["canchas-los-andes"]

    def test_one_paid_up_is_shown(self, api):
        business = make("Canchas Los Andes")
        billing.start_subscription(
            business=business, price=Decimal("80"), valid_until=billing.platform_today() + timedelta(days=20)
        )

        assert search(api, "andes") == ["canchas-los-andes"]

    def test_a_word_in_the_middle_matches(self, api):
        make("Canchas Los Andes")

        assert search(api, "los and") == ["canchas-los-andes"]

    def test_no_match_gives_an_empty_list(self, api):
        make("Canchas Los Andes")

        assert search(api, "psicologa") == []


class TestWhatIsNotOffered:
    def test_nothing_without_enough_letters_so_the_list_cannot_be_dumped(self, api):
        make("Canchas Los Andes")

        assert search(api, "") == []
        assert search(api, "c") == []
        assert search(api, "  c  ") == []
        assert api.get(reverse("public-search")).json() == {"results": []}

    def test_two_letters_are_enough(self, api):
        make("Canchas Los Andes")

        assert search(api, "ca") == ["canchas-los-andes"]

    def test_wildcards_are_just_characters(self, api):
        make("Canchas Los Andes")

        assert search(api, "%%") == []
        assert search(api, "c_n") == []
        assert search(api, ".*") == []

    def test_at_most_eight_results(self, api):
        for number in range(12):
            make(f"Cancha {number:02d}")

        assert len(search(api, "cancha")) == 8

    def test_names_that_start_with_what_was_typed_come_first(self, api):
        make("Gran Cancha Norte")
        make("Cancha del Sol")
        make("Cancha Azul")

        assert search(api, "cancha") == ["cancha-azul", "cancha-del-sol", "gran-cancha-norte"]

    def test_a_business_not_taking_bookings_does_not_use_up_a_place(self, api):
        for number in range(10):
            make(f"Cancha {number:02d}", status=Business.Status.SUSPENDED)
        make("Cancha Zeta")

        assert search(api, "cancha") == ["cancha-zeta"]

    def test_only_what_is_public_is_shown(self, api):
        make("Canchas Los Andes", address="Av. Ejército 123", phone="+51987654321", description="Grass")

        item = api.get(reverse("public-search"), {"q": "andes"}).json()["results"][0]

        assert set(item) == {"name", "slug", "business_type", "accent", "address"}
        assert item["address"] == "Av. Ejército 123"

    def test_needs_no_login(self, db):
        make("Canchas Los Andes")

        assert search(APIClient(), "andes") == ["canchas-los-andes"]


def test_a_search_costs_a_fixed_number_of_queries(api, django_assert_max_num_queries):
    for number in range(15):
        business = make(f"Cancha {number:02d}")
        billing.start_subscription(business=business, price=Decimal("80"), valid_until=date(2099, 1, 1))

    with django_assert_max_num_queries(3):
        assert len(search(api, "cancha")) == 8


def test_searches_are_rate_limited(api, monkeypatch):
    monkeypatch.setattr(ScopedRateThrottle, "THROTTLE_RATES", {"public_search": "3/min"})

    statuses = [api.get(reverse("public-search"), {"q": "ca"}).status_code for _ in range(5)]

    assert statuses == [200, 200, 200, 429, 429]
