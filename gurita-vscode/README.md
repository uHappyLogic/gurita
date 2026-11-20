# Gurita for VS Code

Gurita for VS Code (`gurita-vscode`) puts the Gurita plugin's live missions in one pane in the
editor area: a page per live mission with its question view and remaining tasks, buttons that
run the plugin's skills as recipes in a terminal, and a looped task run that completes a
mission's tasks one at a time. It drives the `claude` and `agy` command-line tools with the
Gurita plugin installed in them; it does not replace the plugin.

This file covers building, packaging, installing, and using the extension. The extension is
not published to any marketplace: it is built from this repository and installed by hand.

## Requirements

- VS Code 1.143.0 or later (the manifest declares `engines.vscode` `^1.143.0`), with its `code`
  command on `PATH` for the command-line install.
- Node 22 through nvm under `$HOME/.nvm`, to build and package. Node is needed only for the
  build; the installed extension needs no Node install of its own.
- `python3`, 3.9 or later, on `PATH`: the extension runs the bundled missions tool and its own
  runner with it.
- `git`: the project root is the top level of a git work tree.
- `claude` and, for the Antigravity recipes, `agy`, each with the Gurita plugin installed, on the
  `PATH` of the shell the runner starts.
- macOS or Linux. On Windows only through Remote-WSL, where the extension runs on the Linux side.

## Building and packaging

Every Node command runs under Node 22 through nvm, in a subshell, from the repository root:

```
(source "$HOME/.nvm/nvm.sh" && nvm use 22 && cd gurita-vscode && npm ci)
(source "$HOME/.nvm/nvm.sh" && nvm use 22 && cd gurita-vscode && npm run compile)
(source "$HOME/.nvm/nvm.sh" && nvm use 22 && cd gurita-vscode && npm test)
(source "$HOME/.nvm/nvm.sh" && nvm use 22 && cd gurita-vscode && npm run package)
```

- `npm ci` installs the pinned build dependencies from `package-lock.json` into
  `node_modules/`: TypeScript, `@types/vscode` 1.140.0, `@types/node`, and `@vscode/vsce`.
- `npm run compile` compiles the extension host code (`tsconfig.json`, CommonJS) and the
  webview page's script (`tsconfig.webview.json`, with the DOM library) from `src/` into `out/`,
  one emitted file per source file, with no bundler.
- `npm test` compiles, then runs the unit tests of the recipe reader, the `open_questions.xml`
  parser, and the `TASKS_TODO.md` heading read, among others, with Node's built-in `node:test`
  over the compiled files under `out/test/`; the run path is tested against a stub of the
  `vscode` module, and the page script against a small stand-in for the DOM. Nothing runs
  inside an editor.
- `npm run package` runs `vsce package`, which first runs the `vscode:prepublish` script: the
  compile, then `scripts/bundle.js`, the extension's own build step, which copies
  `core/tools/missions.py` and `snippets/GURITA_USAGE.md` verbatim into `bundled/` and writes
  `bundled/fixed_lines.tsv` from the `## Fixed console lines` table of
  `docs/skill-reference.md`, one `kind<TAB>line` row per table line. Every package therefore
  carries the missions tool, the recipes, and the fixed lines of the checkout it was built from.

The runner's own tests are pytest tests under `gurita-vscode/runner_tests/`, collected by the
repository's ordinary pytest runs, run from the repository root:

```
uv run pytest gurita-vscode/runner_tests
```

`node_modules/`, `out/`, `bundled/`, and `dist/` are build output, ignored by git; nothing the
build writes is committed.

## Installing

The package lands at one fixed path, overwritten by every build:

```
gurita-vscode/dist/gurita-vscode.vsix
```

Install it by hand, from the repository root:

```
code --install-extension gurita-vscode/dist/gurita-vscode.vsix
```

The installed extension's id is `uhappylogic.gurita-vscode`. Its version, `0.1.0` at first, is
the extension's own, kept in `gurita-vscode/package.json` independent of the plugin's `VERSION`
and bumped by hand whenever the extension changes. To install a rebuilt package of the same
version over the installed one, add `--force`; to remove it, run
`code --uninstall-extension uhappylogic.gurita-vscode`.

## Using the pane

Open the pane with the command **Gurita: Open Mission Pane** (`gurita.openMissionPane`) from the
Command Palette. It is the extension's only entry point: there is no status bar item, menu
entry, or keybinding, the pane never opens by itself, and it does not survive a restart or a
window reload, so open it again after one. **Gurita: Refresh Mission Pane**
(`gurita.refreshMissionPane`) and the pane's **Refresh** control re-read everything.

The project root is the top level of the git work tree holding the first workspace folder;
every other folder is ignored. The pane lists the live missions that `missions.py live` prints
from that root:

- A row of tabs across the top, one per live mission, each showing the mission's title with its
  path as a tooltip, and at its end the two mission-starting buttons, **New mission** (runs the
  `discuss-mission-goal` recipe) and **Define mission** (runs the `define-mission-goal` recipe).
- Under the selected tab, the mission's page: the workflow diagram, the recipe buttons, the
  question view parsed from `open_questions.xml`, and the remaining task headings of
  `TASKS_TODO.md` with a **New task** button beside them. The diagram draws the flow in eight
  blocks, **define**, **review**, **provide alternatives**, **recommend**, and **answer** in the
  frame "Decide upfront" and **derive**, **complete**, and **finish** in the frame "Hand
  execution to agents", with the loop from answer back to review until no open questions remain
  and the handoff from answer to derive. The block of the step to run next is filled purple:
  **provide alternatives** while a question lacks alternatives, **recommend** while every
  question has alternatives and one lacks a pick, **answer** when every question has a pick,
  **complete** when no question is open and tasks remain, **finish** for a started mission with
  no open question and no task, and for a defined mission with neither **derive** when git holds
  a `Requirements-review:` commit for the mission and **review** when it holds none. An open
  question outranks a remaining task. A review pass that changed nothing leaves no commit, so
  the diagram does not see it. No block is filled when a document the choice needs does not
  read; that file's notice stays in its own section. The diagram is display only: its blocks
  are not buttons and gate nothing. **New task** runs the
  `discuss-new-task` recipe for the page's mission: you type the issue, and an interactive
  conversation clarifies it into tasks and adds them to the mission's task list through
  `submit-task` inside that same conversation, so there is no separate submit button. The
  question view shows one fully opened card per question, one at a time under a position
  counter such as `3 / 12`: **Previous** and **Next**, or the left and right arrow keys, move
  between the cards, and a dependency on a card links to the named question's card. Each card
  stacks the question text in an area of fixed height, so the pick starts at the same height on
  every card, then the pick and its rationale, the alternatives, the dependencies, and the
  principles, and carries **Discuss**, **Answer**, and **Answer with recommendation** buttons
  and an **Answer with this alternative** button on each alternative. **Discuss** always asks
  for an optional note first: a note you type is carried to the discussion directly after the
  Short Title, as `--mission <path> <Short Title>. <note>`; an empty note starts the discussion
  of the question alone, and Escape starts nothing. After a run removes a question the view
  keeps its place in the list.

Every value a button needs (a goal, a scope typed as a path from the project root, an answer,
an issue description, a discussion note) is typed into VS Code's own input box, one line per
value. Only the discussion note may be left empty. A click on a recipe button starts its
run at once in a terminal; every recipe button shows its lines, placeholders included, before
you click. While a run started for a mission is going, until you dismiss its terminal, that
mission's page shows it: every action button on the page (the recipe buttons, the buttons on
the question card and its alternatives, a preview's **Start run**, and **New task**) is
disabled, and the workflow diagram's filled block pulses. The tabs, **Refresh**, the question
view's **Previous** and **Next**, the other missions' pages, and **New mission** and **Define
mission** stay enabled, and the page is drawn this way again whenever it is redrawn, after the
pane was hidden and shown included. Should a click still reach the extension for that mission,
it starts nothing: a notification says a chain is already running and the run's terminal is
shown.

The pane re-reads by itself after each of its runs, once you dismiss the run's terminal, and on
changes to any mission's `requirements.md`, `open_questions.xml`, or `TASKS_TODO.md`; git state
is not watched. When the live missions cannot be read, the pane shows one line saying so with
the cause beneath it, and the two mission-starting buttons stay. When a single mission document
is missing or does not parse, only the part of the page drawn from it is replaced by a notice
naming the file.

## Recipes

A recipe is a `###` heading, its name, and the lines of the first fenced block beneath it. The
pane lists recipes from two files.

### The shipped recipe file

The package ships `snippets/GURITA_USAGE.md` as `bundled/GURITA_USAGE.md`, read at run time. Only
the `###` blocks under its `## Claude Code` and `## Antigravity` headings are recipes, each
listed in that host's group; the blocks under `## Manual use` are for reading only. Besides the
chains, the file carries:

- The seven button recipes, under `## Claude Code`, each named by the skill its one line invokes:
  `discuss-open-question`, `discuss-mission-goal`, `discuss-new-task`, `answer-open-question`,
  `answer-open-question-with-recommendation`, `answer-open-question-with-alternative`, and
  `define-mission-goal`. The buttons run the recipe of these fixed names; `discuss-new-task`'s
  one line is
  `claude "/gurita:discuss-new-task --mission <path> <issue description>" --dangerously-skip-permissions --model "fable" --effort xhigh; # interactive`,
  and `discuss-open-question`'s is
  `claude "/gurita:discuss-open-question --mission <path> <Short Title>. <note>" --dangerously-skip-permissions --model "fable" --effort xhigh; # interactive`.
- The looped recipe, `Execute tasks one at a time`, whose only line is the slot line
  `<single-task line>` (see the looped task run below).
- The single-task lines, each one headless line holding `<Task Title>`:
  `Single task with Opus xHigh (Claude Code)`, `Single task with Opus High (Claude Code)`, and
  `Single task with Opus High (Antigravity)`.

### Your own recipe file

You can keep recipes of your own in one Markdown file, by default `~/.gurita/recipes.md`, the
`~` standing for your home directory on every operating system. The user setting
`gurita.ownRecipesFile` changes the path; left empty, the default is read, and a leading `~` in
it is expanded. A missing file simply holds no recipe.

The file is a flat list of `###` recipes, each heading followed by a fenced block of lines;
`##` headings in it are ignored. An own recipe carrying the name of a shipped recipe replaces
that recipe in place, a button recipe included; every other own recipe is listed below the
Claude Code and Antigravity groups under **Your recipes**, in the order your file lists them.
For example:

````
### Review twice
```
claude -p "/gurita:review-mission-requirements --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/gurita:review-mission-requirements --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
```
````

Each line is one of three kinds, read from its text:

- **Headless** when it holds a `gurita:` invocation (`/gurita:` or `$gurita:`) and carries no
  `# interactive` mark: its output is checked, and the chain goes on only when the last whole
  line of its print that is a success, no-op, or stop line of the plugin's fixed console lines
  is a success or no-op line. The whole print is read because a host may print several messages
  for one line (an interim one each time the skill's background agents wake its session), and
  lines of the verdict kind, such as the review's convergence line, never count. A print holding
  no success, no-op, or stop line stops the chain.
- **Interactive** when it ends in a `# interactive` comment: it runs in the terminal as written.
- **A shell step** otherwise: it runs as written.

The placeholders the extension knows are `<path>`, `<Task Title>`, `<Short Title>`,
`<Alternative Id>`, `<goal>`, `<scope>`, `<answer text>`, `<issue description>`, and `<note>`.
`<note>`, the discussion note, is the one optional placeholder: when it is empty the line is
built with it dropped, together with the `. ` written directly before it, so the line reads as if
it held no note. A mission page fills `<path>`; a
recipe holding any other known placeholder is left off the page's list and stays reachable by
name for the button or loop that fills it. A recipe holding a placeholder name the extension does
not know is shown as a non-runnable entry naming that placeholder and the file it came from.

Values never enter a line's text: each placeholder is written as a reference to a session
variable set in the run's environment, named `GURITA_` followed by the placeholder upper-cased
with spaces turned into underscores: `GURITA_PATH`, `GURITA_TASK_TITLE`, `GURITA_SHORT_TITLE`,
`GURITA_ALTERNATIVE_ID`, `GURITA_GOAL`, `GURITA_SCOPE`, `GURITA_ANSWER_TEXT`,
`GURITA_ISSUE_DESCRIPTION`, and `GURITA_NOTE`. A shell step
in your own recipe may read them as `"$GURITA_TASK_TITLE"` and the like.

## The looped task run and the rule file

A click on a looped recipe (one whose last line is the slot line `<single-task line>`) runs
nothing yet: it shows a preview on the mission's page listing each remaining task with the
single-task line the rule file gives it. Every recipe holding exactly one headless line with
`<Task Title>`, shipped or your own, counts as a named single-task line. In the preview you may
override any task's line by picking another named line. **Start run** then starts the loop,
which before each task re-reads the top remaining heading of `TASKS_TODO.md`, runs the recipe's
lines with that task's line in the slot, goes on only when the line read from the single-task
line's print, as any headless line's is read, is `Task completed.`, and stops, without running it, at the first task left unresolved, a task added
after the run started included.

The rule file is `task_line_rules.txt`, directly in the project root, at a fixed path no setting
moves. It is plain UTF-8 text, one rule per line:

```
<pattern> -> <single-task line name>
```

- The line is split at its last ` -> `, so a pattern may hold the arrow; the name is the
  single-task line's `###` heading exactly.
- Each pattern is a Python regular expression, applied with `re.search`, case-insensitively, to
  the task's title and brief joined by a newline. The first matching rule in file order wins.
- The one line whose pattern is a bare `*` is the default, naming the line for every task no
  rule matches; a second `*` line is refused.
- Blank lines and lines opening with `#` are skipped.

A missing rule file holds no rule and no default: the preview says so, naming the path it looked
for, and lists every task as unresolved. A rule file that cannot be read as rules is refused
whole: the preview shows each unreadable line's number and reason and lists every task as
unresolved. Either way you can override tasks by hand and start the run, which stops at the first
task carrying no override.

This repository tracks its own rule file, `task_line_rules.txt` at its root: tasks whose title or
brief names `core/tools/`, a `.py` file, a test, a parser, or the runner go to
`Single task with Opus xHigh (Claude Code)`, and every other task to the default,
`Single task with Opus High (Claude Code)`.

## The runner

Every run is the bundled `runner.py`, started with `python3` as the run terminal's own process at
the project root. It composes the chain into one script and runs it in one shell session, using
the shell `$SHELL` names as an interactive shell (so it reads `~/.zshrc` or `~/.bashrc`), or
`/bin/sh` with no startup files when `$SHELL` is unset or names a shell outside the sh, bash, zsh
family. Before each line it prints a marker naming the line's number, the total, and its text,
such as `Step 3 of 4: claude -p ...`, in a chain and in each task's run of a looped run alike.
The marker shows every session-variable reference in the line, such as `${GURITA_PATH}` or
`${GURITA_TASK_TITLE}`, as its value, so it names the real mission path and task title; nothing
else in the line is expanded, and the line that runs keeps its references as written. The marker
is never part of the output a headless line's check reads. When the chain ends it
prints the line the run ended on and the recipe line it stopped at, then waits for a keypress;
the terminal closes, and the pane re-reads, once you dismiss it.

The runner can also be run by hand outside the editor, from `gurita-vscode/` once a build has
written `bundled/`; `python3 runner.py --help` lists its `chain`, `preview`, and `loop` commands
and their arguments.
