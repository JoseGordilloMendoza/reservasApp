import calendar
from dataclasses import dataclass
from datetime import date, timedelta
from zoneinfo import ZoneInfo

from django.db import transaction
from django.utils import timezone

from apps.businesses.models import Business

from .models import Subscription, SubscriptionPayment

# After the paid period ends the business keeps working this many days (D74).
GRACE_DAYS = 5

ACTIVE = "active"
GRACE = "grace"
EXPIRED = "expired"
NONE = "none"


class NoSubscription(Exception):
    """A payment or an adjustment needs a subscription to apply to."""


@dataclass(frozen=True)
class Standing:
    """Where a business stands with its subscription, today.

    state: none (never expires), active, grace (past its date but still working) or expired.
    days_left: days until valid_until, negative once it passed; None without a subscription.
    """

    state: str
    valid_until: date | None = None
    grace_ends_on: date | None = None
    days_left: int | None = None


def business_today(business, now=None):
    """The current date on the business's own calendar, which is the one its dates are in."""
    now = now or timezone.now()
    return now.astimezone(ZoneInfo(business.timezone)).date()


_LOOK_IT_UP = object()


def standing(business, now=None, subscription=_LOOK_IT_UP):
    """Compute the state on the spot, so nothing has to run on a schedule (D74).

    Pass `subscription` (a Subscription, or None for "has none") when it is already at hand, as
    a list of businesses does, to avoid one query per business.
    """
    if subscription is _LOOK_IT_UP:
        subscription = Subscription.objects.filter(business=business).first()
    if subscription is None:
        return Standing(NONE)

    today = business_today(business, now)
    grace_ends_on = subscription.valid_until + timedelta(days=GRACE_DAYS)
    if today <= subscription.valid_until:
        state = ACTIVE
    elif today <= grace_ends_on:
        state = GRACE
    else:
        state = EXPIRED
    return Standing(state, subscription.valid_until, grace_ends_on, (subscription.valid_until - today).days)


def is_operational(business, now=None):
    """Whether the business shows its page and takes new bookings (RN-18).

    Suspended by hand, or with the subscription past its grace days, it does not.
    """
    if business.status != Business.Status.ACTIVE:
        return False
    return standing(business, now).state != EXPIRED


def add_months(day, months):
    """The same day number some months later, or the month's last day when it has no such day."""
    index = day.month - 1 + months
    year, month = day.year + index // 12, index % 12 + 1
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


def start_subscription(*, business, price, valid_until, plan_name="", started_on=None, notes="", now=None):
    """Give a business its subscription. `valid_until` is the last covered day, trial or paid."""
    return Subscription.objects.create(
        business=business,
        plan_name=plan_name,
        price=price,
        started_on=started_on or business_today(business, now),
        valid_until=valid_until,
        notes=notes,
    )


@transaction.atomic
def register_payment(*, business, amount, method, months, paid_on, recorded_by, reference="", note=""):
    """Record a payment and move the subscription's end forward by the months it bought.

    If the business is still covered, the new months follow the current end; if it had lapsed,
    they start on the day it paid. Payments are never edited: a mistake is fixed by adjusting the
    validity, which is logged.
    """
    subscription = Subscription.objects.select_for_update().filter(business=business).first()
    if subscription is None:
        raise NoSubscription()

    start = subscription.valid_until + timedelta(days=1) if subscription.valid_until >= paid_on else paid_on
    end = add_months(start, months) - timedelta(days=1)

    payment = SubscriptionPayment.objects.create(
        business=business,
        amount=amount,
        method=method,
        paid_on=paid_on,
        months=months,
        period_start=start,
        period_end=end,
        reference=reference,
        note=note,
        recorded_by=recorded_by,
    )
    subscription.valid_until = end
    subscription.save(update_fields=["valid_until", "updated_at"])
    return payment
