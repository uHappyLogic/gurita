# TASKS TODO

## Runner Loop Subcommand for Task Runs

Add to `runner.py` the subcommand `runner.py loop --mission PATH --rules FILE --line NAME LINE... [--override TITLE NAME]... -- LINE...`, the looped task run: before each task it re-reads the top remaining `##` heading of the mission's `TASKS_TODO.md`, takes that task's override or else the rules' result, shows the assignment it used, and runs a fresh shell session with `GURITA_PATH` and `GURITA_TASK_TITLE` in its environment, filled from `--mission` and the re-read heading, the recipe's own lines at its head and the chosen single-task line in the place of the slot line `<single-task line>`. It goes on only on `Task completed.`, stops before running anything at the first task whose assignment is unresolved, ends when no heading remains, and closes as a chain does, on its report and a keypress. Verified by pytest tests of the per-task choice between override, rule, and unresolved and of the looped verdict, starting no shell session and passing in both pytest runs.

---

## Add the Rule File for This Repository

Add the tracked rule file `task_line_rules.txt` at the project root for this repository itself: its default line sends a task to `Single task with Opus High (Claude Code)`, and a few pattern rules send the tasks this repository treats as critical, those whose title or brief names a stdlib tool under `core/tools/`, a `.py` file, a test, a parser, or the runner, to `Single task with Opus xHigh (Claude Code)`. It gives a looped run its assignments in the project the maintainer first tries the extension in. Verified by running `runner.py preview` over it with the shipped single-task lines against a task list holding critical and ordinary tasks: every line reads `resolved` under the expected line name.

---

## Mission Pane Panel and Navigation

Build the pane's frame: the contributed command `gurita.openMissionPane`, titled "Gurita: Open Mission Pane", creates the one webview panel in the editor area or reveals the one the extension holds, with nothing done at startup and no `WebviewPanelSerializer`, status bar item, menu entry, default keybinding, or automatic opening, and `webview.html` is set once to a page shell under a content security policy whose script, loaded through `asWebviewUri`, posts a ready message on every load and draws what the extension answers. The extension answers with the live missions, read by running the bundled `missions.py live` with `python3` at the git top level (`git rev-parse --show-toplevel`) of the first workspace folder, and the page draws a row of tabs, one per mission in that order (its title, its path as a tooltip), with the selected mission's path, title, and `started` or `defined` beneath, the first mission shown on opening, or the one failure state of the Live query failure decision in place of the pages. Verified by the compile, the unit tests, and the package build passing and by reading the code against the Opening, Restart, Project root, Navigation, and Live query failure decisions.

---

## Question View and Task Headings

Draw each mission's documents on its page from the in-process readers: the label's facts (whether any question lacks alternatives or a pick, whether the question list is empty, whether tasks remain), the question view with one collapsed row per question showing its Short Title and the id of its picked alternative, each row opening to everything its block holds, with expand-all and collapse-all controls, and the remaining task headings. The page redraws its rows in place from each parse the extension posts, keeping open rows open, and saves its set of open Short Titles with `setState` on every toggle, reading it back with `getState`, while a missing or unparsable `open_questions.xml` or `TASKS_TODO.md` replaces only the parts drawn from it with the notice the Mission document read failure decision states. Verified by the compile, the unit tests, and the package build passing and by reading the page's script against the Redraw and Mission document read failure decisions and the draft's Question view.

---

## Recipe Buttons and Runner Terminals

List the recipes on each mission's page and run them: the shipped recipes grouped under Claude Code and Antigravity and, below them, the own recipes that replace none in one group headed "Your recipes", read from `~/.gurita/recipes.md` or the path the contributed user setting `gurita.ownRecipesFile` gives, a recipe holding a known placeholder the page cannot fill left off silently and one holding an unknown placeholder shown as a non-runnable entry naming the placeholder and its file, each button carrying its recipe's lines as written in an expandable row or its hover text. A click starts the runner's `chain` at once, with no confirmation, as a terminal created with `shellPath` `python3`, `shellArgs`, and `isTransient` at the project root, each placeholder written into its line as a reference to its `GURITA_*` session variable and the value itself set only in the terminal's environment; a click while a chain for that mission is running starts nothing, shows a notification, and reveals that run's terminal, and when the terminal closes (`window.onDidCloseTerminal`) the extension re-reads and posts the fresh parse to the page. Verified by the compile, the unit tests, and the package build passing and by reading the code against the Recipe click, Second click, Run terminal, Unfillable placeholders, and the three own-recipe decisions.

---

## Question and Mission-Starting Buttons

Add the buttons outside the chains, each running the recipe of its fixed name, shipped or replaced by an own recipe of the same name, through the run path a recipe button uses: on a question's row `discuss-open-question`, `answer-open-question`, and `answer-open-question-with-recommendation`, on an alternative inside an opened row `answer-open-question-with-alternative`, and on the pane at the tab row's end, in its failure state too, `discuss-mission-goal` and `define-mission-goal`. Every typed value comes from `window.showInputBox`, one line per value (the answer text; the goal; the goal and then the scope), the Short Title and the Alternative Id come from the row clicked, and each value reaches its line only as its `GURITA_*` session variable. Verified by the compile, the unit tests, and the package build passing and by reading the code against the Input, Button recipe names, and Session variables decisions.

---

## Looped Recipe Preview and Overrides

Make a click on the looped recipe show its preview before anything runs: the extension gathers the named single-task lines by the Single-task line recognition test, runs `runner.py preview` as a short-lived child process with them, the mission, and the rule file `task_line_rules.txt` at the project root, and the page lists every remaining task with the line the rules give it or as unresolved, showing the missing line's name, the notice that the project holds no rule file with the path looked for, or the unreadable file's error with each line's number and reason. The person overrides any task by picking another named single-task line, and starting the run launches `runner.py loop` in the run terminal with every `--line` and `--override`, whether or not a task is still unresolved. Verified by the compile, the unit tests, and the package build passing and by reading the code against the Missing file, Unreadable file, Preview print, and Command line decisions.

---

## Pane Refresh From File Events

Keep the pane current beyond its own runs and its opening: a `workspace.createFileSystemWatcher` over the mission documents (`**/mission_*/requirements.md`, `open_questions.xml`, and `TASKS_TODO.md`), debounced so that a burst of writes causes one re-read, re-reads a mission's documents in process on a change to its question document or task list and also re-runs `missions.py live` when a `requirements.md` is created or deleted or a `TASKS_TODO.md` changes, while a hidden panel is only marked stale and re-read when shown. A refresh control on the page and a contributed command that does the same remain as the manual fallback, the page stays on the mission shown unless that mission is no longer live, when it falls back to the first, and git state is not watched. Verified by the compile, the unit tests, and the package build passing and by reading the code against the Refresh and Navigation decisions.

---

## Write the Extension README

Write `gurita-vscode/README.md`, the extension's one document, holding everything a person who builds, installs, and uses it needs: the Node 22 build and packaging commands in the nvm form the goal states, where the VSIX lands and how to install it by hand with `code --install-extension`, the shipped recipe file and a person's own recipe file, the tracked rule file, and the user setting `gurita.ownRecipesFile`, while `README.md`, `CONTRIBUTING.md`, and `docs/` stay untouched. It is what the maintainer follows to package and install the first version. Verified by running each build and packaging command the file gives as written and by checking every path, name, and setting it states against the built extension.

---

## Write the Extension Follow-Up Document

Write `ideas/vscode_extension_follow_up.md`, flat in `ideas/` beside the draft, holding everything the first version leaves out, each item in a section of its own, grouped by kind under a few `##` headings: the guards of a long-lived extension (the drift-gate Node steps, the fixed-line, parse, and heading cross-checks, any tests left out), the checks left unmade (what a Codex line's plain print opens with, stated as unchecked), and deferred product work such as publication. It is the record the goal asks for of what was left out as potential follow-up work. Verified by reading it against the Drift-gate guards and Codex print check decisions and against the built extension, so that every left-out item appears and nothing it lists was in fact built.

---

## Revise the Design Draft After Delivery

Revise `ideas/vscode_extension.md` the way `ideas/gurita.md` was revised after the rename: its status sentences record the first version as built by this mission, each item under "Questions for the work" is marked as answered and carries the decision that settled it (the name, path, or format chosen), the two checks the draft left unmade are marked with their result or as moved to `ideas/vscode_extension_follow_up.md`, and the publication question stays open. Every other section (the rationale, what was measured, Decided, Considered and dropped, and the body's descriptions and examples) stays as written. Verified by the diff, which touches only the status sentences and "Questions for the work", and by checking every name, path, and format it records against the built extension.

---
