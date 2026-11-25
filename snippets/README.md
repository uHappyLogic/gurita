## Purpose

This node is for maintainers of `snippets/`. The folder holds one document, `GURITA_USAGE.md`, the hand-use document of headless chains: command lines a maintainer copies into a terminal to run the plugin's skills one invocation after another under Claude Code or Antigravity. Its `###` recipe blocks stand under `## Recipes`, each with a `Stage:` line naming the workflow step its chain runs and one `####` sub-heading per variant, and the rest (slash commands for interactive use, the Antigravity install, the model listing, a one-line listing of every mission, the live ones first and the finished ones newest first) stands under `## Manual use`. No tool reads the file: the VS Code extension ships its own recipe file, `gurita-vscode/shipped_recipes.md`, in which each chain is shipped once rather than once per harness.

## Rules

- **Nothing checks this file, so a change to a skill's invocation is carried into it by hand.** When a skill's Usage fence changes, its flag, its positional text, or its separator, the lines here that invoke it are updated in the same change, beside the user page of chains, the extension's usage reference, and its shipped recipes, which carry the same lines. Reason: no tool or test reads the file, so a stale line fails only when a maintainer runs it. Retired forms: none recorded.
- **Every line follows the Usage fence of the skill it invokes.** Every per-mission line carries the leading `--mission <path>`, `<path>` the mission's path exactly as `define-mission-goal` printed it, trailing slash included, and every line taking a Short Title followed by text writes `<Short Title>. <…>`, the first `.` followed by whitespace being the separator; a discuss line's optional `<note>` is left out together with the `. ` before it. Reason: these are the forms the skills parse, and the separator was chosen so that these lines, and the extension's, stayed byte-identical when the skills' split changed. Retired forms: a bare mission number or directory name in place of `<path>`.
- → `core/shared/README.md#rules` — The mission resolution rule: one required leading `--mission <path>`, used verbatim. Read it before changing how a line names its mission.
- → `core/skills/README.md#rules` — The hand-answer and discuss split on the first `.` followed by whitespace. Read it before changing a line that passes a Short Title and text.

## Pointers

- → `snippets/GURITA_USAGE.md#recipes` — The recipe blocks and the Antigravity flag and model mapping. Read it before adding or changing a chain.
- → `gurita-vscode/shipped_recipes.md` — The recipe file the extension ships and reads, each chain once. Change it together with this file when a chain both carry changes.
- → `docs/ways-of-using.md` — The user page of headless chains and their per-host flags. Keep its lines in step with the ones here.
- → `core/skills/` — Each skill's `SKILL.md` holds its Usage fence, the form every line here follows.
