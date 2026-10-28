import pytest
from django.test import Client

FRONTEND = "https://reservas.example.pe"
URL = "/api/v1/public/businesses/cancha-los-andes/bookings/"


def preflight(origin, headers="content-type"):
    return Client().options(
        URL,
        HTTP_ORIGIN=origin,
        HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
        HTTP_ACCESS_CONTROL_REQUEST_HEADERS=headers,
    )


@pytest.fixture
def allowed(settings):
    settings.CORS_ALLOWED_ORIGINS = [FRONTEND]


def test_the_configured_frontend_may_call_the_api(allowed):
    response = preflight(FRONTEND)

    assert response.status_code == 200
    assert response["Access-Control-Allow-Origin"] == FRONTEND


def test_the_business_header_and_the_token_are_allowed(allowed):
    response = preflight(FRONTEND, headers="content-type,authorization,x-business")

    allowed_headers = response["Access-Control-Allow-Headers"].lower()
    assert "x-business" in allowed_headers
    assert "authorization" in allowed_headers


def test_other_origins_get_no_permission(allowed):
    response = preflight("https://otro-sitio.example.com")

    assert "Access-Control-Allow-Origin" not in response


def test_actual_requests_from_other_origins_get_no_permission(allowed):
    response = Client().get("/api/health/", HTTP_ORIGIN="https://otro-sitio.example.com")

    assert "Access-Control-Allow-Origin" not in response


def test_nothing_is_allowed_until_an_origin_is_configured(settings):
    settings.CORS_ALLOWED_ORIGINS = []

    assert "Access-Control-Allow-Origin" not in preflight(FRONTEND)


def test_cookies_are_never_shared_across_origins(allowed):
    # Sessions use a header, so there is no reason to let cookies travel.
    assert "Access-Control-Allow-Credentials" not in preflight(FRONTEND)
