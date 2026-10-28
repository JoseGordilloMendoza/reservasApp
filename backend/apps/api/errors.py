from rest_framework import status
from rest_framework.response import Response

from apps.bookings import services

# How each booking rule violation is reported over HTTP.
ERROR_STATUS = {
    services.SlotUnavailable: status.HTTP_409_CONFLICT,
    services.SlotBlocked: status.HTTP_409_CONFLICT,
    services.SlotInPast: status.HTTP_400_BAD_REQUEST,
    services.TooManyActiveBookings: status.HTTP_409_CONFLICT,
    services.NotCancellable: status.HTTP_409_CONFLICT,
    services.InvalidTransition: status.HTTP_409_CONFLICT,
    services.BookingExpired: status.HTTP_409_CONFLICT,
    services.NotStartedYet: status.HTTP_409_CONFLICT,
    services.BookingNotAllowed: status.HTTP_403_FORBIDDEN,
    services.CancellationWindowClosed: status.HTTP_403_FORBIDDEN,
}


def error_response(error):
    http_status = ERROR_STATUS.get(type(error), status.HTTP_400_BAD_REQUEST)
    return Response({"code": error.code, "detail": error.message}, status=http_status)
