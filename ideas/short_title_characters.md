# Short Title characters

A draft, written 2026-11-16, for a milestone not yet defined. A change to the open-question tool that refuses a `/` in a new Short Title was written and tested in the working tree, then moved here instead of being committed so it can land as a milestone. The draft records the failure it answers, the change as written, what that change left undone, and the questions the milestone decides. It uses today's vocabulary (milestone, `--milestone`); if the rename to mission lands first, the milestone carries the words over.

## The failure

A question block's id is its Short Title, and two places in the workflow use that title as text no character of which may be special.

- **As a file name.** The alternatives agent writes its return to `<scratch dir>/<Short Title>.xml` (through a `.xml.part` name and one `mv`), and the orchestrator's batch call takes the question back from the file name alone. A Short Title holding a `/` names a directory that does not exist, so the write fails. `core/agents/provide-alternatives-to-open-question.md` already says what happens then: the agent creates no directory, keeps the title as given, and returns `FAILED:`. The question is skipped. But its block stays bare, so the next alternatives pass dispatches it again and fails the same way. A slash in a title makes the question permanently unable to get alternatives through the pass, and nothing says why except the agent's `FAILED:` reason in each run's advisory.
- **Inside a double-quoted shell argument.** Every fixed call that names a block substitutes the title into `"<Short Title>"`: the answer sweep's `lift`, `remove`, `--subject "Recommendation-answer: <Short Title>"`, and `printf 'stopped at\t%s\n' "<Short Title>"`; the recommendation pass's `embed --recommendation`, `lift`, and its refusal `printf`; the review pass's `remove` and `add`; the strip calls. Within double quotes `"` ends the argument, `$` and a backtick expand, and `\` escapes, so a title holding any of the four breaks the call or silently changes the argument the tool receives. The calls are run "exactly as shown, with only the placeholders replaced", so a runner is told not to escape what it substitutes.

The trigger was a Short Title of the form `tools/README.md headroom`, a file path written into the handle, which is a natural thing for a review pass to write when the question is about one file. Across this repository's history the 478 distinct block ids hold no `/`, `"`, `$`, backtick, or `\` (one test fixture aside, which exercises XML escaping), so neither failure has hit a recorded milestone here.

## The change as written

`cmd_add` refused a folded Short Title holding a `/`, before loading the document, so a refused call leaves the file byte-identical. The module docstring and the `add` help text gained the refusal, the three host copies were rebuilt (`build_hosts.py --check` passed), and one test pinned it. The full pinned suite passed (1590) and the 3.9 floor run passed (1586 passed, 1 skipped, the pinned-only rendering test).

```diff
--- a/core/tools/open_questions.py
+++ b/core/tools/open_questions.py
@@ -27,7 +27,7 @@ Subcommands:
   add MILESTONE_DIR SHORT_TITLE
       append a bare block — the wrapper and its one <question> child — whose id is the
       Short Title and whose question text is the body read from standard input; an id an
-      existing block already carries is refused
+      existing block already carries is refused, and so is a Short Title holding a "/"
   strip MILESTONE_DIR [--recommendation] SHORT_TITLE...
@@ -973,6 +973,8 @@ def cmd_add(args):
     short_title = fold(args.short_title)
     if not short_title:
         raise ToolError("the Short Title is empty")
+    if "/" in short_title:
+        raise ToolError(f'the Short Title "{short_title}" contains a "/", which no file name can carry')
     document = load_document(args.milestone_dir)
     wanted = id_key(short_title)
     for question in document.questions:
@@ -1113,7 +1115,8 @@ def build_parser():
         cmd_add,
         "append a bare block whose id is SHORT_TITLE and whose <question> text is the body "
         "read from standard input as UTF-8 (pipe it as a quoted heredoc; a terminal stdin "
-        "is refused); an id an existing block already carries is refused",
+        "is refused); an id an existing block already carries is refused, and so is a "
+        "SHORT_TITLE holding a \"/\"",
     )
```

```diff
--- a/tests/test_add.py
+++ b/tests/test_add.py
@@ -301,3 +301,13 @@ def test_add_leaves_no_temporary_file_behind(run_tool, milestone_dir):
+
+
+def test_add_refuses_a_short_title_holding_a_slash(run_tool, milestone_dir):
+    target = milestone_dir("bare")
+    before = document_of(target)
+    result = run_tool("add", str(target), "tools/README.md headroom", stdin=b"Where is the room made?")
+    assert result.returncode == 1
+    assert result.stdout == b""
+    assert result.stderr == b'Error: the Short Title "tools/README.md headroom" contains a "/", which no file name can carry\n'
+    assert document_of(target) == before
```

What is right about it, and should carry into the milestone:

- **The refusal sits at `add`, the one place a block id is created.** The review pass is the sole author of blocks and already corrects a title against a refused `add`'s `Error:` line, as it does for a duplicate id, so the bad title is stopped where it is chosen, before any agent is spent on it.
- **Only `add` checks.** `load_document` does not validate ids, so a document already holding such a title keeps working with every other subcommand; re-validating on load would stop every tool on a legacy document over one block.
- **The check runs on the folded title**, the same form the tool stores, before the document is read.

## What it left undone

- **CLAUDE.md.** The dispatched-agent return-contracts invariant says a Short Title holding a path separator "fails the write and surfaces as a `FAILED:` skip rather than a silent miss". With the refusal, that becomes the fallback for blocks authored before it, and the refusal's rationale (a permanent skip, not a one-time one) belongs in the invariants, likely also in the open-question-tool invariant beside the duplicate-id refusal.
- **The review pass's Short Title rule.** `core/skills/review-milestone-requirements/SKILL.md`'s Short Title bullet already names the duplicate-id refusal; one clause naming the refused characters lets the author avoid them up front rather than learn them from a refusal.
- **The agent's path-separator clause** in `core/agents/provide-alternatives-to-open-question.md` stays, since it still covers blocks authored before the refusal; the milestone may reword it as the legacy case.
- **The shell-active characters.** Only `/` was refused. `"`, `$`, backtick, and `\` break the double-quoted fixed calls just as surely, and refusing them is the same one-line check.

## Questions for the milestone

- **Which characters are refused.** `/` alone (the file-name failure only); `/` plus the four that are special inside double quotes (`"`, `$`, `` ` ``, `\`), which covers both failures named above; or an allow-list (letters, digits, spaces, and a fixed set of punctuation), which closes the class but refuses titles nobody has shown to break anything. A deny-list follows from the two named uses; an allow-list would also have to be stated in the review pass's rule.
- **Where the rule is stated.** The tool's help text and `Error:` line alone, with the review pass's Short Title bullet naming the refusal as it names the duplicate refusal, or also a rule of what a Short Title may hold in that bullet, so the author writes a valid title the first time.
- **What happens to an existing block that holds one.** Nothing (the agent's `FAILED:` path stays as the legacy case and the question is re-authored by hand), or the review pass, as cleanup, re-authoring such a block under a valid title, which is a `remove` and an `add` it already has the tools for but which this repository's history has never needed.
- **Whether the other handles get the same treatment.** A task's `##` heading is substituted into `--subject "Task-completion: <TASK_NAME>"` in both completion calls and into `submit-task`'s and the task-list tool's title arguments, the same double-quoted position, while its file names are already fixed per run for the slash and double quote the CLAUDE.md task-list rationale records among this repository's headings. No recorded `Task-completion:` subject holds `"`, `$`, backtick, or `\`. The task-list tool's `insert` and `initialize` could refuse the same set, or the milestone could leave titles to the Short Title rule alone.
