import pytest
from django.core.exceptions import ValidationError

from apps.businesses.features import FEATURES, validate_features
from apps.businesses.links import (
    clean_facebook,
    clean_instagram,
    clean_maps_url,
    clean_tiktok,
    clean_website,
)


@pytest.mark.parametrize(
    "typed",
    ["@canchas.andes", "canchas.andes", "instagram.com/canchas.andes", "https://www.instagram.com/canchas.andes/", "http://instagram.com/canchas.andes?igsh=abc"],
)
def test_instagram_accepts_a_handle_or_a_link_and_keeps_one_clean_link(typed):
    cleaned = clean_instagram(typed)

    # A handle is built on the canonical host; a pasted link may drop the www. Either way: https, no tracking.
    assert cleaned in ("https://www.instagram.com/canchas.andes", "https://instagram.com/canchas.andes")
    assert "?" not in cleaned


def test_tiktok_handles_get_the_at_sign():
    assert clean_tiktok("canchas_andes") == "https://www.tiktok.com/@canchas_andes"
    assert clean_tiktok("@canchas_andes") == "https://www.tiktok.com/@canchas_andes"


def test_facebook_accepts_a_page_name_or_a_link():
    assert clean_facebook("CanchasLosAndes") == "https://www.facebook.com/CanchasLosAndes"
    assert clean_facebook("https://m.facebook.com/CanchasLosAndes") == "https://m.facebook.com/CanchasLosAndes"
    assert clean_facebook("fb.me/CanchasLosAndes") == "https://fb.me/CanchasLosAndes"


def test_a_website_gets_https_when_it_is_left_out():
    assert clean_website("minegocio.pe") == "https://minegocio.pe"
    assert clean_website("http://www.minegocio.pe/contacto/") == "https://minegocio.pe/contacto"


@pytest.mark.parametrize(
    ("cleaner", "typed"),
    [
        (clean_instagram, "https://evil.example/canchas"),
        (clean_instagram, "instagram.com.evil.example/x"),
        (clean_instagram, "javascript:alert(1)"),
        (clean_instagram, "dos palabras"),
        (clean_instagram, "https://instagram.com"),
        (clean_tiktok, "https://instagram.com/canchas"),
        (clean_facebook, "https://evil.example/page"),
        (clean_facebook, "ab"),
        (clean_website, "javascript:alert(1)"),
        (clean_website, "sin espacios no"),
        (clean_website, "localhost"),
        (clean_maps_url, "https://evil.example/maps/x"),
        (clean_maps_url, "https://www.google.com/search?q=cancha"),
        (clean_maps_url, "ftp://maps.google.com/x"),
    ],
)
def test_links_to_the_wrong_place_are_rejected_with_a_message_that_says_what_to_do(cleaner, typed):
    with pytest.raises(ValidationError) as error:
        cleaner(typed)

    assert error.value.messages[0]


@pytest.mark.parametrize("cleaner", [clean_instagram, clean_tiktok, clean_facebook, clean_website, clean_maps_url])
def test_an_empty_link_is_allowed_and_stays_empty(cleaner):
    assert cleaner("") == ""
    assert cleaner("   ") == ""


@pytest.mark.parametrize(
    "typed",
    [
        "https://maps.app.goo.gl/AbCdEf123",
        "https://goo.gl/maps/AbCdEf123",
        "https://www.google.com/maps/place/Canchas+Los+Andes/@-16.4,-71.5,17z",
        "https://maps.google.com/?q=-16.4,-71.5",
        "https://waze.com/ul?ll=-16.4,-71.5",
    ],
)
def test_map_links_from_google_maps_and_waze_are_kept_with_their_place(typed):
    # Already https and already the place itself: nothing to change.
    assert clean_maps_url(typed) == typed


def test_a_map_link_typed_without_https_gets_it():
    assert clean_maps_url("maps.app.goo.gl/AbCdEf123") == "https://maps.app.goo.gl/AbCdEf123"


def test_every_feature_key_is_valid_and_unknown_ones_are_not():
    validate_features(list(FEATURES))
    validate_features([])
    with pytest.raises(ValidationError):
        validate_features(["parking", "helipad"])
    with pytest.raises(ValidationError):
        validate_features(["parking", "parking"])
    with pytest.raises(ValidationError):
        validate_features("parking")
