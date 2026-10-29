from datetime import timedelta

from django.db.models import Count, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import generics, status
from rest_framework import serializers
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Membership
from apps.billing import services as billing
from apps.billing.models import Subscription, SubscriptionPayment
from apps.billing.services import GRACE_DAYS, business_today, platform_today
from apps.bookings.models import Booking
from apps.businesses.models import Business
from apps.platformadmin import activity, onboarding

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

    @extend_schema(
        summary="Open a business",
        description=(
            "Creates the business, its owner and its subscription in one go. The owner gets an "
            "email to choose a password (an existing account just gets added). The vigencia is "
            "given as a date (valid_until) or as trial days from today."
        ),
        request=s.BusinessCreateSerializer,
        responses={201: s.BusinessDetailSerializer, 400: OpenApiResponse(description="Invalid data.")},
    )
    def post(self, request):
        body = s.BusinessCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        data = body.validated_data

        subscription = dict(data["subscription"])
        today = business_today(Business(timezone=data["timezone"]))
        if "trial_days" in subscription:
            subscription["valid_until"] = today + timedelta(days=subscription.pop("trial_days"))
        elif subscription["valid_until"] < today:
            raise serializers.ValidationError({"subscription": {"valid_until": "La vigencia no puede estar en el pasado."}})

        try:
            business, owner, account_created = onboarding.create_business(
                actor=request.user,
                name=data["name"],
                slug=data.get("slug"),
                business_type=data["business_type"],
                timezone=data["timezone"],
                owner=dict(data["owner"]),
                subscription=subscription,
            )
        except onboarding.SlugTaken:
            raise serializers.ValidationError({"slug": "Ese link ya está en uso."})

        result = s.BusinessDetailSerializer(business_or_404(business.slug)).data
        result["owner"] = {"email": owner.email, "account_created": account_created}
        return Response(result, status=status.HTTP_201_CREATED)

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


def conflict(code, detail):
    return Response({"code": code, "detail": detail}, status=status.HTTP_409_CONFLICT)


class SuspendView(PlatformAPIView):
    @extend_schema(
        summary="Suspend a business",
        description=(
            "Its public page stops taking bookings and its owner keeps access to see their data. "
            "Nothing is deleted. A reason is required and is logged."
        ),
        request=s.SuspendSerializer,
        responses={200: s.BusinessDetailSerializer, 409: OpenApiResponse(description="Already suspended.")},
    )
    def post(self, request, slug):
        business = business_or_404(slug)
        body = s.SuspendSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        if business.status == Business.Status.SUSPENDED:
            return conflict("already_suspended", "Este negocio ya está suspendido.")

        reason = body.validated_data["reason"].strip()
        Business.objects.filter(pk=business.pk).update(
            status=Business.Status.SUSPENDED, suspended_reason=reason, suspended_at=timezone.now()
        )
        activity.record(request.user, activity.BUSINESS_SUSPENDED, business, reason=reason)
        return Response(s.BusinessDetailSerializer(business_or_404(slug)).data)


class ReactivateView(PlatformAPIView):
    @extend_schema(
        summary="Reactivate a suspended business",
        responses={200: s.BusinessDetailSerializer, 409: OpenApiResponse(description="Not suspended.")},
    )
    def post(self, request, slug):
        business = business_or_404(slug)
        if business.status != Business.Status.SUSPENDED:
            return conflict("not_suspended", "Este negocio no está suspendido.")

        Business.objects.filter(pk=business.pk).update(
            status=Business.Status.ACTIVE, suspended_reason="", suspended_at=None
        )
        activity.record(
            request.user, activity.BUSINESS_REACTIVATED, business, previous_reason=business.suspended_reason
        )
        return Response(s.BusinessDetailSerializer(business_or_404(slug)).data)


class SubscriptionView(PlatformAPIView):
    @extend_schema(summary="The subscription of a business", responses=s.SubscriptionSerializer)
    def get(self, request, slug):
        subscription = s.subscription_of(business_or_404(slug))
        if subscription is None:
            return Response({"code": "no_subscription", "detail": "Este negocio no tiene suscripción."}, status=404)
        return Response(s.SubscriptionSerializer(subscription).data)

    @extend_schema(
        summary="Create or adjust the subscription",
        description=(
            "Creating needs `price` and `valid_until`. Adjusting changes the plan, price and notes "
            "freely; moving `valid_until` needs a `reason`, because normally a payment moves it. "
            "Both are logged."
        ),
        request=s.SubscriptionInputUpdateSerializer,
        responses={200: s.SubscriptionSerializer, 201: s.SubscriptionSerializer},
    )
    def put(self, request, slug):
        business = business_or_404(slug)
        body = s.SubscriptionInputUpdateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        data = body.validated_data
        subscription = s.subscription_of(business)

        if subscription is None:
            missing = {field: "Este campo es obligatorio." for field in ("price", "valid_until") if field not in data}
            if missing:
                raise serializers.ValidationError(missing)
            subscription = billing.start_subscription(
                business=business,
                price=data["price"],
                valid_until=data["valid_until"],
                plan_name=data.get("plan_name", ""),
                notes=data.get("notes", ""),
            )
            activity.record(
                request.user, activity.SUBSCRIPTION_SET, business, price=str(data["price"]), valid_until=str(data["valid_until"])
            )
            return Response(s.SubscriptionSerializer(subscription).data, status=status.HTTP_201_CREATED)

        reason = data.get("reason", "").strip()
        moving = "valid_until" in data and data["valid_until"] != subscription.valid_until
        if moving and not reason:
            raise serializers.ValidationError({"reason": "Explica por qué cambias la vigencia a mano."})

        previous_end = str(subscription.valid_until)
        for field in ("plan_name", "price", "valid_until", "notes"):
            if field in data:
                setattr(subscription, field, data[field])
        subscription.save()

        if moving:
            activity.record(
                request.user,
                activity.SUBSCRIPTION_ADJUSTED,
                business,
                reason=reason,
                valid_until=[previous_end, str(subscription.valid_until)],
            )
        return Response(s.SubscriptionSerializer(subscription).data)


class PaymentListView(PlatformAPIView):
    @extend_schema(summary="Payments received from a business, latest first", responses=s.PaymentSerializer(many=True))
    def get(self, request, slug):
        business = business_or_404(slug)
        payments = SubscriptionPayment.objects.filter(business=business).select_related("recorded_by")
        return Response(s.PaymentSerializer(payments, many=True).data)

    @extend_schema(
        summary="Record a payment",
        description=(
            "A payment received outside the platform. It moves the end of the subscription forward "
            "by the months it bought: from the current end if still covered, from the payment date "
            "if it had lapsed. Payments are never edited."
        ),
        request=s.PaymentInputSerializer,
        responses={201: s.PaymentSerializer, 409: OpenApiResponse(description="The business has no subscription.")},
    )
    def post(self, request, slug):
        business = business_or_404(slug)
        body = s.PaymentInputSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        data = body.validated_data

        today = business_today(business)
        paid_on = data.get("paid_on", today)
        if paid_on > today:
            raise serializers.ValidationError({"paid_on": "La fecha del pago no puede ser futura."})

        try:
            payment = billing.register_payment(
                business=business,
                amount=data["amount"],
                method=data["method"],
                months=data["months"],
                paid_on=paid_on,
                reference=data["reference"],
                note=data["note"],
                recorded_by=request.user,
            )
        except billing.NoSubscription:
            return conflict("no_subscription", "Este negocio no tiene suscripción. Créala antes de registrar un pago.")

        activity.record(
            request.user,
            activity.PAYMENT_RECORDED,
            business,
            amount=str(payment.amount),
            method=payment.method,
            months=payment.months,
            period=[str(payment.period_start), str(payment.period_end)],
        )
        return Response(s.PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


def members_of(business):
    return Membership.objects.filter(business=business).select_related("user").order_by("created_at", "id")


def member_or_404(business, pk):
    return get_object_or_404(members_of(business), pk=pk)


def is_last_owner(membership):
    """Whether removing or demoting this person would leave the business without an owner."""
    if membership.role != Membership.Role.OWNER:
        return False
    return not Membership.objects.filter(business=membership.business, role=Membership.Role.OWNER).exclude(pk=membership.pk).exists()


class MemberListView(PlatformAPIView):
    @extend_schema(summary="People who work the panel of a business", responses=s.MemberSerializer(many=True))
    def get(self, request, slug):
        business = business_or_404(slug)
        return Response(s.MemberSerializer(members_of(business), many=True).data)

    @extend_schema(
        summary="Add a person to a business",
        description=(
            "A new account has no password: it gets an email to choose one. An existing account "
            "keeps everything it had and is told it can now manage this business too."
        ),
        request=s.MemberCreateSerializer,
        responses={201: s.MemberSerializer, 409: OpenApiResponse(description="Already part of the business.")},
    )
    def post(self, request, slug):
        business = business_or_404(slug)
        body = s.MemberCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        data = body.validated_data

        email = onboarding.User.objects.normalize_email(data["email"])
        if Membership.objects.filter(business=business, user__email=email).exists():
            return conflict("already_member", "Esa persona ya trabaja en este negocio.")

        membership, created = onboarding.add_member(
            actor=request.user,
            business=business,
            email=email,
            first_name=data["first_name"],
            last_name=data["last_name"],
            role=data["role"],
        )
        result = s.MemberSerializer(members_of(business).get(pk=membership.pk)).data
        result["account_created"] = created
        return Response(result, status=status.HTTP_201_CREATED)


class MemberDetailView(PlatformAPIView):
    @extend_schema(
        summary="Change someone's role",
        request=s.MemberUpdateSerializer,
        responses={200: s.MemberSerializer, 409: OpenApiResponse(description="It would leave no owner.")},
    )
    def patch(self, request, slug, pk):
        business = business_or_404(slug)
        membership = member_or_404(business, pk)
        body = s.MemberUpdateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        role = body.validated_data["role"]

        if role == membership.role:
            return Response(s.MemberSerializer(membership).data)
        if role != Membership.Role.OWNER and is_last_owner(membership):
            return conflict("last_owner", "Es el único dueño: nombra a otro dueño antes de cambiarle el rol.")

        previous = membership.role
        membership.role = role
        membership.save(update_fields=["role"])
        activity.record(
            request.user, activity.USER_ROLE_CHANGED, business, email=membership.user.email, role=[previous, role]
        )
        return Response(s.MemberSerializer(membership).data)

    @extend_schema(
        summary="Remove someone from a business",
        description="Only takes away their place in this business; their account and other businesses stay.",
        responses={204: None, 409: OpenApiResponse(description="It would leave no owner.")},
    )
    def delete(self, request, slug, pk):
        business = business_or_404(slug)
        membership = member_or_404(business, pk)
        if is_last_owner(membership):
            return conflict("last_owner", "Es el único dueño: nombra a otro dueño antes de quitarlo.")

        email = membership.user.email
        membership.delete()
        activity.record(request.user, activity.USER_REMOVED, business, email=email)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MemberSendLinkView(PlatformAPIView):
    @extend_schema(
        summary="Send someone their access email again",
        description=(
            "Someone who never signed in gets a link to choose a password. Someone who did gets "
            "a reminder of where to sign in (they can use Forgot password for a new link)."
        ),
        responses={200: OpenApiResponse(description="Sent.")},
    )
    def post(self, request, slug, pk):
        business = business_or_404(slug)
        membership = member_or_404(business, pk)
        onboarding.send_access_email(membership.user, business)
        activity.record(request.user, activity.USER_LINK_SENT, business, email=membership.user.email)
        return Response({"detail": f"Enviamos el correo a {membership.user.email}."})
