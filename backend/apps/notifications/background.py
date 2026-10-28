import logging
import threading

from django.conf import settings
from django.db import connections

logger = logging.getLogger("notifications")


def run_in_background(function, *args):
    """Run `function(*args)` without making the caller wait for it.

    Used where the time a request takes must not depend on whether an email gets sent: the
    password reset answers the same, and as fast, whether or not the address is registered.
    Nothing is retried; if the process stops first, the email is lost and the person asks again.
    With EMAIL_IN_BACKGROUND off (tests) it runs right here, so results are deterministic.
    """
    if not settings.EMAIL_IN_BACKGROUND:
        function(*args)
        return

    def work():
        try:
            function(*args)
        except Exception:
            logger.exception("background task failed task=%s", getattr(function, "__name__", "?"))
        finally:
            # The thread has its own database connections; do not leave them open.
            connections.close_all()

    threading.Thread(target=work, daemon=True).start()
