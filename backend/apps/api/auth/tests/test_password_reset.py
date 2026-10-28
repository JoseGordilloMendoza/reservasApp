import re

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.urls import reverse
from rest_framework.test import APIClient

User = get_user_model()

OLD = "clave-antigua-123"
NEW = "clave-nueva-segura-456"


@pytest.fixture
def api(db):
    return APIClient()


@pytest.fixture
def user(db):
    return User.objects.create_user("ana@example.com", OLD, first_name="Ana")


def ask(api, email="ana@example.com"):
    return api.post(reverse("auth-password-reset"), {"email": email}, format="json")


def link_from_email():
    body = mail.outbox[-1].body
    return re.search(r"uid=([^&\s]+)&token=([^&\s]+)", body).groups()


def confirm(api, uid, token, password=NEW):
    return api.post(
        reverse("auth-password-reset-confirm"),
        {"uid": uid, "token": token, "password": password},
        format="json",
    )


class TestAskingForALink:
    def test_sends_the_email_to_a_registered_account(self, api, user):
        response = ask(api)

        assert response.status_code == 200
        assert [message.to for message in mail.outbox] == [["ana@example.com"]]

    def test_answers_the_same_for_an_unknown_address(self, api, user):
        known = ask(api, "ana@example.com")
        unknown = ask(api, "nadie@example.com")

        assert unknown.status_code == known.status_code == 200
        assert unknown.json() == known.json()
        assert len(mail.outbox) == 1  # only the real account was written to

    def test_asks_for_a_valid_email(self, api):
        assert ask(api, "no-es-un-correo").status_code == 400
        assert ask(api, "").status_code == 400

    def test_needs_no_sign_in(self, api, user):
        assert ask(api).status_code == 200

    def test_is_limited_per_address_so_an_inbox_is_not_flooded(self, api, user):
        statuses = [ask(api).status_code for _ in range(5)]

        assert statuses[:3] == [200, 200, 200]
        assert statuses[3] == 429
        assert len(mail.outbox) == 3

    def test_the_limit_per_inbox_ignores_the_case_of_the_address(self, api, user):
        for email in ("ana@example.com", "ANA@example.com", " Ana@Example.com "):
            assert ask(api, email).status_code == 200

        assert ask(api, "ana@EXAMPLE.com").status_code == 429

    def test_other_addresses_are_not_affected_by_one_limited_inbox(self, api, user):
        for _ in range(4):
            ask(api)

        assert ask(api, "otra@example.com").status_code == 200

    def test_is_limited_per_client_address(self, api, db):
        statuses = [ask(api, f"persona{n}@example.com").status_code for n in range(12)]

        assert statuses[:10] == [200] * 10
        assert statuses[10:] == [429, 429]


class TestChoosingAPassword:
    def test_the_whole_trip_ends_with_a_working_sign_in(self, api, user):
        ask(api)
        uid, token = link_from_email()

        response = confirm(api, uid, token)

        assert response.status_code == 200
        login = api.post(reverse("auth-login"), {"email": "ana@example.com", "password": NEW}, format="json")
        assert login.status_code == 200
        old = api.post(reverse("auth-login"), {"email": "ana@example.com", "password": OLD}, format="json")
        assert old.status_code == 401

    def test_the_link_works_only_once(self, api, user):
        ask(api)
        uid, token = link_from_email()
        confirm(api, uid, token)

        again = confirm(api, uid, token, "otra-clave-distinta-789")

        assert again.status_code == 400
        assert again.json()["code"] == "invalid_reset_link"

    def test_a_made_up_link_is_refused_with_a_clear_message(self, api, user):
        response = confirm(api, "MQ", "abc-123")

        assert response.status_code == 400
        assert response.json() == {
            "code": "invalid_reset_link",
            "detail": "El enlace no es válido o ya venció. Pide uno nuevo.",
        }

    def test_a_weak_password_names_the_problem_and_keeps_the_link(self, api, user):
        ask(api)
        uid, token = link_from_email()

        weak = confirm(api, uid, token, "123")

        assert weak.status_code == 400
        assert weak.json()["password"]
        assert confirm(api, uid, token).status_code == 200

    def test_asks_for_every_field(self, api):
        response = api.post(reverse("auth-password-reset-confirm"), {}, format="json")

        assert response.status_code == 400
        assert set(response.json()) == {"uid", "token", "password"}

    def test_signed_in_devices_are_signed_out(self, api, user):
        session = api.post(reverse("auth-login"), {"email": "ana@example.com", "password": OLD}, format="json").json()
        ask(api)
        uid, token = link_from_email()

        confirm(api, uid, token)

        refresh = api.post(reverse("auth-refresh"), {"refresh": session["refresh"]}, format="json")
        assert refresh.status_code == 401
