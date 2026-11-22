# TASKS TODO

## Variant Editing in the Settings View

List in the settings view every recipe with its variants (the chains, the seven fixed-name button recipes, and the recipes and variants that come from the hand-written own recipe file) and offer on each variant duplicate, rename, delete, pick as the recipe's default, and, where a stored copy or a hiding record stands, reset, each carried out through the variant store's edits. A duplicate's name and a rename are asked for in VS Code's own input box, one box per value as `askValues` in `src/pane.ts` asks, a rename opening with the current name filled in and the box's own validation refusing an empty name and one the recipe already uses. Verified by pane tests against the `vscode` stub and page tests of the controls, an edit reaching the mission page's dropdown and the fixed-name buttons at the next re-read, with `gurita-vscode/README.md` describing the edits.

---

## Line Editor for Model and Effort

Add the line editor to each variant in the settings view: every line is shown as its text, and only a line of a known harness carrying both `--model` and `--effort` gets model and effort dropdowns, a Codex line carrying `-m` getting its model dropdown alone and every other line staying read-only. The dropdowns offer the harness's model list and its whole effort list, whatever the line's model, and a pick replaces the value the line already carries, never inserting text into the line, and is written through the store's edit as the variant's stored copy. Verified by pane and page tests: a pick on a shipped variant's line leaves a stored copy holding the changed line in that variant's place, and a line without both flags draws no control.

---

## Single-Task Lines in the Settings View

List the named single-task lines in the settings view and give them the same edits it gives variants: duplicate, rename, delete, reset, and the change of the line's model and effort, shipped single-task lines treated exactly as shipped variants are and own-file ones as own items, the results written to the same per-user store. A stored line reaches the merged recipe list under its name, so the looped run's named lines, the rule file, and the preview's override list see it unchanged in form, with `runner.py`, `task_line_rules.txt`, and the `--line` hand-over in `src/loop.ts` left as they are. Verified by `node:test` unit tests in which a duplicated, a renamed, and a deleted line show in `singleTaskLines` over the merged list as stored, and by pane tests of the edits.

---

## Codex Plain Print Check

Make the check `ideas/vscode_extension_follow_up.md` records as unmade: run a short headless `codex exec` line whose skill ends on a known fixed line and record what that line's plain print opens with. Bring the entry `What a Codex line's plain print opens with` in that file up to date with the outcome, the runner staying as it is. Verified by the entry stating the line that was run and what its plain print opened with, as observed in a run on this machine.

---

## Design Draft Status Notes

Revise the status sentences of both design drafts and nothing else in them: the opening paragraph of `ideas/vscode_extension.md` records that this mission, named by its path, replaced the decisions that the extension composes no line, holds no host flag, model, or effort, and makes a variant a copied chain, while Decided, the Recipes part, and Considered and dropped stay as written. The opening of `ideas/vscode_extension_follow_up.md` and the items the change bears on are revised to match what the mission built. Verified by the two files' diff touching only those status sentences and items.

---
