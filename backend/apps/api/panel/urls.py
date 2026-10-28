from django.urls import path

from . import views

urlpatterns = [
    path("business/", views.BusinessView.as_view(), name="panel-business"),
    path("bookings/", views.BookingListView.as_view(), name="panel-bookings"),
    path("bookings/<int:pk>/", views.BookingDetailView.as_view(), name="panel-booking"),
    path(
        "bookings/<int:pk>/confirm/",
        views.ConfirmBookingView.as_view(),
        name="panel-booking-confirm",
    ),
    path(
        "bookings/<int:pk>/reject/", views.RejectBookingView.as_view(), name="panel-booking-reject"
    ),
    path(
        "bookings/<int:pk>/cancel/", views.CancelBookingView.as_view(), name="panel-booking-cancel"
    ),
    path(
        "bookings/<int:pk>/complete/",
        views.CompleteBookingView.as_view(),
        name="panel-booking-complete",
    ),
    path(
        "bookings/<int:pk>/no-show/",
        views.NoShowBookingView.as_view(),
        name="panel-booking-no-show",
    ),
]
