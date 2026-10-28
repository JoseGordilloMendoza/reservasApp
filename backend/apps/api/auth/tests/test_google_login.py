import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework.throttling import SimpleRateThrottle

from apps.accounts import google
from apps.accounts.models import Membership

User = get_user_model()


@pytest.fixture
def api(db):
    return APIClient()


@pytest.fixture
def owner(business):
    user = User.objects.create_user("ana@example.com", first_name="Ana")
    Membership.objects.create(user=user, business=business)
    return user


@pytest.fixture
def google_says(monkeypatch):
    """Make the 'Google' check return the given claims, or raise the given error."""

    def _set(result):
        def fake(credential):
            if isinstance(result, Exception):
                raise result
            return result

        monkeypatch.setattr("apps.api.auth.views.verify_google_credential", fake)

    return _set


def sign_in(api, credential="google-id-token"):
    return api.post(reverse("auth-google"), {"credential": credential}, format="json")


def identity(**overrides):
    return {"sub": "google-123", "email": "ana@example.com", "email_verified": True, **overrides}


def test_existing_user_signs_in_with_google(api, owner, google_says):
    google_says(identity())

    response = sign_in(api)

    assert response.status_code == 200
    data = response.json()
    assert data["access"] and data["refresh"]
    assert data["user"]["email"] == "ana@example.com"
    assert data["user"]["memberships"][0]["business"]["slug"] == "cancha-los-andes"


def test_the_session_works_like_a_password_login(api, owner, google_says):
    google_says(identity())
    access = sign_in(api).json()["access"]

    api.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    assert api.get(reverse("auth-me")).json()["email"] == "ana@example.com"


def test_user_without_a_password_can_use_google(api, owner, google_says):
    assert not owner.has_usable_password()
    google_says(identity())

    assert sign_in(api).status_code == 200


def test_signing_in_updates_the_last_login(api, owner, google_says):
    google_says(identity())

    sign_in(api)

    owner.refresh_from_db()
    assert owner.last_login is not None


def test_unknown_account_is_refused_and_not_created(api, db, google_says):
    google_says(identity(email="nobody@example.com"))

    response = sign_in(api)

    assert response.status_code == 401
    assert response.json()["code"] == "account_not_found"
    assert not User.objects.exists()


def test_unverified_email_is_refused(api, owner, google_says):
    google_says(identity(email_verified=False))

    response = sign_in(api)

    assert response.status_code == 401
    assert response.json()["code"] == "google_email_not_verified"


def test_a_token_google_does_not_accept_is_refused(api, owner, google_says):
    google_says(google.InvalidGoogleToken())

    response = sign_in(api)

    assert response.status_code == 401
    assert response.json()["code"] == "invalid_google_token"


def test_a_different_google_account_cannot_take_over_a_linked_user(api, owner, google_says):
    owner.google_sub = "google-123"
    owner.save()
    google_says(identity(sub="google-attacker"))

    response = sign_in(api)

    assert response.status_code == 401
    assert response.json()["code"] == "google_account_mismatch"


def test_deactivated_user_is_refused(api, owner, google_says):
    owner.is_active = False
    owner.save()
    google_says(identity())

    assert sign_in(api).status_code == 401


def test_google_sign_in_is_unavailable_until_configured(api, owner, settings):
    settings.GOOGLE_CLIENT_ID = ""

    response = sign_in(api)

    assert response.status_code == 503
    assert response.json()["code"] == "google_not_configured"


def test_credential_is_required(api, db):
    response = api.post(reverse("auth-google"), {}, format="json")

    assert response.status_code == 400


def test_google_sign_in_is_rate_limited(api, owner, google_says, monkeypatch):
    monkeypatch.setattr(SimpleRateThrottle, "THROTTLE_RATES", {"auth_google": "2/min"})
    google_says(google.InvalidGoogleToken())

    statuses = [sign_in(api).status_code for _ in range(3)]

    assert statuses == [401, 401, 429]


def test_google_endpoint_appears_in_the_api_docs(api):
    assert "/api/v1/auth/google/" in api.get("/api/schema/", {"format": "json"}).json()["paths"]
