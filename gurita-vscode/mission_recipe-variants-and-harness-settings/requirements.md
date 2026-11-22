# Recipe variants and harness settings view

## Goal

Replace the mission page's host-grouped recipe list in Gurita for VS Code with one button per recipe carrying selectable variants. Each variant is a literal block of command lines; the button shows the harness, models, and efforts of the selected variant, read from its lines, and a dropdown beside it switches variants, the choice remembered. Add a settings view to the pane that checks each harness (its CLI found through the runner's shell, its installed Gurita plugin, and that copy's version against the one the extension was packaged from), enables or disables it, holds its model and effort lists, and edits variants: duplicate, rename, delete, pick the default, and change each line's model and effort, stored as literal lines in a per-user file. The looped task run, its rule file, and the runner stay as they are.

## Relevant starting state

### The mission page's recipe list

`gurita-vscode/src/webview/page.ts` draws each mission page's recipes in `drawRecipes`, under a Recipes heading: one button per recipe, grouped under the headings Claude Code, Antigravity, and Your recipes, each button labelled with the recipe's name and carrying its lines as written in its hover text. A click posts `runRecipe` with the mission's path and the recipe's name, or `previewLoop` for a looped recipe, and a recipe holding a placeholder the extension does not know is drawn as a non-runnable entry naming it. `gurita-vscode/src/pane.ts` posts the list with each mission, already narrowed to the step the mission's workflow diagram fills (`stageRecipes`) and to the recipes whose only placeholder is `<path>` (`pageRecipes`), and it starts a clicked recipe only when the list it last posted for that mission holds that name. Every action button on a page is drawn disabled while a run started for its mission is going.

### The recipe reader, `gurita-vscode/src/recipes.ts`

A recipe is a `###` heading, its name, and the non-blank lines of the first fenced block beneath it, with an optional `Stage:` line between the two naming the workflow step whose pages list it. The name is a recipe's only identity: an own recipe carrying a shipped recipe's name replaces it whole and in place, the seven buttons outside the list each run the recipe of one fixed name (`BUTTON_RECIPES`), and the looped run and the rule file name single-task lines by their headings. A recipe is one block of lines, and nothing in the reader groups two recipes or holds a second block under one name. The reader classifies a recipe by its content alone (single-task line, looped, known and unknown placeholders), and neither it nor any other module under `src/`, nor `runner.py`, reads a line's command, its `--model`, or its `--effort`.

### The shipped recipe file, `snippets/GURITA_USAGE.md`

The file holds 16 recipes under `## Claude Code` and 8 under `## Antigravity`, and the package carries it as `bundled/GURITA_USAGE.md`, read at run time. Every line opens with `claude` or `agy`, headless with `-p` and interactive without it (`agy -i`) under a closing `# interactive` comment, and carries `--dangerously-skip-permissions`, `--model "<name>"`, and `--effort <level>` before its closing `;`. The models written are `fable`, `opus`, and `sonnet` on `claude` and `gemini-4-argon` and `claude-opus-5-5` on `agy`, and the efforts `medium`, `high`, and `xhigh`. A chain run on the other harness is a separate recipe whose heading ends in `(Antigravity)` (First run, Requirements iteration, Prepare tasks, Execute tasks of normal difficulty, Execute tasks (critical tasks), Finish mission), the two Claude Code `complete-all-tasks` recipes differ only in effort, the Antigravity critical one runs its one line on `claude` at `xhigh`, and `Mixed-agent requirements review (Gemini reviews, Claude annotates)` mixes `agy` and `claude` lines in one chain. The seven button recipes and two single-task lines stand under `## Claude Code` only, a third single-task line under `## Antigravity`, the looped recipe `Execute tasks one at a time` holds the slot line `<single-task line>` alone, and two tests in `gurita-vscode/src/test/recipes.test.ts` read this file itself, the others fixtures under `src/test/fixtures/recipes/`.

### A person's own recipes and what the extension stores

The one per-user file is the own recipe file, `~/.gurita/recipes.md` by default and moved by `gurita.ownRecipesFile`, the only setting the manifest contributes, at application scope. The extension reads it afresh with the shipped file on every re-read of the pane and at every click of a fixed-name button or a looped recipe, and writes neither it nor any other file, and `~/.gurita/` does not exist on this machine. The extension uses no `globalState`, `workspaceState`, or storage directory; the page saves only the selected mission and each question view's position, with the webview's `setState`, which lasts while the panel stays open.

### The pane and its page

The extension holds one webview panel (`gurita.missionPane`, titled Gurita Missions), opened by the command `gurita.openMissionPane`, whose page shell and stylesheet `src/pane.ts` sets once and whose content one script, `src/webview/page.ts`, redraws whole from each message. The page is a row of mission tabs ending in **Refresh**, **New mission**, and **Define mission**, with the selected mission's page or the one failure state beneath; it has no view that belongs to no mission. Page and extension exchange the typed messages `PageMessage` and `PaneMessage`, and every value a person types goes through VS Code's input box, nothing being typed on the page, whose one dropdown is the per-task `select` of the looped run's preview. `src/test/page.test.ts` runs the page script against a stand-in for the DOM and `src/test/pane.test.ts` the pane against a stub of the `vscode` module, and nothing runs inside an editor.

### How runs and child processes start

Each run is a terminal whose own process is `python3 runner.py chain -- LINE...`, or `loop`, started by `src/runs.ts` at the project root with the placeholder values in its environment as `GURITA_*` variables. The runner composes the lines into one script and runs it with the shell `$SHELL` names, as an interactive shell (`-i`), when that shell is of the sh, bash, zsh family and with `/bin/sh` otherwise, so a line's `claude` or `agy` is found on the `PATH` that shell's startup files build. The extension's own child processes (`git rev-parse`, `missions.py live`, `runner.py preview`, the review-commit count) are started with `execFile` in the extension host's environment, through no shell. The runner's subcommands are `chain`, `check`, `preview`, and `loop`: none looks a command up or reports on a harness, and its pytest tests under `gurita-vscode/runner_tests/` start no shell session.

### The looped task run and the rule file

A named single-task line is any recipe of exactly one headless line holding `<Task Title>`, named by its `###` heading, and `src/loop.ts` hands each to the runner as one `--line NAME LINE`. `task_line_rules.txt` at the project root assigns each task to one of those headings, this repository's naming `Single task with Opus xHigh (Claude Code)` and `Single task with Opus High (Claude Code)`, and the preview's override list offers the same names. The three shipped headings spell out their line's model, effort, and harness by hand, and the runner fills `<path>` and `<Task Title>` itself.

### The harness CLIs and their installed Gurita copies

Checked on this machine on 2026-11-22: `claude` 2.1.330, `agy` 1.5.14, and `codex` 0.159.3 stand in `~/.local/bin`, and `$SHELL` is `/bin/zsh`. `claude plugin list --json` prints an array with one entry per plugin, scope, and project (66 here), each holding `id`, `version`, `scope`, `enabled`, and `installPath`; the two `gurita@gurita` entries, user scope and this project, read `version` 1.9.0 and also carry `readFromFolder`, this repository's `hosts/claude`, and `folderVersion` 2.0.0. `agy plugin list --json` prints an array whose `gurita` entry holds `name`, `enabled`, `version` (1.9.0), `source`, `path` (`~/.gemini/config/plugins/gurita`), and its skill and agent names. `codex plugin list -m gurita --json` prints an object whose `installed` array holds `pluginId` `gurita@gurita`, `version` 1.9.0, `installed`, and `enabled`, and it returned at once, while a bare `codex plugin list` also lists a remote catalog and ran for more than a minute in the one run made. Each host tree's manifest carries the plugin's version, rendered from `VERSION`, which reads 2.0.0: `hosts/claude/.claude-plugin/plugin.json`, `hosts/antigravity/plugin.json`, and `hosts/codex/plugins/gurita/.codex-plugin/plugin.json`.

### The models and efforts each harness takes

`claude --help` gives `--model` as an alias (`fable`, `opus`, `sonnet`) or a model's full name and `--effort` as one of low, medium, high, xhigh, and max, and it lists no command that prints the available models. `agy models` prints one `id<TAB>name` line per pair of model and effort, the effort the id's last part (`gemini-4-argon-medium`), while a line's `--model` takes the base id and its `--effort` the level, which `agy --help` gives as low, medium, high, xhigh, or max. On 2026-11-22 it listed `gemini-4-argon` and `claude-opus-5-5` at low, medium, and high and `gemini-4-neon` and `gemini-4-hydrogen` up to xhigh, among others. No file of the extension or the plugin holds a list of models or efforts per harness: the only ones written down are those the recipe lines carry and the notes under the snippet file's `## Antigravity` heading, which map `fable` to `gemini-4-argon` and `opus` to `claude-opus-5-5` and say those models stop at `high`.

### The package and the plugin version

The extension's version is its own, `0.1.0` in `gurita-vscode/package.json`, independent of `VERSION`, and `uhappylogic.gurita-vscode@0.1.0` is installed in this machine's editor. `gurita-vscode/scripts/bundle.js`, run by every `vsce package`, writes `bundled/missions.py`, `bundled/GURITA_USAGE.md`, and `bundled/fixed_lines.tsv` from the checkout and nothing else. The package therefore holds no record of the plugin version it was packaged from: nothing reads `VERSION` into it.

### Documentation and tests of the extension

`gurita-vscode/README.md` is the extension's one document and describes the page's recipe list with its host groups, the shipped and own recipe files, the setting, the looped run, and the runner; `CLAUDE.md` names the extension in its commands and repository layout, and `README.md`, `CONTRIBUTING.md`, and `docs/` do not mention it. `npm test`, run under Node 22 through nvm, compiles and runs the `node:test` unit tests under `gurita-vscode/src/test/`. CI runs only the runner's pytest tests, in both pytest runs, the drift-gate workflow setting up no Node.

### The record and what is in flight

No other live mission's scope overlaps `gurita-vscode/`, so nothing holds or shares it. The scope's one finished mission, `gurita-vscode/mission_vs-code-extension-first-version/`, finished 2026-11-20, built the extension described above; among its recorded decisions, every value is typed into VS Code's input box and nothing on the page, a recipe click starts its run at once with the recipe's lines readable beforehand, own recipes that replace no shipped one are listed in one group of their own below the host groups, and the own recipe file is `~/.gurita/recipes.md` under the setting `gurita.ownRecipesFile`. The design draft it built from, `ideas/vscode_extension.md`, records under Decided that the extension composes no line and holds no host flag, model name, or effort level, a task's combination being a reference to a named single-task line, and that a variant of a shipped chain is a chain copied into the person's own recipe file. `ideas/vscode_extension_follow_up.md` holds what that mission left out, among it the extension's Node steps in CI, a check that no snippet heading repeats, tests run inside an editor, and shipped Codex recipes, which wait on an unmade check of what a Codex line's plain print opens with.

## Decisions

### Settings view

- **Single-task lines.** The settings view lists the named single-task lines and gives them the same edits it gives variants: duplicate, rename, delete, and change the line's model and effort. Shipped single-task lines are treated exactly as shipped variants are. The results go to the same per-user store as variants, and a stored line reaches the merged recipe list under its name, so the looped run's named lines, the rule file, and the override list see it unchanged in form.
- **Shipped variants.** Every edit the settings view offers applies to a shipped variant as it does to a duplicate. Changing a line's model or effort, or renaming the variant, writes a stored copy to the per-user file. That copy stands in for the shipped variant and keeps its place in the recipe's dropdown. Deleting a shipped variant writes a record to the same file that hides it. The stored copy and the hiding record stay until the person resets the variant, and resetting removes them so the shipped variant shows again.
- **Codex.** Codex is a third harness in the settings view, covered as Claude Code and Antigravity are. It is checked through `codex plugin list -m gurita --json`, it can be enabled and disabled, and it holds a model list, a Codex line's model being rewritten through `-m`. It holds no effort list. The mission also makes the print check that was never made: it runs a short headless `codex exec` line whose skill ends on a known fixed line and records what that line's plain print opens with. It brings the entry in `ideas/vscode_extension_follow_up.md` up to date with that outcome. The runner stays as it is.

- **Typed values.** Every value typed in the settings view (a duplicate's name, a rename, and any other free-text entry the view takes) is asked for in VS Code's own input box, one box per value, as `askValues` in `src/pane.ts` asks for the mission page's values. A rename opens with the current name filled in, and the box's own validation refuses an empty name and one the recipe already uses. The page holds buttons and dropdowns only, and nothing is typed on it anywhere in the extension.

- **Placement.** The settings view is opened by a control at the end of the tab row, beside Refresh, New mission, and Define mission, the group that belongs to no mission and stays drawn in the failure state. A click swaps the page beneath the row for the settings view, and a control on that view, or a click on any mission tab, swaps back to the mission page shown before. The mission tabs keep holding missions only, and the extension contributes no command for the settings view.

### Recipes and variants

- **Mixed-agent chain.** `Mixed-agent requirements review (Gemini reviews, Claude annotates)` stays a recipe of its own, separate from `Requirements iteration`. It still declares the additional review round, its one shipped block is its only variant, and its lines stay as written. The additional review round's page therefore shows two buttons, `Requirements iteration` and the mixed-agent recipe.

- **Fixed-name button recipes.** The seven recipes the fixed-name buttons run carry variants as the listed recipes do, and the settings view lists them for duplicating, renaming, deleting, and model and effort editing. The variant a button runs is chosen only in the settings view, as that recipe's default, and the page draws no dropdown beside any of the seven buttons. The shipped file adds no variant for them, so each recipe ships as its one Claude Code variant and any further variant is a duplicate or an own recipe.

- **Own recipe of a shipped name.** A hand-written own recipe carrying a shipped recipe's name never replaces that recipe or any of its variants. Its block, or each of its variants when it writes several, joins the shipped recipe as one more variant, listed after the shipped variants under its own variant name and marked as the person's own. An own variant carrying a shipped variant's name is kept as a second entry beside it and does not take its place, so every shipped variant stays on the button.

- **Shipped variant format.** In the shipped recipe file each recipe is one `###` heading whose name is the recipe's name, with its optional `Stage:` line beneath it once for the whole recipe. Each variant is a `####` sub-heading naming the variant, followed by that variant's fenced block. A recipe's variants on both harnesses stand under one heading, so the `## Claude Code` and `## Antigravity` recipe sections become one recipe section, the Antigravity notes are kept there as prose, and the `(Antigravity)` heading suffixes go. A recipe with one block and no `####` is a recipe of one variant, so the button recipes and the single-task lines keep their `###` headings and the names the rule file and the preview's override list use. A hand-written recipe file can take the same form.

- **Lines without readable values.** On the recipe button each line adds only the values its text carries. A `claude` or `agy` line without `--model` or `--effort` adds its harness and whichever of the two flags it holds. A shell step, the slot line `<single-task line>`, and a line of a command the extension does not know add nothing, so a variant none of whose lines is readable, the shipped looped recipe among them, shows its name alone. In the settings view's line editor only a line of a known harness carrying both `--model` and `--effort` gets model and effort controls, a Codex line, whose harness holds no effort list, getting its model control when it carries `-m`. Every other line is shown as its text, read-only. The extension only replaces a value a line already carries and never inserts text into a line.

- **Default with no pick.** While no picked default stands for a recipe, its default is the first variant in the dropdown order, worked out afresh at each draw and never written. Renaming the picked default in the settings view carries the pick to the new name, so a rename never leaves the recipe without its pick. Only deleting the picked default drops the pick, and the recipe then falls back to the first listed variant.

- **Execution recipe.** `Execute tasks of normal difficulty` and `Execute tasks (critical tasks)` become one execution recipe under a single name that replaces both present names. Its variants are the distinct lines the four shipped copies hold: Claude Code at `high` (`opus`), Antigravity at `high` (`claude-opus-5-5`), and Claude Code at `xhigh` (`opus`). The Antigravity critical copy repeats the last of these and is dropped. `Execute tasks one at a time` stays a recipe of its own.

### Mission page

- **Recipe list layout.** The list keeps two parts under the page's Recipes heading. First comes one button per shipped recipe, in the shipped file's order and with no heading of their own, an own recipe carrying a shipped name joining that recipe's button as further variants. Then comes a group headed Your recipes, holding the own recipes that carry no shipped recipe's name, in the own file's order. Only the Claude Code and Antigravity headings go; the own group's heading, position, and order stay as they are.

- **Remembered selection.** The variant selected in a recipe's dropdown is remembered per recipe name on one mission, keyed by the mission's path as the pane lists it. It is kept in the project's `ExtensionContext.workspaceState`, as a map from mission path and recipe name to variant name. Nothing is written into the project's tree.

- **Button label.** A recipe button shows the selected variant's distinct harnesses once, its distinct models once, and its distinct efforts once, each as its own list in the order of first appearance and independent of the other two. `First run` reads claude · fable, opus · xhigh, high, and the mixed-agent chain reads agy, claude · gemini-4-argon, opus, fable · medium, high, xhigh. The label does not show which model runs at which effort; that stays readable in the lines as written.

- **Default and remembered selection.** The default picked in the settings view decides a recipe button's variant only while no dropdown selection is remembered for it. A remembered selection always wins over the default, and picking a new default leaves every remembered selection as it stands. A remembered variant that no longer exists, deleted or renamed in the settings view, is dropped, and the button falls back to the current default.

### Harness check

- **Shell.** A new stdlib Python script beside `runner.py` runs the check. It imports the runner as a module, as `runner_tests/conftest.py` already does, and calls its `session_shell` for the shell, then runs the CLI lookup and the harness's `plugin list --json` in that one session and prints one result, which the extension reads from an `execFile` call and parses. `runner.py` itself is not changed.

- **Claude Code plugin entry.** The candidates are the `gurita@gurita` entries that apply to the open project: the `user`-scope entry, and every `project`- or `local`-scope entry whose `projectPath` equals the project root the extension already resolves. Entries for other projects and `synced` entries are ignored. Of the candidates the most specific scope wins, `local` over `project` over `user`, and that one entry is the installed copy. Its `enabled` value counts: a disabled winning entry means Gurita is not installed for the project, even when a less specific entry is enabled. Matching is done on `projectPath`, so the command may run from any working directory.

- **Folder-read copy's version.** The check takes `folderVersion` as the copy's version whenever the entry carries `readFromFolder`, and `version` for every entry without it.

- **Failed check.** A failed check is shown in the settings view alone, beside the harness it concerns, naming which of the three checks failed: CLI not found, Gurita plugin not installed, or installed version differing from the packaged one. The mission pages draw every variant, the seven fixed-name buttons, and the looped run exactly as they would with every check passing, and a click runs the lines as written.

- **Timing.** The check runs the first time the settings view is opened after the panel is created. Its result is kept for the panel's lifetime and shown on every later opening without running again. A check-again control in the settings view re-runs it on request, and no pane re-read or Refresh runs it.

### Enabling and disabling harnesses

- **Initial state.** Every harness the settings view covers starts enabled, whatever its check reports and whatever recipes run on it. A harness stays enabled until the person disables it, harness by harness, and the check result never changes the enabled state.

- **Disabled harness.** A variant with at least one line on a disabled harness is left out of its recipe's dropdown, mixed variants included. The pane leaves it out of the list it posts, so a click on it is refused as a click on any name the posted list lacks is refused. A recipe whose every variant is left out loses its button. Where the default or the remembered variant is left out, the button runs the default if that variant is still listed and otherwise the first listed variant. The remembered selection is kept and comes back once the harness is enabled again.

- **Reach of disabling.** Disabling a harness acts on the mission page's recipe list alone. The seven fixed-name buttons run their recipes as before, whatever harness their lines name. The looped run's single-task lines are untouched: the preview's override list offers every named single-task line, the rules choose among all of them, and every line is still passed to the runner as one `--line`.

### Design drafts

- **Status notes.** The mission revises the status sentences of both drafts and nothing else in them. The opening paragraph of `ideas/vscode_extension.md` records that this mission replaced the decisions that the extension composes no line, holds no host flag, model, or effort, and makes a variant a copied chain, and it names the mission. Decided, the Recipes part, and Considered and dropped stay as written. The opening of `ideas/vscode_extension_follow_up.md` and the items the change bears on are revised to match.

### Model and effort lists

- **Source.** Each harness's model and effort lists are read from the `--model` and `--effort` values carried by the lines of the shipped recipes, the own recipes, and the stored variants. The extension ships no list of its own and queries no harness. Codex's model list starts from the Codex lines a person has, since no Codex line is shipped. The person can add entries no line uses yet and remove derived entries from the offer, and those additions and removals are stored per user as an overlay on the derived lists.

- **Effort list granularity.** Each harness holds one effort list for the whole harness, and the line editor offers that whole list for every line of the harness, whatever its model. The settings view keeps no record of which model takes which effort. A line given an effort its model lacks is accepted by the editor and stops when it is run, with the harness's own message, as a hand-written line does.

### Per-user store

- **Variant store file.** The settings view writes a new JSON file of the extension's own at a visible per-user path beside the own recipe file, such as `~/.gurita/variants.json`. It holds structured records laid over the recipe list, each a recipe name, a variant name, the variant's literal lines as an array of strings, and which variant is the recipe's default. The extension is the file's only writer, reads it with `JSON.parse`, and merges it with the recipes the Markdown reader yields. The own recipe file stays read-only to the extension and the one place for hand-written recipes.

## Out of Scope

