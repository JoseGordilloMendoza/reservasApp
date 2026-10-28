from django.db import models

from .presets import preset_settings
from .settings_schema import validate_settings
from .validators import validate_slug_not_reserved


class Business(models.Model):
    class BusinessType(models.TextChoices):
        GENERIC = "generic", "Generic"
        COURT = "court", "Court"
        PSYCHOLOGIST = "psychologist", "Psychologist"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"

    slug = models.SlugField(max_length=63, unique=True, validators=[validate_slug_not_reserved])
    name = models.CharField(max_length=120)
    # Public page. Phone numbers are stored in international format (+51987654321).
    description = models.TextField(blank=True)
    address = models.CharField(max_length=200, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    whatsapp = models.CharField(max_length=20, blank=True)
    business_type = models.CharField(
        max_length=20, choices=BusinessType.choices, default=BusinessType.GENERIC
    )
    timezone = models.CharField(max_length=64, default="America/Lima")
    settings = models.JSONField(default=dict, blank=True, validators=[validate_settings])
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.ACTIVE
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "businesses"

    def save(self, *args, **kwargs):
        # A new business starts from its type's preset unless settings were given.
        if self._state.adding and not self.settings:
            self.settings = preset_settings(self.business_type)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name
