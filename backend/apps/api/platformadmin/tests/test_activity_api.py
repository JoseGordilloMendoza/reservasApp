import pytest
from django.urls import reverse

from apps.platformadmin import activity


def get(client, **params):
    return client.get(reverse("platform-activity"), params)


@pytest.fixture
def history(team_member, business, other_business):
    activity.record(team_member, activity.BUSINESS_CREATED, business)
    activity.record(team_member, activity.PAYMENT_RECORDED, business, amount="80.00")
    activity.record(team_member, activity.SUPPORT_STARTED, other_business, reason="Ayuda")
    activity.record(team_member, activity.BUSINESS_SUSPENDED, other_business, reason="Sin pago")


def test_lists_the_latest_first_with_what_happened(team, history):
    data = get(team).json()

    assert data["count"] == 4
    assert [entry["action"] for entry in data["results"]] == [
        "business.suspended",
        "support.started",
        "payment.recorded",
        "business.created",
    ]
    first = data["results"][0]
    assert first["actor_email"] == "equipo@example.com"
    assert first["business_slug"] == "consultorio-lucia"
    assert first["detail"] == {"reason": "Sin pago"}


def test_only_one_business(team, history):
    results = get(team, business="cancha-los-andes").json()["results"]

    assert {entry["business_slug"] for entry in results} == {"cancha-los-andes"}
    assert len(results) == 2


def test_only_one_kind_of_action(team, history):
    assert [e["action"] for e in get(team, kind="support").json()["results"]] == ["support.started"]
    assert [e["action"] for e in get(team, kind="business").json()["results"]] == ["business.suspended", "business.created"]


def test_a_kind_is_not_matched_halfway(team, history):
    # "business" must not match an action that merely starts with those letters.
    assert get(team, kind="busi").json()["results"] == []


def test_both_filters_together(team, history):
    results = get(team, business="consultorio-lucia", kind="business").json()["results"]

    assert [entry["action"] for entry in results] == ["business.suspended"]


def test_is_paginated(team, team_member, business):
    for _ in range(30):
        activity.record(team_member, activity.BUSINESS_UPDATED, business)

    data = get(team).json()

    assert data["count"] == 30
    assert len(data["results"]) == 25
    assert data["next"]


def test_business_owners_cannot_read_it(owner_client, history):
    assert get(owner_client).status_code == 403
