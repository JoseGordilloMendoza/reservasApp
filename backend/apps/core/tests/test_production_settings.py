"""The settings a real server gets: each case starts a fresh Python with production variables.

Settings are read once when Python starts, so they cannot be checked from inside a running test
without reloading the module; a separate process is the honest way to see what a server would see.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[3]

PRODUCTION = {
    "DEBUG": "0",
    "SECRET_KEY": "x7Kq9mZp2Lw4Vn8Rb5Tc1Yd6Hf3Gj0Sa-uEoXiMyNtBvCzDlPkWgQrAhJe_FsU",
    "ALLOWED_HOSTS": "separa-api.onrender.com",
    "DATABASE_URL": "postgres://user:pass@localhost:5432/db",
    "CORS_ALLOWED_ORIGINS": "https://separa.pages.dev",
    "FRONTEND_URL": "https://separa.pages.dev",
}


def python(args, env):
    # Only what is given: nothing from the test machine (DEBUG=1 in development) may leak in.
    clean = {key: value for key, value in os.environ.items() if key in ("PATH", "SYSTEMROOT", "HOME", "LANG")}
    return subprocess.run(
        [sys.executable, *args], cwd=BACKEND, env={**clean, **env}, capture_output=True, text=True, timeout=120
    )


def setting(name, **overrides):
    code = (
        "import os, json, django\n"
        "os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'\n"
        "from django.conf import settings\n"
        f"print(json.dumps(getattr(settings, {name!r}, '<missing>'), default=str))"
    )
    result = python(["-c", code], {**PRODUCTION, **overrides})
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout.strip().splitlines()[-1])


def test_django_finds_nothing_to_warn_about_in_production():
    result = python(["manage.py", "check", "--deploy", "--fail-level", "WARNING"], PRODUCTION)

    assert result.returncode == 0, result.stdout + result.stderr
    assert "no issues" in result.stdout


def test_it_refuses_to_start_without_a_secret_key():
    env = {key: value for key, value in PRODUCTION.items() if key != "SECRET_KEY"}

    result = python(["manage.py", "check"], env)

    assert result.returncode != 0
    assert "SECRET_KEY is required" in result.stderr


class TestWhatIsSwitchedOn:
    def test_plain_http_is_sent_to_https(self):
        assert setting("SECURE_SSL_REDIRECT") is True

    def test_the_proxy_header_is_trusted_so_there_is_no_redirect_loop(self):
        assert setting("SECURE_PROXY_SSL_HEADER") == ["HTTP_X_FORWARDED_PROTO", "https"]

    def test_the_health_check_is_not_redirected(self):
        assert setting("SECURE_REDIRECT_EXEMPT") == ["^api/health/$"]

    def test_cookies_only_travel_over_https(self):
        assert setting("SESSION_COOKIE_SECURE") is True
        assert setting("CSRF_COOKIE_SECURE") is True

    def test_hsts_starts_short_and_can_be_raised(self):
        assert setting("SECURE_HSTS_SECONDS") == 3600
        assert setting("SECURE_HSTS_SECONDS", HSTS_SECONDS="31536000") == 31536000

    def test_the_admin_files_are_served_and_named_by_content(self):
        assert setting("MIDDLEWARE")[1] == "whitenoise.middleware.WhiteNoiseMiddleware"
        assert setting("STORAGES")["staticfiles"]["BACKEND"].endswith("CompressedManifestStaticFilesStorage")

    def test_logs_go_to_the_console(self):
        logging = setting("LOGGING")
        assert logging["root"]["handlers"] == ["console"]
        assert logging["root"]["level"] == "INFO"


class TestWhatTheHostTellsUs:
    def test_the_hosts_own_address_is_allowed(self):
        hosts = setting("ALLOWED_HOSTS", RENDER_EXTERNAL_HOSTNAME="separa-api-abc1.onrender.com")

        assert hosts == ["separa-api.onrender.com", "separa-api-abc1.onrender.com"]

    def test_without_it_only_the_configured_hosts_are_allowed(self):
        assert setting("ALLOWED_HOSTS") == ["separa-api.onrender.com"]

    def test_spaces_and_empty_entries_in_the_list_are_ignored(self):
        assert setting("ALLOWED_HOSTS", ALLOWED_HOSTS=" a.com , ,b.com,") == ["a.com", "b.com"]

    def test_the_number_of_proxies_reaches_the_throttling(self):
        assert setting("REST_FRAMEWORK", NUM_PROXIES="1")["NUM_PROXIES"] == 1

    def test_throttling_does_not_assume_a_proxy_unless_told(self):
        assert "NUM_PROXIES" not in setting("REST_FRAMEWORK")

    def test_the_frontend_may_call_the_api_from_its_address_only(self):
        assert setting("CORS_ALLOWED_ORIGINS") == ["https://separa.pages.dev"]


class TestDevelopmentIsLeftAlone:
    DEV = {"DEBUG": "1", "DATABASE_URL": PRODUCTION["DATABASE_URL"]}

    def test_no_https_redirect_and_no_secure_cookies(self):
        code = (
            "import os; os.environ['DJANGO_SETTINGS_MODULE']='config.settings'\n"
            "from django.conf import settings\n"
            "print(settings.SECURE_SSL_REDIRECT, settings.SESSION_COOKIE_SECURE, "
            "'whitenoise.middleware.WhiteNoiseMiddleware' in settings.MIDDLEWARE)"
        )
        result = python(["-c", code], self.DEV)

        assert result.stdout.strip() == "False False False"


@pytest.mark.parametrize("name", ["gunicorn", "whitenoise"])
def test_what_production_needs_is_in_the_requirements(name):
    assert name in (BACKEND / "requirements.txt").read_text()
    assert f"\n{name}==" in "\n" + (BACKEND / "requirements.lock.txt").read_text().lower()


class TestTheDatabaseConnection:
    # The string Neon's console gives: encrypted, with channel binding, behind a host that sleeps.
    NEON = (
        "postgresql://neondb_owner:AbC123dEf@ep-cool-darkness-a1b2c3d4.sa-east-1.aws.neon.tech/neondb"
        "?sslmode=require&channel_binding=require"
    )

    def test_a_neon_connection_string_is_understood_as_it_comes(self):
        database = setting("DATABASES", DATABASE_URL=self.NEON)["default"]

        assert database["HOST"] == "ep-cool-darkness-a1b2c3d4.sa-east-1.aws.neon.tech"
        assert database["NAME"] == "neondb"
        assert database["OPTIONS"] == {"sslmode": "require", "channel_binding": "require"}

    def test_the_driver_accepts_those_options(self):
        # libpq rejects a keyword it does not know, so this fails before any connection is tried.
        import psycopg

        parsed = psycopg.conninfo.conninfo_to_dict("host=h dbname=d sslmode=require channel_binding=require")

        assert parsed["sslmode"] == "require"
        assert parsed["channel_binding"] == "require"

    def test_a_connection_is_checked_before_it_is_reused(self):
        # Neon suspends an idle database after five minutes; a reused connection would then be dead.
        database = setting("DATABASES", DATABASE_URL=self.NEON)["default"]

        assert database["CONN_HEALTH_CHECKS"] is True
        assert database["CONN_MAX_AGE"] == 60
