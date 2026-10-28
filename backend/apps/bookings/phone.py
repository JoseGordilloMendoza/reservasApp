import re


class InvalidPhone(ValueError):
    pass


def normalize_phone(raw):
    """Return the number in international format (+51987654321).

    Peruvian mobile numbers may be given as 987654321, 51987654321 or +51 987 654 321.
    Numbers from other countries must start with + and include the country code.
    """
    text = (raw or "").strip()
    international = text.startswith("+")
    digits = re.sub(r"\D", "", text)

    if international:
        if not 8 <= len(digits) <= 15:
            raise InvalidPhone("The phone number is not valid.")
        return f"+{digits}"
    if len(digits) == 9 and digits.startswith("9"):
        return f"+51{digits}"
    if len(digits) == 11 and digits.startswith("519"):
        return f"+{digits}"
    raise InvalidPhone("The phone number is not valid.")
