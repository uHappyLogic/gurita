# Fixture snippets

`<path>` is the mission's path.

### Above every host heading
```
claude -p "/gurita:finish-mission --mission <path>";
```

## Claude Code

### Chain
Stage: additional review round
```
claude -p "/gurita:review-mission-requirements --mission <path>" --model "fable";
claude "/gurita:recommend-all-open-questions --mission <path>" --model "fable"; # interactive
```

### Loop
Stage: execute tasks
```
source .env_fixture
<single-task line>
```

### Single task (Claude Code)

```
claude -p "/gurita:complete-task --mission <path> <Task Title>" --model "opus" --effort high;
```

### Interactive task line
```
claude "/gurita:complete-task --mission <path> <Task Title>"; # interactive
```

### answer-open-question
```
claude -p "/gurita:answer-open-question --mission <path> <Short Title>. <answer text>";
```

### Fenced heading
```
## Not a heading
### Not a recipe
#### Not a variant
echo <mystery thing> <path>
```

### Variants
Stage: execute tasks
Prose between the recipe's heading and its first variant.

#### On Claude Code
```
claude -p "/gurita:complete-all-tasks --mission <path>" --model "opus" --effort high;
```

#### On Antigravity
Prose between a variant's heading and its fence.
Stage: finish
```
agy -p "/gurita:complete-all-tasks --mission <path>" --model "claude-opus-5-5" --effort high;
```
```
echo a second fence under a variant is not read
```

#### Empty variant

#### On Claude Code
```
echo a repeated variant name is not read
```

## Antigravity

Prose between the host heading and its first block.

### Single task (Antigravity)

Prose between a heading and its fence.
Stage: Execute Tasks
```
agy -p "/gurita:complete-task --mission <path> <Task Title>" --model "claude-opus-5-5";
```

### Two fences
```
agy -p "/gurita:derive-tasks --mission <path>";
```
Stage: derive tasks
```
echo second fence
```

### Block before variants
```
echo a block above the first variant is not read
```
#### Only variant
```
agy -p "/gurita:finish-mission --mission <path>";
```

## Manual use

### Not shipped
```
/gurita:discuss-new-task --mission <path>
```
