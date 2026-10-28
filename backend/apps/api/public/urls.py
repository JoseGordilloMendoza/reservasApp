from django.urls import path

from . import views

urlpatterns = [
    path("businesses/<slug:slug>/", views.BusinessProfileView.as_view(), name="public-business"),
    path(
        "businesses/<slug:slug>/availability/",
        views.AvailabilityView.as_view(),
        name="public-availability",
    ),
    path(
        "businesses/<slug:slug>/bookings/",
        views.CreateBookingView.as_view(),
        name="public-create-booking",
    ),
    path("bookings/<str:token>/", views.BookingDetailView.as_view(), name="public-booking"),
    path(
        "bookings/<str:token>/cancel/",
        views.CancelBookingView.as_view(),
        name="public-cancel-booking",
    ),
]
