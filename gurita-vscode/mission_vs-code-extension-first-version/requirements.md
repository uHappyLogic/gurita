# VS Code extension first version

## Goal

Deliver a first version of Gurita for VS Code (`gurita-vscode`), built in this repository from the design in `ideas/vscode_extension.md` and packaged as a VSIX. It carries all three of the draft's layers: the mission pane with its question view, the recipe and per-question buttons run under the bundled Python runner, and the looped task run with its tracked rule file, preview, and overrides.

The draft's decisions stand for what the person sees and clicks. The parts that only guard a long-lived extension, such as the Node steps in the drift-gate workflow and the cross-checks against the plugin's tools and fixed-line table, may be left out. Everything left out is written into one or more new documents under `ideas/` as potential follow-up work.

The mission's last task is the maintainer's own: installing the VSIX into their editor to try it, after which they may submit follow-up tasks by hand. Node commands run under Node 22 through nvm, as `(source "$HOME/.nvm/nvm.sh" && nvm use 22 && cd <directory> && <command>)`.

## Relevant starting state

### The scope, `gurita-vscode/`

The directory holds this mission's own directory and nothing else: no extension code, `package.json`, TypeScript, or Python file. No Node project stands anywhere in the repository, and `.gitignore` carries no Node entry (it lists `.scratchpad.md`, `.venv`, `temp/`, `__pycache__/`, `.pytest_cache/`, and `.env*`). Outside `ideas/vscode_extension.md` and this mission no tracked file names `gurita-vscode` or the snippet file, and the repository layout in `CLAUDE.md` has no entry for `gurita-vscode/` or `snippets/`.

### The design draft, `ideas/vscode_extension.md`

A 253-line draft, last revised on 2026-11-19 by the finished mission `ideas/mission_vs-code-extension-draft-revision/`, which settled its ten former questions under "Decided". It describes the three layers the goal names: one webview pane in the editor area with a page per live mission and a collapsed question view parsed in process from `open_questions.xml`; recipes read from the `###` blocks of `snippets/GURITA_USAGE.md` and run under one bundled stdlib-only Python runner started as a terminal's own process; and a looped task recipe whose per-task single-task line is chosen by a tracked rule file, previewed and overridable before the loop starts. Its "Questions for the work" leaves to the work the extension's directory and how its build brings in `missions.py` and the recipes, the form in which the fixed lines are carried, the rule file's name, path, and form, the six button recipes' names, the slot line's text, the snippet file's reference heading and how a repeated heading names its host, the own-recipe file's default path and its setting's name, the runner's file name, arguments, and preview print, and the session variables' names and shell. It leaves two checks unmade, what Codex's plain print opens with and whether the page is redrawn by a new `webview.html` or by a message to the visible page, and it defers publication. It assigns four things to the drift-gate workflow: the extension's build and tests, a check of the extension's fixed lines against the table, a check of its parse against `open_questions.py list --without-alternatives` and `--without-recommendation`, and a check that no snippet heading repeats.

### The snippet file, `snippets/GURITA_USAGE.md`

The file is tracked and read by no doc, test, or build step. Its first line is a bare `<mission_path>` standing above the `# Gurita CLI usage snippets` title. `## Claude Code` holds ten `###` blocks and `## Antigravity` twelve, with five prose lines between the Antigravity heading and its first block and one more between the Antigravity "Execute tasks (critical tasks)" heading and its fence; six headings repeat under both hosts (First run, Requirements iteration, Execute tasks of normal difficulty, Execute tasks (critical tasks), Execute tasks with extra requirement surface stretch, Finish mission). Every chain line ends in `;`, names its mission as `<mission_path>`, and carries `--dangerously-skip-permissions`, a `--model` (`fable` or `opus` on `claude`, `gemini-4-argon` or `claude-opus-5-5` on `agy`), and an `--effort`; the two single-task lines, under "Single tasks with Opus xHigh" and "Single tasks with Opus High", also carry `<Task Title>`. Its interactive lines are written `claude "…"` without `-p` and `agy -i "…"`, with no `# interactive` mark. None of the changes the draft lists has been made: the `<path>` placeholder, the removal of "API KEY usage" and "Wait for next quota reset", host-named headings, a reference heading for the five non-chain blocks, the six button recipes, and a looped recipe with its slot line are all absent.

### The fixed console lines

`docs/skill-reference.md` ends with `## Fixed console lines`, a three-column table (`Source`, `Kind`, `Line`) whose every Line cell is one code span. It lists 87 lines today (16 success, 25 no-op, 45 stop, 1 verdict), where the draft counted 94 on 2026-11-17, and it ships in no host tree, `docs/` being rendered into none. `tests/test_fixed_console_lines.py` reads the table through its own `section_lines` and `table_rows` helpers and checks every line against each rendered host tree. The lines a looped run can meet are `complete-task`'s `Task completed.` (success) and `No task completed — no file changed.` (no-op), `shared/complete-procedure.md`'s `No task matches the given name.`, and `shared/check-scope-gate.md`'s `Scope gate closed — the scope is held or could not be checked.` (both stop). The verdict line `Requirements converged — ready for task derivation.` is printed below a first line, never as one, and `discuss-mission-goal`, `discuss-new-task`, and `ask-in-mission-context` print no fixed line.

### The question document and its tool

`core/tools/open_questions.py` states the document format in its module docstring: a bare `<open-questions>` root, self-closing when empty, holding `<open-question id="Short Title">` blocks, each with one `<question>`, any number of `<applied-principle>` and `<depends-on question="…" option="…"/>` elements, at most one `<recommendation option="…">`, and `<alternative id="…">` elements each holding a what-it-is text followed by `<advantage>` and `<drawback>` children. Every write renders one element per line, two spaces per depth, every text folded to one line with the five predefined entities substituted, in UTF-8 with LF line ends. Its `list --without-alternatives` and `--without-recommendation` filters select the blocks carrying no `<alternative>` and no `<recommendation>`. Committed sample documents stand under `tests/fixtures/` (`annotated`, `bare`, `compact_view`, `empty`, `entities`, `sweep`, and the host fixture project's), and the only live question document in the tree is this mission's own, which is empty.

### The missions tool and the task list

`core/tools/missions.py`, one stdlib-only file for Python 3.9 and later, stands byte-identical at `hosts/claude/tools/`, `hosts/antigravity/tools/`, and `hosts/codex/plugins/gurita/tools/`, which `tests/test_missions_parity.py` asserts. Run from a project's root inside a git work tree, its `live` query prints one line per live mission in path order, three tab-separated fields: the path with its trailing slash, `started` or `defined`, and the title, and it prints nothing when no mission is live. `TASKS_TODO.md` is a `# TASKS TODO` heading followed by sections of a `## <Task Title>` heading, a 1–3 sentence brief, and a `---` line (`core/shared/task-format.md`), and a completed task's section leaves the file. `complete-task --mission <path> <task name>` takes the full or partial heading text, matched case-insensitively, checks the scope gate, removes and commits its own task, and ends on one of the fixed lines above.

### Build, tests, and CI

`.github/workflows/drift-gate.yml` is one job of five steps: the checkout, `astral-sh/setup-uv`, `uv run scripts/build_hosts.py --check`, and the two pytest runs; it sets up no Node. `scripts/build_hosts.py` reads only `core/` and `scripts/hosts/`, so a directory beside them is rendered into no host tree, and pytest collects only `tests/` (`testpaths`), with `core/tools` on its `pythonpath`. `VERSION` reads 2.0.0, the release that shipped the plugin under the `gurita:` namespace.

### Local tooling

`node`, `npm`, and `npx` are not on `PATH`; nvm under `$HOME/.nvm` holds Node 22.17.1 with npm 10.9.2, and its global packages hold no `vsce` and no extension generator. The npm registry is reachable, and on 2026-11-20 its latest `@vscode/vsce` is 4.1.1, `typescript` 7.0.2, and `@types/vscode` 1.146.0, the last ahead of the installed editor. VS Code 1.143.0 is installed at `/Applications/Visual Studio Code.app`, with its `code` CLI on `PATH` and its API definitions at `Contents/Resources/app/out/vscode-dts/vscode.d.ts`, and no installed extension carries `gurita` in its id. `python3` is 3.13.5, and `claude`, `agy`, and `codex` are on `PATH`.

### The record and what is in flight

No other mission is live, so nothing holds or shares the scope. The record holds the draft's revision, `ideas/mission_vs-code-extension-draft-revision/`, finished 2026-11-20, and the root-scoped `mission_rename-cairn-to-gurita/`, finished 2026-11-18, which renamed the plugin and its `gurita:` namespace at every identifier site. `ideas/` holds five drafts (`benchmark.md`, `gurita.md`, `kepala.md`, `short_title_characters.md`, `vscode_extension.md`), none of them a record of follow-up work for the extension. `ideas/kepala.md` draws the `Listed` state whose self-loop the draft's runner walks, and `ideas/short_title_characters.md` records that a Short Title holding `/`, `"`, `$`, a backtick, or `\` breaks the plugin's own double-quoted calls, no such title standing among this repository's 478 recorded block ids.

## Decisions

### Build and packaging

- **Bundled files.** A build step of the extension's own, run from its `vscode:prepublish` script so that every `vsce package` runs it, copies `core/tools/missions.py` and `snippets/GURITA_USAGE.md` verbatim into a git-ignored directory under `gurita-vscode/`, and the package ships them from there. Nothing copied is committed and no test compares the copies with their sources. The extension's recipe reader parses the shipped snippet file at run time, as it parses a person's own recipe file.

- **Toolchain.** The extension host code is TypeScript compiled by `tsc` to CommonJS files in an output directory, one emitted file per source file, which the VSIX ships as they are, with no bundler. The webview page is plain HTML with a script of its own, written in TypeScript and compiled by `tsc` through a second project configuration using the DOM library, loaded from the output directory through `asWebviewUri` under a content security policy, with no UI framework.

- **VS Code version.** The manifest declares `engines.vscode` as `^1.143.0`, the installed editor's version, and the extension builds against `@types/vscode` pinned exactly, with no caret or tilde, to `1.140.0`, the newest published typings not ahead of that floor: the registry holds no `1.141.0`, `1.142.0`, or `1.143.0` and goes from `1.140.0` straight to `1.144.0`.

- **Extension version.** The extension carries a version of its own, independent of `VERSION`, starting at `0.1.0` and bumped by hand whenever the extension itself changes. `scripts/set_version.py` and the release path are untouched, and the version number does not express the plugin version the bundled files come from.

- **Publisher.** The manifest's `publisher` is `uhappylogic`, the lower-case form of the name of the account that owns the source and distribution repositories, so the installed extension's id is `uhappylogic.gurita-vscode`. Nothing is registered under it: no Marketplace or Open VSX publisher is created, looked up, or reserved.

- **VSIX artifact.** The VSIX is not committed. The build runs `vsce package --out` into a dedicated output directory under the extension, listed as ignored, under a fixed file name each build overwrites, for example `gurita-vscode/dist/gurita-vscode.vsix`, and the maintainer installs it with `code --install-extension` on that one fixed path.

### Tests and guards

- **Runner tests.** The runner gets pytest tests standing beside the extension under `gurita-vscode/`, with a conftest of their own, and `pyproject.toml`'s `testpaths` gains that directory so both CI pytest runs collect them, the 3.9 floor run included. They cover the runner's decisions only (the preview print, rule matching and the default, line-kind inference, and the fixed-line verdict) and start no shell session and no stub host command.

- **Codex print check.** This mission makes no check of what a Codex line's plain print opens with. The open item the draft names under "Questions for the work" is carried into the follow-up document under `ideas/` as potential follow-up work, stated there as unchecked, and the runner reads every headless line, a Codex one in a person's own recipe file included, by the one rule it has for all hosts.

### Documents

- **Follow-up document.** Everything the first version leaves out is written into one new document, `ideas/vscode_extension_follow_up.md`, flat in `ideas/` beside the draft. Each left-out item has a section of its own, grouped by kind under a few `##` headings: guards of a long-lived extension (the drift-gate Node steps, the fixed-line, parse, and heading cross-checks, any tests left out), checks left unmade, and deferred product work such as publication.

- **Design draft.** One task revises `ideas/vscode_extension.md` the way `ideas/gurita.md` was revised after the rename: its status sentences record the first version as built by this mission, each item under "Questions for the work" is marked as answered and carries the decision that settled it (the name, path, or format chosen), the two checks the draft left unmade are marked with their result or as moved to the follow-up document, and the publication question stays open. Every other section (the rationale, what was measured, Decided, Considered and dropped, and the body's descriptions and examples) stays as written.

- **Extension documentation.** The extension is documented in one new file, `gurita-vscode/README.md`, holding everything a person who builds, installs, and uses it needs: the Node 22 build and packaging commands in the nvm form the goal states, where the VSIX lands and how to install it by hand, the shipped recipe file and a person's own recipe file, the tracked rule file, and the user setting. `README.md`, `CONTRIBUTING.md`, and `docs/` are left untouched and do not mention the extension.

### Task list

- **Maintainer install step.** The install-and-try step is carried on no task list at any time: `derive-tasks` authors no task for it, so `TASKS_TODO.md` holds only agent work and an unattended `complete-all-tasks` run ends on `All tasks completed.`. The maintainer then packages or takes the VSIX, installs it into their editor, and tries it by hand, with no workflow step and no commit recording the trial, and submits any follow-up tasks with `submit-task` while the mission is still live.

### Snippet file

- **Reference heading.** The five blocks of `snippets/GURITA_USAGE.md` that are not chains of host command lines move under one heading naming their mode of use, `## Manual use`, standing at the `##` level beside the two host headings, which the recipe reader never reads.

- **Repeated headings.** Only the six Antigravity copies of the repeated headings change, each gaining the host's full name in parentheses at its end: "First run (Antigravity)", "Requirements iteration (Antigravity)", "Execute tasks of normal difficulty (Antigravity)", "Execute tasks (critical tasks) (Antigravity)", "Execute tasks with extra requirement surface stretch (Antigravity)", and "Finish mission (Antigravity)". The six Claude Code headings keep their names unchanged.

- **Button recipe lines.** All six button recipes stand under `## Claude Code` and carry `--dangerously-skip-permissions`. The two interactive lines, `claude "/gurita:discuss-open-question --mission <path> <Short Title>"` and `claude "/gurita:discuss-mission-goal <goal>"`, run on `fable` at `xhigh`; the three answer lines (`answer-open-question`, `answer-open-question-with-alternative`, `answer-open-question-with-recommendation`) are `claude -p` on `fable` at `high`; and the `define-mission-goal --at <scope> <goal>` line is `claude -p` on `sonnet` at `medium`.

- **Slot line.** The looped recipe's slot line reads `<single-task line>`, alone on its line, lower case, with no trailing `;`.

- **Looped recipe.** The shipped file holds one looped recipe, under `## Claude Code` only, with the other execution recipes, headed `### Execute tasks one at a time`. There is no Antigravity copy, and the reading rule stays as it is: only `###` blocks under the two host headings are recipes.

- **Preparation recipe.** The shipped file gains one two-line preparation recipe under each of `## Claude Code` and `## Antigravity`, beside that host's execution blocks, named `Prepare tasks`, the Antigravity copy's heading naming its host in the form the repeated headings take. Each holds exactly the first two lines of that host's "Execute tasks of normal difficulty" block, the answer sweep and `derive-tasks` with that host's model and effort (`fable` at `high` and `xhigh` on `claude`, `gemini-4-argon` at `medium` on `agy`), with `<path>` as the placeholder and no `complete-all-tasks` line.

- **Single-task lines shipped.** The shipped file keeps its two single-task lines and gains one: `complete-task` on Claude Code under `opus` at `high`, the combination the Claude Code "Execute tasks of normal difficulty" and "extra requirement surface stretch" blocks already run `complete-all-tasks` with, so the shipped single-task lines are exactly the combinations the file's execution blocks complete tasks under.

- **First line.** The bare placeholder line above the `#` title is deleted, so the file opens on its title, followed by the existing sentence defining the placeholder, renamed to `<path>`. No marker line replaces it anywhere.

### Recipes

- **Single-task line recognition.** A recipe counts as a single-task line by content alone, with nothing declared: it holds exactly one line, that line is headless (it holds a `gurita:` invocation and carries no `# interactive` mark), and it holds the `<Task Title>` placeholder. The heading is free and carries no kind. The same test applies to the shipped file and to a person's own recipe file, and the extension applies it when it gathers the named lines it lists in the preview's override list and hands to the runner.

- **Unfillable placeholders.** A recipe holding a known placeholder the page has no value for there (`<Task Title>`, `<Short Title>`, `<Alternative Id>`, `<goal>`, `<scope>`, `<answer text>`) is left off the page's recipe list silently and stays reachable by name for the button or loop that fills it. A recipe holding a placeholder name the extension does not know is shown on the page as a non-runnable entry naming the unknown placeholder and the file it came from.

- **Own recipe placement.** Every own recipe that replaces no shipped recipe is listed on each mission's page in one group of its own, under a fixed heading of the extension's such as "Your recipes", below the Claude Code and Antigravity groups. Within it the recipes keep the order the person's file lists them in, and the extension reads nothing of a recipe's lines to place it.

- **Own recipe file path.** The default path of a person's own recipe file is `~/.gurita/recipes.md`, a fixed path in a dot directory named for the plugin under the person's home directory, spelled the same on every operating system, read by expanding the home directory and honouring no environment variable.

- **Own recipe setting.** The VS Code user setting that changes the path of a person's own recipe file is `gurita.ownRecipesFile`, sitting flat directly under the `gurita` section, the plugin's name and not the extension's slug.

### Rule file

- **Location.** The rule file stands at one fixed path directly in the project root, named `task_line_rules` in the snake_case form of the root-level principle store `answer_decision_principles.md`, its file extension the one the rule file's format takes, with no `gurita` prefix, no directory of its own, and no setting that moves it.

- **Format.** The rule file is plain UTF-8 text in a format of the runner's own, one rule per line: the pattern, then ` -> `, then the single-task line's name exactly as its recipe's `###` heading reads, the line split at its last ` -> ` so a pattern may hold the arrow. Blank lines and lines opening with `#` are skipped. The default is the one line whose pattern is a bare `*`, which is never a valid `re` pattern, so it cannot collide with a rule, and more than one `*` line is refused. Each pattern is applied with `re.search` and `re.IGNORECASE` to the task's title and brief joined by a newline, and when several rules match, the first in file order wins.

- **Missing file.** A missing rule file is read as a file holding no rule and no default, so every remaining task's assignment is unresolved. The preview lists every task as unresolved, saying that the project holds no rule file and naming the path the runner looked for, and the person overrides each task there by hand, one at a time, as for any other unresolved task. The loop starts either way: a task with an override runs under it, and the first task without one, a task that entered the list after the loop started included, stops the loop before anything runs for that task.

### Runner

- **Command line.** The runner file is `runner.py`, and its three uses are argparse subcommands: `runner.py chain -- LINE...`, `runner.py loop --mission PATH --rules FILE --line NAME LINE... [--override TITLE NAME]... -- LINE...`, and `runner.py preview --mission PATH --rules FILE --line NAME LINE...`. Each chain or recipe line is one argument after `--`, so a line opening with `-` is never read as an option, and the looped recipe's lines are passed as written with the slot line last. Every named single-task line is one `--line` with two values, its name and its raw text, and every override one `--override` with two values, the task title and the line name. The values a chain's lines reference reach the runner in the environment the extension gives its terminal, so the command line carries none, and in a loop the runner itself fills `<path>` and `<Task Title>` from `--mission` and the re-read heading.

- **Preview print.** Each preview line is three tab-separated fields in the layout of `missions.py live`: a state word (`resolved` when the named line is among the single-task lines the runner was given, `missing` when it is not), then the line name the rules give the task (the missing name in a `missing` line), then the task's `##` title last. The runner alone decides resolved or missing, and the print carries nothing else.

- **Session variables.** Each variable is named by one fixed rule applied to its placeholder: the prefix `GURITA_`, then the placeholder's text upper-cased with every space turned into an underscore, giving `GURITA_PATH`, `GURITA_SHORT_TITLE`, `GURITA_ALTERNATIVE_ID`, `GURITA_GOAL`, `GURITA_SCOPE`, `GURITA_ANSWER_TEXT`, and `GURITA_TASK_TITLE`. The names are a stated, stable part of the extension, so a shell step in a person's own recipe may read them, for example to log the task title of a looped run.

- **One session.** Before it starts, the runner composes one shell script from the whole chain (one per task's session in a looped run) and runs it as a single shell process that keeps the terminal as its own input and output. Shell steps and interactive lines stand in the script as written, so an interactive line inherits the terminal as any command in a shell does. Each headless line is wrapped so its output goes through `tee` both to the terminal and to a run-local file, and is followed by a check step, the runner itself started in a check mode, that reads the first line of that file's final message and makes the shell exit when the line stops the chain. The runner process waits for the shell and reads the check's verdict to report how the run ended.

### Pane

- **Redraw.** The extension sets `webview.html` once, to a page shell whose script draws the question view. After a run it posts the fresh parse to the visible page, which redraws the rows in place and keeps open those already open. The page saves its set of open Short Titles with `setState` on every toggle and reads it back with `getState` when it is re-created. `retainContextWhenHidden` stays off: a hidden pane loses its page, and on every load the page's script posts a ready message and the extension answers with the current parse, so a run that ended while the pane was hidden reaches the page when it is shown again.

## Out of Scope

