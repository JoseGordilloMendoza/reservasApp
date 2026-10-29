from rest_framework.permissions import BasePermission

from apps.accounts.models import Membership
from apps.platformadmin.support import SupportMembership, open_session

BUSINESS_HEADER = "X-Business"

NO_BUSINESS = "No tienes acceso a ningún negocio."
NOT_YOUR_BUSINESS = "No tienes acceso a ese negocio."
BUSINESS_REQUIRED = f"Indica el negocio con la cabecera {BUSINESS_HEADER}."
OWNER_ONLY = "Solo el dueño del negocio puede hacer esto."
NEEDS_SUPPORT_SESSION = "Abre una sesión de soporte para entrar al panel de ese negocio."


def find_membership(request):
    """Return (membership, error message); one of the two is None."""
    memberships = request.user.memberships.select_related("business")

    slug = request.headers.get(BUSINESS_HEADER)
    if slug:
        membership = memberships.filter(business__slug=slug).first()
        if membership:
            return membership, None

        # The platform team gets into a business only through an open support session (D76).
        if request.user.is_superuser:
            session = open_session(request.user, slug)
            if session:
                return SupportMembership(session), None
            return None, NEEDS_SUPPORT_SESSION
        return None, NOT_YOUR_BUSINESS

    found = list(memberships[:2])
    if not found:
        return None, NO_BUSINESS
    if len(found) > 1:
        return None, BUSINESS_REQUIRED
    return found[0], None


class HasBusiness(BasePermission):
    """The user acts on exactly one of their businesses; sets request.business.

    A user with a single business needs nothing else. One with several names it in
    the X-Business header (its slug). Every panel query must then filter by
    request.business, which is what keeps one business from seeing another's data.
    """

    message = NO_BUSINESS

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        membership, error = find_membership(request)
        if membership is None:
            self.message = error
            return False

        request.membership = membership
        request.business = membership.business
        if isinstance(membership, SupportMembership):
            # Read by SupportAuditMiddleware, which only sees the plain Django request.
            request._request.support_session = membership.session
        return True


class IsOwner(HasBusiness):
    """For changes only the owner of the business may make."""

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if request.membership.role != Membership.Role.OWNER:
            self.message = OWNER_ONLY
            return False
        return True
