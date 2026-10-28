import pytest
from django.contrib.auth import authenticate, get_user_model
from django.db import IntegrityError, transaction

User = get_user_model()

pytestmark = pytest.mark.django_db


def test_user_is_created_with_an_email_and_no_username():
    user = User.objects.create_user("ana@example.com", "s3cret-pass")

    assert user.email == "ana@example.com"
    assert user.check_password("s3cret-pass")
    assert user.username is None
    assert not user.is_staff and not user.is_superuser


def test_email_is_stored_in_lowercase():
    user = User.objects.create_user("  Ana@Example.COM ", "s3cret-pass")

    assert user.email == "ana@example.com"


def test_two_spellings_of_an_email_are_the_same_account():
    User.objects.create_user("ana@example.com", "s3cret-pass")

    with pytest.raises(IntegrityError), transaction.atomic():
        User.objects.create_user("ANA@example.com", "other-pass")


def test_email_is_required():
    with pytest.raises(ValueError):
        User.objects.create_user("", "s3cret-pass")


def test_user_without_a_password_cannot_sign_in_with_one():
    user = User.objects.create_user("ana@example.com")

    assert not user.has_usable_password()
    assert authenticate(username="ana@example.com", password="") is None


def test_superuser_is_platform_staff():
    admin = User.objects.create_superuser("root@example.com", "s3cret-pass")

    assert admin.is_staff and admin.is_superuser


def test_superuser_cannot_be_created_without_the_flags():
    with pytest.raises(ValueError):
        User.objects.create_superuser("root@example.com", "s3cret-pass", is_staff=False)


def test_authenticate_uses_the_email():
    User.objects.create_user("ana@example.com", "s3cret-pass")

    assert authenticate(username="ana@example.com", password="s3cret-pass") is not None
    assert authenticate(username="ana@example.com", password="wrong") is None


def test_google_account_can_only_belong_to_one_user():
    User.objects.create_user("ana@example.com", google_sub="g-1")

    with pytest.raises(IntegrityError), transaction.atomic():
        User.objects.create_user("luis@example.com", google_sub="g-1")


def test_users_without_google_can_coexist():
    User.objects.create_user("ana@example.com")
    User.objects.create_user("luis@example.com")
