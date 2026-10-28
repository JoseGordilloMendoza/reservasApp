import logging
import threading
from unittest import mock

from apps.notifications.background import run_in_background


def test_runs_right_away_when_background_is_off():
    calls = []

    run_in_background(calls.append, "now")

    assert calls == ["now"]


def test_runs_in_another_thread_when_background_is_on(settings):
    settings.EMAIL_IN_BACKGROUND = True
    done = threading.Event()
    seen = []

    def work():
        seen.append(threading.current_thread())
        done.set()

    with mock.patch("apps.notifications.background.connections"):
        run_in_background(work)
        assert done.wait(timeout=5)

    assert seen[0] is not threading.main_thread()


def test_a_failing_task_is_logged_and_does_not_escape(settings, caplog):
    settings.EMAIL_IN_BACKGROUND = True
    finished = threading.Event()

    def boom():
        try:
            raise RuntimeError("bug")
        finally:
            finished.set()

    with mock.patch("apps.notifications.background.connections") as connections:
        with caplog.at_level(logging.ERROR, logger="notifications"):
            run_in_background(boom)
            assert finished.wait(timeout=5)
            # The thread logs after the task raised; give it a moment to close its connections.
            for _ in range(100):
                if connections.close_all.called:
                    break
                threading.Event().wait(0.02)

    assert "background task failed task=boom" in caplog.text
    connections.close_all.assert_called_once()
