# Rename Cairn to Gurita

## Goal

Rename the plugin from Cairn to Gurita at every identifier site and in prose, with no alias for the old name, and publish the result as the last task: one breaking release carrying the path-addressed redesign, the mission rename, and the new name, its notes the rebranding.

## Relevant starting state

### The naming draft

`ideas/gurita.md` is the design draft this mission carries out. It records the name and its collision check (looked up directly on 2026-11-10: an npm placeholder package `gurita`, the small tool `bjpop/gurita`, and the taken GitHub owner names `gurita` and `gurita-dev`, none held to block the rename, with one more lookup owed before anything is published), and a table of where the name lands: `gurita` as the plugin, marketplace, and namespace name, `uHappyLogic/gurita` and `uHappyLogic/gurita-<host>`, `~/.gemini/config/plugins/gurita`, `plugins/gurita`, and `gurita-tooling`, with Gurita capitalised in prose. It also records the hard cut the maintainer decided that day: no `cairn:` alias, the source repository renamed with links to its old name not kept working on purpose, and one release whose notes are the rebranding, the redesign and the word's rename being described in the documentation only. It leaves three questions to this mission: whether the distribution repositories are renamed or recreated, what the rename means for an installed copy (whether it is a major version, and what the CHANGELOG entry and the old README tell a user arriving at the old name), and which sites carry the name as an identifier and what verifies a change to them.

### The name's surface

Measured on 2026-11-18 over tracked files, any capitalisation, outside `hosts/`, `uv.lock`, and this mission's own directory: 49 files hold 756 occurrences of `cairn`. By area: `ideas/` 283 (243 of them in the benchmark draft), `scripts/` 159, the CHANGELOG 72, `docs/` 65, the README 60, `.claude/` 35, CONTRIBUTING.md 31, `host_tests/` 14, `.github/` 12, CLAUDE.md 7, `tests/` 2, and `core/` 1. The built trees under `hosts/` hold 303 more in 51 files, 200 of them in `hosts/antigravity/`, where the plugin root renders as a literal path. Beside this mission's directory, four tracked paths are named after the plugin: `docs/ways-of-using-cairn.md`, `ideas/benchmark_for_cairn.md`, the template directory `scripts/hosts/codex/plugins/cairn/`, and its rendered counterpart `hosts/codex/plugins/cairn/`. The word `gurita` stands only in three idea drafts and this mission's files.

### Host definitions and the build

`scripts/build_hosts.py` carries the name nowhere: it fills every `{{NAME}}` in a host's templates from `plugin_name`, which reads `"cairn"` in each of the three `scripts/hosts/<host>/settings.toml` files, and through it the `name` of the three plugin manifests and the `plugins[].name` of the Claude Code and Codex marketplace templates. Every other identifier is written literally: the marketplace `name` in both marketplace templates, the Codex marketplace's `displayName` and its `./plugins/cairn` source path, the Codex template directory `scripts/hosts/codex/plugins/cairn/` with `plugin_dir` and the four `[layout]` paths in that host's settings, Antigravity's `plugin_root = "~/.gemini/config/plugins/cairn"`, which renders into every tool command of that tree, and the namespaced agent names `cairn:complete-task` and `cairn:provide-alternatives-to-open-question` in three Claude Code slot values (`COMPLETE_TASK_DISPATCH`, `ALTERNATIVES_DISPATCH`, `ALTERNATIVES_REPAIR`). The one-sentence description opening with "Cairn" stands in the four manifest templates that carry a description and in the root marketplace. The dated hands-on check block heading each `settings.toml` quotes install commands, invocations, and cache paths under the old name. No build check bans or requires the plugin's name: `host-name-in-core` and `old-word-in-core` scan for host names and the retired unit word only.

### Root marketplace, tooling project, and runtime files

The root `.claude-plugin/marketplace.json`, the maintainer's directory marketplace, names both the marketplace and its one plugin `cairn`; `scripts/set_version.py` mirrors the version into it, and the build's `root-marketplace-version` check reads nothing else of it. `pyproject.toml` names the tooling project `cairn-tooling`, `uv.lock` mirrors that name, and `set_version.py` finds the lock block through its constant `LOCK_PACKAGE_NAME = "cairn-tooling"`. `.claude/settings.json` enables `cairn@cairn` for this project, and `.gitignore` opens with `.cairn/daemon.toml`, a path nothing else in the tree names. `core/` holds the name once, as prose ("the right cairn skill" in `core/skills/ask-in-mission-context/SKILL.md`); the six tools hold it nowhere, and `tests/` only as the git identity `Cairn Test` in `tests/conftest.py`.

### Host suite and installed copies

`host_tests/conftest.py` holds `PLUGIN_ID = "cairn@cairn"`, the Antigravity root `~/.gemini/config/plugins/cairn`, and the Codex cache path `~/.codex/plugins/cache/cairn/cairn/<version>`, and two of the suite's tests invoke `/cairn:derive-tasks` and `/cairn:submit-task`. Before any test the suite requires the chosen host's installed copy to equal the built tree, and it writes to no installation. On the maintainer's machine on 2026-11-18, with `claude`, `agy`, and `codex` all on `PATH`: Claude Code's `cairn` marketplace is a directory source at this checkout's `hosts/claude`, and its one recorded `cairn@cairn` install is at project scope for this checkout, where the suite's check looks for an install outside any project; the Antigravity global install and the Codex cache each hold a copy labelled 1.9.0 that differs from the built tree (56 and 54 differing paths). The session running this mission loads its skills and agents from the working tree's `hosts/claude`, so the names they answer to are whatever the last build rendered. The word's rename ran no host suite, by decision, and every host's trigger set changed since 1.9.0, so the release's pre-flight owes a passing run on all three hosts.

### Release procedure

`.claude/skills/release-plugin/SKILL.md` is the only place the release is documented, and it carries the name in its description and throughout. It derives each distribution repository as `uHappyLogic/cairn-<host>` from the definition directory name by fixed convention, requires each to exist and hold `TRAFFIC_TOKEN` (printing, never running, the creation commands for a missing one, with the "Cairn" description and the topic `cairn`), names `hosts/codex/plugins/cairn/` among the plugin directories the host suite compares against, writes `uHappyLogic/cairn` into the compare link and each distribution commit's `Source:` and `Notes:` lines, and publishes releases to `uHappyLogic/cairn` and each `uHappyLogic/cairn-<host>`. It composes its notes from the finished lines `python3 core/tools/missions.py missions .` prints since the last tag; that call prints no finished line today, which is the skill's empty-range branch: one `### Changes since <LAST_TAG>` section condensed from the commit range, shown to the maintainer and released only on an explicit yes. Its one pause, before publishing, lets the maintainer revise the committed CHANGELOG entry while the release commit is unpushed. The version must be a bare `MAJOR.MINOR.PATCH` strictly greater than the last tag, and the `Release: <VERSION>` commit changes only version slots and the CHANGELOG entry, the pre-flight drift gate having refused anything else.

### Repositories and published state

On 2026-11-18 `origin` is `git@github.com:uHappyLogic/cairn.git`, and GitHub holds four public repositories, `uHappyLogic/cairn`, `cairn-claude`, `cairn-antigravity`, and `cairn-codex`, each with 1.9.0 as its latest release, the three distribution repositories under the topics `cairn`, their host, and `plugin`; no `uHappyLogic/gurita` or `uHappyLogic/gurita-<host>` repository exists. `VERSION` reads 1.9.0 and the tag `1.9.0` dates from 2026-10-26; `main` stands 576 commits past it, 61 of them not on `origin/main` as last fetched, the whole of the word's rename among them. Each of the four repositories runs a `traffic-badges` workflow that pushes badges to its `traffic-data` branch with one fine-grained `TRAFFIC_TOKEN` scoped to exactly those four repositories by name; the root README's adoption table and each host README read the badges by raw URLs holding the repository name, and each host's workflow template opens with a comment naming its distribution repository. Claude Code users install from the `cairn-claude` marketplace, and that host's README, under "Migrating from the old marketplace", says installs pinned to the source repository's own root marketplace keep working and updating.

### User-facing documentation

The README carries the name in its title, pitch, "Why Cairn?" section, release and CI badges, adoption table, and per-host install commands: `/plugin marketplace add uHappyLogic/cairn-claude` with `/plugin install cairn@cairn`, an extract of the `cairn-antigravity` archive into `~/.gemini/config/plugins/cairn`, and `codex plugin marketplace add uHappyLogic/cairn-codex` with `codex plugin add cairn@cairn` and the `$cairn:<skill>` invocation form. Each host's README template repeats its own host's commands and names the source repository, each host's CONTRIBUTING template is a pointer to `uHappyLogic/cairn`, and CONTRIBUTING.md, SECURITY.md, and the issue-template files name the plugin, the repositories, and the installed-copy paths (the bug form's version field has the id `cairn-version`). `docs/ways-of-using-cairn.md`, named after the plugin and referenced from the README, CLAUDE.md, `docs/skill-reference.md`, `docs/workflow.md`, the CHANGELOG, and three idea drafts, writes its chain lines as `/cairn:<skill>` invocations, 44 of them; `docs/design-claims.md` carries the name in its title and three claim headings, one of which the README links by an anchor holding it. The CHANGELOG, whose entries are each release's notes verbatim, holds 72 occurrences, most of them in `uHappyLogic/cairn` links, and the principle store one sentence naming Cairn. CLAUDE.md names the plugin in seven lines: its opening description, the distribution-repository convention (twice), the docs file name (twice), the `cairn:<agent>` namespace in the committing invariant, and `plugins/cairn` under Development.

### Idea drafts

`ideas/benchmark_for_cairn.md`, named after the plugin and referenced only from `ideas/gurita.md`, holds 243 occurrences of the name. `ideas/kepala.md` and `ideas/vscode_extension.md` already call the plugin Gurita and carry the old name only where they cite the docs file, the Antigravity install path, or this mission; both state that they wait on this rename.

### The record and what is in flight

The missions tool's overview of the root scope prints this mission alone: no finished mission, because the record starts at the first `Mission-finish:` commit and none exists yet, and no other live mission, so nothing else holds or prepares in this scope. The work unreleased since 1.9.0 was all finished under `Milestone-finish:` subjects that no query prints: milestones 51 to 54, `host-generic-on-demand-suite`, `starting-state-refresh`, `completion-procedure-reads-past-work`, and the word's rename, `milestones/rename-milestone-to-mission/`, finished on 2026-11-18 as the last of them, having released nothing. This mission reads `defined`. It was defined on 2026-11-10 as `milestones/rename-cairn-to-gurita/`, and its three files arrived at `mission_rename-cairn-to-gurita/` as additions in the word's rename's `Task-completion: Relocate the Sibling Milestone to Mission Form` commit, so no `Mission-definition:` commit names its current path.

### Verification baseline

At `42878df` on 2026-11-18 the drift gate passes (`uv run scripts/build_hosts.py --check`, at version 1.9.0), the pinned test run passes with 1577 tests, and the 3.9 floor run with 1573 and its one pinned-only module skipped. None of the three exercises an installed copy or the plugin's name as a host resolves it: the namespace, the marketplace and plugin ids, and the install paths are covered only by the host suite and each host's hands-on check. CI runs the drift gate and both test runs in one job on the source repository.

## Decisions

### Final name lookup

The lookup of the name `gurita` that the naming draft owed before publication is dropped. The direct lookup of 2026-11-10 is the name's last collision check: nothing is looked up before publication, and nothing can hold the release on the name's account. The sentence in the collision check of `ideas/gurita.md` that owes one more lookup before anything is published is changed to say that none is made.

### README tagline

The README's bold tagline, "Mark the path first, then hand off the walk.", is replaced by a new tagline drawn from the image the new name carries: the arms that each carry a mission out on their own once its questions are decided, for example a line on deciding first and letting the arms carry the work. The new tagline keeps the old one's place, directly under the title and above the pitch.

### Distribution repository transition

The three distribution repositories are created fresh, not renamed in place. Three new, empty repositories `uHappyLogic/gurita-<host>` are created, receive their `TRAFFIC_TOKEN` secret and the token's scope, and take the release's first distribution publish as a parentless root commit. Each old `uHappyLogic/cairn-<host>` is archived as it stands, its 1.9.0 tree, release, history, and `traffic-data` branch unchanged and read-only, so the old names keep serving exactly the last Cairn release and nothing is created or redirected at them.

### Release version number

The release that publishes the rename carries 2.0.0, a major bump over the last tag 1.9.0. The number is chosen now and written into the release task, so `/release-plugin 2.0.0` passes the strictly-greater gate unchanged, and the count continues in the renamed source repository beside its existing tags.

## Out of Scope

