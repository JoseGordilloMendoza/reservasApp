"""The short code of a booking, which the customer shows at the business.

Six characters from an alphabet without the ones that look alike (0 and O, 1 and I and L), shown as
ABC-DEF. It is only unique inside a business: the owner looks it up in their own panel.
"""

import re
import secrets

ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
LENGTH = 6


def new_code(taken):
    """A code that `taken` (a set, or anything with `in`) does not have yet."""
    while True:
        code = "".join(secrets.choice(ALPHABET) for _ in range(LENGTH))
        if code not in taken:
            return code


def compact(text):
    """What someone typed, as stored: no spaces or hyphens, uppercase."""
    return re.sub(r"[\s-]", "", text or "").upper()


def looks_like_code(text):
    value = compact(text)
    return len(value) == LENGTH and all(letter in ALPHABET for letter in value)


def pretty(code):
    return f"{code[:3]}-{code[3:]}" if len(code) == LENGTH else code
