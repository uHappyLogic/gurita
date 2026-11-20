# TASKS TODO

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
