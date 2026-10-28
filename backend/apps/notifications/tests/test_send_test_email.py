from io import StringIO
from unittest import mock

import pytest
from django.core import mail
from django.core.management import CommandError, call_command


def run(to="yo@example.com"):
    out = StringIO()
    call_command("send_test_email", to, stdout=out)
    return out.getvalue()


def test_sends_one_email_to_the_given_address():
    output = run("yo@example.com")

    assert [message.to for message in mail.outbox] == [["yo@example.com"]]
    assert mail.outbox[0].subject == "Prueba de correo"
    assert "Sent." in output


def test_shows_what_is_configured(settings):
    settings.EMAIL_HOST = "smtp.example.com"
    settings.EMAIL_PORT = 587
    settings.EMAIL_USE_TLS = True
    settings.EMAIL_USE_SSL = False
    settings.EMAIL_HOST_USER = "resend"
    settings.DEFAULT_FROM_EMAIL = "Separa <avisos@example.com>"

    output = run()

    assert "Server: smtp.example.com:587 (STARTTLS)" in output
    assert "User: resend" in output
    assert "From: Separa <avisos@example.com>" in output


def test_never_shows_the_password(settings):
    settings.EMAIL_HOST = "smtp.example.com"
    settings.EMAIL_HOST_PASSWORD = "clave-super-secreta"

    assert "clave-super-secreta" not in run()


def test_reports_implicit_ssl(settings):
    settings.EMAIL_HOST = "smtp.example.com"
    settings.EMAIL_USE_SSL = True
    settings.EMAIL_USE_TLS = False

    assert "(SSL)" in run()


def test_a_failure_is_shown_and_fails_the_command():
    with mock.patch("apps.notifications.management.commands.send_test_email.send_mail", side_effect=OSError("refused")):
        with pytest.raises(CommandError, match="could not be sent.*refused"):
            run()


def test_the_settings_never_ask_for_both_ssl_and_starttls(settings):
    # Django refuses to open a connection with both on; the settings must never produce that.
    from importlib import reload

    import config.settings as module

    with mock.patch.dict("os.environ", {"EMAIL_USE_SSL": "1", "EMAIL_USE_TLS": "1", "DEBUG": "1"}):
        reload(module)
        assert module.EMAIL_USE_SSL is True
        assert module.EMAIL_USE_TLS is False
    reload(module)
