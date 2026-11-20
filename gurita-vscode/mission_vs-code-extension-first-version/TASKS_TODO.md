# TASKS TODO

## Optional Note on the Discuss Button

On a question card of the `gurita-vscode` pane (`gurita-vscode/src/pane.ts`, `gurita-vscode/src/webview/page.ts`), the Discuss button always opens VS Code's input box for an optional discussion note before starting, as the New mission button asks for its goal, except that an empty value is accepted and Escape starts nothing; a non-empty note is appended to the `discuss-open-question` line directly after the Short Title as `--mission <path> <Short Title>. <note>`, while an empty note leaves the line exactly as it is today. The `### discuss-open-question` recipe in `snippets/GURITA_USAGE.md`, the extension's placeholder and session-variable lists, `gurita-vscode/README.md`, and the source comments are updated to match. It is verified by unit tests of the line built with and without a note, `npm test` and `npm run package` passing under Node 22, and the installed pane's Discuss button opening the box and starting a discussion that carries the typed note.

---
