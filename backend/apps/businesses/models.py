from django.db import models


class Business(models.Model):
    class BusinessType(models.TextChoices):
        GENERIC = "generic", "Generic"
        COURT = "court", "Court"
        PSYCHOLOGIST = "psychologist", "Psychologist"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"

    slug = models.SlugField(max_length=63, unique=True)
    name = models.CharField(max_length=120)
    business_type = models.CharField(
        max_length=20, choices=BusinessType.choices, default=BusinessType.GENERIC
    )
    timezone = models.CharField(max_length=64, default="America/Lima")
    settings = models.JSONField(default=dict, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.ACTIVE
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "businesses"

    def __str__(self):
        return self.name
