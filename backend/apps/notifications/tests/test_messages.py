from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from apps.bookings.models import BookingStatus
from apps.notifications import messages

# 19:00 in Lima (UTC-5) on Monday 7 January 2030.
MONDAY_EVENING = datetime(2030, 1, 8, 0, 0, tzinfo=timezone.utc)


@pytest.fixture
def booking(make_booking, business, customer):
    business.whatsapp = "+51987654321"
    business.phone = "+51054123456"
    business.address = "Av. Ejército 123"
    business.save()
    customer.name = "Ana Pérez"
    customer.email = "ana@example.com"
    customer.save()
    return make_booking(
        starts_at=MONDAY_EVENING,
        status=BookingStatus.PENDING,
        expires_at=MONDAY_EVENING - timedelta(hours=20),
        price_snapshot=Decimal("60.00"),
    )


def test_dates_are_written_in_the_business_timezone(booking):
    assert messages.when(booking.starts_at, booking.business) == "lunes 7 de enero a las 19:00"


class TestToTheCustomer:
    def test_received_explains_it_is_pending_and_when_it_frees_itself(self, booking):
        subject, body = messages.customer_received(booking, "tok123")

        assert subject == "Recibimos tu reserva en Cancha Los Andes"
        assert "Hola Ana Pérez," in body
        assert "pendiente de confirmación" in body
        assert "Alquiler 1 hora · Cancha 1" in body
        assert "lunes 7 de enero a las 19:00" in body
        assert "domingo 6 de enero a las 23:00" in body  # when the hold runs out
        assert "S/ 60" in body

    def test_received_carries_the_ticket_link(self, booking):
        _, body = messages.customer_received(booking, "tok123")

        assert "http://localhost:5173/cancha-los-andes/reserva/tok123" in body

    def test_later_emails_have_no_ticket_link(self, booking):
        for build in (
            messages.customer_confirmed,
            messages.customer_rejected,
            messages.customer_cancelled_by_business,
            messages.customer_expired,
        ):
            _, body = build(booking)
            assert "/reserva/" not in body

    def test_confirmed_at_creation_can_carry_the_link(self, booking):
        _, body = messages.customer_confirmed(booking, "tok123")

        assert "está confirmada" in body
        assert "/cancha-los-andes/reserva/tok123" in body

    def test_each_state_says_what_happened(self, booking):
        assert "no pudo aceptar" in messages.customer_rejected(booking)[0]
        assert "canceló tu reserva" in messages.customer_cancelled_by_business(booking)[0]
        assert "venció" in messages.customer_expired(booking)[0]

    def test_bad_news_points_to_booking_again(self, booking):
        for build in (messages.customer_rejected, messages.customer_cancelled_by_business, messages.customer_expired):
            assert "http://localhost:5173/cancha-los-andes" in build(booking)[1]

    def test_gives_the_business_contact(self, booking):
        _, body = messages.customer_confirmed(booking)

        assert "https://wa.me/51987654321" in body
        assert "Teléfono: +51054123456" in body
        assert "Dirección: Av. Ejército 123" in body

    def test_leaves_out_contact_the_business_has_not_given(self, booking):
        booking.business.whatsapp = booking.business.phone = booking.business.address = ""
        _, body = messages.customer_confirmed(booking)

        assert "¿Dudas?" not in body
        assert "wa.me" not in body

    def test_prices_show_cents_only_when_there_are_some(self, booking):
        booking.price_snapshot = Decimal("45.50")
        assert "S/ 45.50" in messages.customer_confirmed(booking)[1]

        booking.price_snapshot = None
        assert "Precio" not in messages.customer_confirmed(booking)[1]


class TestToTheBusiness:
    def test_a_pending_booking_asks_for_an_answer(self, booking):
        subject, body = messages.business_new_booking(booking)

        assert subject == "Nueva reserva de Ana Pérez: lunes 7 de enero a las 19:00"
        assert "Está pendiente" in body
        assert "domingo 6 de enero a las 23:00" in body
        assert "Ana Pérez · +51987654321 · ana@example.com" in body
        assert f"http://localhost:5173/panel/reservas/{booking.id}" in body

    def test_an_automatic_booking_says_it_is_already_confirmed(self, booking):
        booking.status = BookingStatus.CONFIRMED
        booking.expires_at = None
        _, body = messages.business_new_booking(booking)

        assert "confirmada automáticamente" in body
        assert "Está pendiente" not in body

    def test_a_cancellation_says_the_slot_is_free(self, booking):
        subject, body = messages.business_cancelled_by_customer(booking)

        assert subject.startswith("Ana Pérez canceló su reserva")
        assert "quedó libre" in body
        assert f"/panel/reservas/{booking.id}" in body

    def test_leaves_out_the_email_the_customer_did_not_give(self, booking):
        booking.customer.email = ""
        _, body = messages.business_new_booking(booking)

        assert "Ana Pérez · +51987654321\n" in body
