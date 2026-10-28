import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger("notifications")


def send_email(recipients, subject, body, *, event):
    """Send a plain text email to each recipient on their own. Returns how many were sent.

    It never raises: a notice that cannot be delivered must not undo or block what caused it
    (a booking, a cancellation). The failure is logged with the event name instead. Addresses
    are not logged, only how many were involved.
    """
    # One message per person, so nobody sees the others' addresses and one failure
    # does not stop the rest. Duplicates and blanks are dropped.
    addresses = sorted({(address or "").strip().lower() for address in recipients} - {""})

    sent = 0
    for address in addresses:
        try:
            send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [address], fail_silently=False)
        except Exception:
            logger.exception("email failed event=%s", event)
        else:
            sent += 1

    if addresses:
        logger.info("email event=%s sent=%d of=%d", event, sent, len(addresses))
    return sent
