# TASKS TODO

## Rewrite Lines Between Headless And Interactive

In the line-value module `gurita-vscode/src/lineValues.ts`, make a `claude`, `agy`, or `codex` line whose harness can be picked rewritable to its other form in both directions (`claude -p "…"` ⇄ `claude "…"`, `agy -p "…"` ⇄ `agy -i "…"`, `codex exec '$gurita:…'` ⇄ bare `codex '$gurita:…'`), the trailing `# interactive` mark added or dropped with the form and the prompt, model, effort, and bypass flag kept as written; the revised goal's harness dropdown picks a harness together with its form, and this pure-module rewrite, touching no dropdown and no Settings window, is what that pick will call. It is verified by unit tests in `src/test/lineValues.test.ts` that rewrite every shipped recipe line to its other form and back on each of the three CLIs and refuse the lines whose harness cannot be picked, with `npm test` passing under Node 22 through nvm.

---
