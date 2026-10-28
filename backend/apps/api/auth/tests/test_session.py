from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

User = get_user_model()

PASSWORD = "s3cret-pass-123"


@pytest.fixture
def api(db):
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user("ana@example.com", PASSWORD)


@pytest.fixture
def session(api, user):
    return api.post(
        reverse("auth-login"), {"email": "ana@example.com", "password": PASSWORD}, format="json"
    ).json()


def refresh(api, token):
    return api.post(reverse("auth-refresh"), {"refresh": token}, format="json")


def test_refresh_gives_a_new_access_token(api, session):
    response = refresh(api, session["refresh"])

    assert response.status_code == 200
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {response.json()['access']}")
    assert api.get(reverse("auth-me")).status_code == 200


def test_refresh_token_is_rotated(api, session):
    first = refresh(api, session["refresh"]).json()

    assert first["refresh"] != session["refresh"]
    assert refresh(api, first["refresh"]).status_code == 200


def test_a_used_refresh_token_stops_working(api, session):
    refresh(api, session["refresh"])

    assert refresh(api, session["refresh"]).status_code == 401


def test_logout_invalidates_the_refresh_token(api, session):
    response = api.post(reverse("auth-logout"), {"refresh": session["refresh"]}, format="json")

    assert response.status_code == 200
    assert refresh(api, session["refresh"]).status_code == 401


def test_garbage_refresh_token_is_refused(api, db):
    assert refresh(api, "not-a-token").status_code == 401


def test_access_token_is_not_accepted_as_a_refresh_token(api, session):
    assert refresh(api, session["access"]).status_code == 401


def test_expired_access_token_is_refused(api, user):
    token = AccessToken.for_user(user)
    token.set_exp(lifetime=-timedelta(minutes=1))

    api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    assert api.get(reverse("auth-me")).status_code == 401


def test_deactivated_user_cannot_renew_the_session(api, user, session):
    user.is_active = False
    user.save()

    assert refresh(api, session["refresh"]).status_code == 401


def test_deactivated_user_loses_access_with_the_current_token(api, user, session):
    user.is_active = False
    user.save()

    api.credentials(HTTP_AUTHORIZATION=f"Bearer {session['access']}")

    assert api.get(reverse("auth-me")).status_code == 401


def test_refresh_and_logout_appear_in_the_api_docs(api):
    paths = api.get("/api/schema/", {"format": "json"}).json()["paths"]

    assert "/api/v1/auth/refresh/" in paths
    assert "/api/v1/auth/logout/" in paths
