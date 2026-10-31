"""The team opens an account and hands over a temporary password instead of sending an email."""

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Membership
from apps.platformadmin.models import ActivityLog

User = get_user_model()


def new_business(team, django_capture_on_commit_callbacks, **extra):
    data = {
        "name": "Canchas El Sol",
        "owner": {"email": "rosa@example.com", "first_name": "Rosa", "last_name": "Quispe"},
        "subscription": {"plan_name": "Mensual", "price": "80.00", "trial_days": 30},
        **extra,
    }
    with django_capture_on_commit_callbacks(execute=True):
        return team.post(reverse("platform-businesses"), data, format="json")


class TestOpeningABusiness:
    def test_by_email_nothing_is_handed_over(self, team, db, django_capture_on_commit_callbacks):
        response = new_business(team, django_capture_on_commit_callbacks)

        assert response.json()["owner"]["temporary_password"] is None
        assert len(mail.outbox) == 1

    def test_with_credentials_the_password_is_shown_once_and_no_email_goes_out(
        self, team, db, django_capture_on_commit_callbacks
    ):
        response = new_business(team, django_capture_on_commit_callbacks, delivery="credentials")

        password = response.json()["owner"]["temporary_password"]
        assert password and len(password) == 14
        assert mail.outbox == []

    def test_and_with_it_the_owner_signs_in_but_must_change_it(self, team, db, django_capture_on_commit_callbacks):
        password = new_business(team, django_capture_on_commit_callbacks, delivery="credentials").json()["owner"][
            "temporary_password"
        ]

        session = APIClient().post(
            reverse("auth-login"), {"email": "rosa@example.com", "password": password}, format="json"
        ).json()

        assert session["user"]["must_change_password"] is True

    def test_the_password_itself_is_never_written_to_the_log(self, team, db, django_capture_on_commit_callbacks):
        password = new_business(team, django_capture_on_commit_callbacks, delivery="credentials").json()["owner"][
            "temporary_password"
        ]

        log = " ".join(str(entry.detail) for entry in ActivityLog.objects.all())

        assert password not in log
        assert ActivityLog.objects.filter(action="user.password_issued").exists()

    def test_someone_who_already_has_an_account_keeps_their_own_password(
        self, team, db, django_capture_on_commit_callbacks
    ):
        existing = User.objects.create_user("rosa@example.com", "su-clave-de-siempre-1")

        response = new_business(team, django_capture_on_commit_callbacks, delivery="credentials")

        assert response.json()["owner"]["temporary_password"] is None
        existing.refresh_from_db()
        assert existing.check_password("su-clave-de-siempre-1")
        assert existing.must_change_password is False

    def test_an_unknown_way_is_refused(self, team, db, django_capture_on_commit_callbacks):
        assert new_business(team, django_capture_on_commit_callbacks, delivery="carrier-pigeon").status_code == 400


class TestAddingAPerson:
    def test_with_credentials(self, team, business, django_capture_on_commit_callbacks):
        with django_capture_on_commit_callbacks(execute=True):
            response = team.post(
                reverse("platform-users", kwargs={"slug": business.slug}),
                {"email": "luis@example.com", "role": "staff", "delivery": "credentials"},
                format="json",
            )

        assert response.status_code == 201
        assert response.json()["temporary_password"]
        assert mail.outbox == []

    def test_by_email_nothing_is_handed_over(self, team, business, django_capture_on_commit_callbacks):
        with django_capture_on_commit_callbacks(execute=True):
            response = team.post(
                reverse("platform-users", kwargs={"slug": business.slug}),
                {"email": "luis@example.com", "role": "staff"},
                format="json",
            )

        assert response.json()["temporary_password"] is None
        assert len(mail.outbox) == 1


class TestANewTemporaryPassword:
    @pytest.fixture
    def membership(self, owner, business):
        return Membership.objects.get(user=owner, business=business)

    def url(self, business, membership):
        return reverse("platform-user-password", kwargs={"slug": business.slug, "pk": membership.pk})

    def test_replaces_the_old_one_and_makes_them_change_it(self, team, business, owner, membership):
        response = team.post(self.url(business, membership))

        password = response.json()["temporary_password"]
        owner.refresh_from_db()
        assert owner.check_password(password)
        assert not owner.check_password("clave-larga-123")
        assert owner.must_change_password is True

    def test_closes_the_sessions_they_had(self, team, business, owner, membership):
        session = APIClient().post(
            reverse("auth-login"), {"email": owner.email, "password": "clave-larga-123"}, format="json"
        ).json()

        team.post(self.url(business, membership))

        refresh = APIClient().post(reverse("auth-refresh"), {"refresh": session["refresh"]}, format="json")
        assert refresh.status_code == 401

    def test_is_for_the_team_only(self, owner_client, business, membership):
        assert owner_client.post(self.url(business, membership)).status_code == 403

    def test_cannot_reach_a_person_of_another_business(self, team, business, other_business, membership):
        outsider = User.objects.create_user("otra@example.com", "clave-larga-123")
        other = Membership.objects.create(user=outsider, business=other_business)

        assert team.post(self.url(business, other)).status_code == 404
