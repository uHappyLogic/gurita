# TASKS TODO

## Task List Replace Subcommand

Add a `replace` subcommand to the task-list tool, `task_list.py replace <MISSION_DIR> "<Task Title>"`, that rewrites the body of the one section whose title it matches exactly after whitespace and case folding, the new body on stdin as a quoted heredoc, keeping the section's heading, its position, and its `---`, and refusing an unmatched or shared title or an empty body with the file unchanged; the title cannot change. It gives the draft's REVISE entry a tool call, so the tool stays the list's only writer; verified by a new `tests/` file pinning the subcommand, with the help text and CLAUDE.md's task-list invariant naming the fourth subcommand.

---

## Queued Task Revision in the Completion Procedure

Add a stated step to `core/shared/complete-procedure.md` allowing its runner, after a finding, to rewrite a later queued task's brief through the task-list tool's one `replace` call, the revision riding in the running task's `Task-completion:` commit since `TASKS_TODO.md` is already on the agent's path file and in the inline call's pathspec. Field runs rewrote the list by hand for want of such a step; verified by the rebuilt procedure showing the full fixed command, with `--check` and both pytest runs passing and CLAUDE.md recording the step.

---

## Refuse Heading Lines in Folded Bodies

Make the fold tool refuse a `fold` or `replace` body holding a column-0 `## ` or `### ` line, with the file unchanged, and add one sentence to the answer core's fold step, the one home of a decision's content rules, that a folded decision or rewritten entry holds no such line. It closes the draft's FOLDBODY entry, where a body holding a `## Out of Scope` line left the file with two headings of that name; verified by tests in the fold tool's suite reproducing that case for both subcommands, with CLAUDE.md's fold-tool invariant recording the refusal and where the rule lives.

---

## Sweep Sections Capture the Decision Heading

In the answer sweep's batched call, have each section capture its decision heading once from a quoted heredoc in the group-fed form `{ heading="$(cat)"; } <<'EOF'`, the heading on the one line inside and the delimiter clause covering the new heredoc, and pass it on as `--section "$heading"` to `fold` or `replace`, so the runner escapes nothing in the heading while the fold tool, its required `--section` argument, and its contract stay unchanged. It closes the draft's HEADING entry, where a backticked heading ran a command inside the double quotes; verified by `tests/test_sweep_batched_call.py` filling a raw backticked heading through the new form, with CLAUDE.md recording the fix.

---

## Refuse Shell-Syntax Characters in Mission Scopes

Make the mission-definition tool refuse, after normalization and before it creates anything, a scope holding whitespace or any of `"`, `'`, a backtick, `$`, `\`, `(`, `)`, `[`, `]`, `{`, `}`, `*`, `?`, `;`, `&`, `|`, `<`, `>`, `!`, or `~`, `#`, or `=` opening the scope, with one `Error:` line naming the scope, every other character accepted and a mission already defined under such a scope left as it stands. It closes the draft's PATH entry at definition, since every fixed call writes `<MISSION_DIR>` unquoted and the `--mission` value is one whitespace-separated token; verified by one test pinning the refusal, with CLAUDE.md recording it.

---

## Bars Bound on the Tasks Query

Give the missions tool's `tasks` query a flag beside `--with-body` (the decision's example is `--bodies N`) that prints every task line but the bars of only the N newest tasks, an older task printing as its title line alone, the form a commit with no body already takes, so one parser reads the result. It bounds the draft's BIGREAD cost for `tasks` while every completed task's title stays in the print; verified by tests in the missions-tool suite, with the tool's help text stating the flag.

---

## Five Readers Pass the Bars Bound

Have all five readers of `tasks <MISSION_DIR> --with-body` (`finish-mission`, `derive-tasks`, `ask-in-mission-context`, `submit-task`, `discuss-new-task`) pass the new bars flag with one literal N, the same at every site, in their fixed call. It caps the cost of the bars while every completed task's title stays in front of every reader and the duplicate checks stay complete; verified by the rebuilt trees showing one call shape at the five sites with `--check` and both pytest runs passing, and by CLAUDE.md's missions-tool invariant recording the bound where it records the unbounded `tasks` print.

---

## Two-Tier Record Read in Discuss Mission Goal

Replace `discuss-mission-goal`'s `record .` with the two-tier read the starting-state procedure already uses: one fixed, unconditional `missions .` overview, then, at the runner's discretion, `summary` on a mission whose line bears on the goal, or `record <path>` on the directory the goal concerns once the placement is in view, the missions tool unchanged. The unconditional read drops to one line per mission while still naming every mission recorded (the draft's BIGREAD entry for `record .`); verified by the rebuilt skill showing each full fixed command with `--check` and both pytest runs passing, and by CLAUDE.md's missions-tool invariant recording the new read.

---

## One Joined Read Call in the Alternatives Agent

Replace the alternatives agent's two shown commands with one fixed shell call, run exactly as shown with only `<MISSION_DIR>` and the Short Title replaced, that runs `locate` and then `list --with-question` with a quoted `printf` line between them, a separator every shell accepts, the open-question tool and every other runner left as they are. It closes the draft's SEP entry, where a bare `=` separator lost the second read under zsh; verified by a new fixed-call test that extracts the fence from the rendered tree and runs it, reproducing the separator failure under zsh, with CLAUDE.md recording the fix.

---

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
