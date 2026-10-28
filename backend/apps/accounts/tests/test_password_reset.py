import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.core.exceptions import ValidationError
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts import password_reset as reset

User = get_user_model()

OLD = "clave-antigua-123"
NEW = "clave-nueva-segura-456"


@pytest.fixture
def user(db):
    return User.objects.create_user("ana@example.com", OLD, first_name="Ana")


def parts(user):
    return urlsafe_base64_encode(force_bytes(user.pk)), default_token_generator.make_token(user)


class TestTheEmail:
    def test_goes_to_the_account_with_a_link_to_the_frontend(self, user):
        reset.send_reset_email("ana@example.com")

        assert [message.to for message in mail.outbox] == [["ana@example.com"]]
        body = mail.outbox[0].body
        assert "Hola Ana," in body
        assert "http://localhost:5173/panel/nueva-contrasena?uid=" in body
        assert "&token=" in body

    def test_ignores_the_case_of_the_address(self, user):
        reset.send_reset_email("  ANA@Example.com ")

        assert len(mail.outbox) == 1

    def test_says_nothing_and_sends_nothing_for_an_unknown_address(self, user):
        assert reset.send_reset_email("nadie@example.com") is None
        assert mail.outbox == []

    def test_does_not_write_to_an_inactive_account(self, user):
        user.is_active = False
        user.save()

        reset.send_reset_email("ana@example.com")

        assert mail.outbox == []

    def test_an_account_that_only_uses_google_can_set_a_password(self, db):
        google_only = User.objects.create_user("g@example.com", None)

        reset.send_reset_email("g@example.com")

        assert len(mail.outbox) == 1
        uid, token = parts(google_only)
        reset.set_new_password(uid, token, NEW)
        google_only.refresh_from_db()
        assert google_only.check_password(NEW)

    def test_the_link_in_the_email_is_the_one_that_works(self, user):
        reset.send_reset_email("ana@example.com")
        link = next(line for line in mail.outbox[0].body.splitlines() if line.startswith("http"))
        query = dict(pair.split("=") for pair in link.split("?")[1].split("&"))

        reset.set_new_password(query["uid"], query["token"], NEW)

        user.refresh_from_db()
        assert user.check_password(NEW)


class TestChoosingANewPassword:
    def test_changes_the_password(self, user):
        reset.set_new_password(*parts(user), NEW)

        user.refresh_from_db()
        assert user.check_password(NEW)
        assert not user.check_password(OLD)

    def test_a_link_works_only_once(self, user):
        uid, token = parts(user)
        reset.set_new_password(uid, token, NEW)

        with pytest.raises(reset.InvalidResetLink):
            reset.set_new_password(uid, token, "otra-clave-distinta-789")

        user.refresh_from_db()
        assert user.check_password(NEW)

    def test_a_link_stops_working_after_the_password_changes_another_way(self, user):
        uid, token = parts(user)
        user.set_password("cambiada-por-otro-lado-1")
        user.save()

        with pytest.raises(reset.InvalidResetLink):
            reset.set_new_password(uid, token, NEW)

    def test_a_link_expires_after_an_hour(self, user, settings):
        uid, token = parts(user)
        settings.PASSWORD_RESET_TIMEOUT = -1  # already past

        with pytest.raises(reset.InvalidResetLink):
            reset.set_new_password(uid, token, NEW)

    def test_the_timeout_is_one_hour(self, settings):
        assert settings.PASSWORD_RESET_TIMEOUT == 3600

    @pytest.mark.parametrize("uid", ["", "!!!", "bm9wZQ", "OTk5OTk"])  # garbage, "nope", id 99999
    def test_a_bad_uid_is_just_an_invalid_link(self, user, uid):
        _, token = parts(user)

        with pytest.raises(reset.InvalidResetLink):
            reset.set_new_password(uid, token, NEW)

    def test_a_bad_token_is_an_invalid_link(self, user):
        uid, _ = parts(user)

        with pytest.raises(reset.InvalidResetLink):
            reset.set_new_password(uid, "no-es-un-token", NEW)

    def test_a_token_of_another_user_does_not_work(self, user, db):
        other = User.objects.create_user("luis@example.com", OLD)
        uid, _ = parts(user)
        _, other_token = parts(other)

        with pytest.raises(reset.InvalidResetLink):
            reset.set_new_password(uid, other_token, NEW)

    def test_an_inactive_account_cannot_use_a_link(self, user):
        uid, token = parts(user)
        user.is_active = False
        user.save()

        with pytest.raises(reset.InvalidResetLink):
            reset.set_new_password(uid, token, NEW)

    def test_a_weak_password_is_refused_and_the_link_still_works(self, user):
        uid, token = parts(user)

        with pytest.raises(ValidationError):
            reset.set_new_password(uid, token, "123")

        user.refresh_from_db()
        assert user.check_password(OLD)
        reset.set_new_password(uid, token, NEW)  # the same link, now with a good password

    def test_a_password_like_the_email_is_refused(self, user):
        with pytest.raises(ValidationError):
            reset.set_new_password(*parts(user), "ana@example.com")


class TestSignedInDevices:
    def test_every_session_is_closed(self, user):
        first, second = RefreshToken.for_user(user), RefreshToken.for_user(user)

        reset.set_new_password(*parts(user), NEW)

        blacklisted = set(BlacklistedToken.objects.values_list("token__jti", flat=True))
        assert {first["jti"], second["jti"]} <= blacklisted

    def test_sessions_of_other_users_are_left_alone(self, user, db):
        other = User.objects.create_user("luis@example.com", OLD)
        theirs = RefreshToken.for_user(other)

        reset.set_new_password(*parts(user), NEW)

        assert theirs["jti"] not in set(BlacklistedToken.objects.values_list("token__jti", flat=True))
