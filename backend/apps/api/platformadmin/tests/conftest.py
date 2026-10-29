import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.accounts.models import Membership
from apps.businesses.models import Business

User = get_user_model()


@pytest.fixture
def team_member(db):
    return User.objects.create_superuser("equipo@example.com", "clave-larga-123", first_name="Equipo")


@pytest.fixture
def team(team_member):
    """A client signed in as a member of the platform team."""
    client = APIClient()
    client.force_authenticate(team_member)
    return client


@pytest.fixture
def owner(business):
    user = User.objects.create_user("ana@example.com", "clave-larga-123", first_name="Ana")
    Membership.objects.create(user=user, business=business, role=Membership.Role.OWNER)
    return user


@pytest.fixture
def owner_client(owner):
    client = APIClient()
    client.force_authenticate(owner)
    return client


@pytest.fixture
def other_business(db):
    return Business.objects.create(slug="consultorio-lucia", name="Consultorio Lucía", business_type="psychologist")
