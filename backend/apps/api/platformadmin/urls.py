from django.urls import path

from . import views

urlpatterns = [
    path("dashboard/", views.DashboardView.as_view(), name="platform-dashboard"),
    path("businesses/", views.BusinessListView.as_view(), name="platform-businesses"),
    path("businesses/<slug:slug>/", views.BusinessDetailView.as_view(), name="platform-business"),
]
