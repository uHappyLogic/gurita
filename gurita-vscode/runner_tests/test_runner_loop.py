"""The looped task run: before each task the top remaining heading is re-read and its line
chosen, an override first, the rules' result otherwise, unresolved when the name chosen is not
among the `--line` names; the run goes on only on `Task completed.`, stops before running an
unresolved task, and ends when no heading remains.

No test starts a shell session: the driver is run through `runner.main` with the one function
that would start a session, `run_task_session`, replaced by a stub, and `subprocess.Popen`
refused outright."""

import pytest

XHIGH = "Single task with Opus xHigh (Claude Code)"
HIGH = "Single task with Opus High (Claude Code)"
FABLE = "Single task with Fable (Claude Code)"
XHIGH_LINE = 'claude -p "/gurita:complete-task --mission <path> <Task Title>" --model "opus" --effort xhigh'
HIGH_LINE = 'claude -p "/gurita:complete-task --mission <path> <Task Title>" --model "opus" --effort high'

LINES = ["--line", XHIGH, XHIGH_LINE, "--line", HIGH, HIGH_LINE]

RULES = f"""# Critical work goes to the stronger line.
parser -> {XHIGH}
runner -> {FABLE}
* -> {HIGH}
"""

FILLED_XHIGH = (
    'claude -p "/gurita:complete-task --mission ${GURITA_PATH} ${GURITA_TASK_TITLE}"'
    ' --model "opus" --effort xhigh'
)
FILLED_HIGH = FILLED_XHIGH.replace("xhigh", "high")


def task_list(*titles):
    sections = "".join(f"## {title}\n\nWork on {title.lower()}.\n\n---\n\n" for title in titles)
    return "# TASKS TODO\n\n" + sections


@pytest.fixture
def rules_file(tmp_path):
    path = tmp_path / "task_line_rules.txt"
    path.write_text(RULES, encoding="utf-8")
    return path


@pytest.fixture
def mission(tmp_path):
    path = tmp_path / "mission_sample"
    path.mkdir()
    return path


@pytest.fixture(autouse=True)
def no_shell(runner, monkeypatch, fixed_lines_file):
    """Refuse every process start and point the runner at the fixture's fixed-line file."""

    def refuse(*args, **kwargs):
        raise AssertionError("a test started a process")

    monkeypatch.setattr(runner.subprocess, "Popen", refuse)
    monkeypatch.setattr(runner, "FIXED_LINES_FILE", str(fixed_lines_file))


class Sessions:
    """A stand-in for `run_task_session`: records each session and, while its scripted results
    last, completes the task by taking its section out of the list when told it completed."""

    def __init__(self, mission, results, add_after=None):
        self.mission = mission
        self.results = list(results)
        self.add_after = add_after or {}
        self.calls = []

    def __call__(self, lines, slot, values):
        self.calls.append((lines, slot, values))
        completed = self.results.pop(0)
        if completed:
            path = self.mission / "TASKS_TODO.md"
            text = path.read_text(encoding="utf-8")
            title = values["GURITA_TASK_TITLE"]
            section = f"## {title}\n\nWork on {title.lower()}.\n\n---\n\n"
            assert section in text
            text = text.replace(section, "", 1)
            text += "".join(
                f"## {added}\n\nWork on {added.lower()}.\n\n---\n\n" for added in self.add_after.get(title, ())
            )
            path.write_text(text, encoding="utf-8")
        return ["Chain finished after recipe line 2 of 2: ...", "Run ended on: ..."], completed


def run_loop(runner, capsys, mission, rules, extra=(), recipe=("echo head", "<single-task line>")):
    argv = ["loop", "--mission", f"{mission}/", "--rules", str(rules)] + LINES + list(extra)
    status = runner.main(argv + ["--"] + list(recipe))
    captured = capsys.readouterr()
    return status, captured.out, captured.err


# The per-task choice.


def test_an_override_wins_over_the_rules(runner, rules_file):
    rule_file = runner.read_rules(str(rules_file))
    choice = runner.choose_line(rule_file, [XHIGH, HIGH], {"Add the Parser": HIGH}, "Add the Parser", "")
    assert choice == runner.Choice("resolved", HIGH, "override")


def test_without_an_override_the_rules_choose(runner, rules_file):
    rule_file = runner.read_rules(str(rules_file))
    overrides = {"Something Else": HIGH}
    assert runner.choose_line(rule_file, [XHIGH, HIGH], overrides, "Add the Parser", "") == runner.Choice(
        "resolved", XHIGH, "rules"
    )
    assert runner.choose_line(rule_file, [XHIGH, HIGH], overrides, "Write the README", "") == runner.Choice(
        "resolved", HIGH, "rules"
    )


def test_a_rule_naming_a_line_not_given_leaves_the_task_unresolved(runner, rules_file):
    rule_file = runner.read_rules(str(rules_file))
    choice = runner.choose_line(rule_file, [XHIGH, HIGH], {}, "Rework the Runner", "")
    assert choice == runner.Choice("missing", FABLE, "rules")
    assert runner.describe_choice(choice) == (
        f'Line: unresolved — the rules name "{FABLE}", which no single-task line given carries'
    )


def test_an_override_naming_a_line_not_given_leaves_the_task_unresolved(runner, rules_file):
    rule_file = runner.read_rules(str(rules_file))
    choice = runner.choose_line(rule_file, [XHIGH, HIGH], {"Add the Parser": FABLE}, "Add the Parser", "")
    assert choice == runner.Choice("missing", FABLE, "override")


@pytest.mark.parametrize("content", [None, "no arrow\n"])
def test_a_missing_or_refused_rule_file_leaves_tasks_without_an_override_unresolved(runner, tmp_path, content):
    path = tmp_path / "task_line_rules.txt"
    if content is not None:
        path.write_text(content, encoding="utf-8")
    rule_file = runner.read_rules(str(path))
    overrides = {"Add the Parser": HIGH}
    assert runner.choose_line(rule_file, [XHIGH, HIGH], overrides, "Add the Parser", "") == runner.Choice(
        "resolved", HIGH, "override"
    )
    choice = runner.choose_line(rule_file, [XHIGH, HIGH], overrides, "Write the README", "")
    assert choice == runner.Choice("missing", "", "rules")
    assert runner.describe_choice(choice) == "Line: unresolved — no rule gives the task a line"


# The looped verdict.


@pytest.mark.parametrize(
    "progress, records, completed",
    [
        ("end", [(2, "continue", "Task completed.")], True),
        ("end", [(1, "continue", "Task completed."), (2, "continue", "Task completed.")], True),
        ("end", [(2, "continue", "No task completed — no file changed.")], False),
        ("2", [(2, "stop", "No task matches the given name.")], False),
        ("2", [(2, "stop", "Scope gate closed — the scope is held or could not be checked.")], False),
        ("2", [(2, "stop", "")], False),
        ("end", [(1, "continue", "Task completed.")], False),
        ("end", [], False),
        ("1", [], False),
        (None, [], False),
    ],
)
def test_only_a_slot_line_ending_on_task_completed_goes_on(runner, progress, records, completed):
    assert runner.task_completed(progress, records, 2) is completed


# The session's lines.


def test_the_slot_line_takes_the_chosen_line_with_the_recipe_lines_at_its_head(runner):
    lines = ["source ~/.env", 'echo "<Task Title>" >> run.log', "<single-task line>"]
    assert runner.session_lines(lines, runner.slot_number(lines), XHIGH_LINE) == [
        "source ~/.env",
        'echo "${GURITA_TASK_TITLE}" >> run.log',
        FILLED_XHIGH,
    ]


@pytest.mark.parametrize(
    "line, filled",
    [
        ("cd <path>", 'cd "${GURITA_PATH}"'),
        ('echo "<Task Title> done"', 'echo "${GURITA_TASK_TITLE} done"'),
        (
            "codex exec '$gurita:complete-task --mission <path> <Task Title>'",
            "codex exec '$gurita:complete-task --mission '\"${GURITA_PATH}\"' '\"${GURITA_TASK_TITLE}\"''",
        ),
        ('echo "it\\"s <path>" \'<path>\'', 'echo "it\\"s ${GURITA_PATH}" \'\'"${GURITA_PATH}"\'\''),
        ("echo \\'<path>", "echo \\'\"${GURITA_PATH}\""),
        ("echo <goal>", "echo <goal>"),
    ],
)
def test_placeholders_become_session_variable_references_suited_to_their_quoting(runner, line, filled):
    assert runner.fill_placeholders(line) == filled


@pytest.mark.parametrize("recipe", [["echo head"], ["<single-task line>", "<single-task line>"]])
def test_a_recipe_without_exactly_one_slot_line_is_refused_before_anything_runs(
    runner, capsys, mission, rules_file, recipe
):
    (mission / "TASKS_TODO.md").write_text(task_list("Add the Parser"), encoding="utf-8")
    status, out, err = run_loop(runner, capsys, mission, rules_file, recipe=recipe)
    assert status == 1
    assert out == ""
    assert err.startswith("Error: the looped recipe holds ")


# The loop.


def test_the_loop_runs_each_top_task_and_ends_when_no_heading_remains(runner, capsys, monkeypatch, mission, rules_file):
    (mission / "TASKS_TODO.md").write_text(task_list("Add the Parser", "Write the README"), encoding="utf-8")
    sessions = Sessions(mission, [True, True])
    monkeypatch.setattr(runner, "run_task_session", sessions)
    status, out, _ = run_loop(runner, capsys, mission, rules_file)
    assert status == 0
    assert [values for _, _, values in sessions.calls] == [
        {"GURITA_PATH": f"{mission}/", "GURITA_TASK_TITLE": "Add the Parser"},
        {"GURITA_PATH": f"{mission}/", "GURITA_TASK_TITLE": "Write the README"},
    ]
    assert [(lines, slot) for lines, slot, _ in sessions.calls] == [
        (["echo head", FILLED_XHIGH], 2),
        (["echo head", FILLED_HIGH], 2),
    ]
    assert f"Task: Add the Parser\nLine: {XHIGH} (by rules)\n" in out
    assert f"Task: Write the README\nLine: {HIGH} (by rules)\n" in out
    assert out.endswith("Loop finished: no task remains\nTasks completed: 2\n")


def test_an_override_is_used_for_its_task_and_the_rules_for_the_rest(runner, capsys, monkeypatch, mission, rules_file):
    (mission / "TASKS_TODO.md").write_text(task_list("Add the Parser", "Write the README"), encoding="utf-8")
    sessions = Sessions(mission, [True, True])
    monkeypatch.setattr(runner, "run_task_session", sessions)
    status, out, _ = run_loop(runner, capsys, mission, rules_file, ["--override", "Add the Parser", HIGH])
    assert status == 0
    assert [lines[-1] for lines, _, _ in sessions.calls] == [FILLED_HIGH, FILLED_HIGH]
    assert f"Line: {HIGH} (by override)" in out


def test_the_loop_stops_on_any_first_line_but_task_completed(runner, capsys, monkeypatch, mission, rules_file):
    (mission / "TASKS_TODO.md").write_text(task_list("Add the Parser", "Write the README"), encoding="utf-8")
    sessions = Sessions(mission, [False])
    monkeypatch.setattr(runner, "run_task_session", sessions)
    status, out, _ = run_loop(runner, capsys, mission, rules_file)
    assert status == 1
    assert len(sessions.calls) == 1
    assert out.endswith(
        "Loop stopped after task: Add the Parser\nIt did not end on Task completed.\nTasks completed: 0\n"
    )


def test_an_unresolved_task_stops_the_loop_before_anything_runs_for_it(runner, capsys, monkeypatch, mission, rules_file):
    (mission / "TASKS_TODO.md").write_text(
        task_list("Add the Parser", "Rework the Runner", "Write the README"), encoding="utf-8"
    )
    sessions = Sessions(mission, [True])
    monkeypatch.setattr(runner, "run_task_session", sessions)
    status, out, _ = run_loop(runner, capsys, mission, rules_file)
    assert status == 1
    assert [values["GURITA_TASK_TITLE"] for _, _, values in sessions.calls] == ["Add the Parser"]
    assert f'Task: Rework the Runner\nLine: unresolved — the rules name "{FABLE}"' in out
    assert out.endswith(
        "Loop stopped before running task: Rework the Runner\nIts assignment is unresolved.\nTasks completed: 1\n"
    )


def test_a_missing_rule_file_runs_the_overridden_tasks_and_stops_at_the_first_without_one(
    runner, capsys, monkeypatch, mission, tmp_path
):
    (mission / "TASKS_TODO.md").write_text(task_list("Add the Parser", "Write the README"), encoding="utf-8")
    sessions = Sessions(mission, [True])
    monkeypatch.setattr(runner, "run_task_session", sessions)
    rules = tmp_path / "task_line_rules.txt"
    status, out, _ = run_loop(runner, capsys, mission, rules, ["--override", "Add the Parser", XHIGH])
    assert status == 1
    assert out.startswith(f"No rule file stands at {rules}; no task is assigned a line.\n")
    assert len(sessions.calls) == 1
    assert "Task: Write the README\nLine: unresolved — no rule gives the task a line\n" in out
    assert "Loop stopped before running task: Write the README" in out


def test_a_task_entering_the_list_during_the_run_gets_the_rules_result(runner, capsys, monkeypatch, mission, rules_file):
    (mission / "TASKS_TODO.md").write_text(task_list("Write the README"), encoding="utf-8")
    sessions = Sessions(mission, [True, True], add_after={"Write the README": ["Add the Parser"]})
    monkeypatch.setattr(runner, "run_task_session", sessions)
    status, out, _ = run_loop(runner, capsys, mission, rules_file, ["--override", "Add the Parser", HIGH])
    assert status == 0
    assert [values["GURITA_TASK_TITLE"] for _, _, values in sessions.calls] == ["Write the README", "Add the Parser"]
    assert sessions.calls[1][0][-1] == FILLED_HIGH
    assert out.endswith("Loop finished: no task remains\nTasks completed: 2\n")


def test_an_empty_task_list_ends_the_loop_at_once(runner, capsys, monkeypatch, mission, rules_file):
    (mission / "TASKS_TODO.md").write_text("# TASKS TODO\n\n", encoding="utf-8")
    sessions = Sessions(mission, [])
    monkeypatch.setattr(runner, "run_task_session", sessions)
    status, out, _ = run_loop(runner, capsys, mission, rules_file)
    assert status == 0
    assert sessions.calls == []
    assert out == "\nLoop finished: no task remains\nTasks completed: 0\n"


def test_an_unreadable_task_list_stops_the_loop(runner, capsys, monkeypatch, mission, rules_file):
    sessions = Sessions(mission, [])
    monkeypatch.setattr(runner, "run_task_session", sessions)
    status, out, _ = run_loop(runner, capsys, mission, rules_file)
    assert status == 1
    assert sessions.calls == []
    assert "Loop stopped: cannot read the task list " in out
