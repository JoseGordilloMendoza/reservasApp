"""Temporary passwords: how the team hands someone a way in without sending an email.

The password is shown once to the person who created the account, who passes it on. It only works
until its owner chooses their own (the panel will not let them do anything else until then).
"""

import secrets

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction

from .password_reset import revoke_sessions

# No 0, O, 1, I or L: it is read aloud and typed from a phone.
ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"
GROUPS = 3
GROUP_SIZE = 4


class WrongCurrentPassword(Exception):
    """The current password given does not match."""


def make_temporary_password():
    """Twelve characters in three groups, like k7mq-4xpd-9tzw."""
    return "-".join(
        "".join(secrets.choice(ALPHABET) for _ in range(GROUP_SIZE)) for _ in range(GROUPS)
    )


def issue_temporary_password(user):
    """Give the user a new temporary password and make them change it. Returns the password.

    Every session they had is closed, since whoever held it did not choose this password.
    """
    password = make_temporary_password()
    with transaction.atomic():
        user.set_password(password)
        user.must_change_password = True
        user.save(update_fields=["password", "must_change_password"])
        revoke_sessions(user)
    return password


def change_own_password(user, current, new):
    """The person chooses their own password, proving they know the current one.

    Raises WrongCurrentPassword, or ValidationError (with Spanish messages) for a weak or unchanged
    password. Every session they had is closed; the caller opens a new one.
    """
    if not user.check_password(current):
        raise WrongCurrentPassword()
    if user.check_password(new):
        raise ValidationError("La contraseña nueva debe ser distinta de la actual.")
    validate_password(new, user)

    with transaction.atomic():
        user.set_password(new)
        user.must_change_password = False
        user.save(update_fields=["password", "must_change_password"])
        revoke_sessions(user)
