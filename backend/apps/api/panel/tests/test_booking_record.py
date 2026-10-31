"""What the owner writes down about a booking: payment, arrival and a private note. Nothing is charged."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from django.urls import reverse

from apps.bookings import codes
from apps.bookings.models import Booking, BookingStatus

FUTURE = datetime(2030, 1, 8, 0, 0, tzinfo=timezone.utc)


def record(client, booking, **data):
    return client.patch(reverse("panel-booking", kwargs={"pk": booking.pk}), data, format="json")


def priced(make_booking, price="60.00", **fields):
    return make_booking(starts_at=FUTURE, status=BookingStatus.CONFIRMED, price_snapshot=Decimal(price), **fields)


class TestTheCode:
    def test_every_booking_gets_one_that_is_easy_to_read(self, make_booking):
        booking = make_booking(starts_at=FUTURE)

        assert len(booking.code) == 6
        assert set(booking.code) <= set(codes.ALPHABET)
        assert not set(booking.code) & set("0O1IL")

    def test_two_bookings_of_a_business_do_not_share_it(self, make_booking):
        first = make_booking(starts_at=FUTURE)
        second = make_booking(starts_at=FUTURE + timedelta(hours=2))

        assert first.code != second.code

    def test_it_is_shown_in_the_panel(self, panel, make_booking):
        booking = make_booking(starts_at=FUTURE)

        data = panel.get(reverse("panel-booking", kwargs={"pk": booking.pk})).json()

        assert data["code"] == booking.code

    def test_the_owner_finds_a_booking_by_typing_it_however_it_is_written(self, panel, make_booking):
        booking = make_booking(starts_at=FUTURE)
        make_booking(starts_at=FUTURE + timedelta(hours=2))
        pretty = f"{booking.code[:3]}-{booking.code[3:]}".lower()

        results = panel.get(reverse("panel-bookings"), {"q": pretty}).json()["results"]

        assert [item["id"] for item in results] == [booking.id]

    def test_and_by_the_name_of_the_customer(self, panel, make_booking):
        booking = make_booking(starts_at=FUTURE)

        results = panel.get(reverse("panel-bookings"), {"q": booking.customer.name[:3]}).json()["results"]

        assert booking.id in [item["id"] for item in results]

    def test_it_never_finds_another_business_booking(self, other_panel, make_booking):
        booking = make_booking(starts_at=FUTURE)

        assert other_panel.get(reverse("panel-bookings"), {"q": booking.code}).json()["results"] == []

    def test_the_helpers_agree_on_what_a_code_looks_like(self):
        assert codes.compact(" ab c-d2e f ") == "ABCD2EF"
        assert codes.pretty("ABC234") == "ABC-234"
        assert codes.looks_like_code("abc-234")
        assert not codes.looks_like_code("abc-0O1")
        assert not codes.looks_like_code("Ana")


class TestPayment:
    def test_a_booking_starts_unpaid(self, panel, make_booking):
        data = panel.get(reverse("panel-booking", kwargs={"pk": make_booking(starts_at=FUTURE).pk})).json()

        assert data["payment_status"] == "unpaid"
        assert data["amount_paid"] == "0.00"

    def test_a_deposit_leaves_the_rest_as_the_balance(self, panel, make_booking):
        booking = priced(make_booking)

        response = record(panel, booking, payment_status="deposit", amount_paid="20", payment_method="yape")

        assert response.status_code == 200
        data = response.json()
        assert (data["payment_status"], data["amount_paid"], data["payment_method"]) == ("deposit", "20.00", "yape")
        assert data["balance"] == "40.00"

    def test_paying_in_full_defaults_to_the_price(self, panel, make_booking):
        booking = priced(make_booking)

        data = record(panel, booking, payment_status="paid", payment_method="cash").json()

        assert data["amount_paid"] == "60.00"
        assert data["balance"] == "0.00"

    def test_the_owner_may_say_another_amount_when_paid_in_full(self, panel, make_booking):
        booking = priced(make_booking)

        data = record(panel, booking, payment_status="paid", amount_paid="50").json()

        assert data["amount_paid"] == "50.00"
        assert data["balance"] == "10.00"

    def test_going_back_to_unpaid_clears_the_amount_and_the_method(self, panel, make_booking):
        booking = priced(make_booking)
        record(panel, booking, payment_status="paid", payment_method="yape")

        data = record(panel, booking, payment_status="unpaid").json()

        assert (data["amount_paid"], data["payment_method"], data["balance"]) == ("0.00", "", "60.00")

    def test_a_deposit_needs_an_amount(self, panel, make_booking):
        response = record(panel, priced(make_booking), payment_status="deposit")

        assert response.status_code == 400
        assert "amount_paid" in str(response.json())

    def test_a_deposit_that_covers_the_price_must_be_marked_paid(self, panel, make_booking):
        assert record(panel, priced(make_booking), payment_status="deposit", amount_paid="60").status_code == 400

    def test_there_is_no_balance_when_the_service_has_no_price(self, panel, make_booking):
        booking = make_booking(starts_at=FUTURE, status=BookingStatus.CONFIRMED, price_snapshot=None)

        data = record(panel, booking, payment_status="paid", amount_paid="30").json()

        assert data["balance"] is None

    def test_a_negative_amount_is_refused(self, panel, make_booking):
        assert record(panel, priced(make_booking), payment_status="deposit", amount_paid="-5").status_code == 400

    def test_it_does_not_change_the_status_or_the_slot(self, panel, make_booking):
        booking = priced(make_booking)

        record(panel, booking, payment_status="paid")

        stored = Booking.objects.get(pk=booking.pk)
        assert (stored.status, stored.starts_at) == (BookingStatus.CONFIRMED, FUTURE)


class TestArrival:
    def test_the_owner_marks_that_the_customer_arrived_and_can_undo_it(self, panel, make_booking):
        booking = priced(make_booking)

        arrived = record(panel, booking, arrived=True).json()
        undone = record(panel, booking, arrived=False).json()

        assert arrived["arrived_at"] is not None
        assert undone["arrived_at"] is None

    def test_marking_it_twice_keeps_the_first_time(self, panel, make_booking):
        booking = priced(make_booking)
        first = record(panel, booking, arrived=True).json()["arrived_at"]

        assert record(panel, booking, arrived=True).json()["arrived_at"] == first

    def test_a_cancelled_booking_cannot_be_marked(self, panel, make_booking):
        booking = make_booking(starts_at=FUTURE, status=BookingStatus.CANCELLED)

        response = record(panel, booking, arrived=True)

        assert response.status_code == 409
        assert response.json()["code"] == "invalid_transition"


class TestNote:
    def test_a_private_note_is_kept(self, panel, make_booking):
        booking = priced(make_booking)

        data = record(panel, booking, internal_note="Paga el viernes").json()

        assert data["internal_note"] == "Paga el viernes"

    def test_changing_the_note_leaves_the_payment_alone(self, panel, make_booking):
        booking = priced(make_booking)
        record(panel, booking, payment_status="deposit", amount_paid="20")

        data = record(panel, booking, internal_note="Llega tarde").json()

        assert (data["payment_status"], data["amount_paid"]) == ("deposit", "20.00")

    def test_a_long_one_is_refused(self, panel, make_booking):
        assert record(panel, priced(make_booking), internal_note="x" * 501).status_code == 400

    def test_the_customer_never_sees_it(self, panel, api_client, make_booking):
        booking = priced(make_booking)
        record(panel, booking, internal_note="Mal pagador")

        assert "internal_note" not in api_client.get(reverse("public-business", kwargs={"slug": booking.business.slug})).content.decode()


class TestWhoMay:
    def test_nobody_outside_the_business(self, other_panel, make_booking):
        booking = priced(make_booking)

        assert record(other_panel, booking, payment_status="paid").status_code == 404
        assert Booking.objects.get(pk=booking.pk).payment_status == "unpaid"

    def test_nobody_signed_out(self, api_client, make_booking):
        assert record(api_client, priced(make_booking), payment_status="paid").status_code in (401, 403)


class TestTheBalanceFilter:
    def test_only_what_still_stands_and_is_not_fully_paid(self, panel, make_booking):
        owes = priced(make_booking)
        paid = make_booking(starts_at=FUTURE + timedelta(hours=2), status=BookingStatus.CONFIRMED, price_snapshot=Decimal("60"))
        record(panel, paid, payment_status="paid")
        make_booking(starts_at=FUTURE + timedelta(hours=4), status=BookingStatus.CANCELLED, price_snapshot=Decimal("60"))

        results = panel.get(reverse("panel-bookings"), {"balance": "true"}).json()["results"]

        assert [item["id"] for item in results] == [owes.id]


def test_the_digits_of_a_code_are_not_taken_for_a_phone_number(panel, make_booking, customer):
    customer.phone = "+51923456789"
    customer.save()
    booking = make_booking(starts_at=FUTURE)
    other = make_booking(starts_at=FUTURE + timedelta(hours=2))
    Booking.objects.filter(pk=booking.pk).update(code="ABC234")
    Booking.objects.filter(pk=other.pk).update(code="XYZ777")

    results = panel.get(reverse("panel-bookings"), {"q": "ABC-234"}).json()["results"]

    assert [item["id"] for item in results] == [booking.id]
