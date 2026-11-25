# Ways of using Gurita

How to chain Gurita's skills as headless command lines, one goal per section: each section says when to run its chain and what the chain leaves behind, then gives the chain as one fenced block whose every line is a complete invocation. Each line names its host binary and, on Claude Code, its model and effort, so one chain can mix hosts, models, and effort levels line by line. Every skill commits what it changes under its own subject (see [how skills commit](workflow.md#how-skills-commit)), so the git log records each run whichever host or model made it. The phases these chains walk are in [workflow.md](workflow.md), and what each skill does is in the [skill reference](skill-reference.md). Below, the *context file* is the project's `CLAUDE.md` on Claude Code and its `AGENTS.md` on Antigravity and Codex.

## Notation and flags

Every line is one headless run: `claude -p "/gurita:<skill>"` on Claude Code, `agy -p "/gurita:<skill>"` on Antigravity, or `codex exec '$gurita:<skill>'` on Codex, whose prompt is single-quoted so the shell passes the `$` through as written. The process exits when the skill finishes. Angle brackets mark the only text you substitute; every other token runs as written:

- `<goal>` is the mission's goal description, in plain prose with no double quote, since it sits inside the line's quoted prompt (and no single quote on a Codex line).
- `<scope>` is the directory holding the core of the mission's work, relative to the project root, `.` for the root; `discuss-mission-goal` proposes one.
- `<path>` is the mission's repo-relative path, trailing slash included, exactly as the definition line printed it: for example `mission_user-guide/` for a mission defined `--at .`, or `packages/api/mission_rate-limits/` for one defined `--at packages/api`.
- `<Short Title>` is an open question's Short Title, and `<Alternative Id>` the id of one of its embedded alternatives.
- `<answer text>` is your own answer to a question, in plain prose under the same quoting rule as `<goal>`.

Every line after a definition line names its mission with `--mission <path>`, before any text of the skill's own. No mission is current, so each chain below is written for one mission's path and runs the same whether that mission is the only live one or one of several. The definition line's commit subject, `Mission-definition: <path>`, records the path the later lines take (`git log -1 --format=%s` right after that line). A line whose `--mission` is missing or names no live mission stops with nothing changed and lists every live mission's path to retry with.

The headless flags:

- `--dangerously-skip-permissions` approves every tool-permission request, so a headless run never waits on a prompt. Claude Code and Antigravity both take it under this name; on Codex use `--dangerously-bypass-approvals-and-sandbox`, which also lifts Codex's sandbox.
- `--model` selects the model. Claude Code takes a family alias such as `sonnet`, `opus`, or `fable`, meaning the latest model of that family, so the chains go stale only when a family changes; Antigravity takes a model id from the `agy models` list, or that id's base name without its effort level, which `--effort` then chooses; Codex's counterpart is `-m`.
- `--effort` sets the reasoning effort, to one of the values the host's own `--help` lists (`claude --help`, `agy --help`). On Antigravity a model may offer only some of them, and a run naming one it lacks stops with the levels it has. Codex has no effort flag.
- `--add-dir` adds a directory to the run's workspace, on all three hosts. No line here needs it: every line runs from the project root, which each host takes as its workspace, and the plugin loads from its installed location, never from the working directory.

To move a line between Claude Code and Antigravity, change the binary (`claude` to `agy`, or back), give `--model` and `--effort` values that host accepts or leave both out to run at its defaults, as every `agy` line on this page does, and keep `--dangerously-skip-permissions`. To move a line to Codex, change the binary to `codex exec` and drop `-p`, drop `--model` and `--effort` to run at the account's defaults, replace `--dangerously-skip-permissions` with `--dangerously-bypass-approvals-and-sandbox`, and rewrite `"/gurita:<skill>"` as `'$gurita:<skill>'`.

## Setting up a project

Run this once per project. Two steps come before the chain: `git init` in the project root, since every line commits and the definition line stops outside a git work tree, and one `/init` run, which records the project's environment in the context file for the later skills to read. The bootstrap line then adds the mission workflow guidance to the context file and commits it, together with whatever `/init` left uncommitted there, under `Workflow-bootstrap: missions`, and the definition line creates the first mission at `<scope>/mission_<slug>/` and commits it under `Mission-definition: <path>`. Run [Starting a mission](#starting-a-mission) next, on that `<path>`.

```sh
claude -p "/gurita:init-mission-base-workflow" --dangerously-skip-permissions --model "sonnet" --effort medium;
claude -p "/gurita:define-mission-goal --at <scope> <goal>" --dangerously-skip-permissions --model "sonnet" --effort medium;
```

## Starting a mission

Run this once a mission is defined, on the `<path>` its definition line recorded. It writes the mission's starting state, surfaces the first review pass's open questions, embeds a set of alternatives on each, and picks a recommendation from every set. Nothing else readies the mission, and no other mission has to be finished first. The alternatives line dispatches one subagent per question; the recommend line is one inline pass over the whole set.

```sh
claude -p "/gurita:specify-mission-starting-state --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/gurita:review-mission-requirements --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/gurita:provide-alternatives-to-all-open-questions --mission <path>" --dangerously-skip-permissions --model "opus" --effort high;
claude -p "/gurita:recommend-all-open-questions --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
```

## Answering the questions that matter to you

Run this once [Starting a mission](#starting-a-mission) has put a recommendation on every question and you have read the annotated set. The first two lines refresh the starting state and run one review pass, as every chain that derives and completes tasks opens (see [Preparing another mission while one runs](#preparing-another-mission-while-one-runs)). Then write one answer line per question you decide yourself: the first form records an alternative you name by its id, the recommended one or another, and the second records an answer in your own words where no alternative fits; each answer clears the picks on other questions it undermines. The alternatives line then embeds a set on every question still lacking one, those the review added; the recommend line picks for every question left without a pick, those the answers or the refresh cleared and those the review added; the sweep line records every remaining recommendation; and the last two lines derive the task list and complete it, as in [Executing tasks](#executing-tasks). The mission needs you at the keyboard once, between the two chains, and ends with its task list completed.

```sh
claude -p "/gurita:specify-mission-starting-state --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/gurita:review-mission-requirements --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/gurita:answer-open-question-with-alternative --mission <path> <Short Title>. <Alternative Id>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/gurita:answer-open-question --mission <path> <Short Title>. <answer text>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/gurita:provide-alternatives-to-all-open-questions --mission <path>" --dangerously-skip-permissions --model "opus" --effort high;
claude -p "/gurita:recommend-all-open-questions --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/gurita:answer-all-open-questions-with-recommendation --mission <path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/gurita:derive-tasks --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "opus" --effort high;
```

## Running a mixed-agent requirements review

Repeat this pass until `review-mission-requirements` reports convergence. Each pass reconciles the open questions against the recorded decisions and surfaces new gaps, embeds alternatives on every question that lacks them and a recommendation on every question that lacks one, and records each recommendation as a decision. The host changes between the review line and the alternatives line, so one agent surfaces the questions and another annotates them; moving every line to one host by the rules under [Notation and flags](#notation-and-flags) gives the single-host form of the same pass.

```sh
agy -p "/gurita:review-mission-requirements --mission <path>" --dangerously-skip-permissions;
claude -p "/gurita:provide-alternatives-to-all-open-questions --mission <path>" --dangerously-skip-permissions --model "opus" --effort high;
claude -p "/gurita:recommend-all-open-questions --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/gurita:answer-all-open-questions-with-recommendation --mission <path>" --dangerously-skip-permissions --model "fable" --effort high;
```

## Putting more intelligence into a stuck mission

Run this when the review loop has not converged after passes at the settings above. It refreshes the starting state, runs one more review pass on `opus` at `--effort max`, annotates the questions and records the recommendations as the review chain does, the answer line recording the recommendations already embedded together with the new ones, then derives the task list and completes it in the same chain, with no stop between.

```sh
claude -p "/gurita:specify-mission-starting-state --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/gurita:review-mission-requirements --mission <path>" --dangerously-skip-permissions --model "opus" --effort max;
claude -p "/gurita:provide-alternatives-to-all-open-questions --mission <path>" --dangerously-skip-permissions --model "opus" --effort high;
claude -p "/gurita:recommend-all-open-questions --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/gurita:answer-all-open-questions-with-recommendation --mission <path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/gurita:derive-tasks --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "opus" --effort high;
```

## Executing tasks

Run this once a review pass has left every open question carrying a recommendation. The first two lines refresh the starting state and run one more review pass, as every chain that derives and completes tasks opens; the alternatives line embeds a set on every question the review added, and the recommend line picks for every question left without a pick, those the refresh cleared included; the sweep line records every recommendation as a decision; `derive-tasks` writes the task list, and `complete-all-tasks` works through it, one commit per task. `complete-all-tasks` is the heaviest run and can stop at your account's usage limit, which each comment line waits out: every task commits on its own and a failed task's partial work is continued rather than redone, so running the line again continues from the remaining tasks.

```sh
# wait until your account's usage window has reset
claude -p "/gurita:specify-mission-starting-state --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/gurita:review-mission-requirements --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/gurita:provide-alternatives-to-all-open-questions --mission <path>" --dangerously-skip-permissions --model "opus" --effort high;
claude -p "/gurita:recommend-all-open-questions --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/gurita:answer-all-open-questions-with-recommendation --mission <path>" --dangerously-skip-permissions --model "fable" --effort high;
claude -p "/gurita:derive-tasks --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "opus" --effort high;
# wait until your account's usage window has reset
claude -p "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "opus" --effort high;
```

## Preparing another mission while one runs

Run this when you want a second mission's questions ready while another mission is still executing. It defines the second mission at its own `<scope>` and runs [Starting a mission](#starting-a-mission)'s lines on its `<path>`, the one its own definition line recorded, while the other mission's chains run unchanged on theirs. It is no special case of either chain: no mission is current, so two chains in one project differ only in the path every line carries.

The chain can run while the other mission's `complete-all-tasks` is still working in the same tree. The tree is dirty while both run, and each commit still carries only its own paths, so the other mission's task work never rides into this mission's commits, nor into the answer sweep's when you go on to record this mission's recommendations with `answer-all-open-questions-with-recommendation --mission <path>`.

The second mission's tasks wait at the scope gate: while the mission still executing is started and its scope is the second's, encloses it, or lies beneath it, `derive-tasks --mission <path>` stops with the holder's path listed until that mission is finished. Two missions in disjoint scopes derive and complete their tasks at the same time.

The starting state describes the project as it stood when its line ran, and the mission still executing may land work in this one's scope meanwhile. That is why every chain that derives and completes tasks ([Answering the questions that matter to you](#answering-the-questions-that-matter-to-you), [Putting more intelligence into a stuck mission](#putting-more-intelligence-into-a-stuck-mission), [Executing tasks](#executing-tasks)) opens with the starting-state line and one review pass: where the ground moved, the line commits the refreshed section under `Starting-state: <path>` and the review weighs the recorded decisions against it; where it did not, the line ends on its no-op line and the review finds nothing new. `derive-tasks` and `submit-task` also refresh a stale starting state themselves, as a `Starting-state: <path>` commit of their own before they write, so a hand-built chain that leaves the line out, or work that lands after the line ran, still meets a current starting state at task entry.

```sh
claude -p "/gurita:define-mission-goal --at <scope> <goal>" --dangerously-skip-permissions --model "sonnet" --effort medium;
claude -p "/gurita:specify-mission-starting-state --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/gurita:review-mission-requirements --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
claude -p "/gurita:provide-alternatives-to-all-open-questions --mission <path>" --dangerously-skip-permissions --model "opus" --effort high;
claude -p "/gurita:recommend-all-open-questions --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;
```

## Finishing a mission

Run this when the mission's `TASKS_TODO.md` is empty and no open question stands; otherwise the line stops with nothing changed. It removes the mission's directory in one `Mission-finish: <path>` commit whose body is the mission's summary, its title line, a blank line, and its accomplishment bullets, and updates the context file in the same commit for lasting changes. That commit is the mission's record: its files stand at the commit's parent, and reverting the commit makes the mission live again.

```sh
claude -p "/gurita:finish-mission --mission <path>" --dangerously-skip-permissions --model "sonnet" --effort medium;
```
