import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework.throttling import SimpleRateThrottle

User = get_user_model()

PASSWORD = "s3cret-pass-123"


@pytest.fixture
def api(db):
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user("ana@example.com", PASSWORD)


def attempt(api, email="ana@example.com", password="wrong-password"):
    return api.post(reverse("auth-login"), {"email": email, "password": password}, format="json")


def test_repeated_guesses_against_one_account_are_blocked(api, user):
    statuses = [attempt(api).status_code for _ in range(6)]

    assert statuses == [401, 401, 401, 401, 401, 429]


def test_the_right_password_is_also_refused_while_blocked(api, user):
    for _ in range(5):
        attempt(api)

    assert attempt(api, password=PASSWORD).status_code == 429


def test_spelling_variants_of_the_email_count_together(api, user):
    variants = ["ana@example.com", "ANA@example.com", " Ana@Example.com "]
    statuses = [attempt(api, email=variants[i % 3]).status_code for i in range(6)]

    assert statuses[-1] == 429


def test_other_accounts_are_not_affected(api, user):
    for _ in range(6):
        attempt(api)

    assert attempt(api, email="luis@example.com").status_code == 401


def test_one_address_trying_many_accounts_is_blocked(api, monkeypatch):
    rates = {"auth_login": "3/min", "auth_login_email": "100/min"}
    monkeypatch.setattr(SimpleRateThrottle, "THROTTLE_RATES", rates)

    statuses = [attempt(api, email=f"user{i}@example.com").status_code for i in range(4)]

    assert statuses == [401, 401, 401, 429]


def test_refresh_is_rate_limited(api, monkeypatch):
    monkeypatch.setattr(SimpleRateThrottle, "THROTTLE_RATES", {"auth_refresh": "2/min"})

    statuses = [
        api.post(reverse("auth-refresh"), {"refresh": "x"}, format="json").status_code
        for _ in range(3)
    ]

    assert statuses == [401, 401, 429]
