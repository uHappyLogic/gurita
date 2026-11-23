"""The VS Code extension's activity-bar icon: the tracked SVG under gurita-vscode/media/ parses
as a well-formed SVG that draws no character as text, and equals what scripts/render_icon.py
produces from the banner's drawing and the centre arm's drawing, so a drawing changed without
regenerating the icon fails here. How the editor shows the icon is not checked."""

import importlib.util
import xml.etree.ElementTree as ElementTree
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ASSETS = REPO_ROOT / "assets"
BANNER = ASSETS / "banner.txt"
CENTRE = ASSETS / "icon-centre-arm.txt"
ICON = REPO_ROOT / "gurita-vscode" / "media" / "activity-bar.svg"
GENERATOR = REPO_ROOT / "scripts" / "render_icon.py"
SVG_NAMESPACE = "{http://www.w3.org/2000/svg}"


def load_generator():
    spec = importlib.util.spec_from_file_location("render_icon", GENERATOR)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def read_ascii(path):
    with open(path, "r", encoding="ascii", newline="") as f:
        return f.read()


def test_the_icon_parses_as_well_formed_svg():
    root = ElementTree.fromstring(ICON.read_bytes())
    assert root.tag == SVG_NAMESPACE + "svg"


def test_the_icon_draws_no_text_in_one_fill_colour():
    root = ElementTree.fromstring(ICON.read_bytes())
    assert root.find(".//" + SVG_NAMESPACE + "text") is None
    paths = root.findall(SVG_NAMESPACE + "path")
    assert len(paths) == 3, "one path per arm"
    assert len({path.get("fill") for path in paths}) == 1


def test_the_icon_equals_the_generator_output():
    expected = load_generator().render(read_ascii(BANNER), read_ascii(CENTRE))
    assert ICON.read_bytes() == expected.encode("ascii"), (
        "gurita-vscode/media/activity-bar.svg is not what the drawings render to; "
        "regenerate with uv run scripts/render_icon.py"
    )
