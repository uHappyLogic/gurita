<mission_path>
# Cairn CLI usage snippets

`<mission_path>` is the mission's repo-relative path exactly as `/cairn:define-mission-goal --at <scope> <goal>` printed it, trailing slash included (e.g. `mission_user-guide/`, or `packages/api/mission_rate-limits/`).

## Claude Code

### First run
```
claude -p "/cairn:specify-mission-starting-state --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/cairn:review-mission-requirements --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/cairn:provide-alternatives-to-all-open-questions --mission <mission_path>" --dangerously-skip-permissions --model "opus" --effort high;
claude "/cairn:recommend-all-open-questions --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
```

### Requirements iteration

```
claude -p "/cairn:answer-all-open-questions-with-recommendation --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/cairn:review-mission-requirements --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/cairn:provide-alternatives-to-all-open-questions --mission <mission_path>" --dangerously-skip-permissions --model "opus" --effort high;
claude "/cairn:recommend-all-open-questions --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
```

### In Claude Code commands
```
/cairn:answer-open-question-with-alternative --mission <mission_path>
/cairn:discuss-open-question --mission <mission_path>
/cairn:discuss-new-task --mission <mission_path>
/cairn:ask-in-mission-context --mission <mission_path>
/cairn:complete-task --mission <mission_path>
```

### Execute tasks of normal difficulty
```
claude -p "/cairn:answer-all-open-questions-with-recommendation --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/cairn:derive-tasks --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude "/cairn:complete-all-tasks --mission <mission_path>" --dangerously-skip-permissions --model "opus" --effort high;
```

### Execute tasks (critical tasks)
```
claude -p "/cairn:answer-all-open-questions-with-recommendation --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/cairn:derive-tasks --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude "/cairn:complete-all-tasks --mission <mission_path>" --dangerously-skip-permissions --model "opus" --effort xhigh;
```

### Execute tasks with extra requirement surface stretch
```
claude -p "/cairn:answer-all-open-questions-with-recommendation --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/cairn:review-mission-requirements --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/cairn:provide-alternatives-to-all-open-questions --mission <mission_path>" --dangerously-skip-permissions --model "opus" --effort high;
claude -p "/cairn:recommend-all-open-questions --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/cairn:answer-all-open-questions-with-recommendation --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/cairn:derive-tasks --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude "/cairn:complete-all-tasks --mission <mission_path>" --dangerously-skip-permissions --model "opus" --effort high;
```

### Single tasks with Opus xHigh

```
claude -p "/cairn:complete-task --mission <mission_path> <Task Title>" --dangerously-skip-permissions --model "opus" --effort xhigh;
```

### Finish mission
```
claude -p "/cairn:finish-mission --mission <mission_path>" --dangerously-skip-permissions --model "opus" --effort high;
```

### API KEY usage

```
source .env_anthropic
```

### Wait for next quota reset

```
claude-wait;
```

## Antigravity

Run every line from the project root: `agy` uses the working directory as its workspace, so no `--add-dir` is needed.
`--model` takes a base id from `agy models` (no `-low`/`-medium`/`-high` suffix) and `--effort` picks the level.
These models go up to `high` only, so a `claude` line's `xhigh` becomes `high` here (`xhigh` stops with `has no "xhigh" effort`).
Model mapping: `fable` → `gemini-4-argon`, `opus` → `claude-opus-5-5`.
`agy -i` is the interactive counterpart of a bare `claude "..."` (starts with the prompt, keeps the session open).

### Install

```
agy plugin uninstall cairn
agy plugin install /Users/lucask/workspace/cairn/hosts/antigravity
agy plugin list
```

### First run
```
agy -p "/cairn:specify-mission-starting-state --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/cairn:review-mission-requirements --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/cairn:provide-alternatives-to-all-open-questions --mission <mission_path>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort high;
agy -i "/cairn:recommend-all-open-questions --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
```

### Requirements iteration

```
agy -p "/cairn:answer-all-open-questions-with-recommendation --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/cairn:review-mission-requirements --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/cairn:provide-alternatives-to-all-open-questions --mission <mission_path>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort high;
agy -i "/cairn:recommend-all-open-questions --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
```

```
/cairn:answer-open-question-with-alternative --mission <mission_path>
/cairn:discuss-open-question --mission <mission_path>
/cairn:discuss-new-task --mission <mission_path>
```

### Execute tasks of normal difficulty
```
agy -p "/cairn:answer-all-open-questions-with-recommendation --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/cairn:derive-tasks --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -i "/cairn:complete-all-tasks --mission <mission_path>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort high;
```

### Execute tasks (critical tasks)

`high` is the ceiling on `agy`, so the execution line goes to Claude Code for `xhigh`.
```
agy -p "/cairn:answer-all-open-questions-with-recommendation --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/cairn:derive-tasks --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
claude "/cairn:complete-all-tasks --mission <mission_path>" --dangerously-skip-permissions --model "opus" --effort xhigh;
```

### Execute tasks with extra requirement surface stretch
```
agy -p "/cairn:answer-all-open-questions-with-recommendation --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/cairn:review-mission-requirements --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/cairn:provide-alternatives-to-all-open-questions --mission <mission_path>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort high;
agy -p "/cairn:recommend-all-open-questions --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/cairn:answer-all-open-questions-with-recommendation --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/cairn:derive-tasks --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -i "/cairn:complete-all-tasks --mission <mission_path>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort high;
```

### Mixed-agent requirements review (Gemini reviews, Claude annotates)
```
agy -p "/cairn:review-mission-requirements --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
claude -p "/cairn:provide-alternatives-to-all-open-questions --mission <mission_path>" --dangerously-skip-permissions --model "opus" --effort high;
claude -p "/cairn:recommend-all-open-questions --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/cairn:answer-all-open-questions-with-recommendation --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort high;
```

### Single tasks with Opus High

```
agy -p "/cairn:complete-task --mission <mission_path> <Task Title>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort high;
```

### Finish mission
```
agy -p "/cairn:finish-mission --mission <mission_path>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort medium;
```

### Check models and effort levels

```
agy models
```


### Print all missions in the project chronologically

```
git log --no-renames --format='%at' --name-status -- ':(glob)**/mission_*/requirements.md' | awk -F'\t' 'NF==1{t=$1;next} NF==2&&!seen[$2]++{sub(/requirements\.md$/,"",$2); print ($1=="D"?t:"9999999999") "\t" $2}' | sort -t$'\t' -k1,1nr -k2,2 | cut -f2
```