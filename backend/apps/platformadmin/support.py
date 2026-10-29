"""Letting the platform team work inside one business's panel, on the record (D76)."""

from datetime import timedelta

from django.utils import timezone

from apps.accounts.models import Membership

from . import activity
from .models import SupportSession

SESSION_HOURS = 2


class SupportMembership:
    """Stands in for a Membership while the team is inside a business.

    The panel only needs a role and a business. Support has the same powers as the owner (D76);
    what sets it apart is the open session it carries, which the panel reports to the screen and
    the audit middleware reads.
    """

    role = Membership.Role.OWNER
    is_support = True

    def __init__(self, session):
        self.session = session
        self.user = session.user
        self.business = session.business


def start_session(user, business, reason, now=None):
    now = now or timezone.now()
    session = SupportSession.objects.create(
        user=user, business=business, reason=reason, expires_at=now + timedelta(hours=SESSION_HOURS)
    )
    activity.record(user, activity.SUPPORT_STARTED, business, reason=reason, session=session.pk)
    return session


def open_session(user, business_slug, now=None):
    """The session that lets `user` into the business, or None when there is none to use.

    It must be theirs, for that business, not ended and not expired.
    """
    now = now or timezone.now()
    return (
        SupportSession.objects.filter(
            user=user, business__slug=business_slug, ended_at__isnull=True, expires_at__gt=now
        )
        .select_related("business", "user")
        .first()
    )


def end_session(session, now=None):
    """Close a session. Closing one that already ended changes nothing and logs nothing."""
    if session.ended_at is not None:
        return session
    session.ended_at = now or timezone.now()
    session.save(update_fields=["ended_at"])
    activity.record(session.user, activity.SUPPORT_ENDED, session.business, session=session.pk)
    return session
