import pytest
from django.core.exceptions import ValidationError

from apps.businesses.models import Business
from apps.businesses.validators import RESERVED_SLUGS

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("slug", sorted(RESERVED_SLUGS) + ["Admin", "API"])
def test_reserved_link_names_are_rejected(slug):
    business = Business(slug=slug, name="X")

    with pytest.raises(ValidationError) as error:
        business.full_clean()

    assert "slug" in error.value.message_dict


def test_normal_link_names_are_accepted():
    Business(slug="cancha-los-andes", name="X").full_clean()
