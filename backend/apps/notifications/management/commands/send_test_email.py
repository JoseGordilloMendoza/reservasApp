from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = (
        "Send one test email with the current settings and show what is configured. "
        "Unlike the notices the app sends, a failure here is shown in full, so it is the way "
        "to check a new provider's credentials."
    )

    def add_arguments(self, parser):
        parser.add_argument("to", help="Address that should receive the test email.")

    def handle(self, *args, to, **options):
        backend = settings.EMAIL_BACKEND.rsplit(".", 2)[-2]
        self.stdout.write(f"Backend: {backend}")
        if settings.EMAIL_HOST:
            security = "SSL" if settings.EMAIL_USE_SSL else "STARTTLS" if settings.EMAIL_USE_TLS else "none"
            self.stdout.write(f"Server: {settings.EMAIL_HOST}:{settings.EMAIL_PORT} ({security})")
            self.stdout.write(f"User: {settings.EMAIL_HOST_USER or '(none)'}")
        self.stdout.write(f"From: {settings.DEFAULT_FROM_EMAIL}")
        self.stdout.write(f"To: {to}")

        try:
            send_mail(
                "Prueba de correo",
                "Si lees esto, el envío de correos está bien configurado.",
                settings.DEFAULT_FROM_EMAIL,
                [to],
                fail_silently=False,
            )
        except Exception as error:
            raise CommandError(f"The email could not be sent: {error!r}")

        self.stdout.write(self.style.SUCCESS("Sent. If it does not arrive, look in the spam folder."))
