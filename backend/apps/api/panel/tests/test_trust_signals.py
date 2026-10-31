"""What the owner sees about who booked, and turning down a joke."""

from datetime import datetime, timedelta, timezone

from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse

from apps.bookings.models import Booking, BookingStatus
from apps.customers.models import Customer

FUTURE = datetime(2030, 1, 8, 0, 0, tzinfo=timezone.utc)


def trust_of(panel, booking):
    return panel.get(reverse("panel-booking", kwargs={"pk": booking.pk})).json()["customer_trust"]


class TestTheSignal:
    def test_someone_who_never_booked_before_is_new(self, panel, make_booking):
        booking = make_booking(starts_at=FUTURE)

        assert trust_of(panel, booking) == {"level": "new", "completed": 0, "no_shows": 0}

    def test_one_who_was_attended_before_is_known_and_the_owner_sees_how_often(self, panel, make_booking):
        for days in (1, 2):
            make_booking(starts_at=FUTURE - timedelta(days=days), status=BookingStatus.COMPLETED)
        booking = make_booking(starts_at=FUTURE)

        assert trust_of(panel, booking) == {"level": "known", "completed": 2, "no_shows": 0}

    def test_one_who_proved_who_they_are_with_google_is_verified(self, panel, make_booking):
        booking = make_booking(starts_at=FUTURE, verified=True)

        assert trust_of(panel, booking)["level"] == "verified"

    def test_a_missed_booking_flags_them_however_good_the_rest(self, panel, make_booking):
        make_booking(starts_at=FUTURE - timedelta(days=1), status=BookingStatus.NO_SHOW)
        booking = make_booking(starts_at=FUTURE, verified=True)

        assert trust_of(panel, booking) == {"level": "flagged", "completed": 0, "no_shows": 1}

    def test_so_does_a_block(self, panel, make_booking, customer):
        Customer.objects.filter(pk=customer.pk).update(is_blocked=True)

        assert trust_of(panel, make_booking(starts_at=FUTURE))["level"] == "flagged"

    def test_it_is_in_the_list_too(self, panel, make_booking):
        make_booking(starts_at=FUTURE, verified=True)

        results = panel.get(reverse("panel-bookings")).json()["results"]

        assert results[0]["customer_trust"]["level"] == "verified"

    def test_a_longer_list_costs_no_more_queries_per_booking(self, panel, make_booking, resource, service, business):
        make_booking(starts_at=FUTURE)
        with CaptureQueriesContext(connection) as one:
            panel.get(reverse("panel-bookings"))

        for number in range(6):
            person = Customer.objects.create(business=business, name=f"Cliente {number}", phone=f"+5198000000{number}")
            make_booking(starts_at=FUTURE + timedelta(hours=2 + number), customer=person)
        with CaptureQueriesContext(connection) as many:
            panel.get(reverse("panel-bookings"))

        assert len(many) == len(one)


class TestTurningDownAJoke:
    def dismiss(self, panel, booking):
        return panel.post(reverse("panel-booking-dismiss", kwargs={"pk": booking.pk}))

    def test_it_frees_the_slot_and_blocks_the_customer(self, panel, make_booking, customer):
        booking = make_booking(starts_at=FUTURE, expires_at=FUTURE)

        response = self.dismiss(panel, booking)

        assert response.status_code == 200
        assert response.json()["status"] == "cancelled"
        assert response.json()["customer_trust"]["level"] == "flagged"
        customer.refresh_from_db()
        assert customer.is_blocked is True

    def test_only_a_pending_booking_can_be_turned_down(self, panel, make_booking, customer):
        booking = make_booking(starts_at=FUTURE, status=BookingStatus.CONFIRMED)

        response = self.dismiss(panel, booking)

        assert response.status_code == 409
        assert response.json()["code"] == "invalid_transition"
        customer.refresh_from_db()
        assert customer.is_blocked is False

    def test_it_can_be_undone_from_the_customer(self, panel, make_booking, customer):
        self.dismiss(panel, make_booking(starts_at=FUTURE, expires_at=FUTURE))

        response = panel.patch(reverse("panel-customer", kwargs={"pk": customer.pk}), {"is_blocked": False}, format="json")

        assert response.status_code == 200
        customer.refresh_from_db()
        assert customer.is_blocked is False

    def test_another_business_cannot_do_it(self, other_panel, make_booking, customer):
        booking = make_booking(starts_at=FUTURE, expires_at=FUTURE)

        assert self.dismiss(other_panel, booking).status_code == 404
        customer.refresh_from_db()
        assert customer.is_blocked is False

    def test_a_visitor_cannot_do_it(self, api_client, make_booking):
        booking = make_booking(starts_at=FUTURE, expires_at=FUTURE)

        assert self.dismiss(api_client, booking).status_code in (401, 403)
