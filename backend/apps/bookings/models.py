from django.contrib.postgres.constraints import ExclusionConstraint
from django.contrib.postgres.fields import DateTimeRangeField, RangeBoundary, RangeOperators
from django.db import models
from django.db.models import F, Func, Q


class BookingStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    CONFIRMED = "confirmed", "Confirmed"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"
    EXPIRED = "expired", "Expired"
    NO_SHOW = "no_show", "No show"


# Only these statuses give the slot back to the resource.
SLOT_RELEASING_STATUSES = (BookingStatus.CANCELLED, BookingStatus.EXPIRED)


# Statuses of a booking the customer still intends to attend.
ACTIVE_STATUSES = (BookingStatus.PENDING, BookingStatus.CONFIRMED)


class TsTzRange(Func):
    function = "TSTZRANGE"
    output_field = DateTimeRangeField()


class Booking(models.Model):
    class Source(models.TextChoices):
        CUSTOMER = "customer", "Customer"
        BUSINESS = "business", "Business"

    business = models.ForeignKey(
        "businesses.Business", on_delete=models.CASCADE, related_name="bookings"
    )
    resource = models.ForeignKey(
        "catalog.Resource", on_delete=models.RESTRICT, related_name="bookings"
    )
    service = models.ForeignKey(
        "catalog.Service", on_delete=models.RESTRICT, related_name="bookings"
    )
    customer = models.ForeignKey(
        "customers.Customer", on_delete=models.RESTRICT, related_name="bookings"
    )
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    status = models.CharField(
        max_length=20, choices=BookingStatus.choices, default=BookingStatus.PENDING
    )
    expires_at = models.DateTimeField(null=True, blank=True)
    price_snapshot = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True
    )
    duration_snapshot = models.PositiveSmallIntegerField()
    source = models.CharField(
        max_length=20, choices=Source.choices, default=Source.CUSTOMER
    )
    series_id = models.UUIDField(null=True, blank=True)
    manage_token_hash = models.CharField(max_length=64, null=True, blank=True, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["starts_at"]
        indexes = [
            models.Index(fields=["business", "starts_at"], name="booking_business_start_idx"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(ends_at__gt=F("starts_at")),
                name="booking_ends_after_start",
            ),
            ExclusionConstraint(
                name="booking_no_overlap",
                expressions=[
                    (TsTzRange("starts_at", "ends_at", RangeBoundary()), RangeOperators.OVERLAPS),
                    ("resource", RangeOperators.EQUAL),
                ],
                condition=~Q(status__in=SLOT_RELEASING_STATUSES),
            ),
        ]

    def __str__(self):
        return f"{self.resource} {self.starts_at:%Y-%m-%d %H:%M} ({self.status})"


class BookingEvent(models.Model):
    """One row per status change, so a booking's history can be reconstructed."""

    class Actor(models.TextChoices):
        CUSTOMER = "customer", "Customer"
        BUSINESS = "business", "Business"
        SYSTEM = "system", "System"

    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="events")
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20, choices=BookingStatus.choices)
    actor = models.CharField(max_length=20, choices=Actor.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"{self.booking_id}: {self.from_status or '-'} -> {self.to_status} ({self.actor})"
