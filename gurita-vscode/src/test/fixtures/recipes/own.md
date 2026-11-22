Text above the first recipe is not read.

## A group heading is not read either

### Chain
```
claude-wait;
claude -p "/gurita:review-mission-requirements --mission <path>" --model "opus";
```

### My first own recipe
Stage: execute tasks
```
echo "$GURITA_TASK_TITLE" >> run.log
$gurita:complete-task --mission <path> <Task Title>
```

### Single task (Antigravity)
```
codex exec '$gurita:complete-task --mission <path> <Task Title>';
```

### My second own recipe
Stage: deploy
```
echo <unknown one> <unknown one> <scope>
```

### Chain
```
echo a repeated name is not read
```

### Variants
Stage: finish
#### On Claude Code
```
claude -p "/gurita:complete-all-tasks --mission <path>" --model "fable" --effort xhigh;
```
#### Own variant
```
codex exec '$gurita:complete-all-tasks --mission <path>';
```

### My variant recipe
Stage: finish
#### First
```
echo first <path>
```
#### Second
```
echo second <Task Title>
```
