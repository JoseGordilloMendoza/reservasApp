from django.contrib.auth import authenticate
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenBlacklistView, TokenRefreshView

from apps.accounts.google import GoogleNotConfigured, GoogleSignInError, verify_google_credential
from apps.accounts.services import user_for_google_identity

from . import serializers as s
from .throttles import LoginEmailThrottle
from .tokens import start_session

INVALID_CREDENTIALS = {
    "code": "invalid_credentials",
    "detail": "Correo o contraseña incorrectos.",
}


class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle, LoginEmailThrottle]
    throttle_scope = "auth_login"

    @extend_schema(
        summary="Sign in with email and password",
        request=s.LoginSerializer,
        responses={
            200: s.SessionSerializer,
            401: OpenApiResponse(description="Wrong email or password."),
        },
        auth=[],
    )
    def post(self, request):
        body = s.LoginSerializer(data=request.data)
        body.is_valid(raise_exception=True)

        user = authenticate(
            request, username=body.validated_data["email"], password=body.validated_data["password"]
        )
        if user is None:
            # Same answer whether the email exists or not, so it cannot be probed.
            return Response(INVALID_CREDENTIALS, status=status.HTTP_401_UNAUTHORIZED)
        return Response(start_session(user))


class GoogleLoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_google"

    @extend_schema(
        summary="Sign in with Google",
        description=(
            "Send the Google ID token. Only works for users who already exist; the first "
            "sign-in links their Google account."
        ),
        request=s.GoogleLoginSerializer,
        responses={
            200: s.SessionSerializer,
            401: OpenApiResponse(description="Invalid token, unverified email or no matching account."),
            503: OpenApiResponse(description="Google sign-in is not configured."),
        },
        auth=[],
    )
    def post(self, request):
        body = s.GoogleLoginSerializer(data=request.data)
        body.is_valid(raise_exception=True)

        try:
            claims = verify_google_credential(body.validated_data["credential"])
            user = user_for_google_identity(claims)
        except GoogleNotConfigured as error:
            return Response(
                {"code": error.code, "detail": error.message},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except GoogleSignInError as error:
            return Response(
                {"code": error.code, "detail": error.message},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        return Response(start_session(user))


@extend_schema(
    summary="Get a new access token",
    description="Rotates the refresh token: the one sent stops working and a new one is returned.",
    auth=[],
)
class RefreshView(TokenRefreshView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_refresh"


@extend_schema(
    summary="Sign out",
    description="Invalidates the refresh token so the session cannot be renewed.",
    auth=[],
)
class LogoutView(TokenBlacklistView):
    pass


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Current user and their businesses", responses=s.UserSerializer)
    def get(self, request):
        return Response(s.UserSerializer(request.user).data)
