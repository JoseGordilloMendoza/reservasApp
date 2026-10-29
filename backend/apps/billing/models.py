from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Subscription(models.Model):
    """What a business has agreed to pay and until when it is covered.

    A business without a subscription never expires: it is managed by hand (see billing.services).
    """

    business = models.OneToOneField(
        "businesses.Business", on_delete=models.CASCADE, related_name="subscription"
    )
    plan_name = models.CharField(max_length=60, blank=True)
    # Agreed with each business, per month, in soles.
    price = models.DecimalField(max_digits=8, decimal_places=2, validators=[MinValueValidator(0)])
    started_on = models.DateField()
    # Last day covered (inclusive), in the business's own calendar.
    valid_until = models.DateField()
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.business} until {self.valid_until}"


class SubscriptionPayment(models.Model):
    """A payment received outside the platform (Yape, Plin, transfer, cash). Never edited."""

    class Method(models.TextChoices):
        YAPE = "yape", "Yape"
        PLIN = "plin", "Plin"
        TRANSFER = "transfer", "Transfer"
        CASH = "cash", "Cash"
        OTHER = "other", "Other"

    business = models.ForeignKey(
        "businesses.Business", on_delete=models.CASCADE, related_name="payments"
    )
    amount = models.DecimalField(max_digits=8, decimal_places=2, validators=[MinValueValidator(0)])
    method = models.CharField(max_length=20, choices=Method.choices)
    paid_on = models.DateField()
    months = models.PositiveSmallIntegerField(
        default=1, validators=[MinValueValidator(1), MaxValueValidator(24)]
    )
    # The stretch of time this payment bought, worked out when it was recorded.
    period_start = models.DateField()
    period_end = models.DateField()
    reference = models.CharField(max_length=80, blank=True)
    note = models.CharField(max_length=200, blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-paid_on", "-id"]

    def __str__(self):
        return f"{self.business} {self.amount} on {self.paid_on}"
