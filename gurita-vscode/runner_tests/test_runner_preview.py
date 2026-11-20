"""The preview print: one `state<TAB>name<TAB>title` line per remaining task of the mission's
`TASKS_TODO.md`, `resolved` only when the rules give the task a line among the `--line` names,
a missing or refused rule file reported on stderr with every task then unresolved."""

TASKS = """# TASKS TODO

## Add the Parser

Write the question document parser in `parser.ts`.

---

## Write the README

Document the build.

A body line reading
---
is body text, not a separator.

---

## Rework the Runner

Change `runner.py`.

---
"""

LINES = [
    "--line",
    "Single task with Opus xHigh (Claude Code)",
    'claude -p "/gurita:complete-task --mission <path> <Task Title>" --model "opus" --effort xhigh',
    "--line",
    "Single task with Opus High (Claude Code)",
    'claude -p "/gurita:complete-task --mission <path> <Task Title>" --model "opus" --effort high',
]

RULES = """# Critical work goes to the stronger line.
parser -> Single task with Opus xHigh (Claude Code)
runner -> Single task with Fable (Claude Code)
* -> Single task with Opus High (Claude Code)
"""


def make_mission(tmp_path, tasks=TASKS):
    mission = tmp_path / "mission_sample"
    mission.mkdir()
    (mission / "TASKS_TODO.md").write_text(tasks, encoding="utf-8")
    return mission


def run_preview(runner, capsys, mission, rules, lines=LINES):
    status = runner.main(["preview", "--mission", f"{mission}/", "--rules", str(rules)] + lines)
    captured = capsys.readouterr()
    return status, captured.out, captured.err


def test_each_task_is_printed_with_its_state_line_name_and_title(runner, tmp_path, capsys):
    mission = make_mission(tmp_path)
    rules = tmp_path / "task_line_rules.txt"
    rules.write_text(RULES, encoding="utf-8")
    status, out, err = run_preview(runner, capsys, mission, rules)
    assert status == 0
    assert err == ""
    assert out == (
        "resolved\tSingle task with Opus xHigh (Claude Code)\tAdd the Parser\n"
        "resolved\tSingle task with Opus High (Claude Code)\tWrite the README\n"
        "missing\tSingle task with Fable (Claude Code)\tRework the Runner\n"
    )


def test_a_task_the_rules_give_no_line_is_missing_with_an_empty_name(runner, tmp_path, capsys):
    mission = make_mission(tmp_path)
    rules = tmp_path / "task_line_rules.txt"
    rules.write_text("parser -> Single task with Opus xHigh (Claude Code)\n", encoding="utf-8")
    status, out, err = run_preview(runner, capsys, mission, rules)
    assert status == 0
    assert err == ""
    assert out.splitlines() == [
        "resolved\tSingle task with Opus xHigh (Claude Code)\tAdd the Parser",
        "missing\t\tWrite the README",
        "missing\t\tRework the Runner",
    ]


def test_the_brief_is_matched_beside_the_title(runner, tmp_path, capsys):
    mission = make_mission(tmp_path)
    rules = tmp_path / "task_line_rules.txt"
    rules.write_text(
        "separator -> Single task with Opus xHigh (Claude Code)\n* -> Single task with Opus High (Claude Code)\n",
        encoding="utf-8",
    )
    _, out, _ = run_preview(runner, capsys, mission, rules)
    assert [line.split("\t")[1] for line in out.splitlines()] == [
        "Single task with Opus High (Claude Code)",
        "Single task with Opus xHigh (Claude Code)",
        "Single task with Opus High (Claude Code)",
    ]


def test_a_missing_rule_file_leaves_every_task_unresolved_and_names_the_path(runner, tmp_path, capsys):
    mission = make_mission(tmp_path)
    rules = tmp_path / "task_line_rules.txt"
    status, out, err = run_preview(runner, capsys, mission, rules)
    assert status == 0
    assert err == f"No rule file stands at {rules}; no task is assigned a line.\n"
    assert out == "missing\t\tAdd the Parser\nmissing\t\tWrite the README\nmissing\t\tRework the Runner\n"


def test_a_refused_rule_file_reports_each_line_and_leaves_every_task_unresolved(runner, tmp_path, capsys):
    mission = make_mission(tmp_path)
    rules = tmp_path / "task_line_rules.txt"
    rules.write_text(
        "parser -> Single task with Opus xHigh (Claude Code)\n"
        "* -> Single task with Opus High (Claude Code)\n"
        "no arrow\n"
        "* -> Single task with Opus xHigh (Claude Code)\n",
        encoding="utf-8",
    )
    status, out, err = run_preview(runner, capsys, mission, rules)
    assert status == 0
    assert err.splitlines() == [
        f"Rule file refused: {rules}",
        "line 3: no ' -> ' between a pattern and a line name",
        "line 4: a second default line; the first is line 2",
    ]
    assert out == "missing\t\tAdd the Parser\nmissing\t\tWrite the README\nmissing\t\tRework the Runner\n"


def test_an_empty_task_list_prints_nothing(runner, tmp_path, capsys):
    mission = make_mission(tmp_path, "# TASKS TODO\n\n")
    rules = tmp_path / "task_line_rules.txt"
    rules.write_text(RULES, encoding="utf-8")
    assert run_preview(runner, capsys, mission, rules) == (0, "", "")


def test_a_missing_task_list_is_refused_with_one_error_line(runner, tmp_path, capsys):
    rules = tmp_path / "task_line_rules.txt"
    rules.write_text(RULES, encoding="utf-8")
    status, out, err = run_preview(runner, capsys, tmp_path / "mission_absent", rules)
    assert status == 1
    assert out == ""
    assert err.startswith("Error: cannot read the task list ")
    assert len(err.splitlines()) == 1


def test_task_sections_are_read_as_the_task_list_tool_reads_them(runner):
    assert runner.parse_tasks(TASKS) == [
        ("Add the Parser", "Write the question document parser in `parser.ts`."),
        ("Write the README", "Document the build.\n\nA body line reading\n---\nis body text, not a separator."),
        ("Rework the Runner", "Change `runner.py`."),
    ]
    assert runner.parse_tasks("# TASKS TODO\n\n## Unterminated\r\n\r\nBrief.\r\n## Next\n") == [
        ("Unterminated", "Brief."),
        ("Next", ""),
    ]


def test_the_preview_runs_no_line(runner, tmp_path, capsys, monkeypatch):
    def refuse(*args, **kwargs):
        raise AssertionError("the preview started a process")

    monkeypatch.setattr(runner.subprocess, "Popen", refuse)
    mission = make_mission(tmp_path)
    rules = tmp_path / "task_line_rules.txt"
    rules.write_text(RULES, encoding="utf-8")
    lines = ["--line", "Single task with Opus High (Claude Code)", "touch should-not-exist"]
    status, _, _ = run_preview(runner, capsys, mission, rules, lines)
    assert status == 0
    assert not (tmp_path / "should-not-exist").exists()
