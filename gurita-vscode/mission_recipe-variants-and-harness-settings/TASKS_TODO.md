# TASKS TODO

## Shipped Recipe Set Revision

In `gurita-vscode/shipped_recipes.md`, the mixed-agent chain becomes the second `####` variant of `Requirements iteration` (`default`, today's block, first, then `Mixed-agent (Gemini reviews, Claude annotates)`, its lines as written), `Execute tasks one at a time` is removed with nothing else of the looped run touched (the three single-task lines and the settings view's Single-task lines part stay, the run reachable through an own recipe ending in `<single-task line>`), a recipe `Prepare and Execute tasks` is added at stage derive tasks with the variants `Normal difficulty` and `Critical tasks`, each holding the two lines of `Prepare tasks` as written followed by that `Execute tasks` variant's `complete-all-tasks` line as written, and the one line of `discuss-new-task` drops from `--effort xhigh` to `--effort high`. The user asked for this recipe set, which deliberately reverses the recorded decisions that the mixed-agent chain and `Execute tasks one at a time` stay recipes of their own. It is verified by the shipped-file tests and `gurita-vscode/README.md` describing the new set and what each workflow step's page lists, with `npm test` passing under Node 22.

---

## Own Variant Dropdown per Alternative Button

On a question card of the mission page (`gurita-vscode/src/webview/page.ts`, with `gurita-vscode/src/pane.ts` behind it), every Answer with this alternative button gets a variant dropdown of its own beside it, as the other fixed-name buttons have, and the one dropdown beside the Alternatives heading, shared by all of a card's buttons, goes. Each button's selection is its own, remembered in `workspaceState` per mission, question, and alternative as the other buttons' selections are remembered, so a pick on one alternative leaves every other button where it stood and a click runs the variant its own button stands on, which gives each alternative's button the variant choice every other run button already carries. It is verified by page and pane tests of the per-button dropdowns, picks, and clicks and by `gurita-vscode/README.md` describing them, with `npm test` passing under Node 22.

---

## One Look for Every Push Button

Every push button the pane draws gets one look, set in the stylesheet in `gurita-vscode/src/pane.ts`, the theme's primary button colour the recipe buttons carry today with a clearly visible outline: the recipe buttons, New mission, Define mission, Start run, the question-card and Answer with this alternative buttons, New task, the settings view's edit controls, and Refresh, Settings, Close settings, Check again, Previous, Next, and Close preview. The mission tabs, the two pane headers, and the dependency links keep their look, and the Settings control stays distinguishable while its view is shown, so that every button is as visible as the recipe buttons are now. It is verified by a test of the stylesheet's button rules and by `gurita-vscode/README.md` where it describes the buttons, with `npm test` passing under Node 22.

---

## Variant Cards in the Settings View

In the settings view (`gurita-vscode/src/webview/page.ts`, its stylesheet in `gurita-vscode/src/pane.ts`), each variant listed under Variants and under Single-task lines, the deleted ones included, is drawn as a card of its own: indented under its recipe or line heading, with a vertical line down its left edge and space between cards, because recipes and their variants are hard to tell apart there today. The change is display only, with no control, message, or stored value changed. It is verified by a page test of the card markup against the stylesheet rule and by `gurita-vscode/README.md` describing the settings view's layout, with `npm test` passing under Node 22.

---
