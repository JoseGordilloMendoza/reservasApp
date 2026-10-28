from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from apps.bookings.models import Booking, BookingStatus
from apps.bookings.tests.helpers import MON, NOW, at, configure, open_mondays
from apps.businesses.models import Business
from apps.catalog.models import Resource, Service
from apps.customers.models import Customer


@pytest.fixture
def api(db):
    return APIClient()


@pytest.fixture
def open_business(business, resource):
    open_mondays(business, resource)
    return business


def link(name, **kwargs):
    return reverse(name, kwargs=kwargs)


def booking_body(service, starts_at=None, /, **overrides):
    starts_at = starts_at or at(MON, 19)
    body = {
        "service": service.pk,
        "starts_at": starts_at if isinstance(starts_at, str) else starts_at.isoformat(),
        "customer": {"name": "Ana", "phone": "987654321"},
        "accepted_terms": True,
    }
    body.update(overrides)
    return body


@pytest.fixture
def book(api, open_business, service):
    def _book(starts_at=None, **overrides):
        return api.post(
            link("public-create-booking", slug=open_business.slug),
            booking_body(service, starts_at, **overrides),
            format="json",
        )

    return _book


# --- business page --------------------------------------------------------


def test_profile_lists_only_active_resources_and_services(api, business, resource, service):
    Resource.objects.create(business=business, name="Cancha cerrada", is_active=False)
    Service.objects.create(
        business=business, resource=resource, name="Retirado", duration_minutes=30, is_active=False
    )

    response = api.get(link("public-business", slug=business.slug))

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Cancha Los Andes"
    assert [r["name"] for r in data["resources"]] == ["Cancha 1"]
    assert [s["name"] for s in data["resources"][0]["services"]] == ["Alquiler 1 hora"]


def test_profile_includes_the_contact_details(api, business):
    business.description = "Canchas de grass sintético."
    business.address = "Av. Ejército 123, Arequipa"
    business.phone = "+51987654321"
    business.whatsapp = "+51912345678"
    business.save()

    data = api.get(link("public-business", slug=business.slug)).json()

    assert data["description"] == "Canchas de grass sintético."
    assert data["address"] == "Av. Ejército 123, Arequipa"
    assert data["phone"] == "+51987654321"
    assert data["whatsapp"] == "+51912345678"


def test_contact_details_are_empty_until_filled_in(api, business):
    data = api.get(link("public-business", slug=business.slug)).json()

    assert (data["description"], data["address"], data["phone"], data["whatsapp"]) == ("", "", "", "")


def test_profile_tells_which_accent_color_to_use(api, business):
    assert api.get(link("public-business", slug=business.slug)).json()["accent"] == "lime"

    business.accent = "cobalt"
    business.save()

    assert api.get(link("public-business", slug=business.slug)).json()["accent"] == "cobalt"


def test_profile_does_not_expose_internal_settings(api, business):
    data = api.get(link("public-business", slug=business.slug)).json()

    assert "settings" not in data
    assert "status" not in data


def test_unknown_business_is_not_found(api):
    assert api.get(link("public-business", slug="no-existe")).status_code == 404


def test_suspended_business_has_no_public_page(api, business):
    business.status = Business.Status.SUSPENDED
    business.save()

    assert api.get(link("public-business", slug=business.slug)).status_code == 404


# --- availability ---------------------------------------------------------


def availability(api, business, resource, service, **params):
    query = {"resource": resource.pk, "service": service.pk, "date": MON.isoformat(), **params}
    return api.get(link("public-availability", slug=business.slug), query)


def test_availability_lists_free_slots_in_utc(api, open_business, resource, service):
    response = availability(api, open_business, resource, service)

    assert response.status_code == 200
    data = response.json()
    assert data["timezone"] == "America/Lima"
    assert [slot["starts_at"] for slot in data["slots"]][:2] == [
        "2030-01-07T23:00:00Z",
        "2030-01-08T00:00:00Z",
    ]
    assert len(data["slots"]) == 4


def test_availability_needs_no_login(open_business, resource, service):
    assert availability(APIClient(), open_business, resource, service).status_code == 200


def test_booked_slot_disappears_from_availability(api, book, open_business, resource, service):
    book()

    slots = availability(api, open_business, resource, service).json()["slots"]

    assert "2030-01-08T00:00:00Z" not in [slot["starts_at"] for slot in slots]
    assert len(slots) == 3


@pytest.mark.parametrize("missing", ["resource", "service", "date"])
def test_availability_requires_its_parameters(api, open_business, resource, service, missing):
    query = {"resource": resource.pk, "service": service.pk, "date": MON.isoformat()}
    del query[missing]

    response = api.get(link("public-availability", slug=open_business.slug), query)

    assert response.status_code == 400


def test_availability_rejects_a_bad_date(api, open_business, resource, service):
    assert availability(api, open_business, resource, service, date="mañana").status_code == 400


def test_availability_rejects_an_overlong_range(api, open_business, resource, service):
    response = availability(api, open_business, resource, service, to_date="2030-06-01")

    assert response.status_code == 400


def test_availability_ignores_resources_of_other_businesses(api, business, resource, service):
    other = Business.objects.create(slug="otro", name="Otro")

    response = availability(api, other, resource, service)

    assert response.status_code == 404


def test_availability_rejects_a_service_from_another_resource(api, business, resource, other_resource):
    foreign = Service.objects.create(
        business=business, resource=other_resource, name="Otro", duration_minutes=60
    )

    assert availability(api, business, resource, foreign).status_code == 404


# --- creating a booking ---------------------------------------------------


def test_booking_is_created_without_an_account(book):
    response = book()

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "pending"
    assert data["starts_at"] == "2030-01-08T00:00:00Z"
    assert data["expires_at"] == "2030-01-01T14:00:00Z"
    assert data["manage_token"]
    assert data["business"] == {"name": "Cancha Los Andes", "slug": "cancha-los-andes"}
    assert "id" not in data


def test_automatic_confirmation_returns_a_confirmed_booking(book, open_business):
    configure(open_business, confirmation_mode="automatic")

    data = book().json()

    assert data["status"] == "confirmed"
    assert data["expires_at"] is None


def test_phone_is_stored_in_international_format(book):
    book(customer={"name": "Ana", "phone": "987 654 321"})

    assert Customer.objects.get().phone == "+51987654321"


@pytest.mark.parametrize(
    "overrides, field",
    [
        ({"customer": {"name": "Ana", "phone": "12345"}}, "customer"),
        ({"customer": {"name": "", "phone": "987654321"}}, "customer"),
        ({"customer": {"phone": "987654321"}}, "customer"),
        ({"accepted_terms": False}, "accepted_terms"),
        ({"starts_at": "ayer"}, "starts_at"),
        ({"service": "x"}, "service"),
    ],
)
def test_invalid_bookings_are_rejected(book, overrides, field):
    response = book(**overrides)

    assert response.status_code == 400
    assert field in response.json()
    assert Booking.objects.count() == 0


def test_invalid_phone_names_the_field(book):
    response = book(customer={"name": "Ana", "phone": "12345"})

    assert "phone" in response.json()["customer"]


def test_taken_slot_is_a_conflict(book):
    book()

    response = book(customer={"name": "Luis", "phone": "912345678"})

    assert response.status_code == 409
    assert response.json()["code"] == "slot_unavailable"


def test_slot_outside_opening_hours_is_a_conflict(book):
    response = book(starts_at=at(MON, 12))

    assert response.status_code == 409
    assert response.json()["code"] == "slot_unavailable"


def test_blocked_customer_gets_a_generic_refusal(book, open_business):
    Customer.objects.create(
        business=open_business, name="Ana", phone="+51987654321", is_blocked=True
    )

    response = book()

    assert response.status_code == 403
    assert response.json()["code"] == "booking_not_allowed"
    assert "bloque" not in response.json()["detail"].lower()


def test_customer_over_the_cap_is_refused(book, open_business):
    configure(open_business, max_active_bookings_per_customer=1)
    book()

    response = book(starts_at=at(MON, 20))

    assert response.status_code == 409
    assert response.json()["code"] == "too_many_active_bookings"


def test_service_of_another_business_is_not_found(api, open_business):
    other = Business.objects.create(slug="otro", name="Otro")
    other_resource = Resource.objects.create(business=other, name="Cancha X")
    foreign = Service.objects.create(
        business=other, resource=other_resource, name="Ajeno", duration_minutes=60
    )

    response = api.post(
        link("public-create-booking", slug=open_business.slug),
        booking_body(foreign),
        format="json",
    )

    assert response.status_code == 404
    assert Booking.objects.count() == 0


def test_booking_a_suspended_business_is_not_found(book, open_business):
    open_business.status = Business.Status.SUSPENDED
    open_business.save()

    assert book().status_code == 404


def test_booking_requests_are_rate_limited(book, monkeypatch):
    rates = {"public_read": "100/min", "public_booking": "2/min", "public_manage": "100/min"}
    monkeypatch.setattr(ScopedRateThrottle, "THROTTLE_RATES", rates)

    statuses = [
        book(starts_at=at(MON, hour), customer={"name": "A", "phone": f"98765432{hour % 10}"}).status_code
        for hour in (18, 19, 20)
    ]

    assert statuses == [201, 201, 429]


# --- managing a booking ---------------------------------------------------


def test_booking_can_be_viewed_with_its_token(api, book):
    token = book().json()["manage_token"]

    response = api.get(link("public-booking", token=token))

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "pending"
    assert data["customer_name"] == "Ana"
    assert data["can_cancel"] is True
    assert data["cancel_deadline"] == "2030-01-07T00:00:00Z"  # 24 h before the start
    assert "manage_token" not in data


def test_viewing_a_booking_does_not_reveal_contact_details(api, book):
    token = book().json()["manage_token"]

    body = api.get(link("public-booking", token=token)).content.decode()

    assert "987654321" not in body


def test_unknown_token_is_not_found(api):
    assert api.get(link("public-booking", token="nope")).status_code == 404
    assert api.post(link("public-cancel-booking", token="nope")).status_code == 404


def test_customer_can_cancel_with_the_token(api, book):
    token = book().json()["manage_token"]

    response = api.post(link("public-cancel-booking", token=token))

    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"
    assert response.json()["can_cancel"] is False


def test_cancelling_frees_the_slot_for_someone_else(api, book):
    token = book().json()["manage_token"]
    api.post(link("public-cancel-booking", token=token))

    response = book(customer={"name": "Luis", "phone": "912345678"})

    assert response.status_code == 201


def test_cancelling_twice_is_a_conflict(api, book):
    token = book().json()["manage_token"]
    api.post(link("public-cancel-booking", token=token))

    response = api.post(link("public-cancel-booking", token=token))

    assert response.status_code == 409
    assert response.json()["code"] == "not_cancellable"


def test_confirmed_booking_cannot_be_cancelled_after_the_deadline(
    api, book, open_business, monkeypatch
):
    configure(open_business, confirmation_mode="automatic")
    token = book().json()["manage_token"]
    monkeypatch.setattr(timezone, "now", lambda: at(MON, 18))  # inside the 24 h notice

    response = api.post(link("public-cancel-booking", token=token))

    assert response.status_code == 403
    assert response.json()["code"] == "cancellation_window_closed"
    assert api.get(link("public-booking", token=token)).json()["can_cancel"] is False


def test_pending_booking_can_be_cancelled_even_close_to_the_start(api, book, monkeypatch):
    token = book().json()["manage_token"]
    monkeypatch.setattr(timezone, "now", lambda: NOW + timedelta(hours=1))
    Booking.objects.update(expires_at=at(MON, 18, 30))  # still held, but inside the notice

    response = api.post(link("public-cancel-booking", token=token))

    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"


def test_overdue_pending_booking_is_shown_as_expired(api, book, monkeypatch):
    token = book().json()["manage_token"]
    monkeypatch.setattr(timezone, "now", lambda: NOW + timedelta(hours=3))

    data = api.get(link("public-booking", token=token)).json()

    assert data["status"] == "expired"
    assert data["can_cancel"] is False
    assert Booking.objects.get().status == BookingStatus.EXPIRED


# --- documentation --------------------------------------------------------


def test_public_endpoints_appear_in_the_api_docs(api):
    paths = api.get("/api/schema/", {"format": "json"}).json()["paths"]

    for path in (
        "/api/v1/public/businesses/{slug}/",
        "/api/v1/public/businesses/{slug}/availability/",
        "/api/v1/public/businesses/{slug}/bookings/",
        "/api/v1/public/bookings/{token}/",
        "/api/v1/public/bookings/{token}/cancel/",
    ):
        assert path in paths
