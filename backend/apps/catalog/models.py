from django.db import models

from apps.businesses.settings_schema import validate_settings


class Resource(models.Model):
    business = models.ForeignKey(
        "businesses.Business", on_delete=models.CASCADE, related_name="resources"
    )
    name = models.CharField(max_length=120)
    is_active = models.BooleanField(default=True)
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["business", "name"], name="resource_unique_name_per_business"
            ),
        ]

    def __str__(self):
        return self.name


class Service(models.Model):
    business = models.ForeignKey(
        "businesses.Business", on_delete=models.CASCADE, related_name="services"
    )
    resource = models.ForeignKey(
        Resource, on_delete=models.CASCADE, related_name="services"
    )
    name = models.CharField(max_length=120)
    duration_minutes = models.PositiveSmallIntegerField()
    reference_price = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True
    )
    settings = models.JSONField(default=dict, blank=True, validators=[validate_settings])
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(duration_minutes__gt=0),
                name="service_duration_positive",
            ),
        ]

    def __str__(self):
        return f"{self.resource} - {self.name}"
