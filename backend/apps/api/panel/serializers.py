from rest_framework import serializers

from apps.api.public.serializers import ErrorSerializer, ResourceRefSerializer, ServiceRefSerializer
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
