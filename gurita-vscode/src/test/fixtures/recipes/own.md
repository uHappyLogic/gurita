Text above the first recipe is not read.

## A group heading is not read either

### Chain
```
claude-wait;
claude -p "/gurita:review-mission-requirements --mission <path>" --model "opus";
```

### My first own recipe
```
echo "$GURITA_TASK_TITLE" >> run.log
$gurita:complete-task --mission <path> <Task Title>
```

### Single task (Antigravity)
```
codex exec '$gurita:complete-task --mission <path> <Task Title>';
```

### My second own recipe
```
echo <unknown one> <unknown one> <scope>
```

### Chain
```
echo a repeated name is not read
```
