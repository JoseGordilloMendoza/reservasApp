import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image

from apps.images.storage import MemoryStorage, use_storage


@pytest.fixture(autouse=True)
def public_address(settings):
    settings.IMAGES_BASE_URL = "https://images.example.dev"


def picture(size=(1000, 800), fmt="JPEG", name="foto.jpg"):
    out = io.BytesIO()
    Image.new("RGB", size, (30, 90, 200)).save(out, format=fmt)
    return SimpleUploadedFile(name, out.getvalue(), content_type="application/octet-stream")


def upload(client, kind, file):
    return client.put(reverse(f"panel-business-{kind}"), {"file": file}, format="multipart")


@pytest.mark.parametrize("kind", ["logo", "cover"])
def test_the_owner_uploads_a_picture_and_the_page_shows_its_address(panel, business, images_in_memory, kind):
    response = upload(panel, kind, picture())

    assert response.status_code == 200
    business.refresh_from_db()
    key = getattr(business, kind)
    assert key.startswith(f"b{business.pk}/{kind}-") and key.endswith(".webp")
    assert response.json()[f"{kind}_url"] == f"https://images.example.dev/{key}"
    stored, content_type = images_in_memory.files[key]
    assert content_type == "image/webp"
    assert Image.open(io.BytesIO(stored)).format == "WEBP"


def test_a_business_without_pictures_shows_none(panel):
    data = panel.get(reverse("panel-business")).json()

    assert data["logo_url"] is None
    assert data["cover_url"] is None


def test_the_stored_picture_is_the_reduced_one(panel, business, images_in_memory):
    upload(panel, "cover", picture(size=(4000, 3000)))

    business.refresh_from_db()
    stored, _ = images_in_memory.files[business.cover]
    assert Image.open(io.BytesIO(stored)).size == (1600, 1200)


def test_replacing_a_picture_removes_the_old_one(panel, business, images_in_memory):
    upload(panel, "logo", picture())
    business.refresh_from_db()
    first = business.logo

    upload(panel, "logo", picture())

    business.refresh_from_db()
    assert business.logo != first
    assert first not in images_in_memory.files
    assert business.logo in images_in_memory.files


def test_removing_a_picture_clears_it_and_deletes_the_file(panel, business, images_in_memory):
    upload(panel, "cover", picture())
    business.refresh_from_db()
    key = business.cover

    response = panel.delete(reverse("panel-business-cover"))

    assert response.status_code == 200
    assert response.json()["cover_url"] is None
    business.refresh_from_db()
    assert business.cover == ""
    assert key not in images_in_memory.files


def test_removing_what_is_not_there_changes_nothing(panel):
    response = panel.delete(reverse("panel-business-logo"))

    assert response.status_code == 200
    assert response.json()["logo_url"] is None


def test_the_logo_and_the_cover_are_independent(panel, business):
    upload(panel, "logo", picture())
    upload(panel, "cover", picture())

    panel.delete(reverse("panel-business-logo"))

    business.refresh_from_db()
    assert business.logo == ""
    assert business.cover != ""


def test_a_file_that_is_not_a_picture_is_refused_and_nothing_changes(panel, business, images_in_memory):
    fake = SimpleUploadedFile("foto.jpg", b"not a picture at all", content_type="image/jpeg")

    response = upload(panel, "logo", fake)

    assert response.status_code == 400
    assert response.json()["code"] == "invalid_image"
    business.refresh_from_db()
    assert business.logo == ""
    assert images_in_memory.files == {}


def test_a_gif_is_refused_with_a_message_the_owner_can_use(panel):
    response = upload(panel, "logo", picture(fmt="GIF", name="a.gif"))

    assert response.status_code == 400
    assert "JPG, PNG o WebP" in response.json()["detail"]


def test_a_request_without_a_file_is_refused(panel):
    response = panel.put(reverse("panel-business-logo"), {}, format="multipart")

    assert response.status_code == 400
    assert response.json()["code"] == "invalid_image"


def test_if_the_storage_fails_nothing_changes_and_the_owner_is_told(panel, business):
    class Down(MemoryStorage):
        def put(self, key, data, content_type):
            raise RuntimeError("r2 is down")

    use_storage(Down())
    business.logo = "b1/logo-old.webp"
    business.save()

    response = upload(panel, "logo", picture())

    assert response.status_code == 503
    assert response.json()["code"] == "images_unavailable"
    business.refresh_from_db()
    assert business.logo == "b1/logo-old.webp"


def test_pictures_are_not_available_where_no_place_to_keep_them_is_set_up(panel, settings):
    settings.DEBUG = False
    settings.R2_BUCKET = ""
    use_storage(None)

    assert upload(panel, "logo", picture()).status_code == 503


def test_a_failed_removal_of_the_old_file_does_not_undo_the_replacement(panel, business, images_in_memory):
    upload(panel, "logo", picture())

    def broken_delete(key):
        raise RuntimeError("r2 is down")

    images_in_memory.delete = broken_delete

    response = upload(panel, "logo", picture())

    assert response.status_code == 200


def test_someone_not_signed_in_cannot_upload(api_client):
    assert upload(api_client, "logo", picture()).status_code == 401
    assert api_client.delete(reverse("panel-business-logo")).status_code == 401


def test_each_business_keeps_its_own_pictures(panel, other_panel, business, other_business):
    upload(panel, "logo", picture())

    other_business.refresh_from_db()
    business.refresh_from_db()
    assert business.logo != "" and other_business.logo == ""
    assert upload(other_panel, "logo", picture()).status_code == 200
    other_business.refresh_from_db()
    assert other_business.logo.startswith(f"b{other_business.pk}/")


def test_uploads_are_limited_per_person(panel, monkeypatch):
    from rest_framework.throttling import ScopedRateThrottle

    monkeypatch.setattr(ScopedRateThrottle, "THROTTLE_RATES", {"panel_images": "2/hour"})

    assert upload(panel, "logo", picture()).status_code == 200
    assert upload(panel, "logo", picture()).status_code == 200
    assert upload(panel, "logo", picture()).status_code == 429
