from io import StringIO

import pytest
from django.contrib.auth import get_user_model
from django.core.management import CommandError, call_command
from django.urls import reverse
from rest_framework.test import APIClient

User = get_user_model()

pytestmark = pytest.mark.django_db

GOOD = "una-clave-larga-y-segura-1"


def run(monkeypatch, email=None, password=None):
    for name, value in (("PLATFORM_ADMIN_EMAIL", email), ("PLATFORM_ADMIN_PASSWORD", password)):
        if value is None:
            monkeypatch.delenv(name, raising=False)
        else:
            monkeypatch.setenv(name, value)
    out = StringIO()
    call_command("ensure_platform_admin", stdout=out)
    return out.getvalue()


def test_does_nothing_without_an_email(monkeypatch):
    output = run(monkeypatch)

    assert "not set" in output
    assert User.objects.count() == 0


def test_creates_the_admin_who_can_sign_in(monkeypatch):
    output = run(monkeypatch, "Equipo@Example.com", GOOD)

    user = User.objects.get()
    assert user.email == "equipo@example.com"
    assert user.is_superuser and user.is_staff and user.is_active
    assert "created as a platform admin" in output
    login = APIClient().post(reverse("auth-login"), {"email": "equipo@example.com", "password": GOOD}, format="json")
    assert login.status_code == 200
    assert login.json()["user"]["is_platform_admin"] is True


def test_running_it_again_changes_nothing_and_keeps_a_changed_password(monkeypatch):
    run(monkeypatch, "equipo@example.com", GOOD)
    user = User.objects.get()
    user.set_password("otra-clave-que-yo-elegi-2")
    user.save()

    output = run(monkeypatch, "equipo@example.com", GOOD)

    assert User.objects.count() == 1
    assert User.objects.get().check_password("otra-clave-que-yo-elegi-2")
    assert "left as it is" in output


def test_an_existing_ordinary_account_is_promoted_without_touching_its_password(monkeypatch):
    User.objects.create_user("rosa@example.com", "su-clave-de-siempre-3")

    output = run(monkeypatch, "rosa@example.com", GOOD)

    user = User.objects.get()
    assert user.is_superuser and user.is_staff
    assert user.check_password("su-clave-de-siempre-3")
    assert "is_superuser" in output


def test_a_deactivated_account_is_reactivated(monkeypatch):
    User.objects.create_superuser("equipo@example.com", GOOD, is_active=False)

    run(monkeypatch, "equipo@example.com", GOOD)

    assert User.objects.get().is_active is True


@pytest.mark.parametrize("weak", ["123", "password", "12345678", "equipo@example.com"])
def test_a_weak_password_is_refused_and_creates_nothing(monkeypatch, weak):
    with pytest.raises(CommandError, match="not acceptable"):
        run(monkeypatch, "equipo@example.com", weak)

    assert User.objects.count() == 0


def test_without_a_password_the_account_exists_and_waits_for_forgot_password(monkeypatch):
    output = run(monkeypatch, "equipo@example.com")

    user = User.objects.get()
    assert user.is_superuser
    assert not user.has_usable_password()
    assert "Forgot password" in output


def test_the_password_is_never_printed(monkeypatch):
    assert GOOD not in run(monkeypatch, "equipo@example.com", GOOD)
