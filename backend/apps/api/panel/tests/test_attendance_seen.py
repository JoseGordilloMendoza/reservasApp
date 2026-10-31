"""What the owner sees when a customer says they are coming."""

from datetime import timedelta

from django.urls import reverse
from django.utils import timezone

from apps.bookings import services
from apps.bookings.models import BookingStatus


def test_the_owner_sees_when_the_customer_confirmed(panel, make_booking):
    booking = make_booking(starts_at=timezone.now() + timedelta(hours=10), status=BookingStatus.CONFIRMED)
    url = reverse("panel-booking", kwargs={"pk": booking.pk})

    assert panel.get(url).json()["customer_confirmed_at"] is None

    services.confirm_attendance(booking)

    assert panel.get(url).json()["customer_confirmed_at"] is not None


def test_it_is_in_the_list_too(panel, make_booking):
    booking = make_booking(starts_at=timezone.now() + timedelta(hours=10), status=BookingStatus.CONFIRMED)
    services.confirm_attendance(booking)

    results = panel.get(reverse("panel-bookings")).json()["results"]

    assert results[0]["customer_confirmed_at"] is not None
