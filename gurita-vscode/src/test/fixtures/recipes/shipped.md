# Fixture snippets

`<path>` is the mission's path.

### Above every host heading
```
claude -p "/gurita:finish-mission --mission <path>";
```

## Claude Code

### Chain
```
claude -p "/gurita:review-mission-requirements --mission <path>" --model "fable";
claude "/gurita:recommend-all-open-questions --mission <path>" --model "fable"; # interactive
```

### Loop
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
echo <mystery thing> <path>
```

## Antigravity

Prose between the host heading and its first block.

### Single task (Antigravity)

Prose between a heading and its fence.
```
agy -p "/gurita:complete-task --mission <path> <Task Title>" --model "claude-opus-5-5";
```

### Two fences
```
agy -p "/gurita:derive-tasks --mission <path>";
```
```
echo second fence
```

## Manual use

### Not shipped
```
/gurita:discuss-new-task --mission <path>
```
