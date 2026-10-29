import pytest
from django.contrib.auth import get_user_model

from apps.platformadmin import activity
from apps.platformadmin.models import ActivityLog

User = get_user_model()


@pytest.fixture
def team_member(db):
    return User.objects.create_superuser("equipo@example.com", "clave-larga-123")


def test_records_who_did_what_to_which_business(team_member, business):
    entry = activity.record(team_member, activity.BUSINESS_SUSPENDED, business, reason="Sin pago")

    assert entry.actor_email == "equipo@example.com"
    assert entry.business_slug == "cancha-los-andes"
    assert entry.action == "business.suspended"
    assert entry.detail == {"reason": "Sin pago"}


def test_an_action_without_a_business_is_allowed(team_member):
    entry = activity.record(team_member, activity.BUSINESS_CREATED)

    assert entry.business is None
    assert entry.business_slug == ""


def test_the_latest_entry_comes_first(team_member, business):
    activity.record(team_member, activity.BUSINESS_CREATED, business)
    activity.record(team_member, activity.PAYMENT_RECORDED, business)

    assert [entry.action for entry in ActivityLog.objects.all()] == ["payment.recorded", "business.created"]


def test_entries_outlive_the_business_and_the_user(team_member, business):
    activity.record(team_member, activity.PAYMENT_RECORDED, business)

    business.delete()
    team_member.delete()

    entry = ActivityLog.objects.get()
    assert entry.business is None and entry.actor is None
    assert entry.business_slug == "cancha-los-andes"
    assert entry.actor_email == "equipo@example.com"
