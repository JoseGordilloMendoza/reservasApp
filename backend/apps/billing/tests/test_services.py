from datetime import date, datetime, timezone
from decimal import Decimal

import pytest

from apps.billing import services
from apps.billing.models import Subscription

# Noon in Lima (UTC-5) on these days.
def noon(year, month, day):
    return datetime(year, month, day, 17, 0, tzinfo=timezone.utc)


@pytest.fixture
def subscribed(business):
    return services.start_subscription(
        business=business, price=Decimal("80"), valid_until=date(2030, 3, 31), plan_name="Mensual"
    )


class TestStanding:
    def test_a_business_without_a_subscription_never_expires(self, business):
        result = services.standing(business, noon(2099, 1, 1))

        assert result.state == services.NONE
        assert result.days_left is None
        assert services.is_operational(business, noon(2099, 1, 1))

    def test_active_through_the_last_day_inclusive(self, business, subscribed):
        assert services.standing(business, noon(2030, 3, 31)).state == services.ACTIVE

    def test_counts_the_days_left(self, business, subscribed):
        assert services.standing(business, noon(2030, 3, 21)).days_left == 10
        assert services.standing(business, noon(2030, 3, 31)).days_left == 0

    def test_the_day_after_it_ends_it_is_in_grace_with_a_negative_count(self, business, subscribed):
        result = services.standing(business, noon(2030, 4, 1))

        assert result.state == services.GRACE
        assert result.days_left == -1
        assert result.grace_ends_on == date(2030, 4, 5)

    def test_still_working_on_the_last_grace_day(self, business, subscribed):
        assert services.standing(business, noon(2030, 4, 5)).state == services.GRACE
        assert services.is_operational(business, noon(2030, 4, 5))

    def test_expired_after_the_grace_days_and_no_longer_operational(self, business, subscribed):
        assert services.standing(business, noon(2030, 4, 6)).state == services.EXPIRED
        assert not services.is_operational(business, noon(2030, 4, 6))

    def test_five_days_of_grace(self):
        assert services.GRACE_DAYS == 5

    def test_uses_the_business_calendar_not_utc(self, business, subscribed):
        # 2030-04-01 02:00 UTC is still 2030-03-31 21:00 in Lima: the last covered day.
        late = datetime(2030, 4, 1, 2, 0, tzinfo=timezone.utc)

        assert services.standing(business, late).state == services.ACTIVE

    def test_a_suspended_business_is_not_operational_even_with_a_valid_subscription(self, business, subscribed):
        business.status = business.Status.SUSPENDED
        business.save()

        assert not services.is_operational(business, noon(2030, 3, 1))

    def test_a_payment_brings_an_expired_business_back(self, business, subscribed):
        assert not services.is_operational(business, noon(2030, 5, 1))

        services.register_payment(
            business=business, amount=Decimal("80"), method="yape", months=1, paid_on=date(2030, 5, 1), recorded_by=None
        )

        assert services.is_operational(business, noon(2030, 5, 1))


class TestMonths:
    @pytest.mark.parametrize(
        ("start", "months", "expected"),
        [
            (date(2030, 1, 15), 1, date(2030, 2, 15)),
            (date(2030, 1, 15), 12, date(2031, 1, 15)),
            (date(2030, 11, 10), 3, date(2031, 2, 10)),
            (date(2030, 1, 31), 1, date(2030, 2, 28)),  # no 31st in February
            (date(2028, 1, 31), 1, date(2028, 2, 29)),  # leap year
            (date(2030, 12, 1), 1, date(2031, 1, 1)),
        ],
    )
    def test_adds_calendar_months(self, start, months, expected):
        assert services.add_months(start, months) == expected


class TestPayments:
    def pay(self, business, paid_on, months=1, **extra):
        return services.register_payment(
            business=business,
            amount=Decimal("80"),
            method="yape",
            months=months,
            paid_on=paid_on,
            recorded_by=None,
            **extra,
        )

    def test_paying_while_covered_continues_from_the_current_end(self, business, subscribed):
        payment = self.pay(business, date(2030, 3, 20))

        assert (payment.period_start, payment.period_end) == (date(2030, 4, 1), date(2030, 4, 30))
        subscribed.refresh_from_db()
        assert subscribed.valid_until == date(2030, 4, 30)

    def test_paying_after_lapsing_starts_on_the_day_it_paid(self, business, subscribed):
        payment = self.pay(business, date(2030, 6, 10))

        assert (payment.period_start, payment.period_end) == (date(2030, 6, 10), date(2030, 7, 9))
        subscribed.refresh_from_db()
        assert subscribed.valid_until == date(2030, 7, 9)

    def test_paying_on_the_last_covered_day_still_continues_from_it(self, business, subscribed):
        payment = self.pay(business, date(2030, 3, 31))

        assert payment.period_start == date(2030, 4, 1)

    def test_several_months_at_once(self, business, subscribed):
        payment = self.pay(business, date(2030, 3, 20), months=3)

        assert payment.period_end == date(2030, 6, 30)

    def test_consecutive_payments_chain_without_gaps_or_overlaps(self, business, subscribed):
        first = self.pay(business, date(2030, 3, 25))
        second = self.pay(business, date(2030, 3, 26))

        assert (first.period_start, first.period_end) == (date(2030, 4, 1), date(2030, 4, 30))
        assert (second.period_start, second.period_end) == (date(2030, 5, 1), date(2030, 5, 31))
        subscribed.refresh_from_db()
        assert subscribed.valid_until == date(2030, 5, 31)

    def test_keeps_the_details_of_the_payment(self, business, subscribed):
        payment = self.pay(business, date(2030, 3, 20), reference="Op. 12345", note="Pagó su hermana")

        assert payment.amount == Decimal("80")
        assert payment.method == "yape"
        assert payment.reference == "Op. 12345"
        assert payment.business == business

    def test_a_business_without_a_subscription_cannot_be_paid_for(self, business):
        with pytest.raises(services.NoSubscription):
            self.pay(business, date(2030, 3, 20))

    def test_the_history_lists_the_latest_first(self, business, subscribed):
        self.pay(business, date(2030, 3, 20))
        self.pay(business, date(2030, 4, 20))

        assert [p.paid_on for p in business.payments.all()] == [date(2030, 4, 20), date(2030, 3, 20)]

    def test_deleting_the_business_removes_its_subscription_and_payments(self, business, subscribed):
        self.pay(business, date(2030, 3, 20))

        business.delete()

        assert Subscription.objects.count() == 0


class TestWhenTheSubscriptionIsAlreadyAtHand:
    def test_uses_the_one_given_without_looking_it_up(self, business, subscribed, django_assert_num_queries):
        with django_assert_num_queries(0):
            result = services.standing(business, noon(2030, 3, 21), subscription=subscribed)

        assert result.days_left == 10

    def test_none_means_the_business_has_no_subscription(self, business, subscribed, django_assert_num_queries):
        with django_assert_num_queries(0):
            result = services.standing(business, noon(2099, 1, 1), subscription=None)

        assert result.state == services.NONE


class TestThePlatformDay:
    def test_is_the_day_in_lima(self):
        # 02:00 UTC on the 1st is still 21:00 of the 31st in Lima.
        assert services.platform_today(datetime(2030, 4, 1, 2, 0, tzinfo=timezone.utc)) == date(2030, 3, 31)

    def test_matches_utc_when_both_are_on_the_same_day(self):
        assert services.platform_today(noon(2030, 4, 1)) == date(2030, 4, 1)
