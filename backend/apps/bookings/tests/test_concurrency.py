import threading

import pytest
from django.db import connections

from apps.bookings import services
from apps.bookings.models import Booking

from .helpers import MON, NOW, at, configure, open_mondays

pytestmark = pytest.mark.django_db(transaction=True)


def run_together(jobs):
    """Run callables at the same moment, each on its own database connection."""
    barrier = threading.Barrier(len(jobs))
    results = [None] * len(jobs)

    def worker(index, job):
        try:
            barrier.wait()
            results[index] = job()
        except Exception as error:  # the outcome is what the test inspects
            results[index] = error
        finally:
            connections.close_all()

    threads = [threading.Thread(target=worker, args=(i, job)) for i, job in enumerate(jobs)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    return results


def booking_job(business, service, starts_at, phone):
    return lambda: services.create_booking(
        business=business,
        service=service,
        starts_at=starts_at,
        customer_name="Cliente",
        customer_phone=phone,
        now=NOW,
    )


def test_simultaneous_requests_for_one_slot_produce_exactly_one_booking(business, resource, service):
    open_mondays(business, resource)
    jobs = [
        booking_job(business, service, at(MON, 19), f"98765432{i}") for i in range(8)
    ]

    results = run_together(jobs)

    winners = [r for r in results if isinstance(r, tuple)]
    losers = [r for r in results if isinstance(r, services.SlotUnavailable)]
    assert len(winners) == 1
    assert len(losers) == 7
    assert Booking.objects.count() == 1


def test_simultaneous_requests_for_different_slots_all_succeed(business, resource, service):
    open_mondays(business, resource)
    jobs = [
        booking_job(business, service, at(MON, hour), f"98765432{index}")
        for index, hour in enumerate((18, 19, 20, 21))
    ]

    results = run_together(jobs)

    assert all(isinstance(r, tuple) for r in results), results
    assert Booking.objects.count() == 4


def test_buffer_holds_when_neighbouring_slots_are_requested_together(business, resource, service):
    open_mondays(business, resource)
    configure(business, buffer_minutes=10)
    jobs = [
        booking_job(business, service, at(MON, 19), "987654321"),
        booking_job(business, service, at(MON, 20), "912345678"),
    ]

    results = run_together(jobs)

    assert sum(isinstance(r, tuple) for r in results) == 1
    assert sum(isinstance(r, services.SlotUnavailable) for r in results) == 1


def test_one_customer_cannot_exceed_the_cap_with_parallel_requests(business, resource, service):
    open_mondays(business, resource)
    configure(business, max_active_bookings_per_customer=2)
    jobs = [booking_job(business, service, at(MON, hour), "987654321") for hour in (18, 19, 20, 21)]

    results = run_together(jobs)

    assert sum(isinstance(r, tuple) for r in results) == 2
    assert sum(isinstance(r, services.TooManyActiveBookings) for r in results) == 2
