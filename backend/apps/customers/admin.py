from django.contrib import admin

from .models import Customer


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("name", "phone", "business", "is_blocked")
    list_filter = ("business", "is_blocked")
    search_fields = ("name", "phone")
