import io

import pytest
from PIL import Image

from apps.images import processing
from apps.images.processing import InvalidImage, process_image


def make_image(size=(800, 600), fmt="JPEG", mode="RGB", color=(200, 40, 40), **save_args):
    out = io.BytesIO()
    Image.new(mode, size, color).save(out, format=fmt, **save_args)
    return out.getvalue()


def open_result(data):
    image = Image.open(io.BytesIO(data))
    image.load()
    return image


def test_a_photo_becomes_webp_and_keeps_its_proportions():
    result = open_result(process_image(make_image((800, 600)), "cover"))
    assert result.format == "WEBP"
    assert result.size == (800, 600)


@pytest.mark.parametrize(
    "kind, size, expected",
    [
        ("cover", (4000, 3000), (1600, 1200)),
        ("cover", (3000, 4000), (1200, 1600)),
        ("logo", (2000, 1000), (512, 256)),
    ],
)
def test_a_large_picture_is_reduced_to_the_longest_side_the_kind_allows(kind, size, expected):
    assert open_result(process_image(make_image(size), kind)).size == expected


def test_a_small_picture_is_not_enlarged():
    assert open_result(process_image(make_image((120, 80)), "cover")).size == (120, 80)


@pytest.mark.parametrize("fmt", ["JPEG", "PNG", "WEBP"])
def test_jpg_png_and_webp_are_accepted(fmt):
    assert open_result(process_image(make_image(fmt=fmt), "logo")).format == "WEBP"


def test_a_png_logo_keeps_its_transparency():
    data = make_image((300, 300), fmt="PNG", mode="RGBA", color=(0, 0, 0, 0))
    result = open_result(process_image(data, "logo"))
    assert result.mode == "RGBA"
    assert result.getpixel((10, 10))[3] == 0


def test_a_photo_without_transparency_stays_opaque_and_small():
    data = process_image(make_image((1600, 1200)), "cover")
    assert open_result(data).mode == "RGB"
    assert len(data) < 100 * 1024  # a flat color is tiny; the point is that it is far below the upload


def test_the_camera_orientation_is_applied():
    # EXIF orientation 6 = "turn 90 degrees to see it upright": a 600x400 file shows as 400x600.
    image = Image.new("RGB", (600, 400), (10, 120, 200))
    exif = Image.Exif()
    exif[0x0112] = 6
    out = io.BytesIO()
    image.save(out, format="JPEG", exif=exif)

    assert open_result(process_image(out.getvalue(), "cover")).size == (400, 600)


def test_what_the_camera_wrote_is_not_kept():
    image = Image.new("RGB", (200, 200), (10, 120, 200))
    exif = Image.Exif()
    exif[0x010F] = "SecretCameraMaker"  # Make
    exif[0x8825] = {1: "S", 2: (16.0, 24.0, 0.0), 3: "W", 4: (71.0, 31.0, 0.0)}  # GPS
    out = io.BytesIO()
    image.save(out, format="JPEG", exif=exif)
    assert b"SecretCameraMaker" in out.getvalue()  # the source does carry it

    result = process_image(out.getvalue(), "cover")

    assert b"SecretCameraMaker" not in result
    assert not open_result(result).getexif()


def test_a_gif_is_refused():
    with pytest.raises(InvalidImage, match="JPG, PNG o WebP"):
        process_image(make_image(fmt="GIF", mode="P", color=1), "logo")


def test_something_that_is_not_a_picture_is_refused_whatever_its_name():
    with pytest.raises(InvalidImage, match="leer"):
        process_image(b"<?php echo 'hi'; ?>", "logo")
    with pytest.raises(InvalidImage, match="leer"):
        process_image(b"%PDF-1.7 not really a picture", "cover")


def test_a_broken_picture_is_refused():
    broken = make_image((400, 400))[:-200]  # cut short
    with pytest.raises(InvalidImage):
        process_image(broken, "cover")


def test_an_empty_file_is_refused():
    with pytest.raises(InvalidImage, match="vacío"):
        process_image(b"", "logo")


def test_more_than_eight_megabytes_is_refused_before_it_is_opened():
    with pytest.raises(InvalidImage, match="8 MB"):
        process_image(b"0" * (8 * 1024 * 1024 + 1), "cover")


def test_a_picture_with_too_many_pixels_is_refused(monkeypatch):
    monkeypatch.setattr(processing, "MAX_PIXELS", 10_000)
    with pytest.raises(InvalidImage, match="pixeles"):
        process_image(make_image((200, 200)), "cover")


def test_an_unknown_kind_is_a_programming_error():
    with pytest.raises(ValueError):
        process_image(make_image(), "banner")
