# TASKS TODO

## Variant Dropdown With Remembered Selection

Draw beside each recipe button on the mission page a dropdown that switches the recipe's variant, a person's own variants marked as theirs, the button's label and hover text following the selected variant and a click running it, with no dropdown beside any of the seven fixed-name buttons. The selection is remembered per recipe name on one mission, keyed by the mission's path as the pane lists it, in the project's `ExtensionContext.workspaceState` as a map from mission path and recipe name to variant name, nothing written into the project's tree. A remembered selection always wins over the recipe's default, a remembered variant that no longer exists is dropped so the button falls back to the current default, and the pane starts no variant its last posted list lacks; verified by the page and pane tests, with `gurita-vscode/README.md` describing the dropdown.

---

## Settings View Placement in the Pane

Add the settings view to the pane: a control at the end of the tab row, beside Refresh, New mission, and Define mission and drawn in the failure state as they are, swaps the page beneath the row for the settings view, and a control on that view, or a click on any mission tab, swaps back to the mission page shown before. The mission tabs keep holding missions only, the extension contributes no command for the view, and the view holds buttons and dropdowns only, its harness and variant sections being added by the tasks that follow. Verified by page tests of the swap in both directions and in the failure state, with `gurita-vscode/README.md` saying how the view is opened.

---

## Bundle the Packaged Plugin Version

Have `gurita-vscode/scripts/bundle.js` record the plugin version the extension is packaged from: it reads the repository's `VERSION` and writes it into `bundled/` beside the files it already writes, because the package holds no record of that version and the harness check compares an installed Gurita copy's version against it. Verified by running the package script under Node 22 through nvm: the VSIX holds the record reading what `VERSION` reads, and nothing the step writes is tracked.

---

## Harness Check Script Beside the Runner

Add a new stdlib Python script beside `gurita-vscode/runner.py` that runs the harness check for Claude Code, Antigravity, and Codex: it imports the runner as a module, as `runner_tests/conftest.py` already does, calls its `session_shell` for the shell, runs each harness's CLI lookup and its listing (`claude plugin list --json`, `agy plugin list --json`, `codex plugin list -m gurita --json`) in that one session, and prints one result saying for each harness whether its CLI was found and which version its installed Gurita copy reads, or that none is installed, `runner.py` itself unchanged. For Claude Code the installed copy is chosen among the `gurita@gurita` entries that apply to the project root the script is given (the `user`-scope entry and every `project`- or `local`-scope entry whose `projectPath` equals that root, other projects' entries and `synced` entries ignored, `local` winning over `project` over `user`, a disabled winning entry meaning not installed), and its version is `folderVersion` whenever the entry carries `readFromFolder` and `version` for every entry without it. Verified by pytest tests under `gurita-vscode/runner_tests/` over canned listings, starting no shell session and passing in both pytest runs, and by one run of the script on this machine.

---

## Harness Check in the Settings View

Show the harness check in the settings view: the extension runs the check script through `execFile` the first time the view is opened after the panel is created, keeps the result for the panel's lifetime and shows it on every later opening without running again, and re-runs it only from a check-again control in the view, no pane re-read or Refresh running it. Beside each of Claude Code, Antigravity, and Codex the view names which of the three checks failed: CLI not found, Gurita plugin not installed, or installed version differing from the packaged one, the version `bundle.js` recorded. A failed check is shown in the settings view alone, the mission pages drawing every variant, the seven fixed-name buttons, and the looped run exactly as they would with every check passing; verified by pane and page tests with the script's print stubbed, with `gurita-vscode/README.md` describing the check.

---

## Enable and Disable Harnesses

Let the settings view enable and disable each of the three harnesses, the state kept in the part of the variant store file set aside for harness values: every harness starts enabled, whatever its check reports and whatever recipes run on it, and stays enabled until the person disables it, the check result never changing it. A variant with at least one line on a disabled harness, mixed variants included, is left out of the list the pane posts, so out of its recipe's dropdown and refused on a click, a recipe whose every variant is left out loses its button, and where the default or the remembered variant is left out the button runs the default if that variant is still listed and otherwise the first listed variant, the remembered selection kept for when the harness is enabled again. Disabling acts on the mission page's recipe list alone, the seven fixed-name buttons running their recipes as before and the preview's override list, the rules, and the `--line` arguments keeping every named single-task line; verified by unit, pane, and page tests.

---

## Harness Model and Effort Lists

Give each harness its model list and its one effort list for the whole harness in the settings view, Codex a model list and no effort list: each list is read from the `--model` and `--effort` values, on a Codex line `-m`, carried by the lines of the shipped recipes, the own recipes, and the stored variants, the extension shipping no list of its own and querying no harness. The person can add an entry no line uses yet, typed into VS Code's own input box, and remove a derived entry from the offer, the additions and removals stored per user as an overlay on the derived lists in the harness part of the variant store file. Verified by `node:test` unit tests of the derivation and the overlay and by pane and page tests of the add and remove controls.

---

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
