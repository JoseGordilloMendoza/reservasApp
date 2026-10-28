import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Membership

User = get_user_model()

PASSWORD = "s3cret-pass-123"


@pytest.fixture
def api(db):
    return APIClient()


@pytest.fixture
def owner(business):
    user = User.objects.create_user("ana@example.com", PASSWORD, first_name="Ana", last_name="Pérez")
    Membership.objects.create(user=user, business=business)
    return user


def login(api, email="ana@example.com", password=PASSWORD):
    return api.post(reverse("auth-login"), {"email": email, "password": password}, format="json")


def test_login_returns_tokens_and_the_user(api, owner):
    response = login(api)

    assert response.status_code == 200
    data = response.json()
    assert data["access"] and data["refresh"]
    assert data["user"]["email"] == "ana@example.com"
    assert data["user"]["name"] == "Ana Pérez"
    assert data["user"]["is_platform_admin"] is False
    assert data["user"]["memberships"] == [
        {
            "business": {"name": "Cancha Los Andes", "slug": "cancha-los-andes", "status": "active"},
            "role": "owner",
        }
    ]


def test_login_does_not_leak_sensitive_fields(api, owner):
    body = login(api).content.decode()

    assert "password" not in body
    assert "google_sub" not in body


def test_email_is_case_insensitive(api, owner):
    assert login(api, email="ANA@Example.com").status_code == 200


def test_login_records_the_last_login(api, owner):
    assert owner.last_login is None

    login(api)

    owner.refresh_from_db()
    assert owner.last_login is not None


def test_wrong_password_and_unknown_email_look_identical(api, owner):
    wrong_password = login(api, password="not-the-password")
    unknown_email = login(api, email="nobody@example.com")

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json()
    assert wrong_password.json()["code"] == "invalid_credentials"


def test_inactive_user_cannot_sign_in(api, owner):
    owner.is_active = False
    owner.save()

    assert login(api).status_code == 401


def test_user_without_a_password_cannot_sign_in(api, db):
    User.objects.create_user("sin-clave@example.com")

    assert login(api, email="sin-clave@example.com", password="").status_code in (400, 401)


@pytest.mark.parametrize("body", [{}, {"email": "ana@example.com"}, {"password": PASSWORD}, {"email": "x", "password": "y"}])
def test_login_requires_a_valid_email_and_password(api, body):
    response = api.post(reverse("auth-login"), body, format="json")

    assert response.status_code == 400


def test_access_token_opens_the_current_user_endpoint(api, owner):
    access = login(api).json()["access"]

    api.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    response = api.get(reverse("auth-me"))

    assert response.status_code == 200
    assert response.json()["email"] == "ana@example.com"


def test_current_user_requires_a_token(api):
    assert api.get(reverse("auth-me")).status_code == 401


def test_current_user_rejects_a_bad_token(api):
    api.credentials(HTTP_AUTHORIZATION="Bearer not-a-real-token")

    assert api.get(reverse("auth-me")).status_code == 401


def test_platform_admin_is_flagged(api, db):
    User.objects.create_superuser("root@example.com", PASSWORD)

    data = login(api, email="root@example.com").json()

    assert data["user"]["is_platform_admin"] is True
    assert data["user"]["memberships"] == []


def test_login_appears_in_the_api_docs(api):
    paths = api.get("/api/schema/", {"format": "json"}).json()["paths"]

    assert "/api/v1/auth/login/" in paths
    assert "/api/v1/auth/me/" in paths
