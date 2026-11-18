# TASKS TODO

## Skills Resolve a Required Mission Flag

Rename the flag and what resolves it across `core/skills`, `core/shared`, `core/agents`, and the six slot value files carrying the placeholder: `--milestone <path>` becomes `--mission <path>` with no alias, `core/shared/resolve-milestone.md` becomes `resolve-mission.md`, `<MILESTONE_DIR>` becomes `<MISSION_DIR>`, and the dispatch line becomes `Mission directory: <MISSION_DIR>`. The four fixed-call tests follow the placeholder, and the fixed-console-lines table names the procedure's new path. Verified by the drift gate and both pytest runs passing and by a search of `core/` and `scripts/hosts/` finding none of the four old forms.

---

## Rename the Nine Skills to Mission

Rename the nine remaining skill directories named with the old word (`ask-in-milestone-context`, `capture-milestone-principle-updates`, `define-milestone-goal`, `discuss-milestone-goal`, `finish-milestone`, `init-milestone-base-workflow`, `modify-milestone-goal`, `review-milestone-requirements`, `specify-milestone-starting-state`) to the same names with `mission`, and update each one's frontmatter name and every reference to them under `core/` and `scripts/hosts/` and in the Source column of the fixed-console-lines table. Verified by the drift gate and both pytest runs passing and by a search of `core/` and `scripts/hosts/` finding no old skill name.

---

## Runtime Prose and Console Lines Say Mission

Rewrite what is left of the old word in `core/skills`, `core/shared`, `core/agents`, and the slot values: prose and frontmatter descriptions, example paths and the wording of the `milestones/` container recast to `<scope>/mission_<slug>/`, the `Mission-finish:` subject and the `Workflow-bootstrap: missions` descriptor, the `## Mission Workflow` guidance, and each fixed console line that carries the word, reworded together with its row in `docs/skill-reference.md`. Verified by the drift gate and both pytest runs passing and by a search of `core/` finding the old word only in the principle store's path, which moves in its own task.

---

## Move the Principle Store to the Root

Move this repository's principle store with `git mv` from `milestones/answer_decision_principles.md` to `answer_decision_principles.md` at the project root, its file name unchanged, and name the new path literally in the recommendation procedure, the capture skill's prose and its `git status`, `cp`, `git diff`, and restore commands, the docs, `CLAUDE.md`, and the two tests, with no fallback read of the old path. Edit the store's header to name the renamed capture skill and its "Description over retirement note" directive so that "the milestone record" reads in the new word, keeping the "Required input over optional branch" origin line as written. Verified by the drift gate and both pytest runs passing and by a search finding the old path only in `ideas/`, `CHANGELOG.md`, and this milestone's own files.

---

## Bootstrap Replaces an Older Workflow Section

Make the bootstrap recognize a `## Milestone Workflow` section in a context file holding no `## Mission Workflow` one and replace it whole with the new section, through the third case of `core/shared/workflow-guidance.md` with the bootstrap named as its writer, committing under `Workflow-bootstrap: missions` and printing the existing success line. In that same pass, when `milestones/answer_decision_principles.md` stands and `answer_decision_principles.md` at the root does not, it moves the file to the root unchanged and commits both paths with the context file in the one commit, and otherwise moves nothing. Verified by reading the rendered skill against the Bootstrap on an older workflow section and Existing store at upgrade decisions and by the drift gate and both pytest runs passing.

---

## Build Check Bans the Old Word in Core

Add a permanent build check beside `host-name-in-core` in `scripts/build_hosts.py` that fails on the old word, in any capitalisation, anywhere under `core/`, apart from a residue list holding only the old forms runtime prose keeps by decision, the old workflow heading and the old store path the bootstrap names. It is the runtime half of the rename's completeness bar, catching a leftover the suites do not. Verified by the build and `--check` passing on the tree as it stands and by the check failing when the word is written into a `core/` file outside the list.

---

## Docs Follow the Mission Rename

Carry the rename through `docs/skill-reference.md`, `docs/workflow.md`, `docs/ways-of-using-cairn.md`, and `docs/design-claims.md`: skill names, the `--mission <path>` flag on every heading and chain line, tool and query names, commit markers, and prose in the new word, with the `milestones/` container recast to `<scope>/mission_<slug>/`. The docs state that the record starts at the first `Mission-finish:` commit and that task commits made before the rename list under the placeholder. Verified by both pytest runs passing and by a search of `docs/` finding the old word only where it names a retired form.

---

## Workflow Docs State the Upgrade Rule

In the bootstrap paragraph of `docs/workflow.md`, where the sentence sending a pointer-era project to `/migrate-milestones` stood, state the upgrade itself: finish every live milestone with the copy of the plugin it was started under before upgrading, the pointer-era state (`milestones/README.md` and the numbered directories) is read by nothing, left in place, and removable by hand, and a bootstrap run replaces the old `## Milestone Workflow` section and moves an existing principle store to the root. No recipe for moving a directory by hand is given. Verified by reading the paragraph against the Upgrade guidance placement and Existing store at upgrade decisions.

---

## Context File Follows the Mission Rename

Carry the rename through `CLAUDE.md`: the commands, repository layout, pipeline listing, file structure, invariants, and development notes in the new identifiers and word, the container wording recast to `<scope>/mission_<slug>/`, and its closing section replaced by the `## Mission Workflow` text `core/shared/workflow-guidance.md` states. The `milestone_01` to `milestone_54` directory names and the numbered milestones the invariants cite stay as written. Verified by a search of `CLAUDE.md` finding the old word only in those citations and by every path, tool, skill, and query it names existing in the tree.

---

## Hard Cut Invariant Entry

Add to `CLAUDE.md` one dedicated invariant entry for the hard cut, written only in the new vocabulary and naming no retired form: the plugin answers to its current names only, through one flag, one discovery pattern (`**/mission_*/requirements.md`), and one finish marker, with no alias and no second pattern, the record starts at the first `Mission-finish:` commit, and no migration is shipped, with low adoption as the ground and the bootstrap's replacement of an older workflow section as its stated exception. Verified by reading the entry against the Hard cut invariant entry decision.

---

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
