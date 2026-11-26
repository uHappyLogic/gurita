# Claude Desktop harness

## Goal

Add Claude Desktop to Gurita for VS Code as a fourth harness beside Claude Code, Antigravity, and Codex, listed under Harnesses in the Settings window and selectable, always as an interactive session, on the last line of any action's variant, so that a person who needs Desktop's visual and sound artifacts (samples for the alternatives of an open question, for example) can open that line as a session in Claude Desktop's Code tab on the project's folder instead of in a VS Code terminal: a variant of one line is sent to Desktop outright, and a chain runs its earlier lines in the terminal and then opens its last line in Desktop; the send itself is fire-and-forget, with no run tracked for the session Desktop opens. To make that selection, the line editor's harness dropdown picks a harness together with its form, headless or interactive, in both directions, the interactive forms offered on a variant's last line only, while single-task lines and looped recipes are left as they are. The mission opens with a hands-on check of what Claude Desktop accepts from outside: a session with the prompt prefilled is enough, model, effort, and permission mode are carried only where Desktop takes them, and if no prompt can be passed the mission stops there and records why. It is done when the feature, its tests, and gurita-vscode/USAGE.md are in place, and it makes no extension release.

## Relevant starting state

### The harness set

Gurita for VS Code knows three harnesses, each a CLI a recipe line opens with. `src/harnessCheck.ts` lists them as `HARNESSES`, each a key, a name, and a command (`claude`, Claude Code, `claude`; `antigravity`, Antigravity, `agy`; `codex`, Codex, `codex`), in the order the Settings window draws them, its `Harness` interface typing the key as one of those three, which `HarnessKey` in `src/harnessSettings.ts` reuses. `src/lineValues.ts` holds a second list by command word, `HARNESSES = ['claude', 'agy', 'codex']`, and `src/settingsWindow.ts` a third, `SWITCHABLE`, pairing key and command for the line editor's harness dropdown; the packaged `harness_check.py` and `install_plugin.py` name the same three keys. A line's harness is its first word when that word is one of the three commands, and every other line has none, so nothing in the extension stands for a harness that is not a command a line opens with.

### Line forms and kinds

A line is one of three kinds, read from its text by `isHeadless` in `src/recipes.ts` and `line_kind` in `runner.py`: headless when it holds a `/gurita:` or `$gurita:` invocation and no trailing `# interactive` mark, interactive when it ends in that mark, and a shell step otherwise. The interactive form is `claude "/gurita:<skill> …"`, `agy -i "…"`, or a bare `codex '$gurita:<skill> …'`, and the headless one `claude -p`, `agy -p`, or `codex exec`. Each line carries its model and effort in its own text (`--model` and `--effort` on `claude` and `agy`, `-m` and `-c model_reasoning_effort=<level>` on `codex`) and its permission mode only as the bypass flag, `--dangerously-skip-permissions` or `--dangerously-bypass-approvals-and-sandbox`; `lineValues.ts` reads the harness, model, effort, and skill of a line's first command and finds the quoted prompt word that invokes the skill.

### Actions of one interactive line

In `shipped_recipes.md` the variants holding exactly one line, an interactive one, are both variants of `Execute tasks` and the one variant of `discuss-open-question`, `discuss-mission-goal`, `discuss-new-task`, `ask-in-mission-context`, and `capture-mission-principle-updates`, every one of them a `claude` line. `Execute tasks` is a button in a mission page's action list, and the five others are fired by their fixed names (`BUTTON_RECIPES` in `src/recipes.ts`): the question card's discuss button, the side-bar view's New mission row, the mission page's New task and Ask in mission context buttons, and the Capture principles button of a finished mission's window. A `Variant` records `singleTask` (one headless line holding `<Task Title>`) and `looped`, and nothing marks a variant of one interactive line. `First run`, `Approve all standing recommendations and review again`, and `Prepare and Execute tasks` end in an interactive line but are chains of several lines.

### How an action is run

Every run is the bundled `runner.py` started as a terminal's own process at the project root (`startChain`, `startLoop`, and `launch` in `src/runs.ts`), and six call sites start a chain: five in `src/pane.ts` (`runRecipe`, `runQuestionButton`, `runAlternativeButton`, `runMissionAction`, `runStartingRow`) and `runCapture` in `src/finishedWindow.ts`. A run is tracked from its start until its terminal closes: the mission's page draws every action button disabled meanwhile, a second click for that mission is refused, and the live missions are re-read when the terminal closes. A placeholder's value never enters a line's text: `buildLine` in `src/placeholders.ts` writes each `<name>` as a reference to its `GURITA_*` session variable and the value is set only in the terminal's environment, so no function yields a line's prompt with its values written in. The extension opens nothing outside the editor: it calls no `vscode.env.openExternal`, registers no URI handler, and its child processes are `execFile` reads of git and the packaged Python tools.

### How a harness is picked for a line

No action carries a harness setting of its own: an action runs the lines of its selected variant, and the harness is the command each line opens with. In the Settings window's line editor, under **Variants** and **Single-task lines**, a `claude` or `agy` line carrying both `--model` and `--effort`, and a `codex exec` or bare `codex '$gurita:…'` line carrying `-m`, gets a harness dropdown offering all three harnesses, headless and interactive lines alike; a pick rewrites the line through `rewriteHarness` in `src/lineValues.ts`, keeping its prompt and its headless or interactive form, and stores the result in `~/.gurita/variants.json`, as a `custom N` variant beside a shipped, project, or own one. Each action button's dropdown then selects among the action's variants, the selection remembered in `workspaceState`.

### The Settings window's Harnesses part

Under **Harnesses** the window lists the three harnesses, each with the outcome of the harness check (`harness_check.py`: the CLI found in the runner's session shell, a Gurita plugin copy read through the CLI's plugin listing, and that copy's version against the packaged one), **Install** and **Update** controls that run `install_plugin.py` in a terminal, and an **Enabled** or **Disabled** state with its one switching control. The state is kept in the `harnesses` object of `~/.gurita/variants.json`, keyed `claude`, `antigravity`, or `codex`, beside the overlay on each harness's model and effort lists, which **Models and efforts** derives from the values the recipe lines carry. A disabled harness leaves every variant with a line opening with its command out of the pages' lists, and the side-bar view's plugin notice row counts an enabled harness whose CLI is found and whose plugin or version check fails. Every check and control assumes a CLI: none reads anything of an application that is not a command in the shell.

### Claude Desktop as found on this machine

Nothing in the repository mentions Claude Desktop outside this mission's own files, and no hands-on check of it has been run. On 2026-11-25 `/Applications/Claude.app` is installed at version 6.28899.6 (`com.anthropic.claudefordesktop`), its bundle updated that evening from the 5.11492.5 first read here, and registers the URL scheme `claude`. Read statically from the 6.28899.6 bundle that day, with no link opened: the handler of `claude://code/new` takes the prompt from `q`, or from `prompt` when `q` is absent, cut at 14,336 characters, takes each `folder`, and forwards beyond those only `environment` and `runner_pool`, or, where no `folder` is given, an SSH target named by `ssh_host`, `ssh_port`, and `ssh_folder`, so no parameter of that link names a model, an effort, or a permission mode; the application's own Finder service opens `claude://code/new?folder=<folder>&source=services`. The `claude` CLI installed on the machine, 2.1.332, lists the option `--desktop`, `Open in the Claude Desktop app instead of the terminal (with --continue or --resume <id> to pick the session)`. Whether a prompt passed either way arrives prefilled or already sent, and in which folder the session opens, has not been observed.

### Tests and documentation

The extension's unit tests are `node:test` files under `src/test/`, one per module (`lineValues`, `harnessCheck`, `harnessSettings`, `harnessLists`, `recipes`, `runs`, `pane`, `settingsPage`, and `settingsWindow` among them), run by `npm test` under Node 22, and `runner_tests/` holds the pytest files of `runner.py`, `harness_check.py`, and `install_plugin.py`, collected by both pytest runs. `gurita-vscode/USAGE.md` (1,302 lines) is the installed extension's reference: **The Settings window** documents the harness check, installing and updating, enabling and disabling harnesses, the model and effort lists, and the line editor's harness dropdown, **Recipes** the three line kinds, and **The runner** the terminal run. `README.md`, the listing showcase, and the manifest's description and keywords name the three harnesses. The manifest stands at version 0.3.0, released on 2026-11-25 under the tag `gurita-vscode-0.3.0`, and `CHANGELOG.md` gets its entries from `/release-vscode-extension`.

### The record and what is in flight

Six finished missions built this scope between 2026-11-20 and 2026-11-25, and three bear here. `gurita-vscode/mission_recipe-variants-and-harness-settings/` (finished 2026-11-23) made the variants, the variant store, the harness check, the enabled state, and the per-line harness, model, and effort edits; `gurita-vscode/mission_plugin-install-and-update-from/` (2026-11-24) added the **Install** and **Update** controls and the scopes, disabled copies, and other sources the check reports; and `gurita-vscode/mission_tracker-improvements-and-next-release/` (2026-11-25) named recipes actions where they are fired, added the multi-line input panel and `gurita.autoCloseFinishedRuns`, and put Codex in the harness dropdown, the last harness that dropdown gained. Two root missions finished on 2026-11-25 after this section was first written. `mission_mechanical-issues/` closed the failures recorded in `ideas/mechanical_issues.md` in the plugin's tools and skills and changed nothing under `gurita-vscode/`. `mission_readme-knowledge-tree/` replaced the root `CLAUDE.md` with a knowledge-tree root node of at most 20,000 bytes, in which the `### gurita-vscode/` description is this folder's node, checked by `tests/test_knowledge_tree.py` in `uv run pytest`, and moved the source of the extension's `bundled/fixed_lines.tsv` to `tests/fixed_console_lines.tsv`. One other live mission overlaps this scope, `mission_project-defined-knowledge-placement/` at the root, defined and not started: its goal is to make the plugin agnostic about where a project keeps its lasting knowledge, and nothing of it is settled.

## Decisions

### Over-long Desktop prompt

Before sending an action to Claude Desktop, the extension builds the prompt with the typed values written in and measures it as Desktop measures it against the limit Desktop accepts from outside, the `claude://code/new` link cutting its prompt at 14,336 characters. A prompt within the limit is sent to Desktop as usual. A prompt past the limit is not sent to Desktop: the extension runs the action in a VS Code terminal instead, without asking, as an ordinary tracked run with the value typed, and tells the person in one notice that the prompt was too long for Claude Desktop.

### Hands-on check record

The findings of the hands-on check of Claude Desktop are recorded in one of two places, by the check's outcome. Where the mission goes on, they are kept as a dated comment block in the extension's source beside the Claude Desktop harness entry, in `src/harnessCheck.ts` next to `HARNESSES`, naming the day, the Claude Desktop version checked, what was passed, and what arrived; a later re-check updates that block in place, as the dated hands-on block in the header comment of each host's `scripts/hosts/<host>/settings.toml` is updated. Where the mission stops because no prompt can be passed, no harness code is written, so the findings go into the mission's own record and the summary body of its `Mission-finish:` commit.

### Desktop selection mechanism

Claude Desktop is selected through the line, keeping the rule that a line's harness is the command it opens with. A Desktop line opens with a word of its own that names no CLI, a fourth key added to the three harness lists (`HARNESSES` in `src/harnessCheck.ts`, `HARNESSES` in `src/lineValues.ts`, and `SWITCHABLE` in `src/settingsWindow.ts`). The line editor's harness dropdown offers Claude Desktop only on the line of a variant that holds exactly one line, an interactive one; that test is new, since `Variant` records only `singleTask` and `looped`. A pick rewrites the line through `rewriteHarness` into a `custom N` variant in `~/.gurita/variants.json`, and the person then selects that variant in the action button's existing dropdown, the selection remembered in `workspaceState` as now. `shipped_recipes.md` ships no Desktop variant, and the action, the click, and the Settings window gain no other selection control.

### Desktop harness availability

Claude Desktop is offered only where the extension host runs on macOS in a local window, `process.platform === 'darwin'` with no `vscode.env.remoteName`. In a local Linux window and in every remote window (Remote-WSL, SSH) it is not offered and is never selectable for an action. The rule is fixed and read from the window, with no probe of the application.

### Listing texts naming Desktop

No text outside `gurita-vscode/USAGE.md` comes to name Claude Desktop in this mission. The listing `README.md` (its opening paragraph, its Settings window paragraph, its "What the extension needs" list, and the `settings-window.png` still with its alt text), the manifest's `description`, and its `keywords` stay as they stand; they come to name Claude Desktop in whatever later work prepares the release that first ships the feature.

### Session opening mechanism

The extension sends an action to Claude Desktop through the `claude://code/new` link, with the prompt's values written in and the project's root as `folder`, passed to `open`, the macOS opener, as an `execFile` child, the way the extension already runs its git and Python reads. The `claude` CLI and its `--desktop` option are not used.

### Desktop Harnesses row

Claude Desktop's row under Harnesses keeps the Enabled or Disabled state and its switch, and makes one check of its own in place of the CLI check: whether Claude Desktop is installed on the machine, read from the application bundle (`/Applications/Claude.app`, its version taken from the bundle as information only) or from a registered handler of the `claude` URL scheme, never through a command in the shell. The row makes no plugin check and no version check of a Gurita copy and carries no Install or Update control. A failed presence check is drawn on the row only and is not counted by the side-bar view's plugin notice, which counts plugin and version failures.

### Desktop send feedback

After a send that went out, VS Code shows nothing; Claude Desktop coming to the front is the sign. A failed send is detected only from the outcome of the send call itself (the opener's returned result or the exit status of the command that opens the session), with no check made beforehand, and is shown as one error message (`showErrorMessage`, as the extension's other failures use) saying the action could not be sent to Claude Desktop and carrying the cause the call reported.

### Hands-on check timing

The full hands-on check of Claude Desktop is run before the answers that hinge on its outcome are given, with its findings written into `## Relevant starting state`, and not as the mission's first task after task derivation. Only the questions whose answer hinges on what the check finds wait for it; a question whose answer holds whatever it finds (how Desktop is selected for an action, the Harnesses row, the listing texts, the send feedback) is recommended and answered ahead of the check, each through a single-question answer skill rather than the whole-mission sweep.

### Over-long fallback line

When an action's prompt is past the limit Claude Desktop accepts and the action runs in a VS Code terminal instead, the extension builds the terminal line itself before starting the run: the Desktop line with its opening word replaced by `claude` and every other word kept as stored (the quoted `/gurita:` prompt, `--model`, `--effort`, the `--dangerously-skip-permissions` flag where present, and the trailing `# interactive` mark). The resulting interactive `claude "/gurita:<skill> …"` line goes to `startChain` as an ordinary one-line chain, honouring any flag the line still holds and opening Claude Code on its own defaults when the line holds only its prompt. `runner.py` is unchanged and never sees the Desktop word.

### Desktop line opening word

A Claude Desktop line opens with the plain product-qualified word `claude-desktop`, the fourth entry of the command-word list, and that one word is what the Settings window's line editor shows, `~/.gurita/variants.json` stores, and `gurita-vscode/USAGE.md` documents. It is a plain word matched by exact equality beside `claude`, `agy`, and `codex`, carrying no sigil or other syntax of its own.

### Check stop conditions

No stop list beyond the goal's is fixed ahead of the hands-on check: a finding that no prompt can be passed is the only one that stops the mission outright. A finding that the session cannot be opened on the project's folder, that the `/gurita:` skills are not available in a Desktop session, or of something nobody foresaw is weighed when it is found, as a goal revision or a new open question, deciding then whether the mission stops, narrows, or goes on with a hand step.

### Uncarried line values

A line set to go to Claude Desktop does not go on carrying values Desktop does not take. When a line is set to go to Claude Desktop, the stored line is rewritten without whichever of `--model`, `--effort`, and the bypass-permission flag Desktop does not take, so the line text shows exactly what the session gets and nothing is uncarried. No indicator of dropped values is built in the Settings window, on the action's button, or at the send.

## Out of Scope

