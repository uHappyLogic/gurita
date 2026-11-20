"""The fixed-line verdict: a headless line's print continues the chain only when the last whole
line of it that is a success, no-op, or stop line of the bundled fixed-line file is a success or
no-op line, verdict-kind lines never counting and a print holding no such line stopping it."""

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
def test_a_success_or_no_op_line_continues(runner, fixed_lines, message):
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
        ("Task completed\n", "Task completed"),
        ("Error: something went wrong\n", "Error: something went wrong"),
    ],
)
def test_a_stop_verdict_or_unlisted_line_stops(runner, fixed_lines, message, expected):
    assert runner.verdict(message, fixed_lines) == (False, expected)


# A print of several messages: a host prints one message per turn when a skill's background
# agents wake its session, so the line read is the print's last success, no-op, or stop line.

INTERIM = (
    "I've started 15 background agents, one per open question; I'll embed their returns as they land.\n"
    "\n"
    "Three agents have returned; waiting on the rest.\n"
    "\n"
)


def test_interim_text_above_a_success_line_continues(runner, fixed_lines):
    message = INTERIM + "Task completed.\n"
    assert runner.verdict(message, fixed_lines) == (True, "Task completed.")


def test_interim_text_above_a_stop_line_stops(runner, fixed_lines):
    message = INTERIM + "Scope gate closed — the scope is held or could not be checked.\nmission_a/\n"
    assert runner.verdict(message, fixed_lines) == (
        False,
        "Scope gate closed — the scope is held or could not be checked.",
    )


def test_a_success_line_followed_by_a_still_open_list_and_the_verdict_line_continues(runner, fixed_lines):
    message = (
        "Checking the requirements against the recorded decisions.\n"
        "\n"
        "Requirements reviewed.\n"
        "\n"
        "Still open:\n"
        "- Rule File Location\n"
        "\n"
        "Requirements converged — ready for task derivation.\n"
    )
    assert runner.verdict(message, fixed_lines) == (True, "Requirements reviewed.")


def test_the_last_fixed_line_wins_over_an_earlier_one(runner, fixed_lines):
    assert runner.verdict("Task completed.\nNo task matches the given name.\n", fixed_lines) == (
        False,
        "No task matches the given name.",
    )
    assert runner.verdict("Error: something went wrong\nTask completed.\n", fixed_lines) == (
        True,
        "Task completed.",
    )


def test_a_fixed_line_counts_only_as_a_whole_line(runner, fixed_lines):
    message = "The skill printed Task completed. at last.\nDone for now.\n"
    assert runner.verdict(message, fixed_lines) == (False, "Done for now.")


def test_a_print_of_several_messages_with_no_fixed_line_stops(runner, fixed_lines):
    message = INTERIM + "All agents have returned.\nRequirements converged — ready for task derivation.\n"
    assert runner.verdict(message, fixed_lines) == (
        False,
        "Requirements converged — ready for task derivation.",
    )


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


def test_the_check_step_reads_the_last_fixed_line_of_a_print_of_several_messages(
    runner, fixed_lines_file, tmp_path
):
    status, recorded = run_check(runner, fixed_lines_file, tmp_path, INTERIM + "Task completed.\n", 2)
    assert status == 0
    assert recorded == "2\tcontinue\tTask completed.\n"


def test_the_check_step_stops_on_a_print_with_no_fixed_line(runner, fixed_lines_file, tmp_path):
    status, recorded = run_check(runner, fixed_lines_file, tmp_path, INTERIM, 4)
    assert status == 1
    assert recorded == "4\tstop\tThree agents have returned; waiting on the rest.\n"


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
