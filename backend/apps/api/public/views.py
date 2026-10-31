from django.db.models import Prefetch
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.api.errors import error_response
from apps.availability.slots import get_available_slots
from apps.billing.services import is_operational
from apps.businesses.search import normalize_for_search
from apps.bookings import services
from apps.businesses.models import Business
from apps.catalog.models import Resource, Service

from . import serializers as s

def business_or_404(slug):
    return get_object_or_404(Business, slug=slug)


def operational_business_or_404(slug):
    """For what only makes sense while the business takes bookings: asking for slots or booking.

    A suspended business, or one past its subscription's grace days, is reported as not found.
    Its public page is the exception (see BusinessProfileView): that one explains itself.
    """
    business = business_or_404(slug)
    if not is_operational(business):
        raise Http404
    return business


class PublicAPIView(APIView):
    """No login required; throttled per client address to limit abuse."""

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_read"


class BusinessProfileView(PublicAPIView):
    @extend_schema(
        summary="Business public page",
        description="Resources and services a customer can book.",
        responses={200: s.BusinessPublicSerializer, 404: OpenApiResponse(description="Unknown business.")},
    )
    def get(self, request, slug):
        business = business_or_404(slug)
        # Not taking bookings (suspended or past due): the page still answers, so customers see
        # an explanation instead of an error, but offers nothing to book (D78).
        business.accepting_bookings = is_operational(business)
        business.active_resources = (
            list(
                Resource.objects.filter(business=business, is_active=True).prefetch_related(
                    Prefetch(
                        "services",
                        queryset=Service.objects.filter(is_active=True),
                        to_attr="active_services",
                    )
                )
            )
            if business.accepting_bookings
            else []
        )
        return Response(s.BusinessPublicSerializer(business).data)


class AvailabilityView(PublicAPIView):
    @extend_schema(
        summary="Free slots",
        description="Free start times for a service between two local dates (at most 62 days).",
        parameters=[s.AvailabilityQuerySerializer],
        responses={200: s.AvailabilityResponseSerializer, 400: s.ErrorSerializer},
    )
    def get(self, request, slug):
        business = operational_business_or_404(slug)
        query = s.AvailabilityQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        data = query.validated_data

        resource = get_object_or_404(
            Resource, pk=data["resource"], business=business, is_active=True
        )
        service = get_object_or_404(
            Service, pk=data["service"], resource=resource, business=business, is_active=True
        )
        try:
            slots = get_available_slots(resource, service, data["date"], data.get("to_date"))
        except ValueError as error:
            raise serializers.ValidationError({"detail": str(error)})

        return Response(
            {"timezone": business.timezone, "slots": s.SlotSerializer(slots, many=True).data}
        )


class CreateBookingView(PublicAPIView):
    throttle_scope = "public_booking"

    @extend_schema(
        summary="Create a booking",
        description=(
            "Books a slot returned by the availability endpoint. No account needed. "
            "The response includes `manage_token` once; keep it to view or cancel the booking."
        ),
        request=s.CreateBookingSerializer,
        responses={
            201: s.BookingCreatedSerializer,
            400: OpenApiResponse(description="Invalid data."),
            403: s.ErrorSerializer,
            409: s.ErrorSerializer,
            429: OpenApiResponse(description="Too many requests."),
        },
    )
    def post(self, request, slug):
        business = operational_business_or_404(slug)
        body = s.CreateBookingSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        data = body.validated_data

        service = get_object_or_404(
            Service, pk=data["service"], business=business, is_active=True
        )
        try:
            booking, token = services.create_booking(
                business=business,
                service=service,
                starts_at=data["starts_at"],
                customer_name=data["customer"]["name"],
                customer_phone=data["customer"]["phone"],
                customer_email=data["customer"]["email"],
            )
        except services.BookingError as error:
            return error_response(error)

        # Reload with related objects for the serializer; the token exists only here.
        booking = services.find_booking_by_token(token)
        booking.manage_token = token
        return Response(s.BookingCreatedSerializer(booking).data, status=status.HTTP_201_CREATED)


class ManagedBookingView(PublicAPIView):
    throttle_scope = "public_manage"

    def booking_or_404(self, token):
        booking = services.find_booking_by_token(token)
        if booking is None:
            return None
        return services.refresh_if_stale(booking)


class BookingDetailView(ManagedBookingView):
    @extend_schema(
        summary="View a booking",
        description="Looks up a booking by the token returned when it was created.",
        responses={200: s.BookingPublicSerializer, 404: OpenApiResponse(description="Unknown token.")},
    )
    def get(self, request, token):
        booking = self.booking_or_404(token)
        if booking is None:
            return Response({"code": "not_found", "detail": "Reserva no encontrada."}, status=404)
        return Response(s.BookingPublicSerializer(booking).data)


class CancelBookingView(ManagedBookingView):
    @extend_schema(
        summary="Cancel a booking",
        description="Allowed until the business's cancellation deadline; after that the customer must contact the business.",
        request=None,
        responses={
            200: s.BookingPublicSerializer,
            403: s.ErrorSerializer,
            404: OpenApiResponse(description="Unknown token."),
            409: s.ErrorSerializer,
        },
    )
    def post(self, request, token):
        booking = self.booking_or_404(token)
        if booking is None:
            return Response({"code": "not_found", "detail": "Reserva no encontrada."}, status=404)
        try:
            booking = services.cancel_booking_by_customer(booking, now=timezone.now())
        except services.BookingError as error:
            return error_response(error)
        booking = services.find_booking_by_token(token)
        return Response(s.BookingPublicSerializer(booking).data)


SEARCH_MIN_LETTERS = 2
SEARCH_RESULTS = 8
# More than will be shown, so that removing the ones that are not taking bookings still leaves enough.
SEARCH_CANDIDATES = 40
DIRECTORY_SIZE = 12
DIRECTORY_CANDIDATES = 40


class BusinessSearchView(PublicAPIView):
    throttle_scope = "public_search"

    @extend_schema(
        summary="Find a business by name",
        description=(
            "For the home page. Only businesses that chose to appear (`listed`) and are taking "
            "bookings show up, and only when at least two letters are typed: there is no way to "
            "list them all. Case and accents do not matter. Names that start with what was typed "
            "come first. At most eight results."
        ),
        parameters=[OpenApiParameter("q", str, description="Part of the name; at least two letters.")],
        responses={200: s.BusinessSearchResultSerializer(many=True)},
    )
    def get(self, request):
        typed = normalize_for_search(request.query_params.get("q", ""))
        if len(typed) < SEARCH_MIN_LETTERS:
            return Response({"results": []})

        candidates = (
            Business.objects.filter(listed=True, status=Business.Status.ACTIVE, search_name__contains=typed)
            .select_related("subscription")
            .order_by("search_name")[:SEARCH_CANDIDATES]
        )
        ordered = sorted(candidates, key=lambda item: (not item.search_name.startswith(typed), item.search_name))

        return Response({"results": s.BusinessSearchResultSerializer(taking_bookings(ordered, SEARCH_RESULTS), many=True).data})


class BusinessDirectoryView(PublicAPIView):
    throttle_scope = "public_search"

    @extend_schema(
        summary="Businesses shown on the home page",
        description=(
            "The newest businesses that chose to appear (`listed`) and are taking bookings, "
            f"at most {DIRECTORY_SIZE}. It is a showcase, not a full list."
        ),
        responses={200: s.BusinessCardSerializer(many=True)},
    )
    def get(self, request):
        candidates = (
            Business.objects.filter(listed=True, status=Business.Status.ACTIVE)
            .select_related("subscription")
            .order_by("-created_at")[:DIRECTORY_CANDIDATES]
        )

        return Response({"results": s.BusinessCardSerializer(taking_bookings(candidates, DIRECTORY_SIZE), many=True).data})


def taking_bookings(businesses, limit):
    """The first `limit` of them whose subscription lets them take bookings."""
    found = []
    for business in businesses:
        try:
            subscription = business.subscription
        except Business.subscription.RelatedObjectDoesNotExist:
            subscription = None
        if is_operational(business, subscription=subscription):
            found.append(business)
        if len(found) == limit:
            break
    return found
