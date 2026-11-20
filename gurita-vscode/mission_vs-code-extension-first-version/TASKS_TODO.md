# TASKS TODO

## Remove the Draft's Stale Label Passages

Once the pane's workflow diagram replaces the mission page's label (the task "Workflow Diagram on Mission Pages"), `ideas/vscode_extension.md` and one sentence of `ideas/vscode_extension_follow_up.md` lose every passage the diagram makes stale, so the draft no longer describes a page the extension does not draw: the two entries describing the page's label and its rule of reading no commit subject, the "The page's label" entry under Mission pane and the Decided entry "The page's label tells apart only what the documents hold now, and gates no button", are deleted, and the remaining mentions of the label and of the page naming its mission by path and title are cut. No description of the diagram is added. It is verified by a grep for "label" and a read of both files finding no passage that describes the page's label or says the page reads no commit subject.

---

## Optional Note on the Discuss Button

On a question card of the `gurita-vscode` pane (`gurita-vscode/src/pane.ts`, `gurita-vscode/src/webview/page.ts`), the Discuss button always opens VS Code's input box for an optional discussion note before starting, as the New mission button asks for its goal, except that an empty value is accepted and Escape starts nothing; a non-empty note is appended to the `discuss-open-question` line directly after the Short Title as `--mission <path> <Short Title>. <note>`, while an empty note leaves the line exactly as it is today. The `### discuss-open-question` recipe in `snippets/GURITA_USAGE.md`, the extension's placeholder and session-variable lists, `gurita-vscode/README.md`, and the source comments are updated to match. It is verified by unit tests of the line built with and without a note, `npm test` and `npm run package` passing under Node 22, and the installed pane's Discuss button opening the box and starting a discussion that carries the typed note.

---
