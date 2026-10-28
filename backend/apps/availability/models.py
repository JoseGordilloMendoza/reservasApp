from datetime import time

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F, Q


class AvailabilityRule(models.Model):
    """A weekly opening window for a resource, in the business's local time.

    An `end_time` of 00:00 means midnight at the end of the day, so 18:00-00:00
    is "until midnight" and 00:00-00:00 is "open all day". Hours past midnight
    are a second rule on the next weekday.
    """

    class Weekday(models.IntegerChoices):
        MONDAY = 0, "Monday"
        TUESDAY = 1, "Tuesday"
        WEDNESDAY = 2, "Wednesday"
        THURSDAY = 3, "Thursday"
        FRIDAY = 4, "Friday"
        SATURDAY = 5, "Saturday"
        SUNDAY = 6, "Sunday"

    business = models.ForeignKey(
        "businesses.Business", on_delete=models.CASCADE, related_name="availability_rules"
    )
    resource = models.ForeignKey(
        "catalog.Resource", on_delete=models.CASCADE, related_name="availability_rules"
    )
    weekday = models.PositiveSmallIntegerField(choices=Weekday.choices)
    start_time = models.TimeField()
    end_time = models.TimeField(help_text="00:00 means midnight at the end of the day")

    class Meta:
        ordering = ["resource", "weekday", "start_time"]
        constraints = [
            models.CheckConstraint(
                condition=Q(end_time__gt=F("start_time")) | Q(end_time=time(0, 0)),
                name="availability_rule_valid_window",
            ),
        ]

    def clean(self):
        if self.resource_id and self.business_id and self.resource.business_id != self.business_id:
            raise ValidationError("The resource belongs to a different business.")

    def __str__(self):
        return f"{self.resource} {self.get_weekday_display()} {self.start_time:%H:%M}-{self.end_time:%H:%M}"


class Block(models.Model):
    """A closed period (maintenance, holiday). Without a resource it closes the whole business."""

    business = models.ForeignKey(
        "businesses.Business", on_delete=models.CASCADE, related_name="blocks"
    )
    resource = models.ForeignKey(
        "catalog.Resource",
        on_delete=models.CASCADE,
        related_name="blocks",
        null=True,
        blank=True,
    )
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    reason = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["starts_at"]
        constraints = [
            models.CheckConstraint(
                condition=Q(ends_at__gt=F("starts_at")),
                name="block_ends_after_start",
            ),
        ]

    def clean(self):
        if self.resource_id and self.business_id and self.resource.business_id != self.business_id:
            raise ValidationError("The resource belongs to a different business.")

    def __str__(self):
        return f"{self.resource or self.business} {self.starts_at:%Y-%m-%d %H:%M}"
