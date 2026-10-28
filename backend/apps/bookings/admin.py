from django.contrib import admin

from .models import Booking


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ("resource", "customer", "starts_at", "ends_at", "status", "business")
    list_filter = ("business", "status", "resource")
    date_hierarchy = "starts_at"
