"""Saying "I am coming" through the public API, with the link of the ticket."""

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.bookings import services
from apps.bookings.models import Booking, BookingStatus


@pytest.fixture
def api(db):
    return APIClient()


@pytest.fixture
def ticket(make_booking):
    """(booking, token) for a booking confirmed, starting in `hours` from now."""

    def _ticket(hours, status=BookingStatus.CONFIRMED):
        booking = make_booking(starts_at=timezone.now() + timedelta(hours=hours), status=status)
        token = "tok-" + str(booking.pk)
        Booking.objects.filter(pk=booking.pk).update(manage_token_hash=services.hash_token(token))
        return booking, token

    return _ticket


def say(api, token):
    return api.post(reverse("public-confirm-attendance", kwargs={"token": token}))


def view(api, token):
    return api.get(reverse("public-booking", kwargs={"token": token})).json()


def test_the_ticket_says_when_the_customer_can_confirm(api, ticket):
    _, soon = ticket(10)
    _, later = ticket(72)

    assert view(api, soon)["can_confirm_attendance"] is True
    assert view(api, soon)["attendance_confirmed"] is False
    assert view(api, later)["can_confirm_attendance"] is False


def test_confirming_marks_it_on_the_ticket_and_closes_the_button(api, ticket):
    _, token = ticket(10)

    response = say(api, token)

    assert response.status_code == 200
    assert response.json()["attendance_confirmed"] is True
    assert response.json()["can_confirm_attendance"] is True  # still open: saying it again is harmless


def test_saying_it_twice_is_fine(api, ticket):
    _, token = ticket(10)

    say(api, token)

    assert say(api, token).status_code == 200


def test_before_the_day_it_says_when_it_opens(api, ticket):
    _, token = ticket(72)

    response = say(api, token)

    assert response.status_code == 409
    assert response.json()["code"] == "attendance_not_yet_open"


def test_a_pending_booking_cannot_do_it(api, ticket):
    _, token = ticket(10, BookingStatus.PENDING)

    response = say(api, token)

    assert response.status_code == 409
    assert response.json()["code"] == "invalid_transition"


def test_an_unknown_ticket_is_not_found(api, db):
    assert say(api, "no-such-token").status_code == 404


def test_it_needs_no_account(api, ticket):
    _, token = ticket(10)

    assert say(APIClient(), token).status_code == 200


def test_it_does_not_reveal_anything_private(api, ticket):
    _, token = ticket(10)

    body = say(api, token).content.decode()

    assert "internal_note" not in body
    assert "customer_trust" not in body
