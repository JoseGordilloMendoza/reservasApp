from .models import ActivityLog

# Every action the team can take, so the log has a fixed vocabulary.
BUSINESS_CREATED = "business.created"
BUSINESS_UPDATED = "business.updated"
BUSINESS_SUSPENDED = "business.suspended"
BUSINESS_REACTIVATED = "business.reactivated"
SUBSCRIPTION_SET = "subscription.set"
SUBSCRIPTION_ADJUSTED = "subscription.adjusted"
PAYMENT_RECORDED = "payment.recorded"
USER_ADDED = "user.added"
USER_ROLE_CHANGED = "user.role_changed"
USER_REMOVED = "user.removed"
USER_LINK_SENT = "user.link_sent"
SUPPORT_STARTED = "support.started"
SUPPORT_ENDED = "support.ended"
SUPPORT_ACTION = "support.action"


def record(actor, action, business=None, **detail):
    """Write one line of the log. Values in `detail` must be JSON friendly."""
    return ActivityLog.objects.create(
        actor=actor,
        actor_email=actor.email if actor else "",
        business=business,
        business_slug=business.slug if business else "",
        action=action,
        detail=detail,
    )
