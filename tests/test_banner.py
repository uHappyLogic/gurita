"""The README banner file: every committed copy, the source under assets/ and the one at the
root of each host tree, parses as a well-formed SVG, all copies are byte-identical, and the
committed source equals what scripts/render_banner.py produces from the plain-text drawing and
its colour mapping, so a drawing or a copy changed without regenerating and rebuilding fails
here. Where the READMEs place the image is not checked."""

import importlib.util
import xml.etree.ElementTree as ElementTree
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
ASSETS = REPO_ROOT / "assets"
SOURCE = ASSETS / "banner.svg"
DRAWING = ASSETS / "banner.txt"
COLOURS = ASSETS / "banner-colors.txt"
GENERATOR = REPO_ROOT / "scripts" / "render_banner.py"
SVG_ROOT_TAG = "{http://www.w3.org/2000/svg}svg"

HOSTS = sorted(
    path.parent.name for path in (REPO_ROOT / "scripts" / "hosts").glob("*/settings.toml")
)
COPIES = [SOURCE] + [REPO_ROOT / "hosts" / host / "banner.svg" for host in HOSTS]


def load_generator():
    spec = importlib.util.spec_from_file_location("render_banner", GENERATOR)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def read_ascii(path):
    with open(path, "r", encoding="ascii", newline="") as f:
        return f.read()


def test_every_host_definition_has_a_tree_copy():
    assert HOSTS, "no host definition found under scripts/hosts/"
    missing = [str(path.relative_to(REPO_ROOT)) for path in COPIES if not path.is_file()]
    assert not missing, f"banner copies missing: {missing}"


@pytest.mark.parametrize("path", COPIES, ids=lambda path: str(path.relative_to(REPO_ROOT)))
def test_each_copy_parses_as_well_formed_svg(path):
    root = ElementTree.fromstring(path.read_bytes())
    assert root.tag == SVG_ROOT_TAG


@pytest.mark.parametrize("path", COPIES[1:], ids=lambda path: str(path.relative_to(REPO_ROOT)))
def test_each_host_copy_is_byte_identical_to_the_source(path):
    assert path.read_bytes() == SOURCE.read_bytes(), (
        f"{path.relative_to(REPO_ROOT)} differs from assets/banner.svg; "
        "rebuild with uv run scripts/build_hosts.py"
    )


def test_the_source_equals_the_generator_output():
    expected = load_generator().render(read_ascii(DRAWING), read_ascii(COLOURS))
    assert SOURCE.read_bytes() == expected.encode("ascii"), (
        "assets/banner.svg is not what the drawing renders to; "
        "regenerate with uv run scripts/render_banner.py"
    )
