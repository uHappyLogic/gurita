# TASKS TODO

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
