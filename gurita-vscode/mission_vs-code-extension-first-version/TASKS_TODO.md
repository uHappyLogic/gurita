# TASKS TODO

## Focus a Mission's Run Terminal From Its Tab

Clicking a mission's tab in the pane drawn by `gurita-vscode/src/webview/page.ts`, whether or not that tab is already selected, brings forward and focuses the terminal of that mission's running runner when it has one, and does nothing more, with no notification, when it has none: the page posts the clicked mission's path to the extension on every tab click, and `src/pane.ts` answers by calling `show()` on the terminal `src/runs.ts` keeps for that mission. Verified by unit tests (a tab click posting its mission's path for a selected and an unselected tab, the terminal shown for a mission with a held run, nothing shown and no notification for one without), by `gurita-vscode/README.md` and the source comments describing the behaviour, and by `npm test` and `npm run package` passing under Node 22 through nvm.

---

## Stage Declaration for Recipes and One-Step Shipped Chains

The recipe reader `gurita-vscode/src/recipes.ts` reads an optional `Stage: <step name>` line standing between a recipe's `###` heading and its fence, in the shipped snippet file and in a person's own recipe file alike, the names being the workflow diagram's (first review round, additional review round, derive tasks, execute tasks, follow up tasks, finish), and a recipe with no such line, or with a name the reader does not know, counts as undeclared, so that a mission page can later list only the recipes of the step its diagram fills. In `snippets/GURITA_USAGE.md`, under both host headings, every chain declares its one step and spans no other: First run declares first review round; Requirements iteration and the Mixed-agent requirements review declare additional review round; Prepare tasks declares derive tasks; "Execute tasks of normal difficulty" and "Execute tasks (critical tasks)" are each cut to their `complete-all-tasks` line alone and declare execute tasks, as does the looped "Execute tasks one at a time"; "Execute tasks with extra requirement surface stretch" is removed from both hosts; Finish mission declares finish; no shipped recipe declares follow up tasks, and the button recipes and single-task lines declare nothing and stay as they are. Verified by unit tests over the declaration (declared, undeclared, unknown name, own file) and over the shipped file (every chain declares exactly one step and no execute recipe holds a `derive-tasks` line), by `gurita-vscode/README.md` and the source comments describing the declaration and the reshaped chains, and by `npm test` and `npm run package` passing under Node 22 through nvm.

---

## Stage-Filtered Recipe List on Mission Pages

Each mission page drawn by `gurita-vscode/src/webview/page.ts` from what `src/pane.ts` posts lists only the recipes whose declared stage, as the recipe reader `src/recipes.ts` reads it, is the step the page's workflow diagram fills, and beside them the additional review round's recipes when `derive` is filled and the follow up tasks step's when `finish` is filled, so a person is offered only the chains that fit the mission's state. An undeclared recipe is listed whatever the step and a page whose step could not be chosen lists every recipe, while the host groups, "Your recipes", the unfillable-placeholder rule, and the buttons that run a recipe by its fixed name stay as they are, and the sentence of `ideas/vscode_extension.md` saying the pane offers every shipped recipe is corrected to the stage-filtered list. Verified by unit tests over the filter rule (each filled step, the two pairs, an undeclared recipe, no step chosen), by `gurita-vscode/README.md` and the source comments describing the filtered list, and by `npm test` and `npm run package` passing under Node 22 through nvm.

---
