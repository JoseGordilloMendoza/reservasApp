from django.core.management.base import BaseCommand

from apps.bookings.services import expire_stale_bookings


class Command(BaseCommand):
    help = "Mark pending bookings whose hold has run out as expired."

    def handle(self, *args, **options):
        count = expire_stale_bookings()
        self.stdout.write(f"Expired {count} pending booking(s).")
