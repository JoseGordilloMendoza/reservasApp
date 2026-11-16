"""Where business images are kept, behind a small interface of our own (D119).

Production keeps them in Cloudflare R2, a private bucket; a Worker of ours serves them. Development
keeps them on disk and Django serves them. Tests keep them in memory. The rest of the code only
sees `put`, `delete` and `public_url`, so changing the place (or the domain) touches nothing else.
"""

import logging
import secrets
from pathlib import Path

from django.conf import settings

logger = logging.getLogger("images")

# Every key is new, so the browser may keep an image for good: replacing it changes its address.
CACHE_CONTROL = "public, max-age=31536000, immutable"


class ImagesNotConfigured(Exception):
    """No place to keep images has been set up in this environment."""


class MemoryStorage:
    """For tests: nothing leaves the process."""

    def __init__(self):
        self.files = {}

    def put(self, key, data, content_type):
        self.files[key] = (data, content_type)

    def delete(self, key):
        self.files.pop(key, None)


class DiskStorage:
    """For development: files under a folder that Django serves at MEDIA_URL."""

    def __init__(self, root):
        self.root = Path(root)

    def _path(self, key):
        path = (self.root / key).resolve()
        if self.root.resolve() not in path.parents:
            raise ValueError("key outside the storage folder")
        return path

    def put(self, key, data, content_type):
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def delete(self, key):
        self._path(key).unlink(missing_ok=True)


class R2Storage:
    """Cloudflare R2 through its S3-compatible API."""

    def __init__(self, *, bucket, client):
        self.bucket = bucket
        self.client = client

    @classmethod
    def from_settings(cls):
        import boto3  # imported here: only production needs it

        client = boto3.client(
            "s3",
            endpoint_url=settings.R2_ENDPOINT,
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region_name="auto",  # what R2 asks for
        )
        return cls(bucket=settings.R2_BUCKET, client=client)

    def put(self, key, data, content_type):
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
            CacheControl=CACHE_CONTROL,
        )

    def delete(self, key):
        self.client.delete_object(Bucket=self.bucket, Key=key)


_override = None
_cached = None


def use_storage(storage):
    """Replace the storage (tests). Pass None to go back to the one the settings describe."""
    global _override
    _override = storage


def get_storage():
    """The storage this environment uses; raises ImagesNotConfigured when there is none."""
    global _cached
    if _override is not None:
        return _override
    if _cached is None:
        if settings.R2_BUCKET and settings.R2_ENDPOINT and settings.R2_ACCESS_KEY_ID and settings.R2_SECRET_ACCESS_KEY:
            if not settings.IMAGES_BASE_URL:
                raise ImagesNotConfigured("IMAGES_BASE_URL is missing")
            _cached = R2Storage.from_settings()
        elif settings.DEBUG:
            _cached = DiskStorage(settings.MEDIA_ROOT)
        else:
            raise ImagesNotConfigured("no place to keep images")
    return _cached


def new_key(business_id, kind):
    """A fresh address for an image, e.g. `b12/logo-3fa9c1d2e4b56789.webp`."""
    return f"b{business_id}/{kind}-{secrets.token_hex(8)}.webp"


def public_url(key):
    """The address a browser uses to see an image; None when there is none."""
    if not key or not settings.IMAGES_BASE_URL:
        return None
    return f"{settings.IMAGES_BASE_URL.rstrip('/')}/{key}"


def delete_quietly(key):
    """Remove an old image. A failure is logged and ignored: a leftover file costs nothing,
    while an error here must not undo the change that replaced it."""
    if not key:
        return
    try:
        get_storage().delete(key)
    except Exception:
        logger.exception("could not delete an image")
