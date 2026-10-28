from datetime import datetime, timedelta, timezone

import pytest
from django.core import mail

from apps.accounts.models import Membership, User
from apps.bookings.models import BookingStatus
from apps.notifications import events

START = datetime(2030, 1, 8, 0, 0, tzinfo=timezone.utc)


@pytest.fixture
def team(business):
    owner = User.objects.create_user("dueno@example.com", "clave-larga-123")
    staff = User.objects.create_user("personal@example.com", "clave-larga-123")
    gone = User.objects.create_user("baja@example.com", "clave-larga-123", is_active=False)
    for user, role in ((owner, "owner"), (staff, "staff"), (gone, "owner")):
        Membership.objects.create(user=user, business=business, role=role)
    return owner, staff


@pytest.fixture
def pending(make_booking, customer):
    customer.email = "ana@example.com"
    customer.save()
    return make_booking(starts_at=START, expires_at=START - timedelta(hours=20))


def recipients():
    return sorted(address for message in mail.outbox for address in message.to)


def test_a_new_online_booking_tells_the_whole_active_team_and_the_customer(pending, team):
    events.booking_created_online(pending, "tok")

    assert recipients() == ["ana@example.com", "dueno@example.com", "personal@example.com"]
    subjects = {message.to[0]: message.subject for message in mail.outbox}
    assert subjects["dueno@example.com"].startswith("Nueva reserva de Ana")
    assert subjects["ana@example.com"].startswith("Recibimos tu reserva")


def test_an_inactive_user_is_not_written_to(pending, team):
    events.booking_created_online(pending, "tok")

    assert "baja@example.com" not in recipients()


def test_the_customer_gets_the_ticket_link_in_the_receipt(pending, team):
    events.booking_created_online(pending, "tok")

    receipt = next(message for message in mail.outbox if message.to == ["ana@example.com"])
    assert "/cancha-los-andes/reserva/tok" in receipt.body


def test_an_automatic_booking_tells_the_customer_it_is_confirmed(pending, team):
    pending.status = BookingStatus.CONFIRMED
    pending.expires_at = None
    events.booking_created_online(pending, "tok")

    receipt = next(message for message in mail.outbox if message.to == ["ana@example.com"])
    assert "está confirmada" in receipt.subject


def test_without_an_email_only_the_team_is_told(pending, team):
    pending.customer.email = ""
    events.booking_created_online(pending, "tok")

    assert recipients() == ["dueno@example.com", "personal@example.com"]


def test_a_business_with_nobody_in_the_panel_does_not_fail(pending):
    events.booking_created_online(pending, "tok")

    assert recipients() == ["ana@example.com"]


def test_a_booking_written_down_by_the_business_only_tells_the_customer(pending, team):
    events.booking_created_by_business(pending, "tok")

    assert recipients() == ["ana@example.com"]
    assert "/reserva/tok" in mail.outbox[0].body


@pytest.mark.parametrize(
    ("notify", "words"),
    [
        (events.booking_confirmed, "confirmada"),
        (events.booking_rejected, "no pudo aceptar"),
        (events.booking_cancelled_by_business, "canceló tu reserva"),
    ],
)
def test_the_customer_hears_what_the_business_decided(pending, team, notify, words):
    notify(pending)

    assert recipients() == ["ana@example.com"]
    assert words in mail.outbox[0].subject


def test_the_team_hears_when_the_customer_cancels(pending, team):
    events.booking_cancelled_by_customer(pending)

    assert recipients() == ["dueno@example.com", "personal@example.com"]
    assert "canceló su reserva" in mail.outbox[0].subject


def test_the_customer_hears_when_the_hold_runs_out(pending):
    events.booking_expired(pending.pk)

    assert recipients() == ["ana@example.com"]
    assert "venció" in mail.outbox[0].subject


def test_an_expired_booking_that_no_longer_exists_is_ignored(db):
    events.booking_expired(999999)

    assert mail.outbox == []
