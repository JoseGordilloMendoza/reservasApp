from rest_framework.permissions import BasePermission

from apps.api.panel.permissions import PasswordChangeRequired

NOT_TEAM = "Esta sección es solo para el equipo de la plataforma."


class IsPlatformAdmin(BasePermission):
    """Only the platform team: active superusers. Business owners and staff never pass."""

    message = NOT_TEAM

    def has_permission(self, request, view):
        user = request.user
        allowed = bool(user and user.is_authenticated and user.is_active and user.is_superuser)
        if allowed and user.must_change_password:
            raise PasswordChangeRequired()
        return allowed
