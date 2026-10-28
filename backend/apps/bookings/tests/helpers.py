from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

from apps.availability.models import AvailabilityRule

LIMA = ZoneInfo("America/Lima")
UTC = timezone.utc

MON = date(2030, 1, 7)
TUE = date(2030, 1, 8)
NOW = datetime(2030, 1, 1, 12, 0, tzinfo=UTC)


def at(day, hour, minute=0):
    """A local (Lima) wall-clock time as an aware UTC datetime."""
    return datetime.combine(day, time(hour, minute), tzinfo=LIMA).astimezone(UTC)


def open_mondays(business, resource, start=time(18), end=time(22)):
    return AvailabilityRule.objects.create(
        business=business, resource=resource, weekday=0, start_time=start, end_time=end
    )


def configure(business, **settings):
    business.settings = {**business.settings, **settings}
    business.save()
