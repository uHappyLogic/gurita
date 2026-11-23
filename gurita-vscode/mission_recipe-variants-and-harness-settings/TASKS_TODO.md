# TASKS TODO

## One-Block Variants Named Default

The extension's recipe reader, `gurita-vscode/src/recipes.ts`, names the variant of every recipe of one block and no `####` sub-heading `default` instead of repeating the recipe's name, for the shipped recipe file and the own recipe file alike, the named single-task lines included, so that every recipe opens on a variant called `default`; a recipe of several `####` variants, as `Execute tasks` with `Normal difficulty` and `Critical tasks`, keeps the names written. Nothing migrates the stored copies, picks, or remembered selections that name a variant by its old name. It is verified by reader tests and by the mission page's dropdowns and the settings view showing `default`, with `gurita-vscode/README.md` matching.

---

## Config Changes Add Custom Variants

In the settings view's variant edits (`gurita-vscode/src/variantEdits.ts`, with the store overlay in `src/recipes.ts`), changing a line's harness, model, or effort on a shipped or own variant leaves that variant untouched and listed and adds beside it a stored variant named `custom N`, N the lowest number starting from 1 that no variant of the recipe carries, neither selected nor made the default, while a stored variant is changed in place and keeps its name; this replaces the recorded behaviour of a line edit's stored copy standing in for the variant it copies. Every stored variant remembers the variant it was made from, a named duplicate included, and Reset on it returns its lines to that variant's while keeping its name and its entry; Rename stays as it is, on a `default` included, and a deleted variant is restored as today. It is verified by `variantEdits` and settings-view tests showing a `default` unchanged beside its `custom 1` after an edit, a second edit of `custom 1` keeping the name, and a Reset restoring the lines under the same name, with `gurita-vscode/README.md` matching.

---

## Single-Task Lines Carry Variants

The settings view's Single-task lines part (`settingsLines` in `gurita-vscode/src/variantEdits.ts`, `drawSingleTaskLines` in `src/webview/page.ts`, `src/pane.ts`) lists each named single-task line with its `default` variant and its customs beneath it and gives those variants the same controls any recipe's variants get, a line's harness, model, or effort change adding `custom N` under the same line name, so that single-task lines are tuned through the settings view as every other recipe is. The line's heading stays the name `task_line_rules.txt` and the preview's override list use, Make default decides which variant the looped run passes as that line's `--line`, and the line-level Duplicate, Rename, and Delete stay as they are, the three shipped line headings, the rule file, and the runner unchanged. It is verified by a pane test where the loop passes a line's `custom 1` after it is made the default, with `gurita-vscode/README.md` matching.

---

## Variant Name on Run Buttons

On the mission page (`gurita-vscode/src/webview/page.ts`, with its stylesheet in `src/pane.ts`), every button that starts a harness run, the recipe-list buttons, the fixed-name buttons, and each "Answer with this alternative" button, shows under its title the selected variant's name, always and exactly as the variant is named, in place of the line listing that variant's harnesses, models, and efforts, which stay readable in the hover text and the settings view, so that a button says which variant a click runs; this replaces the recorded Button label decision. Every variant dropdown beside those buttons, the one shared beside a question card's Alternatives heading included, is reduced to its arrow alone, and its opened list offers the bare variant names with no `(yours)` mark. It is verified by page tests showing the variant name on each button, no values line, and an arrow-only dropdown whose options carry the bare names, with `gurita-vscode/README.md` matching.

---
