from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.api.public.serializers import (
    CustomerInputSerializer,
    ErrorSerializer,
    ResourceRefSerializer,
    ServiceRefSerializer,
)
from apps.availability.models import Block
from apps.bookings.models import Booking, BookingEvent, BookingStatus
from apps.businesses.models import Business
from apps.businesses.settings_schema import effective_settings
from apps.customers.models import Customer


class PanelBusinessSerializer(serializers.ModelSerializer):
    settings = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()

    class Meta:
        model = Business
        fields = ["name", "slug", "business_type", "timezone", "status", "settings", "role"]

    def get_settings(self, business) -> dict:
        """Every option with its effective value (defaults filled in)."""
        return effective_settings(business)

    def get_role(self, business) -> str:
        return self.context["membership"].role


class PanelCustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ["id", "name", "phone", "email", "is_blocked"]


class BookingEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookingEvent
        fields = ["from_status", "to_status", "actor", "created_at"]


class PanelBookingSerializer(serializers.ModelSerializer):
    resource = ResourceRefSerializer()
    service = ServiceRefSerializer()
    customer = PanelCustomerSerializer()
    price = serializers.DecimalField(
        source="price_snapshot", max_digits=8, decimal_places=2, allow_null=True
    )
    duration_minutes = serializers.IntegerField(source="duration_snapshot")

    class Meta:
        model = Booking
        fields = [
            "id",
            "status",
            "starts_at",
            "ends_at",
            "expires_at",
            "source",
            "resource",
            "service",
            "customer",
            "price",
            "duration_minutes",
            "created_at",
        ]


class PanelBookingDetailSerializer(PanelBookingSerializer):
    events = BookingEventSerializer(many=True)

    class Meta(PanelBookingSerializer.Meta):
        fields = PanelBookingSerializer.Meta.fields + ["events"]


class PanelBookingCreateSerializer(serializers.Serializer):
    service = serializers.IntegerField()
    starts_at = serializers.DateTimeField()
    customer = CustomerInputSerializer()


class PanelBookingCreatedSerializer(PanelBookingDetailSerializer):
    manage_token = serializers.CharField(
        read_only=True,
        help_text="Link token the customer can use to view or cancel; shown only once.",
    )

    class Meta(PanelBookingDetailSerializer.Meta):
        fields = PanelBookingDetailSerializer.Meta.fields + ["manage_token"]


class CustomerListSerializer(serializers.ModelSerializer):
    bookings_count = serializers.IntegerField(read_only=True)
    last_booking_at = serializers.DateTimeField(read_only=True, allow_null=True)

    class Meta:
        model = Customer
        fields = [
            "id",
            "name",
            "phone",
            "email",
            "is_blocked",
            "created_at",
            "bookings_count",
            "last_booking_at",
        ]


class CustomerBookingSerializer(serializers.ModelSerializer):
    resource = ResourceRefSerializer()
    service = ServiceRefSerializer()

    class Meta:
        model = Booking
        fields = ["id", "status", "starts_at", "ends_at", "resource", "service"]


class CustomerDetailSerializer(CustomerListSerializer):
    bookings = serializers.SerializerMethodField()

    class Meta(CustomerListSerializer.Meta):
        fields = CustomerListSerializer.Meta.fields + ["bookings"]

    @extend_schema_field(CustomerBookingSerializer(many=True))
    def get_bookings(self, customer):
        history = customer.bookings.select_related("resource", "service").order_by("-starts_at")
        return CustomerBookingSerializer(history, many=True).data


class CustomerUpdateSerializer(serializers.ModelSerializer):
    """The phone identifies the customer and cannot be changed."""

    class Meta:
        model = Customer
        fields = ["name", "email", "is_blocked"]


class BlockSerializer(serializers.ModelSerializer):
    resource = ResourceRefSerializer(allow_null=True, read_only=True)

    class Meta:
        model = Block
        fields = ["id", "resource", "starts_at", "ends_at", "reason"]


class ConflictingBookingSerializer(serializers.ModelSerializer):
    resource = ResourceRefSerializer()
    customer_name = serializers.CharField(source="customer.name")

    class Meta:
        model = Booking
        fields = ["id", "status", "starts_at", "ends_at", "resource", "customer_name"]


class BlockCreatedSerializer(BlockSerializer):
    conflicting_bookings = ConflictingBookingSerializer(many=True, read_only=True)

    class Meta(BlockSerializer.Meta):
        fields = BlockSerializer.Meta.fields + ["conflicting_bookings"]


class BlockCreateSerializer(serializers.Serializer):
    resource = serializers.IntegerField(
        required=False,
        allow_null=True,
        default=None,
        help_text="Resource id, or empty to close the whole business.",
    )
    starts_at = serializers.DateTimeField()
    ends_at = serializers.DateTimeField()
    reason = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")

    def validate(self, attrs):
        if attrs["ends_at"] <= attrs["starts_at"]:
            raise serializers.ValidationError({"ends_at": "Must be after starts_at."})
        return attrs


class BookingFilterSerializer(serializers.Serializer):
    status = serializers.CharField(
        required=False, help_text="One or more statuses, comma separated."
    )
    resource = serializers.IntegerField(required=False)
    date_from = serializers.DateField(required=False, help_text="Local date, inclusive.")
    date_to = serializers.DateField(required=False, help_text="Local date, inclusive.")
    q = serializers.CharField(required=False, help_text="Customer name or phone.")
    ordering = serializers.ChoiceField(
        choices=["starts_at", "-starts_at"], required=False, default="starts_at"
    )

    def validate_status(self, value):
        statuses = [item.strip() for item in value.split(",") if item.strip()]
        invalid = [item for item in statuses if item not in BookingStatus.values]
        if invalid:
            raise serializers.ValidationError(f"Unknown status: {', '.join(invalid)}")
        return statuses

    def validate(self, attrs):
        start, end = attrs.get("date_from"), attrs.get("date_to")
        if start and end and end < start:
            raise serializers.ValidationError("date_to must not be before date_from.")
        return attrs
