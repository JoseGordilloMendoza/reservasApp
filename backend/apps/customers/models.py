from django.db import models


class Customer(models.Model):
    business = models.ForeignKey(
        "businesses.Business", on_delete=models.CASCADE, related_name="customers"
    )
    name = models.CharField(max_length=120)
    phone = models.CharField(max_length=20, help_text="International format, e.g. +51987654321")
    email = models.EmailField(blank=True)
    is_blocked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["business", "phone"], name="customer_unique_phone_per_business"
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.phone})"
