"""What happens to a picture before it is kept (D119): checked, turned upright, stripped of what the
camera wrote into it (the place it was taken, for one), shrunk and saved as WebP."""

import io

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_UPLOAD_BYTES = 8 * 1024 * 1024
# A photo from a phone is about 12 million pixels; this leaves room and refuses files built to be huge.
MAX_PIXELS = 40_000_000
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}

# The longest side each kind of image keeps, in pixels. Smaller pictures are not enlarged.
MAX_SIDE = {"logo": 512, "cover": 1600}

WEBP_QUALITY = 82
CONTENT_TYPE = "image/webp"


class InvalidImage(Exception):
    """The file cannot be used. The message is for the person who chose it, in Spanish."""


def process_image(data, kind):
    """Return the picture as WebP bytes, no larger than the kind allows."""
    if kind not in MAX_SIDE:
        raise ValueError(f"unknown kind of image: {kind}")
    if not data:
        raise InvalidImage("El archivo está vacío.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise InvalidImage("La imagen pesa más de 8 MB. Prueba con una más liviana.")

    try:
        image = Image.open(io.BytesIO(data))
        # Only the header has been read: size and format can be judged before the picture is decoded.
        if image.format not in ALLOWED_FORMATS:
            raise InvalidImage("Usa una imagen JPG, PNG o WebP.")
        if image.width * image.height > MAX_PIXELS:
            raise InvalidImage("La imagen es demasiado grande en pixeles. Prueba con una más pequeña.")

        image.load()
        image = ImageOps.exif_transpose(image)  # a phone photo may be stored on its side
        has_alpha = image.mode in ("RGBA", "LA", "PA") or "transparency" in image.info
        image = image.convert("RGBA" if has_alpha else "RGB")
        image.thumbnail((MAX_SIDE[kind], MAX_SIDE[kind]), Image.Resampling.LANCZOS)

        out = io.BytesIO()
        # No `exif=` and no `icc_profile=`: nothing the camera wrote is passed on.
        image.save(out, format="WEBP", quality=WEBP_QUALITY, method=4)
        return out.getvalue()
    except InvalidImage:
        raise
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError, Image.DecompressionBombError):
        raise InvalidImage("No pudimos leer ese archivo como imagen. Prueba con otro.")
