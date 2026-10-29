from django.conf import settings
from django.db import models


class ActivityLog(models.Model):
    """What the platform team did, and to which business. Append only.

    The email and the slug are copied in, so the entry still reads after a user or a business
    is deleted.
    """

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )
    actor_email = models.EmailField()
    business = models.ForeignKey(
        "businesses.Business", null=True, on_delete=models.SET_NULL, related_name="+"
    )
    business_slug = models.CharField(max_length=63, blank=True)
    action = models.CharField(max_length=60)
    detail = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["business_slug", "-created_at"], name="activity_business_idx")]

    def __str__(self):
        return f"{self.actor_email} {self.action} {self.business_slug}"


class SupportSession(models.Model):
    """Permission for a member of the platform team to work inside one business's panel.

    It has a reason, lasts a couple of hours and can be ended early. Without an open one, the
    team has no access to a business's panel.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="support_sessions"
    )
    business = models.ForeignKey(
        "businesses.Business", on_delete=models.CASCADE, related_name="support_sessions"
    )
    reason = models.CharField(max_length=200)
    started_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.user} in {self.business}"
