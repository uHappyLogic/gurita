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

### Extension repository home

The extension's code lives in this repository, in a directory outside `core/` that is rendered into no host tree. Its build and tests run as steps of the existing one-job drift-gate workflow, among them a check of the extension's fixed lines against the `## Fixed console lines` table of `docs/skill-reference.md`, so a plugin change that moves a fixed line the extension relies on fails CI in the same commit. While the extension is an experiment it is not released beside the three host trees: it is packaged from this repository as a VSIX and installed by hand. The draft's first question for the work is settled this way, and the draft states it.

### Per-mission pane

The draft adopts the 2026-11-19 conversation's pane as stated: one pane in the editor area holding one page per live mission, with a way on the pane itself to move between missions, each page showing that mission's state, its open questions, its remaining tasks, and every button, the per-question ones included. The pane replaces both the side-bar tree of missions and the custom editor: the extension contributes no tree and claims no file, so `open_questions.xml` opened from the explorer shows its XML text. One surface then carries everything the tree and the editor were for, the least to build for an experiment, and the pane rests on `window.createWebviewPanel`, which stands in the installed 1.143.0 API definitions.

### Conversation reasons record

The revised draft records all three reasons the 2026-11-19 conversation gives for the extension, together, in one new section of its own (for example "Why an extension"), placed after "The hand work" and before "What was measured", dated 2026-11-19 and attributed to the conversation. Each is written as the conversation gives it: a host offers two usable layers, an agent and its subagents (with the conversation's own hedge that a third layer works, but strangely), so what orders the skills sits outside the host; VS Code supplies the terminal and git integration an application of its own would have to build; and the extension is an experiment that a deeper host integration or such an application may follow. No other section is changed for them: the case is read whole in one place and survives the transcript's removal.

### Recipe bounded repeat

A recipe is only a flat, ordered list of command lines with placeholders, run once per click: the recipe format has no repeat construct and the button no repeat option. A further requirements iteration is the person clicking the same recipe again after reading how the last run ended, which the extension shows. The draft records the bounded repeat among its dropped ideas with a one-line reason: the maintainer screens the questions between rounds and stops by judgment, never on convergence, so a repeat would run unscreened exactly the rounds the maintainer chooses to screen.

### Headless line execution

The extension runs a chain under a runner process started as a terminal's own process, through `TerminalOptions.shellPath` and `shellArgs` with an argument list and `isTransient` set, or through a task's `ProcessExecution`, which gives the same process. The runner starts each headless line of the chain itself, reads its output through a pipe, and decides whether to go on; an interactive last line inherits the terminal. The run stays in view in a real terminal while stopping a chain rests on nothing a person's shell setup can switch off, and the chain logic lands in one part a person can start by hand outside the editor.

### Live state source

The extension ships its own byte-identical copy of `missions.py`, found by the extension's own path, and runs its `live` query with `python3` for both the live list and `started` or `defined`; no installed plugin is looked up. The copy is pinned to the plugin version the extension is built against, so the state comes from the plugin's own tested definition of the discovery pattern and the started test, with no per-host install lookup and no setup step.

### Question document renderer

The extension reads `open_questions.xml` itself, in its own language and in process, with an XML parser of its own written against the document format the open-question tool's module docstring states, and builds the question view and its buttons from what it parses. The plugin is unchanged, with no new subcommand, output form, or tool, and the extension calls no plugin tool to draw the view. The view then shows everything a block holds, the advantages, drawbacks, dependencies, and principles included, and a redraw after a run costs one file read with no process started.

### Moved draft facts

The revision corrects in place only the present-tense descriptions that are now wrong, chiefly the snippet file in "The hand work", which is no longer personal and untracked but the tracked `snippets/GURITA_USAGE.md` with two placeholders. The dated measurements (the fixed-line count, the live-mission and answer counts, the cost figures) are left as written, their 2026-11-17 date marking them as that day's record, and nothing is measured again.

### Settled choice record form

Every choice this mission settles, each of the ten former questions and each adopted or refined idea alike, is recorded in the draft twice. The section it bears on (The constraint, Recipes, Question view, Mission list, Running a line, Kepala, What it costs, and the rest) is rewritten to state the design as chosen, and a bulleted entry naming the choice and its reason is added to the draft's Decided section under a new "Decided on 2026-11-19." line beside the existing 2026-11-17 one. Each settled question is removed from "Questions for the work".

### Mission page state

The page tells apart only what the documents hold now: `started` or `defined` from `missions.py live`, whether any question lacks alternatives or a pick (the open-question tool's `list` with `--without-alternatives` and `--without-recommendation`), whether the question list is empty, and whether tasks remain (the `##` headings of `TASKS_TODO.md`). It reads no run's output and no commit subject, so every fact is re-read from the project on each refresh and the extension keeps no memory of its own runs; the finer states `ideas/kepala.md` names are not told apart. The state is shown as a label on the page only: every recipe button stays offered whatever the label reads, and the skills' own stop lines stay the only gate.

### Heading-first question screening

The question view shows each question collapsed by default to one row holding its Short Title and the id of its picked alternative, with no pick shown when it carries none. The question-level buttons (discuss, answer in the person's own words, record the recommendation) stand on the row; opening the row shows the question whole as the draft describes, with the alternative buttons inside it, and the view carries expand-all and collapse-all controls. The draft's Question view part is rewritten to say so.

### Run outcome reading

The extension runs each headless line exactly as the recipe writes it, with no output flag added, and reads only the run's plain print: the first line of the final message is looked up in the `## Fixed console lines` table of `docs/skill-reference.md`, a success or no-op line continuing the chain and a stop line, or any line the table does not hold, stopping it. The process's exit code is not read, and nothing tells a host-level failure apart from an unlisted line. What Codex's plain print opens with stays to be checked.

### Runner language and home

The runner is one stdlib-only Python file (Python 3.9+, no `uv`, no third-party package) bundled in the extension's own package and started by the extension as the terminal's process: `python3` with the file's path under the extension's install directory and the chain's lines as arguments. The extension finds it by its own path, so the plugin gains nothing and no installed plugin location is looked up, and the runner stays a plain script a person can start by hand outside the editor.

### Chain shell session

A chain runs as one shell session started for that run, so a recipe's shell step of the person's own (sourcing an environment file, calling a shell function such as the snippet file's `claude-wait`) takes effect for every line after it. A substituted value (`<path>`, `<Short Title>`, `<Alternative Id>`, `<goal>`, `<scope>`, `<answer text>`) never enters the line's text: the extension puts it in the session's environment when it starts the session, all of a chain's values being fixed when its button is clicked, and writes the placeholder into the line as a variable reference suited to the placeholder's quoting (as is inside a double-quoted prompt, and on a Codex line by closing and reopening the single quotes around it), which the shell expands without parsing what the value holds. No character is refused or escaped.

### Extension-run task loop

The draft adopts the task loop in a refined form. The extension carries out the loop itself (the top remaining heading re-read before each run, one `complete-task` line per task, a stop on any first line other than `Task completed.`), but as an execution recipe of its own beside the unchanged `complete-all-tasks` line, which the execution recipes keep, so a uniform run loses nothing and each task of a looped run can go under its own host, model, and effort with the plugin unchanged. "The constraint" and the Recipes part are amended to name the loop's order as the one order the extension holds.

### Per-task model assignment

When tasks are run one at a time, each task's host, model, and effort come from rules kept in a tracked project file outside every mission directory. The rules map patterns over a task's title and brief text (keywords or regular expressions, for example "model generation" or "animation") to a host, model, and effort, with a default profile for tasks no rule matches. The extension evaluates them before each task, shows the resulting assignment, and lets the person override a task for the current run only, the override kept nowhere. The extension writes nothing for it, and neither the plugin nor the task format changes.

### Kepala boundary

The ordering the extension does itself, the task loop alone, sits in the part the draft already keeps apart from the VS Code interface, beside the recipes, the fixed-line reading, and the state read. The Kepala section is rewritten so that the runner walks only the `Listed` self-loop, task by task, with the person choosing every other edge, the review repeated after its verdict line included. Whether Kepala reuses that part stays Kepala's question, as the section says today.

### Per-task line composition

A task run under a host, model, and effort chosen for it uses one of the recipe file's own single-task lines. The recipe file holds complete single-task lines, one per host, model, and effort combination wanted, each under a name of its own and each in the form the snippet file already has (`claude -p "/gurita:complete-task --mission <path> <Task Title>" ... --model "opus" --effort xhigh`, `agy -p ... --model "claude-opus-5-5" --effort high`). A task's chosen combination is a reference to one of those names; the extension picks the named line and fills only `<path>` and `<Task Title>`. It composes no line and holds no host flag, model name, or effort level, so on this point "The constraint" and the Recipes part stand as written.

### Publication venue

While the extension is an experiment it is published to no registry and no release page: it is packaged as a VSIX and installed by hand into the maintainer's own editor, and anyone else who wants it builds it from source. No publisher account, token, or publish step joins the release of the three host trees, so no publisher id or extension name is reserved for good before the experiment has proved out. The draft records registry publication as deferred, not ruled out, to be decided once the experiment is judged.

### Shipped recipe source

The extension's shipped recipes are the blocks of `snippets/GURITA_USAGE.md`, each recipe read as one of its `###` headings and that heading's fenced block. The file is first made a maintained, shipped document: its title and install block are brought to the Gurita name and checkout, its `<mission_path>` placeholder becomes `<path>`, and its personal lines (the `.env_anthropic` source, `claude-wait`) are either kept as shell steps or moved out. `docs/ways-of-using.md` stays separately written, with no generation from and no check against the snippet file.

### Further VS Code checks

This mission checks only the surfaces its recorded decisions rely on: the pane form the draft adopts, the side-bar tree only if the draft keeps it, and a fork registry only if the draft publishes to one. Each such surface is read from the VS Code documentation, confirmed against the installed 1.143.0 `vscode.d.ts` for API facts, and recorded as a dated entry in "What was checked of VS Code". A surface no decision relies on is neither checked nor listed, and the section's "were not checked" sentence is rewritten to name only what still stands unchecked and why it no longer matters, the side-bar tree the pane replaced among it. Whatever the documentation leaves unstated is listed among the draft's questions for the work.

### Assignment override timing

When the looped task recipe is clicked, the page shows every task then remaining in `TASKS_TODO.md` with the host, model, and effort the rules give it, and the person overrides any of them before starting the loop. Once started, the loop never waits for the person: before each task it applies the override made for that task if there is one and otherwise the rules' result, shows the assignment it used, and goes on. Overrides are held for that run only and kept nowhere, and a task that enters the list only after the loop started gets the rules' result with no chance to override it. A looped run thus stays as unattended as the `complete-all-tasks` line it stands beside, with every assignment read and corrected in one sitting before the run starts.

### Dropped ideas list scope

The revised draft's list of dropped ideas holds every idea of the 2026-11-19 conversation decided as dropped and each part of an adopted or refined idea that the refinement set aside, for example the conversation's extension that no longer calls `complete-all-tasks`, where the refined task loop keeps that line beside its own recipe, together with the entries a recorded decision places there by name (the bounded repeat). It holds no option of the draft's ten questions and no part of the 2026-11-17 draft that a decision replaced, since those already carry their reasons in the Decided entries. Once the transcript is removed, the list is the one place left that says what the conversation proposed and the revision did not carry.

### Looped run task title

The runner holds the task loop: it is started once as the terminal's process for the whole looped run, and before each task it re-reads the top remaining heading, takes that task's chosen single-task line, and starts a fresh shell session for the task with the task's title and the mission path in that session's environment from its start. The looped recipe's own shell steps run again at the head of every task's session. The per-task line choice, the rules, and their evaluation move into the runner, or the runner is handed the rule file and the recipe file's named lines at its start. One terminal then shows the whole run, the loop can be started by hand outside the editor, and each task's values are fixed at its own session's start with nothing escaped.

### Extension name

The extension takes a descriptive name that carries the plugin's name with a qualifier: a display name such as Gurita for VS Code or Gurita Missions, with the slug its lowercase form, such as `gurita-vscode`. It coins no word and leaves Kepala and Kepalagurita to what `ideas/kepala.md` gives them. This mission looks the exact slug up directly on the extension registries and on GitHub and records the dated result in the draft, the `gurita` stem being already covered by the 2026-11-10 lookup. Since nothing is published while the extension is an experiment, no name is reserved for good before the experiment is judged.

### Page question-state source

The mission page reads whether any question lacks alternatives or a pick from the extension's own in-process parse of `open_questions.xml`, the one read the question view already makes, so the page label and the view cannot disagree on a block and a refresh starts no process. Nothing beyond `missions.py` is bundled and no installed plugin is looked up. The extension's tests, run as steps of the drift-gate workflow, run this repository's own `core/tools/open_questions.py list --without-alternatives` and `--without-recommendation` over the committed question documents or fixtures and fail when the parse selects different blocks, so a plugin change that moves the filters' meaning fails in the same commit. The page state's account of its source names the parse, with the tool's two filters named as what the parse is checked against.

### Interactive line source

The interactive lines behind the extension's buttons are written out literally, host binary, model, and effort included, as entries of their own in the shipped recipe source, `snippets/GURITA_USAGE.md`, beside its blocks: a `discuss-open-question --mission <path> <Short Title>` line and a `discuss-mission-goal <goal>` line in the interactive form (`claude "…"` with no `-p`, `agy -i "…"` on Antigravity). The extension fills `<path>`, `<Short Title>`, and `<goal>` and hands the line to a terminal, and a person's own recipe of the same name replaces a shipped line. The buttons then work with no recipe file of the person's own, the extension still holds no host flag, model, or effort, and `docs/ways-of-using.md` stays as it is, holding headless lines only.

### Shipped host lines

The extension ships command lines for two hosts, Claude Code and Antigravity, the two the snippet file holds headings for: every chain is written out by hand under each, each line carrying that host's own model and effort values, which is the snippet file as it stands, so nothing is written for it. Codex gets no shipped lines and is left to the legend and a person's own recipe file, since a Codex heading would hold lines nobody runs while the extension is installed by hand into the maintainer's editor and what Codex's plain print opens with is still unchecked. The mixed-host chain stays as written, and the extension holds no host flag of its own.

### Own recipe file location

A person's own recipe file lives outside the project as one per-user file serving every project, at a per-user path the extension reads: a default location, changeable through a VS Code user setting. Its lines carry a person's own hosts, models, and efforts, so nothing personal stands in any tree to ignore or commit by accident. A tracked rule naming a single-task line that file lacks leaves that task's assignment unresolved: the extension shows the missing name, in the preview before the loop starts, where the person overrides the task or adds the line, and the loop stops at that task rather than running it under any other line.

### Answer button line source

The shipped snippet file gains one complete headless line for each of four skills: `answer-open-question-with-alternative --mission <path> <Short Title>. <Alternative Id>`, `answer-open-question --mission <path> <Short Title>. <answer text>`, `answer-open-question-with-recommendation --mission <path> <Short Title>`, and `define-mission-goal --at <scope> <goal>`. Each is a `###` recipe of its own under a fixed name, written with its host binary, model, and effort as the file's other lines are and using the usage page's placeholder names; the define line is a one-line recipe of its own, not the head of a chain. Each button runs the shipped recipe of its fixed name, and a person's own recipe of the same name replaces it, as for every other recipe. Every button's line thus comes from the one shipped source by the one reading rule, the extension composes no line and holds no host flag, model, or effort, and `docs/ways-of-using.md` is untouched.

### Non-chain snippet blocks

The five blocks of `snippets/GURITA_USAGE.md` that are not chains of host command lines (the two lists of bare slash commands, the Antigravity install block, the `agy models` line, and the `git log` one-liner that lists every mission) stay in the file, moved under one reference heading of their own (for example `## Reference`) standing apart from the host headings. The reader takes as recipes only the `###` blocks under `## Claude Code` and `## Antigravity` and never reads that section, so a shipped recipe is each `###` heading under a host heading, and the draft states that the reference section holds lines for hand use only. The file stays the one usage reference a person reads by hand, and no block that cannot run is offered as a button.

### Standalone shell steps

The two standalone personal blocks, `source .env_anthropic` (API KEY usage) and `claude-wait` (Wait for next quota reset), leave `snippets/GURITA_USAGE.md`, so the shipped file keeps no personal line, and the recipe format gains nothing. A person who wants a shell step in a run writes it as an ordinary line inside a recipe of their own recipe file: a variant of a shipped chain (for example an "Execute tasks of normal difficulty (API key)" opening with `source .env_anthropic`, or one opening with `claude-wait;`), which adds to the shipped set or replaces the shipped recipe of the same name. The step runs because it stands ahead of the chain's lines in the same recipe, and so in the same shell session; it can also stand mid-chain, before a second `complete-all-tasks` line. The extension gives no line its own handling for this, at the cost of one copied chain for each variant a person actually runs.

## Out of Scope

