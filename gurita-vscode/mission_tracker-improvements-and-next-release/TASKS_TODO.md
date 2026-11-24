# TASKS TODO

## First Button on the Question Pager

Add a First button before Previous in the Open questions pane's pager that jumps straight back to the first question's card without stepping back one at a time. Verified by the page tests of the jump and the position it saves, with `gurita-vscode/README.md` naming the button.

---

## Mission Introduction Above a Headed Diagram

Open a mission page with an introduction section above the workflow diagram that shows the mission's title alone by default, with one control beside it that shows and hides the whole goal beneath it, the goal as the mission's `requirements.md` holds it, drawn by the text renderer, and give the workflow diagram a heading of its own to mark where it starts. The goal is collapsed on every load of the page with no shown or hidden state saved, and the control is present whatever the goal's length, with no clamp and no overflow measurement. Verified by tests of the title and goal read and of the introduction, its toggle, and the diagram's heading against the stand-in DOM, with `gurita-vscode/README.md` describing both.

---

## Indicator While a Run Blocks the Page

Show on a mission page, while a run started for the mission is going and its action buttons are disabled, an indicator saying that the mission is waiting for the run's terminal to close. The indicator's space is reserved whether or not it shows, so switching it on or off moves none of the page's content; verified by page tests of the indicator in both states and of its reserved space in the page shell's stylesheet, with `gurita-vscode/README.md` describing it.

---

## Ask in Mission Context Button

Add Ask in mission context as a fixed-name button in the same row as New task, which becomes the page's row of mission-wide actions above the two pane headers, drawn at every step, with an arrow-only variant dropdown of its own. It runs a shipped button recipe named by its skill, `ask-in-mission-context`, entered in `BUTTON_RECIPES`, kept out of the recipe list by name, and listed in the Settings window as a button recipe, its one line interactive (a bare `claude "/gurita:ask-in-mission-context --mission <path> <question>" … # interactive`), and the question is typed before the run starts through `askValues` as a required value that refuses an empty entry, as the issue description of `discuss-new-task` is today. Verified by reader, page, and pane tests of the button, its dropdown, the refused empty question, and the started run's line, with `gurita-vscode/README.md` describing the button.

---

## Action Rows With Descriptions

Draw each button of a mission page's action list on a row of its own with one line of description to its right, read from a `Description:` line the recipe reader takes beside the `Stage:` line, in the shipped file and a person's own file alike, where today the buttons stand side by side in one wrapping row and what a chain does shows only as raw lines in its hover text. Every chain in `gurita-vscode/shipped_recipes.md` gains its `Description:` line; verified by reader tests of the line and page tests of the rows, with `gurita-vscode/README.md` documenting the line.

---

## Git State Changes Re-Read the Missions

Create a second `vscode.workspace.createFileSystemWatcher` beside the mission-document watcher in `src/pane.ts`, over the repository's git directory as `git rev-parse --absolute-git-dir` (and `--git-common-dir` for a linked worktree's refs) resolves it from the project root, covering only `HEAD`, `refs/heads/**`, and `packed-refs`, with lock files, the index, objects, and remote refs ignored, so a commit, a pull, or a branch switch made outside the extension's runs no longer leaves a mission's next step and review-round count stale until Refresh. A pure function beside `eventEffect` in `src/refresh.ts` maps each event to an effect asking for a full re-read (`live: true`) through the existing 300 ms debounce, and no other extension is used. Verified by refresh and pane tests of the watched patterns, the mapped effect, and the debounced re-read, with `gurita-vscode/README.md` saying what is watched.

---

## Notices of What Would Stop a Run

Show on a mission page, each only while its condition holds, two notices of what would stop a run before it is started: one while another started mission holds the mission's scope, the bundled missions tool's `gate <path>` printing anything, which stops every run that derives, adds, or completes tasks, and one while `requirements.md` or `open_questions.xml` holds an uncommitted change, which stops the answer sweep. Both conditions are read with the mission's other facts on every re-read; verified by tests of the two reads against a git fixture and page tests of each notice shown and gone, with `gurita-vscode/README.md` describing them.

---

## Briefs Under the Remaining Task Headings

Show each remaining task's brief beneath its heading in the page's task pane, read from the same `TASKS_TODO.md` as the headings and drawn by the text renderer. Verified by tests of the task read giving each heading with its brief and of the pane drawing them, with `gurita-vscode/README.md` describing the pane.

---

## Completed Tasks in the Tasks Pane

List the mission's completed tasks, as the bundled missions tool's `tasks <path> --with-body` prints them, inside the page's second pane beneath the remaining task list, behind one show/hide toggle that is collapsed by default, each with its title and its verified bar drawn by the text renderer. The pane's header is renamed from "Remaining tasks" to "Tasks" and the remaining tasks head their own part of the pane, the page keeping its two pane headers and its default-pane rule and gaining no third pane. Verified by tests of the `tasks` read and of the pane's two parts and toggle, with `gurita-vscode/README.md` describing the pane.

---

## Completed Task Commits Open in an Editor Tab

Give each completed task in the Tasks pane a link that opens its commit inside VS Code only, as one read-only text document in an editor tab: the extension registers a content provider of its own scheme whose content is `git show <hash>` run through `execFile` from the project root, opened with the diff language, so the tab holds the subject, the verified bar as the body, and the whole patch. No remote host is involved and no other extension is called; verified by tests against the `vscode` stub of the provider's content for a fixture commit and of a link's click opening it, with `gurita-vscode/README.md` describing the link.

---

## Multi-Line Input Panel for Long Values

Where `askValues` reaches the answer text, the goal, or the issue description, open a small input panel as an editor tab holding one textarea, the value's prompt above it, and Run and Cancel, one webview panel serving all three sites, which resolves the value when Run is pressed and undefined when Cancel is pressed or the tab is closed, exactly as a dismissed input box does today. The scope, the discussion note, and the Settings window's values stay in `vscode.window.showInputBox`, and the mission page and the side-bar tree are unchanged, so nothing is typed on a mission page. Verified by pane tests against the `vscode` stub of each value resolved, cancelled, and closed and a test of the panel's script against the stand-in DOM, with `gurita-vscode/README.md` describing the panel.

---

## Auto-Close Setting for Finished Runs

Contribute one setting beside `gurita.ownRecipesFile`, shipped on, under which a run's terminal closes by itself: a chain that ran all its lines, and a looped task run that ends on `Loop finished: no task remains`, prints its report and exits without waiting for a keypress, so its terminal closes and the mission's page unblocks. A chain that stopped and a loop that stopped (an unresolved assignment, a task that did not end on `Task completed.`, or an unreadable task list) still wait for a keypress, and with the setting off every run waits as today. Verified by `runner_tests` of both kinds of run under both values and by run tests of the setting reaching the runner, with `gurita-vscode/README.md` documenting the setting.

---

## Plugin Notice Row in the Missions View

Run the harness check in the background as soon as the Missions view first draws in a session, through the same `checkHarnesses` path the Settings window uses, its result kept for the rest of the session as today, so only the Settings window's Check again and the end of an install or update run run it afresh and the view's Refresh does not. While at least one harness that is Enabled in the Settings window and whose CLI is found fails its install or version check (not installed, listing unreadable, installed but disabled, or older than the packaged version), or the check could not be run at all, the tree holds a plugin notice row at its top, above New mission and Define mission, with a warning icon, a label saying the plugin is missing or outdated, and a click opening the Settings window; disabled harnesses and harnesses whose CLI is not found never count, the view's message keeps only `No mission is live.` and the read-failure line, and no notification is shown. Verified by tree tests against the `vscode` stub of the row in each counted and uncounted case and of the check's one background run, with `gurita-vscode/README.md` describing the row.

---

## Bootstrap Offer Row in the Missions View

Offer the workflow bootstrap as a tree row at the top of the Missions view, above New mission and Define mission, present only while neither `CLAUDE.md` nor `AGENTS.md` at the project root holds a `## Mission Workflow` heading, whatever harnesses are enabled. A click runs `init-mission-base-workflow`, which takes no argument, from a shipped button recipe named by its skill, as the two mission-starting rows run theirs, and the offer is gone once either file holds the heading. Verified by tree tests of the row in each file state and of the click's run, with `gurita-vscode/README.md` describing the row.

---

## Finished Missions Under One Expandable Row

Add one row to the Missions view, collapsed by default, that expands to every finished mission the record holds: the extension calls the bundled missions tool's `missions .` with no `--last` and keeps every `finished` line, newest first as the tool sorts them, with no count, setting, or further row limiting the list. A click on a finished mission opens a window showing that mission's summary, drawn by the text renderer, and its completed tasks, each with its verified bar and commit link as the Tasks pane draws them. Verified by tests of the finished-mission reads against a git fixture, tree tests of the row and its children, and page tests of the window, with `gurita-vscode/README.md` describing both.

---

## Capture Principles on Finished Missions

Offer a Capture principles action on a finished mission's window that runs `capture-mission-principle-updates` with the mission's path as its positional argument and no `--mission`, from a shipped button recipe named by its skill whose one line is interactive, since capture asks for one confirmation before it commits. Verified by reader and pane tests of the action's recipe, the filled path, and the started run, with `gurita-vscode/README.md` describing the action.

---

## New Mission Window Opens After Define

When a Define mission run's terminal closes and the re-read of the live missions lists a mission it did not list before the run, open that mission's window by itself, where today the mission appears as a new row to find and click by hand. Verified by a pane test against the `vscode` stub of the window opening for the one new path and of nothing opening when the run created none, with `gurita-vscode/README.md` saying so.

---

## Open Mission Command in the Palette

Offer "Gurita: Open Mission…" in the Command Palette: the command lists the live missions and opens the picked one's window, the extension's other hidden commands staying hidden. This reverses the stated choice that the side-bar view is the only entry point, so `gurita-vscode/README.md` names the command beside the view; verified by a check of the manifest and a test against the `vscode` stub of the list and the opened window.

---

## Project Recipe File as a Third Source

Read the project's recipes from one file under the fixed name `gurita_recipes.md`, directly in the project root that `projectRoot` in `src/live.ts` finds, beside the shipped file and the person's own, with no setting added and an absent file meaning the project has no recipes. A project recipe carrying a shipped recipe's name joins it as further variants and an own recipe carrying a project recipe's name joins it the same way, the variants ordered shipped, then project, then own, each source in its file's order, a variant carrying another source's variant name kept as a second entry beside it and the joined recipe keeping the name, group, and `Stage:` of the first source that holds it; project variants carry a third origin, `project` (`VariantOrigin`, `ReadVariantRef`, the variant store's copy, hide, and default records), and are marked as the project's on the mission page and in the Settings window. A mission page lists the project recipes that carry no shipped recipe's name under a heading of their own, directly below the shipped ones and above the own heading, drawn only when at least one fits the step the diagram fills, the stored-only recipes staying last in the own group; verified by reader, variant-store, page, and Settings tests of the three sources, with `gurita-vscode/README.md` documenting the file.

---

## Effort on Codex Lines

Read and replace a Codex line's effort in `lineValues.ts` as the config override `-c model_reasoning_effort=<level>`, the `--config` spelling read as well, as `--effort` is read and replaced on the other harnesses' lines. The Settings window gains a Codex effort list under Models and efforts, built like the other two from the values the shipped recipes, own recipes, and stored variants carry with the person's `addedEfforts`/`removedEfforts` overlay on top, and a Codex line gets both a model dropdown and an effort dropdown, a line written without the override having no effort dropdown. Verified by line-value, harness-list, and Settings tests, with `gurita-vscode/README.md` describing the list.

---

## Codex in the Harness Dropdown

Offer Codex in a headless line's harness dropdown in the Settings window, beside Claude Code and Antigravity: a switch to Codex writes `codex exec '$gurita:<skill> …'` with `--dangerously-bypass-approvals-and-sandbox` as the counterpart of `--dangerously-skip-permissions`, the model as `-m`, and the effort as `-c model_reasoning_effort=<level>`, kept when Codex's effort list offers it and the list's first otherwise, and a Codex line switched back to Claude Code or Antigravity keeps or maps its effort the same way. An empty Codex model list still refuses the switch with today's error notification, so every line the switch writes carries `-m`, while an empty Codex effort list lets the switch go ahead with no effort override written. Verified by line-value tests of each switch and its round trip and Settings tests of the dropdown and both empty-list cases, with `gurita-vscode/README.md` describing the switch.

---

## Interactive Lines Switched to Codex

Extend the harness dropdown's Codex switch to interactive lines, after one hands-on check on the installed `codex` (0.159.3 today) that a `$gurita:` skill named in the initial prompt of a bare `codex` runs and that the session stays open on its result. The switch keeps the line interactive: the command word becomes a bare `codex` with no `exec`, the prompt is rewritten from `"/gurita:…"` to `'$gurita:…'`, `--dangerously-skip-permissions` becomes `--dangerously-bypass-approvals-and-sandbox`, the model and effort are written as `-m` and `-c model_reasoning_effort=…` under the headless switch's empty-list rules, any `-i` an `agy` line carried is dropped, and the trailing `# interactive` mark is kept, a switch back giving `claude "…"` or `agy -i "…"`. Verified by line-value tests of the switch and its round trip from both harnesses, with the extension's documentation giving the interactive Codex form beside the headless one as checked.

---

## Shipped Codex Single-Task Recipe

Add exactly one Codex recipe to `gurita-vscode/shipped_recipes.md`, a single-task recipe standing beside the shipped single-task lines: one headless `codex exec '$gurita:complete-task …' --dangerously-bypass-approvals-and-sandbox` line that also carries `-m` with a named Codex model id taken from the catalog `codex debug models` prints, the recipe's name saying the model as the Claude Code single-task names do. No chain and no button recipe gains a Codex line or variant; verified by reader tests of the recipe as a named single-task line and a runner test of its line read as headless, with `gurita-vscode/README.md` naming the recipe.

---

## Screenshots and Demo From One Capture

Extend `gurita-vscode/scripts/capture_demo.js` so the one run that records `media/demo.gif` also writes three screenshots as PNG files under `gurita-vscode/media/`: full-resolution frames of the side-bar view once the mission row shows and of the mission page once it has filled `derive tasks` with the questions' alternatives and picks drawn, and, in one more step after the run, of the Settings window before the session closes, against the same fixture project seeded from `tests/fixtures/host_project/` and the same `scripts/demo_claude.py` stand-in. Bring the script's flow up to the finished UI, run it, and commit the re-captured GIF with the three stills, BUILDING.md's recording entry covering both. Verified by the one command ending with all four files written and each showing the finished UI.

---

## Listing README Shortened to a Showcase

Move the reference prose of `gurita-vscode/README.md` into one new Markdown file beside it, `gurita-vscode/USAGE.md`, keeping the current section order (side-bar view, mission windows, Settings window, recipes, looped task run, runner), kept out of the VSIX by `.vscodeignore` as `BUILDING.md` is. The shortened README leads with the three screenshots of the side-bar view, a mission page, and the Settings window, saying what each is for, and links to the reference document by its absolute GitHub URL, the form its `BUILDING.md` link already takes. Verified by the packaged VSIX carrying the short README and no `USAGE.md`, the README's images and links resolving, and no reference prose lost in the move.

---

## Root README Leads With the Extension

Open the root `README.md` with a showcase of using Gurita for VS Code, with the screenshots of the finished UI and links to both listings, ahead of `## Installation`, so the plugin's manual installation moves further down and the extension no longer appears only as that section's last subsection. Verified by the README's section order and by its images and links resolving.

---

## Delete the Improvements Tracker

Delete `ideas/vs_code_extension_improvements_tracker.md`, once each of its 26 entries is confirmed carried out in the extension and the two READMEs as they stand. Verified by the file's absence, the other files under `ideas/` unchanged, and no file outside the mission directory naming it.

---
