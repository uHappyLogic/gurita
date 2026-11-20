# TASKS TODO

## Step Marker With Filled Session Values

The marker `gurita-vscode/runner.py`'s `step_marker` prints before each chain line through `compose_script` reads `Step N of TOTAL: <line>` instead of `Line N of TOTAL: <line>`, and shows every session-variable reference in the line (`${GURITA_PATH}`, `${GURITA_TASK_TITLE}`) as its value, so the terminal names the real mission path and task title instead of the variable. Nothing else in the line is expanded and the line that runs stays unchanged, and the README's marker description says the same. It is verified by `runner_tests/test_runner_step_marker.py` expecting the `Step` wording and the filled values for a chain and a looped session, both pytest runs passing, and a hand-run chain printing a marker such as `Step 1 of 4: claude -p "/gurita:answer-all-open-questions-with-recommendation --mission gurita-vscode/mission_vs-code-extension-first-version/" …`.

---
