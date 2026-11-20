"""The fixed-line verdict: a headless line's final message continues the chain only when its
first line is a success or no-op line of the bundled fixed-line file."""

import pytest


@pytest.mark.parametrize(
    "message",
    [
        "Task completed.\n",
        "No task completed — no file changed.\n",
        "\n\nTask completed.\n\nThe acceptance bar held.\n",
        "  Task completed.  \r\nmore\n",
    ],
)
def test_a_success_or_no_op_first_line_continues(runner, fixed_lines, message):
    goes_on, line = runner.verdict(message, fixed_lines)
    assert goes_on
    assert line in ("Task completed.", "No task completed — no file changed.")


@pytest.mark.parametrize(
    "message, expected",
    [
        ("No task matches the given name.\nFirst task\n", "No task matches the given name."),
        (
            "Scope gate closed — the scope is held or could not be checked.\n",
            "Scope gate closed — the scope is held or could not be checked.",
        ),
        (
            "Requirements converged — ready for task derivation.\n",
            "Requirements converged — ready for task derivation.",
        ),
        ("Error: something went wrong\nTask completed.\n", "Error: something went wrong"),
        ("Task completed\n", "Task completed"),
    ],
)
def test_a_stop_verdict_or_unlisted_first_line_stops(runner, fixed_lines, message, expected):
    assert runner.verdict(message, fixed_lines) == (False, expected)


@pytest.mark.parametrize("message", ["", "\n", "  \n\t\n"])
def test_an_empty_print_stops(runner, fixed_lines, message):
    assert runner.verdict(message, fixed_lines) == (False, None)


def test_the_fixed_line_file_is_read_by_a_plain_split(runner, tmp_path):
    path = tmp_path / "fixed_lines.tsv"
    path.write_text("success\tDone — with\ttab.\n\nno-op\tNothing.\n", encoding="utf-8")
    assert runner.read_fixed_lines(str(path)) == {"Done — with\ttab.": "success", "Nothing.": "no-op"}


def test_a_row_without_a_tab_is_refused(runner, tmp_path):
    path = tmp_path / "fixed_lines.tsv"
    path.write_text("success\tTask completed.\nbroken row\n", encoding="utf-8")
    with pytest.raises(runner.RunnerError, match="line 2"):
        runner.read_fixed_lines(str(path))


def test_a_missing_fixed_line_file_is_refused(runner, tmp_path):
    with pytest.raises(runner.RunnerError, match="cannot read the fixed-line file"):
        runner.read_fixed_lines(str(tmp_path / "absent.tsv"))


def run_check(runner, fixed_lines_file, tmp_path, message, number):
    output = tmp_path / f"out-{number}.txt"
    output.write_text(message, encoding="utf-8")
    verdicts = tmp_path / "verdicts.tsv"
    status = runner.main(
        [
            "check",
            "--fixed-lines",
            str(fixed_lines_file),
            "--output",
            str(output),
            "--verdicts",
            str(verdicts),
            "--line",
            str(number),
        ]
    )
    return status, verdicts.read_text(encoding="utf-8")


def test_the_check_step_exits_0_on_a_continuing_line_and_records_it(runner, fixed_lines_file, tmp_path):
    status, recorded = run_check(runner, fixed_lines_file, tmp_path, "Task completed.\n", 2)
    assert status == 0
    assert recorded == "2\tcontinue\tTask completed.\n"


def test_the_check_step_exits_1_on_a_stopping_line_and_records_it(runner, fixed_lines_file, tmp_path):
    run_check(runner, fixed_lines_file, tmp_path, "No task completed — no file changed.\n", 1)
    status, recorded = run_check(runner, fixed_lines_file, tmp_path, "No task matches the given name.\n", 3)
    assert status == 1
    assert recorded.splitlines() == [
        "1\tcontinue\tNo task completed — no file changed.",
        "3\tstop\tNo task matches the given name.",
    ]


def test_the_report_names_the_line_read_and_the_recipe_line_stopped_at(runner, tmp_path):
    lines = ["source env.sh", 'claude -p "/gurita:derive-tasks"', "echo never"]
    (tmp_path / runner.PROGRESS_FILE).write_text("2\n", encoding="utf-8")
    (tmp_path / runner.VERDICTS_FILE).write_text("2\tstop\tNo task matches the given name.\n", encoding="utf-8")
    printed, finished = runner.report(lines, str(tmp_path), 1)
    assert not finished
    assert printed == [
        'Chain stopped at recipe line 2 of 3: claude -p "/gurita:derive-tasks"',
        "Run ended on: No task matches the given name.",
    ]


def test_the_report_of_a_finished_chain_names_its_last_line(runner, tmp_path):
    lines = ["source env.sh", 'claude -p "/gurita:complete-task x"']
    (tmp_path / runner.PROGRESS_FILE).write_text(runner.END_MARK + "\n", encoding="utf-8")
    (tmp_path / runner.VERDICTS_FILE).write_text("2\tcontinue\tTask completed.\n", encoding="utf-8")
    printed, finished = runner.report(lines, str(tmp_path), 0)
    assert finished
    assert printed == [
        'Chain finished after recipe line 2 of 2: claude -p "/gurita:complete-task x"',
        "Run ended on: Task completed.",
    ]
