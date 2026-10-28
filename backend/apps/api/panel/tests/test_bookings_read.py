from datetime import datetime, timedelta, timezone

import pytest
from django.urls import reverse
from django.utils import timezone as dj_timezone

from apps.bookings.models import Booking, BookingEvent, BookingStatus
from apps.catalog.models import Resource, Service
from apps.customers.models import Customer

UTC = timezone.utc
# 2030-01-08 00:00Z is 2030-01-07 19:00 in Lima.
START = datetime(2030, 1, 8, 0, 0, tzinfo=UTC)


@pytest.fixture
def foreign_booking(other_business):
    resource = Resource.objects.create(business=other_business, name="Cancha X")
    service = Service.objects.create(
        business=other_business, resource=resource, name="Ajeno", duration_minutes=60
    )
    customer = Customer.objects.create(business=other_business, name="Intruso", phone="+51911111111")
    return Booking.objects.create(
        business=other_business,
        resource=resource,
        service=service,
        customer=customer,
        starts_at=START,
        ends_at=START + timedelta(hours=1),
        duration_snapshot=60,
    )


def list_bookings(panel, **params):
    return panel.get(reverse("panel-bookings"), params)


def ids(response):
    return [item["id"] for item in response.json()["results"]]


def test_list_requires_a_signed_in_user(db):
    from rest_framework.test import APIClient

    assert APIClient().get(reverse("panel-bookings")).status_code == 401


def test_list_shows_the_bookings_of_the_business(panel, make_booking):
    booking = make_booking(starts_at=START)

    response = list_bookings(panel)

    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 1
    item = data["results"][0]
    assert item["id"] == booking.id
    assert item["status"] == "pending"
    assert item["customer"]["phone"] == "+51987654321"
    assert item["resource"]["name"] == "Cancha 1"
    assert item["service"]["name"] == "Alquiler 1 hora"
    assert item["duration_minutes"] == 60
    assert "manage_token_hash" not in item


def test_list_never_includes_another_business(panel, make_booking, foreign_booking):
    mine = make_booking(starts_at=START)

    assert ids(list_bookings(panel)) == [mine.id]
    assert foreign_booking.id not in ids(list_bookings(panel))


def test_list_is_ordered_by_start_and_can_be_reversed(panel, make_booking):
    later = make_booking(starts_at=START + timedelta(hours=3))
    earlier = make_booking(starts_at=START)

    assert ids(list_bookings(panel)) == [earlier.id, later.id]
    assert ids(list_bookings(panel, ordering="-starts_at")) == [later.id, earlier.id]


def test_list_is_paginated(panel, make_booking):
    for hour in range(5):
        make_booking(starts_at=START + timedelta(hours=hour))

    page = list_bookings(panel, page_size=2).json()

    assert page["count"] == 5
    assert len(page["results"]) == 2
    assert page["next"] is not None


def test_filter_by_status(panel, make_booking):
    pending = make_booking(starts_at=START)
    confirmed = make_booking(starts_at=START + timedelta(hours=1), status=BookingStatus.CONFIRMED)
    make_booking(starts_at=START + timedelta(hours=2), status=BookingStatus.CANCELLED)

    assert ids(list_bookings(panel, status="confirmed")) == [confirmed.id]
    assert ids(list_bookings(panel, status="pending,confirmed")) == [pending.id, confirmed.id]


def test_filter_by_unknown_status_is_rejected(panel):
    assert list_bookings(panel, status="done").status_code == 400


def test_filter_by_resource(panel, make_booking, other_resource):
    make_booking(starts_at=START)
    on_other = make_booking(starts_at=START, resource=other_resource)

    assert ids(list_bookings(panel, resource=other_resource.id)) == [on_other.id]


def test_filter_by_local_dates_uses_the_business_timezone(panel, make_booking):
    booking = make_booking(starts_at=START)  # Jan 7, 19:00 in Lima, though already Jan 8 in UTC

    assert ids(list_bookings(panel, date_from="2030-01-07", date_to="2030-01-07")) == [booking.id]
    assert ids(list_bookings(panel, date_from="2030-01-08")) == []
    assert ids(list_bookings(panel, date_to="2030-01-06")) == []


def test_date_range_must_be_in_order(panel):
    response = list_bookings(panel, date_from="2030-01-10", date_to="2030-01-01")

    assert response.status_code == 400


@pytest.mark.parametrize("text", ["Ana", "ana", "987654321", "987 654", "+51987"])
def test_search_by_customer_name_or_phone(panel, make_booking, text):
    booking = make_booking(starts_at=START)

    assert ids(list_bookings(panel, q=text)) == [booking.id]


def test_search_without_a_match_is_empty(panel, make_booking):
    make_booking(starts_at=START)

    assert ids(list_bookings(panel, q="Pedro")) == []


def test_overdue_pending_booking_is_listed_as_expired(panel, make_booking):
    make_booking(starts_at=START, expires_at=dj_timezone.now() - timedelta(hours=1))

    item = list_bookings(panel).json()["results"][0]

    assert item["status"] == "expired"


# --- detail -------------------------------------------------------------------


def test_detail_includes_the_history(panel, make_booking):
    booking = make_booking(starts_at=START)
    BookingEvent.objects.create(booking=booking, to_status="pending", actor="customer")
    BookingEvent.objects.create(
        booking=booking, from_status="pending", to_status="confirmed", actor="business"
    )

    data = panel.get(reverse("panel-booking", kwargs={"pk": booking.id})).json()

    assert data["id"] == booking.id
    assert [(e["from_status"], e["to_status"], e["actor"]) for e in data["events"]] == [
        ("", "pending", "customer"),
        ("pending", "confirmed", "business"),
    ]


def test_detail_of_another_business_is_not_found(panel, foreign_booking):
    response = panel.get(reverse("panel-booking", kwargs={"pk": foreign_booking.id}))

    assert response.status_code == 404


def test_detail_of_an_unknown_booking_is_not_found(panel, db):
    assert panel.get(reverse("panel-booking", kwargs={"pk": 999999})).status_code == 404


def test_detail_shows_an_overdue_booking_as_expired(panel, make_booking):
    booking = make_booking(starts_at=START, expires_at=dj_timezone.now() - timedelta(hours=1))

    data = panel.get(reverse("panel-booking", kwargs={"pk": booking.id})).json()

    assert data["status"] == "expired"


def test_each_owner_sees_only_their_own_bookings(panel, other_panel, make_booking, foreign_booking):
    mine = make_booking(starts_at=START)

    assert ids(list_bookings(panel)) == [mine.id]
    assert ids(list_bookings(other_panel)) == [foreign_booking.id]


def test_booking_endpoints_appear_in_the_api_docs(panel):
    paths = panel.get("/api/schema/", {"format": "json"}).json()["paths"]

    assert "/api/v1/panel/bookings/" in paths
    assert "/api/v1/panel/bookings/{id}/" in paths
