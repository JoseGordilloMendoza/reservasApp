import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

User = get_user_model()

URLS = [
    ("platform-dashboard", {}),
    ("platform-businesses", {}),
    ("platform-business", {"slug": "cancha-los-andes"}),
]


@pytest.mark.parametrize(("name", "kwargs"), URLS)
def test_anonymous_visitors_are_asked_to_sign_in(db, name, kwargs):
    assert APIClient().get(reverse(name, kwargs=kwargs)).status_code == 401


@pytest.mark.parametrize(("name", "kwargs"), URLS)
def test_business_owners_are_refused(owner_client, business, name, kwargs):
    response = owner_client.get(reverse(name, kwargs=kwargs))

    assert response.status_code == 403
    assert "equipo de la plataforma" in response.json()["detail"]


@pytest.mark.parametrize(("name", "kwargs"), URLS)
def test_the_team_gets_in(team, business, name, kwargs):
    assert team.get(reverse(name, kwargs=kwargs)).status_code == 200


def test_a_deactivated_team_member_is_refused(team_member, team, business):
    team_member.is_active = False
    team_member.save()

    assert team.get(reverse("platform-dashboard")).status_code in (401, 403)


def test_staff_status_alone_is_not_enough(db, business):
    # is_staff opens Django's admin; the platform panel needs the full team flag.
    user = User.objects.create_user("staff@example.com", "clave-larga-123", is_staff=True)
    client = APIClient()
    client.force_authenticate(user)

    assert client.get(reverse("platform-dashboard")).status_code == 403
