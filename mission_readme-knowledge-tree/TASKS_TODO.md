# TASKS TODO

## Write The Core Shared Procedures Node

Write `core/shared/README.md`, the node for the shared procedures under `core/shared/`: every invariant of today's `CLAUDE.md` that chiefly governs a shared procedure and that no node yet states whole, compressed to its rule, its reason, and the retired forms that must not return, none dropped or changed, with a pointer line of the fixed form wherever a rule stated in another node bears, in the fixed node parts, at most 12,000 bytes, each pointer's note at most 400 bytes, and worded to pass the build's `host-name-in-core` and `old-word-in-core` checks as they stand. List the file in the `exclude` key of every `scripts/hosts/<host>/settings.toml`, changing nothing in the build's Python, so that no host tree renders it. Verified by `uv run scripts/build_hosts.py --check` and both pytest runs passing, by no tree under `hosts/` holding the file, by every pointer resolving, and by each invariant placed here being readable in the node as rule, reason, and retired forms.

---

## Write The Core Agents Node

Write `core/agents/README.md`, the node for the two dispatched agents under `core/agents/`: every invariant of today's `CLAUDE.md` that chiefly governs an agent, its dispatch prompt, or its return contract and that no node yet states whole, compressed to its rule, its reason, and the retired forms that must not return, none dropped or changed, with a pointer line of the fixed form wherever a rule stated in another node bears, in the fixed node parts, at most 12,000 bytes, each pointer's note at most 400 bytes, and worded to pass the build's `host-name-in-core` and `old-word-in-core` checks as they stand. List the file in the `exclude` key of every `scripts/hosts/<host>/settings.toml`, changing nothing in the build's Python, so that no host tree renders it. Verified by `uv run scripts/build_hosts.py --check` and both pytest runs passing, by no tree under `hosts/` holding the file, by every pointer resolving, and by each invariant placed here being readable in the node as rule, reason, and retired forms.

---

## Write The Core Skills Node

Write `core/skills/README.md`, the node for the skills under `core/skills/`: every invariant of today's `CLAUDE.md` that chiefly governs a skill and that no node yet states whole, compressed to its rule, its reason, and the retired forms that must not return, none dropped or changed, with a pointer line of the fixed form wherever a rule stated in another node bears, in the fixed node parts, at most 12,000 bytes, each pointer's note at most 400 bytes, and worded to pass the build's `host-name-in-core` and `old-word-in-core` checks as they stand. List the file in the `exclude` key of every `scripts/hosts/<host>/settings.toml`, changing nothing in the build's Python, so that no host tree renders it. Verified by `uv run scripts/build_hosts.py --check` and both pytest runs passing, by no tree under `hosts/` holding the file, by every pointer resolving, and by each invariant placed here being readable in the node as rule, reason, and retired forms.

---

## Write The Scripts Folder Node

Write `scripts/README.md`, the node for the host build, the host definitions under `scripts/hosts/`, and the version and render scripts: what today's `CLAUDE.md` says of them in its layout, commands, development points, and invariants, the host-wording slot rules among them where no earlier node states them whole, each rule compressed to its rule, its reason, and its retired forms with none dropped or changed, in the fixed node parts, at most 12,000 bytes, every pointer a line of the fixed pointer form with a note of at most 400 bytes. Verified by the node holding only the allowed headings in their order and staying within both byte limits, by every pointer resolving, and by `uv run scripts/build_hosts.py --check` still passing.

---

## Write The Test Suite Nodes

Write `tests/README.md` and `host_tests/README.md`, the nodes for the tool suite and the on-demand host suite: how each suite is organised and run, from what today's `CLAUDE.md` says of it in its layout, commands, and development points, in the fixed node parts and at most 12,000 bytes each, with a pointer line of the fixed form, its note at most 400 bytes, to every rule a suite pins in the node that states it, and no such rule restated. Verified by each node holding only the allowed headings in their order and staying within both byte limits, by every pointer resolving, and by both pytest runs still passing.

---

## Write The Remaining Top-Level Folder Nodes

Write a `README.md` node in each of `.claude-plugin/`, `.claude/`, `assets/`, `ideas/`, and `snippets/`, from what today's `CLAUDE.md` says of the folder and from the files it holds as they stand, in the fixed node parts, at most 12,000 bytes each, every pointer a line of the fixed pointer form with a note of at most 400 bytes. Verified by each node holding only the allowed headings in their order and staying within both byte limits, by every pointer resolving, and by `uv run scripts/build_hosts.py --check` and both pytest runs still passing.

---

## Replace The Root Context File

Replace the root `CLAUDE.md`, `AGENTS.md` staying its symlink, with a node of at most 20,000 bytes holding `## Purpose`, `## Rules`, `## Commands`, `## Pointers`, and `## Mission Workflow` in that order: the rules that bind everywhere, among them plain directions on which node an area's lasting knowledge goes to, which node to read before working in a folder, and where a rule spanning folders is stated; one pointer line of the fixed form, its note at most 400 bytes, per top-level folder with a node of its own, and one `### <folder>/` description in the four node parts each for `core/` (pointing at its four nodes), `hosts/`, `gurita-vscode/`, and `.github/`; the entries for `VERSION`, `.python-version`, and `AGENTS.md`; and the bootstrap's Mission Workflow section last, exactly as `core/shared/workflow-guidance.md` states it. Before the old text goes, give a home under the recorded placement rules to everything of it that no node yet carries, a root file that can carry prose taking what is said of it into its own header, so that only the rule that all rationale lives in `CLAUDE.md` is retired. Verified by each of the outgoing file's 35 invariants being found in a node or the root as rule, reason, and retired forms, by the root's heading set and order, its byte limit, and every pointer resolving, and by `uv run scripts/build_hosts.py --check` and both pytest runs passing.

---

## Repoint Outside References To The Tree

Bring the three statements outside the tree that name the outgoing file's sections in line with it: `CONTRIBUTING.md`'s link to `CLAUDE.md#invariants-to-preserve-when-editing-skills`, the pull-request template's checkbox that `CLAUDE.md` is touched only for lasting changes, and the statement in `.claude/skills/release-plugin/SKILL.md` that no release prose lives in `CLAUDE.md` or `README.md`, each saying where that knowledge lives now. Verified by no tracked file outside the mission directories and `hosts/` linking a heading the root no longer holds, and by each of the three reading true against the root and its nodes.

---

## Add The Knowledge Tree Check

Add a test under `tests/`, reading tracked files only so that it runs in both pytest runs, that fails when a pointer line's path or heading anchor does not resolve; when a tracked top-level folder, the root `mission_*/` directories left out, has neither a `README.md` node nor a description in the root; when a deeper `README.md` node is pointed at from neither its parent folder's node nor the nearest ancestor's; when the root `CLAUDE.md` exceeds 20,000 bytes, a `README.md` node 12,000 bytes, or a when-to-follow note 400 bytes; when the root, a node, or one of the root's folder descriptions holds a heading outside its allowed set and order; or when a tracked `.github/README.md` exists, that message naming GitHub's front-page precedence as the reason. Verified by each failure reproduced on a synthetic tree, by the test passing on the repository in both pytest runs with any node it fails repaired in the same task, and by the nodes covering the check stating it within their limits.

---

## Add The Knowledge Tree Update Skill

Add a maintainer-only skill under `.claude/skills/`, outside `core/` so that no host renders it, opening with `name` and `description` frontmatter: one run finds its anchor in the log, the latest commit under the skill's own subject marker (with no anchor, the first run compares every node with its folder), updates in place the nodes of the folders changed since and the pointer notes above them, keeping every still-true sentence byte-identical, repairs every failure of the knowledge-tree check, re-compressing a node only as far as a budget failure forces, and commits under its marker, which moves the anchor. Verified by reading the skill step by step against the recorded update-skill decision, by `.claude/README.md` covering the new skill within its limits, and by the knowledge-tree check and both pytest runs passing.

---
