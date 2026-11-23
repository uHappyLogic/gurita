# TASKS TODO

## New Task Button Above the Panes

On the mission page of Gurita for VS Code (`gurita-vscode/src/webview/page.ts`), the New task button, with its label and variant dropdown, moves out of the Remaining tasks pane into a row of its own directly above the Open questions and Remaining tasks headers, so it is drawn on every mission page whichever pane is shown and at every workflow step, still disabled while a run for the mission is going. It is needed because the button is not drawn while Open questions is shown, so a task cannot be added from a page that opens there. It is verified by page tests showing the button with either pane selected and absent from the Remaining tasks pane itself, by `npm test` passing, and by `gurita-vscode/README.md` describing the button where it is drawn.

---
