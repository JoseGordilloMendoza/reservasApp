from django.contrib import admin

from .models import Booking, BookingEvent


class BookingEventInline(admin.TabularInline):
    model = BookingEvent
    extra = 0
    can_delete = False
    readonly_fields = ("from_status", "to_status", "actor", "created_at")

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ("resource", "customer", "starts_at", "ends_at", "status", "business")
    list_filter = ("business", "status", "resource")
    date_hierarchy = "starts_at"
    inlines = [BookingEventInline]
