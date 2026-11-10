# Rename milestone to mission

## Goal

Rename the unit of work from milestone to mission throughout the plugin, as ideas/gurita.md describes: a mission stands at <scope>/mission_<slug>/ with no milestones/ container, and every identifier carrying the word and all prose follow. This is a hard cut with no migration: the old flag, discovery pattern, and commit markers are neither accepted nor read, the record starts at the first Mission-finish: commit, and /migrate-milestones is removed. The plugin keeps the name Cairn for now, and the work ends with main consistent under the new word and nothing released.

## Relevant starting state

### The design draft

`ideas/gurita.md`, revised 2026-11-10, is the description the goal points at. Its "How the mission lands" table lists the identifier sites (the mission directory, the discovery pattern, the flag, the skill names, the two tools and the read-only tool's query and flags, `resolve-milestone.md`, the commit markers and descriptors, the context-file section, the dispatch prompt line, the principle store, the fixed console lines), and its "A hard cut" section records the decision that nothing of the old vocabulary is kept and the record starts at the rename. It names what stays as written: `requirements.md`, `open_questions.xml`, `TASKS_TODO.md`, the commit markers without the word, the CHANGELOG's entries, the commits already in the log, and the `milestone_01` to `milestone_54` directory names the invariants cite. Of its open questions three bear on this goal and are answered nowhere: where the principle store lives, how the word's rename is known to be complete, and under which word, and by which copy of the plugin, the rename's own work is recorded and run.

### The word's surface

Measured at the commit this section was written on, over tracked files outside `hosts/` and `uv.lock`, any capitalisation: 135 files and 5,144 occurrences of the word, 1,931 in `tests/`, 1,519 in `core/`, 660 in `docs/`, 442 in `CLAUDE.md`, 189 in `ideas/`, 122 in `CHANGELOG.md`, 101 in `host_tests/`, 39 in `.claude/`, 38 in `README.md`, 33 in `.github/`, 32 in `CONTRIBUTING.md`, 30 in `scripts/`, and 8 in the two live milestones' own files. The draft's per-area figures match these; its total of 5,529 does not. The paths named with the word are ten skill directories, `core/tools/milestones.py` and `core/tools/define_milestone.py`, `core/shared/resolve-milestone.md`, fifteen `tests/test_milestones_*.py` files, the fixture container `tests/fixtures/host_project/milestones.fixture/`, and the root `milestones/` container. `hosts/` holds a further 4,582 occurrences and 39 such paths, 13 per host, all of it build output: `scripts/build_hosts.py` does not carry the word, and it replaces each host tree whole with the fresh render, so a file renamed under `core/` leaves no stale copy behind.

### Discovery, container, and scope in the read-only tool

`core/tools/milestones.py` (1,379 lines, 324 occurrences) defines `DISCOVERY_PATTERN = "**/milestones/*/requirements.md"` once, and the container logic derives from it: `CONTAINER` is the pattern's third-from-last component, `scope_of` drops a milestone path's last two components, `named_milestone` requires the second-to-last component to equal `CONTAINER`, and `required_milestone` refuses any other `live`, `gate`, `since`, or `milestones --milestone` path with `has no milestones/ container`. Its matcher, `matches_components`, reads `**` as any run of leading components, `*` as exactly one whole component, and every other component literally, so it cannot match a prefix inside a component. The word is also in the tool's interface: the `milestones` query and its `--milestone` option, `since --milestones`, the `MILESTONE_PATH` metavar, `FINISH_MARKER = "Milestone-finish:"`, the legacy `Milestone <N>: ` title prefix it strips, and the module docstring and help text that state the contract and its limits.

### The definition tool and the other tools

`core/tools/define_milestone.py` (387 lines) holds `CONTAINER_NAME = "milestones"` and `SUBJECT_MARKER = "Milestone-definition"`, creates the scope's container when it is missing and then the slug-named directory inside it, and prints the `Milestone-definition: <path>` subject and the path. The open-question, task-list, fold, and commit tools carry the word only in docstrings, help text, the `MILESTONE_DIR` metavar, and the `milestone_dir` argument name (42, 23, 19, and 1 occurrences), and the docstrings of the first three, like the read-only tool's, state that the module never reads `milestones/README.md`. Every tool is one self-contained file copied byte-identical into each host tree, which a parity test per tool asserts.

### Skills, shared procedures, and the flag

`core/skills/` holds 22 skills, ten of them named with the word: `ask-in-milestone-context`, `capture-milestone-principle-updates`, `define-milestone-goal`, `discuss-milestone-goal`, `finish-milestone`, `init-milestone-base-workflow`, `migrate-milestones`, `modify-milestone-goal`, `review-milestone-requirements`, and `specify-milestone-starting-state`. Seventeen skills take the leading `--milestone <path>` and resolve it through `core/shared/resolve-milestone.md`, which owns the flag-recognition rule and the stop line with the `live` listing beneath it; `capture-milestone-principle-updates` takes a positional path instead. In `core/`, `MILESTONE_DIR` appears 269 times and `MILESTONE_PATH` 55, and the dispatch line `Milestone directory: <MILESTONE_DIR>` stands in both orchestrators' prompt fences and is named in the `complete-task` agent file. Outside `core/`, six slot value files (each host's `ALTERNATIVES_DISPATCH.md` and `COMPLETE_TASK_DISPATCH.md`) carry `<MILESTONE_DIR>`, and each host's README template names `/init-milestone-base-workflow`.

### Commit markers and the record

Four subjects carry the word: `Milestone-definition: <path>`, printed by the definition tool; `Milestone-finish: <path>`, written by `finish-milestone` and read back by the read-only tool; `Workflow-bootstrap: milestones`, written by the bootstrap; and `Workflow-migration: milestones`, written by `migrate-milestones`. The log holds 101 non-merge `Milestone-finish:` subjects, 57 of them in the path form naming a directory under `milestones/`, which are the 57 finished milestones the overview prints, and 233 `Task-completion:` commits, each joined to its milestone through the pattern read with `TASKS_TODO.md` as its last component. That record is read by `discuss-milestone-goal` (`record .`), `ask-in-milestone-context`, the starting-state procedure, the review pass, the completion procedure's past-work read, and `/release-plugin`, which builds its notes from `milestones .` and `summary` and stops on a finish commit that has no body. The tool's log reads follow no rename: a milestone's `Starting-state:` anchor and its started state are both read from the log at the path it stands at.

### `migrate-milestones` and what exists only for it

`core/skills/migrate-milestones/SKILL.md` is on `main` unreleased and no test covers it. It has seven rows in the fixed console lines table, an entry in `docs/skill-reference.md`, and mentions in `docs/workflow.md` and in the layout, pipeline, and invariants of `CLAUDE.md`. It is the only caller of the commit tool's `--date` option, which `tests/test_commit_date.py` covers, and one of the two callers of `--remove`, beside `finish-milestone`. `core/shared/workflow-guidance.md` names it as the writer of its third case, the whole-section replacement, which the bootstrap never uses.

### Context-file guidance

`core/shared/workflow-guidance.md` is the one home of the `## Milestone Workflow` section, whose paragraph names the `milestones/` container, the `--milestone <path>` flag, `/define-milestone-goal`, `/finish-milestone`, and the `Milestone-finish: <path>` commit. `init-milestone-base-workflow` writes the section only into a context file lacking it and treats any section under that heading, an older one included, as already bootstrapped. This repository's `CLAUDE.md` ends with that section, and `AGENTS.md` is a symlink to `CLAUDE.md`.

### Fixed console lines

The `## Fixed console lines` table of `docs/skill-reference.md` lists 94 lines. In 22 of them the line's own text carries the word, and 41 rows name a source that carries it (a skill named with the word, or `shared/resolve-milestone.md`), seven of those being `migrate-milestones` rows. `tests/test_fixed_console_lines.py` checks every listed line verbatim against each rendered host tree and that none repeats; the test file itself does not carry the word.

### The principle store

`milestones/answer_decision_principles.md` stands in the root container beside the two live milestones. Its path is written literally in `core/shared/recommend-procedure.md`, in `capture-milestone-principle-updates` (in prose and in its `git status`, `cp`, and `git diff` commands), in `migrate-milestones`, in `docs/skill-reference.md`, `docs/workflow.md`, and `CLAUDE.md`, and in two tests, `tests/test_define_scope.py` and `tests/test_milestones_live.py`. No tool reads or writes it.

### The tool suite

`tests/` holds 63 test files. `pyproject.toml` sets `pythonpath = ["core/tools"]` and `testpaths = ["tests"]`, so the tests import the tools as the modules `milestones` and `define_milestone`, and nothing outside `tests/` is collected. `tests/conftest.py` carries the word in shared names (`MILESTONES_TOOL`, `DEFINE_TOOL`, the `milestone_dir` and `run_milestones` fixtures), and its `workspace` and `repo` factories build fixture milestones under a `milestones/` root, at paths such as `milestones/first/` and `milestones/milestone_07_first/` that the tests pass to the tools and assert in their output. The fixed-call tests extract their commands from `hosts/claude` files of skills and agents whose names do not carry the word, and the per-tool parity tests compare each tool's copies under `hosts/`.

### The host suite

`host_tests/` (four files) is outside `testpaths` and CI and is run per host, against each host whose trigger set a change touches: the host's definition directory, `core/agents/*.md`, `scripts/build_hosts.py`, and `host_tests/` itself. Its fixture project is `tests/fixtures/host_project/milestones.fixture/`, a container kept under a name the discovery pattern does not match, holding `milestone_01_pocket-ledger-foundations/` and a pointer-era `README.md`; `seeded_repo` renames the container to `milestones/` in each repository it seeds, from `FIXTURE_CONTAINER` in `host_tests/conftest.py`. The tests invoke `/cairn:derive-tasks --milestone …` and `/cairn:submit-task --milestone …`, write `Milestone directory:` prompt lines, call `milestones.py since … --milestones`, and build `Milestone-definition:` and `Milestone-finish:` commits for a second milestone.

### Documentation and repository surface

The word runs through `docs/skill-reference.md` (290 occurrences, 17 skill headings spelling `--milestone <path>`), `docs/workflow.md` (210), `docs/ways-of-using-cairn.md` (128, with 40 lines carrying the flag), `docs/design-claims.md` (25), `README.md`, and `CONTRIBUTING.md`. `.github/` carries it in the `Milestone proposal` issue template and in the pull request template, whose first line is `Milestone: <scope>/milestones/<slug>/` and whose checklist names the `Milestone-definition:` and `Milestone-finish:` commits. `.claude/skills/release-plugin/SKILL.md` carries it where it reads the record for the release notes. `CHANGELOG.md` holds 122 occurrences in release notes kept verbatim, its latest entry 1.9.0, and `ideas/benchmark_for_cairn.md` holds 105.

### The running copy and the release state

`.claude-plugin/marketplace.json` is a directory marketplace whose one plugin has the source `./hosts/claude`, and the skills run in this repository are served from that directory of the working tree: the run that wrote this section loaded `hosts/claude/skills/specify-milestone-starting-state/`. The draft records that whether a session reads that copy once at its start or again at each skill call was not tested, and that other projects on the maintainer's machine run from the same copy. `VERSION` reads 1.9.0, which is also the last tag, and `main` stands 515 commits past it with the path-addressed redesign unreleased.

### Earlier work on the same sites

The finished milestones that built what this goal renames: `milestones/milestone_54_milestones-addressed-by-path/` (finished 2026-11-09) introduced the required `--milestone <path>`, the container and its discovery pattern, the `live`, `gate`, `milestones`, `summary`, and `record` queries, `finish-milestone` with its removal commit, the scope gate, and `migrate-milestones`, which re-finished this repository's 53 recorded milestones; `milestones/starting-state-refresh/` (2026-11-10) added `since`, `show`, and the `--milestones` and `--last` flags; `milestones/host-generic-on-demand-suite/` (2026-11-09) made the host suite and its fixture project; `milestones/milestone_53_completed-tasks-live-in-commits/` created the read-only tool, `milestones/milestone_50_uniform-milestone-resolution-with-an/` the flag and the `Milestone directory:` line, and `milestones/milestone_37_mechanical-milestone-definition/` the definition tool. `milestones/milestone_03_generic-naming-refactor/` (2026-06-18) is the one earlier vocabulary rename: it renamed skills, an agent, a shared procedure, and two `requirements.md` headings in a clean break with no aliases, and added a manual `migrate-workspace` skill for consuming workspaces, which is not in the tree today.

### In flight

One other live milestone overlaps this one's scope: `milestones/rename-cairn-to-gurita/`, defined and not started, whose goal is to rename the plugin from Cairn to Gurita at every identifier site and in prose with no alias, and to publish, as its last task, one breaking release carrying the path-addressed redesign, the mission rename, and the new name. It is root-scoped like this milestone and stands beside it in the root `milestones/` container, with no starting state, open question, or task recorded.

## Decisions

### Bootstrap on an older workflow section

When the context file holds a `## Milestone Workflow` section and no `## Mission Workflow` one, the bootstrap recognizes the old heading as an older section and replaces it whole, from its heading line down to the line before the next `# ` or `## ` heading or to the end of the file, with the `## Mission Workflow` section, leaving every line outside it untouched. `core/shared/workflow-guidance.md` keeps its third case, the whole-section replacement, with the bootstrap named as its writer in place of `/migrate-milestones`. The run commits under `Workflow-bootstrap: missions` and prints the existing success line. The skill therefore names the old heading literally, a use of the old word in runtime prose kept by decision.

### Principle store location

The project-wide principle store moves to the project root as `answer_decision_principles.md`, its file name unchanged, in no directory, a path that holds neither the old word, the new word, nor the plugin's name, so the plugin rename that follows does not move it again. The recommendation procedure, the capture skill's prose and its `git status`, `cp`, `git diff`, and restore commands, the docs, `CLAUDE.md`, and the two tests name that path literally. This repository's store is moved there with `git mv`, and the root `milestones/` directory disappears once it stands empty.

### Running copy and own finish

A copy of the plugin held at the old word runs every task of this milestone and its finish: for example, the directory marketplace is re-added from a separate checkout or worktree held at the commit before the first rename task, and pointed back at the working tree's `hosts/claude` after the finish. `hosts/` is rebuilt with every change under `core/` as usual, so every commit passes `--check`. The milestone is finished where it stands, at `milestones/rename-milestone-to-mission/`, by the old `finish-milestone`, as the last `Milestone-finish:` commit, which the renamed tool never prints.

## Out of Scope

