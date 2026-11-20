# TASKS TODO

## Workflow Diagram in the Root README

The Mermaid flowchart at the top of the root `README.md` is rewritten to the workflow diagram the pane draws on a mission's page (`gurita-vscode/src/webview/page.ts`, built by the task "Workflow Diagram on Mission Pages"), so the landing page and the pane show one flow: the same eight blocks (define, review, provide alternatives, recommend, answer, derive, complete, finish), the same two frames "Decide upfront" and "Hand execution to agents", and the same loop and handoff arrows, `finish` standing after `complete`, its blocks neutral with none highlighted, since purple marks only the current step in the pane. The edit is intended although the mission's "Extension documentation" decision leaves the root `README.md` untouched, and the README still does not mention the extension. It is verified by the block being valid Mermaid that renders and by its block names, frames, and arrows matching the pane's diagram.

---

## Remove the Draft's Stale Label Passages

Once the pane's workflow diagram replaces the mission page's label (the task "Workflow Diagram on Mission Pages"), `ideas/vscode_extension.md` and one sentence of `ideas/vscode_extension_follow_up.md` lose every passage the diagram makes stale, so the draft no longer describes a page the extension does not draw: the two entries describing the page's label and its rule of reading no commit subject, the "The page's label" entry under Mission pane and the Decided entry "The page's label tells apart only what the documents hold now, and gates no button", are deleted, and the remaining mentions of the label and of the page naming its mission by path and title are cut. No description of the diagram is added. It is verified by a grep for "label" and a read of both files finding no passage that describes the page's label or says the page reads no commit subject.

---

## Optional Note on the Discuss Button

On a question card of the `gurita-vscode` pane (`gurita-vscode/src/pane.ts`, `gurita-vscode/src/webview/page.ts`), the Discuss button always opens VS Code's input box for an optional discussion note before starting, as the New mission button asks for its goal, except that an empty value is accepted and Escape starts nothing; a non-empty note is appended to the `discuss-open-question` line directly after the Short Title as `--mission <path> <Short Title>. <note>`, while an empty note leaves the line exactly as it is today. The `### discuss-open-question` recipe in `snippets/GURITA_USAGE.md`, the extension's placeholder and session-variable lists, `gurita-vscode/README.md`, and the source comments are updated to match. It is verified by unit tests of the line built with and without a note, `npm test` and `npm run package` passing under Node 22, and the installed pane's Discuss button opening the box and starting a discussion that carries the typed note.

---
