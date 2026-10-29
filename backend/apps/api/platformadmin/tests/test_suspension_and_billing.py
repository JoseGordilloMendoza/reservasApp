from datetime import timedelta
from decimal import Decimal

import pytest
from django.urls import reverse

from apps.billing import services as billing
from apps.businesses.models import Business
from apps.platformadmin.models import ActivityLog


def url(name, business):
    return reverse(name, kwargs={"slug": business.slug})


def today():
    return billing.platform_today()


@pytest.fixture
def subscribed(business):
    return billing.start_subscription(
        business=business, price=Decimal("80"), valid_until=today() + timedelta(days=10), plan_name="Mensual"
    )


def actions():
    return list(ActivityLog.objects.order_by("id").values_list("action", flat=True))


class TestSuspending:
    def test_suspends_with_a_reason_and_remembers_when(self, team, business):
        response = team.post(url("platform-suspend", business), {"reason": "No pagó dos meses"}, format="json")

        assert response.status_code == 200
        business.refresh_from_db()
        assert business.status == Business.Status.SUSPENDED
        assert business.suspended_reason == "No pagó dos meses"
        assert business.suspended_at is not None
        assert response.json()["suspended_reason"] == "No pagó dos meses"

    def test_a_reason_is_required(self, team, business):
        for payload in ({}, {"reason": ""}, {"reason": "   "}):
            assert team.post(url("platform-suspend", business), payload, format="json").status_code == 400

        business.refresh_from_db()
        assert business.status == Business.Status.ACTIVE

    def test_suspending_twice_is_a_conflict(self, team, business):
        team.post(url("platform-suspend", business), {"reason": "Uno"}, format="json")

        again = team.post(url("platform-suspend", business), {"reason": "Dos"}, format="json")

        assert again.status_code == 409
        assert again.json()["code"] == "already_suspended"
        business.refresh_from_db()
        assert business.suspended_reason == "Uno"

    def test_a_suspended_business_stops_taking_bookings_but_keeps_its_data(self, team, business, owner_client, make_booking):
        make_booking()

        team.post(url("platform-suspend", business), {"reason": "Sin pago"}, format="json")

        business.refresh_from_db()
        assert not billing.is_operational(business)
        assert owner_client.get(reverse("panel-bookings")).json()["count"] == 1
        assert owner_client.get(reverse("panel-business")).json()["status"] == "suspended"

    def test_reactivating_clears_the_reason(self, team, business):
        team.post(url("platform-suspend", business), {"reason": "Sin pago"}, format="json")

        response = team.post(url("platform-reactivate", business))

        assert response.status_code == 200
        business.refresh_from_db()
        assert business.status == Business.Status.ACTIVE
        assert business.suspended_reason == "" and business.suspended_at is None
        assert billing.is_operational(business)

    def test_reactivating_one_that_is_not_suspended_is_a_conflict(self, team, business):
        response = team.post(url("platform-reactivate", business))

        assert response.status_code == 409
        assert response.json()["code"] == "not_suspended"

    def test_both_are_logged_with_the_reason(self, team, business):
        team.post(url("platform-suspend", business), {"reason": "Sin pago"}, format="json")
        team.post(url("platform-reactivate", business))

        assert actions() == ["business.suspended", "business.reactivated"]
        assert ActivityLog.objects.get(action="business.suspended").detail == {"reason": "Sin pago"}
        assert ActivityLog.objects.get(action="business.reactivated").detail == {"previous_reason": "Sin pago"}

    def test_owners_cannot_suspend_themselves_or_anyone(self, owner_client, business):
        assert owner_client.post(url("platform-suspend", business), {"reason": "x"}, format="json").status_code == 403
        assert owner_client.post(url("platform-reactivate", business)).status_code == 403


class TestTheSubscription:
    def test_none_yet(self, team, business):
        response = team.get(url("platform-subscription", business))

        assert response.status_code == 404
        assert response.json()["code"] == "no_subscription"

    def test_creates_one(self, team, business):
        end = today() + timedelta(days=30)

        response = team.put(
            url("platform-subscription", business),
            {"plan_name": "Mensual", "price": "80", "valid_until": str(end)},
            format="json",
        )

        assert response.status_code == 201
        assert business.subscription.valid_until == end
        assert actions() == ["subscription.set"]

    def test_creating_needs_a_price_and_an_end(self, team, business):
        response = team.put(url("platform-subscription", business), {"plan_name": "Mensual"}, format="json")

        assert response.status_code == 400
        assert set(response.json()) == {"price", "valid_until"}

    def test_changes_the_plan_price_and_notes_without_a_reason(self, team, business, subscribed):
        response = team.put(
            url("platform-subscription", business),
            {"plan_name": "Anual", "price": "70", "notes": "Descuento por 12 meses"},
            format="json",
        )

        assert response.status_code == 200
        subscribed.refresh_from_db()
        assert (subscribed.plan_name, subscribed.price, subscribed.notes) == ("Anual", 70, "Descuento por 12 meses")
        assert actions() == []  # nothing that moves the end date, nothing to explain

    def test_moving_the_end_by_hand_needs_a_reason(self, team, business, subscribed):
        new_end = subscribed.valid_until + timedelta(days=15)

        refused = team.put(url("platform-subscription", business), {"valid_until": str(new_end)}, format="json")

        assert refused.status_code == 400
        assert "reason" in refused.json()
        subscribed.refresh_from_db()
        assert subscribed.valid_until != new_end

    def test_moving_the_end_with_a_reason_is_logged_with_before_and_after(self, team, business, subscribed):
        old_end = subscribed.valid_until
        new_end = old_end + timedelta(days=15)

        response = team.put(
            url("platform-subscription", business),
            {"valid_until": str(new_end), "reason": "Cortesía por la falla del sábado"},
            format="json",
        )

        assert response.status_code == 200
        subscribed.refresh_from_db()
        assert subscribed.valid_until == new_end
        entry = ActivityLog.objects.get(action="subscription.adjusted")
        assert entry.detail == {"reason": "Cortesía por la falla del sábado", "valid_until": [str(old_end), str(new_end)]}

    def test_sending_the_same_end_again_needs_no_reason(self, team, business, subscribed):
        response = team.put(
            url("platform-subscription", business), {"valid_until": str(subscribed.valid_until)}, format="json"
        )

        assert response.status_code == 200

    def test_owners_cannot_touch_it(self, owner_client, business, subscribed):
        assert owner_client.get(url("platform-subscription", business)).status_code == 403
        assert owner_client.put(url("platform-subscription", business), {"price": "1"}, format="json").status_code == 403


class TestPayments:
    def pay(self, team, business, **overrides):
        data = {"amount": "80", "method": "yape", **overrides}
        return team.post(url("platform-payments", business), data, format="json")

    def test_a_payment_extends_the_subscription_and_says_what_it_bought(self, team, business, subscribed):
        old_end = subscribed.valid_until

        response = self.pay(team, business, reference="Op. 123", note="Pagó su hermana")

        assert response.status_code == 201
        data = response.json()
        assert data["period_start"] == str(old_end + timedelta(days=1))
        assert data["reference"] == "Op. 123"
        assert data["recorded_by"] == "equipo@example.com"
        subscribed.refresh_from_db()
        assert str(subscribed.valid_until) == data["period_end"]

    def test_several_months(self, team, business, subscribed):
        data = self.pay(team, business, months=3, amount="240").json()

        assert data["months"] == 3

    def test_the_date_defaults_to_today_and_cannot_be_in_the_future(self, team, business, subscribed):
        assert self.pay(team, business).json()["paid_on"] == str(today())

        future = self.pay(team, business, paid_on=str(today() + timedelta(days=2)))

        assert future.status_code == 400
        assert "paid_on" in future.json()

    def test_a_payment_after_lapsing_brings_the_business_back(self, team, business):
        billing.start_subscription(business=business, price=Decimal("80"), valid_until=today() - timedelta(days=60))
        assert not billing.is_operational(business)

        self.pay(team, business)

        assert billing.is_operational(business)

    def test_without_a_subscription_it_is_a_conflict(self, team, business):
        response = self.pay(team, business)

        assert response.status_code == 409
        assert response.json()["code"] == "no_subscription"

    @pytest.mark.parametrize(
        "payload",
        [{"amount": "-1"}, {"amount": "abc"}, {"method": "bitcoin"}, {"months": 0}, {"months": 25}, {"method": ""}],
    )
    def test_bad_data_is_refused_and_records_nothing(self, team, business, subscribed, payload):
        response = self.pay(team, business, **payload)

        assert response.status_code == 400
        assert business.payments.count() == 0

    def test_the_history_lists_the_latest_first(self, team, business, subscribed):
        self.pay(team, business, paid_on=str(today() - timedelta(days=5)))
        self.pay(team, business, paid_on=str(today()))

        history = team.get(url("platform-payments", business)).json()

        assert [item["paid_on"] for item in history] == [str(today()), str(today() - timedelta(days=5))]

    def test_it_is_logged(self, team, business, subscribed):
        self.pay(team, business, method="plin", months=2, amount="160")

        entry = ActivityLog.objects.get(action="payment.recorded")
        assert entry.detail["amount"] == "160.00"
        assert entry.detail["method"] == "plin"
        assert entry.detail["months"] == 2

    def test_a_business_sees_only_its_own_payments(self, team, business, other_business, subscribed):
        billing.start_subscription(business=other_business, price=Decimal("90"), valid_until=today() + timedelta(days=5))
        self.pay(team, other_business, amount="90")

        assert team.get(url("platform-payments", business)).json() == []

    def test_owners_cannot_record_or_read_payments(self, owner_client, business, subscribed):
        assert owner_client.post(url("platform-payments", business), {"amount": "1", "method": "cash"}, format="json").status_code == 403
        assert owner_client.get(url("platform-payments", business)).status_code == 403
