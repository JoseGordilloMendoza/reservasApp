from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.platformadmin.models import ActivityLog, SupportSession

User = get_user_model()


def start(team, business, reason="El dueño no puede cargar sus horarios"):
    return team.post(reverse("platform-support-start", kwargs={"slug": business.slug}), {"reason": reason}, format="json")


def panel(client, business, name="panel-business", method="get", **kwargs):
    return getattr(client, method)(reverse(name), HTTP_X_BUSINESS=business.slug, **kwargs)


def logged():
    return list(ActivityLog.objects.order_by("id").values_list("action", flat=True))


class TestStarting:
    def test_opens_a_session_for_two_hours_with_the_reason(self, team, business):
        response = start(team, business)

        assert response.status_code == 201
        data = response.json()
        assert data["business"] == "cancha-los-andes"
        assert data["reason"] == "El dueño no puede cargar sus horarios"
        session = SupportSession.objects.get()
        assert timedelta(hours=1, minutes=59) < session.expires_at - session.started_at <= timedelta(hours=2)

    def test_a_reason_is_required(self, team, business):
        for reason in ("", "   "):
            assert start(team, business, reason).status_code == 400
        assert SupportSession.objects.count() == 0

    def test_it_is_logged(self, team, business):
        start(team, business)

        entry = ActivityLog.objects.get(action="support.started")
        assert entry.actor_email == "equipo@example.com"
        assert entry.business_slug == "cancha-los-andes"
        assert entry.detail["reason"] == "El dueño no puede cargar sus horarios"

    def test_an_unknown_business_is_not_found(self, team, db):
        response = team.post(reverse("platform-support-start", kwargs={"slug": "nada"}), {"reason": "x"}, format="json")

        assert response.status_code == 404

    def test_business_owners_cannot_open_one_for_themselves_or_anyone(self, owner_client, business, other_business):
        for target in (business, other_business):
            assert start(owner_client, target).status_code == 403
        assert SupportSession.objects.count() == 0


class TestWithoutASession:
    def test_the_team_cannot_enter_a_business_panel(self, team, business):
        response = panel(team, business)

        assert response.status_code == 403
        assert "sesión de soporte" in response.json()["detail"]

    def test_nor_without_naming_the_business(self, team, business):
        assert team.get(reverse("panel-business")).status_code == 403


class TestInsideABusiness:
    @pytest.fixture(autouse=True)
    def inside(self, team, business):
        start(team, business)

    def test_the_team_sees_the_business_with_the_owners_powers(self, team, business):
        response = panel(team, business)

        assert response.status_code == 200
        data = response.json()
        assert data["slug"] == "cancha-los-andes"
        assert data["role"] == "owner"

    def test_the_screen_is_told_it_is_a_support_session(self, team, business):
        support = panel(team, business).json()["support"]

        assert support["reason"] == "El dueño no puede cargar sus horarios"
        assert support["user"] == "equipo@example.com"
        assert support["expires_at"]
        assert support["session"] == SupportSession.objects.get().pk

    def test_owners_never_see_a_support_marker(self, owner_client, business):
        assert panel(owner_client, business).json()["support"] is None

    def test_it_can_change_things_like_the_owner(self, team, business):
        response = panel(team, business, method="patch", data={"description": "Corregido por soporte"}, format="json")

        assert response.status_code == 200
        business.refresh_from_db()
        assert business.description == "Corregido por soporte"

    def test_owner_only_actions_work_too(self, team, business, make_booking):
        booking = make_booking()

        response = team.post(reverse("panel-booking-confirm", kwargs={"pk": booking.pk}), HTTP_X_BUSINESS=business.slug)

        assert response.status_code == 200

    def test_every_change_is_logged_without_its_body(self, team, business):
        panel(team, business, method="patch", data={"description": "Dato privado del cliente"}, format="json")

        entry = ActivityLog.objects.get(action="support.action")
        assert entry.detail["method"] == "PATCH"
        assert entry.detail["path"] == "/api/v1/panel/business/"
        assert entry.detail["status"] == 200
        assert entry.business_slug == "cancha-los-andes"
        assert entry.actor_email == "equipo@example.com"
        assert "Dato privado" not in str(entry.detail)

    def test_reading_is_not_logged(self, team, business):
        panel(team, business)
        panel(team, business, "panel-bookings")

        assert logged() == ["support.started"]

    def test_a_change_that_was_refused_is_not_logged(self, team, business):
        response = panel(team, business, method="patch", data={"settings": {"inventado": 1}}, format="json")

        assert response.status_code == 400
        assert "support.action" not in logged()

    def test_it_only_opens_that_business(self, team, other_business):
        assert panel(team, other_business).status_code == 403

    def test_the_platform_api_still_works_meanwhile(self, team):
        assert team.get(reverse("platform-dashboard")).status_code == 200


class TestWhenItEnds:
    def test_an_expired_session_no_longer_opens_the_panel(self, team, business):
        start(team, business)
        SupportSession.objects.update(expires_at=timezone.now() - timedelta(seconds=1))

        assert panel(team, business).status_code == 403

    def test_ending_it_closes_the_door_and_is_logged(self, team, business):
        session_id = start(team, business).json()["id"]
        assert panel(team, business).status_code == 200

        response = team.post(reverse("platform-support-end", kwargs={"pk": session_id}))

        assert response.status_code == 200
        assert panel(team, business).status_code == 403
        assert logged() == ["support.started", "support.ended"]

    def test_ending_twice_logs_once(self, team, business):
        session_id = start(team, business).json()["id"]

        team.post(reverse("platform-support-end", kwargs={"pk": session_id}))
        team.post(reverse("platform-support-end", kwargs={"pk": session_id}))

        assert logged().count("support.ended") == 1

    def test_changes_after_it_ended_are_not_logged_because_they_cannot_happen(self, team, business):
        session_id = start(team, business).json()["id"]
        team.post(reverse("platform-support-end", kwargs={"pk": session_id}))

        response = panel(team, business, method="patch", data={"description": "x"}, format="json")

        assert response.status_code == 403
        assert "support.action" not in logged()

    def test_a_new_session_after_ending_works(self, team, business):
        session_id = start(team, business).json()["id"]
        team.post(reverse("platform-support-end", kwargs={"pk": session_id}))

        start(team, business, "Otra consulta")

        assert panel(team, business).status_code == 200


class TestSessionsBelongToWhoOpenedThem:
    @pytest.fixture
    def colleague(self, db):
        user = User.objects.create_superuser("colega@example.com", "clave-larga-123")
        client = APIClient()
        client.force_authenticate(user)
        return client

    def test_a_colleague_cannot_use_my_session(self, team, colleague, business):
        start(team, business)

        assert panel(colleague, business).status_code == 403

    def test_nor_end_it(self, team, colleague, business):
        session_id = start(team, business).json()["id"]

        assert colleague.post(reverse("platform-support-end", kwargs={"pk": session_id})).status_code == 404
        assert panel(team, business).status_code == 200

    def test_changes_are_logged_under_the_person_who_made_them(self, team, colleague, business):
        start(team, business)
        start(colleague, business, "Revisión")

        panel(colleague, business, method="patch", data={"description": "Hecho por colega"}, format="json")

        entry = ActivityLog.objects.get(action="support.action")
        assert entry.actor_email == "colega@example.com"


def test_a_business_owner_gets_nothing_from_a_support_session_of_someone_else(team, owner_client, other_business, business):
    start(team, other_business)

    assert panel(owner_client, other_business).status_code == 403
