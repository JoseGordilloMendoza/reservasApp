from django.conf import settings
from django.contrib import admin
from django.urls import path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

from apps.core.views import health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
]

if settings.API_DOCS_ENABLED:
    urlpatterns += [
        path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
        path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
        path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    ]
