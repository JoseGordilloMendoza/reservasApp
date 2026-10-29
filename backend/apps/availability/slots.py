from dataclasses import dataclass
from datetime import datetime, time, timedelta
from datetime import timezone as dt_timezone
from zoneinfo import ZoneInfo

from django.db.models import Q
from django.utils import timezone

from apps.billing.services import is_operational
from apps.bookings.models import SLOT_RELEASING_STATUSES, Booking, BookingStatus
from apps.businesses.settings_schema import effective_settings

from .models import AvailabilityRule, Block

MAX_RANGE_DAYS = 62
UTC = dt_timezone.utc


@dataclass(frozen=True, order=True)
class Slot:
    starts_at: datetime
    ends_at: datetime


def merge_intervals(intervals):
    """Join overlapping or touching (start, end) pairs."""
    merged = []
    for start, end in sorted(intervals):
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged


def build_slots(
    *, windows, bookings, blocks, duration, interval, buffer, start_from, start_before
):
    """Pure slot calculation; every datetime is timezone-aware.

    Candidate starts follow the grid of each opening window (start, start + interval,
    ...). A slot may span touching windows, so 22:00-00:00 plus 00:00-02:00 admits a
    23:00-01:00 slot. `buffer` keeps free time around bookings but not around blocks.
    """
    merged = merge_intervals(windows)
    seen = set()
    slots = []

    for window_start, window_end in windows:
        start = window_start
        while start < window_end and start < start_before:
            if start >= start_from and start not in seen:
                seen.add(start)
                end = start + duration
                if _fits(merged, start, end) and not _conflicts(
                    start, end, bookings, blocks, buffer
                ):
                    slots.append(Slot(start, end))
            start += interval

    return sorted(slots)


def _fits(merged_windows, start, end):
    return any(w_start <= start and end <= w_end for w_start, w_end in merged_windows)


def _conflicts(start, end, bookings, blocks, buffer):
    for b_start, b_end in bookings:
        if start - buffer < b_end and end + buffer > b_start:
            return True
    for b_start, b_end in blocks:
        if start < b_end and end > b_start:
            return True
    return False


def _local_midnight(day, tz):
    return datetime.combine(day, time.min, tzinfo=tz).astimezone(UTC)


def _rule_window(day, rule, tz):
    start = datetime.combine(day, rule.start_time, tzinfo=tz).astimezone(UTC)
    if rule.end_time == time.min:
        end = _local_midnight(day + timedelta(days=1), tz)
    else:
        end = datetime.combine(day, rule.end_time, tzinfo=tz).astimezone(UTC)
    return start, end


def get_available_slots(resource, service, from_date, to_date=None, *, now=None):
    """Free slots for a service on a resource between two local dates, inclusive.

    Dates are in the business's timezone; returned datetimes are UTC.
    """
    to_date = to_date or from_date
    if to_date < from_date:
        raise ValueError("to_date must not be before from_date")
    if (to_date - from_date).days + 1 > MAX_RANGE_DAYS:
        raise ValueError(f"The range cannot exceed {MAX_RANGE_DAYS} days")
    if service.resource_id != resource.id:
        raise ValueError("The service does not belong to the resource")

    business = resource.business
    now = now or timezone.now()
    # Suspended, or with the subscription past its grace days: nothing to book (RN-18).
    if not is_operational(business, now) or not resource.is_active or not service.is_active:
        return []

    config = effective_settings(business, service)
    tz = ZoneInfo(business.timezone)

    local_today = now.astimezone(tz).date()
    start_from = max(
        _local_midnight(from_date, tz),
        now + timedelta(minutes=config["min_booking_notice_minutes"]),
    )
    start_before = min(
        _local_midnight(to_date + timedelta(days=1), tz),
        _local_midnight(local_today + timedelta(days=config["booking_horizon_days"] + 1), tz),
    )
    if start_from >= start_before:
        return []

    windows = _opening_windows(resource, from_date, to_date, tz)
    if not windows:
        return []

    buffer = timedelta(minutes=config["buffer_minutes"])
    range_start = min(w_start for w_start, _ in windows) - buffer
    range_end = max(w_end for _, w_end in windows) + buffer

    return build_slots(
        windows=windows,
        bookings=_busy_bookings(resource, range_start, range_end, now),
        blocks=_blocks(business, resource, range_start, range_end),
        duration=timedelta(minutes=service.duration_minutes),
        interval=timedelta(minutes=config["slot_interval_minutes"]),
        buffer=buffer,
        start_from=start_from,
        start_before=start_before,
    )


def _opening_windows(resource, from_date, to_date, tz):
    # One day of margin on each side so windows that cross midnight are complete.
    first_day = from_date - timedelta(days=1)
    last_day = to_date + timedelta(days=1)
    rules_by_weekday = {}
    for rule in AvailabilityRule.objects.filter(resource=resource):
        rules_by_weekday.setdefault(rule.weekday, []).append(rule)

    windows = []
    day = first_day
    while day <= last_day:
        for rule in rules_by_weekday.get(day.weekday(), []):
            windows.append(_rule_window(day, rule, tz))
        day += timedelta(days=1)
    return windows


def _busy_bookings(resource, range_start, range_end, now):
    bookings = (
        Booking.objects.filter(
            resource=resource, starts_at__lt=range_end, ends_at__gt=range_start
        )
        .exclude(status__in=SLOT_RELEASING_STATUSES)
        # A pending booking past its expiry no longer holds the slot, even if
        # nothing has marked it as expired yet.
        .exclude(status=BookingStatus.PENDING, expires_at__lte=now)
    )
    return list(bookings.values_list("starts_at", "ends_at"))


def _blocks(business, resource, range_start, range_end):
    blocks = Block.objects.filter(
        Q(resource=resource) | Q(resource__isnull=True),
        business=business,
        starts_at__lt=range_end,
        ends_at__gt=range_start,
    )
    return list(blocks.values_list("starts_at", "ends_at"))
