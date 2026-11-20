# TASKS TODO

## New Task Button on Mission Pages

Each mission's page gains a New task button beside its remaining-task headings that, like New mission runs `discuss-mission-goal`, asks for the issue in VS Code's input box (a new known placeholder `<issue description>`, filled through `GURITA_ISSUE_DESCRIPTION`) and runs a new shipped `### discuss-new-task` recipe under `## Claude Code` in `snippets/GURITA_USAGE.md`, its one line `claude "/gurita:discuss-new-task --mission <path> <issue description>" --dangerously-skip-permissions --model "fable" --effort xhigh; # interactive`, with no separate submit button since `discuss-new-task` hands off to `submit-task` inside its own conversation. `BUTTON_RECIPES` gains `discuss-new-task` as a seventh fixed name and `gurita-vscode/README.md` lists the new button and recipe. It is verified by recipe-reader and placeholder unit tests covering the new recipe and placeholder, the npm test script and `npm run package` passing under Node 22, and the button appearing on a mission's page and opening an interactive terminal running that line for the mission's path.

---

## Step Marker With Filled Session Values

The marker `gurita-vscode/runner.py`'s `step_marker` prints before each chain line through `compose_script` reads `Step N of TOTAL: <line>` instead of `Line N of TOTAL: <line>`, and shows every session-variable reference in the line (`${GURITA_PATH}`, `${GURITA_TASK_TITLE}`) as its value, so the terminal names the real mission path and task title instead of the variable. Nothing else in the line is expanded and the line that runs stays unchanged, and the README's marker description says the same. It is verified by `runner_tests/test_runner_step_marker.py` expecting the `Step` wording and the filled values for a chain and a looped session, both pytest runs passing, and a hand-run chain printing a marker such as `Step 1 of 4: claude -p "/gurita:answer-all-open-questions-with-recommendation --mission gurita-vscode/mission_vs-code-extension-first-version/" …`.

---
