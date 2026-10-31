from django.db import models


class Customer(models.Model):
    business = models.ForeignKey(
        "businesses.Business", on_delete=models.CASCADE, related_name="customers"
    )
    name = models.CharField(max_length=120)
    phone = models.CharField(max_length=20, help_text="International format, e.g. +51987654321")
    email = models.EmailField(blank=True)
    is_blocked = models.BooleanField(default=False)
    # Set the first time the person proves who they are with Google while booking here. From then on
    # this number is trusted only when they prove it again (see trust.py).
    google_sub = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["business", "phone"], name="customer_unique_phone_per_business"
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.phone})"
