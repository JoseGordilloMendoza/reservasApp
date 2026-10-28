from datetime import time

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import Membership
from apps.availability.models import AvailabilityRule
from apps.businesses.models import Business
from apps.catalog.models import Resource, Service

DEMO_PASSWORD = "demo12345"

DEMOS = [
    {
        "business": {
            "slug": "canchas-los-andes",
            "name": "Canchas Los Andes",
            "business_type": Business.BusinessType.COURT,
            "accent": Business.Accent.LIME,
            "description": "Grass sintético y luces LED. Vestidores y estacionamiento.",
            "address": "Av. Ejército 123, Cayma",
            "phone": "+51987654321",
            "whatsapp": "+51987654321",
        },
        "owner": "canchas@demo.pe",
        "resources": [
            {"name": "Cancha 1", "service": "Alquiler 1 hora", "minutes": 60, "price": "60.00"},
            {"name": "Cancha 2", "service": "Alquiler 1 hora", "minutes": 60, "price": "70.00"},
        ],
        # Every day, 17:00 to 23:00.
        "schedule": [(day, time(17), time(23)) for day in range(7)],
    },
    {
        "business": {
            "slug": "consultorio-lucia",
            "name": "Consultorio Lucía Quispe",
            "business_type": Business.BusinessType.PSYCHOLOGIST,
            "accent": Business.Accent.COBALT,
            "description": "Psicología clínica y de pareja. Atención con cita.",
            "address": "Calle Mercaderes 100, Cercado",
            "phone": "+51912345678",
            "whatsapp": "+51912345678",
        },
        "owner": "consultorio@demo.pe",
        "resources": [
            {"name": "Consultorio 1", "service": "Sesión individual", "minutes": 50, "price": "120.00"},
        ],
        # Weekdays, mornings and afternoons.
        "schedule": [
            window
            for day in range(5)
            for window in ((day, time(9), time(13)), (day, time(15), time(19)))
        ],
    },
]


class Command(BaseCommand):
    help = "Create two demo businesses (a court and a therapist) with their owners. Development only."

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("seed_demo creates accounts with a known password: development only.")

        User = get_user_model()
        for demo in DEMOS:
            data = demo["business"]
            if Business.objects.filter(slug=data["slug"]).exists():
                self.stdout.write(f"{data['slug']}: already exists, left as it is.")
                continue

            business = Business.objects.create(**data)
            for position, spec in enumerate(demo["resources"]):
                resource = Resource.objects.create(business=business, name=spec["name"], position=position)
                Service.objects.create(
                    business=business,
                    resource=resource,
                    name=spec["service"],
                    duration_minutes=spec["minutes"],
                    reference_price=spec["price"],
                )
                for weekday, start, end in demo["schedule"]:
                    AvailabilityRule.objects.create(
                        business=business,
                        resource=resource,
                        weekday=weekday,
                        start_time=start,
                        end_time=end,
                    )

            owner = User.objects.create_user(demo["owner"], DEMO_PASSWORD)
            Membership.objects.create(user=owner, business=business, role=Membership.Role.OWNER)
            self.stdout.write(f"{data['slug']}: created. Panel login {demo['owner']} / {DEMO_PASSWORD}")
