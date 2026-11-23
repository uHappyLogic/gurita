# TASKS TODO

## Shipped Recipe File of the Extension

The extension stops reading `snippets/GURITA_USAGE.md`: its shipped recipes move to a recipe file of the extension's own under `gurita-vscode/`, in the same `###`/`####` form and holding the same recipes, which `scripts/bundle.js` bundles and `src/pane.ts` reads in place of `bundled/GURITA_USAGE.md`, because the extension, not the snippets file, is now where the Gurita flow is run from. `snippets/GURITA_USAGE.md` stays in the repository as a hand-use document, otherwise left as written. It is verified by the package and the extension's tests no longer reading the snippets file while the mission page and the settings view list the same recipes as before, with `gurita-vscode/README.md` and `CLAUDE.md` describing the new file.

---
