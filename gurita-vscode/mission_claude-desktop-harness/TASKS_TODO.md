# TASKS TODO

## Rewrite Lines Between Headless And Interactive

In the line-value module `gurita-vscode/src/lineValues.ts`, make a `claude`, `agy`, or `codex` line whose harness can be picked rewritable to its other form in both directions (`claude -p "…"` ⇄ `claude "…"`, `agy -p "…"` ⇄ `agy -i "…"`, `codex exec '$gurita:…'` ⇄ bare `codex '$gurita:…'`), the trailing `# interactive` mark added or dropped with the form and the prompt, model, effort, and bypass flag kept as written; the revised goal's harness dropdown picks a harness together with its form, and this pure-module rewrite, touching no dropdown and no Settings window, is what that pick will call. It is verified by unit tests in `src/test/lineValues.test.ts` that rewrite every shipped recipe line to its other form and back on each of the three CLIs and refuse the lines whose harness cannot be picked, with `npm test` passing under Node 22 through nvm.

---

## Offer Harness And Form In The Dropdown

In the Settings window's line editor (`gurita-vscode/src/variantEdits.ts`, `src/settingsWindow.ts`, `src/webview/settings.ts`), make the harness dropdown list a harness together with its form, as the revised goal asks: on the last line of a variant, the one line of a one-line variant included, `Claude Code`, `Claude Code interactive`, `Antigravity`, `Antigravity interactive`, `Codex`, and `Codex interactive`, so a headless last line can be made interactive and an interactive one headless, and on every earlier line only the three headless entries. A pick rewrites the line through the headless and interactive rewrite of `src/lineValues.ts` and stores it as a `custom N` variant as a harness pick does now, while the entries under Single-task lines and the lines of a looped recipe are left as they are. It is verified by unit tests that the entries appear on the right lines of the shipped recipes, that a pick stores the rewritten line, and that an interactive pick on a line that is not last is refused, with `npm test` passing under Node 22 through nvm.

---
