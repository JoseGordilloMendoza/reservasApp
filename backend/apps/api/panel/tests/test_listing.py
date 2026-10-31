from django.urls import reverse


def test_a_business_starts_out_in_the_search(panel):
    assert panel.get(reverse("panel-business")).json()["listed"] is True


def test_the_owner_can_ask_to_appear_and_to_stop_appearing(panel, business):
    on = panel.patch(reverse("panel-business"), {"listed": True}, format="json")

    assert on.status_code == 200
    assert on.json()["listed"] is True
    business.refresh_from_db()
    assert business.listed is True

    off = panel.patch(reverse("panel-business"), {"listed": False}, format="json")

    assert off.json()["listed"] is False


def test_it_then_shows_up_in_the_public_search(panel, api_client):
    panel.patch(reverse("panel-business"), {"listed": True}, format="json")

    results = api_client.get(reverse("public-search"), {"q": "andes"}).json()["results"]

    assert [item["slug"] for item in results] == ["cancha-los-andes"]


def test_and_stops_showing_up_when_the_owner_withdraws(panel, api_client):
    panel.patch(reverse("panel-business"), {"listed": True}, format="json")
    panel.patch(reverse("panel-business"), {"listed": False}, format="json")

    assert api_client.get(reverse("public-search"), {"q": "andes"}).json()["results"] == []


def test_changing_something_else_does_not_change_it(panel, business):
    panel.patch(reverse("panel-business"), {"listed": True}, format="json")

    panel.patch(reverse("panel-business"), {"description": "Grass sintético"}, format="json")

    business.refresh_from_db()
    assert business.listed is True


def test_renaming_the_business_updates_what_the_search_finds(panel, api_client):
    panel.patch(reverse("panel-business"), {"listed": True, "name": "Canchas El Sol"}, format="json")

    assert api_client.get(reverse("public-search"), {"q": "sol"}).json()["results"][0]["name"] == "Canchas El Sol"
    assert api_client.get(reverse("public-search"), {"q": "andes"}).json()["results"] == []
