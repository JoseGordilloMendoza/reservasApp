"""Links a business shows on its page: social networks, a website and a map.

The owner types whatever they have at hand (a handle, a pasted link, with or without https) and we keep one clean
https link. Only links to the places they claim to be are kept, so a page can never carry a link to somewhere else.
"""

import re
from urllib.parse import urlsplit

from django.core.exceptions import ValidationError

_HANDLE = re.compile(r"^[A-Za-z0-9._]{1,30}$")
_FACEBOOK_NAME = re.compile(r"^[A-Za-z0-9.]{5,50}$")
_NO_SPACES = re.compile(r"\s")


def _parse(value):
    """Split what was typed into (host, path), adding https when it was left out. None when it is not a link."""
    text = value.strip()
    if _NO_SPACES.search(text):
        return None
    if "://" not in text:
        text = f"https://{text}"
    parts = urlsplit(text)
    if parts.scheme not in ("http", "https") or not parts.hostname or "." not in parts.hostname:
        return None
    return parts.hostname.lower().removeprefix("www."), parts.path, parts


def _on(host, *domains):
    return any(host == domain or host.endswith(f".{domain}") for domain in domains)


def _clean(parts, host):
    """The link as https, without the part after ? or #, which only tracks where the click came from."""
    path = parts.path.rstrip("/")
    return f"https://{host}{path}"


def _bad(message):
    raise ValidationError(message)


def _handle_or_link(value, domain, base, label, at=False):
    """Accepts @name, name or a link on the network; keeps https://base/name."""
    text = value.strip()
    if text.startswith("@"):
        text = text[1:]
    if _HANDLE.match(text):
        return f"https://{base}/{'@' if at else ''}{text}"
    parsed = _parse(value)
    if parsed and _on(parsed[0], domain):
        host, _, parts = parsed
        if not parts.path.strip("/"):
            _bad(f"Pega el link completo de tu {label}, o escribe solo tu usuario.")
        return _clean(parts, host)
    _bad(f"Escribe tu usuario de {label} (por ejemplo @minegocio) o pega el link de tu perfil.")


def clean_instagram(value):
    return _handle_or_link(value, "instagram.com", "www.instagram.com", "Instagram") if value.strip() else ""


def clean_tiktok(value):
    return _handle_or_link(value, "tiktok.com", "www.tiktok.com", "TikTok", at=True) if value.strip() else ""


def clean_facebook(value):
    text = value.strip()
    if not text:
        return ""
    if _FACEBOOK_NAME.match(text):
        return f"https://www.facebook.com/{text}"
    parsed = _parse(text)
    if parsed and _on(parsed[0], "facebook.com", "fb.com", "fb.me"):
        host, _, parts = parsed
        if not parts.path.strip("/"):
            _bad("Pega el link completo de tu página de Facebook.")
        return _clean(parts, host)
    _bad("Pega el link de tu página de Facebook.")


def clean_website(value):
    text = value.strip()
    if not text:
        return ""
    parsed = _parse(text)
    if not parsed:
        _bad("Escribe la dirección de tu página web, por ejemplo minegocio.pe.")
    host, _, parts = parsed
    return _clean(parts, host)


def clean_maps_url(value):
    """A link from Google Maps (or Waze) to the place. Without one, the page builds a search from the address."""
    text = value.strip()
    if not text:
        return ""
    parsed = _parse(text)
    if parsed:
        host, path, parts = parsed
        google_maps = (_on(host, "google.com") and path.startswith("/maps")) or host == "maps.google.com"
        short = host == "maps.app.goo.gl" or (host == "goo.gl" and path.startswith("/maps"))
        if google_maps or short or _on(host, "waze.com"):
            # Keep the query: in a map link it is the place itself.
            query = f"?{parts.query}" if parts.query else ""
            return f"https://{parts.netloc}{parts.path}{query}"
    _bad("Pega el link que te da Google Maps al tocar Compartir.")
