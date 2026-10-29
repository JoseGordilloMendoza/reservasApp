import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.accounts.models import Membership
from apps.businesses.models import Business

User = get_user_model()


@pytest.fixture
def owner(business):
    user = User.objects.create_user("ana@example.com", "s3cret-pass-123")
    Membership.objects.create(user=user, business=business, role=Membership.Role.OWNER)
    return user


@pytest.fixture
def other_business(db):
    return Business.objects.create(slug="otro-negocio", name="Otro Negocio")


@pytest.fixture
def other_owner(other_business):
    user = User.objects.create_user("luis@example.com", "s3cret-pass-123")
    Membership.objects.create(user=user, business=other_business)
    return user


@pytest.fixture
def panel(owner):
    """A client signed in as the owner of the `business` fixture."""
    client = APIClient()
    client.force_authenticate(owner)
    return client


@pytest.fixture
def other_panel(other_owner):
    client = APIClient()
    client.force_authenticate(other_owner)
    return client


@pytest.fixture
def api_client():
    """A visitor who is not signed in."""
    return APIClient()
