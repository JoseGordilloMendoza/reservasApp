import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
from corsheaders.defaults import default_headers
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

DEBUG = os.environ.get("DEBUG", "0") == "1"

SECRET_KEY = os.environ.get("SECRET_KEY")
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured("SECRET_KEY is required when DEBUG is off")
    SECRET_KEY = "dev-only-insecure-key-never-use-this-outside-development"

ALLOWED_HOSTS = [host.strip() for host in os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if host.strip()]
# Render tells the service its own public address; it is always a valid host for it.
if os.environ.get("RENDER_EXTERNAL_HOSTNAME"):
    ALLOWED_HOSTS.append(os.environ["RENDER_EXTERNAL_HOSTNAME"])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "drf_spectacular",
    "apps.accounts",
    "apps.businesses",
    "apps.catalog",
    "apps.customers",
    "apps.availability",
    "apps.bookings",
    "apps.billing",
    "apps.notifications",
    "apps.platformadmin",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # Before anything that can answer a request, so preflights get their headers.
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.platformadmin.middleware.SupportAuditMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": dj_database_url.config(
        default="postgres://reservas:reservas@localhost:5433/reservas",
        conn_max_age=60,
        # A connection kept for reuse may have been closed on the other side, as when the host
        # suspends an idle database (Neon does after 5 minutes). Django checks it first and opens a
        # new one, instead of failing the one request that finds it dead.
        conn_health_checks=True,
    )
}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "es-pe"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Endpoints are private unless a view opts out with AllowAny.
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework_simplejwt.authentication.JWTAuthentication"],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    # Per client address. Mobile carriers share addresses between many people, so
    # the booking limit is generous; the per-customer cap does the real work.
    "DEFAULT_THROTTLE_RATES": {
        "public_read": "120/min",
        "public_booking": "30/hour",
        "public_manage": "60/min",
        "public_search": "60/min",
        "auth_login": "20/min",
        "auth_login_email": "5/min",
        "auth_refresh": "60/min",
        "auth_google": "20/min",
        "auth_reset": "10/hour",
        "auth_reset_email": "3/hour",
        "auth_reset_confirm": "20/hour",
    },
}

# Short-lived access token; the refresh token is rotated on every use and the old one
# is blacklisted, so a stolen refresh token stops working after the owner next refreshes.
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Reservas API",
    "DESCRIPTION": "Multi-business booking platform.",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    # Several fields are called "status" with different choices; without names the schema
    # invents ones with hashes in them.
    "ENUM_NAME_OVERRIDES": {
        "BookingStatusEnum": "apps.bookings.models.BookingStatus",
        "BusinessStatusEnum": "apps.businesses.models.Business.Status",
    },
}

# Origins of the frontend allowed to call the API from a browser, comma separated.
# Empty in development: the frontend dev server forwards /api, so no CORS is involved.
# Auth travels in a header (JWT), not in cookies, so credentials are not allowed.
CORS_ALLOWED_ORIGINS = [
    origin.strip() for origin in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if origin.strip()
]
CORS_ALLOW_HEADERS = (*default_headers, "x-business")

# OAuth client id of the web app, from Google Cloud Console. Empty disables Google sign-in.
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")

# Interactive API docs: on in development, opt in elsewhere.
API_DOCS_ENABLED = os.environ.get("API_DOCS_ENABLED", "1" if DEBUG else "0") == "1"

# Email. Development prints messages in the console; production sets EMAIL_HOST (and the
# user and password) to any SMTP provider. Django's test runner always uses an in-memory box.
EMAIL_HOST = os.environ.get("EMAIL_HOST", "")
EMAIL_BACKEND = os.environ.get(
    "EMAIL_BACKEND",
    "django.core.mail.backends.smtp.EmailBackend"
    if EMAIL_HOST
    else "django.core.mail.backends.console.EmailBackend",
)
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
# STARTTLS (port 587) is the usual choice. Some providers want implicit SSL (port 465)
# instead; Django does not allow both at once.
EMAIL_USE_SSL = os.environ.get("EMAIL_USE_SSL", "0") == "1"
EMAIL_USE_TLS = not EMAIL_USE_SSL and os.environ.get("EMAIL_USE_TLS", "1") == "1"
# A slow provider must not hold a booking request for long.
EMAIL_TIMEOUT = int(os.environ.get("EMAIL_TIMEOUT", "10"))
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "Separa <no-responder@localhost>")

# Where the frontend lives, for the links inside emails (ticket, panel, password reset).
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173").rstrip("/")

# A password reset link works once and for one hour.
PASSWORD_RESET_TIMEOUT = 60 * 60

# Send some emails without making the request wait (see notifications.background). Tests turn it off.
EMAIL_IN_BACKGROUND = os.environ.get("EMAIL_IN_BACKGROUND", "1") == "1"


# --- Production ------------------------------------------------------------------------
# Everything here applies only with DEBUG off. The service sits behind the host's proxy, which
# ends HTTPS and says so in X-Forwarded-Proto.

# Number of proxies in front of the app, so throttling sees the visitor's address and not the proxy's.
NUM_PROXIES = int(os.environ["NUM_PROXIES"]) if os.environ.get("NUM_PROXIES") else None
if NUM_PROXIES is not None:
    REST_FRAMEWORK["NUM_PROXIES"] = NUM_PROXIES

CSRF_TRUSTED_ORIGINS = [
    origin.strip() for origin in os.environ.get("CSRF_TRUSTED_ORIGINS", "").split(",") if origin.strip()
]

if not DEBUG:
    # Serves the admin's static files without a separate server; right after the security checks.
    MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = os.environ.get("SECURE_SSL_REDIRECT", "1") == "1"
    # The platform's own health check may not speak HTTPS; it must still get an answer.
    SECURE_REDIRECT_EXEMPT = [r"^api/health/$"]
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    # Starts short on purpose: HSTS makes browsers refuse plain HTTP for that long, so it is
    # raised (HSTS_SECONDS) only once the HTTPS setup is known to be right.
    SECURE_HSTS_SECONDS = int(os.environ.get("HSTS_SECONDS", "3600"))
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "same-origin"
    # Hashed names with long caching for the admin's files. Needs `collectstatic` at build time.
    STORAGES = {
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
    }
    # The site is served from a host's shared domain (onrender.com), where "include subdomains"
    # and "preload" would be wrong: they would bind domains that are not ours.
    SILENCED_SYSTEM_CHECKS = ["security.W005", "security.W021"]

# What happened and what failed goes to the console, where the host collects it (NF-14).
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"plain": {"format": "%(asctime)s %(levelname)s %(name)s %(message)s"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "plain"}},
    "root": {"handlers": ["console"], "level": os.environ.get("LOG_LEVEL", "INFO")},
}
