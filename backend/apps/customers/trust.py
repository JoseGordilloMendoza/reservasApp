"""How far a business can trust the person who is booking (D97 to D100).

There are no passwords for customers, so trust rests on two things: having proven who they are with
Google, and what they have done before in that business. It is judged per business, never across them.
"""

from django.db.models import Count

VERIFIED = "verified"
KNOWN = "known"
NEW = "new"
FLAGGED = "flagged"

# The levels whose reservations may be confirmed straight away and held for the longest.
TRUSTED = (VERIFIED, KNOWN)


def history(customer):
    """(attended bookings, no-shows) of this customer in their business."""
    from apps.bookings.models import Booking, BookingStatus

    counts = {
        row["status"]: row["total"]
        for row in Booking.objects.filter(customer=customer).values("status").annotate(total=Count("id"))
    }
    return counts.get(BookingStatus.COMPLETED, 0), counts.get(BookingStatus.NO_SHOW, 0)


def level_for_booking(*, blocked, no_shows, completed, linked_to_google, proven_now):
    """The level of someone who is booking right now.

    A person who linked a Google account to their number is trusted only when they prove it again with
    that account: otherwise anyone could book with their phone and borrow their good name.
    """
    if blocked or no_shows:
        return FLAGGED
    if linked_to_google:
        return VERIFIED if proven_now else NEW
    return KNOWN if completed else NEW


def level_of_booking(*, verified, blocked, no_shows, completed):
    """The level the owner sees on a booking that was already made."""
    if blocked or no_shows:
        return FLAGGED
    if verified:
        return VERIFIED
    return KNOWN if completed else NEW
