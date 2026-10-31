"""Who a business can trust, and what changes for someone it cannot yet (D97 to D100).

The shared test business treats everyone alike so other tests are not affected; the tests here start from
the platform defaults instead.
"""

from datetime import timedelta

import pytest

from apps.bookings import services
from apps.bookings.models import Booking, BookingStatus
from apps.customers import trust
from apps.customers.models import Customer

from datetime import time

from .helpers import MON, NOW, at, configure, open_mondays

GOOGLE_ANA = {"sub": "google-ana", "email": "ana@gmail.com", "email_verified": True}
GOOGLE_LUIS = {"sub": "google-luis", "email": "luis@gmail.com", "email_verified": True}


@pytest.fixture
def shop(business, resource):
    """A business on the platform defaults, open every Monday evening."""
    open_mondays(business, resource, end=time(23))
    for key in ("unverified_hold_minutes", "max_active_bookings_unverified"):
        business.settings.pop(key, None)
    business.save()
    return business


@pytest.fixture
def book(shop, service):
    def _book(hour=19, phone="987654321", name="Ana", day=MON, identity=None):
        return services.create_booking(
            business=shop,
            service=service,
            starts_at=at(day, hour),
            customer_name=name,
            customer_phone=phone,
            google_identity=identity,
            now=NOW,
        )

    return _book


def attend(booking):
    """The booking happened: the customer now has a history in this business."""
    Booking.objects.filter(pk=booking.pk).update(status=BookingStatus.COMPLETED)


def miss(booking):
    Booking.objects.filter(pk=booking.pk).update(status=BookingStatus.NO_SHOW)


class TestTheLevels:
    def test_someone_who_never_booked_is_new(self):
        assert trust.level_for_booking(blocked=False, no_shows=0, completed=0, linked_to_google=False, proven_now=False) == trust.NEW

    def test_having_been_attended_makes_them_known(self):
        assert trust.level_for_booking(blocked=False, no_shows=0, completed=2, linked_to_google=False, proven_now=False) == trust.KNOWN

    def test_proving_who_they_are_with_google_makes_them_verified(self):
        assert trust.level_for_booking(blocked=False, no_shows=0, completed=0, linked_to_google=True, proven_now=True) == trust.VERIFIED

    def test_a_missed_booking_or_a_block_takes_the_trust_away_whatever_else_they_are(self):
        for kwargs in ({"blocked": True, "no_shows": 0}, {"blocked": False, "no_shows": 1}):
            level = trust.level_for_booking(completed=5, linked_to_google=True, proven_now=True, **kwargs)
            assert level == trust.FLAGGED

    def test_a_number_linked_to_google_is_not_trusted_for_someone_who_cannot_prove_it(self):
        # Anyone could type a regular's phone: only the owner of the Google account gets the good name.
        level = trust.level_for_booking(blocked=False, no_shows=0, completed=5, linked_to_google=True, proven_now=False)

        assert level == trust.NEW


class TestTheNewMode:
    def test_a_customer_the_business_trusts_is_confirmed_at_once(self, shop, book):
        configure(shop, confirmation_mode="trusted")

        booking, _ = book(identity=GOOGLE_ANA)

        assert booking.status == BookingStatus.CONFIRMED
        assert booking.expires_at is None
        assert booking.verified is True

    def test_so_is_one_who_was_attended_before(self, shop, book):
        configure(shop, confirmation_mode="trusted")
        first, _ = book()
        attend(first)

        booking, _ = book(hour=21)

        assert booking.status == BookingStatus.CONFIRMED

    def test_anyone_else_waits_for_the_owner(self, shop, book):
        configure(shop, confirmation_mode="trusted")

        booking, _ = book()

        assert booking.status == BookingStatus.PENDING
        assert booking.expires_at is not None
        assert booking.verified is False

    def test_someone_who_missed_a_booking_waits_even_if_verified(self, shop, book):
        configure(shop, confirmation_mode="trusted")
        first, _ = book(identity=GOOGLE_ANA)
        miss(first)

        booking, _ = book(hour=21, identity=GOOGLE_ANA)

        assert booking.status == BookingStatus.PENDING

    def test_the_other_two_modes_are_not_changed(self, shop, book):
        configure(shop, confirmation_mode="automatic")
        assert book()[0].status == BookingStatus.CONFIRMED

        configure(shop, confirmation_mode="manual")
        assert book(hour=21, phone="999111222", name="Luis", identity=GOOGLE_LUIS)[0].status == BookingStatus.PENDING


class TestStricterLimitsUntilTrusted:
    def test_a_new_customer_holds_a_slot_for_half_an_hour_not_two_hours(self, book):
        booking, _ = book()

        assert booking.expires_at == NOW + timedelta(minutes=30)

    def test_a_trusted_customer_keeps_the_normal_wait(self, shop, book):
        first, _ = book()
        attend(first)

        booking, _ = book(hour=21)

        assert booking.expires_at == NOW + timedelta(minutes=120)

    def test_the_owner_can_make_the_wait_equal_for_everyone(self, shop, book):
        configure(shop, unverified_hold_minutes=120)

        assert book()[0].expires_at == NOW + timedelta(minutes=120)

    def test_the_wait_is_never_longer_than_the_one_the_owner_asked_for(self, shop, book):
        configure(shop, pending_hold_minutes=10)

        assert book()[0].expires_at == NOW + timedelta(minutes=10)

    def test_a_new_customer_can_only_have_one_active_booking(self, book):
        book()

        with pytest.raises(services.TooManyActiveBookings):
            book(hour=21)

    def test_a_trusted_customer_keeps_the_normal_limit(self, shop, book):
        first, _ = book()
        attend(first)

        book(hour=18)
        book(hour=20)
        book(hour=21)

        with pytest.raises(services.TooManyActiveBookings):
            book(hour=22)  # a fourth one that is still active

    def test_one_google_account_counts_as_one_person_whatever_numbers_it_books_with(self, shop, book):
        configure(shop, max_active_bookings_per_customer=1)
        book(phone="987654321", identity=GOOGLE_ANA)

        with pytest.raises(services.TooManyActiveBookings):
            book(hour=21, phone="999000111", identity=GOOGLE_ANA)

    def test_two_different_people_do_not_share_the_limit(self, book):
        book(phone="987654321", identity=GOOGLE_ANA)

        booking, _ = book(hour=21, phone="999000111", name="Luis", identity=GOOGLE_LUIS)

        assert booking.status == BookingStatus.PENDING


class TestGoogleAndTheCustomer:
    def test_the_first_time_links_the_account_and_takes_the_verified_email(self, book):
        booking, _ = book(identity=GOOGLE_ANA)

        customer = Customer.objects.get(phone="+51987654321")
        assert customer.google_sub == "google-ana"
        assert customer.verified_at is not None
        assert customer.email == "ana@gmail.com"
        assert booking.verified is True

    def test_a_number_linked_to_one_google_account_is_not_lent_to_another(self, shop, book):
        configure(shop, max_active_bookings_unverified=3)
        book(identity=GOOGLE_ANA)

        booking, _ = book(hour=21, identity=GOOGLE_LUIS)

        customer = Customer.objects.get(phone="+51987654321")
        assert customer.google_sub == "google-ana"
        assert booking.verified is False

    def test_booking_that_number_without_google_gets_no_good_name(self, shop, book):
        configure(shop, confirmation_mode="trusted", max_active_bookings_unverified=3)
        first, _ = book(identity=GOOGLE_ANA)
        attend(first)

        stranger, _ = book(hour=21)  # someone typing Ana's phone

        assert stranger.status == BookingStatus.PENDING
        assert stranger.verified is False

    def test_without_google_nothing_changes_for_the_customer_row(self, book):
        book()

        customer = Customer.objects.get(phone="+51987654321")
        assert customer.google_sub is None
        assert customer.verified_at is None


class TestRepeatedNoShows:
    @pytest.fixture
    def confirmed(self, shop, book):
        configure(shop, confirmation_mode="automatic")

        def _confirmed(hour):
            booking, _ = book(hour=hour)
            # Already over, and at a different hour each time so they do not overlap.
            Booking.objects.filter(pk=booking.pk).update(
                starts_at=NOW - timedelta(hours=hour), ends_at=NOW - timedelta(hours=hour - 1)
            )
            return Booking.objects.get(pk=booking.pk)

        return _confirmed

    def test_the_second_no_show_blocks_the_customer_by_itself(self, shop, confirmed):
        services.mark_no_show(confirmed(19), now=NOW)
        assert Customer.objects.get().is_blocked is False

        shop_booking = confirmed(20)
        services.mark_no_show(shop_booking, now=NOW)

        assert Customer.objects.get().is_blocked is True

    def test_the_limit_is_the_owners_to_set(self, shop, confirmed):
        configure(shop, auto_block_no_shows=1)

        services.mark_no_show(confirmed(19), now=NOW)

        assert Customer.objects.get().is_blocked is True

    def test_zero_turns_it_off(self, shop, confirmed):
        configure(shop, auto_block_no_shows=0)

        services.mark_no_show(confirmed(19), now=NOW)
        services.mark_no_show(confirmed(20), now=NOW)

        assert Customer.objects.get().is_blocked is False

    def test_a_blocked_customer_gets_the_same_generic_refusal_as_always(self, shop, confirmed, book):
        configure(shop, auto_block_no_shows=1)
        services.mark_no_show(confirmed(19), now=NOW)

        with pytest.raises(services.BookingNotAllowed):
            book(hour=21)


class TestTurningDownAJoke:
    def test_the_slot_is_freed_and_the_customer_blocked(self, book):
        booking, _ = book()

        result = services.dismiss_as_prank(booking, now=NOW)

        assert result.status == BookingStatus.CANCELLED
        assert result.expires_at is None
        assert Customer.objects.get().is_blocked is True

    def test_the_slot_can_be_booked_again(self, book):
        booking, _ = book()
        services.dismiss_as_prank(booking, now=NOW)

        again, _ = book(phone="999000111", name="Luis")

        assert again.status == BookingStatus.PENDING

    def test_only_a_pending_booking_can_be_turned_down(self, shop, book):
        configure(shop, confirmation_mode="automatic")
        booking, _ = book()

        with pytest.raises(services.InvalidTransition):
            services.dismiss_as_prank(booking, now=NOW)

        assert Customer.objects.get().is_blocked is False

    def test_the_customer_is_not_written_to(self, book):
        from django.core import mail

        booking, _ = book()
        before = len(mail.outbox)

        services.dismiss_as_prank(booking, now=NOW)

        assert len(mail.outbox) == before
