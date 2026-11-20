# TASKS TODO

## New Task Button on Mission Pages

Each mission's page gains a New task button beside its remaining-task headings that, like New mission runs `discuss-mission-goal`, asks for the issue in VS Code's input box (a new known placeholder `<issue description>`, filled through `GURITA_ISSUE_DESCRIPTION`) and runs a new shipped `### discuss-new-task` recipe under `## Claude Code` in `snippets/GURITA_USAGE.md`, its one line `claude "/gurita:discuss-new-task --mission <path> <issue description>" --dangerously-skip-permissions --model "fable" --effort xhigh; # interactive`, with no separate submit button since `discuss-new-task` hands off to `submit-task` inside its own conversation. `BUTTON_RECIPES` gains `discuss-new-task` as a seventh fixed name and `gurita-vscode/README.md` lists the new button and recipe. It is verified by recipe-reader and placeholder unit tests covering the new recipe and placeholder, the npm test script and `npm run package` passing under Node 22, and the button appearing on a mission's page and opening an interactive terminal running that line for the mission's path.

---
