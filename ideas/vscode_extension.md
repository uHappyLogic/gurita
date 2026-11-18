# VS Code extension

A draft, written 2026-11-17, for work not yet defined: a Visual Studio Code extension that puts a UX layer over the plugin. It replaces two pieces of hand work, copying command lines into a terminal and reading `open_questions.xml` as raw XML, with buttons and a rendered view. It runs the host CLIs' own command lines and writes no mission file itself, so everything it does can still be done by hand. The draft records the hand work it replaces, what was measured, the parts, how a line is run, what was checked of VS Code and when, what it costs, what is decided, and the questions the work decides. It uses today's vocabulary (Cairn, mission, `--mission`); the extension is published after the plugin's rename `ideas/gurita.md` describes, under the new name, and has no name of its own yet.

## The hand work

A mission is driven today from a personal snippet file, untracked, that holds every command line the person runs. It has one placeholder, the mission's relative path, and under a heading per host one named, fenced block per situation: a first run (starting state, review, alternatives, recommendation), a requirements iteration (sweep, review, alternatives, recommendation), three execution blocks (normal, critical at a higher effort, and one with a further requirements pass first), a single task, and the finish. Beside them stand the bare slash commands of the conversational and single-question skills, and two shell steps of the person's own: sourcing an environment file to switch to API-key usage, and waiting for the account's usage window to reset.

Per mission the person replaces the placeholder throughout the file, then for each step copies a block and pastes it into a terminal. For a single-question skill they read the Short Title out of the XML, and for `answer-open-question-with-alternative` the alternative's id as well, and type both after the slash command.

Three properties of the file shape the design:

- **Hosts, models, and efforts are per line and personal.** A block mixes hosts: the critical execution block under Antigravity runs its last line on Claude Code, because the models `agy` runs there stop at `high`. Each line names its own model and effort, and `docs/ways-of-using.md` publishes other values for the same chains.
- **A block may end on an interactive line.** Where the recommendation line or the `complete-all-tasks` line closes a block it is written without `-p` (`agy -i` on Antigravity), so the session stays open and the person is in it when the run ends.
- **A stopped line does not stop a block.** The lines are joined by `;` and no skill sets an exit code, so a block runs every line after one that stopped.

The file has the form `docs/ways-of-using.md` already has: a heading naming the goal and one fenced block whose every line is a complete invocation, with the text to substitute in angle brackets. The page uses six placeholders: `<goal>`, `<scope>`, `<path>`, `<Short Title>`, `<Alternative Id>`, and `<answer text>`.

## What was measured

Read from this repository's history on 2026-11-17.

- **The question document is large when it is read.** Taking the largest committed version of `open_questions.xml` in each of the 13 most recent missions that held questions (`milestone_46` through `rename-milestone-to-mission`, directories named before the word's rename), the document held 9 to 41 questions in 56 to 329 KB. Ten of the thirteen held 12 to 18 questions in 90 to 137 KB. That is 6 to 8 KB a question.
- **It is hard to read as it stands.** The prose is entity-escaped (`&apos;`, `&quot;`, `&lt;`), a block's `<recommendation>` stands above its alternatives and names its option only by id, and a dependency is a bare `<depends-on question option/>` tag.
- **Most answers are accepted recommendations.** Counted by commit subject over the whole history: 622 `Recommendation-answer:`, 25 `Alternative-answer:`, and 32 `Manual-answer:`. So 57 of 679 answers (8%) were made by hand, and the person's sitting is mostly reading the whole set to find the few to override.
- **The list of live missions is short.** Two missions are live today and `missions.py live` prints them in two lines. A list alone is not worth an extension.
- **Every run's outcome is already a listed line.** The `## Fixed console lines` table of `docs/skill-reference.md` lists 94 lines (17 success, 27 no-op, 49 stop, and the one convergence verdict), and `tests/test_fixed_console_lines.py` checks each against every rendered host tree. CLAUDE.md gives the reason for the convention: a harness running the skills one invocation after another knows how each ended only from its final message.

## The constraint

The extension runs the command lines a person would type, through the host's own CLI, and writes nothing under a mission directory. Four things follow.

- **Manual use is unchanged.** A run started by a button is the run the pasted line starts. A person without the extension loses nothing, and a button can show the lines it is about to run.
- **The plugin changes nothing for it.** No new tool, subcommand, output form, or exit code is needed. The two optional exceptions are the tool-side render named under the costs and a runner shipped as a plugin tool, both left to the questions.
- **It could record nothing on its own anyway.** Every recording step is a model run: the answer core judges what an answer supersedes and which picks it undermines. The open-question tool and the task-list tool stay the only writers of their files.
- **It reads three files to display them.** `open_questions.xml` whole (the open-question tool is that document's only writer, not its sole reader), the `##` headings of `TASKS_TODO.md`, and the `# ` title of `requirements.md`.

## The parts

### Recipes

A recipe is a named list of literal command lines with placeholders, the form the snippet file and the ways-of-using page already have. The extension holds no model name, effort level, host flag, or skill order of its own: all of that is text in the lines.

- **Shipped recipes** are the chains of `docs/ways-of-using.md`, so the page stays the one place a chain is written.
- **A person's own recipes** are a file in the same form, which adds to the shipped set or replaces a recipe of the same name. Shell steps of the person's own, such as sourcing an environment file, are lines like any other.
- **The interface fills the placeholders.** `<path>` comes from the selected mission, `<Short Title>` and `<Alternative Id>` from the question and alternative clicked in the question view, and `<goal>`, `<scope>`, and `<answer text>` from an input box.

A chain that holds per-question lines, as the page's "Answering the questions that matter to you" does, is not one button. It splits at the person's sitting: the question view records the hand answers one run at a time, and a button runs the lines after them.

### Question view

A read-only rendering of one mission's `open_questions.xml`, opened in place of the XML text. For each question it shows the question text, the pick and its rationale against the alternative it names, every alternative with its what-it-is, advantage, and drawback, each dependency as a link to the sibling and the option it assumes, and the principles applied. It carries the buttons no snippet file can, because the title and the id come from the document:

- on an alternative, record it (`answer-open-question-with-alternative`);
- on a question, discuss it (an interactive `discuss-open-question` session), answer it in the person's own words from an input box (`answer-open-question`), or record its recommendation (`answer-open-question-with-recommendation`);
- on the document, record every remaining recommendation (the sweep).

The view re-reads the file after every run, since an answer removes its block and may clear the picks on other questions.

### Mission list

A side-bar tree of the live missions, each with its path, title, and `started` or `defined`, and beneath it its open questions and remaining task headings. As a display it adds little to `missions.py live`. Its use is as the place the recipe buttons hang and take their `<path>` from, and as the way into the question view.

## Running a line

- **Where a line runs.** An interactive line needs a terminal the person can type into. A headless line has three places. Typed into that terminal, it stays in view and under the person's hands, and its output is read through shell integration (see the check below). As a child process of the extension, it is given its arguments as a list, so nothing is quoted for a shell, and its output is the extension's to read, out of the terminal. Under a runner, a process started as the terminal's own process with an argument list, which then starts each line of the chain itself, the run stays in view, an interactive last line inherits the terminal, and each headless line's output reaches the runner through a pipe, with no shell integration involved.
- **Stopping a chain.** The runner reads the first line of each headless run's final message against the fixed-line table. It goes on after a success or no-op line and stops the chain on a stop line or a line the table does not hold, which the `;` in the snippet file cannot do. An interactive line prints no final message to read, so a chain can only end on one, as the snippet file's blocks already do.
- **Quoting.** A Short Title or a typed answer lands inside the line's quoted prompt. The ways-of-using page asks the person to write no double quote there (no single quote on a Codex line), and `ideas/short_title_characters.md` records the same failure for titles. Where the extension types into a shell it refuses or escapes a value holding a character special in that line's quoting, rather than leaving the person to avoid one.
- **How long a run lives.** No longer than the editor, by decision (see Decided). The terminal is marked transient, so a restart never starts a chain again, and a runner that is ended ends the line it is running, so nothing a button started keeps running unseen.
- **Permission flags.** `--dangerously-skip-permissions` and its Codex counterpart are text in a recipe line. The extension never adds one.
- **Runs side by side.** Two missions' chains may run at once: every commit takes its own paths as its pathspec, a git write outlasts another run's lock, and the scope gate holds a second mission in an overlapping scope at task entry. Within one mission the extension runs one chain at a time.

## What was checked of VS Code

Read from the VS Code documentation on 2026-11-17 (pages under Sources).

- **A custom editor can claim the question document.** A `customEditors` contribution selects files by a `filenamePattern` glob, which may match on directory names (the guide's example is `**/translations/*.json`). Priority `default` uses the custom editor for every matching file and `option` leaves it for the person to switch to. `CustomReadonlyEditorProvider` is the type for an editor that does not edit.
- **A publisher id is permanent and a removed name is gone.** The publisher's "ID cannot be changed once created", and after an extension is removed "its extension name is permanently reserved and cannot be reused, even by the original publisher". An extension can be deprecated in favour of another, which shows a Migrate button, but "VS Code will not automatically migrate or uninstall already installed deprecated extensions". Whether a published extension's name can be changed in place is not stated on the page.
- **A terminal's process survives a window reload, not a restart.** On reload VS Code reconnects to the previous process. On a restart "a terminal's content is restored and the process is relaunched using its original environment", so a command that was running is not continued.
- **An extension can run a command in a terminal, read what it prints, and learn when it ended, where shell integration is active.** The 1.93 release notes say "The terminal shell integration API is now available to use" and show `shellIntegration.executeCommand(...)` and `window.onDidEndTerminalShellExecution`, whose event carries `exitCode`. `TerminalShellExecution.read()` gives "a stream of raw data (including escape sequences) that is written to the terminal", holding only what was written after its first call. `executeCommand` takes a command line, or an executable with a list of arguments, whose escaping covers an argument that "contains whitespace and does not include any single quote, double quote or backtick characters" and "is not intended to be a security measure". The call "is not guaranteed to work as shell integration must be activated", and `Terminal.shellIntegration` "may remain undefined if shell integration never activates", a person's shell setup being one named cause. Without it the fallback is `sendText`, and then "we can't know when the command has finished or what the exit code was". Shell integration activates by itself for bash, fish, pwsh, and zsh on Linux and macOS and for Git Bash and pwsh on Windows, and not in a sub-shell, a plain `ssh` session, or "some complex shell setups".
- **An extension can start a process of its own as a terminal.** `TerminalOptions` takes `shellPath` and `shellArgs`, a list, so the process gets its arguments unparsed by any shell. `isTransient` opts the terminal out of the persistence that would otherwise relaunch the process on a restart. `Terminal.exitStatus.code`, read in `window.onDidCloseTerminal`, is the process's exit code. A task does the same and keeps its terminal: `ProcessExecution` takes a process and a list of arguments, `tasks.onDidEndTaskProcess` carries the process's `exitCode`, and the presentation option `close` "controls whether the terminal is closed after executing the task". A `Pseudoterminal` is the third form, a terminal whose content the extension writes itself.

The output read and the argument-list form were left unconfirmed by the first check, the API reference page being too long for it, and were then read from the API definitions the installed VS Code ships (1.143.0, `out/vscode-dts/vscode.d.ts`), as the last bullet's facts were. The exit code alone does not tell how a skill ended, since no skill sets one, so stopping a chain rests on reading the output, whichever way a line runs. The side-bar tree and the publication of an extension outside the Marketplace were not checked.

## Kepala

The runner is the transition engine `ideas/kepala.md` outlines, with a person choosing the edge. Kepala runs the skills through the CLI, reads the coarse state from `missions.py live` and the fine state from the last fixed first line, and names the `Recommended` state as where the team comes in. The question view is that state's interface. So the recipes, the fixed-line reading, and the state read are kept apart from the VS Code interface, in a part with no dependency on it. Whether Kepala then uses that part is Kepala's question.

## What it costs

- **A second toolchain.** TypeScript, Node, packaging, and a marketplace publisher, beside a repository that is stdlib-only Python, Markdown, and one build script under a one-job CI, and a fourth thing to release beside the three host trees.
- **A copy of the contract.** The extension reads the recipe page and the fixed-line table. Kept in another repository it carries copies of both, which the plugin can outrun. The plugin's rename changes every line of either that carries `cairn`.
- **Little reach.** The plugin has few users, so the first user is the maintainer. The case rests on the maintainer's own hand work, 57 finished missions and 679 recorded answers, not on new users.
- **A cheaper form of the view exists.** A read-only render of the question document to Markdown or self-contained HTML, as a stdlib tool tested with golden fixtures, gives the reading without the buttons, in every editor and host. It can also be the extension's renderer, the view showing the tool's output, which leaves the Python tool the document's only parser.

## What waits

Nothing here is carried out yet. Both renames land first (the word's rename is carried out on `main`, and the plugin's, `mission_rename-cairn-to-gurita/`, is defined), so the extension is published once, under the new name, with recipes and fixed lines that already say mission. The namespace is data to the extension, as the flag and the discovery pattern are, so work on it before the plugin's rename costs an edit of that data, while a publication before it costs a name that cannot be taken back.

## Decided

Decided on 2026-11-17.

- **A run lives no longer than the editor.** Every run the extension starts ends when VS Code exits, abruptly if need be, and nothing is built to carry a run across a restart or to pick one up after it. An abrupt end is what closing the terminal under a pasted line already is, and the plugin already answers it: `complete-all-tasks` run again continues from the remaining tasks, each task being committed on its own and a stopped task's partial work continued; the answer sweep stops on its fixed line while a mission file holds an uncommitted change; and a git lock a killed process left surfaces as git's message.
- **No local server.** Nothing the extension does runs behind a listener. A server was considered only as a way around limits of the terminal API, and the check found none that needs one: an extension can start a process as a terminal or a task with an argument list and read its exit code, and where shell integration is active it can read what a command prints. A chain is run by the extension itself or by one process per chain that ends with it and keeps no state.

## Questions for the work

- **Where it lives.** Its own repository, as `ideas/kepala.md` plans for the orchestrator, which keeps this one stdlib-only and makes the copies of the contract explicit. Or a directory here outside `core/`, rendered into no host, which keeps the recipe page and the fixed-line table one checkout away and puts a second toolchain into this repository's CI.
- **What a recipe file is.** The ways-of-using page parsed as it stands (headings and fenced blocks), which keeps one source and ties the extension to the page's layout. Or a data file the page is written from or checked against. Either way the placeholder set is the page's six, and the snippet file's one placeholder becomes `<path>`.
- **Whether a recipe is only a list.** The requirements iteration is repeated by hand until the review prints its convergence line. A recipe could carry a bounded repeat that ends on that line, the loop CLAUDE.md names as the verdict line's reason, or stay a flat list the person clicks again.
- **How a headless line runs and how its outcome is read.** In the terminal through shell integration, which hands over a raw stream with escape sequences and works only where the person's shell setup lets shell integration activate. As a child process of the extension, which needs neither and no shell quoting but takes the run out of the terminal. Or under a runner started as the terminal's process, which keeps the run in view, needs no shell integration, and puts the chain logic in a part a person can also start by hand. With it goes what is read: the plain print of a headless line, or the structured output each host offers (`--output-format stream-json` on Claude Code and Antigravity, `--json` on Codex), which `host_tests/conftest.py` already reads for all three and which adds a flag the pasted line does not carry.
- **What the runner needs, if there is one.** Written in Python and kept stdlib-only it needs the `python3` the plugin already requires and nothing else; `uv` is this repository's development tool, named nowhere under `core/`, and assuming it adds a prerequisite the plugin does not have. It ships inside the extension, found by the extension's own path, or as a plugin tool, which brings back the question of the plugin's installed location. A recipe's shell steps (sourcing an environment file, a shell function of the person's) need a shell, so the runner also settles whether a chain is one shell session and how a substituted value reaches a line without being parsed by it.
- **Where the live state comes from.** The installed `missions.py`, which needs the plugin's installed location: Antigravity's is the fixed `~/.gemini/config/plugins/cairn`, and the host suite finds Claude Code's and Codex's through `<cli> plugin list --json`. Or a glob of the discovery pattern in the workspace, which needs no tool and no install but is a second copy of the pattern and cannot tell `started` from `defined`.
- **What renders the question document.** A reader of the XML inside the extension, or the tool-side render under the costs.
- **Which hosts' lines ship.** The page's chains are Claude Code lines with one mixed-host chain and a legend for moving a line to another host. The extension ships them as written, or also ships each chain per host.
- **Where it is published.** The Marketplace only, or also a registry the VS Code forks read, which was not checked.
- **Its name.** It joins Gurita and Kepala or stays descriptive. Whichever it is, the slug gets the direct registry lookup `ideas/gurita.md` records its own first check lacked.

## Sources

Read on 2026-11-17.

- Custom editors: https://code.visualstudio.com/api/extension-guides/custom-editors
- Publishing, publisher ids, removal and deprecation: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- Terminal persistent sessions: https://code.visualstudio.com/docs/terminal/advanced
- Terminal shell integration API: https://code.visualstudio.com/updates/v1_93
- Shell integration, supported shells and its limits: https://code.visualstudio.com/docs/terminal/shell-integration
- The API reference, read only in part: https://code.visualstudio.com/api/references/vscode-api
- The API definitions shipped with the installed VS Code 1.143.0, `out/vscode-dts/vscode.d.ts` inside the application, for `TerminalShellExecution`, `TerminalShellIntegration.executeCommand`, `Terminal.shellIntegration`, `TerminalOptions`, `TerminalExitStatus`, `Pseudoterminal`, `ProcessExecution`, `TaskProcessEndEvent`, and `TaskPresentationOptions`
