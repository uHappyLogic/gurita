# TASKS TODO

## Stage-Filtered Recipe List on Mission Pages

Each mission page drawn by `gurita-vscode/src/webview/page.ts` from what `src/pane.ts` posts lists only the recipes whose declared stage, as the recipe reader `src/recipes.ts` reads it, is the step the page's workflow diagram fills, and beside them the additional review round's recipes when `derive` is filled and the follow up tasks step's when `finish` is filled, so a person is offered only the chains that fit the mission's state. An undeclared recipe is listed whatever the step and a page whose step could not be chosen lists every recipe, while the host groups, "Your recipes", the unfillable-placeholder rule, and the buttons that run a recipe by its fixed name stay as they are, and the sentence of `ideas/vscode_extension.md` saying the pane offers every shipped recipe is corrected to the stage-filtered list. Verified by unit tests over the filter rule (each filled step, the two pairs, an undeclared recipe, no step chosen), by `gurita-vscode/README.md` and the source comments describing the filtered list, and by `npm test` and `npm run package` passing under Node 22 through nvm.

---
