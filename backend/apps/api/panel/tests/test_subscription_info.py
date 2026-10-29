from datetime import timedelta
from decimal import Decimal

import pytest
from django.urls import reverse

from apps.billing import services as billing


def subscription_of(panel):
    return panel.get(reverse("panel-business")).json()["subscription"]


@pytest.fixture
def subscribe(business):
    def _subscribe(days_from_today):
        today = billing.business_today(business)
        return billing.start_subscription(
            business=business, price=Decimal("80"), valid_until=today + timedelta(days=days_from_today)
        )

    return _subscribe


def test_a_business_without_a_subscription_has_none_to_show(panel):
    assert subscription_of(panel) is None


def test_shows_the_days_left_while_covered(panel, subscribe):
    subscribe(12)

    info = subscription_of(panel)

    assert info["state"] == "active"
    assert info["days_left"] == 12


def test_warns_during_the_grace_days_and_says_until_when(panel, subscribe, business):
    subscription = subscribe(-2)

    info = subscription_of(panel)

    assert info["state"] == "grace"
    assert info["days_left"] == -2
    assert info["grace_ends_on"] == str(subscription.valid_until + timedelta(days=billing.GRACE_DAYS))


def test_says_when_it_is_expired(panel, subscribe):
    subscribe(-30)

    assert subscription_of(panel)["state"] == "expired"


def test_the_owner_can_still_use_the_panel_when_expired(panel, subscribe):
    subscribe(-30)

    assert panel.get(reverse("panel-business")).status_code == 200
    assert panel.get(reverse("panel-bookings")).status_code == 200


def test_exposes_only_what_the_warning_needs(panel, subscribe):
    subscribe(5)

    assert set(subscription_of(panel)) == {"state", "valid_until", "grace_ends_on", "days_left"}
