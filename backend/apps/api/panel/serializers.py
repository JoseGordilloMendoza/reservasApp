from datetime import time

from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.api.public.serializers import (
    CustomerInputSerializer,
    ErrorSerializer,
    ResourceRefSerializer,
    ServiceRefSerializer,
)
from apps.availability.models import AvailabilityRule, Block
from apps.bookings.models import Booking, BookingEvent, BookingStatus
from apps.bookings.phone import InvalidPhone, normalize_phone
from apps.businesses.models import Business
from apps.businesses.presets import preset_for
from apps.businesses.settings_schema import effective_settings, validate_settings
from apps.catalog.models import Resource, Service
from apps.customers.models import Customer


class PanelBusinessSerializer(serializers.ModelSerializer):
    settings = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    suggested_service_duration_minutes = serializers.SerializerMethodField()

    class Meta:
        model = Business
        fields = [
            "name",
            "slug",
            "description",
            "address",
            "phone",
            "whatsapp",
            "accent",
            "business_type",
            "timezone",
            "status",
            "settings",
            "suggested_service_duration_minutes",
            "role",
        ]

    def get_settings(self, business) -> dict:
        """Every option with its effective value (defaults filled in)."""
        return effective_settings(business)

    def get_role(self, business) -> str:
        return self.context["membership"].role

    def get_suggested_service_duration_minutes(self, business) -> int:
        """Starting duration for a new service, from the business type's preset."""
        return preset_for(business.business_type).service_duration_minutes


def _optional_phone(value):
    if not value:
        return ""
    try:
        return normalize_phone(value)
    except InvalidPhone:
        raise serializers.ValidationError("El número de teléfono no es válido.")


class BusinessUpdateSerializer(serializers.ModelSerializer):
    """What the owner may change. The link, type, timezone and status are not editable."""

    settings = serializers.DictField(
        required=False,
        help_text="Only the options to change; the others keep their value.",
    )

    class Meta:
        model = Business
        fields = ["name", "description", "address", "phone", "whatsapp", "accent", "settings"]

    def validate_phone(self, value):
        return _optional_phone(value)

    def validate_whatsapp(self, value):
        return _optional_phone(value)

    def validate_settings(self, value):
        try:
            validate_settings(value)
        except DjangoValidationError as error:
            raise serializers.ValidationError(error.messages)
        return value

    def update(self, business, validated):
        if "settings" in validated:
            validated["settings"] = {**business.settings, **validated["settings"]}
        return super().update(business, validated)


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


class ResourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resource
        fields = ["id", "name", "is_active", "position"]

    def validate_name(self, value):
        business = self.context["request"].business
        taken = Resource.objects.filter(business=business, name=value)
        if self.instance:
            taken = taken.exclude(pk=self.instance.pk)
        if taken.exists():
            raise serializers.ValidationError("Ya tienes un recurso con ese nombre.")
        return value


class ServiceSerializer(serializers.ModelSerializer):
    resource = ResourceRefSerializer(read_only=True)
    resource_id = serializers.IntegerField(
        write_only=True, required=False, help_text="Required when creating; cannot be changed."
    )
    duration_minutes = serializers.IntegerField(
        min_value=5,
        max_value=1440,
        required=False,
        help_text="Defaults to the duration the business type suggests.",
    )
    reference_price = serializers.DecimalField(
        max_digits=8, decimal_places=2, min_value=0, required=False, allow_null=True
    )

    class Meta:
        model = Service
        fields = [
            "id",
            "resource",
            "resource_id",
            "name",
            "duration_minutes",
            "reference_price",
            "settings",
            "is_active",
        ]

    def validate_settings(self, value):
        try:
            validate_settings(value)
        except DjangoValidationError as error:
            raise serializers.ValidationError(error.messages)
        return value

    def validate(self, attrs):
        business = self.context["request"].business
        resource_id = attrs.pop("resource_id", None)

        if self.instance is None:
            if resource_id is None:
                raise serializers.ValidationError({"resource_id": "Este campo es obligatorio."})
            # A resource of another business is reported like a missing one.
            resource = Resource.objects.filter(business=business, pk=resource_id).first()
            if resource is None:
                raise serializers.ValidationError({"resource_id": "No existe ese recurso."})
            attrs["resource"] = resource
            attrs.setdefault(
                "duration_minutes", preset_for(business.business_type).service_duration_minutes
            )
        elif resource_id is not None and resource_id != self.instance.resource_id:
            raise serializers.ValidationError(
                {"resource_id": "Un servicio no se puede mover a otro recurso."}
            )
        return attrs


WEEKDAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
MAX_SCHEDULE_RULES = 50


class ScheduleRuleSerializer(serializers.ModelSerializer):
    weekday = serializers.IntegerField(min_value=0, max_value=6, help_text="0 = Monday ... 6 = Sunday")

    class Meta:
        model = AvailabilityRule
        fields = ["weekday", "start_time", "end_time"]

    def validate(self, attrs):
        start, end = attrs["start_time"], attrs["end_time"]
        # An end of 00:00 means midnight; 00:00-00:00 is open all day.
        if end != time.min and end <= start:
            raise serializers.ValidationError(
                {"end_time": "Debe ser posterior a la hora de inicio (00:00 significa medianoche)."}
            )
        return attrs


class ScheduleSerializer(serializers.Serializer):
    rules = ScheduleRuleSerializer(many=True, max_length=MAX_SCHEDULE_RULES)

    def validate_rules(self, rules):
        by_day = {}
        for rule in rules:
            end = rule["end_time"] if rule["end_time"] != time.min else time.max
            by_day.setdefault(rule["weekday"], []).append((rule["start_time"], end))

        for weekday, windows in by_day.items():
            windows.sort()
            for (_, earlier_end), (later_start, _) in zip(windows, windows[1:]):
                if later_start < earlier_end:
                    raise serializers.ValidationError(
                        f"Los horarios del {WEEKDAY_NAMES[weekday]} se solapan."
                    )
        return rules


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
