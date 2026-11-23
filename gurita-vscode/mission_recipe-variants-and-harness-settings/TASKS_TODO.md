# TASKS TODO

## Harness Values on the Fixed-Name Buttons

On the mission pane of Gurita for VS Code (`gurita-vscode/src/pane.ts` posting, `gurita-vscode/src/webview/page.ts` drawing), each of the seven fixed-name buttons that start a harness run (New mission, Define mission, New task, and the question card's Discuss, Answer, Answer with recommendation, and Answer with this alternative) shows what it will run in the form the recipe list's buttons use: its name plus the distinct harnesses, models, and efforts of the variant it runs, that recipe's default as picked in the settings view, with the variant's lines as written in its hover text, and the name alone when the recipe cannot be read or none of its lines is readable, the looped run and its preview staying as they are. It is needed so that every button calling a harness says which harness, model, and effort it calls. It is verified by page and pane tests showing the label and hover text on all seven buttons following a default picked in the settings view, by `npm test` passing, and by `gurita-vscode/README.md` describing the buttons as drawn.

---
