import pytest

from apps.businesses.models import Business
from apps.businesses.presets import PRESETS, preset_for, preset_settings
from apps.businesses.settings_schema import SETTINGS_SCHEMA, validate_settings


def test_every_business_type_has_a_preset():
    assert {value for value, _ in Business.BusinessType.choices} == set(PRESETS)


@pytest.mark.parametrize("business_type", list(PRESETS))
def test_preset_settings_are_valid_and_complete(business_type):
    settings = preset_settings(business_type)

    validate_settings(settings)
    assert set(settings) == set(SETTINGS_SCHEMA)


def test_court_preset_values():
    settings = preset_settings("court")

    assert preset_for("court").service_duration_minutes == 60
    assert settings["cancellation_notice_minutes"] == 12 * 60
    assert settings["confirmation_mode"] == "manual"
    assert settings["pending_hold_minutes"] == 120


def test_psychologist_preset_values():
    settings = preset_settings("psychologist")

    assert preset_for("psychologist").service_duration_minutes == 50
    assert settings["buffer_minutes"] == 10
    assert settings["pending_hold_minutes"] == 12 * 60
    assert settings["min_booking_notice_minutes"] == 12 * 60
    assert settings["cancellation_notice_minutes"] == 24 * 60


def test_unknown_business_type_falls_back_to_generic():
    assert preset_settings("something_else") == preset_settings("generic")


def test_preset_settings_are_a_copy():
    preset_settings("court")["buffer_minutes"] = 999

    assert preset_settings("court")["buffer_minutes"] == 0


@pytest.mark.django_db
@pytest.mark.parametrize("business_type", list(PRESETS))
def test_new_business_starts_from_its_preset(business_type):
    business = Business.objects.create(
        slug=f"b-{business_type}", name="B", business_type=business_type
    )
    business.refresh_from_db()

    assert business.settings == preset_settings(business_type)


@pytest.mark.django_db
def test_changing_business_type_later_does_not_reset_settings():
    business = Business.objects.create(slug="b", name="B", business_type="court")
    business.settings = {**business.settings, "buffer_minutes": 15}
    business.business_type = "psychologist"
    business.save()
    business.refresh_from_db()

    assert business.settings["buffer_minutes"] == 15
    assert business.settings["cancellation_notice_minutes"] == 12 * 60
