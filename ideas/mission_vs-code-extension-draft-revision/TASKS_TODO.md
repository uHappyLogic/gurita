# TASKS TODO

## Rewrite Recipes Around the Shipped Snippet File

Rewrite the "Recipes" part of `ideas/vscode_extension.md` to state the design the "Shipped recipe source", "Snippet rename step", "Recipe names across hosts", "Non-chain snippet blocks", "Standalone shell steps", "Shipped host lines", "Own recipe file location", and "Recipe bounded repeat" decisions chose: the shipped recipes are the `###` blocks under the `## Claude Code` and `## Antigravity` headings of `snippets/GURITA_USAGE.md` (Codex gets no shipped lines), each identified by a heading unique across the file and offered on the pane grouped by host, `docs/ways-of-using.md` staying separately written; the changes the file still needs as a shipped document are stated as steps of the work and not made here (`<mission_path>` becomes `<path>`, the two personal blocks leave, each repeated heading names its host, the five non-chain blocks move under one reference heading the reader never reads); a person's own recipes are one per-user file outside the project at a default path changeable through a VS Code user setting, a flat list of `###` recipes that replace or add by heading and may carry shell steps of the person's own; and a recipe is a flat, ordered list run once per click, with no repeat construct. Each choice gets its entry under "Decided on 2026-11-19.", and the "What a recipe file is", "Whether a recipe is only a list", and "Which hosts' lines ship" questions are removed. It is verified by the part no longer naming the ways-of-using page as the shipped source, by `snippets/GURITA_USAGE.md` and `docs/ways-of-using.md` standing unchanged in the diff, and by each choice standing in the part and in Decided.

---

## Record Where Each Button Line Comes From

Rewrite the parts of `ideas/vscode_extension.md` that describe the buttons outside the chain recipes to state the design the "New-mission button", "Interactive line source", and "Answer button line source" decisions chose: a new-mission button that asks for the goal in an input box and opens a terminal on an interactive `discuss-mission-goal` session, beside the kept button for the headless `define-mission-goal --at <scope> <goal>` line, so the draft names two ways to start a mission; the interactive `discuss-open-question --mission <path> <Short Title>` and `discuss-mission-goal <goal>` lines written out literally as entries of their own in the shipped snippet file; and one complete headless line there, a `###` recipe under a fixed name, for each of `answer-open-question-with-alternative`, `answer-open-question`, `answer-open-question-with-recommendation`, and `define-mission-goal`, a person's own recipe of the same name replacing a shipped one. The lines are stated as what the shipped file gains, the file itself unchanged here, and each choice gets its entry under "Decided on 2026-11-19.". It is verified by every button of the draft naming the shipped recipe its line comes from, and by no sentence leaving the extension a host flag, model, or effort of its own.

---

## Rewrite Running a Line Around the Runner

Rewrite "Running a line" of `ideas/vscode_extension.md`, and the sentence of "The constraint" that leaves a runner shipped as a plugin tool open, to state the design the "Headless line execution", "Run outcome reading", "Runner language and home", "Chain shell session", and "Line kind recognition" decisions chose: a chain runs under one stdlib-only Python file (Python 3.9+, no `uv`, no third-party package) bundled in the extension and started as a terminal's own process through `TerminalOptions.shellPath` and `shellArgs` with `isTransient` set; the chain is one shell session, every substituted value placed in its environment and referenced from the line, no character refused or escaped; a line carrying a trailing `# interactive` comment inherits the terminal, an unmarked line holding a `gurita:` skill invocation is headless and read, and every other line is a shell step; and a headless line runs exactly as written, only the first line of its final message looked up in the `## Fixed console lines` table of `docs/skill-reference.md`, the exit code not read. Each choice gets its entry under "Decided on 2026-11-19.", the "How a headless line runs and how its outcome is read" and "What the runner needs, if there is one" questions are removed, and what Codex's plain print opens with is listed among the questions for the work. It is verified by the section no longer offering shell integration or a child process of the extension as the way a headless line runs, by its quoting bullet no longer refusing or escaping a value, and by each choice standing in the section and in Decided.

---

## Write the Looped Task Recipe Into the Draft

Write into `ideas/vscode_extension.md` the task loop the "Extension-run task loop", "Looped recipe form", "Looped run task title", and "Per-task line composition" decisions chose, amending "The constraint" and the "Recipes" part to name the loop's order as the one order the extension holds: an execution recipe of its own beside the unchanged `complete-all-tasks` line, marked by a reserved slot line written last (for example `<task line>`), under which the runner, started once for the whole run, re-reads the top remaining heading before each task, starts a fresh shell session with the task's title and the mission path in its environment, runs the recipe's own shell steps and then one of the recipe file's named single-task lines, and stops on any first line other than `Task completed.`. Rewrite the "Kepala" section as the "Kepala boundary" decision states, the runner walking only the `Listed` self-loop with the person choosing every other edge, and give each choice its entry under "Decided on 2026-11-19.". It is verified by the draft still saying the extension composes no line and holds no host flag, model name, or effort level, and by each choice standing in its section and in Decided.

---

## Write Per-Task Assignment Into the Draft

Write into `ideas/vscode_extension.md` the assignment design the "Per-task model assignment", "Assignment preview evaluation", "Assignment override timing", and "Own recipe file location" decisions chose: rules in a tracked project file outside every mission directory map patterns over a task's title and brief, read in Python's `re` dialect alone, to the name of a single-task line, with a default for tasks no rule matches; the runner is their only evaluator, its preview mode run as a short-lived child process when the looped recipe is clicked so the page shows every remaining task with its assignment; overrides are made there before the loop starts, held for that run only and passed to the runner as arguments, the started loop never waiting for the person; and a rule naming a line the person's recipe file lacks shows as unresolved in the preview and stops the loop at that task. Each choice gets its entry under "Decided on 2026-11-19.". It is verified by the draft stating that the extension writes nothing for the assignment and that neither the plugin nor the task format changes, and by each choice standing in its section and in Decided.

---

## Add the Dropped Ideas List

Add to `ideas/vscode_extension.md` a section of its own, "Considered and dropped", placed after "Decided", listing with a one-line reason each idea of the 2026-11-19 conversation decided as dropped and each part of an adopted or refined idea that the refinement set aside (for example the extension that no longer calls `complete-all-tasks`), together with the bounded repeat the "Recipe bounded repeat" decision places there by name. It holds no option of the draft's ten questions and no part of the 2026-11-17 draft that a decision replaced, since those carry their reasons in the Decided entries. It is verified by walking `ideas/vscode_extension_improvement_transcript.md` idea by idea and finding each either written into a section of the draft or listed here, so the list stands as the one record of what the conversation proposed once the transcript is removed.

---

## Rewrite the Questions for the Work

Rewrite "Questions for the work" of `ideas/vscode_extension.md` so that it holds none of the ten questions the mission settled and lists as a question each unknown the recorded decisions leave: what Codex's plain print opens with, registry publication deferred until the experiment is judged, whatever the VS Code documentation left unstated, and each name, path, or format a decision leaves to the work. Bring the opening paragraph's account of what the draft records in line with the sections it now has. It is verified by reading every `###` entry of the mission's `## Decisions` against the draft and finding each stated in the section it bears on and, where it settles a choice, entered under "Decided on 2026-11-19.", with no settled question left standing.

---

## Remove the Conversation Transcript

Remove `ideas/vscode_extension_improvement_transcript.md` from the repository as the last step of the revision, once the draft carries the conversation: every adopted or refined idea written into a section of `ideas/vscode_extension.md`, every dropped one in its dropped-ideas list, and the three reasons in "Why an extension". It is verified by that walk finding nothing of the transcript unaccounted for, by the file being gone from the tree, and by no file outside the mission directory still referring to it.

---
