# TASKS TODO

## Show In-Progress Runs on Mission Pages

While a chain started for a mission is running, as held in the `running` map of `gurita-vscode/src/runs.ts` until the run's terminal closes, that mission's page disables every action button on it (recipe buttons, question-row buttons, and New task) and pulses the workflow diagram's filled step block, while the tabs, Refresh, other missions' pages, and the New mission and Define mission buttons stay enabled; the extension posts this state to the page when a run starts, when its terminal closes, and on every redraw, a hidden pane shown again included. This replaces the Pane decision "Second click" ("Every button stays enabled … never drawn on the page"), keeping its click-time refusal and notification as a fallback. Verified by unit tests or a harness showing the buttons disabled and the pulse on while that mission's run is held and both gone after its terminal closes, other missions' pages unaffected, the README and source comments updated, and `npm test` and `npm run package` passing under Node 22 through nvm.

---
