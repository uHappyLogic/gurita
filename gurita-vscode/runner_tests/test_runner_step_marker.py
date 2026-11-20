"""The step marker: before every line of a chain, and of each task's session in a looped run,
the composed script prints `Line N of TOTAL: ` and the line's text, quoted so nothing in it is
expanded, and outside a headless line's `{ ... } | tee` group, so it never reaches the file the
check step reads.

No test starts a shell session: the scripts are read as text, and the looped run's session is
composed through `run_task_session` with `subprocess.Popen` replaced by a recorder."""

import shlex

import pytest

SHELL_STEP = "source env.sh"
HEADLESS = 'claude -p "/gurita:derive-tasks --mission "$GURITA_PATH""'
INTERACTIVE = 'claude "/gurita:complete-all-tasks --mission "$GURITA_PATH""; # interactive'
CODEX = "codex exec '$gurita:submit-task --mission '\"$GURITA_PATH\"' `whoami`'"

LINES = [SHELL_STEP, HEADLESS, INTERACTIVE, CODEX]


def marker_rows(script):
    """Each marker the script prints, as (row index, the printed text), read by the shell's
    own quoting rules."""
    rows = []
    for index, row in enumerate(script.splitlines()):
        if not row.startswith("printf '%s\\n' 'Line "):
            continue
        words = shlex.split(row)
        assert words[:2] == ["printf", "%s\\n"] and len(words) == 3
        rows.append((index, words[2]))
    return rows


def test_the_marker_names_the_number_the_total_and_the_text(runner):
    assert runner.step_marker(3, 4, "claude -p ...") == "Line 3 of 4: claude -p ..."


def test_every_line_of_every_kind_gets_its_marker_in_order(runner, tmp_path):
    script = runner.compose_script(LINES, str(tmp_path), "fixed_lines.tsv")
    printed = [text for _, text in marker_rows(script)]
    assert printed == [f"Line {number} of 4: {line}" for number, line in enumerate(LINES, start=1)]


def test_each_marker_stands_directly_before_its_line(runner, tmp_path):
    script = runner.compose_script(LINES, str(tmp_path), "fixed_lines.tsv")
    rows = script.splitlines()
    for index, text in marker_rows(script):
        number = int(text.split()[1])
        line = LINES[number - 1]
        following = rows[index + 1]
        if runner.line_kind(line) == runner.HEADLESS:
            assert following == "{"
            assert rows[index + 2] == line
        else:
            assert following == line


def test_the_headless_marker_is_outside_the_tee_group(runner, tmp_path):
    script = runner.compose_script([HEADLESS], str(tmp_path), "fixed_lines.tsv")
    rows = script.splitlines()
    opening = rows.index("{")
    closing = next(index for index, row in enumerate(rows) if row.startswith("} | command tee "))
    (marker_index, text), = marker_rows(script)
    assert text == f"Line 1 of 1: {HEADLESS}"
    assert marker_index < opening < closing
    assert all("Line 1 of 1" not in row for row in rows[opening : closing + 1])


@pytest.mark.parametrize("line", [HEADLESS, CODEX, "echo $(rm -rf /) `id` \"$HOME\" 'it''s'"])
def test_the_marker_text_is_quoted_so_nothing_in_it_is_expanded(runner, tmp_path, line):
    script = runner.compose_script([line], str(tmp_path), "fixed_lines.tsv")
    (index, text), = marker_rows(script)
    assert text == f"Line 1 of 1: {line}"
    assert script.splitlines()[index] == "printf '%s\\n' " + shlex.quote(text)


def test_the_marker_is_printed_after_the_progress_record(runner, tmp_path):
    script = runner.compose_script(["echo one", "echo two"], str(tmp_path), "fixed_lines.tsv")
    rows = script.splitlines()
    for index, text in marker_rows(script):
        number = text.split()[1]
        assert rows[index - 1].startswith(f"printf '%s\\n' {number} >| ")


def test_each_task_session_of_a_looped_run_prints_a_marker_before_each_line(runner, monkeypatch):
    recipe = ["echo head", 'echo "<Task Title>" >> run.log', "<single-task line>"]
    task_line = 'claude -p "/gurita:complete-task --mission <path> <Task Title>" --model "opus"'
    lines = runner.session_lines(recipe, runner.slot_number(recipe), task_line)
    scripts = []

    class Recorder:
        def __init__(self, argv, env=None):
            scripts.append(argv[-1])

        def wait(self):
            return 0

    monkeypatch.setattr(runner.subprocess, "Popen", Recorder)
    runner.run_task_session(lines, 3, {"GURITA_PATH": "m/", "GURITA_TASK_TITLE": "T"})
    (script,) = scripts
    printed = [text for _, text in marker_rows(script)]
    assert printed == [f"Line {number} of 3: {line}" for number, line in enumerate(lines, start=1)]
    assert printed[2] == (
        'Line 3 of 3: claude -p "/gurita:complete-task --mission ${GURITA_PATH} ${GURITA_TASK_TITLE}"'
        ' --model "opus"'
    )
