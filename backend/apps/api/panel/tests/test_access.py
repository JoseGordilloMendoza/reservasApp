import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate
from rest_framework.views import APIView
from rest_framework.response import Response

from apps.accounts.models import Membership
from apps.api.panel.permissions import HasBusiness, IsOwner
from apps.businesses.models import Business

User = get_user_model()

URL = "panel-business"


def get_business(client, **headers):
    return client.get(reverse(URL), **headers)


def test_panel_requires_a_signed_in_user(db):
    assert APIClient().get(reverse(URL)).status_code == 401


def test_owner_sees_their_own_business(panel):
    response = get_business(panel)

    assert response.status_code == 200
    data = response.json()
    assert data["slug"] == "cancha-los-andes"
    assert data["role"] == "owner"
    assert data["settings"]["max_active_bookings_per_customer"] == 3


def test_each_owner_only_sees_their_business(panel, other_panel):
    assert get_business(panel).json()["slug"] == "cancha-los-andes"
    assert get_business(other_panel).json()["slug"] == "otro-negocio"


def test_works_with_a_real_token(owner):
    client = APIClient()
    session = client.post(
        reverse("auth-login"), {"email": "ana@example.com", "password": "s3cret-pass-123"}, format="json"
    ).json()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {session['access']}")

    assert get_business(client).json()["slug"] == "cancha-los-andes"


def test_user_without_a_business_is_refused(db):
    user = User.objects.create_user("sin-negocio@example.com", "s3cret-pass-123")
    client = APIClient()
    client.force_authenticate(user)

    response = get_business(client)

    assert response.status_code == 403
    assert "ningún negocio" in response.json()["detail"]


def test_platform_admin_without_a_business_is_refused(db):
    admin = User.objects.create_superuser("root@example.com", "s3cret-pass-123")
    client = APIClient()
    client.force_authenticate(admin)

    assert get_business(client).status_code == 403


def test_user_with_several_businesses_must_say_which(panel, owner, other_business):
    Membership.objects.create(user=owner, business=other_business)

    response = get_business(panel)

    assert response.status_code == 403
    assert "X-Business" in response.json()["detail"]


def test_user_with_several_businesses_picks_one_with_the_header(panel, owner, other_business):
    Membership.objects.create(user=owner, business=other_business)

    assert get_business(panel, HTTP_X_BUSINESS="otro-negocio").json()["slug"] == "otro-negocio"
    assert get_business(panel, HTTP_X_BUSINESS="cancha-los-andes").json()["slug"] == "cancha-los-andes"


def test_header_for_a_business_you_do_not_belong_to_is_refused(panel, other_business):
    response = get_business(panel, HTTP_X_BUSINESS="otro-negocio")

    assert response.status_code == 403


def test_unknown_and_foreign_businesses_are_indistinguishable(panel, other_business):
    foreign = get_business(panel, HTTP_X_BUSINESS="otro-negocio")
    unknown = get_business(panel, HTTP_X_BUSINESS="no-existe")

    assert foreign.status_code == unknown.status_code == 403
    assert foreign.json() == unknown.json()


def test_suspended_business_can_still_be_viewed_by_its_owner(panel, business):
    business.status = Business.Status.SUSPENDED
    business.save()

    response = get_business(panel)

    assert response.status_code == 200
    assert response.json()["status"] == "suspended"


def test_staff_can_use_the_panel(owner, business):
    Membership.objects.filter(user=owner).update(role=Membership.Role.STAFF)
    client = APIClient()
    client.force_authenticate(owner)

    assert get_business(client).json()["role"] == "staff"


# --- owner-only permission --------------------------------------------------


class OwnerOnlyView(APIView):
    permission_classes = [IsOwner]

    def get(self, request):
        return Response({"business": request.business.slug})


class AnyMemberView(APIView):
    permission_classes = [HasBusiness]

    def get(self, request):
        return Response({"business": request.business.slug})


def call(view, user):
    request = APIRequestFactory().get("/")
    force_authenticate(request, user=user)
    return view.as_view()(request)


def test_owner_passes_the_owner_check(owner):
    assert call(OwnerOnlyView, owner).status_code == 200


def test_staff_fails_the_owner_check_but_passes_the_member_check(owner):
    Membership.objects.filter(user=owner).update(role=Membership.Role.STAFF)

    refused = call(OwnerOnlyView, owner)

    assert refused.status_code == 403
    assert "dueño" in refused.data["detail"]
    assert call(AnyMemberView, owner).status_code == 200


def test_owner_check_still_requires_a_business(db):
    user = User.objects.create_user("sin-negocio@example.com", "s3cret-pass-123")

    refused = call(OwnerOnlyView, user)

    assert refused.status_code == 403
    assert "ningún negocio" in refused.data["detail"]


def test_panel_business_appears_in_the_api_docs(panel):
    assert "/api/v1/panel/business/" in panel.get("/api/schema/", {"format": "json"}).json()["paths"]
