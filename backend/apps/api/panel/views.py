import re
from datetime import datetime, time, timedelta
from datetime import timezone as dt_timezone
from zoneinfo import ZoneInfo

from django.db.models import Q
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.bookings import services
from apps.bookings.models import Booking

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
        description="Newest filters first: status, resource, local dates, customer search.",
        parameters=[s.BookingFilterSerializer],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

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
