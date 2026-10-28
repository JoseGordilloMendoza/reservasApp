from django.conf import settings
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token


class GoogleSignInError(Exception):
    code = "google_sign_in_error"
    message = "No se pudo iniciar sesión con Google."

    def __init__(self, message=None):
        self.message = message or self.message
        super().__init__(self.message)


class GoogleNotConfigured(GoogleSignInError):
    code = "google_not_configured"
    message = "El inicio de sesión con Google no está disponible."


class InvalidGoogleToken(GoogleSignInError):
    code = "invalid_google_token"
    message = "No se pudo verificar tu cuenta de Google."


class GoogleEmailNotVerified(GoogleSignInError):
    code = "google_email_not_verified"
    message = "Tu correo de Google no está verificado."


class AccountNotFound(GoogleSignInError):
    code = "account_not_found"
    message = "No hay una cuenta activa con ese correo. Pide que te den de alta en la plataforma."


class GoogleAccountMismatch(GoogleSignInError):
    code = "google_account_mismatch"
    message = "Esa cuenta de Google no corresponde a este usuario."


def verify_google_credential(credential):
    """Check the ID token the browser got from Google and return its claims.

    Verifies the signature, expiry, issuer and that it was issued for our client id.
    """
    client_id = settings.GOOGLE_CLIENT_ID
    if not client_id:
        raise GoogleNotConfigured()
    try:
        return id_token.verify_oauth2_token(credential, google_requests.Request(), client_id)
    except ValueError:
        raise InvalidGoogleToken()
