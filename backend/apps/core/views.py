from django.db import connection
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@extend_schema(
    summary="Health check",
    description="Reports whether the API and its database are reachable.",
    responses={
        200: OpenApiResponse(description="API and database are up."),
        503: OpenApiResponse(description="The database is unreachable."),
    },
    auth=[],
)
@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception:
        return Response(
            {"status": "error", "database": "unreachable"},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return Response({"status": "ok", "database": "ok"})
