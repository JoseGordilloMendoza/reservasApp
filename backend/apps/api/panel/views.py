from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

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
