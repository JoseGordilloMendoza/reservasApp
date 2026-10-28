import hashlib

from rest_framework.throttling import SimpleRateThrottle


class LoginEmailThrottle(SimpleRateThrottle):
    """Limits attempts against one email, whatever address they come from.

    The per-address limit alone does not stop someone spreading guesses for a single
    account across many addresses.
    """

    scope = "auth_login_email"

    def get_cache_key(self, request, view):
        data = request.data if isinstance(request.data, dict) else {}
        email = str(data.get("email", "")).strip().lower()
        if not email:
            return None
        digest = hashlib.sha256(email.encode()).hexdigest()
        return self.cache_format % {"scope": self.scope, "ident": digest}
