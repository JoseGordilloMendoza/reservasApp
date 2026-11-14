from django.core.exceptions import ValidationError

# What a business can say about its place, as a fixed list. A fixed list keeps the wording plain and the same
# for everyone, and lets the frontend give each one an icon and a name. The names live in the frontend.
FEATURES = (
    "parking",
    "lighting",
    "covered",
    "changing_rooms",
    "restrooms",
    "lockers",
    "wifi",
    "air_conditioning",
    "step_free",
    "snacks",
    "pet_friendly",
    "kids",
    "private",
    "waiting_room",
)


def validate_features(value):
    """A list of known keys, none repeated."""
    if not isinstance(value, list):
        raise ValidationError("Features must be a list.")
    unknown = [key for key in value if key not in FEATURES]
    if unknown:
        raise ValidationError(f"Unknown features: {', '.join(map(str, unknown))}.")
    if len(set(value)) != len(value):
        raise ValidationError("A feature appears twice.")
