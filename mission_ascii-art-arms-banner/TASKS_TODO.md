# TASKS TODO

## Draw the Eight-Arm Banner Art

Draw the banner's plain-text source under `assets/` with the colour mapping it needs, and commit beside it the SVG the generator script writes from it, as derived output that is never hand-edited: exactly eight octopus arms, each curling up from the bottom edge, in a strip of about 80 to 100 character columns by about 8 to 12 rows with an aspect of roughly 4:1 to 6:1, using only the 95 printable 7-bit ASCII characters (U+0020 to U+007E) and only the palette violet `#a855f7`, slate `#64748b`, and darker violet `#9333ea`. The art lands on the executing agent's own judgment, with no approval step. It is verified by counting the arms, checking the grid size, the character range, and the colours, and rendering the SVG locally to PNGs on the white light background and the `#0d1117` dark background with a renderer already on the machine, such as `qlmanage`, inspecting them before the task completes and committing nothing for that check.

---

## Copy the Banner Into Host Trees

Change `scripts/build_hosts.py` to copy the one banner SVG under `assets/` into every host tree at the tree root, beside the README, byte for byte as it copies the root `LICENSE`, so each host page can load the banner from its own repository and no copy is kept by hand in a definition directory. Extend the build's tests to cover the new copy and commit the rebuilt `hosts/` trees with the change. It is verified by both pytest runs passing, `uv run scripts/build_hosts.py --check` passing, and every host tree's copy being byte-identical to the source file.

---

## Add the Permanent Banner Test

Add a test under `tests/`, run by both pytest runs in CI, that guards the banner file only: every committed copy, the source under `assets/` and the one in each host tree, parses as a well-formed SVG, all copies are byte-identical, and the committed SVG equals what the generator script produces from the plain-text drawing. It checks nothing about where the READMEs place the image, so their opening lines stay unpinned. It is verified by passing under the pinned interpreter and at the 3.9 floor, and by failing when the drawing or a copy is altered without regenerating.

---

## Show the Banner First in READMEs

Make the banner the very first element of the root `README.md` and of the three host README templates at `scripts/hosts/<host>/README.md`: one plain image reference by relative path, the root's to the SVG under `assets/` and each template's to its own tree's copy beside the README, with an `img` width of 100% and the alternative text "Octopus arms drawn in ASCII art", identical in all four, and with no `<picture>` element, no theme-specific variant, and no absolute URL. Nothing else on those pages changes, the badges and the workflow diagram keeping their colours, and the rebuilt `hosts/` trees are committed with the templates. It is verified by `uv run scripts/build_hosts.py --check` passing, each README's diff holding only the added banner, and each reference resolving to the banner file in its own tree.

---
