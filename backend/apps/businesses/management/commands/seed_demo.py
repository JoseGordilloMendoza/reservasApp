from datetime import timedelta
from datetime import time

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.models import Membership
from apps.availability.models import AvailabilityRule
from apps.billing import services as billing
from apps.businesses.models import Business
from apps.catalog.models import Resource, Service

DEMO_PASSWORD = "demo12345"
TEAM_EMAIL = "equipo@demo.pe"

DEMOS = [
    {
        "business": {
            "slug": "canchas-los-andes",
            "name": "Canchas Los Andes",
            "business_type": Business.BusinessType.COURT,
            "accent": Business.Accent.POPPY,
            "description": "Grass sintético y luces LED. Vestidores y estacionamiento.",
            "address": "Av. Ejército 123, Cayma",
            "phone": "+51987654321",
            "whatsapp": "+51987654321",
            "listed": True,
        },
        "owner": "canchas@demo.pe",
        # Paid up, with weeks to go.
        "subscription": {"days_left": 20, "price": "80.00", "plan": "Mensual"},
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
            "accent": Business.Accent.SKY,
            "description": "Psicología clínica y de pareja. Atención con cita.",
            "address": "Calle Mercaderes 100, Cercado",
            "phone": "+51912345678",
            "whatsapp": "+51912345678",
            "listed": True,
        },
        "owner": "consultorio@demo.pe",
        # Ended two days ago: in its grace days, so the warnings can be seen.
        "subscription": {"days_left": -2, "price": "120.00", "plan": "Mensual"},
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
    help = (
        "Create two demo businesses (a court and a therapist) with their owners and subscriptions, "
        "and a member of the platform team. Development only."
    )

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

            plan = demo["subscription"]
            billing.start_subscription(
                business=business,
                price=plan["price"],
                plan_name=plan["plan"],
                valid_until=billing.business_today(business) + timedelta(days=plan["days_left"]),
            )
            self.stdout.write(f"{data['slug']}: created. Panel login {demo['owner']} / {DEMO_PASSWORD}")

        if User.objects.filter(email=TEAM_EMAIL).exists():
            self.stdout.write(f"{TEAM_EMAIL}: already exists, left as it is.")
        else:
            User.objects.create_superuser(TEAM_EMAIL, DEMO_PASSWORD, first_name="Equipo")
            self.stdout.write(f"{TEAM_EMAIL}: created. Platform team login {TEAM_EMAIL} / {DEMO_PASSWORD} (open /plataforma)")
