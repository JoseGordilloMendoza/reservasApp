import pytest
from django.core.exceptions import ValidationError

from apps.businesses.models import Business
from apps.businesses.settings_schema import (
    SETTINGS_SCHEMA,
    default_settings,
    effective_settings,
    validate_settings,
)
from apps.catalog.models import Service


def test_platform_defaults_are_valid_and_complete():
    defaults = default_settings()

    validate_settings(defaults)
    assert set(defaults) == set(SETTINGS_SCHEMA)


def test_partial_settings_are_valid():
    validate_settings({})
    validate_settings({"buffer_minutes": 15})


@pytest.mark.parametrize(
    "values",
    [
        {"unknown_option": 1},
        {"confirmation_mode": "sometimes"},
        {"pending_hold_minutes": "120"},
        {"pending_hold_minutes": True},
        {"pending_hold_minutes": 1.5},
        {"pending_hold_minutes": 4},
        {"booking_horizon_days": 366},
        {"buffer_minutes": -1},
    ],
)
def test_invalid_settings_are_rejected(values):
    with pytest.raises(ValidationError):
        validate_settings(values)


def test_non_object_settings_are_rejected():
    with pytest.raises(ValidationError):
        validate_settings(["buffer_minutes"])


def test_every_problem_is_reported():
    with pytest.raises(ValidationError) as error:
        validate_settings({"nope": 1, "buffer_minutes": -5})

    assert len(error.value.messages) == 2


def test_empty_business_settings_fall_back_to_platform_defaults(business):
    business.settings = {}

    assert effective_settings(business) == default_settings()


def test_business_settings_override_platform_defaults(business):
    business.settings = {"buffer_minutes": 15}

    assert effective_settings(business)["buffer_minutes"] == 15
    assert effective_settings(business)["slot_interval_minutes"] == 60


def test_service_settings_override_business_settings(business, service):
    business.settings = {"buffer_minutes": 15, "confirmation_mode": "manual"}
    service.settings = {"confirmation_mode": "automatic"}

    result = effective_settings(business, service)

    assert result["confirmation_mode"] == "automatic"
    assert result["buffer_minutes"] == 15


def test_resolving_does_not_modify_stored_settings(business, service):
    business.settings = {"buffer_minutes": 15}
    service.settings = {"buffer_minutes": 5}

    effective_settings(business, service)

    assert business.settings == {"buffer_minutes": 15}
    assert service.settings == {"buffer_minutes": 5}


def test_unknown_stored_keys_are_ignored_when_resolving(business):
    business.settings = {"removed_option": 1, "buffer_minutes": 15}

    result = effective_settings(business)

    assert "removed_option" not in result
    assert result["buffer_minutes"] == 15


def test_business_validates_settings_on_full_clean(business):
    business.settings = {"unknown_option": 1}

    with pytest.raises(ValidationError) as error:
        business.full_clean()

    assert "settings" in error.value.message_dict


def test_service_validates_settings_on_full_clean(service):
    service.settings = {"buffer_minutes": 9999}

    with pytest.raises(ValidationError) as error:
        service.full_clean()

    assert "settings" in error.value.message_dict


@pytest.mark.django_db
def test_new_business_keeps_explicit_settings():
    business = Business.objects.create(
        slug="custom", name="Custom", business_type="court", settings={"buffer_minutes": 20}
    )

    assert business.settings == {"buffer_minutes": 20}
