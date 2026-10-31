from django.db import models

from .presets import preset_settings
from .search import normalize_for_search
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

    class Accent(models.TextChoices):
        """Color the business's public page is built around. The frontend defines the shades."""

        POPPY = "poppy", "Poppy"
        TANGERINE = "tangerine", "Tangerine"
        SUNFLOWER = "sunflower", "Sunflower"
        MINT = "mint", "Mint"
        SKY = "sky", "Sky"
        ROSE = "rose", "Rose"

    slug = models.SlugField(max_length=63, unique=True, validators=[validate_slug_not_reserved])
    name = models.CharField(max_length=120)
    # Public page. Phone numbers are stored in international format (+51987654321).
    description = models.TextField(blank=True)
    address = models.CharField(max_length=200, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    whatsapp = models.CharField(max_length=20, blank=True)
    accent = models.CharField(max_length=20, choices=Accent.choices, default=Accent.POPPY)
    business_type = models.CharField(
        max_length=20, choices=BusinessType.choices, default=BusinessType.GENERIC
    )
    timezone = models.CharField(max_length=64, default="America/Lima")
    settings = models.JSONField(default=dict, blank=True, validators=[validate_settings])
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.ACTIVE
    )
    # Whether the home page may show it, in the search and in the directory. On unless its owner turns it off.
    listed = models.BooleanField(default=True)
    # How a customer pays this business (a Yape number, an account). Shown on the booking, never used by the platform.
    payment_instructions = models.CharField(max_length=300, blank=True)
    # The name as the search compares it: lowercase, no accents. Kept up to date by save().
    search_name = models.CharField(max_length=120, blank=True, editable=False, db_index=True)
    # Why and when the platform team suspended it; cleared on reactivation.
    suspended_reason = models.CharField(max_length=200, blank=True)
    suspended_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "businesses"

    def save(self, *args, **kwargs):
        # A new business starts from its type's preset unless settings were given.
        if self._state.adding and not self.settings:
            self.settings = preset_settings(self.business_type)

        self.search_name = normalize_for_search(self.name)
        # A save that names its fields must carry the search name along when the name is among them.
        fields = kwargs.get("update_fields")
        if fields is not None and "name" in fields:
            kwargs["update_fields"] = {*fields, "search_name"}
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name
