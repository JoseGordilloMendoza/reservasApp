from dataclasses import dataclass

from django.core.exceptions import ValidationError


@dataclass(frozen=True)
class Setting:
    default: int | str
    min: int | None = None
    max: int | None = None
    choices: tuple[str, ...] | None = None

    def error_for(self, value):
        """Return a message if `value` is not valid for this setting, else None."""
        if self.choices is not None:
            if value not in self.choices:
                return f"must be one of {', '.join(self.choices)}"
            return None
        if isinstance(value, bool) or not isinstance(value, int):
            return "must be an integer"
        if self.min is not None and value < self.min:
            return f"must be at least {self.min}"
        if self.max is not None and value > self.max:
            return f"must be at most {self.max}"
        return None


# Every option a business or service can configure. Adding an option here with
# a default is enough: existing businesses fall back to the default.
SETTINGS_SCHEMA = {
    "confirmation_mode": Setting("manual", choices=("manual", "automatic")),
    "pending_hold_minutes": Setting(120, min=5, max=10080),
    "cancellation_notice_minutes": Setting(1440, min=0, max=43200),
    "min_booking_notice_minutes": Setting(60, min=0, max=43200),
    "booking_horizon_days": Setting(30, min=1, max=365),
    "slot_interval_minutes": Setting(60, min=5, max=240),
    "buffer_minutes": Setting(0, min=0, max=240),
    "max_active_bookings_per_customer": Setting(3, min=1, max=50),
}


def default_settings():
    return {key: setting.default for key, setting in SETTINGS_SCHEMA.items()}


def validate_settings(values):
    """Reject unknown keys and invalid values. Partial dictionaries are allowed."""
    if not isinstance(values, dict):
        raise ValidationError("Settings must be an object.")

    errors = []
    for key, value in values.items():
        setting = SETTINGS_SCHEMA.get(key)
        if setting is None:
            errors.append(f"{key}: unknown setting")
            continue
        message = setting.error_for(value)
        if message:
            errors.append(f"{key}: {message}")
    if errors:
        raise ValidationError(errors)


def effective_settings(business, service=None):
    """Resolve settings in order: platform default, business, then service."""
    values = default_settings()
    for source in (business.settings, service.settings if service else None):
        values.update({k: v for k, v in (source or {}).items() if k in SETTINGS_SCHEMA})
    return values
