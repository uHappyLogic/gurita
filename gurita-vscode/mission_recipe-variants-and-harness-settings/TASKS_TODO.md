# TASKS TODO

## Variant Name on Run Buttons

On the mission page (`gurita-vscode/src/webview/page.ts`, with its stylesheet in `src/pane.ts`), every button that starts a harness run, the recipe-list buttons, the fixed-name buttons, and each "Answer with this alternative" button, shows under its title the selected variant's name, always and exactly as the variant is named, in place of the line listing that variant's harnesses, models, and efforts, which stay readable in the hover text and the settings view, so that a button says which variant a click runs; this replaces the recorded Button label decision. Every variant dropdown beside those buttons, the one shared beside a question card's Alternatives heading included, is reduced to its arrow alone, and its opened list offers the bare variant names with no `(yours)` mark. It is verified by page tests showing the variant name on each button, no values line, and an arrow-only dropdown whose options carry the bare names, with `gurita-vscode/README.md` matching.

---

## Requirements Iteration Listed on First Review Round

On the mission page of Gurita for VS Code, a page whose diagram fills **first review round** while any question is open also lists the recipes declaring the additional review round, `Requirements iteration` and the mixed-agent chain, beside `First run` (`stageRecipes` and `PAIRED_STAGES` in `gurita-vscode/src/recipes.ts`, called from `src/pane.ts`), since today a mission with one review commit and questions lacking a pick or alternatives lists `First run` alone and `Requirements iteration` cannot be run from its page. The diagram's filled block, its round count, and `nextStep` stay as they are, and a fresh mission with no open question keeps `First run` alone. It is verified by recipe and pane tests covering both first-review-round cases, with `gurita-vscode/README.md` matching.

---
