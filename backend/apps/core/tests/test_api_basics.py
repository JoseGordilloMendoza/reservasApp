import pytest
from django.db import OperationalError
from rest_framework.test import APIClient


@pytest.fixture
def client():
    return APIClient()


def test_health_reports_ok(client, db):
    response = client.get("/api/health/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_health_reports_unreachable_database(client, monkeypatch):
    def broken_cursor(*args, **kwargs):
        raise OperationalError("down")

    monkeypatch.setattr("apps.core.views.connection.cursor", broken_cursor)

    response = client.get("/api/health/")

    assert response.status_code == 503
    assert response.json()["status"] == "error"


def test_schema_lists_the_endpoints(client):
    response = client.get("/api/schema/", {"format": "json"})

    assert response.status_code == 200
    assert "/api/health/" in response.json()["paths"]


def test_interactive_docs_are_served(client):
    assert client.get("/api/docs/").status_code == 200


def test_endpoints_require_authentication_by_default(client):
    from rest_framework.permissions import IsAuthenticated
    from rest_framework.settings import api_settings

    assert api_settings.DEFAULT_PERMISSION_CLASSES == [IsAuthenticated]
