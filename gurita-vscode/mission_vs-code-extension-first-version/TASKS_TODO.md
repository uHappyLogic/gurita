# TASKS TODO

## Workflow Diagram in the Root README

The Mermaid flowchart at the top of the root `README.md` is rewritten to the workflow diagram the pane draws on a mission's page (`gurita-vscode/src/webview/page.ts`, built by the task "Workflow Diagram on Mission Pages"), so the landing page and the pane show one flow: the same eight blocks (define, review, provide alternatives, recommend, answer, derive, complete, finish), the same two frames "Decide upfront" and "Hand execution to agents", and the same loop and handoff arrows, `finish` standing after `complete`, its blocks neutral with none highlighted, since purple marks only the current step in the pane. The edit is intended although the mission's "Extension documentation" decision leaves the root `README.md` untouched, and the README still does not mention the extension. It is verified by the block being valid Mermaid that renders and by its block names, frames, and arrows matching the pane's diagram.

---

## Remove the Draft's Stale Label Passages

Once the pane's workflow diagram replaces the mission page's label (the task "Workflow Diagram on Mission Pages"), `ideas/vscode_extension.md` and one sentence of `ideas/vscode_extension_follow_up.md` lose every passage the diagram makes stale, so the draft no longer describes a page the extension does not draw: the two entries describing the page's label and its rule of reading no commit subject, the "The page's label" entry under Mission pane and the Decided entry "The page's label tells apart only what the documents hold now, and gates no button", are deleted, and the remaining mentions of the label and of the page naming its mission by path and title are cut. No description of the diagram is added. It is verified by a grep for "label" and a read of both files finding no passage that describes the page's label or says the page reads no commit subject.

---
