from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from rest_framework import serializers

from apps.billing.models import Subscription, SubscriptionPayment
from apps.billing.services import standing
from apps.businesses.models import Business
from apps.businesses.validators import validate_slug_not_reserved


def check_timezone(value):
    try:
        ZoneInfo(value)
    except (ZoneInfoNotFoundError, ValueError):
        raise serializers.ValidationError("No es una zona horaria válida, por ejemplo America/Lima.")
    return value



class StandingSerializer(serializers.Serializer):
    state = serializers.CharField()
    valid_until = serializers.DateField(allow_null=True)
    grace_ends_on = serializers.DateField(allow_null=True)
    days_left = serializers.IntegerField(allow_null=True)


def subscription_of(business):
    """The business's Subscription, or None, without raising when it has none."""
    try:
        return business.subscription
    except Subscription.DoesNotExist:
        return None


def standing_of(business):
    """Where the business stands today. Reads the subscription already loaded on the business."""
    return standing(business, subscription=subscription_of(business))


class SubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = ["plan_name", "price", "started_on", "valid_until", "notes", "updated_at"]
        read_only_fields = fields


class BusinessRowSerializer(serializers.ModelSerializer):
    """One line of the list of businesses."""

    standing = serializers.SerializerMethodField()
    plan_name = serializers.SerializerMethodField()
    price = serializers.SerializerMethodField()
    users_count = serializers.IntegerField(read_only=True)
    bookings_30d = serializers.IntegerField(read_only=True)

    class Meta:
        model = Business
        fields = [
            "slug",
            "name",
            "business_type",
            "status",
            "created_at",
            "standing",
            "plan_name",
            "price",
            "users_count",
            "bookings_30d",
        ]

    def get_standing(self, business) -> dict:
        return StandingSerializer(standing_of(business)).data

    def get_plan_name(self, business) -> str | None:
        subscription = subscription_of(business)
        return subscription.plan_name if subscription else None

    def get_price(self, business) -> str | None:
        subscription = subscription_of(business)
        return str(subscription.price) if subscription else None


class BusinessDetailSerializer(BusinessRowSerializer):
    subscription = serializers.SerializerMethodField()
    suspended_reason = serializers.CharField(read_only=True)

    class Meta(BusinessRowSerializer.Meta):
        fields = BusinessRowSerializer.Meta.fields + [
            "subscription",
            "suspended_reason",
            "timezone",
            "accent",
            "description",
            "address",
            "phone",
            "whatsapp",
        ]

    def get_subscription(self, business) -> dict | None:
        subscription = subscription_of(business)
        return SubscriptionSerializer(subscription).data if subscription else None


class BusinessUpdateSerializer(serializers.ModelSerializer):
    """What the team may change of a business. The link (slug) is left alone on purpose (D79)."""

    class Meta:
        model = Business
        fields = ["name", "business_type", "timezone"]

    validate_timezone = staticmethod(check_timezone)


class PaymentSerializer(serializers.ModelSerializer):
    recorded_by = serializers.SerializerMethodField()

    class Meta:
        model = SubscriptionPayment
        fields = [
            "id",
            "amount",
            "method",
            "paid_on",
            "months",
            "period_start",
            "period_end",
            "reference",
            "note",
            "recorded_by",
            "created_at",
        ]
        read_only_fields = fields

    def get_recorded_by(self, payment) -> str | None:
        return payment.recorded_by.email if payment.recorded_by else None


class OwnerInputSerializer(serializers.Serializer):
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")


class SubscriptionInputSerializer(serializers.Serializer):
    plan_name = serializers.CharField(max_length=60, required=False, allow_blank=True, default="")
    price = serializers.DecimalField(max_digits=8, decimal_places=2, min_value=0)
    valid_until = serializers.DateField(required=False)
    trial_days = serializers.IntegerField(
        required=False, min_value=1, max_value=365, help_text="Alternative to valid_until: days from today."
    )

    def validate(self, attrs):
        if ("valid_until" in attrs) == ("trial_days" in attrs):
            raise serializers.ValidationError("Indica la vigencia con valid_until o con trial_days, no ambas ni ninguna.")
        return attrs


class BusinessCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    slug = serializers.SlugField(
        max_length=63,
        required=False,
        validators=[validate_slug_not_reserved],
        help_text="The public link. Made from the name when left out.",
    )
    business_type = serializers.ChoiceField(choices=Business.BusinessType.choices, default=Business.BusinessType.GENERIC)
    timezone = serializers.CharField(max_length=64, default="America/Lima", validators=[check_timezone])
    owner = OwnerInputSerializer()
    subscription = SubscriptionInputSerializer()
