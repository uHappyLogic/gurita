# TASKS TODO

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
