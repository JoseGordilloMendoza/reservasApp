from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.db import transaction
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from apps.notifications import messages
from apps.notifications.mail import send_email

User = get_user_model()


class InvalidResetLink(Exception):
    """The link is malformed, expired, already used, or for a user that cannot sign in."""


def reset_link(user):
    """The frontend address where the person chooses a new password.

    The token is tied to the current password and last sign-in, so it stops working as soon as
    either changes: using it once is enough to invalidate it.
    """
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return f"{settings.FRONTEND_URL}/panel/nueva-contrasena?uid={uid}&token={token}"


def send_reset_email(email):
    """Write to the owner of `email` if there is an active account. Says nothing either way.

    Accounts that only use Google have no usable password; they may set one this way.
    """
    user = User.objects.filter(email=User.objects.normalize_email(email), is_active=True).first()
    if user is None:
        return
    subject, body = messages.password_reset(user, reset_link(user))
    send_email([user.email], subject, body, event="password_reset")


def _user_for_link(uid, token):
    try:
        user = User.objects.get(pk=urlsafe_base64_decode(uid).decode(), is_active=True)
    except (ValueError, TypeError, OverflowError, UnicodeDecodeError, User.DoesNotExist):
        raise InvalidResetLink()
    if not default_token_generator.check_token(user, token):
        raise InvalidResetLink()
    return user


def revoke_sessions(user):
    """Make every refresh token of the user useless, so signed-in devices must sign in again."""
    for outstanding in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=outstanding)


def set_new_password(uid, token, password):
    """Choose a new password from an emailed link.

    Raises InvalidResetLink for a bad link, and ValidationError (with Spanish messages) for a
    weak password; in that case the link stays usable.
    """
    user = _user_for_link(uid, token)
    validate_password(password, user)

    with transaction.atomic():
        user.set_password(password)
        user.save(update_fields=["password"])
        revoke_sessions(user)
    return user
