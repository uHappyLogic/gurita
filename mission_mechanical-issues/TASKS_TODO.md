# TASKS TODO

## Refused Dispatches Resent in the Alternatives Pass

Add a stated step to the Claude Code value of `ALTERNATIVES_CONCURRENCY`, which keeps its one uncapped message: a dispatch the host refuses for its concurrent-subagent limit is held as pending, despite the refusal message's "Do not retry", and each time the run wakes with an ended agent it sends one held question again per agent that ended, the resent agent's file landing like any other for the next batch call, with no number written into the slot value. It closes the draft's CAP entry; verified by the rebuilt Claude Code tree carrying the step while the Antigravity and Codex values and `core/` stay unchanged, with `--check` passing and CLAUDE.md recording the fix.

---

## Completion Agent Return Rules Tightened

In the `complete-task` agent's file, add one host-neutral rule beside its return protocol (run every command the procedure needs in the foreground and wait for it within the call, never end a turn while a process it started is still running, and end the session only on the `DONE` or `FAILED:` line), and reword `## Return protocol` from "exactly one of these as the final line" to a final message that is exactly the one line and nothing else, `DONE` or `FAILED: <reason>`, as the alternatives agent's file words its own return, with no sentence added at step 5. It closes both halves of the draft's TOKEN entry while the shared completion procedure and `complete-all-tasks` stay unchanged; verified by the rebuilt agent file carrying both wordings with `--check` and both pytest runs passing, and by CLAUDE.md recording the two fixes.

---

## Heredoc Delimiter Clause at Every Site

Add the clause telling the runner to pick a delimiter line the text does not contain, in the wording the other sites already carry, at the review pass's `add`, `derive-tasks`' `initialize`, `submit-task`'s `insert`, and the second heredoc of the `complete-task` agent's step-5 call, the one that writes the path file, with the fences unchanged and no fixed-call test added. It closes the draft's EOF entry; verified by every heredoc the rebuilt trees show stating the rule, with `--check` and both pytest runs passing and CLAUDE.md recording the entry as fixed by the clause at every heredoc site.

---

## Record the Accepted Entries in the Invariants

Record in CLAUDE.md, each with the reason its decision gives, the five entries the mission accepts with nothing changed: the whole `show` print (in the missions-tool invariant, as the unbounded `tasks` print is recorded), the whole compact view (beside the answer sweep invariant, with its 12 of 118 field views), markup in an alternative's text (eight refused returns, each recovered by the pass's one repair), the hand-rendered attributes (the acceptance meant as never, not later), and the retry of every exit 128 (16 attempts, 0.25 seconds apart, the committing invariant staying as written). The goal has CLAUDE.md record each entry's outcome; verified by reading each acceptance and its reason back against its `## Decisions` entry, with no runtime file, tool, or test changed.

---

## Delete the Mechanical Issues Draft

Check that CLAUDE.md records the outcome, a fix or an acceptance with its reason, of every entry of `ideas/mechanical_issues.md`, adding any record still missing, then delete the draft from `ideas/`. It is the mission's closing criterion; verified by each of the draft's entries traced to its CLAUDE.md record and by the file, tracked at `HEAD` before the deletion so the task's commit shows its full text as removed lines, being gone from the tree.

---
