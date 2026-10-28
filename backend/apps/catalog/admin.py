from django.contrib import admin

from .models import Resource, Service


@admin.register(Resource)
class ResourceAdmin(admin.ModelAdmin):
    list_display = ("name", "business", "is_active", "position")
    list_filter = ("business", "is_active")


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("name", "resource", "business", "duration_minutes", "reference_price")
    list_filter = ("business", "is_active")
