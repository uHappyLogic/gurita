"""The VS Code extension's listing icon: the tracked PNG under gurita-vscode/media/, named by the
manifest's `icon` entry, is a well-formed PNG of the listing size, and its image equals what
scripts/render_icon.py produces from the banner's drawing and the centre arm's drawing, so a
drawing changed without regenerating the icon fails here.

The comparison is of the decoded image, header and pixels, rather than of the file's bytes,
because the compressed stream depends on the zlib build the interpreter carries while the
pixels the generator computes do not. How a listing shows the icon is not checked."""

import importlib.util
import json
import struct
import zlib
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ASSETS = REPO_ROOT / "assets"
BANNER = ASSETS / "banner.txt"
CENTRE = ASSETS / "icon-centre-arm.txt"
EXTENSION = REPO_ROOT / "gurita-vscode"
MANIFEST = EXTENSION / "package.json"
ICON = EXTENSION / "media" / "icon.png"
GENERATOR = REPO_ROOT / "scripts" / "render_icon.py"
SIGNATURE = b"\x89PNG\r\n\x1a\n"
LISTING_SIZE = 256


def load_generator():
    spec = importlib.util.spec_from_file_location("render_icon", GENERATOR)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def read_ascii(path):
    with open(path, "r", encoding="ascii", newline="") as f:
        return f.read()


def chunks(data):
    """Split a PNG into its (type, data) chunks, checking the signature and every CRC."""
    assert data[:8] == SIGNATURE, "the file does not open with the PNG signature"
    position = 8
    found = []
    while position < len(data):
        assert position + 12 <= len(data), "a chunk runs past the end of the file"
        (length,) = struct.unpack(">I", data[position:position + 4])
        kind = data[position + 4:position + 8]
        body = data[position + 8:position + 8 + length]
        assert len(body) == length, f"chunk {kind!r} runs past the end of the file"
        (crc,) = struct.unpack(">I", data[position + 8 + length:position + 12 + length])
        assert crc == zlib.crc32(kind + body) & 0xFFFFFFFF, f"chunk {kind!r} fails its CRC"
        found.append((kind, body))
        position += 12 + length
    return found


def decode(data):
    """Return a PNG's header fields and its decompressed image data."""
    found = chunks(data)
    kinds = [kind for kind, _ in found]
    assert kinds[0] == b"IHDR", "the first chunk is not IHDR"
    assert kinds[-1] == b"IEND" and found[-1][1] == b"", "the last chunk is not an empty IEND"
    assert b"IDAT" in kinds, "the file holds no image data"
    header = struct.unpack(">IIBBBBB", found[0][1])
    image = zlib.decompress(b"".join(body for kind, body in found if kind == b"IDAT"))
    return header, image


def test_the_manifest_names_the_icon():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assert EXTENSION / manifest["icon"] == ICON


def test_the_icon_is_a_well_formed_png_of_the_listing_size():
    header, image = decode(ICON.read_bytes())
    width, height, depth, colour, compression, filtering, interlace = header
    assert (width, height) == (LISTING_SIZE, LISTING_SIZE)
    assert (depth, colour, compression, filtering, interlace) == (8, 2, 0, 0, 0)
    stride = 1 + width * 3
    assert len(image) == height * stride
    assert all(image[row * stride] == 0 for row in range(height)), "a row is filtered"


def test_the_icon_equals_the_generator_output():
    expected = load_generator().render_png(read_ascii(BANNER), read_ascii(CENTRE))
    assert decode(ICON.read_bytes()) == decode(expected), (
        "gurita-vscode/media/icon.png is not what the drawings render to; "
        "regenerate with uv run scripts/render_icon.py"
    )
