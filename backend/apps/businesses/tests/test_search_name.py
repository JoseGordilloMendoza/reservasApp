import pytest

from apps.businesses.models import Business
from apps.businesses.search import normalize_for_search


@pytest.mark.parametrize(
    ("typed", "stored"),
    [
        ("Consultorio Lucía Quispe", "consultorio lucia quispe"),
        ("  Canchas   LOS   Andes ", "canchas los andes"),
        ("Ñandú & Hijos", "nandu & hijos"),
        ("ÁÉÍÓÚ üñ", "aeiou un"),
        ("", ""),
        ("   ", ""),
    ],
)
def test_normalizing_for_search(typed, stored):
    assert normalize_for_search(typed) == stored


def test_a_business_keeps_its_normalized_name_up_to_date(db):
    business = Business.objects.create(slug="lucia", name="Consultorio Lucía")
    assert business.search_name == "consultorio lucia"

    business.name = "Psicología ÁNGELA"
    business.save()

    business.refresh_from_db()
    assert business.search_name == "psicologia angela"


def test_saving_only_the_name_still_updates_it(db):
    business = Business.objects.create(slug="lucia", name="Consultorio Lucía")

    business.name = "Otro Nombre"
    business.save(update_fields=["name"])

    business.refresh_from_db()
    assert business.search_name == "otro nombre"


def test_saving_something_else_leaves_it_alone(db):
    business = Business.objects.create(slug="lucia", name="Consultorio Lucía")

    business.description = "Atención con cita"
    business.save(update_fields=["description"])

    business.refresh_from_db()
    assert business.search_name == "consultorio lucia"


def test_a_business_is_not_listed_until_it_asks(db):
    assert Business.objects.create(slug="lucia", name="Lucía").listed is False
