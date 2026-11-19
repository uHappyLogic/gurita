# VS Code extension draft revision

## Goal

Revise `ideas/vscode_extension.md` so that it carries the ideas of the 2026-11-19 conversation recorded in `ideas/vscode_extension_improvement_transcript.md` and settles the draft's ten "Questions for the work". Each transcript idea is decided through the mission's open questions as adopted, refined, or dropped, and the draft's "The constraint" and "Decided" sections may be rewritten where a decision requires it. The finished file is still a design draft, with no extension code written: adopted and refined ideas are written into its sections, each dropped idea is listed with a one-line reason, any unknowns the decisions leave are listed as questions, and the transcript file is removed.

## Relevant starting state

### The draft

`ideas/vscode_extension.md` is a 130-line design draft written 2026-11-17 and last changed on 2026-11-18, when the rename mission carried the Gurita name and the `docs/ways-of-using.md` path into it; outside this mission only the transcript refers to it. Its sections, in order, are The hand work, What was measured, The constraint, The parts (Recipes, Question view, Mission list), Running a line, What was checked of VS Code, Kepala, What it costs, What waits, Decided, Questions for the work, and Sources. "The constraint" says the extension runs the command lines a person would type through the host's own CLI and writes nothing under a mission directory, with four consequences (manual use unchanged, no plugin change, nothing recorded on its own, three files read for display), and the Recipes part says the extension holds no model name, effort level, host flag, or skill order of its own. "Decided" holds two entries dated 2026-11-17: a run lives no longer than the editor, and no local server. The draft has no list of ideas considered and dropped.

### The draft's ten questions and its VS Code check

"Questions for the work" lists ten, each with its options written out: where the extension lives (its own repository, or a directory here outside `core/`), what a recipe file is (the ways-of-using page parsed, or a data file), whether a recipe is only a list or may carry a bounded repeat ending on the convergence line, how a headless line runs and how its outcome is read (shell integration, a child process, or a runner started as the terminal's process; the plain print or a host's structured output), what a runner needs, where the live state comes from (the installed `missions.py`, or a glob of the discovery pattern), what renders the question document (a reader inside the extension, or a tool-side render), which hosts' lines ship, where it is published, and its name. None is answered anywhere in the repository. The VS Code check is dated 2026-11-17 against the installed 1.143.0 and covers the custom editor claimed by a file-name glob, publishing, terminal persistence, shell integration, and terminals and tasks backed by a process; it states the side-bar tree and publication outside the Marketplace as not checked, and it names no pane other than the custom editor.

### The transcript

`ideas/vscode_extension_improvement_transcript.md`, 116 lines, was committed on 2026-11-19 (`13a76591`): a speech-to-text transcript of the maintainer and a collaborator, corrected against the repository, with the passages that could not be recovered marked `[unclear: …]`. Much of what it describes the draft already holds: a block of lines as one button, the answer and discuss buttons on a question, and an interactive line handed to a terminal with the mission's path filled in. What it adds is a new-mission button that takes a goal and opens `discuss-mission-goal` in a terminal; one pane with a page per mission that knows the mission's state; `complete-all-tasks` carried out mechanically by the extension, calling `complete-task` task by task under the model, host, and effort chosen for each task; and state kept in the project that assigns models automatically. It also records how the maintainer works (most questions screened by their heading alone, disagreements recorded with `answer-open-question-with-alternative` and `answer-open-question` used rarely, the first run and then execution for the easiest work, one requirements iteration for harder work, a third about once a month) and the reasons given (a host gives two usable layers, an agent and its subagents, so what orders the skills sits outside it; VS Code supplies the terminal and git integration an application of its own would have to build; the extension is an experiment that a deeper integration or such an application may follow). In it the collaborator takes on renaming the plugin inside the snippet file through a pull request.

### The snippet file

The file the draft calls "a personal snippet file, untracked" has been tracked since 2026-11-18 as `snippets/GURITA_USAGE.md` (added as `snippets/CAIRN_USAGE.md` in `d88c0bcb`, renamed in `01ff048c`), 178 lines, and the transcript names it by that path; `CLAUDE.md`'s layout, the README, and the docs pages do not mention the `snippets/` directory. It holds a Claude Code heading and an Antigravity heading and none for Codex, with the blocks the draft lists and, beyond them, an Antigravity install block, a mixed-host requirements review, an `agy models` line, and a `git log` one-liner that lists every mission chronologically. Its placeholders are `<mission_path>` and, on the two single-task lines, `<Task Title>`. Its title still reads "Cairn CLI usage snippets" and its install block names `cairn` and the former checkout path.

### The ways-of-using page

`docs/ways-of-using.md` holds eight chains, one heading each (setting up a project, starting a mission, answering the questions that matter to you, a mixed-agent requirements review, a stuck mission, executing tasks, preparing another mission while one runs, finishing), each one fenced `sh` block of complete invocations, under a notation section that defines the six placeholders the draft names. Every line is headless, so the page holds no interactive line and no line for a conversational skill, and its lines are Claude Code's but for one `agy` review line, with a legend for moving a line to another host. No chain calls `complete-task` and `<Task Title>` is not among the placeholders. The execution chain carries `#` comment lines for the usage-window wait, and the mixed-agent review is repeated by hand until the review reports convergence.

### The fixed console lines

The `## Fixed console lines` table of `docs/skill-reference.md` holds 87 lines today (16 success, 25 no-op, 45 stop, and the one convergence verdict), not the 94 the draft counted on 2026-11-17: the commits of 2026-11-18 removed seven. `tests/test_fixed_console_lines.py` checks each line against every rendered host tree, and no skill sets an exit code.

### Task completion as the skills stand

`complete-all-tasks` is one invocation under one model and effort: per task it re-reads the list for the top section, checks the scope gate, dispatches the `complete-task` agent with the task's heading, the mission directory, and a scratch directory, and commits the task from the body file and path file the agent wrote, under `Task-completion: <Task Title>` with the verified bar as the body. No dispatch names a model: the agent files carry no `model` key and no host's dispatch wording passes one, so the plugin assigns no model per task. The inline `complete-task --mission <path> <task name>` skill completes one named task in its own run, checks the scope gate itself, makes the same commit itself, and ends on `Task completed.`, or on a fixed stop line when the name matches no section or the gate is closed; the snippet file already runs it as a headless single-task line on both of its hosts. A task section is a title and a brief of one to three sentences (`core/shared/task-format.md`), with no field for a model, a host, an effort, or a kind of work, and the list's order encodes dependency.

### Mission state as it can be read

No file stores a mission's state. `missions.py live` prints each live mission's path, `started` or `defined`, and title; the open-question tool's `list` prints the open questions and, under `--without-alternatives` and `--without-recommendation`, those lacking a set or a pick; the `##` headings of `TASKS_TODO.md` are the remaining tasks; and `ideas/kepala.md`'s state diagram names the finer states (Scoped, Open, Annotated, Recommended, Swept, Converged, Listed, Done), read from the last run's fixed first line. Both tools run from the plugin's installed copy, which stands at the fixed `~/.gemini/config/plugins/gurita` on Antigravity and is found through `<cli> plugin list --json` on Claude Code and Codex, as `host_tests/conftest.py` finds it; the same file reads each host's structured output (`--output-format stream-json`, `--json`).

### The sibling drafts

`ideas/kepala.md` outlines, with nothing decided, an orchestrator in its own repository that runs the skills through the CLI, and holds that state diagram and a table of stop lines with the move for each; the draft's Kepala section calls its runner that transition engine with a person choosing the edge. `ideas/benchmark.md`'s "Model strategies" assigns one model and one effort to each message of a delivery, keyed by the message, with its reference strategy written from the usage snippets, so `complete-all-tasks` gets one pair there as well and no draft assigns a model per task. `ideas/gurita.md` records the rename, released as 2.0.0 on 2026-11-18, and the direct registry lookup its first collision check lacked, and `ideas/short_title_characters.md` records the Short Title quoting failure the draft cites, for a mission not yet defined. Both naming drafts list what they ruled out in a "Checked and rejected" table with a one-line reason per entry, and those three drafts each end on a list of open questions ahead of any sources.

### The draft's measurements against today

"What was measured" is dated 2026-11-17, and beside the fixed-line count two of its figures have moved. One mission is live today, this one, where the draft counts two. The answer commits now number 662 `Recommendation-answer:`, 28 `Alternative-answer:`, and 32 `Manual-answer:`, so 60 of 722 answers (8%) were made by hand, against the draft's 57 of 679. The question-document sizes were not measured again.

### The record and what is in flight

The path-form record holds two finished missions, both root-scoped: `mission_rename-cairn-to-gurita/` (2026-11-18), which renamed the plugin at every identifier site, moved the usage page to `docs/ways-of-using.md`, and recorded the rename in the idea drafts, and `mission_ascii-art-arms-banner/` (2026-11-19), which changed nothing under `ideas/`. Neither decided anything about the extension. No other mission is live, so nothing in flight overlaps `ideas/`.

## Decisions

## Out of Scope

