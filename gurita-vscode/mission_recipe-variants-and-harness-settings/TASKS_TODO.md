# TASKS TODO

## Shipped Recipe Set Revision

In `gurita-vscode/shipped_recipes.md`, the mixed-agent chain becomes the second `####` variant of `Requirements iteration` (`default`, today's block, first, then `Mixed-agent (Gemini reviews, Claude annotates)`, its lines as written), `Execute tasks one at a time` is removed with nothing else of the looped run touched (the three single-task lines and the settings view's Single-task lines part stay, the run reachable through an own recipe ending in `<single-task line>`), a recipe `Prepare and Execute tasks` is added at stage derive tasks with the variants `Normal difficulty` and `Critical tasks`, each holding the two lines of `Prepare tasks` as written followed by that `Execute tasks` variant's `complete-all-tasks` line as written, and the one line of `discuss-new-task` drops from `--effort xhigh` to `--effort high`. The user asked for this recipe set, which deliberately reverses the recorded decisions that the mixed-agent chain and `Execute tasks one at a time` stay recipes of their own. It is verified by the shipped-file tests and `gurita-vscode/README.md` describing the new set and what each workflow step's page lists, with `npm test` passing under Node 22.

---
