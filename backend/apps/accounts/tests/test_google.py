import pytest
from django.contrib.auth import get_user_model

from apps.accounts import google
from apps.accounts.services import user_for_google_identity

User = get_user_model()

pytestmark = pytest.mark.django_db


def claims(email="ana@example.com", sub="google-123", verified=True):
    return {"sub": sub, "email": email, "email_verified": verified}


# --- verifying the token with Google ---------------------------------------


def test_verification_needs_a_configured_client_id(settings):
    settings.GOOGLE_CLIENT_ID = ""

    with pytest.raises(google.GoogleNotConfigured):
        google.verify_google_credential("token")


def test_verification_checks_the_token_against_our_client_id(settings, monkeypatch):
    settings.GOOGLE_CLIENT_ID = "my-client-id"
    seen = {}

    def fake_verify(token, request, audience):
        seen.update(token=token, audience=audience)
        return {"sub": "google-123"}

    monkeypatch.setattr(google.id_token, "verify_oauth2_token", fake_verify)

    assert google.verify_google_credential("the-token") == {"sub": "google-123"}
    assert seen == {"token": "the-token", "audience": "my-client-id"}


def test_a_token_google_rejects_is_invalid(settings, monkeypatch):
    settings.GOOGLE_CLIENT_ID = "my-client-id"

    def reject(*args, **kwargs):
        raise ValueError("Token expired")

    monkeypatch.setattr(google.id_token, "verify_oauth2_token", reject)

    with pytest.raises(google.InvalidGoogleToken):
        google.verify_google_credential("the-token")


# --- matching a Google identity to a user ----------------------------------


def test_first_sign_in_links_the_google_account():
    user = User.objects.create_user("ana@example.com")

    found = user_for_google_identity(claims())

    user.refresh_from_db()
    assert found == user
    assert user.google_sub == "google-123"


def test_email_is_matched_ignoring_case():
    user = User.objects.create_user("ana@example.com")

    assert user_for_google_identity(claims(email="Ana@Example.COM")) == user


def test_later_sign_ins_match_by_google_id_even_if_the_email_changed():
    user = User.objects.create_user("ana@example.com", google_sub="google-123")

    assert user_for_google_identity(claims(email="ana.nueva@gmail.com")) == user


def test_unknown_email_does_not_create_an_account():
    with pytest.raises(google.AccountNotFound):
        user_for_google_identity(claims(email="nobody@example.com"))

    assert not User.objects.exists()


def test_unverified_google_email_is_refused():
    User.objects.create_user("ana@example.com")

    with pytest.raises(google.GoogleEmailNotVerified):
        user_for_google_identity(claims(verified=False))


def test_missing_verification_flag_is_refused():
    User.objects.create_user("ana@example.com")

    with pytest.raises(google.GoogleEmailNotVerified):
        user_for_google_identity({"sub": "google-123", "email": "ana@example.com"})


def test_a_different_google_account_cannot_take_over_a_linked_user():
    user = User.objects.create_user("ana@example.com", google_sub="google-123")

    with pytest.raises(google.GoogleAccountMismatch):
        user_for_google_identity(claims(sub="google-attacker"))

    user.refresh_from_db()
    assert user.google_sub == "google-123"


def test_deactivated_users_cannot_sign_in():
    User.objects.create_user("ana@example.com", is_active=False)

    with pytest.raises(google.AccountNotFound):
        user_for_google_identity(claims())
