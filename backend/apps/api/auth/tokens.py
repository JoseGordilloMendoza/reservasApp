from django.contrib.auth.models import update_last_login
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import UserSerializer


def start_session(user):
    """Issue a token pair for a user who has just proven who they are."""
    update_last_login(None, user)
    refresh = RefreshToken.for_user(user)
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": UserSerializer(user).data,
    }
