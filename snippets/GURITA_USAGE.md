<mission_path>
# Gurita CLI usage snippets

`<mission_path>` is the mission's repo-relative path exactly as `/gurita:define-mission-goal --at <scope> <goal>` printed it, trailing slash included (e.g. `mission_user-guide/`, or `packages/api/mission_rate-limits/`).

## Claude Code

### First run
```
claude -p "/gurita:specify-mission-starting-state --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/gurita:review-mission-requirements --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/gurita:provide-alternatives-to-all-open-questions --mission <mission_path>" --dangerously-skip-permissions --model "opus" --effort high;
claude "/gurita:recommend-all-open-questions --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
```

### Requirements iteration

```
claude -p "/gurita:answer-all-open-questions-with-recommendation --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/gurita:review-mission-requirements --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/gurita:provide-alternatives-to-all-open-questions --mission <mission_path>" --dangerously-skip-permissions --model "opus" --effort high;
claude "/gurita:recommend-all-open-questions --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
```

### In Claude Code commands
```
/gurita:answer-open-question-with-alternative --mission <mission_path>
/gurita:discuss-open-question --mission <mission_path>
/gurita:discuss-new-task --mission <mission_path>
/gurita:ask-in-mission-context --mission <mission_path>
/gurita:complete-task --mission <mission_path>
```

### Execute tasks of normal difficulty
```
claude -p "/gurita:answer-all-open-questions-with-recommendation --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/gurita:derive-tasks --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude "/gurita:complete-all-tasks --mission <mission_path>" --dangerously-skip-permissions --model "opus" --effort high;
```

### Execute tasks (critical tasks)
```
claude -p "/gurita:answer-all-open-questions-with-recommendation --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/gurita:derive-tasks --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude "/gurita:complete-all-tasks --mission <mission_path>" --dangerously-skip-permissions --model "opus" --effort xhigh;
```

### Execute tasks with extra requirement surface stretch
```
claude -p "/gurita:answer-all-open-questions-with-recommendation --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/gurita:review-mission-requirements --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/gurita:provide-alternatives-to-all-open-questions --mission <mission_path>" --dangerously-skip-permissions --model "opus" --effort high;
claude -p "/gurita:recommend-all-open-questions --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/gurita:answer-all-open-questions-with-recommendation --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/gurita:derive-tasks --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude "/gurita:complete-all-tasks --mission <mission_path>" --dangerously-skip-permissions --model "opus" --effort high;
```

### Single tasks with Opus xHigh

```
claude -p "/gurita:complete-task --mission <mission_path> <Task Title>" --dangerously-skip-permissions --model "opus" --effort xhigh;
```

### Finish mission
```
claude -p "/gurita:finish-mission --mission <mission_path>" --dangerously-skip-permissions --model "opus" --effort high;
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
agy plugin uninstall gurita
agy plugin install <path to your gurita clone>/hosts/antigravity
agy plugin list
```

### First run
```
agy -p "/gurita:specify-mission-starting-state --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/gurita:review-mission-requirements --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/gurita:provide-alternatives-to-all-open-questions --mission <mission_path>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort high;
agy -i "/gurita:recommend-all-open-questions --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
```

### Requirements iteration

```
agy -p "/gurita:answer-all-open-questions-with-recommendation --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/gurita:review-mission-requirements --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/gurita:provide-alternatives-to-all-open-questions --mission <mission_path>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort high;
agy -i "/gurita:recommend-all-open-questions --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
```

### In Antigravity commands
```
/gurita:answer-open-question-with-alternative --mission <mission_path>
/gurita:discuss-open-question --mission <mission_path>
/gurita:discuss-new-task --mission <mission_path>
```

### Execute tasks of normal difficulty
```
agy -p "/gurita:answer-all-open-questions-with-recommendation --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/gurita:derive-tasks --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -i "/gurita:complete-all-tasks --mission <mission_path>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort high;
```

### Execute tasks (critical tasks)

`high` is the ceiling on `agy`, so the execution line goes to Claude Code for `xhigh`.
```
agy -p "/gurita:answer-all-open-questions-with-recommendation --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/gurita:derive-tasks --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
claude "/gurita:complete-all-tasks --mission <mission_path>" --dangerously-skip-permissions --model "opus" --effort xhigh;
```

### Execute tasks with extra requirement surface stretch
```
agy -p "/gurita:answer-all-open-questions-with-recommendation --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/gurita:review-mission-requirements --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/gurita:provide-alternatives-to-all-open-questions --mission <mission_path>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort high;
agy -p "/gurita:recommend-all-open-questions --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/gurita:answer-all-open-questions-with-recommendation --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/gurita:derive-tasks --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -i "/gurita:complete-all-tasks --mission <mission_path>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort high;
```

### Mixed-agent requirements review (Gemini reviews, Claude annotates)
```
agy -p "/gurita:review-mission-requirements --mission <mission_path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
claude -p "/gurita:provide-alternatives-to-all-open-questions --mission <mission_path>" --dangerously-skip-permissions --model "opus" --effort high;
claude -p "/gurita:recommend-all-open-questions --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/gurita:answer-all-open-questions-with-recommendation --mission <mission_path>" --dangerously-skip-permissions --model "fable" --effort high;
```

### Single tasks with Opus High

```
agy -p "/gurita:complete-task --mission <mission_path> <Task Title>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort high;
```

### Finish mission
```
agy -p "/gurita:finish-mission --mission <mission_path>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort medium;
```

### Check models and effort levels

```
agy models
```


### Print all missions in the project chronologically

```
git log --no-renames --format='%at' --name-status -- ':(glob)**/mission_*/requirements.md' | awk -F'\t' 'NF==1{t=$1;next} NF==2&&!seen[$2]++{sub(/requirements\.md$/,"",$2); print ($1=="D"?t:"9999999999") "\t" $2}' | sort -t$'\t' -k1,1nr -k2,2 | cut -f2
```
