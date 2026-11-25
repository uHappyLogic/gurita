## Purpose

This node is for maintainers of `assets/`, the drawings behind the README banner and the VS Code extension's icons. `banner.txt` is the banner drawing and `banner-colors.txt` its colour legend and mask; `banner.svg` is the banner itself, the derived output of `scripts/render_banner.py`, which the root `README.md` shows and the host build copies byte for byte to the root of every host tree beside its README. `icon-centre-arm.txt` is the hand-drawn centre arm of the extension's icons, which `scripts/render_icon.py` reads beside `banner.txt`, taking the banner's first and last arms for the two side arms, to write `gurita-vscode/media/activity-bar.svg` and `gurita-vscode/media/icon.png`. Each render script's module docstring is the reference for the two plain-text formats, so this node holds only what an edit here keeps.

## Rules

- **The three `.txt` files are the only hand-edited files here, and every output is regenerated from them.** A change to a drawing or to the colour mask is followed by the render script that reads it, and a banner change by a rebuild of `hosts/`, all committed together. Reason: the banner and icon tests compare each committed output with what its generator produces, and every host tree's copy with `banner.svg`, so an output left stale fails the suite. Retired forms: none recorded.
- → `scripts/README.md#rules` — The derived-output rule whole: what each render script writes, from which drawings, and the rebuild after a banner change. Read it before editing a drawing or an output here.
- **The file names here are fixed by their readers.** `render_banner.py` reads its colour mapping from the file beside the drawing named `<stem>-colors.txt` and writes `<stem>.svg` beside both; `render_icon.py`, the build, the root `README.md`, and the banner and icon tests each name these paths literally. Reason: a renamed file leaves its readers pointing at nothing, the build stopping on a missing banner and the README showing no image. Retired forms: none recorded.

## Commands

- `uv run scripts/render_banner.py` — regenerate `banner.svg` from `banner.txt` and `banner-colors.txt`, then rebuild `hosts/`.
- `uv run scripts/render_icon.py` — regenerate the extension's activity-bar and listing icons from `banner.txt` and `icon-centre-arm.txt`.

## Pointers

- → `scripts/render_banner.py` — Its docstring states the drawing's character set and the colour mapping's legend and mask form. Read it before editing `banner.txt` or `banner-colors.txt`.
- → `scripts/render_icon.py` — Its docstring states how the arms are cut from the banner and composed into both icons. Read it before editing `icon-centre-arm.txt` or the banner's end arms.
- → `tests/test_banner.py` — Checks that every banner copy is well-formed SVG, equal to `banner.svg`, and equal to the generator's output. Run it after any banner change.
- → `tests/test_icon.py` — Checks the activity-bar icon against `render_icon.py`'s output. Run it after any change to a drawing the icons are cut from.
- → `tests/test_listing_icon.py` — Checks the listing PNG's decoded image against `render_icon.py`'s. Run it after any change to a drawing the icons are cut from.
