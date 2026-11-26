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
