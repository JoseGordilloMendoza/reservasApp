import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction

from apps.accounts.models import Membership
from apps.businesses.models import Business

User = get_user_model()

pytestmark = pytest.mark.django_db


@pytest.fixture
def owner():
    return User.objects.create_user("ana@example.com", "s3cret-pass")


def test_owner_is_the_default_role(owner, business):
    membership = Membership.objects.create(user=owner, business=business)

    assert membership.role == Membership.Role.OWNER


def test_user_belongs_to_a_business_only_once(owner, business):
    Membership.objects.create(user=owner, business=business)

    with pytest.raises(IntegrityError), transaction.atomic():
        Membership.objects.create(user=owner, business=business, role=Membership.Role.STAFF)


def test_user_can_belong_to_several_businesses(owner, business):
    other = Business.objects.create(slug="otro", name="Otro")

    Membership.objects.create(user=owner, business=business)
    Membership.objects.create(user=owner, business=other)

    assert owner.memberships.count() == 2


def test_several_users_can_share_a_business(owner, business):
    staff = User.objects.create_user("luis@example.com", "s3cret-pass")

    Membership.objects.create(user=owner, business=business)
    Membership.objects.create(user=staff, business=business, role=Membership.Role.STAFF)

    assert business.memberships.count() == 2


def test_deleting_a_business_removes_its_memberships_but_not_the_users(owner, business):
    Membership.objects.create(user=owner, business=business)

    business.delete()

    assert not Membership.objects.exists()
    assert User.objects.filter(pk=owner.pk).exists()
