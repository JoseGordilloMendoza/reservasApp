from rest_framework import serializers

from apps.businesses.models import Business
from apps.businesses.settings_schema import effective_settings


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
