"""Closing a finished run's terminal: with `--close-when-finished` a chain that ran all its lines
and a loop that ends on `Loop finished: no task remains` exit after their report without waiting
for a keypress, while a stopped chain or loop still waits; without the flag every run waits.

No test starts a shell session: a chain's session shell is a stand-in that writes the run's
progress and verdict records as the composed script would, a loop's task sessions are a stub, and
`wait_for_key` is replaced by a recorder of each wait."""

import pytest

XHIGH = "Single task with Opus xHigh (Claude Code)"
XHIGH_LINE = 'claude -p "/gurita:complete-task --mission <path> <Task Title>" --model "opus" --effort xhigh'
HEADLESS = 'claude -p "/gurita:complete-task --mission m/ Some Task"'
CLOSE = ["--close-when-finished"]


@pytest.fixture
def waits(runner, monkeypatch, fixed_lines_file):
    """The keypress waits the run made, each recorded as one entry."""
    recorded = []
    monkeypatch.setattr(runner, "wait_for_key", lambda: recorded.append("wait"))
    monkeypatch.setattr(runner, "FIXED_LINES_FILE", str(fixed_lines_file))
    return recorded


def chain_shell(runner, monkeypatch, progress, verdicts=(), status=0):
    """Stand in for the chain's session shell: it records `progress` and `verdicts` in the run's
    directory, as the composed script does, and exits with `status`."""
    made = []
    mkdtemp = runner.tempfile.mkdtemp

    def record_dir(*args, **kwargs):
        made.append(mkdtemp(*args, **kwargs))
        return made[-1]

    class Shell:
        def __init__(self, argv, env=None):
            run_dir = made[-1]
            with open(f"{run_dir}/{runner.PROGRESS_FILE}", "w", encoding="utf-8") as handle:
                handle.write(f"{progress}\n")
            with open(f"{run_dir}/{runner.VERDICTS_FILE}", "w", encoding="utf-8") as handle:
                handle.write("".join(f"{number}\t{kind}\t{line}\n" for number, kind, line in verdicts))

        def wait(self):
            return status

    monkeypatch.setattr(runner.tempfile, "mkdtemp", record_dir)
    monkeypatch.setattr(runner.subprocess, "Popen", Shell)


def run_chain(runner, capsys, lines, extra=()):
    status = runner.main(["chain", *extra, "--", *lines])
    return status, capsys.readouterr().out


# Chains.


@pytest.mark.parametrize("extra, expected", [(CLOSE, []), ((), ["wait"])])
def test_a_chain_that_ran_all_its_lines_closes_only_under_the_flag(runner, capsys, monkeypatch, waits, extra, expected):
    chain_shell(runner, monkeypatch, runner.END_MARK, [(2, runner.CONTINUE, "Task completed.")])
    status, out = run_chain(runner, capsys, ["echo head", HEADLESS], extra)
    assert status == 0
    assert "Chain finished after recipe line 2 of 2" in out
    assert waits == expected


@pytest.mark.parametrize("extra", [CLOSE, ()])
def test_a_chain_that_stopped_waits_under_either_value(runner, capsys, monkeypatch, waits, extra):
    chain_shell(runner, monkeypatch, "2", [(2, runner.STOP, "No task matches the given name.")], status=1)
    status, out = run_chain(runner, capsys, ["echo head", HEADLESS, "echo tail"], extra)
    assert status == 1
    assert "Chain stopped at recipe line 2 of 3" in out
    assert waits == ["wait"]


@pytest.mark.parametrize("extra", [CLOSE, ()])
def test_a_chain_that_ended_early_waits_under_either_value(runner, capsys, monkeypatch, waits, extra):
    chain_shell(runner, monkeypatch, "1", status=2)
    status, out = run_chain(runner, capsys, ["false", "echo tail"], extra)
    assert status == 1
    assert "Chain ended early" in out
    assert waits == ["wait"]


# Looped runs.


def task_list(*titles):
    sections = "".join(f"## {title}\n\nWork on {title.lower()}.\n\n---\n\n" for title in titles)
    return "# TASKS TODO\n\n" + sections


@pytest.fixture
def mission(tmp_path):
    path = tmp_path / "mission_sample"
    path.mkdir()
    return path


@pytest.fixture
def rules_file(tmp_path):
    path = tmp_path / "task_line_rules.txt"
    path.write_text(f"parser -> {XHIGH}\n", encoding="utf-8")
    return path


def sessions(runner, monkeypatch, mission, results):
    """Stub the task sessions: each completes its task, taking its section out, while told so."""
    results = list(results)

    def session(lines, slot, values):
        completed = results.pop(0)
        if completed:
            path = mission / "TASKS_TODO.md"
            title = values["GURITA_TASK_TITLE"]
            section = f"## {title}\n\nWork on {title.lower()}.\n\n---\n\n"
            path.write_text(path.read_text(encoding="utf-8").replace(section, "", 1), encoding="utf-8")
        return ["Chain finished after recipe line 1 of 1: ...", "Run ended on: ..."], completed

    monkeypatch.setattr(runner, "run_task_session", session)

    def refuse(*args, **kwargs):
        raise AssertionError("a test started a process")

    monkeypatch.setattr(runner.subprocess, "Popen", refuse)


def run_loop(runner, capsys, mission, rules, extra=()):
    argv = ["loop", "--mission", f"{mission}/", "--rules", str(rules), "--line", XHIGH, XHIGH_LINE, *extra]
    status = runner.main(argv + ["--", "<single-task line>"])
    return status, capsys.readouterr().out


@pytest.mark.parametrize("extra, expected", [(CLOSE, []), ((), ["wait"])])
def test_a_loop_ending_with_no_task_remaining_closes_only_under_the_flag(
    runner, capsys, monkeypatch, waits, mission, rules_file, extra, expected
):
    (mission / "TASKS_TODO.md").write_text(task_list("Add the Parser", "Fix the Parser"), encoding="utf-8")
    sessions(runner, monkeypatch, mission, [True, True])
    status, out = run_loop(runner, capsys, mission, rules_file, extra)
    assert status == 0
    assert out.endswith("Loop finished: no task remains\nTasks completed: 2\n")
    assert waits == expected


@pytest.mark.parametrize("extra", [CLOSE, ()])
@pytest.mark.parametrize(
    "titles, results, ending",
    [
        (("Write the README",), [], "Its assignment is unresolved.\nTasks completed: 0\n"),
        (("Add the Parser",), [False], "It did not end on Task completed.\nTasks completed: 0\n"),
        (None, [], "Tasks completed: 0\n"),
    ],
    ids=["unresolved assignment", "task not completed", "unreadable task list"],
)
def test_a_loop_that_stopped_waits_under_either_value(
    runner, capsys, monkeypatch, waits, mission, rules_file, extra, titles, results, ending
):
    if titles is not None:
        (mission / "TASKS_TODO.md").write_text(task_list(*titles), encoding="utf-8")
    sessions(runner, monkeypatch, mission, results)
    status, out = run_loop(runner, capsys, mission, rules_file, extra)
    assert status == 1
    assert "Loop stopped" in out
    assert out.endswith(ending)
    assert waits == ["wait"]
