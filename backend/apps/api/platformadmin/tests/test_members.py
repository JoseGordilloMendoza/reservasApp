import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Membership
from apps.platformadmin.models import ActivityLog

User = get_user_model()


def users_url(business):
    return reverse("platform-users", kwargs={"slug": business.slug})


def user_url(business, membership, name="platform-user"):
    return reverse(name, kwargs={"slug": business.slug, "pk": membership.pk})


@pytest.fixture
def add(team, business, django_capture_on_commit_callbacks):
    def _add(**overrides):
        data = {"email": "Luis@Example.com", "first_name": "Luis", "role": "staff", **overrides}
        with django_capture_on_commit_callbacks(execute=True):
            return team.post(users_url(business), data, format="json")

    return _add


@pytest.fixture
def owner_membership(owner, business):
    return Membership.objects.get(user=owner, business=business)


class TestListing:
    def test_lists_who_works_there_with_how_they_sign_in(self, team, business, owner, owner_membership):
        owner.last_name = "Pérez"
        owner.google_sub = "g-123"
        owner.save()

        member = team.get(users_url(business)).json()[0]

        assert member["email"] == "ana@example.com"
        assert member["name"] == "Ana Pérez"
        assert member["role"] == "owner"
        assert member["has_password"] is True
        assert member["uses_google"] is True
        assert member["is_active"] is True

    def test_shows_who_never_got_to_choose_a_password(self, team, business, add):
        add()

        member = team.get(users_url(business)).json()[0]

        assert member["has_password"] is False
        assert member["last_login"] is None

    def test_only_the_people_of_that_business(self, team, business, other_business, owner):
        stranger = User.objects.create_user("otra@example.com", "clave-larga-123")
        Membership.objects.create(user=stranger, business=other_business)

        assert [m["email"] for m in team.get(users_url(business)).json()] == ["ana@example.com"]


class TestAdding:
    def test_creates_the_account_without_a_password_and_emails_a_link(self, team, business, add):
        response = add()

        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "luis@example.com"
        assert data["role"] == "staff"
        assert data["account_created"] is True
        assert [message.to for message in mail.outbox] == [["luis@example.com"]]
        assert "/panel/nueva-contrasena?uid=" in mail.outbox[0].body

    def test_an_existing_account_is_added_and_keeps_its_password(self, team, business, add):
        existing = User.objects.create_user("luis@example.com", "su-clave-actual-1")
        existing.last_login = existing.date_joined
        existing.save()

        response = add()

        assert response.json()["account_created"] is False
        existing.refresh_from_db()
        assert existing.check_password("su-clave-actual-1")
        assert "Ahora también puedes administrar" in mail.outbox[0].body

    def test_someone_already_there_is_a_conflict(self, team, business, owner, add):
        response = add(email="ANA@example.com")

        assert response.status_code == 409
        assert response.json()["code"] == "already_member"
        assert Membership.objects.filter(business=business).count() == 1

    def test_the_same_person_can_work_in_two_businesses(self, team, business, other_business, add):
        add()
        other = team.post(users_url(other_business), {"email": "luis@example.com"}, format="json")

        assert other.status_code == 201
        assert User.objects.filter(email="luis@example.com").count() == 1

    @pytest.mark.parametrize("payload", [{"email": "no-es-correo"}, {"email": ""}, {"role": "jefe"}])
    def test_bad_data_is_refused(self, team, business, add, payload):
        assert add(**payload).status_code == 400
        assert Membership.objects.filter(business=business).count() == 0

    def test_it_is_logged(self, team, business, add):
        add()

        entry = ActivityLog.objects.get(action="user.added")
        assert entry.detail == {"email": "luis@example.com", "role": "staff", "account_created": True}


class TestRoles:
    def test_changes_a_role_and_logs_it(self, team, business, owner_membership, add):
        add()
        member = Membership.objects.get(user__email="luis@example.com")

        response = team.patch(user_url(business, member), {"role": "owner"}, format="json")

        assert response.status_code == 200
        member.refresh_from_db()
        assert member.role == "owner"
        assert ActivityLog.objects.get(action="user.role_changed").detail["role"] == ["staff", "owner"]

    def test_the_only_owner_cannot_be_demoted(self, team, business, owner_membership):
        response = team.patch(user_url(business, owner_membership), {"role": "staff"}, format="json")

        assert response.status_code == 409
        assert response.json()["code"] == "last_owner"
        owner_membership.refresh_from_db()
        assert owner_membership.role == "owner"

    def test_an_owner_can_be_demoted_when_there_is_another(self, team, business, owner_membership, add):
        add(role="owner")

        response = team.patch(user_url(business, owner_membership), {"role": "staff"}, format="json")

        assert response.status_code == 200

    def test_setting_the_same_role_changes_and_logs_nothing(self, team, business, owner_membership):
        team.patch(user_url(business, owner_membership), {"role": "owner"}, format="json")

        assert ActivityLog.objects.count() == 0

    def test_an_unknown_role_is_refused(self, team, business, owner_membership):
        assert team.patch(user_url(business, owner_membership), {"role": "jefe"}, format="json").status_code == 400


class TestRemoving:
    def test_takes_away_the_place_but_not_the_account(self, team, business, owner_membership, add):
        add()
        member = Membership.objects.get(user__email="luis@example.com")

        response = team.delete(user_url(business, member))

        assert response.status_code == 204
        assert not Membership.objects.filter(pk=member.pk).exists()
        assert User.objects.filter(email="luis@example.com").exists()
        assert ActivityLog.objects.get(action="user.removed").detail == {"email": "luis@example.com"}

    def test_the_only_owner_cannot_be_removed(self, team, business, owner_membership):
        response = team.delete(user_url(business, owner_membership))

        assert response.status_code == 409
        assert Membership.objects.filter(pk=owner_membership.pk).exists()

    def test_someone_removed_can_no_longer_use_the_panel(self, team, business, owner_membership, add):
        add(email="luis@example.com")
        member = Membership.objects.get(user__email="luis@example.com")
        luis = member.user
        client = APIClient()
        client.force_authenticate(luis)
        assert client.get(reverse("panel-business")).status_code == 200

        team.delete(user_url(business, member))

        assert client.get(reverse("panel-business")).status_code == 403

    def test_a_membership_of_another_business_is_not_found(self, team, business, other_business):
        stranger = User.objects.create_user("otra@example.com", "clave-larga-123")
        theirs = Membership.objects.create(user=stranger, business=other_business)

        assert team.delete(user_url(business, theirs)).status_code == 404
        assert team.patch(user_url(business, theirs), {"role": "staff"}, format="json").status_code == 404
        assert Membership.objects.filter(pk=theirs.pk).exists()


class TestSendingTheLinkAgain:
    def test_someone_who_never_signed_in_gets_a_link_to_choose_a_password(self, team, business, add):
        add()
        mail.outbox.clear()
        member = Membership.objects.get(user__email="luis@example.com")

        response = team.post(user_url(business, member, "platform-user-link"))

        assert response.status_code == 200
        assert "luis@example.com" in response.json()["detail"]
        assert "/panel/nueva-contrasena?uid=" in mail.outbox[0].body
        assert ActivityLog.objects.filter(action="user.link_sent").count() == 1

    def test_someone_who_already_signs_in_gets_a_reminder_not_a_reset(self, team, business, owner, owner_membership):
        team.post(user_url(business, owner_membership, "platform-user-link"))

        assert "/panel/nueva-contrasena" not in mail.outbox[0].body
        assert "http://localhost:5173/panel" in mail.outbox[0].body

    def test_only_the_team(self, owner_client, business, owner_membership):
        assert owner_client.post(user_url(business, owner_membership, "platform-user-link")).status_code == 403
        assert owner_client.get(users_url(business)).status_code == 403
