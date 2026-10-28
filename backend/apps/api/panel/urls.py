from django.urls import path

from . import views

urlpatterns = [
    path("business/", views.BusinessView.as_view(), name="panel-business"),
]
