# Gurita for VS Code

Gurita for VS Code (`gurita-vscode`) puts the Gurita plugin's live missions in a side-bar view
behind its own activity-bar entry and in one pane in the editor area: a page per live mission with its question view and remaining tasks, buttons that
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
- `claude` and, for the `agy` lines, `agy`, each with the Gurita plugin installed, on the
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
  run path, the pane's answer to a tab click, the recipe list and the fixed-name buttons it
  posts, with the variant selections it remembers, the harness check it runs, with the check script's print stubbed, and
  the harnesses it enables and disables, with their model and effort lists, and the variant
  edits it makes, the line editor's harness, model, and effort picks, with the `custom N` variants they
  add and the resets of stored variants, among them, and its single-task line
  edits, with the looped run's names and the variant a line's **Make default** picks following them, and the side-bar view's
  mission rows and their redraws and its two mission-starting rows with their runs and variant
  QuickPick, against a tree stand-in, are tested against a stub of the `vscode`
  module,
  and the page script against a small stand-in for the DOM. Nothing runs inside an editor.
- `npm run package` runs `vsce package`, which first runs the `vscode:prepublish` script: the
  compile, then `scripts/bundle.js`, the extension's own build step, which copies
  `core/tools/missions.py` and the extension's shipped recipe file, `gurita-vscode/shipped_recipes.md`,
  verbatim into a freshly emptied `bundled/` and writes `bundled/fixed_lines.tsv` from the `## Fixed console lines` table of
  `docs/skill-reference.md`, one `kind<TAB>line` row per table line, and
  `bundled/plugin_version.txt`, the repository's `VERSION` as one line. Every package therefore
  carries the missions tool, the recipes, the fixed lines, and the plugin version of the
  checkout it was built from.

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

## The side-bar view

The extension contributes an activity-bar entry, **Gurita**, its icon the tracked
`gurita-vscode/media/activity-bar.svg`, generated by hand from the repository root with
`uv run scripts/render_icon.py` and carried in the VSIX, holding one side-bar view, **Missions**: a native tree of rows
with no child rows, the two rows that start a mission, **New mission** and **Define mission**,
standing above one row per live mission, in the order `missions.py live` prints them.

The view's title bar carries **Refresh** as an icon action. It runs the command
**Gurita: Refresh Missions** (`gurita.refreshMissions`), which the Command Palette also offers:
it re-reads the live missions, every mission's documents, and the recipes, and redraws the tree
and every open window from that fresh read, in every state of the view.

### The rows that start a mission

**New mission** runs the `discuss-mission-goal` recipe and **Define mission** the
`define-mission-goal` recipe. Both rows stand at the top of the tree in every state of the view:
before the first read settles, with no mission live, while the live missions cannot be read, and
above the mission rows.

- The row's label is its control's name.
- Its description shows the harness, model, and effort of the variant remembered for its recipe,
  read from that variant's lines, for example `Claude Code · sonnet · medium` for the shipped
  `define-mission-goal`. A variant whose lines carry different values names each once, separated
  by commas, a value no line carries is left out (a Codex line has no effort), and a variant
  whose lines carry none of the three is described by its name.
- Its hover text names the recipe and the variant, with the variant's lines as written beneath
  them.
- A click on the row runs that variant: it asks for the goal and, for **Define mission**, then
  the scope, each in VS Code's own input box as the pane's buttons do, and starts the run, which
  belongs to no mission, at the project root. Escape in a box starts nothing.
- An inline icon action on the row, **Choose Variant**, also offered in the row's context menu,
  opens a QuickPick of the recipe's variants, each by its name with its harness, model, and effort
  beside it and the one selected marked. Picking one changes the remembered selection, kept once
  per project in the same map as the pane's **New mission** and **Define mission** dropdowns, and
  starts no run; dismissing the QuickPick changes nothing. A pick in either place shows at once
  in the other.
- The QuickPick offers the variants the pane's dropdown offers, so a variant with a line on a
  disabled harness is left out. A row whose every variant is left out reads `no variant enabled`,
  and one whose recipe cannot be read or run reads `cannot run`, each with the cause in its hover
  text and told in an error notification on a click or on the action.

The commands behind the two rows and the action (`gurita.newMission`, `gurita.defineMission`,
and `gurita.pickStartingVariant`) are hidden from the Command Palette.

### The mission rows

- The row's label is the mission's title.
- Its description is the next workflow step's name followed by the counts of its open questions
  and its remaining tasks, in a compact form such as `Derive tasks · 3 questions · 2 tasks`. The
  step is one of **First review round**, **Additional review round**, **Derive tasks**,
  **Execute tasks**, and **Finish**, chosen as the pane's workflow diagram chooses its filled
  block.
- Its icon spins while a run started for the mission is going, until you dismiss the run's
  terminal, and is a steady mission icon otherwise.
- Its hover text spells out all five facts in full beside the mission's path: the title, the
  next step, the number of open questions, the number of remaining tasks, and whether a run is
  going.
- Each step or count that could not be read is replaced, on its own, by `?` in its slot, for
  example `? · ? questions · 2 tasks` when `open_questions.xml` is missing, and the facts that
  did read are drawn as usual, so a failed read never shows as a zero count. The hover text then
  names the cause of each: the file that is missing or does not parse, with its path, or for the
  step a failed git read of the mission's `Requirements-review:` commits. The row gets no
  warning icon or colour.

A click on a mission row opens nothing yet. Showing the view for the first time starts the
extension's read of the live missions, as running a Gurita command does, and the tree is
redrawn on every re-read (after each burst of file events, each refresh, and each run's end)
and at every run's start and end. Until the first read settles, and while the live missions
cannot be read, the tree holds no mission row.

When the view has no mission row to draw it says why in its own message, above the two
mission-starting rows, with no placeholder row:
with no mission live the message is `No mission is live.`, and while the live missions cannot be
read it is `The live missions could not be read.` followed by the cause as the read gave it. A read
that lists missions clears the message, and the view's other contents stay as they are in every
state.

## Using the pane

Open the pane with the command **Gurita: Open Mission Pane** (`gurita.openMissionPane`) from the
Command Palette. Besides the side-bar view it is the extension's only entry point: there is no
status bar item or keybinding, the pane never opens by itself, and it does not
survive a restart or a window reload, so open it again after one. **Gurita: Refresh Missions**
(`gurita.refreshMissions`), the side-bar view's **Refresh** title-bar action, and the pane's
**Refresh** control re-read everything.

The project root is the top level of the git work tree holding the first workspace folder;
every other folder is ignored. The pane lists the live missions that `missions.py live` prints
from that root:

- A row of tabs across the top, one per live mission, each showing the mission's title with its
  path as a tooltip, and at its end the two mission-starting buttons, **New mission** (runs the
  `discuss-mission-goal` recipe) and **Define mission** (runs the `define-mission-goal` recipe),
  each with a dropdown of its recipe's variants beside it (see The buttons that run a recipe by
  its fixed name), and last the **Settings** control, which opens the settings view (see below).
- Under the selected tab, the mission's page: the workflow diagram, the recipe buttons of the
  recipes that fit the step its diagram fills, each with a dropdown of its variants beside it
  (see The recipes a page lists), the **New task** button with its dropdown in a row of its own,
  and directly beneath that row two
  panes behind one row of two headers, **Open questions**, holding the question view parsed from
  `open_questions.xml`, and **Remaining tasks**, holding the remaining task headings of
  `TASKS_TODO.md`. **New task** stands above the headers rather than inside either pane, so it is
  drawn on every mission page whichever pane is shown and whatever step the diagram fills. The two headers are of equal width and together
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

Every push button the pane draws has one look: the theme's primary button colour, the one the
recipe buttons carry, with a clearly visible 1px outline in the theme's contrast border colour,
or its foreground colour where the theme sets none, so each button stands out against the page
and its own fill alike. That covers the recipe buttons, **New mission**, **Define mission**,
**Start run**, the question card's **Discuss**, **Answer**, and **Answer with recommendation**,
every **Answer with this alternative**, **New task**, the settings view's edit controls
(**Enable** and **Disable**, **Add model**, **Add effort**, and **Remove**, **Duplicate**, **Rename**, **Delete**,
**Make default**, and **Reset**), and **Refresh**, **Settings**, **Close settings**, **Check
again**, **Previous**, **Next**, and **Close preview**. A disabled button is drawn faded. While
the settings view is shown, **Settings** is drawn in the theme's secondary button colour with a
ring in the focus colour around it, so it stays distinguishable from the other buttons. The
mission tabs, the two pane headers, and the links of a card's dependencies keep their own
unfilled look.

Every value a button needs (a goal, a scope typed as a path from the project root, an answer,
an issue description, a discussion note) is typed into VS Code's own input box, one line per
value. Only the discussion note may be left empty. A click on a recipe button starts its
run at once in a terminal; every recipe button shows its lines, placeholders included, before
you click. While a run started for a mission is going, until you dismiss its terminal, that
mission's page shows it: every action button on the page (the recipe buttons, the buttons on
the question card and its alternatives, a preview's **Start run**, and **New task**) is
disabled, and the workflow diagram's filled block pulses. The recipe dropdowns and the dropdowns beside the buttons that run a recipe by its fixed name, the tabs, the **Open questions** and
**Remaining tasks** headers, **Refresh**, the question view's **Previous** and **Next**, the
other missions' pages, **New mission** and **Define mission**, and **Settings** stay enabled, and the page is
drawn this way again whenever it is redrawn, after the pane was hidden and shown included.
Should a click still reach the extension for that mission, it starts nothing: a notification
says a chain is already running and the run's terminal is shown. Clicking a mission's tab,
whether or not it is the tab already selected, brings the terminal of that mission's run
forward and focuses it while a run started for the mission is going; when none is, the click
only shows the mission's page, with no notification.

The pane re-reads by itself after each of its runs, once you dismiss the run's terminal, and on
changes to any mission's `requirements.md`, `open_questions.xml`, or `TASKS_TODO.md`; git state
is not watched. The extension reads no mission and watches no file until the side-bar view is
first shown or a Gurita command first runs; from then the read and the watch last until the extension deactivates, kept current
whether the pane is shown, hidden, or closed, so a pane shown or opened again draws the latest
read at once. When the live missions cannot be read, the pane shows one line saying so with
the cause beneath it, and the two mission-starting buttons and **Settings** stay. When a single
mission document is missing or does not parse, only the part of the page drawn from it is
replaced by a notice naming the file.

### The settings view

The settings view is opened only by the **Settings** control at the end of the tab row, beside
**Refresh**, **New mission**, and **Define mission**; there is no command for it, and it is not a
tab. A click swaps whatever stands beneath the row, the selected mission's page or the failure
state, for the settings view, and the row stays as it was. **Close settings** on the view swaps
back to the mission page or failure state shown before, with the pane you had picked on it, and
a click on any mission tab swaps back to that mission's page. The view stays open through
refreshes and re-reads until you swap back, and while it is open no mission tab reads selected.
Like the rest of the page it holds buttons and dropdowns only: anything you type is asked for in
VS Code's own input box.

The view's parts stand one beneath the other under their headings: **Harnesses**, **Models and
efforts**, **Variants**, and **Single-task lines**. Under **Variants** each recipe is headed by its
name, and under **Single-task lines** each line by its name with the line's own controls beside
it. Beneath each such heading every variant, a **Deleted** one included, is drawn as a card of its
own: indented under the heading, with a vertical line down its left edge and space between one card
and the next, the card holding the variant's name, where it comes from, its controls, and its line
editor. The cards only set the recipes and lines apart from their variants; they change no control
and nothing the view stores.

#### The harness check

Under **Harnesses** the view lists Claude Code, Antigravity, and Codex, each with the result of
the harness check. The check is the packaged `harness_check.py`, beside `runner.py`, which the
extension runs with `python3` from the project root. In one session of the shell the runner
starts its chains in, it looks up each harness's CLI (`claude`, `agy`, `codex`) and, when found,
reads which Gurita copy that harness has installed (`claude plugin list --json`,
`agy plugin list --json`, `codex plugin list -m gurita --json`). The extension then compares each
installed copy's version with the plugin version the package was built from, the one
`scripts/bundle.js` recorded in `bundled/plugin_version.txt`. Beside each harness the view either
says that every check passes, with the version installed, or names the first of the three checks
that failed:

- **CLI not found**: the runner's shell finds no such command.
- **Gurita plugin not installed**: the harness lists no enabled Gurita copy for the project, or
  its listing could not be read, the reason shown after the check's name.
- **Installed version differs from the packaged one**: the installed and the packaged versions
  are both shown.

The check runs the first time you open the settings view after the pane is created. Its result
is kept while the pane stays open and is shown again at every later opening without the check
running again. **Check again** on the view runs it afresh. Neither **Refresh** nor any re-read of
the pane runs it. A failed check is shown only here. The mission pages still draw every variant,
the buttons that run a recipe of a fixed name, and the looped run exactly as they would if every
check passed, and a click runs the lines as written. When the check cannot run at all, the view
shows one line saying so, with the cause beneath it.

#### Enabling and disabling harnesses

Beside each harness the view also shows whether it is **Enabled** or **Disabled**, with one
control, **Disable** or **Enable**, that switches it. Every harness starts enabled, whatever its
check reports and whatever recipes run on it, and stays enabled until you disable it; the check
never changes it. The state is kept in your per-user variant store, `~/.gurita/variants.json`, in
the part of that file set aside for harness values, its `harnesses` object, as
`"<harness>": { "enabled": false }` keyed `claude`, `antigravity`, or `codex`, so it lasts across
the pane, the editor, and every project. When the file cannot be read, the view says so with the
cause beneath it and draws no control.

Disabling a harness acts on the mission pages' recipe lists alone. A variant with at least one
line on a disabled harness (a line opening with `claude`, `agy`, or `codex`) is left out of the
list, mixed variants included, so it leaves its recipe's dropdown and a click on it starts
nothing, and a recipe every variant of which is left out loses its button. Where the variant
selected for a recipe or its default is left out, the button stands on the default if that
variant is still listed and otherwise on the first listed variant; the remembered selection is
kept and comes back once the harness is enabled again. The buttons that run a recipe by its fixed
name (on the question card and its alternatives, **New task**, **New mission**, and **Define
mission**) are reached the same way: such a variant leaves the dropdown beside the button and a
click on it starts nothing, the button stands on its default or its first remaining variant as a
recipe button does, and a button left with no variant stays drawn but disabled, with no dropdown
beside it, until the harness is enabled again. The looped run is untouched: its preview's override
list offers every named single-task line, the rule file chooses among all of them, and every one
is passed to the runner.

#### Model and effort lists

Under **Models and efforts** the view holds each harness's model list and its one effort list
for the whole harness; Codex holds a model list and no effort list. The extension ships no list
of its own and queries no harness: each list is read, every time the view opens, from the values
the lines of the shipped recipes, your own recipes, and your stored variants carry, `--model` and
`--effort` on a `claude` or `agy` line and `-m` on a `codex` line, in the order they first appear.
Codex's model list therefore starts from the Codex lines you have. The list keeps no record of
which model takes which effort.

Each entry has a **Remove** control, which takes it out of the offer, and each list an **Add
model** or **Add effort** control, which asks for an entry no line uses yet in VS Code's own input
box; the box refuses an empty entry and one the list already offers. Your additions and removals
are stored as an overlay on the derived lists in the `harnesses` part of
`~/.gurita/variants.json`, as `addedModels`, `removedModels`, `addedEfforts`, and `removedEfforts`
beside the harness's `enabled` state. Adding a removed entry back takes it out of the removals, and
removing an entry you added takes it out of the additions. No recipe file is written. When the
lists cannot be read, the view says so with the cause beneath it.

#### Variants

Under **Variants** the view lists every recipe with its variants, read afresh every time the view
opens: the chains, the seven recipes the buttons outside the recipe list run by their fixed names,
and the recipes and variants of your own recipe file, in the order the mission pages list them,
with the recipes only your stored variants make up last. The named single-task lines are not
listed here but under **Single-task lines** below, and neither a recipe's stage nor a disabled harness leaves anything out. Each
variant shows its name, its lines in the name's hover text, and where it comes from (`shipped`,
`yours` for your own recipe file, `stored` for a duplicate or a `custom N` a line edit added, or
`stored copy of` the variant a rename made it stand in for), and the recipe's default is marked
**Default**. A button recipe carries a note
that its default is the variant its button runs until another variant is selected in the dropdown
beside the button.

Each variant has these controls, every one carried out in your per-user variant store,
`~/.gurita/variants.json`, and never in the shipped file or your own recipe file:

- **Duplicate** asks for the new variant's name and adds a copy of the variant's lines under it,
  listed after the recipe's other variants and remembering the variant it was made from.
- **Rename** asks for the new name, the box opening with the current name filled in. A shipped
  variant or one of your own recipe file gets a stored copy of the new name standing in for it in
  its place; a stored variant is renamed in the store. When the variant is the picked default,
  the pick goes with it to the new name.
- **Delete** takes the variant out of its recipe. A shipped variant or one of your own recipe file
  gets a record hiding it, and is then listed as **Deleted** with a **Reset** control alone; a
  stored duplicate leaves the store; a stored copy leaves it and hides the variant it stood in
  for. Deleting the picked default drops the pick, and the recipe falls back to its first listed
  variant.
- **Make default**, on every variant but the default, picks it as the recipe's default, the
  variant a mission page's dropdown, or the dropdown beside a fixed-name button, stands on while no
  selection is remembered for the recipe, and the one the looped run's single-task lines run.
- **Reset**, on a stored variant, a duplicate, a `custom N`, or a stored copy alike, returns its
  lines to those of the variant it was made from, as that variant's file or the store holds them
  now, and keeps its name, its place, and its entry in the store; a stored variant whose source is
  no longer listed, deleted from the store, has no **Reset**. On a variant listed as **Deleted**,
  **Reset** removes the hiding record, so the variant shows again as its file holds it.

A duplicate's name and a new name are each asked for in VS Code's own input box, one box per
value; the box refuses an empty name and one another variant of the recipe already carries, and
the name is kept with its outer spaces trimmed. Pressing Escape changes nothing. Every edit is
shown at once in the view and on the mission pages, whose recipe lists are read again, the
fixed-name buttons' dropdowns, labels, and hover text included, in the failure state too, so every
button runs the variant its label shows. An edit that cannot be made, or a variant store that cannot be read or written,
is told in an error notification and writes nothing. When the variants cannot be read, the view
says so with the cause beneath it.

Beneath each variant stands its line editor, one row per line. A line of a known harness
(`claude`, `agy`, or `codex`) that runs a `gurita:` skill is drawn as the skill's bare name
(`specify-mission-starting-state`, not the whole
`claude -p "/gurita:specify-mission-starting-state --mission <path>" …` line), with an
`interactive` mark beside it when the line is not headless (when it carries the `# interactive`
mark), and the line as written in its hover text; on the right of the row stand its harness
(Claude Code, Antigravity, or Codex) and then its dropdowns. Every other line, a shell step,
the slot line `<single-task line>`, or a command the extension does not know, is drawn as its
text. Only a line of a known harness carrying both `--model` and `--effort`, a `claude` or `agy`
line, gets a model dropdown and an effort dropdown, and its harness is a dropdown too, offering
Claude Code and Antigravity and standing on the one the line runs on (on a line drawn as its
text, it stands before the model dropdown); a `codex` line carrying `-m` gets its model dropdown
alone, since Codex holds no effort list, and keeps its harness as text, Codex not being offered
in the harness dropdown; every other line, a `claude` or `agy` line without both flags included,
gets no dropdown and stays read-only, its harness shown as text. Drawing the rows changes no line,
stored value, or mission page. The model dropdown offers the harness's model list and the
effort dropdown its whole effort list, as **Models and efforts** holds them, whatever the line's
model; each stands on the value the line carries, offered too when the list lacks it. A line
given an effort its model lacks is accepted and stops when it is run, with the harness's own
message, as a hand-written line does.

A model or effort pick replaces the value the line already carries, in the quoting it was written
in, and inserts no text into the line. A harness pick rewrites the line onto the picked harness:
the line keeps its prompt, its other flags, and its headless or interactive form, so
`claude -p "…"` becomes `agy -p "…"`, an interactive `claude "…"` becomes `agy -i "…"`, and back;
it takes the picked harness's first listed model, and it keeps its effort when that harness's
effort list offers it, taking its first listed effort otherwise (a `claude` line at `xhigh` lands
on `agy` at the first effort Antigravity's list holds, `medium` with the shipped lists). Both
lists are those **Models and efforts** holds. A pick, of any of the three, is written to
`~/.gurita/variants.json`. On a shipped variant or one of your own recipe file, `default`
included, the variant is left untouched and listed, and a stored variant named `custom N` is
added beside it, after the recipe's other variants, holding the changed lines, N the lowest number
from 1 that no variant of the recipe carries (`custom 1`, then `custom 2`, a number freed by a
delete taken again). The new variant is neither selected in any dropdown nor made the default, so
every button runs what it ran before until you select it or make it the default, and it remembers
the variant it was made from, which its **Reset** returns its lines to. On a stored variant, a
`custom N` included, the line is changed in the store and the variant keeps its name, so a second
pick on `custom 1` changes `custom 1`. Like every other edit, a pick is shown at once in the view
and on the mission pages.

#### Single-task lines

Under **Single-task lines** the view lists the named single-task lines the looped run takes,
read afresh every time the view opens: the shipped ones and those of your own recipe file alike,
in the order the looped run's preview offers them, with the lines only your store holds last.
Each line is headed by its name, the one `task_line_rules.txt` and the preview's override list use,
and beneath it stand its variants: its `default` (the one variant of a line of one block, as every
shipped line is), any variant of your own recipe file joining a shipped line of the same name, and
the `custom N` variants and duplicates you add, each shown as a recipe's variant is under
**Variants**: its name, its line in the name's hover text, where it comes from, **Default** on the
variant the looped run takes, and its line editor, so a line running a `gurita:` skill is drawn as
that skill's name (`complete-task`) with its harness on the right, and a line carrying both
`--model` and `--effort` gets its harness, model, and effort dropdowns. Every variant has the
controls a recipe's variant has, carried out in `~/.gurita/variants.json` and never in the shipped
file or your own recipe file:

- A pick in a variant's harness, model, or effort dropdown works as it does on any recipe's
  variant: on a shipped line or one of your own, `default` included, the variant is left untouched
  and a stored `custom N` holding the changed line is added beneath it under the same line name,
  neither made the default nor run until you make it so; on a stored variant the line is changed in
  place. A line rewritten onto the other harness stays a single-task variant of the same line.
- **Make default**, on every variant but the default, decides which variant the looped run passes
  as that line's `--line`, under the line's name, so a rule naming the line runs the variant you
  made the default; deleting the picked default drops the pick, and the line falls back to its
  first variant.
- **Duplicate**, **Rename**, **Delete**, and **Reset** on a variant work as under **Variants**: a
  duplicate is a further variant of the same line, a rename names the variant within the line and
  leaves the line's name alone, a deleted shipped or own variant is listed as **Deleted** with a
  **Reset** control alone, and a stored variant's **Reset** returns its line to that of the variant
  it was made from.

The line's own heading keeps its own **Duplicate**, **Rename**, and **Delete**, acting on the line
as the looped run takes it, its default:

- **Duplicate** asks for the new line's name and adds a stored line of that name holding the same
  line, listed after the others.
- **Rename** asks for the new name, the box opening with the current name filled in. A shipped
  line or one of your own recipe file gets a stored copy of the new name standing in for it in its
  place, with a **Reset** on the heading that removes the copy and shows the line again under its
  own name; a stored line, a stored copy included, is renamed in the store.
- **Delete** takes the line out. A shipped line or one of your own gets a record hiding it, and is
  then listed under its name with its variant marked **Deleted** and a **Reset** control alone that
  shows it again as its file holds it; a stored duplicate leaves the store; a stored copy leaves it
  and hides the line it stood in for.

A line's name is asked for in VS Code's own input box, which refuses an empty name and one any
recipe or line already carries (a variant's name, as under **Variants**, only one another variant
of the same line carries), since the looped run, the rule file, and the preview's override list name a
line by it alone. A stored line reaches the recipe list under its name exactly as a written one
does, so the looped run passes it as one `--line`, the rule file can name it, and the override
list offers it; the runner and the rule file are unchanged. A rule naming a line you renamed or
deleted leaves its task unresolved in the preview until you change the rule or reset the line.

## Recipes

A recipe is a `###` heading, its name, and one or more named variants, each a literal block of
lines. Each `####` sub-heading beneath the `###` heading names a variant, its lines those of the
first fenced block beneath the sub-heading:

````
### Execute tasks
Stage: execute tasks

#### Normal difficulty
```
claude "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "opus" --effort high; # interactive
```

#### Critical tasks
```
claude "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "opus" --effort xhigh; # interactive
```
````

A recipe with one fenced block and no `####` sub-heading is a recipe of one variant, named
`default`, in the shipped file and your own file alike, the named single-task lines included, so
every such recipe opens on a variant called `default` in its dropdown and in the settings view; a
recipe of several `####` variants, such as `Execute tasks` above, keeps the names written.
Nothing renames what you stored or selected before under such a variant's old name, the
recipe's name: a stored copy made under it no longer stands in for the variant, which shows again
beside it, a hiding record or a picked default naming it matches no variant, and a remembered
selection naming it is dropped as one naming a variant gone from the recipe. Once a recipe holds
a `####` sub-heading, only the blocks beneath its sub-headings are read, a block standing above
the first sub-heading included in none; a sub-heading with no fence beneath it is a variant of no
line, and of a variant name repeated within one recipe only the first is read. Headings inside a fence are lines, not headings. The
pane lists recipes from two files, the shipped file and your own file, and reads both in this
same form. A recipe's default is the variant picked for it in the settings view (see Variants
above), and while none is picked its first variant: the looped run's named single-task lines run
the default, and the recipe button on a mission's page and each button that runs a recipe by its
fixed name run the variant selected in the dropdown beside it, the default until you select
another (see The recipes a page lists and The buttons that run a recipe by its fixed name).

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
- beside them, when **derive tasks** is filled, and when **first review round** is filled while
  any question of the mission is open, every recipe declaring **additional review round**, and
  when **finish** is filled, every recipe declaring **follow up tasks**, the optional step you may
  take there instead of moving on;
- every undeclared recipe, whatever the step.

A page whose diagram fills no block, because a document or the git read the choice needs did not
read, lists every recipe. The page's other rules hold within that list as described below: the
shipped recipes come first and your own under **Your recipes** below them, a variant holding a
placeholder the page cannot fill is left off, and one holding a placeholder the extension does not
know is shown as a non-runnable entry when selected. The list follows the step, so it changes
whenever a run or a change to a mission document moves the diagram's filled block. The buttons
that run a recipe by its fixed name (on the question card and its alternatives, **New task**,
**New mission**, and **Define mission**) are offered whatever the step.

Under the page's **Recipes** heading the list is drawn in two parts. First come the shipped
recipes, one button each in the shipped file's order, with no heading of their own; an own recipe
carrying a shipped recipe's name joins that recipe's button rather than adding one. Then, under
**Your recipes**, come your own recipes that carry no shipped recipe's name, in your file's order,
the heading left out when there is none. Each button shows the recipe's name and, beneath it, the
name of the variant it runs, the one selected in its dropdown, always and exactly as the variant
is named, so a button says which variant a click runs: `Execute tasks` on its shipped
`Normal difficulty` variant reads `Normal difficulty` beneath its name, and a recipe of one
variant, such as `First run` or `Prepare tasks`, reads `default`. The button lists
no harness, model, or effort; those stay readable in its hover text, which shows the variant's
lines as written, and in the settings view (see Variants above).

Beside each recipe's button, or its non-runnable entry, stands a dropdown of the recipe's
variants, drawn as its arrow alone, since the button beside it already names the variant
selected. Opened, it lists the variants in the recipe's order, the shipped ones first, each by its
bare name, those of your own recipe file and your variant store carrying no mark of their own;
the settings view says where each comes from. It offers only the variants the page can draw: a
variant holding a placeholder the page cannot fill, or no line, is left out of it, and a recipe none of whose variants the page can draw
is not listed. The dropdown stands on the variant selected, and the button's label, its hover
text, and a click all follow it: a click runs the variant the dropdown shows, and picking another
variant starts nothing, so the dropdowns stay enabled while a run is going. The variant you select
is remembered per recipe name on each mission, keyed by the mission's path as the pane lists it,
in VS Code's storage for the open workspace (the extension's `workspaceState`), as a map from
mission path and recipe name to variant name; nothing is written into the project's tree, and the
selection lasts across closing the pane and the editor. A remembered selection always wins over
the recipe's default. With nothing remembered, or with the remembered variant one the page cannot
draw, the dropdown stands on the default, or on the first variant drawn when the page cannot draw
the default. When the remembered variant is gone from the recipe, taken out of your own recipe
file for instance, the selection is dropped and the button falls back to the recipe's current
default. Of variants sharing one name, a selection stands on the first. A click on a variant the
page's last list did not show selected starts nothing. The recipes of the buttons that run a
recipe by its fixed name are never listed on the page; those buttons carry their own dropdowns
(see below).

### The buttons that run a recipe by its fixed name

Seven buttons run a recipe by its fixed name, whatever the step: **Discuss**, **Answer**, and
**Answer with recommendation** on the question card, **Answer with this alternative** on each of
its alternatives, **New task**, and the two mission-starting buttons, **New mission** and **Define
mission**. They pick a variant as the recipe buttons do. Beside each stands a dropdown of its
recipe's variants, drawn as its arrow alone and listing, opened, the variants in the recipe's
order, each by its bare name with no mark for your own. Every **Answer with this alternative**
button has such a dropdown of its own beside it, one per alternative on the card, so each
alternative's button carries its own variant choice and no dropdown is shared between them. The
dropdown offers only the variants the button can run: a variant holding a placeholder the button has no value for, a looped variant,
one of no line, and one with at least one line on a disabled harness are left out of it.

The dropdown stands on the variant selected, and the button's label, its hover text, and a click
all follow it. Each button, every **Answer with this alternative** button included, standing on
its own dropdown's variant, shows its name and, beneath it, the name of the variant selected, always and exactly as the variant is
named, in the recipe buttons' form, with that variant's lines as written in its hover text, so
**Define mission** on the shipped `define-mission-goal` reads `default` beneath its name. A
click runs the variant the dropdown shows, and only when the pane's last post of the button stood
on that variant; picking another variant starts nothing, so these dropdowns stay enabled while a
run is going.

The variant you select is remembered in VS Code's storage for the open workspace (the extension's
`workspaceState`). For **Discuss**, **Answer**, **Answer with recommendation**, and **New task**
it is remembered per recipe on each mission, keyed by the mission's path, in the same map as the
recipe buttons' selections, so every card of a mission shares its selection. For each **Answer
with this alternative** button it is remembered per mission, question, and alternative, keyed by
the mission's path, the question's Short Title, and the Alternative Id, in a map of its own, so a
pick on one alternative leaves every other alternative's button, on that card and on every
other, where it stood, and a click runs the variant its own button stands on. For **New mission** and **Define mission**, which belong
to no mission, it is remembered once per project, as a map from recipe name to variant name. A
remembered selection always wins over the default picked in the settings view, and picking a new
default leaves it standing. With nothing remembered, or with the remembered variant left out of
the dropdown, the button stands on the default when the dropdown offers it and otherwise on the
first variant offered. When the remembered variant is gone from the recipe, deleted or renamed in
the settings view or taken out of your own recipe file, the selection is dropped and the button
falls back to the recipe's current default; a variant left out only because its harness is
disabled keeps its selection, which comes back once the harness is enabled again.

A button whose every variant it could run is left out for a disabled harness stays drawn but
disabled, its name alone, with no dropdown beside it and its hover text saying why. A button whose
recipe cannot be read or run at all (no recipe of its name, or no variant the button can fill)
shows its name alone with a hover text saying what the button does, and a click on it tells why
in an error notification. The two mission-starting buttons and their dropdowns are drawn the same
way in the failure state.

### The shipped recipe file

The shipped recipes are the extension's own file, `gurita-vscode/shipped_recipes.md`, which the
package ships as `bundled/shipped_recipes.md`, read at run time. The extension does not read
`snippets/GURITA_USAGE.md`: that file stays in the repository as a document for running the
chains by hand, holding the same recipes beside its `## Manual use` blocks with nothing checking
one copy against the other, and a change to the shipped recipes is made in
`gurita-vscode/shipped_recipes.md`. Only the `###` blocks under the shipped file's one recipe
section, the `## Recipes` heading, are recipes, listed in the file's order with no heading of
their own on the page, and the notes on running the `agy` lines stand as prose at the top of the
recipe section. Each chain is shipped once, not once per harness: a line is moved onto the other
harness from its harness dropdown in the settings view (see Variants above), so no recipe is
grouped into one copy per harness. Three shipped recipes hold `####` variants:
`Requirements iteration` (`default` and `Mixed-agent (Gemini reviews, Claude annotates)`),
`Prepare and Execute tasks`, and `Execute tasks` (each `Normal difficulty` and
`Critical tasks`); every other shipped recipe is one fenced block with no `####` sub-heading, a
recipe of one variant named by its heading. A stored copy of
a variant the file no longer holds, such as an `Antigravity` variant an earlier copy of the file
shipped, stays listed as a stored variant of its recipe, after the shipped one.

Every chain in the file declares the one step it runs, once for the whole recipe, and spans no
other:

- **first review round**: `First run`, one block of `claude` lines.
- **additional review round**: `Requirements iteration`, whose `default` variant is one block of
  `claude` lines (the answer sweep, a review, the alternatives pass, and an interactive
  recommendation pass) and whose second variant, `Mixed-agent (Gemini reviews, Claude annotates)`,
  mixes `agy` and `claude` lines: an `agy` review followed by the `claude` alternatives pass,
  recommendation pass, and answer sweep.
- **derive tasks**: `Prepare tasks`, the answer sweep and `derive-tasks`, one block of `claude`
  lines; and `Prepare and Execute tasks`, whose two variants, `Normal difficulty` and
  `Critical tasks`, each hold those two lines followed by the `complete-all-tasks` line of the
  `Execute tasks` variant of the same name.
- **execute tasks**: `Execute tasks`, whose two variants each hold one `claude`
  `complete-all-tasks` line alone: `Normal difficulty` (`opus` at `high`) and `Critical tasks`
  (`opus` at `xhigh`). No execution chain holds an answer sweep or a `derive-tasks` line: a
  mission's tasks are derived by `Prepare tasks`, or by the first lines of
  `Prepare and Execute tasks`, before an execution chain completes them.
- **finish**: `Finish mission`, one `claude` line.

A page filling **derive tasks** thus lists `Requirements iteration`, `Prepare tasks`, and
`Prepare and Execute tasks`; one filling **first review round** lists `Requirements iteration`
beside `First run` while a question is open, such as on a mission whose first review left
questions lacking alternatives or a pick, and `First run` alone on a fresh mission with no open
question; one filling **additional review round** lists `Requirements iteration` alone; one
filling **execute tasks** lists `Execute tasks`; and one filling **finish** lists
`Finish mission`. No shipped recipe is looped, so the looped task run is reached through a recipe
of your own whose last line is the slot line `<single-task line>` (see the looped task run
below), and no shipped recipe declares **follow up tasks**. Besides the chains, the file carries the following,
none of which declares a step and each of which is one block:

- The seven button recipes, each one `claude` line named by the skill it invokes:
  `discuss-open-question`, `discuss-mission-goal`, `discuss-new-task`, `answer-open-question`,
  `answer-open-question-with-recommendation`, `answer-open-question-with-alternative`, and
  `define-mission-goal`. The buttons run the recipe of these fixed names; `discuss-new-task`'s
  one line is
  `claude "/gurita:discuss-new-task --mission <path> <issue description>" --dangerously-skip-permissions --model "fable" --effort high; # interactive`,
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
the shipped variants under its own variant name (a one-block own recipe's being `default`) and
marked as your own. An own variant carrying a shipped variant's name is kept as a second
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
variant holding any other known placeholder is left off the page's list, a recipe every variant
of which is left off is not listed, and the recipe stays reachable by name for the button or loop
that fills it. A variant
holding a placeholder name the extension does not know is shown, while selected, as a non-runnable
entry naming that placeholder and the file it came from.

Values never enter a line's text: each placeholder is written as a reference to a session
variable set in the run's environment, named `GURITA_` followed by the placeholder upper-cased
with spaces turned into underscores: `GURITA_PATH`, `GURITA_TASK_TITLE`, `GURITA_SHORT_TITLE`,
`GURITA_ALTERNATIVE_ID`, `GURITA_GOAL`, `GURITA_SCOPE`, `GURITA_ANSWER_TEXT`,
`GURITA_ISSUE_DESCRIPTION`, and `GURITA_NOTE`. A shell step
in your own recipe may read them as `"$GURITA_TASK_TITLE"` and the like.

## The looped task run and the rule file

The shipped file holds no looped recipe: you write one in your own recipe file, for instance

````
### Execute tasks one at a time
Stage: execute tasks
```
<single-task line>
```
````

A click on a looped recipe (one whose last line is the slot line `<single-task line>`) runs
nothing yet: it shows a preview on the mission's page listing each remaining task with the
single-task line the rule file gives it. Every recipe whose default variant holds exactly one
headless line with `<Task Title>`, shipped, your own, or stored in the settings view, counts as a
named single-task line, named by its `###` heading or the name the settings view gave it. In the
preview you may
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
