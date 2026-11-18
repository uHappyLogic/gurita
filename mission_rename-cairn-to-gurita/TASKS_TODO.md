# TASKS TODO

## Run the Host Suite and Record the Re-Check

Run `uv run pytest host_tests --host claude`, then the same for `antigravity` and `codex`, against the renamed build and the installed copies the maintainer brought to it, installing nothing: a run that stops on the suite's prerequisite line waits there for the maintainer. From the passing runs, add to each `scripts/hosts/<host>/settings.toml` check block a dated "Re-checked" sentence naming that run and the installed version and rewrite the Install, Dispatch, and path bullets it covered, leaving the earlier dated sentences and the bullets it did not cover as written under their original names. It is verified by three passing suite runs and a drift gate that still passes after the edit.

---

## Run the Closing Whole-Tree Search

Show the rename complete with one whole-tree search over every tracked file, `hosts/`, `uv.lock`, this mission's own directory, and file paths included (`git grep -I -i cairn` beside `git ls-files | grep -i cairn`), comparing every hit by hand against a residue list of what stays, each entry naming its file, its count, and the decision that keeps it, and renaming any hit no decision keeps. It is verified by the task's bar recording the search's result and the residue list, with no build check and no test added.

---
