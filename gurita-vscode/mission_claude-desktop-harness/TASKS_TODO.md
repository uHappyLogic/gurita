# TASKS TODO

## Rewrite Lines Between Headless And Interactive

In the line-value module `gurita-vscode/src/lineValues.ts`, make a `claude`, `agy`, or `codex` line whose harness can be picked rewritable to its other form in both directions (`claude -p "…"` ⇄ `claude "…"`, `agy -p "…"` ⇄ `agy -i "…"`, `codex exec '$gurita:…'` ⇄ bare `codex '$gurita:…'`), the trailing `# interactive` mark added or dropped with the form and the prompt, model, effort, and bypass flag kept as written; the revised goal's harness dropdown picks a harness together with its form, and this pure-module rewrite, touching no dropdown and no Settings window, is what that pick will call. It is verified by unit tests in `src/test/lineValues.test.ts` that rewrite every shipped recipe line to its other form and back on each of the three CLIs and refuse the lines whose harness cannot be picked, with `npm test` passing under Node 22 through nvm.

---

## Offer Harness And Form In The Dropdown

In the Settings window's line editor (`gurita-vscode/src/variantEdits.ts`, `src/settingsWindow.ts`, `src/webview/settings.ts`), make the harness dropdown list a harness together with its form, as the revised goal asks: on the last line of a variant, the one line of a one-line variant included, `Claude Code`, `Claude Code interactive`, `Antigravity`, `Antigravity interactive`, `Codex`, and `Codex interactive`, so a headless last line can be made interactive and an interactive one headless, and on every earlier line only the three headless entries. A pick rewrites the line through the headless and interactive rewrite of `src/lineValues.ts` and stores it as a `custom N` variant as a harness pick does now, while the entries under Single-task lines and the lines of a looped recipe are left as they are. It is verified by unit tests that the entries appear on the right lines of the shipped recipes, that a pick stores the rewritten line, and that an interactive pick on a line that is not last is refused, with `npm test` passing under Node 22 through nvm.

---

## Offer Claude Desktop On Any One-Line Variant

Widen the harness dropdown's Claude Desktop entry, now reading `Claude Desktop interactive`, from a variant of exactly one interactive line (`Variant.singleInteractive` in `gurita-vscode/src/recipes.ts`, `lineEditor` and `replaceLineHarness` in `src/variantEdits.ts`, `rewriteHarness` in `src/lineValues.ts`) to any variant of exactly one line, headless included, in a local macOS window, since the revised goal makes Claude Desktop selectable on the last line of any variant and a headless one-liner such as `Finish mission` is refused today. A pick on the headless `Finish mission` line stores `claude-desktop "/gurita:finish-mission --mission <path>"; # interactive` as a `custom N` variant, its `-p`, model, effort, and bypass flag dropped, and a click on that variant sends it to Claude Desktop as any Desktop line is sent, while single-task lines and looped recipes stay refused and a multi-line chain's last line is not offered it by this task. It is verified by unit tests on `Finish mission` and the other shipped one-line headless recipes (the entry offered, the line stored, and the link sent with the finish prompt), with single-task lines still refused and `npm test` passing under Node 22 through nvm.

---

## Send A Chain's Last Line To Claude Desktop

Offer `Claude Desktop interactive` on the last line of a multi-line variant too, in a local macOS window, and run such a variant as the revised goal states: the earlier lines run in a VS Code terminal as an ordinary tracked run, and when they have all finished the last line opens in Claude Desktop through the `claude://code/new` link, with its typed values written in and the project's root as `folder`, as soon as the earlier lines finish and without waiting for the terminal to be closed; today a send happens only when the variant run is exactly one `claude-desktop` line (`desktopLine` in `gurita-vscode/src/desktop.ts`, `startAction` in `src/runs.ts`) and no line of a chain is offered Desktop. A chain that stops on an earlier line sends nothing, a last-line prompt past the limit of 14,336 characters is not sent and that line runs in the terminal as an interactive `claude` line as the existing over-long fallback does, a failed send shows the existing one error message, `runner.py` still never runs a line opening with the Desktop word, and single-task lines and looped recipes are left as they are. It is verified by unit tests that the entry is offered on a chain's last line only, that the send follows a finished chain with the right prompt and folder, that a stopped chain sends nothing, and that the over-long and failed-send cases hold, with `npm test` under Node 22 through nvm and the runner's pytest files passing.

---

## Document Harness Forms And Desktop Chains In Usage

Bring `gurita-vscode/USAGE.md` in line with the code the four preceding tasks leave, since the mission is done only when the reference is in place and it still describes a harness dropdown of one entry per harness that keeps the line's form, Claude Desktop offered only on a variant of one interactive line, `Finish mission` with no Desktop choice, and chains that never reach Desktop. It documents the dropdown's entries (`Claude Code`, `Claude Code interactive`, `Antigravity`, `Antigravity interactive`, `Codex`, `Codex interactive`, `Claude Desktop interactive`) and the lines each is offered on, the headless and interactive rewrite in both directions, Claude Desktop on any one-line variant with the `Finish mission` example, and, in `## Sending an action to Claude Desktop`, a chain whose last line goes to Desktop after its earlier lines ran in the terminal, with its stopped-chain, over-long, and failed-send cases, single-task lines and looped recipes documented as unchanged. It is verified by reading each changed passage against the code it describes and by `git diff --quiet -- gurita-vscode/README.md gurita-vscode/package.json` succeeding, no other listing text coming to name Claude Desktop and no extension release being made.

---
