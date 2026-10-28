import re
from datetime import datetime, time, timedelta
from datetime import timezone as dt_timezone
from zoneinfo import ZoneInfo

from django.db.models import Count, Max, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import generics, serializers
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.api.errors import error_response
from apps.availability.models import Block
from apps.bookings import services
from apps.bookings.models import ACTIVE_STATUSES, Booking
from apps.catalog.models import Resource, Service
from apps.customers.models import Customer

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
        return self.respond(request)

    @extend_schema(
        summary="Edit the business page and options",
        description=(
            "Name, description, address, phone, WhatsApp and settings. Settings are merged: "
            "send only the ones to change. The link, type and timezone cannot be changed."
        ),
        request=s.BusinessUpdateSerializer,
        responses={200: s.PanelBusinessSerializer, 400: OpenApiResponse(description="Invalid data.")},
    )
    def patch(self, request):
        update = s.BusinessUpdateSerializer(request.business, data=request.data, partial=True)
        update.is_valid(raise_exception=True)
        update.save()
        return self.respond(request)

    @staticmethod
    def respond(request):
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


def customers_of(business):
    return Customer.objects.filter(business=business).annotate(
        bookings_count=Count("bookings"), last_booking_at=Max("bookings__starts_at")
    )


class CustomerListView(generics.ListAPIView):
    permission_classes = [HasBusiness]
    pagination_class = BookingPagination
    serializer_class = s.CustomerListSerializer

    @extend_schema(
        summary="List customers",
        parameters=[
            OpenApiParameter("q", str, description="Name or phone."),
            OpenApiParameter("blocked", bool, description="Only blocked (true) or only allowed (false)."),
        ],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        customers = customers_of(self.request.business)

        text = self.request.query_params.get("q", "").strip()
        if text:
            match = Q(name__icontains=text)
            digits = re.sub(r"\D", "", text)
            if digits:
                match |= Q(phone__contains=digits)
            customers = customers.filter(match)

        blocked = self.request.query_params.get("blocked")
        if blocked in ("true", "1"):
            customers = customers.filter(is_blocked=True)
        elif blocked in ("false", "0"):
            customers = customers.filter(is_blocked=False)
        return customers.order_by("name", "id")


class CustomerDetailView(PanelAPIView):
    def customer(self, request, pk):
        return get_object_or_404(customers_of(request.business), pk=pk)

    @staticmethod
    def respond(customer):
        return Response(s.CustomerDetailSerializer(customer).data)

    @extend_schema(summary="A customer and their bookings", responses=s.CustomerDetailSerializer)
    def get(self, request, pk):
        return self.respond(self.customer(request, pk))

    @extend_schema(
        summary="Update or block a customer",
        description="Name, email and is_blocked. A blocked customer cannot book online.",
        request=s.CustomerUpdateSerializer,
        responses=s.CustomerDetailSerializer,
    )
    def patch(self, request, pk):
        customer = self.customer(request, pk)
        update = s.CustomerUpdateSerializer(customer, data=request.data, partial=True)
        update.is_valid(raise_exception=True)
        update.save()
        return self.respond(self.customer(request, pk))


class BlockListCreateView(generics.ListAPIView):
    permission_classes = [HasBusiness]
    pagination_class = BookingPagination
    serializer_class = s.BlockSerializer

    @extend_schema(
        summary="List blocks",
        description="Upcoming ones by default. Filtering by resource also includes business-wide blocks.",
        parameters=[
            OpenApiParameter("resource", int),
            OpenApiParameter("include_past", bool, description="Also blocks that already ended."),
        ],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        blocks = Block.objects.filter(business=self.request.business).select_related("resource")

        resource = self.request.query_params.get("resource")
        if resource and resource.isdigit():
            blocks = blocks.filter(Q(resource_id=int(resource)) | Q(resource__isnull=True))
        if self.request.query_params.get("include_past") not in ("true", "1"):
            blocks = blocks.filter(ends_at__gte=timezone.now())
        return blocks.order_by("starts_at", "id")

    @extend_schema(
        summary="Block a period",
        description=(
            "Closes one resource, or the whole business when no resource is given. Existing "
            "bookings are not cancelled; the ones in conflict are listed so the owner can decide."
        ),
        request=s.BlockCreateSerializer,
        responses={201: s.BlockCreatedSerializer, 400: OpenApiResponse(description="Invalid data.")},
    )
    def post(self, request):
        body = s.BlockCreateSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        data = body.validated_data

        resource = None
        if data["resource"] is not None:
            # A resource of another business is reported like a missing one.
            resource = Resource.objects.filter(business=request.business, pk=data["resource"]).first()
            if resource is None:
                raise serializers.ValidationError({"resource": "No existe ese recurso."})

        block = Block.objects.create(
            business=request.business,
            resource=resource,
            starts_at=data["starts_at"],
            ends_at=data["ends_at"],
            reason=data["reason"],
        )
        block.conflicting_bookings = self._conflicts(block)
        return Response(s.BlockCreatedSerializer(block).data, status=201)

    @staticmethod
    def _conflicts(block):
        overlapping = Booking.objects.filter(
            business=block.business,
            status__in=ACTIVE_STATUSES,
            starts_at__lt=block.ends_at,
            ends_at__gt=block.starts_at,
        ).select_related("resource", "customer")
        if block.resource_id:
            overlapping = overlapping.filter(resource_id=block.resource_id)
        return list(overlapping.order_by("starts_at"))


class BlockDetailView(PanelAPIView):

    @extend_schema(
        summary="Remove a block",
        responses={204: None, 404: OpenApiResponse(description="No such block in this business.")},
    )
    def delete(self, request, pk):
        block = get_object_or_404(Block, pk=pk, business=request.business)
        block.delete()
        return Response(status=204)


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
