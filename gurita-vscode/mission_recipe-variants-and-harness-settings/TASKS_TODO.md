# TASKS TODO

## One Look for Every Push Button

Every push button the pane draws gets one look, set in the stylesheet in `gurita-vscode/src/pane.ts`, the theme's primary button colour the recipe buttons carry today with a clearly visible outline: the recipe buttons, New mission, Define mission, Start run, the question-card and Answer with this alternative buttons, New task, the settings view's edit controls, and Refresh, Settings, Close settings, Check again, Previous, Next, and Close preview. The mission tabs, the two pane headers, and the dependency links keep their look, and the Settings control stays distinguishable while its view is shown, so that every button is as visible as the recipe buttons are now. It is verified by a test of the stylesheet's button rules and by `gurita-vscode/README.md` where it describes the buttons, with `npm test` passing under Node 22.

---

## Variant Cards in the Settings View

In the settings view (`gurita-vscode/src/webview/page.ts`, its stylesheet in `gurita-vscode/src/pane.ts`), each variant listed under Variants and under Single-task lines, the deleted ones included, is drawn as a card of its own: indented under its recipe or line heading, with a vertical line down its left edge and space between cards, because recipes and their variants are hard to tell apart there today. The change is display only, with no control, message, or stored value changed. It is verified by a page test of the card markup against the stylesheet rule and by `gurita-vscode/README.md` describing the settings view's layout, with `npm test` passing under Node 22.

---
