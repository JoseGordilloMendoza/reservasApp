from django.urls import path

from . import views

urlpatterns = [
    path("dashboard/", views.DashboardView.as_view(), name="platform-dashboard"),
    path("businesses/", views.BusinessListView.as_view(), name="platform-businesses"),
    path("businesses/<slug:slug>/", views.BusinessDetailView.as_view(), name="platform-business"),
    path("businesses/<slug:slug>/suspend/", views.SuspendView.as_view(), name="platform-suspend"),
    path("businesses/<slug:slug>/reactivate/", views.ReactivateView.as_view(), name="platform-reactivate"),
    path(
        "businesses/<slug:slug>/subscription/",
        views.SubscriptionView.as_view(),
        name="platform-subscription",
    ),
    path("businesses/<slug:slug>/payments/", views.PaymentListView.as_view(), name="platform-payments"),
    path("businesses/<slug:slug>/users/", views.MemberListView.as_view(), name="platform-users"),
    path(
        "businesses/<slug:slug>/users/<int:pk>/",
        views.MemberDetailView.as_view(),
        name="platform-user",
    ),
    path(
        "businesses/<slug:slug>/users/<int:pk>/send-link/",
        views.MemberSendLinkView.as_view(),
        name="platform-user-link",
    ),
]
