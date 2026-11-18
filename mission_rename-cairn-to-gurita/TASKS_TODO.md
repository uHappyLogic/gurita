# TASKS TODO

## Rename Plugin Identifiers in the Host Suite

Bring the identifiers in `host_tests/` to the renamed build: `PLUGIN_ID` as `gurita@gurita`, the Antigravity root as `~/.gemini/config/plugins/gurita`, the Codex cache path as `~/.codex/plugins/cache/gurita/gurita/<version>`, and the two tests' invocations as `/gurita:derive-tasks` and `/gurita:submit-task`, with the comments and docstrings beside them. The suite itself is run by a later task, once the maintainer has installed the renamed copies, so this change is verified by a search finding no old name under `host_tests/` and the suite still collecting.

---

## Rename the Tooling Project to Gurita Tooling

Rename the tooling project from `cairn-tooling` to `gurita-tooling` in `pyproject.toml`, in `uv.lock`, and in `scripts/set_version.py`, whose `LOCK_PACKAGE_NAME` constant finds the lock block by that name, the project description and the script's docstring following. It is verified by the lock staying in step with `pyproject.toml`, the version script still writing its three mirrors, and both test runs.

---

## Rename the Release Skill to the New Names

Rename the plugin and its repositories in `.claude/skills/release-plugin/SKILL.md` and change nothing else of the procedure: the description, the distribution repositories as `uHappyLogic/gurita-<host>` with the creation commands' description and the topic `gurita`, the Codex plugin directory as `hosts/codex/plugins/gurita/`, and `uHappyLogic/gurita` in the compare link, each distribution commit's `Source:` and `Notes:` lines, and the release commands. It is verified by a search finding no old name in the file and a diff that changes names only.

---

## Move the Two Plugin-Named Files

Move `docs/ways-of-using-cairn.md` to `docs/ways-of-using.md` and `ideas/benchmark_for_cairn.md` to `ideas/benchmark.md` with `git mv`, their contents unchanged, and rewrite every in-tree reference to the new paths: the README's link, the CLAUDE.md layout line and its two invariant mentions, `docs/skill-reference.md`, `docs/workflow.md`, and the drafts `ideas/gurita.md`, `ideas/kepala.md`, and `ideas/vscode_extension.md`. It is verified by both moves showing as pure renames and by no tracked file outside the CHANGELOG's published entries and this mission's own directory naming either old path.

---

## Rename the Contributor and Policy Files

Rename the plugin, its repositories, its plugin id, and its installed-copy paths in `CONTRIBUTING.md`, `SECURITY.md`, the issue-template files under `.github/ISSUE_TEMPLATE/` (the bug form's version field id becoming `gurita-version`), `CLAUDE.md`, the principle store's one sentence naming the plugin, and the CHANGELOG's preamble, while every CHANGELOG entry from 1.9.0 back to 0.9.0 stays byte-for-byte as published. It is verified by a search finding no old name in those files outside the CHANGELOG's entries and by a `CHANGELOG.md` diff that touches the preamble alone.

---

## Rename the Plugin Across the Docs Pages

Rename the plugin across the pages under `docs/`: the `/gurita:<skill>` chain lines and prose of `docs/ways-of-using.md`, the title, prose, and three claim headings of `docs/design-claims.md`, with the README's anchor link to the renamed claim heading following in the same change, and the prose of `docs/skill-reference.md` and `docs/workflow.md`. It is verified by a search finding no old name under `docs/`, the README's claim link resolving to its heading, and both test runs.

---

## Rename the Root README and Rewrite Its Opening

Rename the plugin throughout the root README (title, pitch, "Why" section, release and CI badges, install commands, invocation forms, and links) and rewrite its opening as decided: a new bold tagline in the old one's place, drawn from the arms that each carry a mission out on their own once its questions are decided; the bare gloss "(Indonesian for octopus)" inside the pitch; and one sentence near the title and pitch saying that Gurita was published as Cairn up to 1.9.0 and that the old names no longer work, linking to where the upgrade steps are documented. The adoption table carries four rows, `uHappyLogic/gurita` and the three `uHappyLogic/gurita-<host>` repositories, every badge URL under the new names with nothing deferred. It is verified by a search whose only old-name hits left in the README are that sentence and the Antigravity project-level note the upgrade task folds away, and by every in-tree link resolving.

---

## Document the Upgrade From Cairn

Add a short "Upgrading from Cairn" note beside the fresh-install commands of each host subsection in the root README's install sections, with that host's removal commands: Claude Code uninstalls `cairn@cairn` at every scope it was installed at and then removes the `cairn` marketplace; Codex removes the `cairn@cairn` plugin and the `cairn` marketplace; Antigravity deletes `~/.gemini/config/plugins/cairn` and restarts any running `agy` session, the existing project-level `.agents/plugins/cairn` note folded into it so the note removes both old copies. Have the upgrade paragraph of `docs/workflow.md` state the order once, with no commands: finish every live milestone under the old copy, then remove it, then install Gurita and re-run the bootstrap. It is verified by each host subsection carrying its note, the commands checked against each host CLI's help text only and never run, since the frozen cairn copy must stay installed.

---

## Rename the Plugin in the Benchmark Draft

Rename the plugin throughout `ideas/benchmark.md`, its title, prose, and example identifiers alike, since the draft describes the plugin as it stands and no decision keeps the old name there. It is verified by a search finding no old name in the file.

---

## Record the Rename in the Idea Drafts

Revise `ideas/gurita.md`, `ideas/kepala.md`, and `ideas/vscode_extension.md` in place to record the plugin's rename as carried out, in the form the word's rename used in commit `9f443e9` and as the "Idea drafts after rename" and "Final name lookup" decisions lay out: the plugin-name table's columns becoming "Before the rename" and "Now", the three remaining open questions marked "Answered by the plugin's rename." with their recorded decisions, the collision-check sentence saying no further lookup is made, and neither of the other two drafts still waiting on the rename. It is verified by every Now cell matching the tree and by every Cairn mention left in the three drafts naming the former name or the rename's history.

---

## Run the Host Suite and Record the Re-Check

Run `uv run pytest host_tests --host claude`, then the same for `antigravity` and `codex`, against the renamed build and the installed copies the maintainer brought to it, installing nothing: a run that stops on the suite's prerequisite line waits there for the maintainer. From the passing runs, add to each `scripts/hosts/<host>/settings.toml` check block a dated "Re-checked" sentence naming that run and the installed version and rewrite the Install, Dispatch, and path bullets it covered, leaving the earlier dated sentences and the bullets it did not cover as written under their original names. It is verified by three passing suite runs and a drift gate that still passes after the edit.

---

## Run the Closing Whole-Tree Search

Show the rename complete with one whole-tree search over every tracked file, `hosts/`, `uv.lock`, this mission's own directory, and file paths included (`git grep -I -i cairn` beside `git ls-files | grep -i cairn`), comparing every hit by hand against a residue list of what stays, each entry naming its file, its count, and the decision that keeps it, and renaming any hit no decision keeps. It is verified by the task's bar recording the search's result and the residue list, with no build check and no test added.

---
