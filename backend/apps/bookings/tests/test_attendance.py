"""The customer says "I am coming" from their ticket, in the day before the booking (D104)."""

from datetime import timedelta

import pytest

from apps.bookings import services
from apps.bookings.models import Booking, BookingStatus

from .helpers import NOW


@pytest.fixture
def make(make_booking):
    """A booking starting `hours` from NOW, confirmed unless said otherwise."""

    def _make(hours, status=BookingStatus.CONFIRMED):
        return make_booking(starts_at=NOW + timedelta(hours=hours), status=status)

    return _make


class TestWhenItIsOpen:
    def test_in_the_day_before_a_confirmed_booking(self, make):
        assert services.attendance_is_open(make(20), NOW) is True
        assert services.attendance_is_open(make(24), NOW) is True
        assert services.attendance_is_open(make(1), NOW) is True

    def test_not_earlier_than_that(self, make):
        assert services.attendance_is_open(make(24.1), NOW) is False
        assert services.attendance_is_open(make(72), NOW) is False

    def test_not_once_it_has_started(self, make):
        assert services.attendance_is_open(make(0), NOW) is False
        assert services.attendance_is_open(make(-1), NOW) is False

    @pytest.mark.parametrize("status", [BookingStatus.PENDING, BookingStatus.CANCELLED, BookingStatus.EXPIRED, BookingStatus.NO_SHOW])
    def test_only_for_a_confirmed_booking(self, make, status):
        assert services.attendance_is_open(make(5, status), NOW) is False


class TestSayingIt:
    def test_it_is_written_down_with_the_time(self, make):
        booking = services.confirm_attendance(make(10), now=NOW)

        assert booking.customer_confirmed_at == NOW

    def test_saying_it_again_keeps_the_first_time(self, make):
        booking = make(10)
        services.confirm_attendance(booking, now=NOW)

        again = services.confirm_attendance(booking, now=NOW + timedelta(hours=2))

        assert again.customer_confirmed_at == NOW

    def test_nothing_else_about_the_booking_changes(self, make):
        booking = make(10)

        services.confirm_attendance(booking, now=NOW)

        stored = Booking.objects.get(pk=booking.pk)
        assert (stored.status, stored.starts_at, stored.expires_at) == (BookingStatus.CONFIRMED, booking.starts_at, None)

    def test_too_early_says_when_it_opens(self, make):
        with pytest.raises(services.AttendanceNotYetOpen) as error:
            services.confirm_attendance(make(48), now=NOW)

        assert "un día antes" in error.value.message

    def test_a_pending_booking_cannot(self, make):
        with pytest.raises(services.InvalidTransition):
            services.confirm_attendance(make(10, BookingStatus.PENDING), now=NOW)

    def test_a_cancelled_booking_cannot(self, make):
        with pytest.raises(services.InvalidTransition):
            services.confirm_attendance(make(10, BookingStatus.CANCELLED), now=NOW)

    def test_one_that_already_started_cannot(self, make):
        with pytest.raises(services.InvalidTransition) as error:
            services.confirm_attendance(make(-1), now=NOW)

        assert "ya empezó" in error.value.message

    def test_a_failed_attempt_writes_nothing(self, make):
        booking = make(48)

        with pytest.raises(services.AttendanceNotYetOpen):
            services.confirm_attendance(booking, now=NOW)

        assert Booking.objects.get(pk=booking.pk).customer_confirmed_at is None
