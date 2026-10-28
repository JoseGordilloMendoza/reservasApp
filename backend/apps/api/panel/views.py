import re
from datetime import datetime, time, timedelta
from datetime import timezone as dt_timezone
from zoneinfo import ZoneInfo

from django.db.models import Q
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import generics
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.api.errors import error_response
from apps.bookings import services
from apps.bookings.models import Booking
from apps.catalog.models import Service

from . import serializers as s
from .permissions import HasBusiness


class PanelAPIView(APIView):
    """Base for the business panel: signed in, and acting on one of the user's businesses."""

    permission_classes = [HasBusiness]


class BusinessView(PanelAPIView):
    @extend_schema(
        summary="The business you are managing",
        description="Its details and the effective value of every setting.",
        responses=s.PanelBusinessSerializer,
    )
    def get(self, request):
        serializer = s.PanelBusinessSerializer(
            request.business, context={"membership": request.membership}
        )
        return Response(serializer.data)


def bookings_of(business):
    return Booking.objects.filter(business=business).select_related(
        "resource", "service", "customer"
    )


class BookingPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


def local_day_start(day, business):
    return datetime.combine(day, time.min, tzinfo=ZoneInfo(business.timezone)).astimezone(
        dt_timezone.utc
    )


class BookingListView(generics.ListAPIView):
    permission_classes = [HasBusiness]
    pagination_class = BookingPagination
    serializer_class = s.PanelBookingSerializer

    @extend_schema(
        summary="List bookings",
        description="Filter by status, resource, local dates or customer name and phone.",
        parameters=[s.BookingFilterSerializer],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        summary="Create a booking taken by phone or WhatsApp",
        description=(
            "Confirmed straight away. May fall outside opening hours and notice limits, but "
            "cannot overlap another booking or a block. Returns the customer's link token once."
        ),
        request=s.PanelBookingCreateSerializer,
        responses={
            201: s.PanelBookingCreatedSerializer,
            400: OpenApiResponse(description="Invalid data or a slot entirely in the past."),
            404: OpenApiResponse(description="No such active service in this business."),
            409: s.ErrorSerializer,
        },
    )
    def post(self, request):
        body = s.PanelBookingCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        data = body.validated_data

        service = get_object_or_404(
            Service, pk=data["service"], business=request.business, is_active=True
        )
        try:
            booking, token = services.create_booking_by_business(
                business=request.business,
                service=service,
                starts_at=data["starts_at"],
                customer_name=data["customer"]["name"],
                customer_phone=data["customer"]["phone"],
                customer_email=data["customer"]["email"],
            )
        except services.BookingError as error:
            return error_response(error)

        booking = get_object_or_404(bookings_of(request.business), pk=booking.pk)
        booking.manage_token = token
        return Response(s.PanelBookingCreatedSerializer(booking).data, status=201)

    def get_queryset(self):
        business = self.request.business
        # Show an overdue pending booking as expired rather than as still pending.
        services.expire_stale_bookings(business=business)

        filters = s.BookingFilterSerializer(data=self.request.query_params)
        filters.is_valid(raise_exception=True)
        params = filters.validated_data

        bookings = bookings_of(business)
        if "status" in params:
            bookings = bookings.filter(status__in=params["status"])
        if "resource" in params:
            bookings = bookings.filter(resource_id=params["resource"])
        if "date_from" in params:
            bookings = bookings.filter(starts_at__gte=local_day_start(params["date_from"], business))
        if "date_to" in params:
            after = params["date_to"] + timedelta(days=1)
            bookings = bookings.filter(starts_at__lt=local_day_start(after, business))
        if params.get("q"):
            bookings = bookings.filter(self._search(params["q"]))
        return bookings.order_by(params["ordering"], "id")

    @staticmethod
    def _search(text):
        match = Q(customer__name__icontains=text)
        digits = re.sub(r"\D", "", text)
        if digits:
            match |= Q(customer__phone__contains=digits)
        return match


class BookingDetailView(PanelAPIView):
    @extend_schema(summary="A booking with its history", responses=s.PanelBookingDetailSerializer)
    def get(self, request, pk):
        booking = get_object_or_404(bookings_of(request.business), pk=pk)
        services.refresh_if_stale(booking)
        return Response(s.PanelBookingDetailSerializer(booking).data)


class BookingActionView(PanelAPIView):
    """Applies one status change to a booking of the acting business."""

    perform = None  # set by each subclass to a function from apps.bookings.services

    def post(self, request, pk):
        booking = get_object_or_404(bookings_of(request.business), pk=pk)
        try:
            type(self).perform(booking)
        except services.BookingError as error:
            return error_response(error)
        booking = get_object_or_404(bookings_of(request.business), pk=pk)
        return Response(s.PanelBookingDetailSerializer(booking).data)


def action_docs(summary, description):
    return extend_schema(
        summary=summary,
        description=description,
        request=None,
        responses={
            200: s.PanelBookingDetailSerializer,
            404: OpenApiResponse(description="No such booking in this business."),
            409: s.ErrorSerializer,
        },
    )


@action_docs("Confirm a booking", "Only pending bookings; an overdue one answers booking_expired.")
class ConfirmBookingView(BookingActionView):
    perform = staticmethod(services.confirm_booking)


@action_docs("Reject a booking", "Only pending bookings. The slot becomes free.")
class RejectBookingView(BookingActionView):
    perform = staticmethod(services.reject_booking)


@action_docs(
    "Cancel a booking",
    "Pending or confirmed bookings, at any time (the customer's notice period does not apply).",
)
class CancelBookingView(BookingActionView):
    perform = staticmethod(services.cancel_booking_by_business)


@action_docs("Mark a booking as attended", "Only confirmed bookings that have already started.")
class CompleteBookingView(BookingActionView):
    perform = staticmethod(services.complete_booking)


@action_docs("Mark a no-show", "Only confirmed bookings that have already started.")
class NoShowBookingView(BookingActionView):
    perform = staticmethod(services.mark_no_show)
