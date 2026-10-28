import logging
from unittest import mock

from django.core import mail

from apps.notifications.mail import send_email


def test_sends_one_message_per_recipient():
    sent = send_email(["a@example.com", "b@example.com"], "Hola", "Cuerpo", event="test")

    assert sent == 2
    assert [message.to for message in mail.outbox] == [["a@example.com"], ["b@example.com"]]
    assert mail.outbox[0].subject == "Hola"
    assert mail.outbox[0].body == "Cuerpo"


def test_ignores_blanks_and_duplicates_regardless_of_case():
    sent = send_email(["Ana@Example.com", "ana@example.com ", "", None], "Hola", "Cuerpo", event="test")

    assert sent == 1
    assert len(mail.outbox) == 1


def test_sends_nothing_without_recipients():
    assert send_email([], "Hola", "Cuerpo", event="test") == 0
    assert send_email([None, ""], "Hola", "Cuerpo", event="test") == 0
    assert mail.outbox == []


def test_a_failure_is_logged_and_never_raised(caplog):
    with mock.patch("apps.notifications.mail.send_mail", side_effect=OSError("smtp down")):
        with caplog.at_level(logging.ERROR, logger="notifications"):
            sent = send_email(["a@example.com"], "Hola", "Cuerpo", event="booking_created")

    assert sent == 0
    assert "email failed event=booking_created" in caplog.text


def test_one_failure_does_not_stop_the_others():
    real = mail.send_mail
    calls = []

    def flaky(subject, body, sender, to, fail_silently):
        calls.append(to[0])
        if to[0] == "a@example.com":
            raise OSError("smtp down")
        return real(subject, body, sender, to, fail_silently=fail_silently)

    with mock.patch("apps.notifications.mail.send_mail", side_effect=flaky):
        sent = send_email(["a@example.com", "b@example.com"], "Hola", "Cuerpo", event="test")

    assert calls == ["a@example.com", "b@example.com"]
    assert sent == 1
    assert [message.to for message in mail.outbox] == [["b@example.com"]]


def test_logs_how_many_were_involved_but_not_the_addresses(caplog):
    with caplog.at_level(logging.INFO, logger="notifications"):
        send_email(["secreto@example.com"], "Hola", "Cuerpo", event="test")

    assert "sent=1 of=1" in caplog.text
    assert "secreto@example.com" not in caplog.text
