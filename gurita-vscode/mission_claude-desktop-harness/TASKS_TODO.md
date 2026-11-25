# TASKS TODO

## Read And Rewrite Claude Desktop Lines

Add `claude-desktop` as the fourth command word of `HARNESSES` in `src/lineValues.ts`, a plain word matched by exact equality beside `claude`, `agy`, and `codex`, so a line opening with it reads as a Claude Desktop line with its quoted prompt and skill. Make `rewriteHarness` rewrite an interactive line onto Claude Desktop keeping its prompt and its trailing `# interactive` mark and dropping `--model`, `--effort`, and the bypass-permission flag, since no parameter of the `claude://code/new` link names a model, an effort, or a permission mode, so the stored line shows exactly what the session gets and no indicator of dropped values is built. Verified by `npm test` unit tests in `src/test/lineValues.test.ts` of reading a Desktop line and of rewriting each harness's interactive line onto it.

---

## Offer Claude Desktop In The Harness Dropdown

Add Claude Desktop to `SWITCHABLE` in `src/settingsWindow.ts` and make the line editor's harness dropdown offer it only on the line of a variant that holds exactly one line, an interactive one, a test new to `Variant`, which records only `singleTask` and `looped`, so no chain and no headless line can be set to it. A pick rewrites the line through `rewriteHarness` into a `custom N` variant in `~/.gurita/variants.json`, which the person then selects in the action button's existing dropdown; `shipped_recipes.md` ships no Desktop variant, and the action, the click, and the Settings window gain no other selection control. Verified by `npm test` unit tests that the dropdown offers Claude Desktop on a one-interactive-line variant and on no other line, and that a pick stores the rewritten line as a `custom N` variant.

---

## Send One-Line Actions To Claude Desktop

When the variant an action runs is one line opening with `claude-desktop`, send it to Claude Desktop instead of starting a terminal run, at the six call sites that start a chain (five in `src/pane.ts` and `runCapture` in `src/finishedWindow.ts`): build the prompt with the typed values written in and pass the `claude://code/new` link, carrying that prompt and the project's root as `folder`, to `open` as an `execFile` child, without the `claude` CLI or its `--desktop` option, so `runner.py` never sees the Desktop word. The send is fire-and-forget: no run is tracked and VS Code shows nothing after a send that went out, while a failed send, detected only from the outcome of the `open` call with no check beforehand, is shown as one `showErrorMessage` saying the action could not be sent to Claude Desktop and carrying the cause the call reported. Verified by `npm test` unit tests of the prompt with its values written in, the link built from it and the root, the absence of a tracked run, and the error message on a failed `open`.

---

## Run Over-Long Desktop Prompts In A Terminal

Before a send to Claude Desktop, measure the prompt with its typed values written in as Desktop measures it against the 14,336 characters at which the `claude://code/new` link cuts its prompt: a prompt within the limit is sent as usual, and one past it is not sent but run in a VS Code terminal instead, without asking, as an ordinary tracked run with the value typed, with one notice telling the person the prompt was too long for Claude Desktop. The terminal line is built by the extension before the run starts, the Desktop line with its opening word replaced by `claude` and every other word kept as stored, and goes to `startChain` as an ordinary one-line chain, `runner.py` unchanged. Verified by `npm test` unit tests of a prompt at the limit being sent, of one past it starting the one-line `claude` chain with the notice, and of the fallback line built from a Desktop line holding only its prompt and from one still holding flags.

---

## Limit Claude Desktop To Local macOS Windows

Offer Claude Desktop only where the extension host runs on macOS in a local window, `process.platform === 'darwin'` with no `vscode.env.remoteName`, by a fixed rule read from the window with no probe of the application. In a local Linux window and in every remote window (Remote-WSL, SSH) it is not offered, neither as a row under Harnesses nor as a choice in the harness dropdown, and no variant whose line opens with `claude-desktop` is selectable for an action. Verified by `npm test` unit tests of the rule over both values and of the row, the dropdown, and the pages' variant lists where the rule does not hold.

---

## Document Claude Desktop In The Usage Reference

Document the Claude Desktop harness in `gurita-vscode/USAGE.md`, the last piece the mission is done by: its row and presence check under Harnesses, the `claude-desktop` line word and its dropdown choice on a variant of one interactive line, the line values the rewrite drops, the fire-and-forget send and its error message, the fallback to a terminal for a prompt past 14,336 characters, and the local-macOS-only rule. No other listing text comes to name Claude Desktop: the listing `README.md`, the manifest's `description`, and its `keywords` stay as they stand, and no extension release is made. Verified by reading each documented behaviour against the built code and by `git diff` showing `README.md` and the manifest unchanged.

---
