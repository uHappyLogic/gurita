# TASKS TODO

## One Shipped Variant per Chain

In `snippets/GURITA_USAGE.md`, the shipped recipe file Gurita for VS Code reads, the `#### Antigravity` copies of `First run`, `Requirements iteration`, `Prepare tasks`, `Finish mission`, and `Execute tasks` leave the file: the first four each become a recipe of one block with no `####`, and `Execute tasks` keeps two variants named without a harness, `Normal difficulty` holding the `opus` line at `high` and `Critical tasks` the `opus` line at `xhigh`. It is needed because the settings view's per-row harness dropdown reaches Antigravity from any line, so a recipe is no longer grouped into one shipped copy per harness, and it replaces the recorded shipped-variant-format decision that a chain's variants on both harnesses stand under one heading and the execution-recipe decision's three variants; the mixed-agent chain, the seven button recipes, the three single-task lines under their present names, and the Antigravity notes stay as written, so Antigravity's model and effort lists are still derived from shipped lines, and a stored copy of a removed variant stays listed as a stored variant of its recipe. It is verified by the tests that read the shipped file (in `gurita-vscode/src/test/recipes.test.ts`, `harnessLists.test.ts`, and `lineValues.test.ts`) passing in their revised form, by `npm test` passing, and by `gurita-vscode/README.md` and the repository-layout entry of `CLAUDE.md` describing the file as it stands.

---

## New Task Button Above the Panes

On the mission page of Gurita for VS Code (`gurita-vscode/src/webview/page.ts`), the New task button, with its label and variant dropdown, moves out of the Remaining tasks pane into a row of its own directly above the Open questions and Remaining tasks headers, so it is drawn on every mission page whichever pane is shown and at every workflow step, still disabled while a run for the mission is going. It is needed because the button is not drawn while Open questions is shown, so a task cannot be added from a page that opens there. It is verified by page tests showing the button with either pane selected and absent from the Remaining tasks pane itself, by `npm test` passing, and by `gurita-vscode/README.md` describing the button where it is drawn.

---
