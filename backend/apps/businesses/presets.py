from dataclasses import dataclass, field

from .settings_schema import default_settings


@dataclass(frozen=True)
class Preset:
    service_duration_minutes: int
    # Only what differs from the platform defaults.
    overrides: dict = field(default_factory=dict)


# Starting values per business type; each business can change any of them.
# Keys match Business.BusinessType values. Initial numbers still need to be
# validated with real businesses (see docs/06-reglas-de-negocio.md).
PRESETS = {
    "generic": Preset(service_duration_minutes=60),
    "court": Preset(
        service_duration_minutes=60,
        overrides={"cancellation_notice_minutes": 12 * 60},
    ),
    "psychologist": Preset(
        service_duration_minutes=50,
        overrides={
            "buffer_minutes": 10,
            "pending_hold_minutes": 12 * 60,
            "min_booking_notice_minutes": 12 * 60,
        },
    ),
}


def preset_for(business_type):
    return PRESETS.get(business_type, PRESETS["generic"])


def preset_settings(business_type):
    """Full set of settings a new business of this type starts with."""
    return {**default_settings(), **preset_for(business_type).overrides}
