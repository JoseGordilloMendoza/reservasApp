from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.bookings.models import Booking, BookingStatus
from apps.bookings.phone import InvalidPhone, normalize_phone
from apps.bookings.services import cancellation_deadline
from apps.businesses.models import Business
from apps.catalog.models import Resource, Service


class ErrorSerializer(serializers.Serializer):
    code = serializers.CharField()
    detail = serializers.CharField()


# --- business profile ---------------------------------------------------------


class ServicePublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = ["id", "name", "duration_minutes", "reference_price"]


class ResourcePublicSerializer(serializers.ModelSerializer):
    services = ServicePublicSerializer(source="active_services", many=True)

    class Meta:
        model = Resource
        fields = ["id", "name", "services"]


class BusinessPublicSerializer(serializers.ModelSerializer):
    resources = ResourcePublicSerializer(source="active_resources", many=True)

    class Meta:
        model = Business
        fields = [
            "name",
            "slug",
            "description",
            "address",
            "phone",
            "whatsapp",
            "business_type",
            "timezone",
            "resources",
        ]


# --- availability -------------------------------------------------------------


class AvailabilityQuerySerializer(serializers.Serializer):
    resource = serializers.IntegerField()
    service = serializers.IntegerField()
    date = serializers.DateField()
    to_date = serializers.DateField(required=False)


class SlotSerializer(serializers.Serializer):
    starts_at = serializers.DateTimeField()
    ends_at = serializers.DateTimeField()


class AvailabilityResponseSerializer(serializers.Serializer):
    timezone = serializers.CharField(help_text="Business timezone; slots are in UTC.")
    slots = SlotSerializer(many=True)


# --- creating a booking -------------------------------------------------------


class CustomerInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    phone = serializers.CharField(
        max_length=30, help_text="Peruvian mobile (987654321) or international (+57...)."
    )
    email = serializers.EmailField(required=False, allow_blank=True, default="")

    def validate_phone(self, value):
        try:
            return normalize_phone(value)
        except InvalidPhone:
            raise serializers.ValidationError("El número de celular no es válido.")


class CreateBookingSerializer(serializers.Serializer):
    service = serializers.IntegerField()
    starts_at = serializers.DateTimeField(help_text="Start of a slot returned by availability.")
    customer = CustomerInputSerializer()
    accepted_terms = serializers.BooleanField()

    def validate_accepted_terms(self, value):
        if not value:
            raise serializers.ValidationError("Debes aceptar los términos para reservar.")
        return value


# --- booking details ----------------------------------------------------------


class ResourceRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resource
        fields = ["id", "name"]


class ServiceRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = ["id", "name"]


class BusinessRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Business
        fields = ["name", "slug"]


class BookingPublicSerializer(serializers.ModelSerializer):
    business = BusinessRefSerializer()
    resource = ResourceRefSerializer()
    service = ServiceRefSerializer()
    customer_name = serializers.CharField(source="customer.name")
    price = serializers.DecimalField(
        source="price_snapshot", max_digits=8, decimal_places=2, allow_null=True
    )
    duration_minutes = serializers.IntegerField(source="duration_snapshot")
    can_cancel = serializers.SerializerMethodField()
    cancel_deadline = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            "status",
            "starts_at",
            "ends_at",
            "expires_at",
            "business",
            "resource",
            "service",
            "customer_name",
            "price",
            "duration_minutes",
            "can_cancel",
            "cancel_deadline",
        ]

    @extend_schema_field(serializers.BooleanField())
    def get_can_cancel(self, booking):
        if booking.status == BookingStatus.PENDING:
            return True
        return (
            booking.status == BookingStatus.CONFIRMED
            and timezone.now() <= cancellation_deadline(booking)
        )

    @extend_schema_field(serializers.DateTimeField())
    def get_cancel_deadline(self, booking):
        """Last moment to cancel a confirmed booking online. Pending ones can always be cancelled."""
        return cancellation_deadline(booking)


class BookingCreatedSerializer(BookingPublicSerializer):
    manage_token = serializers.CharField(
        read_only=True,
        help_text="Shown only once. Needed to view or cancel the booking later.",
    )

    class Meta(BookingPublicSerializer.Meta):
        fields = BookingPublicSerializer.Meta.fields + ["manage_token"]
