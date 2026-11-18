# TASKS TODO

## Show the Banner First in READMEs

Make the banner the very first element of the root `README.md` and of the three host README templates at `scripts/hosts/<host>/README.md`: one plain image reference by relative path, the root's to the SVG under `assets/` and each template's to its own tree's copy beside the README, with an `img` width of 100% and the alternative text "Octopus arms drawn in ASCII art", identical in all four, and with no `<picture>` element, no theme-specific variant, and no absolute URL. Nothing else on those pages changes, the badges and the workflow diagram keeping their colours, and the rebuilt `hosts/` trees are committed with the templates. It is verified by `uv run scripts/build_hosts.py --check` passing, each README's diff holding only the added banner, and each reference resolving to the banner file in its own tree.

---
