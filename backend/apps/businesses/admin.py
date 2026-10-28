from django.contrib import admin

from .models import Business


@admin.register(Business)
class BusinessAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "business_type", "status", "created_at")
    list_filter = ("business_type", "status")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
