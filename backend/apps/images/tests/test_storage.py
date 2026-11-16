import re

import pytest

from apps.images import storage
from apps.images.storage import (
    CACHE_CONTROL,
    DiskStorage,
    ImagesNotConfigured,
    MemoryStorage,
    R2Storage,
    delete_quietly,
    get_storage,
    new_key,
    public_url,
    use_storage,
)


class FakeS3:
    def __init__(self):
        self.calls = []

    def put_object(self, **kwargs):
        self.calls.append(("put", kwargs))

    def delete_object(self, **kwargs):
        self.calls.append(("delete", kwargs))


def test_r2_stores_an_image_with_a_long_cache_and_its_type():
    client = FakeS3()
    R2Storage(bucket="mireserva-images", client=client).put("b1/logo-ab.webp", b"data", "image/webp")
    assert client.calls == [
        (
            "put",
            {
                "Bucket": "mireserva-images",
                "Key": "b1/logo-ab.webp",
                "Body": b"data",
                "ContentType": "image/webp",
                "CacheControl": CACHE_CONTROL,
            },
        )
    ]


def test_r2_deletes_an_image():
    client = FakeS3()
    R2Storage(bucket="mireserva-images", client=client).delete("b1/logo-ab.webp")
    assert client.calls == [("delete", {"Bucket": "mireserva-images", "Key": "b1/logo-ab.webp"})]


def test_disk_storage_writes_and_removes_files(tmp_path):
    disk = DiskStorage(tmp_path)
    disk.put("b1/logo-ab.webp", b"data", "image/webp")
    assert (tmp_path / "b1" / "logo-ab.webp").read_bytes() == b"data"
    disk.delete("b1/logo-ab.webp")
    assert not (tmp_path / "b1" / "logo-ab.webp").exists()
    disk.delete("b1/never-existed.webp")  # nothing to remove is not an error


def test_disk_storage_refuses_keys_that_leave_its_folder(tmp_path):
    with pytest.raises(ValueError):
        DiskStorage(tmp_path).put("../outside.webp", b"x", "image/webp")


def test_keys_are_new_every_time_and_name_the_business_and_kind():
    first, second = new_key(12, "logo"), new_key(12, "logo")
    assert first != second
    assert re.fullmatch(r"b12/logo-[0-9a-f]{16}\.webp", first)
    assert new_key(3, "cover").startswith("b3/cover-")


def test_public_url_joins_the_base_and_the_key(settings):
    settings.IMAGES_BASE_URL = "https://images.example.dev/"
    assert public_url("b1/logo-ab.webp") == "https://images.example.dev/b1/logo-ab.webp"


def test_public_url_is_none_without_a_key_or_a_base(settings):
    settings.IMAGES_BASE_URL = "https://images.example.dev"
    assert public_url("") is None
    settings.IMAGES_BASE_URL = ""
    assert public_url("b1/logo-ab.webp") is None


def test_without_r2_a_production_environment_has_no_storage(settings):
    use_storage(None)
    storage._cached = None
    settings.DEBUG = False
    settings.R2_BUCKET = ""
    with pytest.raises(ImagesNotConfigured):
        get_storage()


def test_r2_without_a_public_address_is_a_misconfiguration(settings):
    use_storage(None)
    storage._cached = None
    settings.DEBUG = False
    settings.R2_BUCKET, settings.R2_ENDPOINT = "b", "https://x.r2.cloudflarestorage.com"
    settings.R2_ACCESS_KEY_ID, settings.R2_SECRET_ACCESS_KEY = "id", "secret"
    settings.IMAGES_BASE_URL = ""
    with pytest.raises(ImagesNotConfigured):
        get_storage()


def test_a_failed_delete_is_logged_and_does_not_raise(caplog):
    class Broken(MemoryStorage):
        def delete(self, key):
            raise RuntimeError("r2 is down")

    use_storage(Broken())
    delete_quietly("b1/logo-ab.webp")
    assert "could not delete an image" in caplog.text
    delete_quietly("")  # no key, nothing to do
