import pytest
from django.utils import timezone

from apps.bookings.tests.helpers import NOW


@pytest.fixture(autouse=True)
def frozen_now(monkeypatch):
    """The views read the clock themselves, so pin it to a known moment."""
    monkeypatch.setattr(timezone, "now", lambda: NOW)
