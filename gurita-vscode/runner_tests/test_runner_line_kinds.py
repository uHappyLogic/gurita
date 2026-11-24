"""Line-kind inference: interactive by a trailing `# interactive`, headless by a `gurita:`
invocation, a shell step otherwise."""

from pathlib import Path

import pytest


@pytest.mark.parametrize(
    "line",
    [
        'claude "/gurita:recommend-all-open-questions --mission "$GURITA_PATH"" --model "fable"; # interactive',
        'agy -i "/gurita:complete-all-tasks --mission "$GURITA_PATH"" # interactive',
        'claude "/gurita:discuss-mission-goal "$GURITA_GOAL"" #interactive',
        "claude-wait # interactive   ",
        "# interactive",
    ],
)
def test_a_trailing_interactive_mark_makes_the_line_interactive(runner, line):
    assert runner.line_kind(line) == runner.INTERACTIVE


@pytest.mark.parametrize(
    "line",
    [
        'claude -p "/gurita:derive-tasks --mission "$GURITA_PATH"" --model "fable" --effort xhigh;',
        "codex exec '$gurita:answer-all-open-questions-with-recommendation --mission '\"$GURITA_PATH\"''",
        'agy -p "/gurita:finish-mission --mission "$GURITA_PATH""',
        'claude -p "/gurita:complete-task --mission "$GURITA_PATH" "$GURITA_TASK_TITLE"" # interactive run? no',
    ],
)
def test_an_unmarked_gurita_invocation_makes_the_line_headless(runner, line):
    assert runner.line_kind(line) == runner.HEADLESS


@pytest.mark.parametrize(
    "line",
    [
        "source ~/.gurita/env.sh",
        "claude-wait",
        'echo "gurita: plain text, no invocation"',
        "echo done # not the mark",
        "echo x#interactive",
        "",
    ],
)
def test_every_other_line_is_a_shell_step(runner, line):
    assert runner.line_kind(line) == runner.SHELL_STEP


def test_the_mark_wins_over_an_invocation_on_the_same_line(runner):
    line = 'claude "/gurita:complete-all-tasks --mission "$GURITA_PATH""; # interactive'
    assert runner.line_kind(line) == runner.INTERACTIVE


def test_a_mark_not_at_the_end_does_not_count(runner):
    line = 'claude -p "/gurita:derive-tasks # interactive --mission x"'
    assert runner.line_kind(line) == runner.HEADLESS


def test_only_headless_lines_get_a_tee_and_a_check_step(runner, tmp_path):
    lines = [
        "source env.sh",
        'claude -p "/gurita:derive-tasks --mission "$GURITA_PATH""',
        'claude "/gurita:complete-all-tasks --mission "$GURITA_PATH""; # interactive',
    ]
    script = runner.compose_script(lines, str(tmp_path), "fixed_lines.tsv")
    assert script.count("command tee") == 1
    assert script.count(" check ") == 1
    assert "--line 2 || exit 1" in script
    for line in lines:
        assert line in script.splitlines()


SHIPPED_RECIPES = Path(__file__).resolve().parent.parent / "shipped_recipes.md"
CODEX_SINGLE_TASK = "### Single task with GPT-6-Luna High (Codex)"


def test_the_shipped_codex_single_task_line_is_read_as_headless(runner, tmp_path):
    text = SHIPPED_RECIPES.read_text(encoding="utf-8").splitlines()
    start = text.index(CODEX_SINGLE_TASK)
    fence = text.index("```", start)
    line = text[fence + 1]
    assert text[fence + 2] == "```", "the recipe is one line"
    assert line.startswith("codex exec '$gurita:complete-task --mission <path> <Task Title>' ")
    assert runner.line_kind(line) == runner.HEADLESS
    filled = runner.fill_placeholders(line)
    assert filled.startswith("codex exec '$gurita:complete-task --mission '\"${GURITA_PATH}\"' '\"${GURITA_TASK_TITLE}\"'' ")
    assert runner.line_kind(filled) == runner.HEADLESS
    script = runner.compose_script([filled], str(tmp_path), "fixed_lines.tsv")
    assert script.count("command tee") == 1
    assert script.count(" check ") == 1
    assert filled in script.splitlines()
