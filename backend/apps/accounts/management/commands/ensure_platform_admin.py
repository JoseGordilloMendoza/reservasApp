import os

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = (
        "Make sure one person of the platform team exists, from PLATFORM_ADMIN_EMAIL and "
        "PLATFORM_ADMIN_PASSWORD. Safe to run on every start: it never changes the password of "
        "an account that already exists, and does nothing when no email is given."
    )

    def handle(self, *args, **options):
        User = get_user_model()
        email = User.objects.normalize_email(os.environ.get("PLATFORM_ADMIN_EMAIL", ""))
        password = os.environ.get("PLATFORM_ADMIN_PASSWORD", "")

        if not email:
            self.stdout.write("PLATFORM_ADMIN_EMAIL is not set: no platform admin created.")
            return

        user = User.objects.filter(email=email).first()
        if user is not None:
            changed = []
            for field in ("is_staff", "is_superuser", "is_active"):
                if not getattr(user, field):
                    setattr(user, field, True)
                    changed.append(field)
            if changed:
                user.save(update_fields=changed)
                self.stdout.write(f"{email}: already existed, now has {', '.join(changed)}.")
            else:
                self.stdout.write(f"{email}: already a platform admin, left as it is.")
            return

        if password:
            # A password from an environment variable is typed by a person: hold it to the same rules.
            try:
                validate_password(password, User(email=email))
            except ValidationError as error:
                raise CommandError("PLATFORM_ADMIN_PASSWORD is not acceptable: " + " ".join(error.messages))
            User.objects.create_superuser(email, password)
            self.stdout.write(f"{email}: created as a platform admin.")
        else:
            # No password given: the account exists and its owner chooses one with "Forgot password".
            User.objects.create_superuser(email, None)
            self.stdout.write(f"{email}: created without a password. Use Forgot password to choose one.")
