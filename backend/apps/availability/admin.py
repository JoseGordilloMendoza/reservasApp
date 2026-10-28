from django.contrib import admin

from .models import AvailabilityRule, Block


@admin.register(AvailabilityRule)
class AvailabilityRuleAdmin(admin.ModelAdmin):
    list_display = ("resource", "weekday", "start_time", "end_time", "business")
    list_filter = ("business", "resource", "weekday")


@admin.register(Block)
class BlockAdmin(admin.ModelAdmin):
    list_display = ("business", "resource", "starts_at", "ends_at", "reason")
    list_filter = ("business",)
