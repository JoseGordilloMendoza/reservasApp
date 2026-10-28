from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from apps.availability.models import AvailabilityRule, Block
from apps.availability.slots import (
    MAX_RANGE_DAYS,
    build_slots,
    get_available_slots,
    merge_intervals,
)
from apps.bookings.models import BookingStatus
from apps.businesses.models import Business
from apps.catalog.models import Service

LIMA = ZoneInfo("America/Lima")
UTC = timezone.utc

MON = date(2030, 1, 7)
TUE = date(2030, 1, 8)
WED = date(2030, 1, 9)
NOW = datetime(2030, 1, 1, 12, 0, tzinfo=UTC)


def at(day, hour, minute=0, tz=LIMA):
    return datetime.combine(day, time(hour, minute), tzinfo=tz).astimezone(UTC)


def local_times(slots):
    return [slot.starts_at.astimezone(LIMA).strftime("%H:%M") for slot in slots]


@pytest.fixture
def make_rule(business, resource):
    def _make(weekday=0, start=time(18), end=time(22), **overrides):
        fields = {
            "business": business,
            "resource": resource,
            "weekday": weekday,
            "start_time": start,
            "end_time": end,
        }
        fields.update(overrides)
        return AvailabilityRule.objects.create(**fields)

    return _make


@pytest.fixture
def make_block(business, resource):
    def _make(starts_at, ends_at, **overrides):
        fields = {
            "business": business,
            "resource": resource,
            "starts_at": starts_at,
            "ends_at": ends_at,
        }
        fields.update(overrides)
        return Block.objects.create(**fields)

    return _make


@pytest.fixture
def slots_for(resource, service):
    def _slots(from_date=MON, to_date=None, now=NOW):
        return get_available_slots(resource, service, from_date, to_date, now=now)

    return _slots


def configure(business, **settings):
    business.settings = {**business.settings, **settings}
    business.save()


# --- pure helpers ---------------------------------------------------------


def test_merge_intervals_joins_overlapping_and_touching():
    merged = merge_intervals([(5, 8), (1, 3), (3, 4), (7, 10)])

    assert merged == [(1, 4), (5, 10)]


def test_merge_intervals_keeps_gaps():
    assert merge_intervals([(1, 2), (3, 4)]) == [(1, 2), (3, 4)]


def test_build_slots_with_no_windows_is_empty():
    assert (
        build_slots(
            windows=[],
            bookings=[],
            blocks=[],
            duration=timedelta(hours=1),
            interval=timedelta(hours=1),
            buffer=timedelta(0),
            start_from=NOW,
            start_before=NOW + timedelta(days=1),
        )
        == []
    )


# --- opening hours --------------------------------------------------------


def test_slots_follow_the_weekly_schedule(make_rule, slots_for):
    make_rule(weekday=0, start=time(18), end=time(22))

    assert local_times(slots_for(MON)) == ["18:00", "19:00", "20:00", "21:00"]
    assert slots_for(TUE) == []


def test_slots_are_returned_in_utc(make_rule, slots_for):
    make_rule()

    first = slots_for(MON)[0]

    assert first.starts_at == datetime(2030, 1, 7, 23, 0, tzinfo=UTC)
    assert first.ends_at == datetime(2030, 1, 8, 0, 0, tzinfo=UTC)


def test_shorter_interval_gives_more_start_times(business, make_rule, slots_for):
    make_rule()
    configure(business, slot_interval_minutes=30)

    # 21:30 is missing on purpose: a 60-minute slot would end at 22:30, after closing.
    assert local_times(slots_for(MON)) == [
        "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00",
    ]


def test_slot_must_fit_inside_the_window(service, make_rule, slots_for):
    make_rule()
    service.duration_minutes = 90
    service.save()

    assert local_times(slots_for(MON)) == ["18:00", "19:00", "20:00"]


def test_grid_starts_at_the_window_start(make_rule, slots_for):
    make_rule(start=time(18, 30), end=time(21, 30))

    assert local_times(slots_for(MON)) == ["18:30", "19:30", "20:30"]


def test_overlapping_rules_do_not_duplicate_slots(make_rule, slots_for):
    make_rule(start=time(18), end=time(22))
    make_rule(start=time(20), end=time(23))

    assert local_times(slots_for(MON)) == ["18:00", "19:00", "20:00", "21:00", "22:00"]


def test_split_day_has_a_gap_between_windows(make_rule, slots_for):
    make_rule(start=time(8), end=time(10))
    make_rule(start=time(15), end=time(17))

    assert local_times(slots_for(MON)) == ["08:00", "09:00", "15:00", "16:00"]


def test_range_returns_each_day_in_order(make_rule, slots_for):
    make_rule(weekday=0, start=time(18), end=time(20))
    make_rule(weekday=1, start=time(18), end=time(20))

    slots = slots_for(MON, TUE)

    assert [slot.starts_at for slot in slots] == [
        at(MON, 18), at(MON, 19), at(TUE, 18), at(TUE, 19),
    ]


def test_open_all_day_rule(make_rule, slots_for):
    make_rule(start=time(0), end=time(0))

    assert len(slots_for(MON)) == 24


# --- crossing midnight ----------------------------------------------------


def test_hours_past_midnight_belong_to_the_next_day(make_rule, slots_for):
    make_rule(weekday=0, start=time(22), end=time(0))
    make_rule(weekday=1, start=time(0), end=time(2))

    assert local_times(slots_for(MON)) == ["22:00", "23:00"]
    assert local_times(slots_for(TUE)) == ["00:00", "01:00"]


def test_slot_can_span_two_touching_windows(service, make_rule, slots_for):
    make_rule(weekday=0, start=time(22), end=time(0))
    make_rule(weekday=1, start=time(0), end=time(2))
    service.duration_minutes = 120
    service.save()

    assert local_times(slots_for(MON)) == ["22:00", "23:00"]
    assert local_times(slots_for(TUE)) == ["00:00"]


def test_daylight_saving_day_uses_real_elapsed_time(business, make_rule, slots_for):
    # 2030-03-10: clocks in New York jump from 02:00 to 03:00, so 00:00-06:00 is 5 hours.
    business.timezone = "America/New_York"
    business.save()
    configure(business, booking_horizon_days=365)
    make_rule(weekday=6, start=time(0), end=time(6))

    slots = slots_for(date(2030, 3, 10))

    assert [slot.starts_at for slot in slots] == [
        datetime(2030, 3, 10, hour, 0, tzinfo=UTC) for hour in (5, 6, 7, 8, 9)
    ]


# --- bookings -------------------------------------------------------------


def test_a_booking_removes_only_its_own_slot(make_rule, make_booking, slots_for):
    make_rule()
    make_booking(starts_at=at(MON, 19), status=BookingStatus.CONFIRMED)

    assert local_times(slots_for(MON)) == ["18:00", "20:00", "21:00"]


def test_buffer_keeps_free_time_around_bookings(business, make_rule, make_booking, slots_for):
    make_rule()
    configure(business, buffer_minutes=10)
    make_booking(starts_at=at(MON, 19), status=BookingStatus.CONFIRMED)

    assert local_times(slots_for(MON)) == ["21:00"]


@pytest.mark.parametrize("status", [BookingStatus.CANCELLED, BookingStatus.EXPIRED])
def test_released_bookings_do_not_block(make_rule, make_booking, slots_for, status):
    make_rule()
    make_booking(starts_at=at(MON, 19), status=status)

    assert "19:00" in local_times(slots_for(MON))


@pytest.mark.parametrize(
    "status", [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.COMPLETED]
)
def test_active_bookings_block(make_rule, make_booking, slots_for, status):
    make_rule()
    make_booking(starts_at=at(MON, 19), status=status)

    assert "19:00" not in local_times(slots_for(MON))


def test_pending_booking_past_its_expiry_does_not_block(make_rule, make_booking, slots_for):
    make_rule()
    make_booking(
        starts_at=at(MON, 19),
        status=BookingStatus.PENDING,
        expires_at=NOW - timedelta(hours=1),
    )

    assert "19:00" in local_times(slots_for(MON))


def test_pending_booking_before_its_expiry_blocks(make_rule, make_booking, slots_for):
    make_rule()
    make_booking(
        starts_at=at(MON, 19),
        status=BookingStatus.PENDING,
        expires_at=NOW + timedelta(hours=1),
    )

    assert "19:00" not in local_times(slots_for(MON))


def test_confirmed_booking_with_old_expiry_still_blocks(make_rule, make_booking, slots_for):
    make_rule()
    make_booking(
        starts_at=at(MON, 19),
        status=BookingStatus.CONFIRMED,
        expires_at=NOW - timedelta(hours=1),
    )

    assert "19:00" not in local_times(slots_for(MON))


def test_booking_on_another_resource_does_not_block(
    business, other_resource, make_rule, make_booking, slots_for
):
    make_rule()
    make_booking(starts_at=at(MON, 19), resource=other_resource)

    assert "19:00" in local_times(slots_for(MON))


# --- blocks ---------------------------------------------------------------


def test_block_closes_its_period(make_rule, make_block, slots_for):
    make_rule()
    make_block(at(MON, 19), at(MON, 21))

    assert local_times(slots_for(MON)) == ["18:00", "21:00"]


def test_business_wide_block_applies_to_every_resource(make_rule, make_block, slots_for):
    make_rule()
    make_block(at(MON, 0), at(TUE, 0), resource=None)

    assert slots_for(MON) == []


def test_block_on_another_resource_is_ignored(make_rule, make_block, other_resource, slots_for):
    make_rule()
    make_block(at(MON, 0), at(TUE, 0), resource=other_resource)

    assert len(slots_for(MON)) == 4


def test_buffer_does_not_apply_around_blocks(business, make_rule, make_block, slots_for):
    make_rule()
    configure(business, buffer_minutes=10)
    make_block(at(MON, 19), at(MON, 20))

    assert local_times(slots_for(MON)) == ["18:00", "20:00", "21:00"]


# --- notice and horizon ---------------------------------------------------


def test_minimum_notice_hides_slots_that_start_too_soon(make_rule, slots_for):
    make_rule()

    slots = slots_for(MON, now=at(MON, 17, 30))

    assert local_times(slots) == ["19:00", "20:00", "21:00"]


def test_past_slots_are_not_offered(make_rule, slots_for):
    make_rule()

    assert slots_for(MON, now=at(MON, 23)) == []


def test_horizon_limits_how_far_ahead_slots_are_offered(business, make_rule, slots_for):
    for weekday in (0, 1, 2):
        make_rule(weekday=weekday, start=time(18), end=time(20))
    configure(business, booking_horizon_days=1)

    slots = slots_for(MON, WED, now=at(MON, 8))

    assert [slot.starts_at for slot in slots] == [
        at(MON, 18), at(MON, 19), at(TUE, 18), at(TUE, 19),
    ]


def test_service_settings_override_the_business(service, make_rule, slots_for):
    make_rule()
    service.settings = {"slot_interval_minutes": 120}
    service.save()

    assert local_times(slots_for(MON)) == ["18:00", "20:00"]


# --- nothing offered ------------------------------------------------------


def test_inactive_resource_has_no_slots(resource, make_rule, slots_for):
    make_rule()
    resource.is_active = False
    resource.save()

    assert slots_for(MON) == []


def test_inactive_service_has_no_slots(service, make_rule, slots_for):
    make_rule()
    service.is_active = False
    service.save()

    assert slots_for(MON) == []


def test_suspended_business_has_no_slots(business, make_rule, slots_for):
    make_rule()
    business.status = Business.Status.SUSPENDED
    business.save()

    assert slots_for(MON) == []


# --- invalid requests -----------------------------------------------------


def test_service_of_another_resource_is_rejected(business, resource, other_resource):
    foreign_service = Service.objects.create(
        business=business, resource=other_resource, name="Other", duration_minutes=60
    )

    with pytest.raises(ValueError):
        get_available_slots(resource, foreign_service, MON, now=NOW)


def test_reversed_range_is_rejected(slots_for):
    with pytest.raises(ValueError):
        slots_for(TUE, MON)


def test_overlong_range_is_rejected(slots_for):
    with pytest.raises(ValueError):
        slots_for(MON, MON + timedelta(days=MAX_RANGE_DAYS))
