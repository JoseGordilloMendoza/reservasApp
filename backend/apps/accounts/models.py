from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create(self, email, password, **extra):
        if not email:
            raise ValueError("An email address is required")
        user = self.model(email=self.normalize_email(email), **extra)
        user.set_password(password)  # a None password stores an unusable one
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        if not extra["is_staff"] or not extra["is_superuser"]:
            raise ValueError("A superuser must have is_staff and is_superuser set")
        return self._create(email, password, **extra)

    def get_by_natural_key(self, email):
        # Used by authenticate(), so sign-in ignores the case the address was typed in.
        return self.get(email=self.normalize_email(email))

    @classmethod
    def normalize_email(cls, email):
        # Lowercase everything so two spellings of an address are one account.
        return (email or "").strip().lower()


class User(AbstractUser):
    """Signs in with email. Superusers are platform staff; business owners get a Membership."""

    username = None
    email = models.EmailField(unique=True)
    # Google account id, set the first time the user signs in with Google.
    google_sub = models.CharField(max_length=64, null=True, blank=True, unique=True)
    # True while the password is one the team handed over: the person must choose their own first.
    must_change_password = models.BooleanField(default=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    def save(self, *args, **kwargs):
        self.email = UserManager.normalize_email(self.email)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.email


class Membership(models.Model):
    """Links a user to a business. One user can belong to several businesses."""

    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        STAFF = "staff", "Staff"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="memberships")
    business = models.ForeignKey(
        "businesses.Business", on_delete=models.CASCADE, related_name="memberships"
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.OWNER)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "business"], name="membership_unique_user_per_business"
            ),
        ]

    def __str__(self):
        return f"{self.user} - {self.business} ({self.role})"
