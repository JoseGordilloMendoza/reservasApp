"""Who is told what when a booking changes. Each function sends its emails and returns nothing.

They are safe to call from anywhere: sending never raises (see mail.send_email). The services call
them once the change is committed, so nobody is notified about something that was rolled back.
"""

from apps.accounts.models import Membership
from apps.bookings.models import Booking

from . import messages
from .mail import send_email


def _team_emails(business):
    """Everyone who works the panel of the business, owner and staff."""
    return list(
        Membership.objects.filter(business=business, user__is_active=True).values_list(
            "user__email", flat=True
        )
    )


def _tell_customer(booking, event, subject_and_body):
    # The email is optional for customers; without it there is nobody to write to.
    if booking.customer.email:
        subject, body = subject_and_body
        send_email([booking.customer.email], subject, body, event=event)


def _tell_team(booking, event, subject_and_body):
    subject, body = subject_and_body
    send_email(_team_emails(booking.business), subject, body, event=event)


def booking_created_online(booking, token):
    """A customer booked: the team hears about it, and the customer gets a receipt."""
    _tell_team(booking, "booking_created", messages.business_new_booking(booking))
    if booking.expires_at is not None:
        _tell_customer(booking, "booking_received", messages.customer_received(booking, token))
    else:
        # Automatic confirmation: it is confirmed from the start.
        _tell_customer(booking, "booking_confirmed", messages.customer_confirmed(booking, token))


def booking_created_by_business(booking, token):
    """The business wrote it down itself: only the customer needs to know."""
    _tell_customer(booking, "booking_confirmed", messages.customer_confirmed(booking, token))


def booking_confirmed(booking):
    _tell_customer(booking, "booking_confirmed", messages.customer_confirmed(booking))


def booking_rejected(booking):
    _tell_customer(booking, "booking_rejected", messages.customer_rejected(booking))


def booking_cancelled_by_business(booking):
    _tell_customer(booking, "booking_cancelled", messages.customer_cancelled_by_business(booking))


def booking_cancelled_by_customer(booking):
    _tell_team(booking, "booking_cancelled_by_customer", messages.business_cancelled_by_customer(booking))


def booking_expired(booking_id):
    """The hold ran out. Takes the id because it is called when the booking was just updated."""
    booking = (
        Booking.objects.select_related("business", "service", "resource", "customer")
        .filter(pk=booking_id)
        .first()
    )
    if booking is not None:
        _tell_customer(booking, "booking_expired", messages.customer_expired(booking))
