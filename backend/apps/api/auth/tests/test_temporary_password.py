"""Accounts the team opens with a temporary password: the person must choose their own before anything else."""

import re

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts import credentials
from apps.accounts.models import Membership

User = get_user_model()

TEMPORARY = "k7mq-4xpd-9tzw"
OWN = "mi-clave-propia-segura-789"


@pytest.fixture
def api(db):
    return APIClient()


@pytest.fixture
def user(business):
    account = User.objects.create_user("rosa@example.com", TEMPORARY, first_name="Rosa")
    account.must_change_password = True
    account.save()
    Membership.objects.create(user=account, business=business, role=Membership.Role.OWNER)
    return account


def sign_in(api, password=TEMPORARY):
    response = api.post(reverse("auth-login"), {"email": "rosa@example.com", "password": password}, format="json")
    assert response.status_code == 200
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {response.json()['access']}")
    return response.json()


def change(api, current=TEMPORARY, new=OWN):
    return api.post(reverse("auth-change-password"), {"current_password": current, "new_password": new}, format="json")


class TestTheTemporaryPassword:
    def test_it_is_twelve_characters_in_three_groups_without_look_alikes(self):
        for _ in range(50):
            password = credentials.make_temporary_password()

            assert re.fullmatch(r"[a-z2-9]{4}(-[a-z2-9]{4}){2}", password)
            assert not set(password) & set("0o1il")

    def test_two_are_never_the_same(self):
        assert len({credentials.make_temporary_password() for _ in range(200)}) == 200

    def test_it_lets_the_person_sign_in_and_says_they_must_change_it(self, api, user):
        session = sign_in(api)

        assert session["user"]["must_change_password"] is True


class TestUntilItIsChanged:
    def test_the_panel_refuses_with_a_code_the_app_understands(self, api, user):
        sign_in(api)

        response = api.get(reverse("panel-business"))

        assert response.status_code == 403
        assert response.json()["code"] == "password_change_required"

    def test_so_does_the_platform_area_for_a_team_member(self, api, db):
        team = User.objects.create_superuser("equipo@example.com", TEMPORARY)
        team.must_change_password = True
        team.save()
        api.force_authenticate(team)

        response = api.get(reverse("platform-dashboard"))

        assert response.status_code == 403
        assert response.json()["code"] == "password_change_required"

    def test_who_they_are_and_how_to_leave_still_work(self, api, user):
        sign_in(api)

        assert api.get(reverse("auth-me")).status_code == 200


class TestChoosingOwn:
    def test_it_opens_the_panel_and_clears_the_flag(self, api, user):
        sign_in(api)

        response = change(api)

        assert response.status_code == 200
        assert response.json()["user"]["must_change_password"] is False
        api.credentials(HTTP_AUTHORIZATION=f"Bearer {response.json()['access']}")
        assert api.get(reverse("panel-business")).status_code == 200

    def test_the_temporary_one_stops_working_and_the_new_one_works(self, api, user):
        sign_in(api)
        change(api)
        fresh = APIClient()

        wrong = fresh.post(reverse("auth-login"), {"email": "rosa@example.com", "password": TEMPORARY}, format="json")
        right = fresh.post(reverse("auth-login"), {"email": "rosa@example.com", "password": OWN}, format="json")

        assert wrong.status_code == 401
        assert right.status_code == 200

    def test_the_session_it_was_made_from_is_closed(self, api, user):
        first = sign_in(api)
        change(api)

        refresh = APIClient().post(reverse("auth-refresh"), {"refresh": first["refresh"]}, format="json")

        assert refresh.status_code == 401

    def test_it_needs_the_current_password(self, api, user):
        sign_in(api)

        response = change(api, current="otra-clave-distinta")

        assert response.status_code == 400
        assert "current_password" in response.json()
        user.refresh_from_db()
        assert user.must_change_password is True

    def test_a_weak_one_is_refused_and_nothing_changes(self, api, user):
        sign_in(api)

        response = change(api, new="12345678")

        assert response.status_code == 400
        assert "new_password" in response.json()
        user.refresh_from_db()
        assert user.check_password(TEMPORARY)

    def test_it_cannot_be_the_same_as_the_current_one(self, api, user):
        sign_in(api)

        response = change(api, new=TEMPORARY)

        assert response.status_code == 400
        assert "distinta" in response.json()["new_password"][0]

    def test_it_needs_to_be_signed_in(self, api, db):
        assert change(api).status_code == 401

    def test_anyone_can_also_change_theirs_without_having_been_forced(self, api, business):
        user = User.objects.create_user("luis@example.com", "clave-larga-123")
        Membership.objects.create(user=user, business=business)
        api.force_authenticate(user)

        response = change(api, current="clave-larga-123")

        assert response.status_code == 200


class TestOtherWaysOfSettlingIt:
    def test_choosing_one_from_the_emailed_link_settles_it_too(self, api, user):
        from apps.accounts.password_reset import reset_link, set_new_password

        link = reset_link(user)
        uid, token = re.search(r"uid=([^&]+)&token=(.+)$", link).groups()

        set_new_password(uid, token, OWN)

        user.refresh_from_db()
        assert user.must_change_password is False

    def test_signing_in_with_google_makes_the_handed_over_password_useless(self, api, user, monkeypatch):
        monkeypatch.setattr(
            "apps.api.auth.views.verify_google_credential",
            lambda credential: {"sub": "g-1", "email": "rosa@example.com", "email_verified": True},
        )

        response = api.post(reverse("auth-google"), {"credential": "token"}, format="json")

        assert response.status_code == 200
        assert response.json()["user"]["must_change_password"] is False
        user.refresh_from_db()
        assert not user.has_usable_password()
        assert not user.check_password(TEMPORARY)

    def test_google_does_not_touch_the_password_of_someone_who_chose_their_own(self, api, business, monkeypatch):
        own = User.objects.create_user("luis@example.com", "clave-larga-123")
        Membership.objects.create(user=own, business=business)
        monkeypatch.setattr(
            "apps.api.auth.views.verify_google_credential",
            lambda credential: {"sub": "g-2", "email": "luis@example.com", "email_verified": True},
        )

        api.post(reverse("auth-google"), {"credential": "token"}, format="json")

        own.refresh_from_db()
        assert own.check_password("clave-larga-123")


def test_nothing_is_emailed_when_a_temporary_password_is_issued(user):
    credentials.issue_temporary_password(user)

    assert mail.outbox == []
