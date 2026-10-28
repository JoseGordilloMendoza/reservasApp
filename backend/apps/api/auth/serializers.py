from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.accounts.models import Membership
from apps.businesses.models import Business

User = get_user_model()


class BusinessSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Business
        fields = ["name", "slug", "status"]


class MembershipSerializer(serializers.ModelSerializer):
    business = BusinessSummarySerializer()

    class Meta:
        model = Membership
        fields = ["business", "role"]


class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="get_full_name")
    is_platform_admin = serializers.BooleanField(source="is_superuser")
    memberships = MembershipSerializer(many=True)

    class Meta:
        model = User
        fields = ["id", "email", "name", "is_platform_admin", "memberships"]


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class GoogleLoginSerializer(serializers.Serializer):
    credential = serializers.CharField(
        help_text="The ID token (JWT) Google gave the browser after the user signed in."
    )


class SessionSerializer(serializers.Serializer):
    access = serializers.CharField(help_text="Short-lived token for the Authorization header.")
    refresh = serializers.CharField(help_text="Used to get a new access token.")
    user = UserSerializer()
