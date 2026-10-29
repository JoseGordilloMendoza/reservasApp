from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils.text import slugify

from apps.accounts.models import Membership
from apps.accounts.password_reset import reset_link
from apps.billing import services as billing
from apps.businesses.models import Business
from apps.businesses.validators import RESERVED_SLUGS
from apps.notifications import messages
from apps.notifications.mail import send_email

from . import activity

User = get_user_model()

SLUG_MAX = 63


class SlugTaken(Exception):
    """The requested link is already used, or reserved."""


def unique_slug(name):
    """A free link made from the name: 'Canchas Los Andes' -> 'canchas-los-andes', then '-2', '-3'."""
    base = (slugify(name) or "negocio")[: SLUG_MAX - 4]
    candidate, number = base, 1
    while candidate in RESERVED_SLUGS or Business.objects.filter(slug=candidate).exists():
        number += 1
        candidate = f"{base}-{number}"
    return candidate


def _notify_after_commit(function, *args):
    def send_notice():
        function(*args)

    transaction.on_commit(send_notice, robust=True)


def send_access_email(user, business):
    """Let someone into a business: a link to choose a password if they never signed in, otherwise
    a reminder of where to sign in. Never raises (see send_email)."""
    if user.has_usable_password() or user.last_login is not None:
        subject, body = messages.user_added(user, business)
    else:
        subject, body = messages.owner_welcome(user, business, reset_link(user))
    send_email([user.email], subject, body, event="access_email")


def add_member(*, actor, business, email, first_name="", last_name="", role=Membership.Role.STAFF):
    """Give someone a place in the business, creating their account when they have none.

    A new account has no password: the access email lets them choose one. An existing account
    keeps everything it had. Returns (membership, account_created).
    """
    email = User.objects.normalize_email(email)
    with transaction.atomic():
        user = User.objects.filter(email=email).first()
        created = user is None
        if created:
            user = User.objects.create_user(email, None, first_name=first_name, last_name=last_name)
        membership, _ = Membership.objects.get_or_create(user=user, business=business, defaults={"role": role})
        activity.record(actor, activity.USER_ADDED, business, email=email, role=membership.role, account_created=created)
        _notify_after_commit(send_access_email, user, business)
    return membership, created


def create_business(*, actor, name, owner, subscription, slug=None, business_type="generic", timezone="America/Lima"):
    """Open a business: the business, its owner, and its subscription, in one go.

    `owner` is {email, first_name, last_name}; `subscription` is {price, valid_until, plan_name}.
    Raises SlugTaken when a link was asked for and cannot be used.
    """
    if slug is not None and (slug in RESERVED_SLUGS or Business.objects.filter(slug=slug).exists()):
        raise SlugTaken()

    with transaction.atomic():
        business = Business.objects.create(
            name=name, slug=slug or unique_slug(name), business_type=business_type, timezone=timezone
        )
        membership, account_created = add_member(
            actor=actor,
            business=business,
            email=owner["email"],
            first_name=owner.get("first_name", ""),
            last_name=owner.get("last_name", ""),
            role=Membership.Role.OWNER,
        )
        billing.start_subscription(business=business, **subscription)
        activity.record(
            actor,
            activity.BUSINESS_CREATED,
            business,
            business_type=business_type,
            owner=membership.user.email,
            valid_until=str(subscription["valid_until"]),
        )
    return business, membership.user, account_created
