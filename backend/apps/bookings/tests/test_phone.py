import pytest

from apps.bookings.phone import InvalidPhone, normalize_phone


@pytest.mark.parametrize(
    "raw",
    [
        "987654321",
        "987 654 321",
        "987-654-321",
        "51987654321",
        "+51987654321",
        "+51 987 654 321",
        " (+51) 987 654 321 ",
    ],
)
def test_peruvian_mobiles_are_normalized(raw):
    assert normalize_phone(raw) == "+51987654321"


def test_international_numbers_keep_their_country_code():
    assert normalize_phone("+57 300 123 4567") == "+573001234567"


@pytest.mark.parametrize(
    "raw",
    [
        "",
        None,
        "abc",
        "12345",
        "887654321",  # nine digits but not a mobile (must start with 9)
        "9876543210",  # ten digits without country code
        "0051987654321",
        "+1234",
        "+1234567890123456",  # more than 15 digits
    ],
)
def test_invalid_numbers_are_rejected(raw):
    with pytest.raises(InvalidPhone):
        normalize_phone(raw)
