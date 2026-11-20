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

## Out of Scope

