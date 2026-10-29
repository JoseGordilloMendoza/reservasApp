from datetime import timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.accounts.models import Membership
from apps.billing import services as billing
from apps.bookings.models import Booking
from apps.businesses.models import Business
from apps.platformadmin.models import ActivityLog


def subscribe(business, days_from_today, price="80"):
    return billing.start_subscription(
        business=business, price=Decimal(price), valid_until=billing.platform_today() + timedelta(days=days_from_today)
    )


def get(team, name, **params):
    return team.get(reverse(name), params)


def rows(team, **params):
    return get(team, "platform-businesses", **params).json()["results"]


def slugs(team, **params):
    return [row["slug"] for row in rows(team, **params)]


class TestTheList:
    def test_lists_every_business_by_name(self, team, business, other_business):
        assert slugs(team) == ["cancha-los-andes", "consultorio-lucia"]

    def test_each_row_says_where_the_subscription_stands(self, team, business):
        subscribe(business, 10)

        row = rows(team)[0]

        assert row["standing"]["state"] == "active"
        assert row["standing"]["days_left"] == 10
        assert row["price"] == "80.00"

    def test_a_business_without_a_subscription_says_so(self, team, business):
        row = rows(team)[0]

        assert row["standing"]["state"] == "none"
        assert row["plan_name"] is None and row["price"] is None

    def test_counts_users_and_recent_bookings(self, team, business, owner, make_booking):
        make_booking()

        row = rows(team)[0]

        assert row["users_count"] == 1
        assert row["bookings_30d"] == 1

    def test_old_bookings_do_not_count_as_recent(self, team, business, make_booking):
        booking = make_booking()
        Booking.objects.filter(pk=booking.pk).update(created_at=timezone.now() - timedelta(days=45))

        assert rows(team)[0]["bookings_30d"] == 0

    def test_a_list_costs_the_same_queries_however_many_businesses(self, team, business, django_assert_max_num_queries):
        for n in range(8):
            other = Business.objects.create(slug=f"negocio-{n}", name=f"Negocio {n}")
            subscribe(other, n)

        with django_assert_max_num_queries(6):
            assert get(team, "platform-businesses").status_code == 200

    def test_search_by_name_or_link(self, team, business, other_business):
        assert slugs(team, q="lucía") == ["consultorio-lucia"]
        assert slugs(team, q="LOS-ANDES") == ["cancha-los-andes"]
        assert slugs(team, q="nada") == []

    def test_filters(self, team, business, other_business):
        third = Business.objects.create(slug="tercero", name="Tercero", status=Business.Status.SUSPENDED)
        subscribe(business, -3)
        subscribe(other_business, 3)

        assert slugs(team, filter="past_due") == ["cancha-los-andes"]
        assert slugs(team, filter="expiring") == ["consultorio-lucia"]
        assert slugs(team, filter="suspended") == ["tercero"]
        assert slugs(team, filter="active") == ["cancha-los-andes", "consultorio-lucia"]
        assert slugs(team, filter="no_subscription") == ["tercero"]
        assert third.slug == "tercero"

    def test_a_business_far_from_expiring_is_not_in_expiring(self, team, business):
        subscribe(business, 40)

        assert slugs(team, filter="expiring") == []

    def test_is_paginated(self, team, db):
        for n in range(30):
            Business.objects.create(slug=f"n{n:02d}", name=f"Negocio {n:02d}")

        data = get(team, "platform-businesses").json()

        assert data["count"] == 30
        assert len(data["results"]) == 25
        assert data["next"]


class TestTheDashboard:
    def test_counts_businesses_by_state(self, team, business, other_business):
        Business.objects.filter(pk=other_business.pk).update(status=Business.Status.SUSPENDED)

        data = get(team, "platform-dashboard").json()["businesses"]

        assert data == {"total": 2, "active": 1, "suspended": 1}

    def test_counts_subscriptions_by_standing(self, team, business, other_business):
        third = Business.objects.create(slug="tercero", name="Tercero")
        fourth = Business.objects.create(slug="cuarto", name="Cuarto")
        Business.objects.create(slug="quinto", name="Quinto")  # no subscription
        subscribe(business, 20)  # active
        subscribe(other_business, 3)  # active and about to expire
        subscribe(third, -2)  # grace
        subscribe(fourth, -20)  # expired

        data = get(team, "platform-dashboard").json()["subscriptions"]

        assert data == {"active": 2, "expiring_soon": 1, "grace": 1, "expired": 1, "without_subscription": 1}

    def test_money_received_this_month_and_expected_each_month(self, team, business, other_business):
        subscribe(business, 20, price="80")
        subscribe(other_business, 20, price="120")
        billing.register_payment(
            business=business, amount=Decimal("80"), method="yape", months=1, paid_on=billing.platform_today(), recorded_by=None
        )
        billing.register_payment(
            business=other_business, amount=Decimal("120"), method="cash", months=1, paid_on=billing.platform_today(), recorded_by=None
        )

        data = get(team, "platform-dashboard").json()["revenue"]

        assert Decimal(str(data["received_this_month"])) == Decimal("200")
        assert Decimal(str(data["expected_monthly"])) == Decimal("200")

    def test_a_lapsed_business_is_not_expected_to_pay(self, team, business):
        subscribe(business, -30, price="80")

        assert Decimal(str(get(team, "platform-dashboard").json()["revenue"]["expected_monthly"])) == 0

    def test_last_months_payments_are_not_this_months_money(self, team, business):
        subscribe(business, 60)
        last_month = billing.platform_today().replace(day=1) - timedelta(days=1)
        billing.register_payment(
            business=business, amount=Decimal("80"), method="yape", months=1, paid_on=last_month, recorded_by=None
        )

        assert get(team, "platform-dashboard").json()["revenue"]["received_this_month"] == 0

    def test_the_businesses_that_need_attention_come_with_the_soonest_first(self, team, business, other_business):
        subscribe(business, 5)
        subscribe(other_business, -2)
        far = Business.objects.create(slug="lejos", name="Lejos")
        subscribe(far, 90)

        attention = get(team, "platform-dashboard").json()["attention"]

        assert [item["slug"] for item in attention] == ["consultorio-lucia", "cancha-los-andes"]
        assert attention[0]["state"] == "grace"
        assert attention[0]["days_left"] == -2
        assert attention[1]["state"] == "active"

    def test_the_busiest_businesses(self, team, business, other_business, make_booking):
        make_booking()

        data = get(team, "platform-dashboard").json()

        assert data["bookings_30d"] == 1
        assert data["busiest"] == [{"slug": "cancha-los-andes", "name": "Cancha Los Andes", "bookings": 1}]

    def test_an_empty_platform_has_all_zeros(self, team):
        data = get(team, "platform-dashboard").json()

        assert data["businesses"]["total"] == 0
        assert data["busiest"] == [] and data["attention"] == []
        assert data["revenue"] == {"received_this_month": 0, "expected_monthly": 0}


class TestOneBusiness:
    def test_shows_the_business_and_its_subscription(self, team, business):
        subscription = subscribe(business, 10)
        subscription.plan_name = "Mensual"
        subscription.notes = "Descuento acordado"
        subscription.save()

        data = team.get(reverse("platform-business", kwargs={"slug": business.slug})).json()

        assert data["name"] == "Cancha Los Andes"
        assert data["subscription"]["plan_name"] == "Mensual"
        assert data["subscription"]["notes"] == "Descuento acordado"
        assert data["standing"]["state"] == "active"
        assert data["timezone"] == "America/Lima"

    def test_a_business_without_a_subscription_has_none(self, team, business):
        data = team.get(reverse("platform-business", kwargs={"slug": business.slug})).json()

        assert data["subscription"] is None

    def test_an_unknown_business_is_not_found(self, team):
        assert team.get(reverse("platform-business", kwargs={"slug": "no-existe"})).status_code == 404

    def test_the_team_can_rename_and_retype_it_and_it_is_logged(self, team, business):
        response = team.patch(
            reverse("platform-business", kwargs={"slug": business.slug}),
            {"name": "Canchas El Sol", "business_type": "generic"},
            format="json",
        )

        assert response.status_code == 200
        business.refresh_from_db()
        assert (business.name, business.business_type) == ("Canchas El Sol", "generic")
        entry = ActivityLog.objects.get()
        assert entry.action == "business.updated"
        assert entry.detail["changes"]["name"] == ["Cancha Los Andes", "Canchas El Sol"]

    def test_the_link_cannot_be_changed(self, team, business):
        team.patch(reverse("platform-business", kwargs={"slug": business.slug}), {"slug": "otro-link"}, format="json")

        business.refresh_from_db()
        assert business.slug == "cancha-los-andes"

    def test_an_invalid_timezone_is_refused(self, team, business):
        response = team.patch(
            reverse("platform-business", kwargs={"slug": business.slug}), {"timezone": "Marte/Olimpo"}, format="json"
        )

        assert response.status_code == 400
        assert "timezone" in response.json()

    def test_changing_nothing_logs_nothing(self, team, business):
        team.patch(reverse("platform-business", kwargs={"slug": business.slug}), {"name": business.name}, format="json")

        assert ActivityLog.objects.count() == 0
