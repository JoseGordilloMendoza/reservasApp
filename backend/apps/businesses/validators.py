from django.core.exceptions import ValidationError

# Slugs become public links (app/<slug>), so they must not collide with app routes.
RESERVED_SLUGS = frozenset(
    {
        "admin",
        "api",
        "bookings",
        "docs",
        "health",
        "login",
        "logout",
        "media",
        "mis-reservas",
        "panel",
        "public",
        "reserva",
        "reservas",
        "static",
    }
)


def validate_slug_not_reserved(value):
    if value.lower() in RESERVED_SLUGS:
        raise ValidationError("This link name is reserved.")
