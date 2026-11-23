# TASKS TODO

## Requirements Iteration Listed on First Review Round

On the mission page of Gurita for VS Code, a page whose diagram fills **first review round** while any question is open also lists the recipes declaring the additional review round, `Requirements iteration` and the mixed-agent chain, beside `First run` (`stageRecipes` and `PAIRED_STAGES` in `gurita-vscode/src/recipes.ts`, called from `src/pane.ts`), since today a mission with one review commit and questions lacking a pick or alternatives lists `First run` alone and `Requirements iteration` cannot be run from its page. The diagram's filled block, its round count, and `nextStep` stay as they are, and a fresh mission with no open question keeps `First run` alone. It is verified by recipe and pane tests covering both first-review-round cases, with `gurita-vscode/README.md` matching.

---
