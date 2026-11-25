# Mechanical issues

A draft for a mission not yet defined. It gathers the places where the workflow's fixed calls and tools fail for a mechanical reason, apart from any judgment a runner makes: text copied into a position that gives its characters a meaning, a host limit a pass does not know, a print too large to read, a git state a tool cannot commit. It was begun on 2026-11-16 as the Short Title characters draft, around one change: a refusal of `/` in a new Short Title, written and tested in the working tree, then moved here instead of being committed so it can land as a mission. Its first three sections still record that case, the failure, the change as written, and what the change left undone. A survey on 2026-11-25 found the same failure in other handles, paths, and bodies, recorded under `## The same failure elsewhere`, and a read of this machine's run transcripts the same day added failures of other kinds under `## Found in the run transcripts`. The questions the mission decides close the draft, for all three parts. The draft uses the mission vocabulary the word's rename brought (mission, `--mission`), the identifiers in its diff included.

## The Short Title failure

A question block's id is its Short Title, and two places in the workflow use that title as text no character of which may be special.

- **As a file name.** The alternatives agent writes its return to `<scratch dir>/<Short Title>.xml` (through a `.xml.part` name and one `mv`), and the orchestrator's batch call takes the question back from the file name alone. A Short Title holding a `/` names a directory that does not exist, so the write fails. `core/agents/provide-alternatives-to-open-question.md` already says what happens then: the agent creates no directory, keeps the title as given, and returns `FAILED:`. The question is skipped. But its block stays bare, so the next alternatives pass dispatches it again and fails the same way. A slash in a title makes the question permanently unable to get alternatives through the pass, and nothing says why except the agent's `FAILED:` reason in each run's advisory.
- **Inside a double-quoted shell argument.** Every fixed call that names a block substitutes the title into `"<Short Title>"`: the answer sweep's `lift`, `remove`, `--subject "Recommendation-answer: <Short Title>"`, and `printf 'stopped at\t%s\n' "<Short Title>"`; the recommendation pass's `embed --recommendation`, `lift`, and its refusal `printf`; the review pass's `remove` and `add`; the strip calls. Within double quotes `"` ends the argument, `$` and a backtick expand, and `\` escapes, so a title holding any of the four breaks the call or silently changes the argument the tool receives. The calls are run "exactly as shown, with only the placeholders replaced", so a runner is told not to escape what it substitutes.

The trigger was a Short Title of the form `tools/README.md headroom`, a file path written into the handle, which is a natural thing for a review pass to write when the question is about one file. Across this repository's history the 478 distinct block ids hold no `/`, `"`, `$`, backtick, or `\` (one test fixture aside, which exercises XML escaping), so neither failure has hit a recorded mission here.

## The change as written

`cmd_add` refused a folded Short Title holding a `/`, before loading the document, so a refused call leaves the file byte-identical. The module docstring and the `add` help text gained the refusal, the three host copies were rebuilt (`build_hosts.py --check` passed), and one test pinned it. The full pinned suite passed (1590) and the 3.9 floor run passed (1586 passed, 1 skipped, the pinned-only rendering test).

```diff
--- a/core/tools/open_questions.py
+++ b/core/tools/open_questions.py
@@ -26,7 +26,7 @@ Subcommands:
   add MISSION_DIR SHORT_TITLE
       append a bare block — the wrapper and its one <question> child — whose id is the
       Short Title and whose question text is the body read from standard input; an id an
-      existing block already carries is refused
+      existing block already carries is refused, and so is a Short Title holding a "/"
   strip MISSION_DIR [--recommendation] SHORT_TITLE...
@@ -972,6 +972,8 @@ def cmd_add(args):
     short_title = fold(args.short_title)
     if not short_title:
         raise ToolError("the Short Title is empty")
+    if "/" in short_title:
+        raise ToolError(f'the Short Title "{short_title}" contains a "/", which no file name can carry')
     document = load_document(args.mission_dir)
     wanted = id_key(short_title)
     for question in document.questions:
@@ -1112,7 +1114,8 @@ def build_parser():
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
@@ -301,3 +301,13 @@ def test_add_leaves_no_temporary_file_behind(run_tool, mission_dir):
+
+
+def test_add_refuses_a_short_title_holding_a_slash(run_tool, mission_dir):
+    target = mission_dir("bare")
+    before = document_of(target)
+    result = run_tool("add", str(target), "tools/README.md headroom", stdin=b"Where is the room made?")
+    assert result.returncode == 1
+    assert result.stdout == b""
+    assert result.stderr == b'Error: the Short Title "tools/README.md headroom" contains a "/", which no file name can carry\n'
+    assert document_of(target) == before
```

What is right about it, and should carry into the mission:

- **The refusal sits at `add`, the one place a block id is created.** The review pass is the sole author of blocks and already corrects a title against a refused `add`'s `Error:` line, as it does for a duplicate id, so the bad title is stopped where it is chosen, before any agent is spent on it.
- **Only `add` checks.** `load_document` does not validate ids, so a document already holding such a title keeps working with every other subcommand; re-validating on load would stop every tool on a legacy document over one block.
- **The check runs on the folded title**, the same form the tool stores, before the document is read.

## What the change left undone

- **CLAUDE.md.** The dispatched-agent return-contracts invariant says a Short Title holding a path separator "fails the write and surfaces as a `FAILED:` skip rather than a silent miss". With the refusal, that becomes the fallback for blocks authored before it, and the refusal's rationale (a permanent skip, not a one-time one) belongs in the invariants, likely also in the open-question-tool invariant beside the duplicate-id refusal.
- **The review pass's Short Title rule.** `core/skills/review-mission-requirements/SKILL.md`'s Short Title bullet already names the duplicate-id refusal; one clause naming the refused characters lets the author avoid them up front rather than learn them from a refusal.
- **The agent's path-separator clause** in `core/agents/provide-alternatives-to-open-question.md` stays, since it still covers blocks authored before the refusal; the mission may reword it as the legacy case.
- **The shell-active characters.** Only `/` was refused. `"`, `$`, backtick, and `\` break the double-quoted fixed calls just as surely, and refusing them is the same one-line check.

## The same failure elsewhere

Surveyed 2026-11-25, with none of the above landed. The Short Title is one case of a wider class: text an author chose (a title, a heading, a path, a body) is copied verbatim into a position where some of its characters carry meaning. Each entry below was either run against the tools in a scratch repository or counted in this repository's history, as it says. The identifiers are this draft's own.

### Already occurring in this repository

- **BODY, a commit body in `--body "<BODY>"`.** `core/shared/commit-procedure.md` shows the body as a double-quoted argument, so inside it a backtick or `$` expands and a `"` ends the argument. Across the history 62 of the 99 finish commits that carry a body, 28 of 51 `Alternative-answer:` bodies, and 10 of 34 `Manual-answer:` bodies hold a backtick, `$`, `"`, or `\`. The recorded bodies hold those characters, so the runners that made the commits changed the quoting themselves, against a procedure that shows one fixed command. The two completion calls already avoid the position: they capture the bar once from a quoted heredoc in the group-fed form and pass it on as `--body "$bar"`.
- **HEADING, a decision heading in `--section "<Heading>"`.** The answer sweep's `fold` and `replace` take the `###` heading as a double-quoted argument. Tested: `--section` given ``"The readers' `tasks` calls"`` ran `tasks` as a command, exited 0, and created a subsection headed `The readers' calls`, since a heading matching no subsection is created, never refused. A backticked text that names a real command would run it. 15 of the 640 `## Decisions` headings in finished missions hold backticks, and nine sweep answers on 2026-10-30, after the fold tool landed, created such headings intact, so the runner escaped them although the call is to be run exactly as shown.
- **DOT, the `.` separator of the hand-answer skills.** `answer-open-question` and `answer-open-question-with-alternative` split their text on the first `.`, the Short Title before it and the answer after, so a Short Title holding a dot cannot be named to either. Three recorded titles hold one (each opens with `CLAUDE.md`), and so does the trigger of this draft, `tools/README.md headroom`. The extension's two answer lines are built on that form (`<Short Title>. <answer text>`, `<Short Title>. <Alternative Id>`). Its discuss line appends `. <note>` the same way, but `discuss-open-question` states no split and reads the whole rest as the Short Title, so a note reaches it as part of the title.

### Confirmed by test, not yet seen here

- **PATH, the mission path as an unquoted word and one whitespace token.** The mission-definition tool accepted `docs/User Guide` and `app/(dash)/[id]` as scopes. Every fixed call writes `<MISSION_DIR>` unquoted, and `resolve-mission.md` reads the flag's value as the one whitespace-separated token after `--mission`. A space makes the mission impossible to name, parentheses are a shell syntax error, and brackets fail as a glob in zsh. Project paths meet the same position on the commit tool's command line (`<PATHS>` in the commit procedure, `<recorded path N>` in the inline completion call); the completion agent's path file, read line-exact, does not. This repository's scopes hold no such character.
- **OPTION, an alternative's id.** The id is a free-form label the alternatives agent writes, and it lands in `--option "<Option>"`, in the `option` attributes the recommendation pass renders, and in the compact view's `"${pick%% — *}"`, which cuts the lifted line at its first ` — `. Tested: an id `Wait — then decide` is cut to `Wait` and the `lift --alternative` that follows is refused. The refusal at `add` does not reach these ids, which enter the document at `embed --alternatives`. None of the 4,482 recorded ids holds a shell-active character or ` — `.
- **FOLDBODY, a heading line inside a folded decision.** The fold tool writes its body verbatim and reads every column-0 `## ` line as the end of the section. Tested: a decision holding a `## Out of Scope` line left the file with a second section of that name and the decision's last bullet under it, with the next fold landing between the two halves; a `### ` line in a body stands as a subsection of its own; and a body line `## Decisions` would make every later fold refuse the file as holding two. The task-list tool's equivalent, a column-0 `## ` line in a brief, is recorded in CLAUDE.md as accepted.

### Narrow

- **DASH, a title read as an option.** Most titles that open with `-` pass as positional text, but argparse takes a few. `add` given `-h help text`, and the task-list tool's `insert` given `-h Help Text Task`, print the help text and exit 0 with nothing written; `insert` given a title opening `--before=` and `define_mission.py --title` given `-h …` exit 2. No recorded Short Title or task title opens with `-`.
- **EOF, the heredoc terminator.** A body line reading `EOF` ends the heredoc, and the lines after it run as shell commands (tested). The answer sweep, the recommendation pass, and both completion calls already tell the runner to pick a delimiter line the body does not contain. The review pass's `add`, `derive-tasks`' `initialize`, and `submit-task`'s `insert` do not. No recorded body holds such a line.

### Additions to the Short Title case

- **QUOTE-ATTR.** A `"` in a Short Title also breaks a third position, the `question` attribute of a `<depends-on>` the recommendation pass renders by hand. Tested: the fragment is refused as malformed XML, and the pass's prose names only `&` and `<` as the characters to write as entities.
- **Task titles.** DASH applies to a task's `##` heading as it does to a Short Title, beside the double-quoted positions the last question below already names.

### Checked and clear

- The commit tool and the missions tool pass paths to git as literal pathspecs and read its output NUL-separated, so a path's glob characters, spaces, and non-ASCII bytes reach neither as syntax.
- The VS Code extension fills every placeholder through a session environment variable, so no value enters a recipe line's text.
- The tools' tab-separated prints are safe, since every title and question text is whitespace-folded on write.
- The alternatives pass's scan finds a file whose name opens with a dot.

## Found in the run transcripts

Read 2026-11-25 from the Claude Code session transcripts kept on this machine: 6,686 files dated 2026-10-09 to 2026-11-25, covering this repository under both of its names and nine other projects. They hold 15,461 distinct calls of the plugin's tools (11,023 in the nine other projects) and 3,906 agent dispatches. Transcripts older than that are no longer on disk, and no Codex or Antigravity session was read. These entries are mechanical failures of other kinds than the one above, and the last two add run evidence to entries above.

### Failing or costing turns in current runs

- **CAP, the alternatives pass against the host's limit on concurrent subagents.** The Claude Code value of `ALTERNATIVES_CONCURRENCY` sends every dispatch in one message "with no cap beyond one dispatch per surviving question", and the host refuses every dispatch past 20 running at once with `Concurrent subagent limit reached. You can run 20 subagents at once. Do not retry.` 360 dispatches were refused in 41 sessions across nine projects, from 2026-10-12 to 2026-11-24, each of them a run that dispatched more than 20 questions. In 38 of those sessions the runner sent each refused question again later in the run, against the message's own wording and with no step of the pass telling it to; in 3 sessions, 12 questions were not sent again and stayed bare for the next run.
- **BIGREAD, a read larger than the host keeps inline.** A tool print past the host's output limit is written to a file and the runner is shown a preview and the file's path. That happened to 106 of 834 `tasks --with-body` calls (prints from about 30 KB up to 262 KB), 12 of 53 `record .` calls, 12 of 118 runs of the answer sweep's compact view, and 10 of 65 `show` calls. CLAUDE.md leaves `tasks` unbounded until "field runs show the whole print costs too much"; the turns each runner then spent reading the file were not counted here.
- **SEP, a separator the runner writes between two tool calls.** A runner that joins two reads in one shell call writes `echo ====` between them, and zsh reads a word opening with `=` as a command lookup, fails it, and abandons the rest of the line, so the read written after the separator never runs and the call ends with an error status (tested: `echo first; echo ====; echo second` prints `first` and the error only). 153 calls failed that way, 62 of them since 2026-11-01. 74 are the alternatives agent joining its `locate` and its `list --with-question`, which its file shows as two calls: of 1,106 such joined reads, 99 wrote a bare `=` separator. The `=====` separator is recorded in CLAUDE.md as retired from the answer sweep; nothing tells the other runners not to write one.
- **GITRM, a path removed or renamed through git.** Tested: after `git rm b.md`, or `git mv c.md c2.md`, the commit tool's `git add` of the old path exits 128 with `pathspec … did not match any files`, since the index no longer holds it, and the tool repeats it on all 16 attempts over about four seconds, as it would a held lock, before printing the error. A file removed with a plain `rm` commits. One field run met it, on 2026-11-24, where a task that removed a file had its completion refused at the orchestrator's commit-from-file call. Every exit 128 is retried, whatever its cause, because the tool reads no message text.
- **REVISE, no tool call to change a queued task.** The task-list tool initializes, inserts, and removes. Since it became the list's only writer, seven Edit or Write calls and four shell rewrites changed `TASKS_TODO.md` by hand in field runs, most of them a `complete-all-tasks` session rewording a later task's brief after a finding. No hand write of `open_questions.xml` was found.

### Minor

- **TOKEN, a completion agent's final message.** 15 of 1,945 `complete-task` agents ended on neither `DONE` nor `FAILED:`, most of them a turn ended while waiting on a background process. Since 2026-11-18, 58 of 415 `DONE` returns carried a summary above the token, which the return contract rules out; the orchestrator reads the last line only, so the cost is the text it has to hold.
- **XMLTEXT, markup in an alternative's text.** Eight alternatives returns were refused as malformed in field runs, seven for a mismatched tag and one for a raw `<Link>` element in its text, each costing its one repair.

### Run evidence for entries above

- **DOT.** On 2026-11-16 a discuss run started with a note passed `October draw status. Was there a second draw planned?` to `locate` as the Short Title and was refused.
- **HEADING and BODY.** No call ran with a raw backtick. Of 1,076 `fold` and `replace` calls, 15 named a heading holding a backtick or `$`: the runner wrote `\` escapes in 12 and held the heading in a shell variable in 2. Of the commit-tool calls with a body, 1,799 passed it from a captured variable or a file and 146 as a double-quoted literal, 31 of those with escapes the runner wrote. The exposure is therefore carried by each runner's escaping, in calls it is told to run exactly as shown.

### Read and found clean

- No workflow commit was made with a raw `git commit` since 2026-11-01, against 1,523 commit-tool calls.
- None of the fixed calls' guard lines (`stopped at`, `dirty before start`, `acceptance bar empty`, the path-file and body-file lines) was printed in a field run.
- The tools refused about 30 of the 11,023 field calls, nearly all a Short Title or alternative id the caller mistyped.

## Questions for the mission

- **Which characters are refused.** `/` alone (the file-name failure only); `/` plus the four that are special inside double quotes (`"`, `$`, `` ` ``, `\`), which covers both failures named above; or an allow-list (letters, digits, spaces, and a fixed set of punctuation), which closes the class but refuses titles nobody has shown to break anything. A deny-list follows from the two named uses; an allow-list would also have to be stated in the review pass's rule.
- **Where the rule is stated.** The tool's help text and `Error:` line alone, with the review pass's Short Title bullet naming the refusal as it names the duplicate refusal, or also a rule of what a Short Title may hold in that bullet, so the author writes a valid title the first time.
- **What happens to an existing block that holds one.** Nothing (the agent's `FAILED:` path stays as the legacy case and the question is re-authored by hand), or the review pass, as cleanup, re-authoring such a block under a valid title, which is a `remove` and an `add` it already has the tools for but which this repository's history has never needed.
- **Whether the other handles get the same treatment.** A task's `##` heading is substituted into `--subject "Task-completion: <TASK_NAME>"` in both completion calls and into `submit-task`'s and the task-list tool's title arguments, the same double-quoted position, while its file names are already fixed per run for the slash and double quote the CLAUDE.md task-list rationale records among this repository's headings. No recorded `Task-completion:` subject holds `"`, `$`, backtick, or `\`. The task-list tool's `insert` and `initialize` could refuse the same set, or the mission could leave titles to the Short Title rule alone.
- **How far the mission reaches.** The Short Title alone, as first drafted; every handle that is created through a tool call (Short Titles, alternative ids, task titles, mission scopes), where one refusal per entry point closes the case; or the whole class, including the free text (BODY, HEADING, FOLDBODY) that no creation point can refuse because Markdown with backticks is what it is meant to hold.
- **How free text reaches a double-quoted argument (BODY, HEADING).** The commit procedure and the sweep's two sections could capture the text from a quoted heredoc in the group-fed form the completion calls use and pass the captured value on quoted, which changes no tool; the tools could take the text on standard input or from a file, which changes their contracts (the commit tool was deliberately given no body-file option, and `--section` is an argument by design); or the prose could state an escaping rule for the runner, which keeps the commands as shown and puts the correctness in each runner's hands, where it already is.
- **What separates a Short Title from the text after it (DOT).** Refuse a `.` in a new Short Title, which rules out every title naming a file; keep the dot and match the longest listed Short Title the text opens with, which needs no character rule but a `list` call before the split; or change the separator to one a title is refused for holding. The same answer decides whether `discuss-open-question` gains a split for the extension's note or the extension's line drops it.
- **Where a mission path's characters are stopped (PATH).** At definition, the tool refusing a scope that holds whitespace or a shell-active character, which is one check but puts a mission scoped inside such a directory (a route group, a folder named with a space) one level higher; or at each use, every fixed call quoting `<MISSION_DIR>` and the flag's value read by a rule other than the next whitespace token, which touches every call fence and the tests that extract them. Project paths on the commit tool's command line need their own answer: a quoting rule in the commit procedure, or the path-file form for every caller.
- **Whether alternative ids get the Short Title's rule (OPTION).** The same refused set checked at `embed --alternatives`, with ` — ` added because of the compact view's cut; or the cut replaced so that no id is parsed out of a lifted line, leaving only the shell-active characters to refuse.
- **Whether a folded body may hold a heading line (FOLDBODY).** Refuse a column-0 `## ` or `### ` line in a `fold` or `replace` body, which is a stop for the batched call; or accept it as the task-list tool's equivalent was accepted, on the ground that the commit's diff shows it.
- **Whether DASH and EOF are closed or only recorded.** `--` written ahead of the positional arguments in every fixed call, or a leading `-` refused where a title is created; and the delimiter clause added to the three sites that lack it, or left out because their bodies are a sentence or three.
- **How the alternatives pass meets the host's limit (CAP).** The Claude Code value dispatching in rounds of a stated size, as the Codex value already does against `agents.max_threads`, which needs the limit written into the slot although the host can change it; or the pass keeping its one message and gaining a stated step for a refused dispatch, sent again as agents end, which is what 38 of 41 runs improvised.
- **Whether the large reads get a bound (BIGREAD).** A bound in the tool, as `missions` has `--last N`, for `tasks` and `record`; a narrower call at the five readers, which today all take `--with-body` unconditionally; or the print left whole and the cost accepted. The compact view's size follows the question document and has no bound to give.
- **Whether joined reads are shown or ruled out (SEP).** One sentence at the agent's two reads saying they are two calls, or a joined form shown with a separator every shell accepts.
- **What the commit tool does with a path the index no longer holds (GITRM).** Stage only the paths present in the working tree or the index and let the pathspec commit record the staged removal; tell the runners to remove and rename with plain commands; or, separately, stop repeating an exit 128 that no lock caused, which needs the tool to read git's message text, a thing it was built not to do.
- **Whether a queued task can be revised through the tool (REVISE).** A `replace` subcommand rewriting one section's body, as the fold tool gained one; the revision done as a `remove` and an `insert` at the same position, which the tool can already do and no step states; or hand edits accepted for the list as they are for `requirements.md`.
- **Whether TOKEN and XMLTEXT are closed or only recorded.**
