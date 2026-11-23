# TASKS TODO

## Shipped Recipe File of the Extension

The extension stops reading `snippets/GURITA_USAGE.md`: its shipped recipes move to a recipe file of the extension's own under `gurita-vscode/`, in the same `###`/`####` form and holding the same recipes, which `scripts/bundle.js` bundles and `src/pane.ts` reads in place of `bundled/GURITA_USAGE.md`, because the extension, not the snippets file, is now where the Gurita flow is run from. `snippets/GURITA_USAGE.md` stays in the repository as a hand-use document, otherwise left as written. It is verified by the package and the extension's tests no longer reading the snippets file while the mission page and the settings view list the same recipes as before, with `gurita-vscode/README.md` and `CLAUDE.md` describing the new file.

---

## One-Block Variants Named Default

The extension's recipe reader, `gurita-vscode/src/recipes.ts`, names the variant of every recipe of one block and no `####` sub-heading `default` instead of repeating the recipe's name, for the shipped recipe file and the own recipe file alike, the named single-task lines included, so that every recipe opens on a variant called `default`; a recipe of several `####` variants, as `Execute tasks` with `Normal difficulty` and `Critical tasks`, keeps the names written. Nothing migrates the stored copies, picks, or remembered selections that name a variant by its old name. It is verified by reader tests and by the mission page's dropdowns and the settings view showing `default`, with `gurita-vscode/README.md` matching.

---
