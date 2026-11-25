## Purpose

This repository is `gurita`, a plugin for Claude Code, Antigravity, and Codex that brings a mission's important questions up to be decided before work starts, so that execution can then be handed to agents. It ships as a set of skills, two dispatched agents, shared procedures, and stdlib-only Python tools, authored once, host-neutrally, under `core/` and rendered by one generic build into one tree per host under `hosts/`, beside a VS Code extension in `gurita-vscode/`. The skills form a linear pipeline that moves a project from a vague idea through discussion, planning, completion, and archival, mission by mission; `docs/workflow.md` narrates the phases and `docs/skill-reference.md` describes each skill. The repository runs its own missions with the plugin: a root-scoped one stands at `mission_<slug>/`, another in the folder holding its work's core, and the principle store `answer_decision_principles.md` stands at the root whatever scope a mission uses. Outside contributions are proposal-first, as `CONTRIBUTING.md` states.

This file is the root node of the repository's knowledge tree: it holds only what binds everywhere and one pointer per top-level folder, and each folder's own knowledge lives in that folder's node. `AGENTS.md` is a tracked symlink to this file, through which Antigravity and Codex read the same text, and it is never edited directly. `VERSION` holds the bare `MAJOR.MINOR.PATCH` that is the single source of truth for the plugin's version, written only by `scripts/set_version.py` and read by the build. `.python-version` pins the interpreter of the pinned test run, while Python 3.9 is the floor the tools promise. Every other root file that can carry prose describes itself in its own header; the policy, licence, and lock files carry nothing for this tree.

## Rules

- **An area's lasting knowledge goes to the node of the folder holding it.** A folder's node is its `README.md`, or, where that name is taken or rendered (`core/`, `hosts/`, `gurita-vscode/`, `.github/`), its `### <folder>/` description under this file's `## Pointers`; for a file under `core/` it is the node of its subfolder, `core/tools/`, `core/shared/`, `core/skills/`, or `core/agents/`. A rule an edit in that folder must keep, its reason, and the forms that must not return are written into that node in the same change that makes them true, a root file states its own in its header, and only what binds everywhere stands in this file. A rule is written so that it binds exactly as it did when placed; it leaves the tree only when its subject no longer exists or the history it guards is closed. Reason: a rule is found where someone working on what it governs looks, while one root file holding every rule's rationale was read whole by every session and grew back to 172 KB after being compressed once. Retired forms: the rule that all rationale lives in this file; an invariants section here; a rule changed in passing while it is moved or compressed.
- **Before working in a folder, read the nodes on the way down to it.** Read this file, then the node of each folder from the top-level one down to the one you work in that has a node, following the pointer lines from one node to the next, then every rule a pointer beneath a rule you are about to touch leads to. A node points at what documents itself (a module docstring, a tool's `--help`, a definition's `settings.toml` header, a skill's own text, a test's docstring) rather than restating it, so follow those for mechanics. Reason: each node holds only its own folder's rules, so a rule placed elsewhere is reached only through its pointer. Retired forms: reading this file alone as the whole of the project's rules.
- **A rule governing files in more than one folder is stated once, whole, where it chiefly governs.** Its rule, reason, and retired forms stand in the node of the folder holding what it chiefly governs, judged once, when the rule is placed; the node of every other folder it touches carries a pointer line to it with a when-to-follow note, and no second node restates it. Reason: two statements of one rule drift apart with no check failing. Retired forms: a rule restated in a second node; a cross-reference by name ("see the committing invariant").
- **Every node has one fixed, ordered set of parts.** A node, and every description here of a folder whose `README.md` name is taken or rendered, holds only Purpose, Rules, Commands, and Pointers, in that order (`##` headings in a node, `####` under a description), Purpose required and each other part present only when the node holds something for it. This file holds exactly `## Purpose`, `## Rules`, `## Commands`, `## Pointers`, and `## Mission Workflow`, in that order, the last where the bootstrap appends it. There is no per-file part: a file is known from listing its folder and from its own docstring, `--help`, or header, and what a node says of one file is said inside a rule or the purpose. Each rule opens with its bold statement, followed by its `Reason:` and its `Retired forms:`. Reason: one shape lets a reader find a part at once and lets a check verify it. Retired forms: a per-file section; a heading outside the set; a layout block restating each file.
- **A pointer is a line of one fixed form.** It reads ``- → `path#anchor` — note``: a backticked repo-relative path, an optional GitHub-style heading-slug anchor, and a when-to-follow note of two or three short sentences. Pointers stand only on such lines, a node's pointers to what lies below it as a list in its Pointers part and a cross-reference from one rule to another as such a line beneath the rule; any other mention of a file, backticked or as a Markdown link, is prose nothing resolves. Reason: a fixed form is what a check resolves without guessing. Retired forms: a pointer written as free prose.
- **Every top-level folder is covered, and the tree stays within its budgets.** Every tracked top-level folder, the root `mission_*/` directories left out, is covered by a `README.md` node of its own or by a description here. No deeper folder needs a node, but a deeper `README.md` node is pointed at from its parent folder's node or, where the parent has none, from the nearest ancestor node; a host template `scripts/hosts/<host>/README.md` is a source the build renders into `hosts/<host>/`, not a node. This file stays within 20,000 bytes, every `README.md` node within 12,000, and every when-to-follow note within 400, a note counted inside the file holding it; a budget failure is repaired by compressing, never by moving a rule out of the tree. No `.github/README.md` is tracked. Reason: a folder with no node leaves its knowledge nowhere to go, an orphaned node is never read, a node read on every session must stay small, and GitHub shows a README in `.github/` as the repository's front page ahead of the root one. Retired forms: the 172 KB root file; a node nothing points at.
- **The plugin answers to its current names only, and no migration is shipped.** A mission is named by one flag, `--mission <path>`, found by one discovery pattern, `**/mission_*/requirements.md`, defined once in the missions tool, and recorded finished by one marker, `Mission-finish: <path>`: no skill accepts a second spelling of the flag as an alias, no query reads a second pattern, and no reader takes another subject for a finish. The record of finished missions starts at the first `Mission-finish:` commit; the finish commits made before it stand in the log, read and rewritten by none, and a task commit made before it is still listed by `tasks` under the placeholder its unmatched task list gives it. No skill, tool, or option converts an existing project's directories, commits, or files into the current form, and a project upgrading finishes its live work with the copy of the plugin that work was started under. The one exception is the bootstrap: `init-mission-base-workflow` replaces whole an older workflow section an earlier copy wrote into the context file with the `## Mission Workflow` section, carrying an existing principle store to the root in the same pass and commit. Reason: adoption is low, so the projects an alias, a second pattern, or a migration would serve are few, while each would be one more form every reader handles and every test pins on every run for good, so the cut is made once and hard; the older section is the one thing an earlier copy leaves that every later session reads as guidance, and left standing it would point at forms the plugin no longer answers to. Retired forms: an alias, a second pattern, a fallback read, a migration step.
- **A mission's directory holds exactly three files, and its finished work lives in commits.** `requirements.md` is prose only: Goal, Relevant starting state, Decisions, and Out of Scope, plus `## Noted contradictions` between Decisions and Out of Scope only while a note stands, created by no tool (a single-question answer skill inserts its heading with the first note and the review pass deletes it with the last), so the definition tool's template, headed `# <title>`, keeps the four. `open_questions.xml` is created empty with the mission and then written only by the open-question tool, empty meaning converged; `TASKS_TODO.md` (`##` headings and `---` separators) is created with it and then written only by the task-list tool. A completed task's whole record is its `Task-completion:` commit (the title in the subject, the brief as the removed lines, the verified bar as the body) and a finished mission's its `Mission-finish: <path>` commit (the summary as the body, the files at its parent), both read back through the missions tool; no file says which missions exist or which is current. Reason: one writer per file and history for what is done leave nothing in the tree to drift from the log. Retired forms: `TASKS_DONE.md`, a file naming the current mission, a numbered mission directory.
- → `core/tools/README.md#rules` — Each mission file's one writer, the pre-split and pre-flip missions' history, and the missions tool's queries. Read it before changing how a mission file is written or read back.

## Commands

- `uv run scripts/build_hosts.py` — rebuild `hosts/` from `core/` after any change under `core/` or `scripts/hosts/`, committing the rebuilt trees with that change.
- `uv run scripts/build_hosts.py --check` — the drift gate: fails if a committed host tree differs from a fresh build.
- `uv run pytest` — the tool suite and the extension runner's tests under the pinned interpreter.
- `uv run --no-project --python 3.9 --with pytest pytest` — the same suite at the 3.9 floor; run both before committing a tool change.
- `uv run pytest host_tests --host <host>` — the on-demand host suite against one host's installed plugin copy, `<host>` exactly one of `claude`, `antigravity`, or `codex`.

## Pointers

- → `.claude-plugin/README.md` — The maintainer's directory marketplace pointing at the built Claude Code tree. Read it before changing how a checkout installs its own plugin.
- → `.claude/README.md` — This repository's project settings and the two maintainer-only release skills. Read it before any release or a change to a release skill.
- → `assets/README.md` — The hand-drawn banner and icon drawings and their derived outputs. Read it before editing a drawing.
- → `docs/README.md` — The four user pages and the rule that they carry user content only. Read it before editing a page or when a change alters what a user runs.
- → `host_tests/README.md` — The on-demand host suite driving one host's installed CLI. Read it before a change touching a host's trigger set.
- → `ideas/README.md` — The design drafts that precede any mission. Read it before adding, revising, or removing a draft.
- → `scripts/README.md` — The host build, the host definitions and their slots, the version and render scripts. Read it before changing a definition, a slot value, the build, or the version.
- → `snippets/README.md` — The hand-use document of headless chains. Read it when a skill's invocation changes.
- → `tests/README.md` — The pytest suite of the tools and the fixed shell calls. Read it before adding or changing a test.

### core/

#### Purpose

The host-neutral runtime layer, rendered into every host tree: `skills/<name>/SKILL.md`, one skill per directory; `agents/*.md`, the two dispatched subagents (`complete-task`, `provide-alternatives-to-open-question`); `shared/*.md`, the shared procedures, each the single source of truth for one unit of work two or more runners reference; and `tools/*.py`, the six stdlib-only Python 3.9+ tools. Files here refer to one another through `{{PLUGIN_ROOT}}`, never a host's own syntax. The `README.md` name is rendered here, so each subfolder's node is kept out of every host tree by every host definition's `exclude` key.

#### Rules

- **No file stands at the top level of `core/`.** The build stops with exit 2 on one, and renders every file under the four directories into every host tree. Reason: everything here is runtime the build copies, so a folder-level document has no place that stays out of the host trees. Retired forms: a `core/README.md`.

#### Pointers

- → `core/tools/README.md` — The six tools, each its document's one writer or the one tool running git. Read it before changing a tool, its contract, or a call a runner makes to it.
- → `core/shared/README.md` — Mission resolution, the scope gate, the starting state, the analytical core, reconciliation, and task altitude. Read it before changing a shared procedure.
- → `core/skills/README.md` — The skills' rules: committing, literal shell calls, fixed console lines, the answer paths, and each skill's own limits. Read it before changing a skill.
- → `core/agents/README.md` — The two dispatched agents' prompts and return contracts. Read it before changing an agent or the skill dispatching it.

### hosts/

#### Purpose

Committed build output: one tree per host (`hosts/claude/`, `hosts/antigravity/`, and `hosts/codex/`, whose plugin stands under `plugins/gurita/`), rendered by `scripts/build_hosts.py` from `core/` and the host's definition under `scripts/hosts/<host>/`, and published verbatim into `uHappyLogic/gurita-<host>` at release. Each tree's `README.md` is rendered from its host template, so the knowledge about a tree lives in the nodes of its sources.

#### Pointers

- → `scripts/README.md#rules` — Why these trees are never hand-edited and are rebuilt and committed with every change to their sources. Read it before touching anything here.

### gurita-vscode/

#### Purpose

The VS Code extension: a TypeScript Node project compiled by `tsc` with no bundler and packaged as a VSIX, independent of the host build and of `VERSION`, with a version of its own in `package.json`, published as `BusyMinds.gurita-vscode` on the Visual Studio Marketplace and Open VSX, its release notes in its `CHANGELOG.md`. `shipped_recipes.md` is the recipe file it ships, each chain once rather than once per harness, copied into `bundled/` by `scripts/bundle.js` beside the fixed console lines; `runner.py`, the chain, loop, and preview runner, reads the root's `task_line_rules.txt` and is tested by `runner_tests/`, which both pytest runs collect. Build outputs (`out/`, `bundled/`, `dist/`, `node_modules/`) are git-ignored. The `README.md` name is taken: that file is the listing README the VSIX carries, a short showcase linking `USAGE.md`, the installed extension's full reference, and `BUILDING.md`, the build from the checkout, both kept out of the VSIX by `.vscodeignore`, which would package any other file at the folder's root.

#### Rules

- **Node runs only through nvm, Node 22.** Every `npm` command runs inside `(source "$HOME/.nvm/nvm.sh" && nvm use 22 && cd gurita-vscode && …)`. Reason: `node` and `npm` are off `PATH` here, and Node 22 is what CI builds and tests the extension on. Retired forms: a bare `npm` call.
- **`media/demo.gif` is a capture, not derived output.** `scripts/capture_demo.js` makes it, and it is not reproducible byte for byte, so nothing compares it with its maker's output, unlike the two icons. Reason: a capture records a live session. Retired forms: none recorded.

#### Commands

- `(source "$HOME/.nvm/nvm.sh" && nvm use 22 && cd gurita-vscode && npm ci && npm test)` — install the build dependencies and run the `node:test` unit tests.
- `(source "$HOME/.nvm/nvm.sh" && nvm use 22 && cd gurita-vscode && npm run package)` — build the VSIX into `gurita-vscode/dist/gurita-vscode.vsix`.

#### Pointers

- → `gurita-vscode/BUILDING.md` — The build from the checkout and the files it reads from outside the extension. Read it before changing the build or the bundle.
- → `gurita-vscode/USAGE.md` — The installed extension's full reference: its views, recipes, the looped task run and rule file, and the runner. Read it before changing what the extension does.
- → `.claude/README.md#rules` — The extension is released apart from the plugin, only by `/release-vscode-extension` under `gurita-vscode-<VERSION>` tags. Read it before any extension release.
- → `scripts/README.md#rules` — The extension's two icons as derived output of `render_icon.py`. Read it before changing an icon.

### .github/

#### Purpose

GitHub's own files: `workflows/` holds CI (`drift-gate.yml`), the extension's publish workflow (`publish-vscode-extension.yml`), and the daily traffic-badge workflow (`traffic-badges.yml`); `ISSUE_TEMPLATE/` the issue forms, the mission proposal among them; and `PULL_REQUEST_TEMPLATE.md` a contributor pull request's finished-mission checklist. The `README.md` name is taken, since GitHub would show one here as the repository's front page.

#### Rules

- **CI is one job that publishes nothing.** `drift-gate.yml` runs `--check`, both pytest runs, then Node 22 with `npm ci`, `npm test`, and `npm run package` in `gurita-vscode/`, the VSIX discarded. Every action in every workflow is pinned to a commit SHA, bumped by hand. Reason: a pull request must pass exactly what a maintainer runs, and a pinned SHA cannot move under the workflow. Retired forms: an action referenced by a tag.
- **The extension is published only by a pushed `gurita-vscode-*` tag.** `publish-vscode-extension.yml` runs in the `extension-release` environment: it builds and tests from the tagged commit, then runs `vsce publish --oidc` (Marketplace trusted publishing, no token) and `ovsx publish` (the environment's `OVSX_PAT` secret), both `--skip-duplicate`. Reason: the release skill publishes nothing itself, so the tag is the one trigger, and `--skip-duplicate` lets a re-run finish a partial publish. Retired forms: none recorded.

#### Pointers

- → `scripts/README.md#rules` — CI's no-path-filter, one-job rule and the traffic workflow's copies under each host definition, kept in sync by hand. Read it before changing a workflow.
- → `.claude/README.md#rules` — How the two releases stay apart and what the extension's tag starts. Read it before changing the publish workflow.

## Mission Workflow

This project uses the mission-driven workflow. Each mission lives at
`<scope>/mission_<slug>/`, directly in the directory holding the core of its work, with
`requirements.md`, `open_questions.xml`, and `TASKS_TODO.md`. No mission is current: every
skill working inside one is given its path as `--mission <path>`, exactly as
`/define-mission-goal` printed it, trailing slash included.
A mission directory is removed only by `/finish-mission`, whose `Mission-finish: <path>`
commit carries the mission's record, so the directories standing are the live missions and
the git log holds the finished ones.
