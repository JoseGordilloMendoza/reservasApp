from datetime import timedelta

from django.db.models import Count, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import generics
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.billing.models import Subscription, SubscriptionPayment
from apps.billing.services import GRACE_DAYS, platform_today
from apps.bookings.models import Booking
from apps.businesses.models import Business
from apps.platformadmin import activity

from . import serializers as s
from .permissions import IsPlatformAdmin

# How soon before the end of its subscription a business shows up as "about to expire".
EXPIRING_DAYS = 7
RECENT_DAYS = 30


class PlatformAPIView(APIView):
    permission_classes = [IsPlatformAdmin]


class Pagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


def businesses_with_counts():
    """Every business with what a list needs, in one query: subscription, users, recent bookings."""
    since = timezone.now() - timedelta(days=RECENT_DAYS)
    return (
        Business.objects.select_related("subscription")
        .annotate(
            users_count=Count("memberships", distinct=True),
            bookings_30d=Count("bookings", filter=Q(bookings__created_at__gte=since), distinct=True),
        )
        .order_by("name")
    )


def business_or_404(slug):
    return get_object_or_404(businesses_with_counts(), slug=slug)


class DashboardView(PlatformAPIView):
    @extend_schema(
        summary="Indicators for the platform team",
        description=(
            "Businesses by state, subscriptions by standing, money received this month and expected "
            "each month, bookings of the last 30 days, and the businesses that need attention "
            "(past due or about to expire). Days are Lima days."
        ),
    )
    def get(self, request):
        today = platform_today()
        month_start = today.replace(day=1)
        subscriptions = Subscription.objects.all()
        grace_start = today - timedelta(days=GRACE_DAYS)

        covered = subscriptions.filter(valid_until__gte=today)
        in_grace = subscriptions.filter(valid_until__lt=today, valid_until__gte=grace_start)
        expired = subscriptions.filter(valid_until__lt=grace_start)
        expiring = covered.filter(valid_until__lte=today + timedelta(days=EXPIRING_DAYS))

        received = SubscriptionPayment.objects.filter(paid_on__gte=month_start, paid_on__lte=today).aggregate(
            total=Sum("amount")
        )["total"]
        expected = subscriptions.filter(valid_until__gte=grace_start).aggregate(total=Sum("price"))["total"]

        since = timezone.now() - timedelta(days=RECENT_DAYS)
        busiest = (
            Business.objects.annotate(count=Count("bookings", filter=Q(bookings__created_at__gte=since)))
            .filter(count__gt=0)
            .order_by("-count", "name")[:5]
        )

        attention = []
        needs_attention = (
            businesses_with_counts()
            .filter(subscription__valid_until__lte=today + timedelta(days=EXPIRING_DAYS))
            .order_by("subscription__valid_until")[:20]
        )
        for business in needs_attention:
            current = s.standing_of(business)
            attention.append(
                {
                    "slug": business.slug,
                    "name": business.name,
                    "state": current.state,
                    "valid_until": current.valid_until,
                    "days_left": current.days_left,
                    "suspended": business.status == Business.Status.SUSPENDED,
                }
            )

        return Response(
            {
                "businesses": {
                    "total": Business.objects.count(),
                    "active": Business.objects.filter(status=Business.Status.ACTIVE).count(),
                    "suspended": Business.objects.filter(status=Business.Status.SUSPENDED).count(),
                },
                "subscriptions": {
                    "active": covered.count(),
                    "expiring_soon": expiring.count(),
                    "grace": in_grace.count(),
                    "expired": expired.count(),
                    "without_subscription": Business.objects.filter(subscription__isnull=True).count(),
                },
                "revenue": {
                    "received_this_month": received or 0,
                    "expected_monthly": expected or 0,
                },
                "bookings_30d": Booking.objects.filter(created_at__gte=since).count(),
                "busiest": [{"slug": b.slug, "name": b.name, "bookings": b.count} for b in busiest],
                "attention": attention,
            }
        )


FILTERS = ("active", "suspended", "past_due", "expiring", "no_subscription")


class BusinessListView(generics.ListAPIView):
    permission_classes = [IsPlatformAdmin]
    pagination_class = Pagination
    serializer_class = s.BusinessRowSerializer

    @extend_schema(
        summary="List the businesses",
        parameters=[
            OpenApiParameter("q", str, description="Name or link."),
            OpenApiParameter(
                "filter",
                str,
                enum=list(FILTERS),
                description=(
                    "active, suspended, past_due (subscription ended), expiring (ends within a "
                    "week) or no_subscription."
                ),
            ),
        ],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        businesses = businesses_with_counts()
        params = self.request.query_params

        text = params.get("q", "").strip()
        if text:
            businesses = businesses.filter(Q(name__icontains=text) | Q(slug__icontains=text))

        today = platform_today()
        match params.get("filter"):
            case "active":
                businesses = businesses.filter(status=Business.Status.ACTIVE)
            case "suspended":
                businesses = businesses.filter(status=Business.Status.SUSPENDED)
            case "past_due":
                businesses = businesses.filter(subscription__valid_until__lt=today)
            case "expiring":
                businesses = businesses.filter(
                    subscription__valid_until__gte=today,
                    subscription__valid_until__lte=today + timedelta(days=EXPIRING_DAYS),
                )
            case "no_subscription":
                businesses = businesses.filter(subscription__isnull=True)
        return businesses


class BusinessDetailView(PlatformAPIView):
    @extend_schema(summary="One business, with its subscription", responses=s.BusinessDetailSerializer)
    def get(self, request, slug):
        return Response(s.BusinessDetailSerializer(business_or_404(slug)).data)

    @extend_schema(
        summary="Edit a business",
        description="Name, type and timezone. The link (slug) cannot be changed from here (D79).",
        request=s.BusinessUpdateSerializer,
        responses={200: s.BusinessDetailSerializer, 400: OpenApiResponse(description="Invalid data.")},
    )
    def patch(self, request, slug):
        business = business_or_404(slug)
        update = s.BusinessUpdateSerializer(business, data=request.data, partial=True)
        update.is_valid(raise_exception=True)

        before = {field: getattr(business, field) for field in update.validated_data}
        update.save()
        changed = {field: [before[field], value] for field, value in update.validated_data.items() if before[field] != value}
        if changed:
            activity.record(request.user, activity.BUSINESS_UPDATED, business, changes=changed)
        return Response(s.BusinessDetailSerializer(business_or_404(slug)).data)
