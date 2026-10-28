from django.contrib.auth import authenticate
from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenBlacklistView, TokenRefreshView

from apps.accounts.google import GoogleNotConfigured, GoogleSignInError, verify_google_credential
from apps.accounts.password_reset import InvalidResetLink, send_reset_email, set_new_password
from apps.accounts.services import user_for_google_identity
from apps.notifications.background import run_in_background

from . import serializers as s
from .throttles import LoginEmailThrottle, PasswordResetEmailThrottle
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


RESET_REQUESTED = {
    "detail": "Si el correo está registrado, te enviamos un enlace para cambiar tu contraseña."
}
INVALID_RESET_LINK = {
    "code": "invalid_reset_link",
    "detail": "El enlace no es válido o ya venció. Pide uno nuevo.",
}


class PasswordResetView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle, PasswordResetEmailThrottle]
    throttle_scope = "auth_reset"

    @extend_schema(
        summary="Ask for a password reset email",
        description=(
            "Always answers the same, and as fast, whether or not the email is registered, so it "
            "cannot be used to find out who has an account. The email is sent in the background."
        ),
        request=s.PasswordResetSerializer,
        responses={200: OpenApiResponse(description="Asked. An email follows if the account exists.")},
        auth=[],
    )
    def post(self, request):
        body = s.PasswordResetSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        run_in_background(send_reset_email, body.validated_data["email"])
        return Response(RESET_REQUESTED)


class PasswordResetConfirmView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_reset_confirm"

    @extend_schema(
        summary="Choose a new password from an emailed link",
        description=(
            "The link works once and for an hour. Changing the password closes every session "
            "that was open. A weak password is refused and the link stays usable."
        ),
        request=s.PasswordResetConfirmSerializer,
        responses={
            200: OpenApiResponse(description="Password changed."),
            400: OpenApiResponse(description="Invalid or expired link, or a weak password."),
        },
        auth=[],
    )
    def post(self, request):
        body = s.PasswordResetConfirmSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        data = body.validated_data

        try:
            set_new_password(data["uid"], data["token"], data["password"])
        except InvalidResetLink:
            return Response(INVALID_RESET_LINK, status=status.HTTP_400_BAD_REQUEST)
        except DjangoValidationError as error:
            return Response({"password": error.messages}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": "Listo. Ya puedes entrar con tu nueva contraseña."})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Current user and their businesses", responses=s.UserSerializer)
    def get(self, request):
        return Response(s.UserSerializer(request.user).data)
