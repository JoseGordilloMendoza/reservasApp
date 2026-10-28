from django.urls import path

from . import views

urlpatterns = [
    path("business/", views.BusinessView.as_view(), name="panel-business"),
    path("bookings/", views.BookingListView.as_view(), name="panel-bookings"),
    path("bookings/<int:pk>/", views.BookingDetailView.as_view(), name="panel-booking"),
]
