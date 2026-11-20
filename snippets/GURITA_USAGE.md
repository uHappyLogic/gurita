# Gurita CLI usage snippets

`<path>` is the mission's repo-relative path exactly as `/gurita:define-mission-goal --at <scope> <goal>` printed it, trailing slash included (e.g. `mission_user-guide/`, or `packages/api/mission_rate-limits/`).

## Claude Code

### First run
```
claude -p "/gurita:specify-mission-starting-state --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/gurita:review-mission-requirements --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/gurita:provide-alternatives-to-all-open-questions --mission <path>" --dangerously-skip-permissions --model "opus" --effort high;
claude "/gurita:recommend-all-open-questions --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh; # interactive
```

### Requirements iteration

```
claude -p "/gurita:answer-all-open-questions-with-recommendation --mission <path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/gurita:review-mission-requirements --mission <path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/gurita:provide-alternatives-to-all-open-questions --mission <path>" --dangerously-skip-permissions --model "opus" --effort high;
claude "/gurita:recommend-all-open-questions --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh; # interactive
```

### Prepare tasks
```
claude -p "/gurita:answer-all-open-questions-with-recommendation --mission <path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/gurita:derive-tasks --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
```

### Execute tasks of normal difficulty
```
claude -p "/gurita:answer-all-open-questions-with-recommendation --mission <path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/gurita:derive-tasks --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "opus" --effort high; # interactive
```

### Execute tasks (critical tasks)
```
claude -p "/gurita:answer-all-open-questions-with-recommendation --mission <path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/gurita:derive-tasks --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "opus" --effort xhigh; # interactive
```

### Execute tasks with extra requirement surface stretch
```
claude -p "/gurita:answer-all-open-questions-with-recommendation --mission <path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/gurita:review-mission-requirements --mission <path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/gurita:provide-alternatives-to-all-open-questions --mission <path>" --dangerously-skip-permissions --model "opus" --effort high;
claude -p "/gurita:recommend-all-open-questions --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/gurita:answer-all-open-questions-with-recommendation --mission <path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/gurita:derive-tasks --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "opus" --effort high; # interactive
```

### Execute tasks one at a time
```
<single-task line>
```

### Single task with Opus xHigh (Claude Code)

```
claude -p "/gurita:complete-task --mission <path> <Task Title>" --dangerously-skip-permissions --model "opus" --effort xhigh;
```

### Single task with Opus High (Claude Code)
```
claude -p "/gurita:complete-task --mission <path> <Task Title>" --dangerously-skip-permissions --model "opus" --effort high;
```

### Finish mission
```
claude -p "/gurita:finish-mission --mission <path>" --dangerously-skip-permissions --model "opus" --effort high;
```

### discuss-open-question
```
claude "/gurita:discuss-open-question --mission <path> <Short Title>" --dangerously-skip-permissions --model "fable" --effort xhigh; # interactive
```

### discuss-mission-goal
```
claude "/gurita:discuss-mission-goal <goal>" --dangerously-skip-permissions --model "fable" --effort xhigh; # interactive
```

### answer-open-question
```
claude -p "/gurita:answer-open-question --mission <path> <Short Title>. <answer text>" --dangerously-skip-permissions --model "fable" --effort high;
```

### answer-open-question-with-recommendation
```
claude -p "/gurita:answer-open-question-with-recommendation --mission <path> <Short Title>" --dangerously-skip-permissions --model "fable" --effort high;
```

### answer-open-question-with-alternative
```
claude -p "/gurita:answer-open-question-with-alternative --mission <path> <Short Title>. <Alternative Id>" --dangerously-skip-permissions --model "fable" --effort high;
```

### define-mission-goal
```
claude -p "/gurita:define-mission-goal --at <scope> <goal>" --dangerously-skip-permissions --model "sonnet" --effort medium;
```

## Antigravity

Run every line from the project root: `agy` uses the working directory as its workspace, so no `--add-dir` is needed.
`--model` takes a base id from `agy models` (no `-low`/`-medium`/`-high` suffix) and `--effort` picks the level.
These models go up to `high` only, so a `claude` line's `xhigh` becomes `high` here (`xhigh` stops with `has no "xhigh" effort`).
Model mapping: `fable` → `gemini-4-argon`, `opus` → `claude-opus-5-5`.
`agy -i` is the interactive counterpart of a bare `claude "..."` (starts with the prompt, keeps the session open).

### First run (Antigravity)
```
agy -p "/gurita:specify-mission-starting-state --mission <path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/gurita:review-mission-requirements --mission <path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/gurita:provide-alternatives-to-all-open-questions --mission <path>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort high;
agy -i "/gurita:recommend-all-open-questions --mission <path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium; # interactive
```

### Requirements iteration (Antigravity)

```
agy -p "/gurita:answer-all-open-questions-with-recommendation --mission <path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/gurita:review-mission-requirements --mission <path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/gurita:provide-alternatives-to-all-open-questions --mission <path>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort high;
agy -i "/gurita:recommend-all-open-questions --mission <path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium; # interactive
```

### Prepare tasks (Antigravity)
```
agy -p "/gurita:answer-all-open-questions-with-recommendation --mission <path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/gurita:derive-tasks --mission <path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
```

### Execute tasks of normal difficulty (Antigravity)
```
agy -p "/gurita:answer-all-open-questions-with-recommendation --mission <path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/gurita:derive-tasks --mission <path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -i "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort high; # interactive
```

### Execute tasks (critical tasks) (Antigravity)

`high` is the ceiling on `agy`, so the execution line goes to Claude Code for `xhigh`.
```
agy -p "/gurita:answer-all-open-questions-with-recommendation --mission <path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/gurita:derive-tasks --mission <path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
claude "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "opus" --effort xhigh; # interactive
```

### Execute tasks with extra requirement surface stretch (Antigravity)
```
agy -p "/gurita:answer-all-open-questions-with-recommendation --mission <path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/gurita:review-mission-requirements --mission <path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/gurita:provide-alternatives-to-all-open-questions --mission <path>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort high;
agy -p "/gurita:recommend-all-open-questions --mission <path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/gurita:answer-all-open-questions-with-recommendation --mission <path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -p "/gurita:derive-tasks --mission <path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
agy -i "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort high; # interactive
```

### Mixed-agent requirements review (Gemini reviews, Claude annotates)
```
agy -p "/gurita:review-mission-requirements --mission <path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;
claude -p "/gurita:provide-alternatives-to-all-open-questions --mission <path>" --dangerously-skip-permissions --model "opus" --effort high;
claude -p "/gurita:recommend-all-open-questions --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/gurita:answer-all-open-questions-with-recommendation --mission <path>" --dangerously-skip-permissions --model "fable" --effort high;
```

### Single task with Opus High (Antigravity)

```
agy -p "/gurita:complete-task --mission <path> <Task Title>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort high;
```

### Finish mission (Antigravity)
```
agy -p "/gurita:finish-mission --mission <path>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort medium;
```

## Manual use

### In Claude Code commands
```
/gurita:answer-open-question-with-alternative --mission <path>
/gurita:discuss-open-question --mission <path>
/gurita:discuss-new-task --mission <path>
/gurita:ask-in-mission-context --mission <path>
/gurita:complete-task --mission <path>
```

### Install

```
agy plugin uninstall gurita
agy plugin install <path to your gurita clone>/hosts/antigravity
agy plugin list
```

### In Antigravity commands
```
/gurita:answer-open-question-with-alternative --mission <path>
/gurita:discuss-open-question --mission <path>
/gurita:discuss-new-task --mission <path>
```

### Check models and effort levels

```
agy models
```

### Print all missions in the project chronologically

```
git log --no-renames --format='%at' --name-status -- ':(glob)**/mission_*/requirements.md' | awk -F'\t' 'NF==1{t=$1;next} NF==2&&!seen[$2]++{sub(/requirements\.md$/,"",$2); print ($1=="D"?t:"9999999999") "\t" $2}' | sort -t$'\t' -k1,1nr -k2,2 | cut -f2
```
