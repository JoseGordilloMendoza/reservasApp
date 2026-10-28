from datetime import date, datetime, time, timezone

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Membership
from apps.availability.models import AvailabilityRule
from apps.availability.slots import get_available_slots
from apps.catalog.models import Resource

NOW = datetime(2030, 1, 1, 12, 0, tzinfo=timezone.utc)
MONDAY = date(2030, 1, 7)


def url(resource):
    return reverse("panel-resource-schedule", kwargs={"pk": resource.pk})


def rule(weekday, start, end):
    return {"weekday": weekday, "start_time": start, "end_time": end}


def put(panel, resource, *rules):
    return panel.put(url(resource), {"rules": list(rules)}, format="json")


def stored(resource):
    return [
        (r.weekday, r.start_time.strftime("%H:%M"), r.end_time.strftime("%H:%M"))
        for r in AvailabilityRule.objects.filter(resource=resource).order_by("weekday", "start_time")
    ]


def test_a_new_resource_has_an_empty_schedule(panel, resource):
    response = panel.get(url(resource))

    assert response.status_code == 200
    assert response.json() == {"rules": []}


def test_owner_sets_the_weekly_schedule(panel, resource):
    response = put(panel, resource, rule(0, "18:00", "22:00"), rule(5, "09:00", "13:00"))

    assert response.status_code == 200
    assert response.json()["rules"] == [
        {"weekday": 0, "start_time": "18:00:00", "end_time": "22:00:00"},
        {"weekday": 5, "start_time": "09:00:00", "end_time": "13:00:00"},
    ]
    assert stored(resource) == [(0, "18:00", "22:00"), (5, "09:00", "13:00")]


def test_get_returns_what_was_saved_in_order(panel, resource):
    put(panel, resource, rule(4, "18:00", "22:00"), rule(0, "10:00", "12:00"), rule(0, "08:00", "09:00"))

    weekdays_and_starts = [(r["weekday"], r["start_time"]) for r in panel.get(url(resource)).json()["rules"]]

    assert weekdays_and_starts == [(0, "08:00:00"), (0, "10:00:00"), (4, "18:00:00")]


def test_saving_replaces_the_previous_schedule(panel, resource):
    put(panel, resource, rule(0, "18:00", "22:00"), rule(1, "18:00", "22:00"))

    put(panel, resource, rule(2, "10:00", "14:00"))

    assert stored(resource) == [(2, "10:00", "14:00")]


def test_an_empty_list_closes_the_resource(panel, resource):
    put(panel, resource, rule(0, "18:00", "22:00"))

    response = put(panel, resource)

    assert response.json() == {"rules": []}
    assert stored(resource) == []


def test_the_schedule_drives_the_available_slots(panel, resource, service):
    put(panel, resource, rule(0, "18:00", "20:00"))

    slots = get_available_slots(resource, service, MONDAY, now=NOW)

    assert len(slots) == 2


def test_windows_may_touch_and_end_at_midnight(panel, resource):
    response = put(panel, resource, rule(0, "08:00", "12:00"), rule(0, "12:00", "18:00"), rule(0, "18:00", "00:00"))

    assert response.status_code == 200
    assert len(stored(resource)) == 3


def test_open_all_day_is_allowed(panel, resource):
    assert put(panel, resource, rule(6, "00:00", "00:00")).status_code == 200


def test_hours_past_midnight_use_a_second_window_on_the_next_day(panel, resource):
    response = put(panel, resource, rule(4, "22:00", "00:00"), rule(5, "00:00", "02:00"))

    assert response.status_code == 200


def test_overlapping_windows_are_refused_and_nothing_changes(panel, resource):
    put(panel, resource, rule(0, "18:00", "22:00"))

    response = put(panel, resource, rule(1, "10:00", "12:00"), rule(1, "11:00", "14:00"))

    assert response.status_code == 400
    assert "martes" in response.json()["rules"][0]
    assert stored(resource) == [(0, "18:00", "22:00")]


def test_a_window_overlapping_an_all_day_window_is_refused(panel, resource):
    response = put(panel, resource, rule(0, "00:00", "00:00"), rule(0, "10:00", "12:00"))

    assert response.status_code == 400


def test_identical_windows_count_as_overlapping(panel, resource):
    assert put(panel, resource, rule(0, "18:00", "22:00"), rule(0, "18:00", "22:00")).status_code == 400


def test_the_same_hours_on_different_days_are_fine(panel, resource):
    assert put(panel, resource, rule(0, "18:00", "22:00"), rule(1, "18:00", "22:00")).status_code == 200


@pytest.mark.parametrize(
    "bad",
    [
        rule(0, "22:00", "18:00"),
        rule(0, "18:00", "18:00"),
        rule(7, "18:00", "22:00"),
        rule(-1, "18:00", "22:00"),
        rule(0, "tarde", "22:00"),
        {"weekday": 0, "start_time": "18:00"},
    ],
)
def test_invalid_windows_are_refused(panel, resource, bad):
    assert put(panel, resource, bad).status_code == 400
    assert stored(resource) == []


def test_there_is_a_limit_to_the_number_of_windows(panel, resource):
    rules = [rule(day, f"{hour:02d}:00", f"{hour:02d}:30") for day in range(7) for hour in range(8)]

    assert put(panel, resource, *rules).status_code == 400


def test_the_body_must_contain_the_rules(panel, resource):
    assert panel.put(url(resource), {}, format="json").status_code == 400


def test_the_schedule_of_another_business_is_not_reachable(panel, other_business):
    foreign = Resource.objects.create(business=other_business, name="Ajena")

    assert panel.get(url(foreign)).status_code == 404
    assert put(panel, foreign, rule(0, "18:00", "22:00")).status_code == 404
    assert stored(foreign) == []


def test_changing_the_schedule_leaves_existing_bookings_alone(panel, resource, make_booking):
    booking = make_booking(starts_at=datetime(2030, 1, 8, 0, 0, tzinfo=timezone.utc))

    put(panel, resource, rule(2, "10:00", "12:00"))

    booking.refresh_from_db()
    assert booking.status == "pending"


def test_staff_can_edit_the_schedule(owner, resource):
    Membership.objects.filter(user=owner).update(role=Membership.Role.STAFF)
    client = APIClient()
    client.force_authenticate(owner)

    assert put(client, resource, rule(0, "18:00", "22:00")).status_code == 200


def test_the_schedule_requires_a_signed_in_user(resource):
    assert APIClient().get(url(resource)).status_code == 401
    assert APIClient().put(url(resource), {"rules": []}, format="json").status_code == 401


def test_the_schedule_appears_in_the_api_docs(panel):
    paths = panel.get("/api/schema/", {"format": "json"}).json()["paths"]

    assert {"get", "put"} <= set(paths["/api/v1/panel/resources/{id}/schedule/"])
