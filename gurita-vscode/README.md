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
- `claude` and, for the Antigravity variants, `agy`, each with the Gurita plugin installed, on the
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
- `npm test` compiles, then runs the unit tests of the recipe reader and the stage filter of a
  page's recipe list, the `open_questions.xml` parser, and the `TASKS_TODO.md` heading read,
  among others, with Node's built-in `node:test` over the compiled files under `out/test/`; the
  run path, the pane's answer to a tab click, and the recipe list it posts are tested against a
  stub of the `vscode` module,
  and the page script against a small stand-in for the DOM. Nothing runs inside an editor.
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
- Under the selected tab, the mission's page: the workflow diagram, the recipe buttons of the
  recipes that fit the step its diagram fills (see The recipes a page lists), and two
  panes behind one row of two headers, **Open questions**, holding the question view parsed from
  `open_questions.xml`, and **Remaining tasks**, holding the remaining task headings of
  `TASKS_TODO.md` and the **New task** button. The two headers are of equal width and together
  fill the pane's whole width, and only the selected pane's content is shown beneath them. A
  page opens on **Remaining tasks** when git holds at least one `Requirements-review:` commit
  for the mission (the count the workflow diagram reads) and no question is open, and on **Open
  questions** otherwise, a failed git read included. A header you click stays selected through
  every redraw and every refresh from file events while the mission stays shown; it is not
  saved, so switching to another mission's tab, opening the pane again, or showing it again
  after it was hidden opens the page on its default afresh. The diagram shows the choices you
  make, not the plugin's inner steps, as one line of seven blocks joined by arrows: **define**,
  **first review round**, **additional review round**, **derive tasks**, **execute tasks**,
  **follow up tasks**, and **finish**. The two optional blocks, **additional review round** and
  **follow up tasks**, have a dashed border and the five required ones a solid border. The
  diagram is centered in the pane and lies in one horizontal row while that row fits the pane's
  width; in a pane too narrow for the row, the same blocks stack vertically, joined by downward
  arrows and likewise centered, each block keeping its border and its fill, and the diagram goes
  back to the row once the pane is wide enough again, never wrapping or scrolling sideways. The
  additional review round reads plain while git holds at most one `Requirements-review:` commit
  for the mission and then carries the count of those beyond the first: **additional review
  round 1** at two, **2** at three, and so on. The block of the step to run next is filled
  purple: **first review round** for a defined mission with no open question, no task, and no
  review commit, and while a question lacks alternatives or a pick and at most one review commit
  stands; **additional review round** while a question lacks alternatives or a pick and two or
  more stand; **derive tasks** when every open question has a pick, or when none is open and no
  task exists on a defined mission whose review commit stands; **execute tasks** while tasks
  remain and no question is open; and **finish** for a started mission with no open question and
  no task. **define** and **follow up tasks** are never filled, and an open question outranks a
  remaining task. A review pass that changed nothing leaves no commit, so the diagram does not
  count it. No block is filled when a document or the git read the choice needs does not read;
  a document's notice stays in its own pane. The diagram is display only: its blocks are not
  buttons and gate nothing. **New task** runs the
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
disabled, and the workflow diagram's filled block pulses. The tabs, the **Open questions** and
**Remaining tasks** headers, **Refresh**, the question view's **Previous** and **Next**, the
other missions' pages, and **New mission** and **Define mission** stay enabled, and the page is
drawn this way again whenever it is redrawn, after the pane was hidden and shown included.
Should a click still reach the extension for that mission, it starts nothing: a notification
says a chain is already running and the run's terminal is shown. Clicking a mission's tab,
whether or not it is the tab already selected, brings the terminal of that mission's run
forward and focuses it while a run started for the mission is going; when none is, the click
only shows the mission's page, with no notification.

The pane re-reads by itself after each of its runs, once you dismiss the run's terminal, and on
changes to any mission's `requirements.md`, `open_questions.xml`, or `TASKS_TODO.md`; git state
is not watched. When the live missions cannot be read, the pane shows one line saying so with
the cause beneath it, and the two mission-starting buttons stay. When a single mission document
is missing or does not parse, only the part of the page drawn from it is replaced by a notice
naming the file.

## Recipes

A recipe is a `###` heading, its name, and one or more named variants, each a literal block of
lines. Each `####` sub-heading beneath the `###` heading names a variant, its lines those of the
first fenced block beneath the sub-heading:

````
### Execute tasks
Stage: execute tasks

#### Claude Code
```
claude "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "opus" --effort high; # interactive
```

#### Claude Code (critical tasks)
```
claude "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "opus" --effort xhigh; # interactive
```
````

A recipe with one fenced block and no `####` sub-heading is a recipe of one variant, named by the
recipe's own name. Once a recipe holds a `####` sub-heading, only the blocks beneath its
sub-headings are read, a block standing above the first sub-heading included in none; a
sub-heading with no fence beneath it is a variant of no line, and of a variant name repeated
within one recipe only the first is read. Headings inside a fence are lines, not headings. The
pane lists recipes from two files, the shipped file and your own file, and reads both in this
same form. Until a variant can be chosen, a recipe runs its first variant: the recipe button on a
mission's page, the buttons that run a recipe by its fixed name, and the looped run's named
single-task lines all take it.

### The stage line

A recipe may declare the one step of the workflow diagram it belongs to, by one `Stage:` line
standing between its `###` heading and its first fence or first `####` sub-heading, outside the
fence, once for the whole recipe:

````
### Prepare tasks
Stage: derive tasks
```
claude -p "/gurita:answer-all-open-questions-with-recommendation --mission <path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/gurita:derive-tasks --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
```
````

The step is named exactly as the diagram labels its block: `first review round`,
`additional review round`, `derive tasks`, `execute tasks`, `follow up tasks`, or `finish`. The
line opens with `Stage:` at its first column, and the name after it is read with its outer spaces
trimmed. A recipe with no `Stage:` line before its first fence or sub-heading, with more than
one, or with a name the reader does not know (`define`, or a step's name spelled otherwise,
capitals included) is undeclared; a `Stage:` line inside the fence is an ordinary line of the
recipe, and one after the first fence or beneath a `####` sub-heading is not read. The same rule
reads the shipped file and your own file, and an own recipe that joins a shipped one keeps the
shipped recipe's declaration, its own `Stage:` line not read. The declared step chooses the
mission pages that list the recipe.

### The recipes a page lists

Each mission's page lists only the recipes that fit the step its workflow diagram fills, the
step to run next:

- every recipe declaring that step;
- beside them, when **derive tasks** is filled, every recipe declaring **additional review
  round**, and when **finish** is filled, every recipe declaring **follow up tasks**, the
  optional step you may take there instead of moving on;
- every undeclared recipe, whatever the step.

A page whose diagram fills no block, because a document or the git read the choice needs did not
read, lists every recipe. The page's other rules hold within that list as described below: the
shipped recipes come first and your own under **Your recipes** below them, a recipe holding a
placeholder the page cannot fill is left off, and one holding a placeholder the extension does not
know is shown as a non-runnable entry. The list follows the step, so it changes
whenever a run or a change to a mission document moves the diagram's filled block. The buttons
that run a recipe by its fixed name (on the question card and its alternatives, **New task**,
**New mission**, and **Define mission**) are offered whatever the step.

Under the page's **Recipes** heading the list is drawn in two parts. First come the shipped
recipes, one button each in the shipped file's order, with no heading of their own; an own recipe
carrying a shipped recipe's name joins that recipe's button rather than adding one. Then, under
**Your recipes**, come your own recipes that carry no shipped recipe's name, in your file's order,
the heading left out when there is none. Each button shows the recipe's name and, beneath it, what
the lines of the variant it runs (its first) carry: its distinct harnesses, its distinct models,
and its distinct efforts, each list in the order of first appearance and the three lists separated
by `·`, so a `First run` whose lines run `fable` at `xhigh`, `opus` at `high`, and `fable` at
`xhigh` on `claude` reads `claude · fable, opus · xhigh, high`. A line adds only the values its
text carries: its harness when its first word is `claude`, `agy`, or `codex`, and the values of
`--model` and `--effort`, or of `-m` on a Codex line. A shell step, the slot line
`<single-task line>`, and a command the extension does not know add nothing, so a variant none of
whose lines is readable, such as `Execute tasks one at a time`, shows its name alone. The label
does not say which model runs at which effort; the button's hover text shows the variant's lines
as written.

### The shipped recipe file

The package ships `snippets/GURITA_USAGE.md` as `bundled/GURITA_USAGE.md`, read at run time. Only
the `###` blocks under its one recipe section, the `## Recipes` heading, are recipes, listed in
the file's order with no heading of their own on the page; the blocks under `## Manual use` are
for reading only, and the notes on running the `agy` lines stand as prose at the top of the
recipe section. A chain shipped for both harnesses is one recipe with one `####` variant per
copy, `Claude Code` first and `Antigravity` second, so its button runs the Claude Code copy until
a variant can be chosen; every other shipped recipe is one fenced block with no `####`
sub-heading, a recipe of one variant named by its heading.

Every chain in the file declares the one step it runs, once for the whole recipe, and spans no
other:

- **first review round**: `First run`, with a Claude Code and an Antigravity variant.
- **additional review round**: `Requirements iteration`, with a Claude Code and an Antigravity
  variant, and `Mixed-agent requirements review (Gemini reviews, Claude annotates)`, one block
  mixing `agy` and `claude` lines.
- **derive tasks**: `Prepare tasks`, the answer sweep and `derive-tasks`, with a Claude Code and
  an Antigravity variant.
- **execute tasks**: `Execute tasks`, whose three variants each hold one `complete-all-tasks` line
  alone: `Claude Code` (`opus` at `high`), `Antigravity` (`claude-opus-5-5` at `high`), and
  `Claude Code (critical tasks)` (`opus` at `xhigh`, since `high` is the ceiling on `agy`); and
  the looped recipe, `Execute tasks one at a time`, whose only line is the slot line
  `<single-task line>` (see the looped task run below). No execution chain holds an answer sweep
  or a `derive-tasks` line: a mission's tasks are derived by `Prepare tasks` before an execution
  chain completes them.
- **finish**: `Finish mission`, with a Claude Code and an Antigravity variant.

A page filling **derive tasks** thus lists `Prepare tasks` beside the two additional review round
chains, and one filling **execute tasks** `Execute tasks` and `Execute tasks one at a time`. No
shipped recipe declares **follow up tasks**. Besides the chains, the file carries the following,
none of which declares a step and each of which is one block:

- The seven button recipes, each one `claude` line named by the skill it invokes:
  `discuss-open-question`, `discuss-mission-goal`, `discuss-new-task`, `answer-open-question`,
  `answer-open-question-with-recommendation`, `answer-open-question-with-alternative`, and
  `define-mission-goal`. The buttons run the recipe of these fixed names; `discuss-new-task`'s
  one line is
  `claude "/gurita:discuss-new-task --mission <path> <issue description>" --dangerously-skip-permissions --model "fable" --effort xhigh; # interactive`,
  and `discuss-open-question`'s is
  `claude "/gurita:discuss-open-question --mission <path> <Short Title>. <note>" --dangerously-skip-permissions --model "fable" --effort xhigh; # interactive`.
- The single-task lines, each one headless line holding `<Task Title>`:
  `Single task with Opus xHigh (Claude Code)`, `Single task with Opus High (Claude Code)`, and
  `Single task with Opus High (Antigravity)`.

### Your own recipe file

You can keep recipes of your own in one Markdown file, by default `~/.gurita/recipes.md`, the
`~` standing for your home directory on every operating system. The user setting
`gurita.ownRecipesFile` changes the path; left empty, the default is read, and a leading `~` in
it is expanded. A missing file simply holds no recipe.

The file is a flat list of `###` recipes in the form above, each heading followed by a fenced
block of lines or by `####` variants; `##` headings in it are ignored, and of a recipe name
repeated in it only the first is read. An own recipe carrying the name of a shipped recipe, a
button recipe included, replaces neither that recipe nor any of its variants: its block, or each
of its variants when it writes several, joins the shipped recipe as one more variant, listed after
the shipped variants under its own variant name (a one-block own recipe's being the recipe's
name) and marked as your own. An own variant carrying a shipped variant's name is kept as a second
entry beside it, so every shipped variant stays, and the shipped variant stays the one the recipe
runs first. Every other own recipe is listed below the shipped recipes under **Your recipes**,
in the order your file lists them.
An own recipe may declare its step by a `Stage:` line, as a shipped one does (see the stage line
above), and is then listed only on the pages that step fits; an undeclared one is listed on every
page. For example:

````
### Review twice
Stage: additional review round
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
single-task line the rule file gives it. Every recipe whose first variant holds exactly one
headless line with `<Task Title>`, shipped or your own, counts as a named single-task line, named
by its `###` heading. In the preview you may
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
