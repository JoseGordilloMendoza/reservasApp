import re
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.urls import reverse

from apps.accounts.models import Membership
from apps.billing import services as billing
from apps.billing.models import Subscription
from apps.businesses.models import Business
from apps.platformadmin.models import ActivityLog

User = get_user_model()


def body(**overrides):
    data = {
        "name": "Canchas El Sol",
        "business_type": "court",
        "owner": {"email": "Rosa@Example.com", "first_name": "Rosa", "last_name": "Quispe"},
        "subscription": {"plan_name": "Mensual", "price": "80.00", "trial_days": 30},
    }
    data.update(overrides)
    return data


@pytest.fixture
def create(team, django_capture_on_commit_callbacks):
    """Open a business as the team does, running the emails that go out after the commit."""

    def _create(**overrides):
        with django_capture_on_commit_callbacks(execute=True):
            return team.post(reverse("platform-businesses"), body(**overrides), format="json")

    return _create


def test_opens_a_business_with_its_owner_and_subscription(team, db, create):
    response = create()

    assert response.status_code == 201
    business = Business.objects.get(slug="canchas-el-sol")
    assert business.name == "Canchas El Sol"
    assert business.business_type == "court"
    assert business.settings["slot_interval_minutes"] == 60  # its type's preset applied
    owner = User.objects.get(email="rosa@example.com")
    assert Membership.objects.get(user=owner, business=business).role == "owner"
    assert business.subscription.price == 80

    data = response.json()
    assert data["slug"] == "canchas-el-sol"
    assert data["owner"] == {"email": "rosa@example.com", "account_created": True, "temporary_password": None}
    assert data["standing"]["state"] == "active"
    assert data["standing"]["days_left"] == 30


def test_the_new_owner_has_no_password_and_gets_an_email_to_choose_one(team, db, create):
    create()

    owner = User.objects.get(email="rosa@example.com")
    assert not owner.has_usable_password()
    assert [message.to for message in mail.outbox] == [["rosa@example.com"]]
    text = mail.outbox[0].body
    assert "Canchas El Sol ya está en Separa" in text
    assert "/panel/nueva-contrasena?uid=" in text
    assert "http://localhost:5173/canchas-el-sol" in text


def test_the_emailed_link_lets_the_owner_choose_a_password_and_sign_in(team, db, client, create):
    create()
    link = re.search(r"uid=([^&\s]+)&token=([^&\s\n]+)", mail.outbox[0].body)
    uid, token = link.groups()

    chosen = client.post(
        reverse("auth-password-reset-confirm"),
        {"uid": uid, "token": token, "password": "clave-segura-456"},
        content_type="application/json",
    )
    login = client.post(
        reverse("auth-login"),
        {"email": "rosa@example.com", "password": "clave-segura-456"},
        content_type="application/json",
    )

    assert chosen.status_code == 200
    assert login.status_code == 200
    assert login.json()["user"]["memberships"][0]["business"]["slug"] == "canchas-el-sol"


def test_an_existing_account_keeps_its_password_and_is_added_to_the_business(team, db, create):
    existing = User.objects.create_user("rosa@example.com", "su-clave-actual-1", first_name="Rosa")
    existing.last_login = existing.date_joined
    existing.save()

    response = create()

    assert response.json()["owner"]["account_created"] is False
    existing.refresh_from_db()
    assert existing.check_password("su-clave-actual-1")
    assert existing.memberships.count() == 1
    assert "/panel/nueva-contrasena" not in mail.outbox[0].body
    assert "Ahora también puedes administrar" in mail.outbox[0].body


def test_the_link_is_made_from_the_name(team, db, create):
    assert create(name="Canchas Ñandú & Hijos").json()["slug"] == "canchas-nandu-hijos"


def test_a_taken_link_gets_a_number_when_it_was_not_asked_for(team, business, create):
    assert create(name="Cancha Los Andes").json()["slug"] == "cancha-los-andes-2"


def test_a_reserved_name_does_not_become_a_link(team, db, create):
    assert create(name="Panel").json()["slug"] == "panel-2"


def test_an_asked_for_link_is_used(team, db, create):
    assert create(slug="el-sol").json()["slug"] == "el-sol"


def test_an_asked_for_link_that_is_taken_is_refused_and_nothing_is_created(team, business, create):
    response = create(slug="cancha-los-andes")

    assert response.status_code == 400
    assert response.json()["slug"] == "Ese link ya está en uso."
    assert Business.objects.count() == 1
    assert not User.objects.filter(email="rosa@example.com").exists()
    assert mail.outbox == []


def test_a_reserved_link_is_refused(team, db, create):
    assert create(slug="admin").status_code == 400


def test_the_vigencia_can_be_a_date(team, db, create):
    target = billing.platform_today() + timedelta(days=45)

    response = create(subscription={"price": "80", "valid_until": str(target)})

    assert response.json()["subscription"]["valid_until"] == str(target)


def test_a_vigencia_in_the_past_is_refused(team, db, create):
    past = billing.platform_today() - timedelta(days=1)

    response = create(subscription={"price": "80", "valid_until": str(past)})

    assert response.status_code == 400
    assert Business.objects.count() == 0


@pytest.mark.parametrize(
    "subscription",
    [
        {"price": "80"},  # neither
        {"price": "80", "trial_days": 10, "valid_until": "2099-01-01"},  # both
        {"trial_days": 10},  # no price
        {"price": "-5", "trial_days": 10},
        {"price": "80", "trial_days": 0},
    ],
)
def test_the_subscription_must_be_complete(team, db, subscription, create):
    response = create(subscription=subscription)

    assert response.status_code == 400
    assert "subscription" in response.json()
    assert Business.objects.count() == 0


@pytest.mark.parametrize("owner", [{}, {"email": "no-es-correo"}, {"first_name": "Rosa"}])
def test_the_owner_needs_a_valid_email(team, db, owner, create):
    assert create(owner=owner).status_code == 400


def test_a_name_is_required(team, db):
    data = body()
    del data["name"]

    assert team.post(reverse("platform-businesses"), data, format="json").status_code == 400


def test_an_invalid_timezone_is_refused(team, db, create):
    assert create(timezone="Marte/Olimpo").status_code == 400


def test_the_vigencia_counts_from_the_business_calendar(team, db, create):
    # 05:00 on the 1st in Tokyo is already the 1st; trial days start from that business's today.
    response = create(timezone="Asia/Tokyo", subscription={"price": "80", "trial_days": 10})

    business = Business.objects.get(slug=response.json()["slug"])
    assert business.subscription.valid_until == billing.business_today(business) + timedelta(days=10)


def test_it_is_written_in_the_activity_log(team, db, create):
    create()

    actions = list(ActivityLog.objects.order_by("id").values_list("action", flat=True))
    assert actions == ["user.added", "business.created"]
    entry = ActivityLog.objects.get(action="business.created")
    assert entry.actor_email == "equipo@example.com"
    assert entry.business_slug == "canchas-el-sol"
    assert entry.detail["owner"] == "rosa@example.com"


def test_only_the_team_can_open_a_business(owner_client, business):
    response = owner_client.post(reverse("platform-businesses"), body(), format="json")

    assert response.status_code == 403
    assert Business.objects.count() == 1


def test_a_failure_halfway_leaves_nothing_behind(team, db, monkeypatch, create):
    def boom(**kwargs):
        raise RuntimeError("database trouble")

    monkeypatch.setattr(billing, "start_subscription", boom)

    with pytest.raises(RuntimeError):
        create()

    assert Business.objects.count() == 0
    assert not User.objects.filter(email="rosa@example.com").exists()
    assert Subscription.objects.count() == 0
    assert mail.outbox == []
