# TASKS TODO

## Workflow Diagram on Mission Pages

On each mission's page of the `gurita-vscode` pane (`gurita-vscode/src/webview/page.ts`, its stylesheet in `gurita-vscode/src/pane.ts`), the Path, Title, and State list and the label's fact chips standing between the mission tab row and the Recipes section are replaced by a diagram of the root README's flow, drawn by the page script itself with no Mermaid, so the page shows where the mission stands in the workflow: eight neutral blocks (define, review, provide alternatives, recommend, answer, derive, complete, finish) in the two frames "Decide upfront" and "Hand execution to agents" with the loop and handoff arrows, `finish` standing after `complete`, display only, its blocks no buttons and gating nothing. The step to run next is filled purple: `provide alternatives` while a question lacks alternatives, `recommend` while every question has alternatives and one lacks a pick, `answer` when every question has a pick, `complete` when no question is open and tasks remain, `finish` for a started mission with no open question and no task, and for a defined mission with neither, `derive` when git holds a `Requirements-review:` commit for that mission and `review` when it holds none (a review pass that changed nothing leaves no commit and so is not seen, a limit the maintainer accepted); an open question outranks a remaining task, and no block is filled when a document the choice needs does not read, that file's notice staying in its own section. It is verified by unit tests of the step choice over each of those states in a module importing nothing from `vscode`, `npm test` and `npm run package` passing under Node 22, and the installed pane showing the diagram with the right block purple, with `gurita-vscode/README.md` and the source comments describing the diagram instead of the list and chips.

---

## Workflow Diagram in the Root README

The Mermaid flowchart at the top of the root `README.md` is rewritten to the workflow diagram the pane draws on a mission's page (`gurita-vscode/src/webview/page.ts`, built by the task "Workflow Diagram on Mission Pages"), so the landing page and the pane show one flow: the same eight blocks (define, review, provide alternatives, recommend, answer, derive, complete, finish), the same two frames "Decide upfront" and "Hand execution to agents", and the same loop and handoff arrows, `finish` standing after `complete`, its blocks neutral with none highlighted, since purple marks only the current step in the pane. The edit is intended although the mission's "Extension documentation" decision leaves the root `README.md` untouched, and the README still does not mention the extension. It is verified by the block being valid Mermaid that renders and by its block names, frames, and arrows matching the pane's diagram.

---

## Remove the Draft's Stale Label Passages

Once the pane's workflow diagram replaces the mission page's label (the task "Workflow Diagram on Mission Pages"), `ideas/vscode_extension.md` and one sentence of `ideas/vscode_extension_follow_up.md` lose every passage the diagram makes stale, so the draft no longer describes a page the extension does not draw: the two entries describing the page's label and its rule of reading no commit subject, the "The page's label" entry under Mission pane and the Decided entry "The page's label tells apart only what the documents hold now, and gates no button", are deleted, and the remaining mentions of the label and of the page naming its mission by path and title are cut. No description of the diagram is added. It is verified by a grep for "label" and a read of both files finding no passage that describes the page's label or says the page reads no commit subject.

---
