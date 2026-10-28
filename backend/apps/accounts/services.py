from django.contrib.auth import get_user_model

from .google import AccountNotFound, GoogleAccountMismatch, GoogleEmailNotVerified

User = get_user_model()


def user_for_google_identity(claims):
    """Find the existing user a verified Google identity belongs to.

    Google never creates accounts: businesses are set up by the platform, so the
    owner's account already exists. The first sign-in links the Google account id to
    it; from then on the id is what identifies them.
    """
    if claims.get("email_verified") is not True:
        raise GoogleEmailNotVerified()

    sub = claims["sub"]
    email = User.objects.normalize_email(claims.get("email"))

    user = User.objects.filter(google_sub=sub).first()
    if user is None:
        user = User.objects.filter(email=email).first()
        if user is not None and user.google_sub and user.google_sub != sub:
            raise GoogleAccountMismatch()

    if user is None or not user.is_active:
        raise AccountNotFound()

    if user.google_sub != sub:
        user.google_sub = sub
        user.save(update_fields=["google_sub"])
    return user
