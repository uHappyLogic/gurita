# Gurita for VS Code shipped recipes

The recipes Gurita for VS Code ships: `scripts/bundle.js` copies this file into the package as `bundled/shipped_recipes.md`, and the extension's recipe reader reads only the `###` blocks under its `## Recipes` heading.

`<path>` is the mission's repo-relative path exactly as `/gurita:define-mission-goal --at <scope> <goal>` printed it, trailing slash included (e.g. `mission_user-guide/`, or `packages/api/mission_rate-limits/`).

`<note>` is optional: with no note, leave it out together with the `. ` written before it.

A `Stage:` line beneath a chain's heading, once for the whole recipe, names the one step of the mission workflow the chain runs: first review round, additional review round, derive tasks, execute tasks, follow up tasks, or finish.

## Recipes

Each `###` heading is one recipe, its name the button's. A recipe of several variants holds one `####` sub-heading per variant, naming it above its own fenced block, and a recipe of one block and no `####` is a recipe of one variant.

On Antigravity:
Run every line from the project root: `agy` uses the working directory as its workspace, so no `--add-dir` is needed.
`--model` takes a base id from `agy models` (no `-low`/`-medium`/`-high` suffix) and `--effort` picks the level.
These models go up to `high` only, so a `claude` line's `xhigh` becomes `high` here (`xhigh` stops with `has no "xhigh" effort`).
Model mapping: `fable` → `gemini-4-argon`, `opus` → `claude-opus-5-5`.
`agy -i` is the interactive counterpart of a bare `claude "..."` (starts with the prompt, keeps the session open).

### First run
Stage: first review round
```
claude -p "/gurita:specify-mission-starting-state --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/gurita:review-mission-requirements --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/gurita:provide-alternatives-to-all-open-questions --mission <path>" --dangerously-skip-permissions --model "opus" --effort high;
claude "/gurita:recommend-all-open-questions --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh; # interactive
```

### Approve all standing recommendations and review again
Stage: additional review round

#### default
```
claude -p "/gurita:answer-all-open-questions-with-recommendation --mission <path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/gurita:review-mission-requirements --mission <path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/gurita:provide-alternatives-to-all-open-questions --mission <path>" --dangerously-skip-permissions --model "opus" --effort high;
claude "/gurita:recommend-all-open-questions --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh; # interactive
```

### Prepare tasks
Stage: derive tasks
```
claude -p "/gurita:answer-all-open-questions-with-recommendation --mission <path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/gurita:derive-tasks --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
```

### Prepare and Execute tasks
Stage: derive tasks

#### Normal difficulty
```
claude -p "/gurita:answer-all-open-questions-with-recommendation --mission <path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/gurita:derive-tasks --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "opus" --effort high; # interactive
```

#### Critical tasks
```
claude -p "/gurita:answer-all-open-questions-with-recommendation --mission <path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/gurita:derive-tasks --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "opus" --effort xhigh; # interactive
```

### Execute tasks
Stage: execute tasks

#### Normal difficulty
```
claude "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "opus" --effort high; # interactive
```

#### Critical tasks
```
claude "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "opus" --effort xhigh; # interactive
```

### Single task with Opus xHigh (Claude Code)

```
claude -p "/gurita:complete-task --mission <path> <Task Title>" --dangerously-skip-permissions --model "opus" --effort xhigh;
```

### Single task with Opus High (Claude Code)
```
claude -p "/gurita:complete-task --mission <path> <Task Title>" --dangerously-skip-permissions --model "opus" --effort high;
```

### Single task with Opus High (Antigravity)

```
agy -p "/gurita:complete-task --mission <path> <Task Title>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort high;
```

### Finish mission
Stage: finish
```
claude -p "/gurita:finish-mission --mission <path>" --dangerously-skip-permissions --model "opus" --effort high;
```

### discuss-open-question
```
claude "/gurita:discuss-open-question --mission <path> <Short Title>. <note>" --dangerously-skip-permissions --model "fable" --effort xhigh; # interactive
```

### discuss-mission-goal
```
claude "/gurita:discuss-mission-goal <goal>" --dangerously-skip-permissions --model "fable" --effort xhigh; # interactive
```

### discuss-new-task
```
claude "/gurita:discuss-new-task --mission <path> <issue description>" --dangerously-skip-permissions --model "fable" --effort high; # interactive
```

### answer-open-question
```
claude -p "/gurita:answer-open-question --mission <path> <Short Title>. <answer text>" --dangerously-skip-permissions --model "fable" --effort high;
```

### answer-open-question-with-alternative
```
claude -p "/gurita:answer-open-question-with-alternative --mission <path> <Short Title>. <Alternative Id>" --dangerously-skip-permissions --model "fable" --effort high;
```

### define-mission-goal
```
claude -p "/gurita:define-mission-goal --at <scope> <goal>" --dangerously-skip-permissions --model "sonnet" --effort medium;
```
