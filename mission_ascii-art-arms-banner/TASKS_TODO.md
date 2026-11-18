# TASKS TODO

## Copy the Banner Into Host Trees

Change `scripts/build_hosts.py` to copy the one banner SVG under `assets/` into every host tree at the tree root, beside the README, byte for byte as it copies the root `LICENSE`, so each host page can load the banner from its own repository and no copy is kept by hand in a definition directory. Extend the build's tests to cover the new copy and commit the rebuilt `hosts/` trees with the change. It is verified by both pytest runs passing, `uv run scripts/build_hosts.py --check` passing, and every host tree's copy being byte-identical to the source file.

---

## Add the Permanent Banner Test

Add a test under `tests/`, run by both pytest runs in CI, that guards the banner file only: every committed copy, the source under `assets/` and the one in each host tree, parses as a well-formed SVG, all copies are byte-identical, and the committed SVG equals what the generator script produces from the plain-text drawing. It checks nothing about where the READMEs place the image, so their opening lines stay unpinned. It is verified by passing under the pinned interpreter and at the 3.9 floor, and by failing when the drawing or a copy is altered without regenerating.

---

## Show the Banner First in READMEs

Make the banner the very first element of the root `README.md` and of the three host README templates at `scripts/hosts/<host>/README.md`: one plain image reference by relative path, the root's to the SVG under `assets/` and each template's to its own tree's copy beside the README, with an `img` width of 100% and the alternative text "Octopus arms drawn in ASCII art", identical in all four, and with no `<picture>` element, no theme-specific variant, and no absolute URL. Nothing else on those pages changes, the badges and the workflow diagram keeping their colours, and the rebuilt `hosts/` trees are committed with the templates. It is verified by `uv run scripts/build_hosts.py --check` passing, each README's diff holding only the added banner, and each reference resolving to the banner file in its own tree.

---
