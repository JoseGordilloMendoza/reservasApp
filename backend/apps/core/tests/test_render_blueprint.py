"""render.yaml is read by Render, not by us, so a slip only shows on the first deploy. These checks
catch the slips that can be caught here: wrong paths, a secret written into the file, a variable
the application needs that nobody sets."""

import os
from pathlib import Path

import pytest
import yaml

# In the development container only backend/ is the working copy; the repository is mounted apart.
ROOT = Path(os.environ.get("REPO_ROOT") or Path(__file__).resolve().parents[4])
BACKEND = ROOT / "backend"


@pytest.fixture(scope="module")
def service():
    blueprint = yaml.safe_load((ROOT / "render.yaml").read_text(encoding="utf-8"))
    (only,) = blueprint["services"]
    return only


@pytest.fixture(scope="module")
def variables(service):
    return {entry["key"]: entry for entry in service["envVars"]}


def test_it_is_a_docker_web_service_on_the_free_plan(service):
    assert service["type"] == "web"
    assert service["runtime"] == "docker"
    assert service["plan"] == "free"


def test_the_image_it_builds_is_the_one_in_the_repository(service):
    assert (ROOT / service["dockerfilePath"]).is_file()
    assert (ROOT / service["dockerContext"]).is_dir()
    # The Dockerfile is read from inside the context: it must be there, and so must what it copies.
    assert (ROOT / service["dockerContext"] / "manage.py").is_file()
    assert (ROOT / service["dockerContext"] / "start.sh").is_file()


def test_the_health_check_is_the_endpoint_that_is_not_redirected_to_https(service):
    assert service["healthCheckPath"] == "/api/health/"


def test_production_is_not_in_debug_mode(variables):
    assert variables["DEBUG"]["value"] == "0"


def test_the_secret_key_is_generated_by_render_and_never_written_here(variables):
    assert variables["SECRET_KEY"] == {"key": "SECRET_KEY", "generateValue": True}


@pytest.mark.parametrize(
    "name",
    ["DATABASE_URL", "PLATFORM_ADMIN_EMAIL", "PLATFORM_ADMIN_PASSWORD", "EMAIL_HOST_PASSWORD", "CORS_ALLOWED_ORIGINS", "FRONTEND_URL", "GOOGLE_CLIENT_ID"],
)
def test_what_depends_on_the_owner_or_is_secret_is_asked_for_not_written(variables, name):
    assert variables[name] == {"key": name, "sync": False}


def test_nothing_that_looks_like_a_secret_has_a_value_in_the_file(variables):
    for name, entry in variables.items():
        if any(word in name for word in ("PASSWORD", "SECRET", "TOKEN", "KEY")) and name != "EMAIL_HOST_USER":
            assert "value" not in entry, f"{name} has a value written in render.yaml"


def test_one_worker_so_that_the_request_limits_stay_right(variables):
    assert variables["WEB_CONCURRENCY"]["value"] == "1"


def test_it_says_there_is_one_proxy_in_front(variables):
    assert variables["NUM_PROXIES"]["value"] == "1"


def test_every_value_is_text_as_the_environment_only_has_text(variables):
    for entry in variables.values():
        if "value" in entry:
            assert isinstance(entry["value"], str), entry["key"]


def test_email_goes_through_the_provider_chosen(variables):
    assert variables["EMAIL_HOST"]["value"] == "smtp.resend.com"
    assert variables["EMAIL_PORT"]["value"] == "587"
    assert variables["EMAIL_HOST_USER"]["value"] == "resend"


def test_the_start_script_does_what_the_deploy_relies_on():
    script = (BACKEND / "start.sh").read_text(encoding="utf-8")

    assert script.startswith("#!/bin/sh")
    assert "set -e" in script
    assert script.index("migrate") < script.index("ensure_platform_admin") < script.index("gunicorn")
    assert "${PORT:-10000}" in script
    assert "\r" not in script  # CRLF would make the container fail to start


# Read by the settings but deliberately left out of render.yaml, and why.
OPTIONAL = {
    "ALLOWED_HOSTS": "Render's own address is added from RENDER_EXTERNAL_HOSTNAME; a custom domain is added by hand",
    "RENDER_EXTERNAL_HOSTNAME": "set by Render itself",
    "CSRF_TRUSTED_ORIGINS": "only needed if the admin is used from a domain other than the service's own",
    "EMAIL_BACKEND": "chosen from EMAIL_HOST",
    "EMAIL_USE_TLS": "STARTTLS on port 587 is the default",
    "EMAIL_USE_SSL": "only for providers that want port 465",
    "EMAIL_TIMEOUT": "ten seconds is right",
    "EMAIL_IN_BACKGROUND": "on by default",
    "SECURE_SSL_REDIRECT": "on by default in production",
    "HSTS_SECONDS": "starts at an hour and is raised by hand once HTTPS is known to be right",
    "LOG_LEVEL": "INFO by default",
    "API_DOCS_ENABLED": "off by default in production",
}


def test_every_variable_the_settings_read_is_set_in_the_blueprint_or_is_optional_for_a_reason(variables):
    import re

    source = (BACKEND / "config" / "settings.py").read_text(encoding="utf-8")
    read = set(re.findall(r'os\.environ(?:\.get)?[\(\[]\s*"([A-Z_]+)"', source))

    forgotten = sorted(read - set(variables) - set(OPTIONAL))

    assert not forgotten, f"read by settings.py but neither in render.yaml nor listed as optional: {forgotten}"


def test_nothing_is_listed_as_optional_that_the_settings_no_longer_read():
    import re

    source = (BACKEND / "config" / "settings.py").read_text(encoding="utf-8")
    read = set(re.findall(r'os\.environ(?:\.get)?[\(\[]\s*"([A-Z_]+)"', source))

    assert sorted(set(OPTIONAL) - read) == []
