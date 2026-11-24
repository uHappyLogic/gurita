# Gurita for VS Code

Gurita for VS Code (`gurita-vscode`) puts the Gurita plugin's live missions in a side-bar view
behind its own activity-bar entry and in a window per mission in the editor area: each mission's page with its question view and remaining tasks, buttons that
run the plugin's skills as recipes in a terminal, and a looped task run that completes a
mission's tasks one at a time. It drives the `claude` and `agy` command-line tools with the
Gurita plugin installed in them; it does not replace the plugin.

![A sample mission opened from the Gurita side-bar view, and its First run recipe running in a terminal while the mission's page follows it](media/demo.gif)

The extension runs only on macOS, Linux, or through Remote-WSL. On native Windows it shows one
message saying so and leaves its view, windows, and runner inert; in a Remote-WSL window it runs
on the Linux side and works as it does on Linux.

To build the extension from a checkout of the Gurita repository instead, see
[BUILDING.md](https://github.com/uHappyLogic/gurita/blob/main/gurita-vscode/BUILDING.md).

## What the extension needs

- VS Code 1.107.0 or later, or an editor built on VS Code 1.107.0 or later.
- `python3`, 3.9 or later, on `PATH`: the extension runs the bundled missions tool and its own
  runner with it. No Node install is needed.
- `git`: the project root is the top level of a git work tree.
- `claude` and, for the `agy` lines, `agy`, each with the Gurita plugin installed, on the
  `PATH` of the shell the runner starts. The Settings window can install or update the plugin
  for you (see Installing and updating the plugin below).
- macOS or Linux. On Windows only through Remote-WSL, where the extension runs on the Linux side.

## Installing

Install the extension from the Extensions view by searching for **Gurita for VS Code**, or from
the command line:

```
code --install-extension BusyMinds.gurita-vscode
```

The installed extension's id is `BusyMinds.gurita-vscode`, and its version is the extension's
own, independent of the Gurita plugin's. To remove it, run
`code --uninstall-extension BusyMinds.gurita-vscode`.

## The side-bar view

The extension contributes an activity-bar entry, **Gurita**, its icon three octopus arms,
holding one side-bar view, **Missions**: a native tree of rows
with no child rows, the two rows that start a mission, **New mission** and **Define mission**,
standing above one row per live mission, in the order `missions.py live` prints them.

The view's title bar carries **Refresh** as an icon action. It runs the command
**Gurita: Refresh Missions** (`gurita.refreshMissions`), which the Command Palette also offers:
it re-reads the live missions, every mission's documents, and the recipes, and redraws the tree
and every open window from that fresh read, the Settings window included, in every state of the
view. Beside it stands **Settings**, a gear icon action that opens the Settings window (see The
Settings window below), or brings it forward when it is already open; its command
(`gurita.openSettings`) is hidden from the Command Palette.

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
- Its hover text names the recipe, as `Action: <name>`, and the variant, with the variant's
  lines as written beneath them.
- A click on the row runs that variant: it asks for the goal in the input panel and, for
  **Define mission**, then the scope in VS Code's own input box, as a mission page's buttons ask
  for theirs, and starts the run, which belongs to no mission, at the project root. **Cancel** or
  closing the panel's tab, like Escape in the box, starts nothing.
- An inline icon action on the row, **Choose Variant**, also offered in the row's context menu,
  opens a QuickPick of the recipe's variants, each by its name with its harness, model, and effort
  beside it and the one selected marked. Picking one changes the remembered selection, kept once
  per project as a map from recipe name to variant name, and starts no run; dismissing the
  QuickPick changes nothing. The row shows the pick at once.
- The QuickPick offers only the variants the row can run, so a variant holding a placeholder the
  row has no value for, a looped variant, one of no line, and one with a line on a disabled
  harness are left out. A row whose every variant is left out reads `no variant enabled`,
  and one whose recipe cannot be read or run reads `cannot run`, each with the cause in its hover
  text and told in an error notification on a click or on the action.

The commands behind the two rows and the action (`gurita.newMission`, `gurita.defineMission`,
and `gurita.pickStartingVariant`) are hidden from the Command Palette.

### The mission rows

- The row's label is the mission's title.
- Its description is the next workflow step's name followed by the counts of its open questions
  and its remaining tasks, in a compact form such as `Derive tasks · 3 questions · 2 tasks`. The
  step is one of **First review round**, **Additional review round**, **Derive tasks**,
  **Execute tasks**, and **Finish**, chosen as a mission window's workflow diagram chooses its
  filled block.
- Its icon spins while a run started for the mission is going, until the run's terminal
  closes, and is a steady mission icon otherwise.
- Its hover text spells out all five facts in full beside the mission's path: the title, the
  next step, the number of open questions, the number of remaining tasks, and whether a run is
  going.
- Each step or count that could not be read is replaced, on its own, by `?` in its slot, for
  example `? · ? questions · 2 tasks` when `open_questions.xml` is missing, and the facts that
  did read are drawn as usual, so a failed read never shows as a zero count. The hover text then
  names the cause of each: the file that is missing or does not parse, with its path, or for the
  step a failed git read of the mission's `Requirements-review:` commits. The row gets no
  warning icon or colour.

A click on a mission row does nothing beyond opening that mission's own window in the editor area
(see The mission windows below), or bringing it forward when it is already open; the command
behind the click (`gurita.openMission`) is hidden from the Command Palette. Showing the view for
the first time starts the
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

## The mission windows

A click on a mission's row in the side-bar view opens that mission's own window in the editor
area, titled with the mission's title, or brings it forward when it is already open, so a mission
never has two windows. Several missions' windows stand open at once, each showing that one
mission's page with no tab row, and you close one as you close any editor tab. Each window's
editor tab shows the mission's title alone and the rocket codicon (on an editor built on VS Code
1.108.0 or later; on an older one the tab draws no icon); while another live mission
carries the same title, each of those tabs adds its mission's scope after a dash, such as
`Shared title — lib`, and the tabs are re-titled on every re-read. Besides the
side-bar view there is no entry point: the Command Palette offers no command opening a window,
there is no status bar item or keybinding, and no window opens by itself. The windows survive a
restart or a window reload: every mission window that was open comes back in the editor group
and tab position it held, its page redrawn from a fresh read of the live missions and its
question view where you left it, and a window that comes back for a mission whose window is
already open, or whose saved state cannot be read, is closed.
**Gurita: Refresh Missions** (`gurita.refreshMissions`) and the side-bar view's **Refresh**
title-bar action re-read everything and redraw every open window; of the extension's own
commands that refresh command is the only one the Command Palette offers.

The project root is the top level of the git work tree holding the first workspace folder;
every other folder is ignored. The extension reads the live missions that `missions.py live`
prints from that root once for the whole session, and every open window draws its mission from
that one read. A mission's window holds no **Refresh**, **New mission**, or **Define mission**
control: those belong to the side-bar view (see The side-bar view above). Its editor title bar
carries **Settings**, a gear icon action that opens the Settings window, or brings it forward,
exactly as the side-bar view's gear does (see The Settings window below); it stands there in
every state of the window, on the mission's page, the failure state, and the notice alike, and
the page itself draws no Settings control. Its page opens on an introduction, then holds the
workflow diagram under a heading of its own, **Workflow**, marking where it starts, the recipe
buttons of the recipes that fit the step its diagram fills, each on a row of its own with a dropdown of its variants beside it
and the recipe's one line of description to its right (see The recipes a page lists), the row of mission-wide actions, **New task** and **Ask in mission context**, each
with its dropdown, and directly beneath that row two panes behind one row of two headers, **Open questions**, holding the question view
parsed from `open_questions.xml`, and **Tasks**, holding the mission's tasks in two parts, each
under a heading of its own. The first, **Remaining tasks**, heads the pane and holds the remaining
tasks of `TASKS_TODO.md` in the list's order, each task's `##` heading with its brief, the
section's text down to its `---` separator, beneath it, drawn by the text renderer the goal uses,
described below (a task whose brief is empty shows its heading alone). Beneath it, **Completed
tasks** holds the mission's completed tasks behind one **Show completed tasks** button beside its
heading, hidden by default, which shows them and turns into **Hide completed tasks**, which hides
them again. They are read with the bundled missions tool's `tasks <path> --with-body`, one per
`Task-completion:` commit that changed the mission's directory, newest first as the tool prints
them, each its title, the task's `##` heading as the commit's subject carries it, with its
verified bar, the commit's body, beneath it, drawn by the same text renderer, so the bar's `- `
bullets show as a bulleted list (a commit with no body shows its title alone). Between the title
and the bar stands a link to the task's commit, **Open commit** followed by its abbreviated hash,
which opens that commit inside VS Code as one read-only text document in an editor tab of its own:
the extension serves it through a content provider of its own `gurita-commit` scheme, whose content
is `git show <hash>` run from the project root, and opens it with the diff language, so the tab
holds the commit's subject, the verified bar as its body, and the whole patch, the task's brief
among the removed lines of `TASKS_TODO.md`. No remote host is involved and no other extension is
called, and a commit git cannot read shows "The commit could not be read." with git's message
beneath it. No task completed
yet shows "No task is completed.", and a read that fails shows "The completed tasks could not be
read." with the tool's error line beneath it. They are read again with the mission's other facts,
so a task completed while the window is open appears once its commit lands. Like the goal, they
are hidden every time the page loads: they stay shown through every redraw while the page stays
shown, but whether they are shown is not saved. The introduction shows the mission's title alone, the first `# ` heading of its
`requirements.md`, with one **Show goal** button beside it that shows the whole goal beneath the
title, the `## Goal` section of `requirements.md` as it stands there, and turns into **Hide goal**,
which hides it again. The button is there whatever the goal's length, and a goal however long is
shown whole, with no cut-off and no scrolling area of its own. The goal is drawn by the same small
text renderer as the question cards: paragraphs separated by a blank line show as paragraphs,
consecutive `- ` lines as a bulleted list, and text between two backticks as code, while emphasis,
links, headings, and numbered lists show as plain text. The goal is hidden every time the page
loads: it stays shown through every redraw while the page stays shown, but whether it is shown is
not saved, so opening the window again, showing it again after it was hidden, or the failure
state or the notice below standing in between, hides it afresh. The row of mission-wide actions stands above the headers rather than inside either pane, so
**New task** and **Ask in mission context** are drawn on every mission page whichever pane is
shown and whatever step the diagram fills. The two
headers are of equal width and together fill the window's whole width, and only the selected
pane's content is shown beneath them. A page opens on **Tasks** when git holds at least
one `Requirements-review:` commit for the mission (the count the workflow diagram reads) and no
question is open, and on **Open questions** otherwise, a failed git read included. A header you
click stays selected through every redraw and every refresh from file events while the page
stays shown; it is not saved, so opening the window again, showing it again after it was hidden,
or the failure state or the notice below standing in between, opens the page on its default
afresh. The diagram shows the choices you make, not the plugin's inner steps, as one line of
seven blocks joined by arrows: **define**, **first review round**, **additional review round**,
**derive tasks**, **execute tasks**, **follow up tasks**, and **finish**. The two optional
blocks, **additional review round** and **follow up tasks**, have a dashed border and the five
required ones a solid border. The diagram is centered in the window and lies in one horizontal
row while that row fits the window's width; in a window too narrow for the row, the same blocks
stack vertically, joined by downward arrows and likewise centered, each block keeping its border
and its fill, and the diagram goes back to the row once the window is wide enough again, never
wrapping or scrolling sideways. The additional review round reads plain while git holds at most
one `Requirements-review:` commit for the mission and then carries the count of those beyond the
first: **additional review round 1** at two, **2** at three, and so on. The block of the step to
run next is filled purple: **first review round** for a defined mission with no open question,
no task, and no review commit, and while a question lacks alternatives or a pick and at most one
review commit stands; **additional review round** while a question lacks alternatives or a pick
and two or more stand; **derive tasks** when every open question has a pick, or when none is open
and no task exists on a defined mission whose review commit stands; **execute tasks** while tasks
remain and no question is open; and **finish** for a started mission with no open question and
no task. **define** and **follow up tasks** are never filled, and an open question outranks a
remaining task. A review pass that changed nothing leaves no commit, so the diagram does not
count it. No block is filled when a document or the git read the choice needs does not read; a
document's notice stays in its own pane. The diagram is display only: its blocks are not buttons
and gate nothing. **New task** runs the `discuss-new-task` recipe for the page's mission: you
type the issue in the input panel, and an interactive conversation clarifies it into tasks and adds them to the
mission's task list through `submit-task` inside that same conversation, so there is no separate
submit button. **Ask in mission context** runs the `ask-in-mission-context` recipe for the page's
mission: you type your question before the run starts, an empty question being refused, and an
interactive session opens on the answer, drawn from the mission's goal, decisions, task lists,
and live deliverables, and stays open for follow-up questions, editing nothing. The question view shows one fully opened card per question, one at a time under a
position counter such as `3 / 12`: **Previous** and **Next**, or the left and right arrow keys,
move between the cards, **First**, before **Previous**, jumps straight back to the first card,
and a dependency on a card links to the named question's card. Each card
stacks the question text in an area of fixed height, so the pick starts at the same height on
every card, then the pick and its rationale, the alternatives, the dependencies, and the
principles, and carries **Discuss** and **Answer** buttons and an **Answer with this
alternative** button on each alternative. Each alternative's id stands alone on its head line,
and directly beneath it, above the alternative's text, a row of its own holds that
alternative's **Answer with this alternative** button, its label reading the title and then the
selected variant's name on one line, with its variant dropdown beside it. The question, the pick's rationale, and each
alternative's text, advantages, and drawbacks are drawn by the extension's own small text
renderer: text between two backticks, such as a file name or a command, shows as code in the
editor's font with no backticks around it, and nothing else is read as markup: emphasis, links,
headings, and list markers in these texts show as plain text, each text stays one block, and a
backtick with no closing one shows literally. **Discuss** always asks for an
optional note first: a note you type is carried to the discussion directly after the Short
Title, as `--mission <path> <Short Title>. <note>`; an empty note starts the discussion of the
question alone, and Escape starts nothing. After a run removes a question the view keeps its
place in the list.

Every push button a mission window draws has one look: the theme's primary button colour, the
one the recipe buttons carry, with a clearly visible 1px outline in the theme's contrast border
colour, or its foreground colour where the theme sets none, so each button stands out against the
page and its own fill alike. That covers the recipe buttons, **Start run**, the question card's
**Discuss** and **Answer**, every **Answer with this alternative**, **New task**, **Ask in mission context**, **Show goal** and **Hide goal**, **Show completed tasks** and **Hide completed tasks**, **First**, **Previous**, **Next**, and **Close preview**, and in the Settings
window its edit controls (**Enable** and **Disable**, **Add model**, **Add effort**, and
**Remove**, **Duplicate**, **Rename**, **Delete**, **Make default**, and **Reset**) and **Check
again**. A disabled button is drawn faded. The two pane headers, the links of a card's
dependencies, and the completed tasks' **Open commit** links keep their own unfilled look.

Every value a button needs is typed before its run starts, nothing being typed on a mission page.
The long ones, an answer, an issue description, and for the side-bar view's rows a goal, are
typed into the input panel: a small window of its own opened as an editor tab, titled
**Gurita: Answer**, **Gurita: Issue**, or **Gurita: Goal**, holding the value's prompt above one
textarea, where the text may run over several lines, with **Run** and **Cancel** beneath it.
**Run** starts the run with the text exactly as typed, line breaks included, and closes the
panel; a **Run** with nothing but blanks typed is refused with a line beneath the textarea and
the panel stays open. **Cancel**, or closing the panel's tab, starts nothing, as Escape in an
input box does. Text typed in a panel whose tab you leave and come back to is still there, but
a panel open when VS Code restarts or the window reloads is not restored, and its run is not
started. The other values, a question, a discussion note, and for **Define mission** a scope
typed as a path from the project root, are typed into VS Code's own input box, one line per
value, as are the Settings window's names and list entries. Only the discussion note may be left
empty. A click
on a recipe button starts its run at once in a terminal; every recipe button shows its lines,
placeholders included, before you click. While a run started for a mission is going, until its
terminal closes, that mission's page shows it: every action button on the page (the recipe
buttons, the buttons on the question card and its alternatives, a preview's **Start run**,
**New task**, and **Ask in mission context**) is disabled, the workflow diagram's filled block pulses, and beneath the diagram an
indicator says that the mission is waiting for its run's terminal to close. The indicator's space
is kept on the page whether or not a run is going, so its showing and hiding moves none of the
page's content. The recipe dropdowns
and the dropdowns beside the buttons that run a recipe by its fixed name, **Show goal** and
**Hide goal**, **Show completed tasks** and **Hide completed tasks**, each completed task's **Open commit** link, the **Open questions** and **Tasks** headers, the question view's **First**, **Previous**, and **Next**, and every other
mission's window stay enabled, and the page is drawn this way again whenever it is redrawn, after
the window was hidden and shown included. Should a click still reach the extension for that
mission, it starts nothing: a notification says a chain is already running and the run's terminal
is shown.

Beneath the run indicator, a mission's page shows what would stop a run before you start it, as up to two
notices, each only while its condition holds and gone with the next re-read once it no longer
does. The first stands while the mission's scope is held:
`The scope is held by another started mission or could not be checked, so a run that derives, adds, or completes tasks would stop.`
It is read with the bundled missions tool's `gate <path>`, the same check `derive-tasks`,
`submit-task`, `complete-task`, and `complete-all-tasks` run before their work, and it shows
whenever that call prints anything: beneath its line stand the paths of the other started missions
holding the scope, or the tool's `Error:` line when the gate could not be checked, such as in a
shallow clone. The second stands while the mission's `requirements.md` or `open_questions.xml`
holds an uncommitted change, staged, unstaged, or untracked:
`requirements.md or open_questions.xml holds an uncommitted change, so the answer sweep would stop.`
Beneath it stand the `git status --porcelain` lines of those two files, the same lines the answer
sweep's guard prints when it stops; commit or discard the changes and the notice goes. Both
conditions are read with the mission's other facts on every re-read, after a run's terminal
closes, on a change to a mission document, on a commit, pull, or branch switch, and on
**Refresh**; a git read that fails shows no changes notice. The notices are display only and
disable nothing: a run started while one shows stops as the plugin stops it.

Each time a mission's window becomes the active editor while that mission's run is going, the
run's terminal comes forward without taking the focus, so the window stays active: whether you
reach the window by a click on its row in the side-bar view, a click on its editor tab, or
keyboard navigation between editors, and when a click on its row opens it afresh. Neither the
side-bar view nor the mission's page draws a control for bringing the terminal forward.

The live missions are re-read by themselves after each run, once the run's terminal closes,
and on changes to any mission's `requirements.md`, `open_questions.xml`, or `TASKS_TODO.md`. Git
state is watched beside them: in the repository's git directory, as
`git rev-parse --absolute-git-dir` gives it, the extension watches `HEAD`, `packed-refs`, and the branch refs
under `refs/heads/` (a linked worktree's `HEAD` in its own git directory and its branch refs in the
`--git-common-dir` it shares), and leaves lock files, the index, objects, and remote refs
unwatched. So a commit, a pull, or a branch switch made outside the extension's runs, in a terminal
or another tool, re-reads everything **Refresh** re-reads, after the same short pause that gathers
a burst of file changes into one re-read, and a mission's next step, its review-round count, and
whether it is started no longer stay stale until you press **Refresh**. No other extension is used
for it. The extension reads no mission and watches no file until the side-bar view
is first shown or a Gurita command first runs; from then the read and the watch last until the
extension deactivates, kept current whether a window is shown, hidden, or closed, so a window
shown or opened again draws the latest read at once. While the live missions cannot be read,
every open window replaces its whole page with one line saying so,
`The live missions could not be read.`, and the cause beneath it, drawing no diagram, recipe, pane, or button, so nothing can
be clicked against a failed read; each window stays open and draws its mission's page again on
the next read that succeeds. A window whose mission stops being live, finished or its directory
otherwise gone, stays open and shows one fixed notice, `This mission is no longer live.`, with no
diagram, recipe, pane, or action button, until you close it; should a later read list the path
again, after a reverted finish or a branch switched back, the window draws that mission's page
again. When a single mission document is missing or does not parse, only the part of the page
drawn from it is replaced by a notice naming the file.

## The Settings window

The settings open in a window of their own in the editor area, titled **Gurita Settings** and
belonging to no mission. The **Settings** gear in the side-bar view's title bar, beside
**Refresh**, opens it, or brings it forward when it is already open, so there is never more than
one, and so does the same gear in every mission window's editor title bar, which runs the same
command; that command is hidden from the Command Palette, and no mission's page draws a Settings
control. You
close it as you close any editor tab, and it has no close control of its own. The window holds
buttons and dropdowns only: anything you type is asked for in VS Code's own input box. Every
edit you make in it shows at once on every other surface: the mission pages, their dropdowns and
the buttons that run a recipe by its fixed name, are posted again with their recipes re-read,
and the side-bar view's **New mission** and **Define mission** rows are redrawn from the variant
they now run. **Refresh** re-reads the window too, its lists read afresh, without running the
harness check. Like the mission windows it survives a restart or a window reload: when it was
open it comes back in the editor group and tab position it held, redrawn from fresh reads, and a
second one coming back while it is already open is closed.

The window's parts stand one beneath the other under their headings: **Harnesses**, **Models and
efforts**, **Variants**, and **Single-task lines**. Under **Variants** each recipe is headed by its
name, and under **Single-task lines** each line by its name with the line's own controls beside
it. Beneath each such heading every variant, a **Deleted** one included, is drawn as a card of its
own: indented under the heading, with a vertical line down its left edge and space between one card
and the next, the card holding the variant's name, where it comes from, its controls, and its line
editor. The cards only set the recipes and lines apart from their variants; they change no control
and nothing the window stores.

### The harness check

Under **Harnesses** the window lists Claude Code, Antigravity, and Codex, each with the result of
the harness check. The check is the packaged `harness_check.py`, beside `runner.py`, which the
extension runs with `python3` from the project root. In one session of the shell the runner
starts its chains in, it looks up each harness's CLI (`claude`, `agy`, `codex`) and, when found,
reads which Gurita copy that harness has installed (`claude plugin list --json`,
`agy plugin list --json`, `codex plugin list -m gurita --json`). The extension then compares each
installed copy's version with the plugin version the package was built from, the one
recorded in the package's `bundled/plugin_version.txt`, as a minimum: a copy equal to or
newer than it passes and an older one fails, the versions ordered as bare MAJOR.MINOR.PATCH, and a
version in any other form failing. The check compares with that packaged version alone and reads
nothing over the network. Beside each harness the window either says that every check passes,
with the version installed, or names the first of the three checks that failed:

- **CLI not found**: the runner's shell finds no such command.
- **Gurita plugin not installed**: the harness lists no Gurita copy for the project, or its
  listing could not be read, the reason shown after the check's name. A copy the harness lists
  installed but disabled is told apart from this, as described below.
- **Installed version older than the packaged one**: the installed and the packaged versions
  are both shown.

For Claude Code the check also reads at which scopes a `gurita@gurita` copy applying to the
project is installed: the `user` scope, and the `project` and `local` scopes recorded for the
project root, copies recorded for other project roots not counting. The most specific of them,
`local` over `project` over `user`, wins, and `harness_check.py` prints every such scope, the
winning one first, together with which scope won and whether its copy is disabled. Beside Claude
Code the window then names the scopes: the winning scope first, as the one in effect, and the
others after it as also installed, for example `In effect at project scope; also installed at
user scope.` It shows one version, the winning copy's, and none for a scope that does not win.
When the winning copy is disabled, its scope is marked disabled, even beside an enabled copy at a
less specific scope, and in place of **Gurita plugin not installed** the window says the copy in
effect is disabled and must be enabled in Claude Code itself, through its `/plugin` menu or
`claude plugin enable`; the window adds no control of its own to enable it.

Antigravity and Codex likewise each report a disabled copy as a state of its own, installed but
disabled, beside not installed and installed: `harness_check.py` prints `disabled` for every
harness, true when Antigravity's `gurita` entry or Codex's installed `gurita@gurita` entry reads
`enabled` false. In place of **Gurita plugin not installed** the window then says the copy is
disabled and must be enabled in the harness itself, on Antigravity with `agy plugin enable gurita`
and on Codex through its own plugin settings, and again adds no control of its own to enable it.

For Claude Code and Codex the check also reads where the Gurita plugin comes from, in the same
session (`claude plugin marketplace list --json`, `codex plugin marketplace list --json`). The
plugin comes from another source when the marketplace named `gurita` is not the harness's
distribution repository, `uHappyLogic/gurita-claude` or `uHappyLogic/gurita-codex` at any ref,
for example a local checkout registered as a directory marketplace under the same name, or when,
with that marketplace not another source, Claude Code's copy applying to the project is read from
a folder or Codex's copy names another marketplace source; no `gurita` marketplace counts as no
other source. `harness_check.py` prints Claude Code's and Codex's `source`, null for the
distribution repository and otherwise the source found, for example `the directory
/path/to/checkout`, and a marketplace listing that cannot be read is reported like an unreadable
plugin listing. Beside the harness the window then states the source found and the CLI commands
that would switch the harness to its distribution repository, for example for Claude Code:

```
claude plugin marketplace remove gurita
claude plugin marketplace add uHappyLogic/gurita-claude
claude plugin install gurita@gurita --scope user
```

The marketplace's removal uninstalls the copies installed from it, so Claude Code's commands
install the copy again at each scope one was detected at, and Codex's end with
`codex plugin add gurita@gurita` when a copy is held, enabled or disabled. The status line and
its checks are unchanged by the source. Antigravity's listing names no source, so its copy is
reported as before.

The check runs the first time you open the Settings window after the extension starts. Its
result is kept in the extension, with no timestamp and nothing stored, for the rest of that
session: closing the window and opening it again, or showing it again after it was hidden, shows
the result kept without the check running again. **Check again** in the window runs it afresh,
and so does the end of an install or update run.
Neither **Refresh** nor any re-read runs it; a restart or a window reload ends the session, so the
next first opening runs the check again. A failed check is shown only here. The mission pages still draw every variant,
the buttons that run a recipe of a fixed name, and the looped run exactly as they would if every
check passed, and a click runs the lines as written. When the check cannot run at all, the window
shows one line saying so, with the cause beneath it.

### Installing and updating the plugin

Beside every harness whose check found its CLI and that has an install to offer, the window draws
an **Install** control. Antigravity and Codex are offered one while they hold no Gurita copy,
installed per-user, the only scope they support. Claude Code is offered one while any of its three
scopes, `user`, `project`, and `local`, holds no copy applying to the project, whether that scope
is more or less specific than the copy in effect; a scope already holding an applying copy is
reached through **Update** instead, and a disabled copy's scope counts as held. With no workspace
folder open, Claude Code is offered `user` alone, and project and local are not mentioned. No
**Install** is drawn for a disabled Antigravity or Codex copy, which must be enabled in the
harness itself, for a copy or `gurita` marketplace from another source, whose switching commands
the window states instead, or for a harness whose listing could not be read. A click starts the
install at once, with no confirmation. On Antigravity and Codex the run starts straight away. On
Claude Code, VS Code's own quick pick first lists the scopes on offer, each with one line saying
where an install there is recorded: `user` in your user settings, `project` in the project's
shared `.claude/settings.json`, and `local` in the project's local settings. The install runs at
the scope you pick, and dismissing the pick installs nothing; nothing is selected or stored on the
page. While any install or update run is going, every **Install** control is drawn disabled. The
window offers no uninstall control.

Beside every harness whose check found its CLI and an installed Gurita copy, the window draws an
**Update** control. It is offered whether or not the installed version differs from the packaged
one, the check line beside it still saying which, and it is drawn the same, enabled, either way.
No **Update** is drawn for a harness whose CLI was not found or that holds no copy, for a copy
installed but disabled, Claude Code's copy in effect included, or for a copy whose plugin or `gurita`
marketplace comes from another source, whose switching commands the window states instead. A
click starts the update at once, with no confirmation, the click itself being your consent. On
Claude Code the update acts at every scope a copy applying to the project was detected at, the
`user` scope and the `project` and `local` scopes recorded for the project root, taken in the
order user, project, local, and you choose nothing about scope; Antigravity and Codex take none.
While any install or update run is going, every **Update** control is drawn disabled, as
**Check again** is.

An install or update of the Gurita plugin that the window starts runs in a terminal of its own,
opened and shown as a recipe run's terminal is. The terminal's own process is the packaged
`install_plugin.py`, beside `runner.py`, run with `python3` at the project root (the home
directory when no folder is open) and given the harness, `install` or `update`, the project root,
each Claude Code scope it acts at, and `--wait`. The script first reads the tag of the latest
published release of the harness's distribution repository, then installs or updates the plugin
at that tag by the harness's own install path, and at the end waits for a keypress, so its output
and any prompt stay visible and answerable in the terminal until you dismiss it. Run by hand
without `--wait`, it exits as soon as it is done.

Only one install or update runs at a time. The extension keeps a note of the run going for the
rest of its session, until the run's terminal closes: meanwhile the window says beneath the
harnesses which harness the plugin is being installed or updated on, draws **Check again**
disabled, and starts no second run, a request that still reaches the extension showing a
notification and bringing the running terminal forward. When the terminal closes, the extension
reads the run's exit status from it and reports how the run ended in a notification. A success,
status 0, is an information notification, for example `The Gurita plugin was installed on Claude
Code.`, followed by the one sentence `Running sessions of that harness must be restarted to use
the new copy.`, whether or not the version changed. Any other status is an error notification
naming the status, and so is a failed release lookup, which the script reports in the terminal
before exiting non-zero with no install, update, or marketplace command run. Either way the
window then runs the whole harness check afresh, for all three harnesses, as **Check again**
does, and its result replaces the one kept.

### Enabling and disabling harnesses

Beside each harness the window also shows whether it is **Enabled** or **Disabled**, with one
control, **Disable** or **Enable**, that switches it. Every harness starts enabled, whatever its
check reports and whatever recipes run on it, and stays enabled until you disable it; the check
never changes it. The state is kept in your per-user variant store, `~/.gurita/variants.json`, in
the part of that file set aside for harness values, its `harnesses` object, as
`"<harness>": { "enabled": false }` keyed `claude`, `antigravity`, or `codex`, so it lasts across
every window, the editor, and every project. When the file cannot be read, the window says so with the
cause beneath it and draws no control.

Disabling a harness acts on the mission pages' recipe lists alone. A variant with at least one
line on a disabled harness (a line opening with `claude`, `agy`, or `codex`) is left out of the
list, mixed variants included, so it leaves its recipe's dropdown and a click on it starts
nothing, and a recipe every variant of which is left out loses its button. Where the variant
selected for a recipe or its default is left out, the button stands on the default if that
variant is still listed and otherwise on the first listed variant; the remembered selection is
kept and comes back once the harness is enabled again. The buttons that run a recipe by its fixed
name (on the question card and its alternatives, **New task**, and **Ask in mission context**) are reached the same way: such a variant leaves the dropdown beside the button and a
click on it starts nothing, the button stands on its default or its first remaining variant as a
recipe button does, and a button left with no variant stays drawn but disabled, with no dropdown
beside it, until the harness is enabled again. The side-bar view's **New mission** and **Define
mission** rows leave such a variant out of their QuickPick the same way, and a row left with no
variant reads `no variant enabled`. The looped run is untouched: its preview's override
list offers every named single-task line, the rule file chooses among all of them, and every one
is passed to the runner.

### Model and effort lists

Under **Models and efforts** the window holds each harness's model list and its one effort list
for the whole harness; Codex holds a model list and no effort list. The extension ships no list
of its own and queries no harness: each list is read, every time the window opens, from the values
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
lists cannot be read, the window says so with the cause beneath it.

### Variants

Under **Variants** the window lists every recipe with its variants, read afresh every time the window
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
shown at once in the window and on the mission pages, whose recipe lists are read again, the
fixed-name buttons' dropdowns, labels, and hover text included, in the failure state too, so every
button runs the variant its label shows. An edit that cannot be made, or a variant store that cannot be read or written,
is told in an error notification and writes nothing. When the variants cannot be read, the window
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
pick on `custom 1` changes `custom 1`. Like every other edit, a pick is shown at once in the window
and on the mission pages.

### Single-task lines

Under **Single-task lines** the window lists the named single-task lines the looped run takes,
read afresh every time the window opens: the shipped ones and those of your own recipe file alike,
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

Each recipe in a recipe file is shown as an action where it is fired, on a mission page and on
the side-bar view's rows, and as an action recipe in the Settings window; the recipe files, their
`## Recipes` heading, and the `gurita.ownRecipesFile` setting keep the name recipe.

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
every such recipe opens on a variant called `default` in its dropdown and in the Settings window; a
recipe of several `####` variants, such as `Execute tasks` above, keeps the names written.
Nothing renames what you stored or selected before under such a variant's old name, the
recipe's name: a stored copy made under it no longer stands in for the variant, which shows again
beside it, a hiding record or a picked default naming it matches no variant, and a remembered
selection naming it is dropped as one naming a variant gone from the recipe. Once a recipe holds
a `####` sub-heading, only the blocks beneath its sub-headings are read, a block standing above
the first sub-heading included in none; a sub-heading with no fence beneath it is a variant of no
line, and of a variant name repeated within one recipe only the first is read. Headings inside a fence are lines, not headings. The
extension reads recipes from two files, the shipped file and your own file, and reads both in this
same form. A recipe's default is the variant picked for it in the Settings window (see Variants
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

### The description line

A recipe may carry one line of description, by one `Description:` line read by the stage line's
rule: standing between its `###` heading and its first fence or first `####` sub-heading, outside
the fence, once for the whole recipe, before or after its `Stage:` line:

````
### Prepare tasks
Stage: derive tasks
Description: Record every standing recommendation as its answer, then derive the mission's task list.
```
claude -p "/gurita:answer-all-open-questions-with-recommendation --mission <path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/gurita:derive-tasks --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
```
````

The line opens with `Description:` at its first column, and the text after it is read with its
outer spaces trimmed and shown as written, backticks and all. A mission page draws it to the right
of the recipe's button (see The recipes a page lists below). A recipe with no `Description:` line
before its first fence or sub-heading, with more than one, or with one holding no text has no
description, and its button stands on its row alone; a `Description:` line inside the fence is an
ordinary line of the recipe, and one after the first fence or beneath a `####` sub-heading is not
read. The same rule reads the shipped file and your own file, and an own recipe that joins a
shipped one keeps the shipped recipe's description, its own `Description:` line not read. Every
chain the shipped file holds carries one; its button recipes and single-task lines carry none.

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
shipped recipes come first and your own under **Your actions** below them, a variant holding a
placeholder the page cannot fill is left off, and one holding a placeholder the extension does not
know is shown as a non-runnable entry when selected. The list follows the step, so it changes
whenever a run or a change to a mission document moves the diagram's filled block. The buttons
that run a recipe by its fixed name (on the question card and its alternatives, **New task**, and
**Ask in mission context**) are offered whatever the step, as are the side-bar view's **New mission** and **Define mission**
rows.

Under the page's **Actions** heading the list is drawn in two parts, one recipe to a row: each
row holds the recipe's button with its dropdown beside it and, to their right, the recipe's one
line of description from its `Description:` line (see The description line above), a recipe
with none standing on its row alone, while the button's hover text still shows the selected
variant's lines. First come the shipped
recipes, one button each in the shipped file's order, with no heading of their own; an own recipe
carrying a shipped recipe's name joins that recipe's button rather than adding one. Then, under
**Your actions**, come your own recipes that carry no shipped recipe's name, in your file's order,
the heading left out when there is none. Each button shows the recipe's name and, beneath it, the
name of the variant it runs, the one selected in its dropdown, always and exactly as the variant
is named, so a button says which variant a click runs: `Execute tasks` on its shipped
`Normal difficulty` variant reads `Normal difficulty` beneath its name, and a recipe of one
variant, such as `First run` or `Prepare tasks`, reads `default`. The button lists
no harness, model, or effort; those stay readable in its hover text, which shows the variant's
lines as written, and in the Settings window (see Variants above).

Beside each recipe's button, or its non-runnable entry, stands a dropdown of the recipe's
variants, drawn as its arrow alone, since the button beside it already names the variant
selected. Opened, it lists the variants in the recipe's order, the shipped ones first, each by its
bare name, those of your own recipe file and your variant store carrying no mark of their own;
the Settings window says where each comes from. It offers only the variants the page can draw: a
variant holding a placeholder the page cannot fill, or no line, is left out of it, and a recipe none of whose variants the page can draw
is not listed. The dropdown stands on the variant selected, and the button's label, its hover
text, and a click all follow it: a click runs the variant the dropdown shows, and picking another
variant starts nothing, so the dropdowns stay enabled while a run is going. The variant you select
is remembered per recipe name on each mission, keyed by the mission's path as the live read lists it,
in VS Code's storage for the open workspace (the extension's `workspaceState`), as a map from
mission path and recipe name to variant name; nothing is written into the project's tree, and the
selection lasts across closing the mission's window and the editor. A remembered selection always wins over
the recipe's default. With nothing remembered, or with the remembered variant one the page cannot
draw, the dropdown stands on the default, or on the first variant drawn when the page cannot draw
the default. When the remembered variant is gone from the recipe, taken out of your own recipe
file for instance, the selection is dropped and the button falls back to the recipe's current
default. Of variants sharing one name, a selection stands on the first. A click on a variant the
page's last list did not show selected starts nothing. The recipes of the buttons that run a
recipe by its fixed name are never listed on the page; those buttons carry their own dropdowns
(see below).

### The buttons that run a recipe by its fixed name

Five buttons on a mission's page run a recipe by its fixed name, whatever the step: **Discuss**
and **Answer** on the question card, **Answer with this alternative** on each of its
alternatives, and **New task** and **Ask in mission context** in the row of mission-wide actions
above the pane headers. The two rows that start a mission, **New mission** and **Define
mission**, run theirs from the side-bar view (see The rows that start a mission above). The five pick a variant as the recipe buttons do. Beside each stands a dropdown of its
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
**New task** on the shipped `discuss-new-task` and **Ask in mission context** on the shipped
`ask-in-mission-context` each read `default` beneath their names; an **Answer
with this alternative** button, on its alternative's row of its own, reads the variant's name
after its name on the same line instead. A click runs the
variant the dropdown shows, and only when the window's last post of the button stood on that
variant; picking another variant starts nothing, so these dropdowns stay enabled while a
run is going.

The variant you select is remembered in VS Code's storage for the open workspace (the extension's
`workspaceState`). For **Discuss**, **Answer**, **New task**, and **Ask in mission context**
it is remembered per recipe on each mission, keyed by the mission's path, in the same map as the
recipe buttons' selections, so every card of a mission shares its selection. For each **Answer
with this alternative** button it is remembered per mission, question, and alternative, keyed by
the mission's path, the question's Short Title, and the Alternative Id, in a map of its own, so a
pick on one alternative leaves every other alternative's button, on that card and on every
other, where it stood, and a click runs the variant its own button stands on. A
remembered selection always wins over the default picked in the Settings window, and picking a new
default leaves it standing. With nothing remembered, or with the remembered variant left out of
the dropdown, the button stands on the default when the dropdown offers it and otherwise on the
first variant offered. When the remembered variant is gone from the recipe, deleted or renamed in
the Settings window or taken out of your own recipe file, the selection is dropped and the button
falls back to the recipe's current default; a variant left out only because its harness is
disabled keeps its selection, which comes back once the harness is enabled again.

A button whose every variant it could run is left out for a disabled harness stays drawn but
disabled, its name alone, with no dropdown beside it and its hover text saying why. A button whose
recipe cannot be read or run at all (no recipe of its name, or no variant the button can fill)
shows its name alone with a hover text saying what the button does, and a click on it tells why
in an error notification.

### The shipped recipe file

The shipped recipes are the extension's own file, which the package carries as
`bundled/shipped_recipes.md`, read at run time. The extension does not read the Gurita
repository's `snippets/GURITA_USAGE.md`: that file is a document for running the chains by hand,
holding the same recipes beside its `## Manual use` blocks. Only the `###` blocks under the shipped file's one recipe
section, the `## Recipes` heading, are recipes, listed in the file's order with no heading of
their own on the page, and the notes on running the `agy` lines stand as prose at the top of the
recipe section. Each chain is shipped once, not once per harness: a line is moved onto the other
harness from its harness dropdown in the Settings window (see Variants above), so no recipe is
grouped into one copy per harness. Three shipped recipes hold `####` variants:
`Approve all standing recommendations and review again` (`default` alone),
`Prepare and Execute tasks`, and `Execute tasks` (each `Normal difficulty` and
`Critical tasks`); every other shipped recipe is one fenced block with no `####` sub-heading, a
recipe of one variant named by its heading. A stored copy of
a variant the file no longer holds, such as an `Antigravity` variant an earlier copy of the file
shipped, stays listed as a stored variant of its recipe, after the shipped one.

`Approve all standing recommendations and review again` was shipped as `Requirements iteration`,
which also held a second variant, `Mixed-agent (Gemini reviews, Claude annotates)`, that the file
no longer ships. Nothing carries what you stored or selected under the old name over to the new
one, as nothing renames what you stored under a one-block recipe's old variant name: variants you
stored under `Requirements iteration`, stored copies of its `default` or mixed-agent variant
included, form a recipe of your own called `Requirements iteration`, listed last under
**Your actions** and, declaring no step, on every page; a hiding record or a picked default under
the old name matches no variant, so the renamed recipe shows its shipped variant and opens on it;
and a remembered selection is kept only while that recipe of your own still lists the variant it
names. Move what you want to keep onto the new name by hand in the Settings window.

The file also shipped a button recipe `answer-open-question-with-recommendation`, run by an
**Answer with recommendation** button the question card no longer carries; accepting a
question's recommendation is left to `Approve all standing recommendations and review again`,
which accepts every standing one together. Nothing removes what you stored under that name:
variants stored under it, or a recipe of that name in your own recipe file, form a recipe of your
own called `answer-open-question-with-recommendation`, which the Settings window lists as an
ordinary recipe you can edit or delete, and which no mission page draws, since each of its
variants holds `<Short Title>`, a value the page's action list cannot fill.

Every chain in the file declares the one step it runs, once for the whole recipe, and spans no
other:

- **first review round**: `First run`, one block of `claude` lines.
- **additional review round**: `Approve all standing recommendations and review again`, whose one
  variant, `default`, is one block of `claude` lines (the answer sweep, a review, the
  alternatives pass, and an interactive recommendation pass).
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

A page filling **derive tasks** thus lists
`Approve all standing recommendations and review again`, `Prepare tasks`, and
`Prepare and Execute tasks`; one filling **first review round** lists
`Approve all standing recommendations and review again` beside `First run` while a question is open, such as on a mission whose first review left
questions lacking alternatives or a pick, and `First run` alone on a fresh mission with no open
question; one filling **additional review round** lists
`Approve all standing recommendations and review again` alone; one
filling **execute tasks** lists `Execute tasks`; and one filling **finish** lists
`Finish mission`. No shipped recipe is looped, so the looped task run is reached through a recipe
of your own whose last line is the slot line `<single-task line>` (see the looped task run
below), and no shipped recipe declares **follow up tasks**. Besides the chains, the file carries the following,
none of which declares a step and each of which is one block:

- The seven button recipes, each one `claude` line named by the skill it invokes:
  `discuss-open-question`, `discuss-mission-goal`, `discuss-new-task`, `ask-in-mission-context`,
  `answer-open-question`, `answer-open-question-with-alternative`, and `define-mission-goal`. The
  buttons run the recipe of these fixed names; `discuss-new-task`'s one line is
  `claude "/gurita:discuss-new-task --mission <path> <issue description>" --dangerously-skip-permissions --model "fable" --effort high; # interactive`,
  `ask-in-mission-context`'s is
  `claude "/gurita:ask-in-mission-context --mission <path> <question>" --dangerously-skip-permissions --model "fable" --effort high; # interactive`,
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
runs first. Every other own recipe is listed below the shipped recipes under **Your actions**,
in the order your file lists them.
An own recipe may declare its step by a `Stage:` line, as a shipped one does (see the stage line
above), and is then listed only on the pages that step fits; an undeclared one is listed on every
page. It may carry a `Description:` line likewise (see the description line above), shown to the
right of its button. For example:

````
### Review twice
Stage: additional review round
Description: Run the review pass twice in a row.
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
`<Alternative Id>`, `<goal>`, `<scope>`, `<answer text>`, `<issue description>`, `<question>`,
and `<note>`.
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
`GURITA_ISSUE_DESCRIPTION`, `GURITA_QUESTION`, and `GURITA_NOTE`. A shell step
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
headless line with `<Task Title>`, shipped, your own, or stored in the Settings window, counts as a
named single-task line, named by its `###` heading or the name the Settings window gave it. In the
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

The Gurita repository tracks its own rule file, `task_line_rules.txt` at its root, which shows
the form at work: tasks whose title or
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
prints the line the run ended on and the recipe line it stopped at; the terminal closes, and the
live missions are re-read, once the runner exits.

The runner can also be run by hand outside the editor, from the installed extension's own
directory, which holds it beside `bundled/` (for VS Code,
`~/.vscode/extensions/busyminds.gurita-vscode-<version>/`); `python3 runner.py --help` lists its `chain`, `preview`, and `loop` commands
and their arguments.

### Closing a finished run's terminal

The user setting `gurita.autoCloseFinishedRuns`, on unless you turn it off, closes a run's
terminal by itself once the run finishes: a chain that ran all its lines, and a looped task run
that ends on `Loop finished: no task remains`, print their report and exit without waiting, so
the terminal closes and the mission's page is usable again at once. A run that stopped still
prints `Press any key to close this terminal.` and waits for a keypress, so you can read why: a
chain that stopped or ended early, and a looped run that stopped on an unresolved assignment, on a
task that did not end on `Task completed.`, or on a task list it could not read. With the setting
off, every run waits for a keypress, finished or stopped, and its terminal closes once you
dismiss it. The setting is read each time a run starts, and the extension passes it to the runner
as the option `--close-when-finished` of its `chain` and `loop` commands.
