"""Emails sent by the booking services: when, to whom, and that a failure never touches a booking."""

from datetime import timedelta
from unittest import mock

import pytest
from django.core import mail
from django.db import transaction

from apps.accounts.models import Membership, User
from apps.bookings import services
from apps.bookings.models import Booking, BookingStatus

from .helpers import MON, NOW, at, configure, open_mondays

START = at(MON, 19)


@pytest.fixture(autouse=True)
def open_and_team(business, resource):
    open_mondays(business, resource)
    owner = User.objects.create_user("dueno@example.com", "clave-larga-123")
    Membership.objects.create(user=owner, business=business, role="owner")


@pytest.fixture
def commit(django_capture_on_commit_callbacks):
    """Run what the services scheduled for after the commit, as production does."""

    def run(action):
        with django_capture_on_commit_callbacks(execute=True):
            return action()

    return run


def book(business, service, email="ana@example.com", **extra):
    return services.create_booking(
        business=business,
        service=service,
        starts_at=START,
        customer_name="Ana",
        customer_phone="987654321",
        customer_email=email,
        now=NOW,
        **extra,
    )


def to():
    return sorted(address for message in mail.outbox for address in message.to)


class TestWhenTheCustomerBooks:
    def test_the_team_and_the_customer_are_told(self, commit, business, service):
        booking, token = commit(lambda: book(business, service))

        assert to() == ["ana@example.com", "dueno@example.com"]
        receipt = next(message for message in mail.outbox if message.to == ["ana@example.com"])
        assert f"/cancha-los-andes/reserva/{token}" in receipt.body
        assert booking.status == BookingStatus.PENDING

    def test_automatic_confirmation_tells_the_customer_it_is_confirmed(self, commit, business, service):
        configure(business, confirmation_mode="automatic")

        commit(lambda: book(business, service))

        receipt = next(message for message in mail.outbox if message.to == ["ana@example.com"])
        assert "está confirmada" in receipt.subject

    def test_without_an_email_only_the_team_is_told(self, commit, business, service):
        commit(lambda: book(business, service, email=""))

        assert to() == ["dueno@example.com"]

    def test_a_refused_booking_sends_nothing(self, commit, business, service):
        commit(lambda: book(business, service))
        mail.outbox.clear()

        with pytest.raises(services.SlotUnavailable):
            commit(lambda: book(business, service))

        assert mail.outbox == []

    def test_a_rolled_back_booking_sends_nothing(self, django_capture_on_commit_callbacks, business, service):
        with django_capture_on_commit_callbacks(execute=True):
            with pytest.raises(RuntimeError):
                with transaction.atomic():
                    book(business, service)
                    raise RuntimeError("something later failed")

        assert mail.outbox == []


class TestWhenTheBusinessWritesItDown:
    def test_only_the_customer_is_told(self, commit, business, service):
        commit(
            lambda: services.create_booking_by_business(
                business=business,
                service=service,
                starts_at=START,
                customer_name="Luis",
                customer_phone="912345678",
                customer_email="luis@example.com",
                now=NOW,
            )
        )

        assert to() == ["luis@example.com"]
        assert "/reserva/" in mail.outbox[0].body


class TestWhenTheBusinessDecides:
    @pytest.fixture
    def pending(self, commit, business, service):
        booking, _ = commit(lambda: book(business, service))
        mail.outbox.clear()
        return booking

    def test_confirming_tells_the_customer(self, commit, pending):
        commit(lambda: services.confirm_booking(pending, now=NOW))

        assert to() == ["ana@example.com"]
        assert "está confirmada" in mail.outbox[0].subject

    def test_rejecting_tells_the_customer(self, commit, pending):
        commit(lambda: services.reject_booking(pending, now=NOW))

        assert to() == ["ana@example.com"]
        assert "no pudo aceptar" in mail.outbox[0].subject

    def test_cancelling_tells_the_customer(self, commit, pending):
        confirmed = services.confirm_booking(pending, now=NOW)
        mail.outbox.clear()

        commit(lambda: services.cancel_booking_by_business(confirmed, now=NOW))

        assert to() == ["ana@example.com"]
        assert "canceló tu reserva" in mail.outbox[0].subject

    def test_a_refused_change_sends_nothing(self, commit, pending):
        services.reject_booking(pending, now=NOW)
        mail.outbox.clear()

        with pytest.raises(services.InvalidTransition):
            commit(lambda: services.confirm_booking(pending, now=NOW))

        assert mail.outbox == []

    def test_finishing_a_booking_sends_nothing(self, commit, pending):
        confirmed = services.confirm_booking(pending, now=NOW)
        mail.outbox.clear()

        commit(lambda: services.complete_booking(confirmed, now=START + timedelta(hours=2)))

        assert mail.outbox == []


class TestWhenTheCustomerCancels:
    def test_the_team_is_told(self, commit, business, service):
        booking, _ = commit(lambda: book(business, service))
        mail.outbox.clear()

        commit(lambda: services.cancel_booking_by_customer(booking, now=NOW))

        assert to() == ["dueno@example.com"]
        assert "canceló su reserva" in mail.outbox[0].subject

    def test_a_refused_cancellation_sends_nothing(self, commit, business, service):
        booking, _ = commit(lambda: book(business, service))
        services.cancel_booking_by_customer(booking, now=NOW)
        mail.outbox.clear()

        with pytest.raises(services.NotCancellable):
            commit(lambda: services.cancel_booking_by_customer(booking, now=NOW))

        assert mail.outbox == []


class TestWhenTheHoldRunsOut:
    @pytest.fixture
    def stale(self, commit, business, service):
        booking, _ = commit(lambda: book(business, service))
        mail.outbox.clear()
        return booking

    def test_the_customer_is_told_once(self, commit, stale):
        later = stale.expires_at + timedelta(minutes=1)

        commit(lambda: services.expire_stale_bookings(now=later))
        commit(lambda: services.expire_stale_bookings(now=later))

        assert to() == ["ana@example.com"]
        assert "venció" in mail.outbox[0].subject

    def test_expiring_when_someone_looks_at_it_also_tells_the_customer(self, commit, stale):
        later = stale.expires_at + timedelta(minutes=1)

        commit(lambda: services.refresh_if_stale(stale, now=later))

        assert to() == ["ana@example.com"]

    def test_a_booking_still_in_time_is_not_announced(self, commit, stale):
        commit(lambda: services.expire_stale_bookings(now=NOW))

        assert mail.outbox == []


class TestWhenEmailFails:
    def test_the_booking_is_still_made(self, commit, business, service):
        with mock.patch("apps.notifications.mail.send_mail", side_effect=OSError("smtp down")):
            booking, _ = commit(lambda: book(business, service))

        booking.refresh_from_db()
        assert booking.status == BookingStatus.PENDING
        assert Booking.objects.count() == 1

    def test_a_decision_is_still_kept(self, commit, business, service):
        booking, _ = commit(lambda: book(business, service))

        with mock.patch("apps.notifications.mail.send_mail", side_effect=OSError("smtp down")):
            commit(lambda: services.confirm_booking(booking, now=NOW))

        booking.refresh_from_db()
        assert booking.status == BookingStatus.CONFIRMED

    def test_even_an_unexpected_error_in_the_notice_does_not_break_the_change(self, commit, business, service):
        booking, _ = commit(lambda: book(business, service))

        with mock.patch("apps.notifications.events.booking_confirmed", side_effect=RuntimeError("bug")):
            commit(lambda: services.confirm_booking(booking, now=NOW))

        booking.refresh_from_db()
        assert booking.status == BookingStatus.CONFIRMED
