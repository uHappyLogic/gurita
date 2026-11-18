# TASKS TODO

## Repository Surface Follows the Mission Rename

Carry the rename through `README.md`, `CONTRIBUTING.md`, the issue and pull request templates under `.github/` (the pull request template's first line and its checklist's two commit markers in the mission form), `.claude/skills/release-plugin/SKILL.md` where it reads the record, and each host's README, CONTRIBUTING, and settings comments under `scripts/hosts/`, leaving `CHANGELOG.md` as written. Verified by the drift gate passing on the rebuilt host trees and by a search of those files finding the old word nowhere.

---

## Host Suite and Fixture in Mission Form

Move the host suite's fixture project into the mission form, its mission directory kept under a name the discovery pattern does not match and renamed by `seeded_repo` in each repository it seeds, its pointer-era `README.md` dropped with the container, and its heading retitled from `# Milestone 1: Pocket Ledger Foundations` to the bare title, and carry the rename through `host_tests/`: the `--mission` invocations, the `Mission directory:` prompt lines, the `missions.py since … --missions` calls, and the `Mission-definition:` and `Mission-finish:` commits. No host suite run is made in this work, on any host, so it is verified by both pytest runs and the drift gate passing and by a search of `host_tests/` and the fixture finding the old word nowhere.

---

## Revise the Gurita Draft After the Rename

Revise `ideas/gurita.md` to record the mission rename as carried out: its Today column and present-tense statements of the old forms recast as what stood before the rename, the open questions this milestone answers marked as answered with the recorded decisions, and the old word kept only where it names a retired form. Verified by reading the draft against this milestone's decisions and the tree as it stands.

---

## Kepala and Benchmark Drafts Follow the Rename

Carry the rename through `ideas/kepala.md` and `ideas/benchmark_for_cairn.md` wherever they describe the plugin, identifiers and prose in the new word, and drop kepala's "a milestone today" gloss. Verified by a search of both drafts finding the old word only where it names a retired form.

---

## Relocate the Sibling Milestone to Mission Form

Move the sibling milestone with `git mv` from `milestones/rename-cairn-to-gurita/` to `mission_rename-cairn-to-gurita/`, leaving its files unchanged, so the work that follows this one stands where the renamed plugin discovers it. The task's commit holds the move alone. Verified by the working tree's `missions.py live` listing `mission_rename-cairn-to-gurita/` as `defined` and by the commit showing the three files as pure renames.

---

## Whole-Tree Search Against the Residue

Run one whole-tree search for the old word in any capitalisation and check every hit against the residue this milestone's decisions keep as written: the CHANGELOG's entries, the `milestone_NN` names and numbered milestones `CLAUDE.md` cites, the old forms the bootstrap, the upgrade guidance, the idea drafts, and a test of an unread form name by decision, the principle store's origin line, the build check's own list, and the files of the two milestones defined under the old word. Rename any hit no decision keeps, so `main` is shown consistent under the new word outside the runtime surface the build check already guards. Verified by the search's result matching the residue list, both carried in the task's bar, with the drift gate and both pytest runs passing.

---
