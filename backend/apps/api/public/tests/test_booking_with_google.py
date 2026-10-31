"""Booking while signed in with Google: the customer becomes verified, and the server checks the token itself."""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.google import GoogleNotConfigured, InvalidGoogleToken
from apps.bookings.models import Booking, BookingStatus
from apps.bookings.tests.helpers import MON, at, configure, open_mondays
from apps.customers.models import Customer

CLAIMS = {"sub": "google-rosa", "email": "rosa@gmail.com", "email_verified": True}


@pytest.fixture
def api(db):
    return APIClient()


@pytest.fixture
def shop(business, resource):
    open_mondays(business, resource)
    return business


@pytest.fixture
def google_says(monkeypatch):
    def _set(result):
        def fake(credential):
            if isinstance(result, Exception):
                raise result
            return result

        monkeypatch.setattr("apps.api.public.views.verify_google_credential", fake)

    return _set


def book(api, shop, service, **extra):
    body = {
        "service": service.pk,
        "starts_at": at(MON, 19).isoformat(),
        "customer": {"name": "Rosa", "phone": "987654321"},
        "accepted_terms": True,
        **extra,
    }
    return api.post(reverse("public-create-booking", kwargs={"slug": shop.slug}), body, format="json")


def test_a_valid_google_token_makes_the_booking_a_verified_one(api, shop, service, google_says):
    google_says(CLAIMS)

    response = book(api, shop, service, google_credential="token-from-google")

    assert response.status_code == 201
    stored = Booking.objects.get()
    assert stored.verified is True
    assert Customer.objects.get().email == "rosa@gmail.com"


def test_such_a_customer_is_confirmed_at_once_when_the_business_trusts_verified_ones(api, shop, service, google_says):
    configure(shop, confirmation_mode="trusted")
    google_says(CLAIMS)

    response = book(api, shop, service, google_credential="token-from-google")

    assert response.json()["status"] == "confirmed"


def test_without_google_the_same_business_keeps_the_booking_pending(api, shop, service):
    configure(shop, confirmation_mode="trusted")

    response = book(api, shop, service)

    assert response.json()["status"] == "pending"
    assert Booking.objects.get().verified is False


def test_a_token_that_is_not_real_is_refused_and_nothing_is_booked(api, shop, service, google_says):
    google_says(InvalidGoogleToken())

    response = book(api, shop, service, google_credential="forged")

    assert response.status_code == 400
    assert response.json()["code"] == "invalid_google_token"
    assert Booking.objects.count() == 0


def test_an_email_google_did_not_verify_does_not_count(api, shop, service, google_says):
    google_says({**CLAIMS, "email_verified": False})

    response = book(api, shop, service, google_credential="token")

    assert response.status_code == 400
    assert response.json()["code"] == "google_email_not_verified"
    assert Booking.objects.count() == 0


def test_when_google_is_not_set_up_the_server_says_so(api, shop, service, google_says):
    google_says(GoogleNotConfigured())

    response = book(api, shop, service, google_credential="token")

    assert response.status_code == 400
    assert response.json()["code"] == "google_not_configured"


def test_an_empty_token_is_the_same_as_none(api, shop, service):
    response = book(api, shop, service, google_credential="")

    assert response.status_code == 201
    assert Booking.objects.get().verified is False


def test_the_token_is_never_sent_back(api, shop, service, google_says):
    google_says(CLAIMS)

    response = book(api, shop, service, google_credential="secret-token")

    assert "secret-token" not in response.content.decode()
    assert response.json()["status"] in {BookingStatus.PENDING, BookingStatus.CONFIRMED}
