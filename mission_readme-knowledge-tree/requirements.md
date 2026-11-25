# README knowledge tree

## Goal

Replace this repository's 172 KB root `CLAUDE.md` with a small root node, `AGENTS.md` staying its symlink. The root holds what the repo is, the rules that bind everywhere, one pointer per top-level folder with a when-to-follow note, the project's rules on where knowledge lives and how nodes are read, and the bootstrap's `## Mission Workflow` section. Below it stands a tree of `README.md` nodes wherever that name is free, the parent node describing a folder where it is taken or rendered (`core/`, `hosts/`, `gurita-vscode/`).

The rule that all rationale lives in `CLAUDE.md` is retired. Every invariant is re-evaluated, compressed to the rule, its reason, and the retired forms that must not return, and placed where it belongs and where someone working there will find it; `docs/` is re-evaluated and streamlined in the same pass.

A check pinned in `uv run pytest` (every pointer resolves, every covered folder has a node, root, nodes and notes each stay within a byte budget) and a maintainer-only update skill keep the tree honest.

## Relevant starting state

### The root context file

`CLAUDE.md` at the repository root is 171,838 bytes in 155 lines, and `AGENTS.md` is a tracked symlink to it; no other `CLAUDE.md` or `AGENTS.md` stands in the tree. It holds eight `##` sections: What this repo is (849 bytes), Commands (1,833), Repository layout (14,023, one fenced block of 35 entries, the `tests/` entry alone 3,343), Skills and the workflow they encode (3,195), Mission file structure (2,256), Invariants to preserve when editing skills (145,667), Development (3,275, five bullets), and Mission Workflow (623). The file was compressed once before: the hand commit `05815f18` of 2026-09-23, `Claude.md optimized`, cut it from 164,857 to 22,329 bytes, keeping the same eight sections with 23 invariant bullets and changing no other file, and it has grown back since, to 144,900 bytes by 2026-11-10 and to its present size on 2026-11-25. Of the 157 commits that changed it, 105 are task commits (69 `Task-completion:`, 36 of the retired `Tasklist-completion:`) and 13 are finish commits. Nothing compares the file with the tree: its `ideas/` entry names the benchmark draft only, while `ideas/` holds `benchmark.md` and `kepala.md`.

### Readers and writers of the context file

By each host's `scripts/hosts/<host>/settings.toml`, Claude Code loads the workspace root `CLAUDE.md` as project instructions, Antigravity loads the root `AGENTS.md` as workspace rules and not `CLAUDE.md`, and Codex reads its project instructions from `AGENTS.md`; none of the three records a size limit on that file or a host loading a document below the root. The plugin's own runners read the same file through the `CONTEXT_FILE` slot, as the one named source of a project's environment context: the starting-state procedure, `derive-tasks`, the completion procedure (so every dispatched completion agent), `discuss-mission-goal`, `discuss-new-task`, and `ask-in-mission-context`. Two skills write it: `finish-mission`'s step 5 updates "the relevant section" for lasting environment-context changes, in the finish commit, and the bootstrap writes only the `## Mission Workflow` section, exactly as `core/shared/workflow-guidance.md` states it, leaving alone a file that already holds that heading. The VS Code extension's bootstrap offer (`gurita-vscode/src/bootstrapOffer.ts`) stands while neither the root `CLAUDE.md` nor the root `AGENTS.md` holds a `## Mission Workflow` heading. Outside the runtime, `CONTRIBUTING.md` links `CLAUDE.md#invariants-to-preserve-when-editing-skills` as where the design invariants live, `.github/PULL_REQUEST_TEMPLATE.md` carries the checkbox "`CLAUDE.md` is touched only for lasting changes", and `.claude/skills/release-plugin/SKILL.md` states that no release prose lives in `CLAUDE.md` or `README.md`.

### The invariants section

The section holds 35 bullets of 235 to 20,418 bytes, each a single paragraph; the twelve over 4,000 bytes hold 103,319 of its 145,667 bytes, the largest being the missions tool (20,418), committing (14,057), shell commands (12,102), the task-list tool (10,182), and the dispatched-agent return contracts (10,129). A bullet states its rule together with the mechanics of the tool or call it governs, field measurements and dates, the history of the forms it replaced, and the forms that must not return, fifteen phrases such as "must not be restored" standing in the section. Its intro says the mechanics live in the runtime files, the tools and their tests, and `docs/`, and that "only the rationale lives here"; the bullet "Runtime files carry no editor-facing prose and name no host" repeats it ("Rationale lives here"), bans `## Rules` sections, and extends the same rules to the tool sources, so the rules as they stand keep rationale out of every file under `core/`. The bullets refer to one another by name eighteen times ("see the committing invariant"), and their subjects are the six tools under `core/tools/`, the shared procedures, skills, and agents under `core/`, the slot system under `scripts/hosts/`, and the fixed-line table of `docs/skill-reference.md`.

### Where the `README.md` name is taken or rendered

Eight `README.md` files are tracked outside the mission directories. The root one (14,861 bytes) is the public landing page. `gurita-vscode/README.md` is the listing README the VSIX carries; `.vscodeignore` keeps `src/**`, `scripts/**`, `runner_tests/**`, `mission_*/**`, `BUILDING.md`, and `USAGE.md` out of the package but not `media/` as a whole, so any other file at the extension's root or under `media/` is packaged. `scripts/hosts/<host>/README.md` is each host's README template: the build renders every file of a definition directory other than `settings.toml` and those under `slots/` to the same relative path, so `hosts/<host>/README.md` is build output, published verbatim to the host's distribution repository; the build discovers definitions as directories and writes and compares only the `hosts/<host>/` trees, so it reads no file standing directly in `scripts/hosts/` or `hosts/`. In `core/` no file stands outside the runtime: the build stops with exit 2 on any file at the top level of `core/`, and renders every file under its four directories into every host tree, each scanned by the `host-name-in-core` check. In every other folder the name is free in the tree; GitHub's documentation says a README in `.github/` is shown as the repository's front page ahead of the root one, which has not been checked against this repository.

### Folders and the documents they already hold

Thirteen top-level folders are tracked beside the live mission directories: `.claude-plugin/` (1 file), `.claude/` (3), `.github/` (9), `assets/` (4), `core/` (41), `docs/` (4), `gurita-vscode/` (124), `host_tests/` (4), `hosts/` (143), `ideas/` (2), `scripts/` (48), `snippets/` (1), and `tests/` (86); `temp/` is git-ignored. Below them stand `core/{agents,shared,skills,tools}/`, `scripts/hosts/<host>/`, `tests/fixtures/`, `gurita-vscode/{media,runner_tests,scripts,src}/`, `.github/{ISSUE_TEMPLATE,workflows}/`, and `.claude/skills/`. Several areas already document themselves in a file the layout block points at rather than restates: each tool's `--help` and module docstring, the docstring of `scripts/build_hosts.py` (its inputs and its whole check set), the dated hands-on block heading each host's `settings.toml`, `CONTRIBUTING.md`'s `## Development`, `gurita-vscode/BUILDING.md` (7,385 bytes) and `gurita-vscode/USAGE.md` (99,771), and the two release skills.

### `docs/`

`docs/` holds four pages, 188,503 bytes together. `skill-reference.md` (100,430) carries 22 entries, one per skill or dispatched agent, of 797 to 9,990 bytes each and 89,724 together, and the `## Fixed console lines` table of 87 rows; `workflow.md` (51,726) the six phases, `## How skills commit` (8,454), and the answer-principle-learning loop (4,051); `ways-of-using.md` (20,437) the headless chains; and `design-claims.md` (15,910) nineteen claims in Simplified Technical English. Two readers parse the table: `tests/test_fixed_console_lines.py`, which checks every row against every rendered host tree, and `gurita-vscode/scripts/bundle.js`, which writes its rows into the extension's `bundled/fixed_lines.tsv` at build time. The pages are linked from the root `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `gurita-vscode/BUILDING.md`, and the extension's release skill, and link one another fifteen times; no host README template links them. `CLAUDE.md` names `docs/` as one home of the mechanics its invariants leave out, and `docs/skill-reference.md` as the home of what the skill-frontmatter invariant cuts from a description.

### Checks and maintainer skills

`uv run pytest` collects `tests/` and `gurita-vscode/runner_tests/` (the `testpaths` of `pyproject.toml`), and CI's one job runs `build_hosts.py --check`, that run, the 3.9 floor run, and the extension's `npm` steps. `tests/test_fixed_console_lines.py` is the standing example of a check that only reads tracked files and so runs under both interpreters, and the banner and icon tests read tracked files as well. No test and no build check reads this repository's `CLAUDE.md`, resolves a link or pointer between documents, checks that a folder holds a document, or measures a document's size. The maintainer-only skills live under `.claude/skills/`, outside `core/`, so no host renders them: `release-plugin/SKILL.md` (50,348 bytes) and `release-vscode-extension/SKILL.md` (25,047), each opening with `name` and `description` frontmatter, and neither maintains documentation.

### The record and what is in flight

The scope's overview lists ten finished missions, the oldest finished on 2026-11-18, and two live ones beside this mission. Two of the finished bear here. `mission_mechanical-issues/` (finished 2026-11-25) closed the entries of a mechanical-issues draft and, in its last tasks, recorded each entry's outcome in `CLAUDE.md`'s invariants, as a fix or an acceptance with its reason, the file's latest growth; `mission_rename-cairn-to-gurita/` (2026-11-18) carried the new name through the root README, the host templates, the contributor files, and the docs pages, and moved two files to `docs/ways-of-using.md` and `ideas/benchmark.md`. The milestones the invariants cite by number precede the first path-form `Mission-finish:` commit and are listed by no query. Both other live missions overlap this scope and are `defined`, neither started. The goal of `mission_project-defined-knowledge-placement/`, at the root, is to make the plugin agnostic about where a project keeps its lasting knowledge: `finish-mission` recording lasting changes wherever the project's own context file says they belong, and the context-reading runners reading the context file and then whatever it directs them to for the area they work in, the plugin prescribing no structure of its own. The goal of `gurita-vscode/mission_claude-desktop-harness/` is to add Claude Desktop to the VS Code extension as a fourth harness, for actions that are a single interactive line.

## Decisions

### Fixed-lines table location

The fixed console lines table stops being a Markdown table in `docs/skill-reference.md` and becomes a tracked data file of `source`, `kind`, and `line` fields, one row per line, for example a tab-separated file beside the test or at a stated path. `tests/test_fixed_console_lines.py` reads that file in place of the table, and `gurita-vscode/scripts/bundle.js` writes `bundled/fixed_lines.tsv` from it by selecting columns, with no Markdown parsing. The preamble's prose moves to whatever node or page describes the convention, which points at the file. The extension release skill's diff path and the path `gurita-vscode/BUILDING.md` names follow the file, and `runner.py` keeps reading the same `kind<TAB>line` bundle, so it stays unchanged.

### Rules spanning folders

A rule governing files in more than one folder is stated once and whole (its rule, its reason, and its retired forms) in the node of the folder holding what it chiefly governs, and the node of every other folder it touches carries a pointer to it with a when-to-follow note. This holds for every spanning rule and is itself written, as one project-wide rule, into the root's rules on where knowledge lives: the slot rule stands in the node covering `core/` or `scripts/hosts/`, the fixed console lines in the one covering the skills or the table, and each tool's rule where the tool is described, with a pointer from `tests/`. No spanning rule is restated in a second node, and the chief folder is judged once per rule, when the rule is placed.

### Placement decision timing

Before tasks are derived, the recorded decisions settle the home only of each item the recorded placement rules leave open or ambiguous, for example a rule governing files in several folders, a rule about `core/`, or a section with no obvious single folder. A review pass names those items once it has read the placement rules against the 35 invariants and the other sections of today's `CLAUDE.md`. Every other item's home is left to the runner completing its task, who places it under the recorded rules, so no full map from item to destination is recorded.

### Node structure

Every node, and every description a parent node gives of a folder whose `README.md` name is taken or rendered, has one fixed, ordered set of parts: purpose, rules (each the rule, its reason, and its retired forms), commands, and pointers to the nodes below. Purpose is required, and each other part is present only when the node holds something for it. There is no per-file part: a file is known from listing its folder and from its own docstring, `--help`, or header, and what a node says of a particular file is said inside a rule or the purpose. The mission's pytest check verifies that a node holds only the allowed headings, in their order.

### Pointer form

A pointer is a line of one fixed form of the project's own, for example ``- → `docs/workflow.md#heading` — when-to-follow note``: a backticked repo-relative path with an optional heading-slug anchor, followed by its when-to-follow note. Pointers stand only on such lines, a node's pointers to what lies below it as a list of them and a cross-reference from one rule to another as such a line beneath the rule. Every other mention of a file, in backticks or as a Markdown link, is ordinary prose the check does not resolve.

### Covered folder rule

Every tracked top-level folder, the root `mission_*/` directories left out, must be covered: by a `README.md` node of its own or, where that name is taken or rendered, by a description in the root. Below the top level no folder is required to have a node. Any `README.md` node that does stand deeper in the tree must be pointed at from its parent folder's node, or from the nearest ancestor node where the parent has none, so a deeper node exists only by choice and is never orphaned.

### Root-level file entries

Each file at the repository root that can carry prose describes itself in its own header. The root `CLAUDE.md` carries a short entry, inside its byte budget, only for the root files that cannot carry a header and still bind work, chiefly `VERSION` and `.python-version`, with `AGENTS.md` as the symlink to the root itself. Policy, licence, and lock files get no entry.

### GitHub folder node

`.github/` is treated as a folder whose `README.md` name is taken, on GitHub's documentation and with no check made against this repository, and is described by the root `CLAUDE.md` as `core/`, `hosts/`, and `gurita-vscode/` are. The mission's pytest check additionally fails when a tracked `.github/README.md` exists, its message naming GitHub's front-page precedence as the reason.

### Role of docs pages

`docs/` serves the plugin's users alone, and each page is rewritten to user content. The maintainer-facing material is cut outright rather than moved to the nodes: where a mechanic is already stated by a runtime file, a tool's `--help` or docstring, a test, or the build's docstring, the page drops it and nothing restates it, a node pointing at those sources instead. The fixed console lines table follows its own decision.

### Placement mission dependency

The tree holds with the plugin as it stands, and its correctness does not depend on `mission_project-defined-knowledge-placement/`: a runner reaches a node only by following the root's own instructions, and a later mission's lasting changes reach a node only through its tasks or the update skill. In addition, the root's rules on where knowledge lives and how nodes are read are written as plain directions a runner could follow: which node a given area's lasting knowledge goes to, and which node to read before working in a folder. Once a plugin that follows such directions lands, `finish-mission` and the context-reading runners use them with no further change to the tree; until then those runners do nothing with them. Neither mission waits on the other.

## Out of Scope

