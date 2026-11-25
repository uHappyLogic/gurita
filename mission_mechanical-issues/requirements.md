# Mechanical issues

## Goal

Close every mechanical failure recorded in `ideas/mechanical_issues.md`: the Short Title case, the same failure in the other handles, paths, and free text, and the failures found in the run transcripts. What the draft settles is carried out as written (a new Short Title is refused at `add` alone, on its folded form); every other entry, with the draft's closing questions, is raised as an open question deciding whether and how it is fixed, and a decision may revise a recorded invariant, a tool's contract, or the VS Code extension's lines. The mission is done when every change to a tool or a fixed call is pinned by a test reproducing its failure, CLAUDE.md records each entry's outcome, a fix or an acceptance with its reason, and the draft is deleted from `ideas/`; it makes no plugin or extension release.

## Relevant starting state

### The draft and its state in git

`ideas/mechanical_issues.md` (155 lines) stands in the working tree as a staged, uncommitted addition beside the staged deletion of `ideas/short_title_characters.md`, the 81-line draft commit `f66bcaf8` recorded on 2026-11-16 and the only form of it `HEAD` holds. It has three parts: the Short Title case with its `/` refusal written as a diff, a 2026-11-25 survey of the same failure in other positions (BODY, HEADING, DOT, PATH, OPTION, FOLDBODY, DASH, EOF, QUOTE-ATTR, task titles), and failures read the same day from run transcripts (CAP, BIGREAD, SEP, GITRM, REVISE, TOKEN, XMLTEXT), closed by 17 questions. The refusal exists in the draft only: `core/tools/open_questions.py` and `tests/test_add.py` hold neither the check nor its test. The transcript counts come from Claude Code session files on the maintainer's machine, outside the repository, and the history counts from this repository's log, so no file in the tree reproduces either. Five of the draft's tested failures were run again against `core/tools/` in a scratch repository on 2026-11-25 and are marked as reproduced below.

### Where a Short Title and an alternative id are created

`core/tools/open_questions.py` creates a block id only at `add`, which folds the title's whitespace and refuses an empty title or one an existing block already carries after case folding; no subcommand checks a character of it, and loading a document validates ids only for duplicates. An alternative's id enters at `embed --alternatives`, checked only as non-empty and unique within its block. `lift` prints `<option> — <rationale>`, or with `--alternative` `<id> — <what-it-is>`, the two parts joined by a spaced em dash. Titles are positional arguments and no fixed call writes `--` ahead of them: `add` given a title opening `-h` prints the help text and writes nothing, as does the task-list tool's `insert`, and `insert` given a title opening `--before=` exits 2 (reproduced).

### Positions a Short Title or an id is copied into

The alternatives agent writes its return to `<scratch dir>/<Short Title>.xml` through a `.xml.part` name and one `mv`, its file saying that a title holding a path separator fails the write and is returned as `FAILED:`; the alternatives pass's batch call takes the title back from the file name into a quoted shell variable. Every other fixed call substitutes the title as a literal inside double quotes: the review pass's `add` and `remove`, the recommendation pass's `embed --recommendation`, `lift`, and `printf`, the sweep's `lift`, `remove`, `--subject`, and `printf`, the answer core's `locate` and its `remove` with `--option` and `--undermined`, `lift --alternative`, and the `strip` calls of four files. The sweep's batched call (since 2026-10-18) and `submit-task`'s call each state that every title, heading, and option is written inside double quotes with any `"`, `$`, backtick, or `\` escaped by a backslash; no other site states an escaping rule, so the draft's remark that a runner is told not to escape holds for every site but those two. The sweep's compact view takes the option from the lifted line as `"${pick%% — *}"`, and the two single-question lift paths take RECORDED OPTION as the line's text before its first spaced em dash: an id `Wait — then decide` passed both `embed` forms, was cut to `Wait`, and had its `lift --alternative` refused (reproduced). The recommendation pass renders the `question` and `option` attributes of `<depends-on>` and `<recommendation>` by hand, its prose naming only `&` and `<` as characters to write as entities.

### Free text passed as a double-quoted argument

`core/shared/commit-procedure.md` shows the body as the literal `--body "<BODY>"`, and the skills that follow it by reference with a body pass text they composed or lifted: `finish-mission` its summary bullets, `answer-open-question` its rationale, and the two other single-question answer skills the lifted line. The fixed calls that carry a body pass a captured value instead: both completion calls capture the bar from a quoted heredoc in the group-fed form and pass `--body "$bar"`, the orchestrator passes `--body "$(cat "<scratch dir>/body.txt")"`, and the sweep and the recommendation pass pass `"$pick"` and `"$body"`. The commit tool takes its body only as `--body`, with no standard-input or file form. The sweep's `fold` and `replace` take the decision heading as the literal `--section "<Heading>"` under the sweep's escaping rule, and `fold` creates a subsection for a heading matching none rather than refusing it; `tests/test_sweep_batched_call.py` fills one heading holding characters the quotes must escape, through a helper that applies that rule.

### Body lines read as structure, and heredoc delimiters

`core/tools/requirements.py` writes a `fold` or `replace` body verbatim and reads every column-0 `## ` line as the end of `## Decisions` and every column-0 `### ` line inside it as a subsection heading, checking no body line: a fold whose body held a `## Out of Scope` line exited 0 and left the file with two headings of that name (reproduced). The task-list tool's `insert` likewise writes a body's `## ` or `---` line verbatim, and CLAUDE.md's task-list invariant records the re-parse reading such a line as a heading as accepted. The clause telling the runner to pick a heredoc delimiter line the text does not contain stands at the sweep's batched call, the recommendation pass's batch call, both completion calls, and `define-mission-goal`; the review pass's `add`, `derive-tasks`' `initialize`, and `submit-task`'s `insert` show `<<'EOF'` without it.

### The dot separator of the hand-answer lines

`answer-open-question` and `answer-open-question-with-alternative` split their text on the first `.`, the Short Title before it, and stop on a fixed line when no `.` is found; `discuss-open-question` and `answer-open-question-with-recommendation` read the whole text after the flag as the Short Title. The dot-separated forms are written in `gurita-vscode/shipped_recipes.md` (`<Short Title>. <note>` on the discuss line, `<Short Title>. <answer text>`, `<Short Title>. <Alternative Id>`), in `snippets/GURITA_USAGE.md` with the same three, in `docs/ways-of-using.md` with the two answer lines, and in `gurita-vscode/USAGE.md`. The extension writes each placeholder into its line as a reference to a `GURITA_*` session variable set only in the run terminal's environment (`gurita-vscode/src/placeholders.ts`) and drops an empty `<note>` together with the `. ` before it, so a non-empty note reaches `discuss-open-question` inside the text it reads as the Short Title.

### Mission paths and project paths on a command line

`core/tools/define_mission.py` refuses a scope that is empty, absolute, climbing with `..`, or not an existing directory, and checks no character of it: it accepted `docs/User Guide` and `app/(dash)/[id]` and printed mission paths holding the space, the parentheses, and the brackets (reproduced). `core/shared/resolve-mission.md` reads the flag's value as the one whitespace-separated token after `--mission`, and every fixed call writes `<MISSION_DIR>` unquoted, as the commit procedure writes `<PATHS>` and the inline completion call its recorded paths. The completion agent's path file is read line-exact through `--path-file`, and the commit and missions tools pass paths to git as literal pathspecs. This repository's missions, live and finished, stand at the root, in `ideas/`, and in `gurita-vscode/`.

### The commit tool and a path the index no longer holds

`core/tools/commit.py` runs its guard, `git add -- <paths>`, and a pathspec `git commit`, repeating each git write that exits 128 up to 16 attempts 0.25 seconds apart and reading only the exit status, never git's message. After `git rm b.md` the tool's `git add` of `b.md` exited 128 on all 16 attempts, about four seconds, and ended on `Error: git add exited 128 on all 16 attempts: fatal: pathspec 'b.md' did not match any files`, while a file removed with a plain `rm` committed (reproduced). Its `--remove PATH` option runs `git rm -r` inside the same retry and is passed only by `finish-mission` and `init-mission-base-workflow`. `core/shared/complete-procedure.md` has the runner record each path it creates or edits and says nothing of how a task deletes or renames a file.

### The alternatives pass against the host

The Claude Code value of `ALTERNATIVES_CONCURRENCY` (`scripts/hosts/claude/slots/`) sends every dispatch in one message "with no cap beyond one dispatch per surviving question", the Antigravity value does the same in one `invoke_subagent` call, and the Codex value dispatches in rounds of the session's `agents.max_threads`, 6 when unset. No step of the pass covers a dispatch the host refuses, and the hands-on block in `scripts/hosts/claude/settings.toml` records no limit on concurrent subagents; a question whose file never lands is caught by the closing `list --without-alternatives` call, named in the advisory under `no annotation landed`, and left bare for the next run. The agent's file shows its `locate` and its `list --with-question` as exactly two calls and says nothing of joining them or of a separator between them, while CLAUDE.md records the `=====` separator as retired from the answer sweep. The agent's rendering rule names `&` and `<` as the characters to write as entities, and a file the tool refuses gets one repair.

### Unbounded missions-tool prints

`core/tools/missions.py` bounds one query, `missions --last N`; `tasks PATH --with-body`, `record PATH`, and `show MISSION_PATH` print whole. Five skills run `tasks <MISSION_DIR> --with-body` unconditionally (`finish-mission`, `derive-tasks`, `ask-in-mission-context`, `submit-task`, `discuss-new-task`), `discuss-mission-goal` runs `record .` once per goal conversation, and the completion procedure's past-work read takes `tasks <path> --with-body` and `show` at the runner's discretion. `record .` prints 37,789 bytes in this repository today, covering the missions finished since 2026-11-18. CLAUDE.md's missions-tool invariant records the unbounded `tasks` print as decided, a bound of the tool's own left to a later mission "if field runs show the whole print costs too much". The sweep's compact view prints every block's id and question text and three lines per walked block, its size following the question document.

### The task list's writes and the completion agent's return

`core/tools/task_list.py` has three subcommands, `initialize`, `insert`, and `remove`, and none rewrites a section already in the list; CLAUDE.md records the tool as the only writer of `TASKS_TODO.md`, and no runner's file states a step for changing a queued task's brief. `complete-all-tasks` reads its agent's last line only: `DONE`, `FAILED:`, or neither, the last stopping the run on `Task run stopped — a task agent returned no status.`. The agent's file rules out any payload above the bare `DONE`.

### Tests and the build

`tests/` holds one flat file per subcommand or concern of the tools, and four fixed-call tests that extract a fence from the rendered `hosts/claude` tree and run it under bash: the sweep's compact view, the sweep's batched call with its conflict section, the inline completion call, and the agent's step-5 call with the orchestrator's commit-from-file call. No test extracts the recommendation pass's batch call, the alternatives pass's batch call, the review pass's `add` and `remove`, the calls of `derive-tasks` and `submit-task`, or the commit procedure's command; `host_tests/`, run on demand per host, drives `derive-tasks` and `submit-task` through an installed CLI. `tests/test_fixed_console_lines.py` checks the 87 rows of the `## Fixed console lines` table in `docs/skill-reference.md` against every rendered host tree, so a new fixed line needs a row. A change under `core/` or `scripts/hosts/` is committed with the three rebuilt `hosts/` trees, and the extension's lines and placeholder filling are covered by node:test files under `gurita-vscode/src/test/` and pytest files under `gurita-vscode/runner_tests/`.

### Recorded invariants the entries meet

CLAUDE.md's `## Invariants to preserve when editing skills` records as decided several behaviours the draft's entries question. The dispatched-agent return-contracts invariant has a Short Title holding a path separator surface as a `FAILED:` skip; the task-list invariant accepts a column-0 `## ` line in a body and fixes the completion files' names per run because recorded headings hold a slash and a double quote; the fold-tool invariant keeps `--section` a required argument, the body opaque, and every refusal a stop for the batched call. The committing invariant has the commit tool retry on exit 128 alone, read no message text, and gain no body-file option; the shell-commands invariant has each fixed call run exactly as shown with only its placeholders replaced; the mission-resolution invariant takes the `--mission` value verbatim as the token after the flag; and the missions-tool invariant leaves the `tasks` print unbounded.

### The record and what is in flight

No other live mission's scope overlaps this one's: `live` lists this mission alone. The overview lists nine missions finished since 2026-11-18, the earliest record the missions tool reads; six stand under `gurita-vscode/`, the latest, `gurita-vscode/mission_tracker-improvements-and-next-release/`, finished on 2026-11-25 and followed by `Extension-release: 0.3.0`. The plugin stands at 2.0.0, released on 2026-11-18, and the extension at 0.3.0, published with `shipped_recipes.md` bundled into its package, so a changed recipe line reaches installed copies only with a later extension release. The decisions of missions finished before 2026-11-18 are read by no query and reach this mission through CLAUDE.md's invariants.

## Decisions

### Short Title refused characters

The open-question tool's `add` refuses, beside `/`, a new Short Title whose folded form holds `"`, `$`, a backtick, `\`, or any control character (C0 and DEL). The fixed calls stay as shown and gain no escaping rule for a new title: the one check at the point a title is created closes the file name, the double-quoted shell argument, and the control character that leaves the document unreadable, and it refuses no title a person would write.

### Existing invalid Short Titles

No runner acts on an existing block whose Short Title a new `add` would refuse. The check runs at `add` alone: `load_document` keeps validating ids for duplicates only, the review pass gains no rule for such a block, and the alternatives pass dispatches it as it does any bare block. The alternatives agent's path-separator clause stays, reworded as the case of a block authored before the refusal, so a `/` title keeps ending in a `FAILED:` whose reason names the separator in each run's advisory. Re-authoring is left to the operator, who runs the open-question tool's existing `remove` and `add` with a valid title, the document never edited by hand; the plugin ships no migration for a form an earlier copy left.

### Task title characters

The task-list tool refuses a new task title holding `"`, `$`, a backtick, or `\` at both points where a title is created: `insert`'s title argument (`submit-task`) and every heading `initialize` reads from its heredoc (`derive-tasks`). Each refusal is one `Error:` line naming the character, with the file left unchanged, and the help text states the refused set. The completion calls, the completion procedure's `remove`, and the orchestrator's `--subject` stay as shown, with no escaping rule added; `submit-task` keeps its existing rule for the anchors it names. Sections already standing in a list keep their headings.

### Commit body quoting

The commit procedure's shown command changes to the form the completion calls already use: the body is captured once from a quoted heredoc in the group-fed form `{ body="$(cat)"; } <<'EOF'`, under the clause telling the runner to pick a delimiter line the text does not contain, and passed on as `--body "$body"` in the same shell call. A caller with no BODY leaves out both the capture and `--body`, as it leaves out `--body` now. The commit tool and its contract stay unchanged. Every caller following the procedure by reference (`finish-mission`, `answer-open-question`, the two lift-based answer skills, `capture-mission-principle-updates`) gets the form through the procedure with no edit of its own, and the fixed calls that already pass a captured value keep their calls. The new command is pinned by a test that extracts it from the rendered tree and runs it on a body holding a backtick, a `$`, a `"`, and an apostrophe.

### Decision heading quoting

Each section of the answer sweep's batched call captures its decision heading once from a quoted heredoc in the group-fed form the completion calls use for the bar (`{ heading="$(cat)"; } <<'EOF'`, the heading on the one line inside) and passes it on as `--section "$heading"` to `fold` or `replace`. The runner escapes nothing in the heading, and the delimiter clause covers the new heredoc. The fold tool, its required `--section` argument, and its contract stay unchanged, and the batched-call test fills a raw backticked heading through the new form.

### Answer text separator

The separator between a Short Title and the text after it becomes the first `.` followed by whitespace, not any `.`, so `CLAUDE.md wording. answer` splits after `wording`. `add` refuses a new Short Title holding a `.` followed by whitespace or ending in `.`. The parse steps of `answer-open-question` and `answer-open-question-with-alternative` and their no-separator fixed line, with its `docs/skill-reference.md` row, are reworded to the dot-space form. Every recipe and usage line, already written as `<Short Title>. <…>`, stays byte-identical, so dotted file names stay legal in titles and the installed extension keeps working with no release.

### Mission path characters

The mission-definition tool refuses, after normalization and before it creates anything, a scope holding whitespace or any character a shell reads as syntax in an unquoted word in bash or zsh: `"`, `'`, a backtick, `$`, `\`, `(`, `)`, `[`, `]`, `{`, `}`, `*`, `?`, `;`, `&`, `|`, `<`, `>`, `!`, and `~`, `#`, or `=` opening the scope. The refusal is one `Error:` line naming the scope, pinned by one test, and every other character is accepted. The fixed calls keep writing `<MISSION_DIR>` unquoted, `resolve-mission.md` keeps reading the flag's value as the one whitespace-separated token, and the extension's lines are unchanged. A mission already defined under such a scope is left as it stands.

### Alternative id characters

`embed --alternatives` refuses an alternative whose id holds `"`, `$`, a backtick, or `\`, a fixed set of the id's own, checked independently of whatever `add` refuses in a Short Title; a slash stays legal because an id names no file. The check runs at embed only, so ids already in a document stand and loading a document checks no id character. The alternatives agent's rendering rule names the four characters as ones an id may not hold, so a refusal does not spend the return's one repair. No call site gains an escaping rule.

### Lifted line option cut

`embed --alternatives` refuses an `<alternative>` whose id, after the tool's whitespace folding, holds ` — `, with one `Error:` line naming the id and the document unchanged, pinned by a test in the embed suite that reproduces the `Wait — then decide` case. `embed --recommendation` needs no check of its own, since its option must already name one of the block's ids. The three parse sites (the compact view's `"${pick%% — *}"`, the sweep's option taken as a literal from that print, and RECORDED OPTION in `answer-with-recommendation-procedure.md` and `answer-open-question-with-alternative`) and `lift`'s joined line stay exactly as they are. Ids already embedded are left as they stand, and the alternatives agent's rendering rule is not changed for this refusal, so an agent that writes such an id spends its one repair on it. CLAUDE.md records the refusal and its reason.

### Folded body heading lines

The fold tool refuses a `fold` or `replace` body holding a column-0 `## ` or `### ` line, with the file unchanged, which is a stop for the answer sweep's batched call. The answer core's fold step, the one home of a decision's content rules that the sweep already draws on, gains one sentence that a folded decision or rewritten entry holds no column-0 `## ` or `### ` line, so every runner, the three single-question skills' Edit-based fold included, writes it right the first time. CLAUDE.md's fold-tool invariant records the refusal, and the answer-procedure rule records where it lives.

### Leading dash in titles

The open-question tool's `add` refuses a new Short Title whose folded form opens with `-`, and the task-list tool refuses a new task title opening with `-` at both points where a title enters the list: `insert`'s title argument and every heading `initialize` reads from standard input. Each refusal is one `Error:` line with the document unchanged, pinned by a test per creation point. No fixed call changes: titles stay positional with no `--` written ahead of them, and option values (`--before`, `--after`, `--option`, `--undermined`, `--alternative`) stay as they are written now.

### Heredoc delimiter clause

The clause telling the runner to pick a delimiter line the text does not contain is added, in the wording the other sites already carry, at the three sites that lack it (the review pass's `add`, `derive-tasks`' `initialize`, and `submit-task`'s `insert`) and at the one other heredoc without it, the second heredoc of the `complete-task` agent's step-5 call that writes the path file, whose existing clause covers only the bar heredoc. Every heredoc the plugin shows then states the rule. The fences stay unchanged, so no fixed-call test is added, and CLAUDE.md records the entry as fixed by the clause at every heredoc site.

### Concurrent dispatch limit

The Claude Code value of `ALTERNATIVES_CONCURRENCY` keeps its one uncapped message and gains a stated step: a dispatch the host refuses for its concurrent-subagent limit is held as pending, despite the refusal message's "Do not retry", and each time the run wakes with an ended agent it sends one held question again per agent that ended, the resent agent's file landing like any other for the next batch call. No number is written into the slot value, so the step keeps working if the host changes its limit. The Antigravity and Codex values and `core/` stay unchanged.

### Completed-task read size

The missions tool's `tasks` query gains a flag that prints every task line but the bars of only the N newest tasks (for example, `--with-body --bodies N`). An older task prints as its title line alone, the form a commit with no body already takes, so one parser reads the result. All five readers (`finish-mission`, `derive-tasks`, `ask-in-mission-context`, `submit-task`, `discuss-new-task`) pass one literal N in their fixed call, so every completed task's title stays in front of every reader and the duplicate checks stay complete while the cost of the bars is capped.

### Project record read size

The missions tool stays unchanged, and `discuss-mission-goal` replaces its `record .` with the two-tier read the starting-state procedure already uses: one fixed, unconditional `missions .` overview (one line per mission, its state, date, path, and title), then, at the runner's discretion, `summary` on a mission whose line bears on the goal, or `record <path>` on the directory the goal concerns once the placement is in view. The unconditional read thereby drops to one line per mission while still naming every mission recorded.

### Mission document read size

The whole print is accepted. `show MISSION_PATH` stays exactly as it is, printing the mission's `requirements.md` whole, and its three callers (the starting-state procedure's deeper read, the review pass's discretionary follow-up, and the completion procedure's past-work `show`) keep their commands unchanged; a print past the host's inline limit keeps landing in the host's file for the runner to read. CLAUDE.md's missions-tool invariant records the acceptance with its reason, as it records the unbounded `tasks` print: the print is bounded by one document and taken only at a caller's discretion, and the starting state it carries is the as-of its decisions are read back with, so a narrower print would cut context the read is taken for.

### Compact view size

The whole view is accepted. The compact view stays exactly as step 1 of the answer sweep shows it: one fixed shell call printing `list --with-question` for every block and then, per walked id, the id, its lifted line, and its picked alternative's what-it-is, with no change to the open-question tool, the call, or the skill's prose. A print past the host's inline limit keeps going to the host's file, read by the runner as it chooses. CLAUDE.md records the acceptance and its reason beside the answer sweep invariant: 12 of 118 field views spilled, the size following the question document, and every walked question's text and pick is needed to compose its section, so the view has no bound to give.

### Joined read separators

The fix reaches the alternatives agent alone. The agent's file replaces its two shown commands with one fixed shell call, run exactly as shown with only `<MISSION_DIR>` and the Short Title replaced, that runs `locate` and then `list --with-question` with a separator every shell accepts between them (a quoted `printf` line). A new fixed-call test extracts that fence from the rendered tree and runs it, reproducing the separator failure under zsh. The open-question tool is unchanged, and every other runner is left as it is.

### Removed path commit

The commit tool changes and the completion procedure gains one sentence. In `core/tools/commit.py`, ahead of the path-scoped `git add`, the tool asks git which named paths the working tree or the index still holds, through a read with optional locks off as the guard already does. It runs `git add` over those paths only, skipping the add when none is left, and keeps every named path in the commit's pathspec. A path that `git rm` or `git mv` already took out of the index is then recorded as the staged removal it is, which the pathspec `git commit` already matches against `HEAD`. A path that git knows nowhere, such as a mistyped one, still reaches the commit's pathspec and is refused there with git's exit 1. The tool's contract text changes accordingly, and a new test in the commit-tool suite reproduces the `git rm` and `git mv` failure and pins that it now commits. The completion procedure's "Record the paths you touch" sentence is widened from creating or editing to deleting and renaming: the runner records a deleted file's path, and both the old and the new path of a renamed or moved file. Runners may use `git rm`, `git mv`, or plain `rm` and `mv` alike. No call shape, path-file format, or `--remove` use changes.

### Queued task revision

The task-list tool gains a `replace` subcommand, `python3 {{PLUGIN_ROOT}}/tools/task_list.py replace <MISSION_DIR> "<Task Title>"`, which rewrites the body of the one section whose title it matches exactly after whitespace and case folding, the new body on stdin as a quoted heredoc, keeping the section's heading, its position, and its `---`, and refusing an unmatched or shared title or an empty body with the file unchanged, as the fold tool's `replace` rewrites one subsection. The title cannot change. The completion procedure gains a stated step allowing its runner, after a finding, to rewrite a later queued task's brief through that one call, and the revision rides in the running task's `Task-completion:` commit, `TASKS_TODO.md` already being on the agent's path file and in the inline call's pathspec. CLAUDE.md's task-list invariant names the fourth subcommand and keeps the tool the list's only writer, and a new `tests/` file pins the subcommand.

### Agent return without token

The `complete-task` agent's file gains one host-neutral rule aimed at the recorded cause, beside its return protocol: run every command the procedure needs in the foreground and wait for it within the call, never end a turn while a process it started is still running, and end the session only on the `DONE` or `FAILED:` line. The shared completion procedure, which the inline skill also follows, and `complete-all-tasks` stay unchanged, so a return without a token still stops the run on its existing line, which remains the fail-safe for what still slips through.

### Summary above done token

The `complete-task` agent's file changes in its `## Return protocol` section only. The return changes from "exactly one of these as the final line" to a final message that is exactly the one line and nothing else, `DONE` or `FAILED: <reason>`, matching how the alternatives agent's file words its own return ("the bare token `DONE` as your final message and nothing else", with any remaining thinking done in an earlier turn). No sentence is added at step 5. `complete-all-tasks` keeps reading the last line only, so its verdict and its no-status stop stay as they are. CLAUDE.md records the entry as fixed by this rewording. No tool and no fixed call changes, so no test is added.

## Out of Scope

