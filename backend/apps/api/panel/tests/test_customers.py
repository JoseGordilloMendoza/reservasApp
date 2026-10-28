from datetime import datetime, timedelta, timezone

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.bookings.models import BookingStatus
from apps.customers.models import Customer

UTC = timezone.utc
START = datetime(2030, 1, 8, 0, 0, tzinfo=UTC)


def customers(panel, **params):
    return panel.get(reverse("panel-customers"), params)


def names(response):
    return [item["name"] for item in response.json()["results"]]


@pytest.fixture
def luis(business):
    return Customer.objects.create(business=business, name="Luis Ramos", phone="+51912345678")


@pytest.fixture
def foreign_customer(other_business):
    return Customer.objects.create(business=other_business, name="Intruso", phone="+51911111111")


def test_list_requires_a_signed_in_user(db):
    assert APIClient().get(reverse("panel-customers")).status_code == 401


def test_list_shows_the_customers_of_the_business_only(panel, customer, foreign_customer):
    assert names(customers(panel)) == ["Ana"]


def test_list_includes_the_booking_summary(panel, customer, make_booking):
    make_booking(starts_at=START)
    make_booking(starts_at=START + timedelta(days=1))

    item = customers(panel).json()["results"][0]

    assert item["bookings_count"] == 2
    assert item["last_booking_at"] == "2030-01-09T00:00:00Z"
    assert item["phone"] == "+51987654321"


def test_a_customer_without_bookings_has_no_last_booking(panel, customer):
    item = customers(panel).json()["results"][0]

    assert item["bookings_count"] == 0
    assert item["last_booking_at"] is None


def test_list_is_ordered_by_name(panel, customer, luis):
    assert names(customers(panel)) == ["Ana", "Luis Ramos"]


@pytest.mark.parametrize("text, expected", [("ram", ["Luis Ramos"]), ("912 345", ["Luis Ramos"]), ("Ana", ["Ana"]), ("zzz", [])])
def test_search_by_name_or_phone(panel, customer, luis, text, expected):
    assert names(customers(panel, q=text)) == expected


def test_filter_blocked_customers(panel, customer, luis):
    luis.is_blocked = True
    luis.save()

    assert names(customers(panel, blocked="true")) == ["Luis Ramos"]
    assert names(customers(panel, blocked="false")) == ["Ana"]


# --- detail ---------------------------------------------------------------------


def test_detail_includes_the_booking_history_newest_first(panel, customer, make_booking):
    older = make_booking(starts_at=START)
    newer = make_booking(starts_at=START + timedelta(days=1), status=BookingStatus.CANCELLED)

    data = panel.get(reverse("panel-customer", kwargs={"pk": customer.pk})).json()

    assert [b["id"] for b in data["bookings"]] == [newer.id, older.id]
    assert data["bookings"][0]["resource"]["name"] == "Cancha 1"
    assert data["bookings_count"] == 2


def test_detail_of_another_business_is_not_found(panel, foreign_customer):
    response = panel.get(reverse("panel-customer", kwargs={"pk": foreign_customer.pk}))

    assert response.status_code == 404


# --- blocking and editing ------------------------------------------------------


def patch(panel, customer, **data):
    return panel.patch(reverse("panel-customer", kwargs={"pk": customer.pk}), data, format="json")


def test_a_customer_can_be_blocked_and_unblocked(panel, customer):
    assert patch(panel, customer, is_blocked=True).json()["is_blocked"] is True
    customer.refresh_from_db()
    assert customer.is_blocked

    assert patch(panel, customer, is_blocked=False).json()["is_blocked"] is False


def test_a_blocked_customer_cannot_book_online(panel, business, service, customer):
    patch(panel, customer, is_blocked=True)

    # The block is checked before availability, so no opening hours are needed here.
    response = APIClient().post(
        reverse("public-create-booking", kwargs={"slug": business.slug}),
        {
            "service": service.pk,
            "starts_at": "2030-01-08T00:00:00Z",
            "customer": {"name": "Ana", "phone": "987654321"},
            "accepted_terms": True,
        },
        format="json",
    )

    assert response.status_code == 403
    assert response.json()["code"] == "booking_not_allowed"


def test_name_and_email_can_be_edited(panel, customer):
    response = patch(panel, customer, name="Ana María", email="ana@example.com")

    assert response.status_code == 200
    customer.refresh_from_db()
    assert (customer.name, customer.email) == ("Ana María", "ana@example.com")


def test_the_phone_cannot_be_changed(panel, customer):
    patch(panel, customer, phone="+51900000000", name="Ana")

    customer.refresh_from_db()
    assert customer.phone == "+51987654321"


def test_an_invalid_email_is_rejected(panel, customer):
    assert patch(panel, customer, email="no-es-un-correo").status_code == 400


def test_another_business_customer_cannot_be_edited(panel, foreign_customer):
    response = patch(panel, foreign_customer, is_blocked=True)

    assert response.status_code == 404
    foreign_customer.refresh_from_db()
    assert not foreign_customer.is_blocked


def test_editing_requires_a_signed_in_user(customer):
    response = APIClient().patch(
        reverse("panel-customer", kwargs={"pk": customer.pk}), {"is_blocked": True}, format="json"
    )

    assert response.status_code == 401


def test_customer_endpoints_appear_in_the_api_docs(panel):
    paths = panel.get("/api/schema/", {"format": "json"}).json()["paths"]

    assert "/api/v1/panel/customers/" in paths
    assert "patch" in paths["/api/v1/panel/customers/{id}/"]
