"""The finished file: with `--finished-file FILE` a chain that ran all its lines writes FILE,
empty, before its report and before any keypress wait, so the extension can send a chain's last
line to Claude Desktop as soon as its earlier lines finish; a chain that stopped or ended early
writes nothing, and without the option no file is written.

No test starts a shell session: the chain's session shell is a stand-in that writes the run's
progress and verdict records as the composed script would, and `wait_for_key` is replaced by a
recorder that notes whether the finished file stood when the run began to wait."""

import pytest

HEADLESS = 'claude -p "/gurita:derive-tasks --mission m/"'


@pytest.fixture
def waits(runner, monkeypatch, fixed_lines_file):
    """Each keypress wait the run made, recorded with whether the finished file then stood."""
    recorded = []
    state = {"file": None}

    def wait():
        recorded.append(state["file"] is not None and state["file"].exists())

    monkeypatch.setattr(runner, "wait_for_key", wait)
    monkeypatch.setattr(runner, "FIXED_LINES_FILE", str(fixed_lines_file))
    return recorded, state


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


def test_a_chain_that_ran_all_its_lines_writes_the_finished_file_before_it_waits(runner, capsys, monkeypatch, waits, tmp_path):
    recorded, state = waits
    finished = tmp_path / "finished"
    state["file"] = finished
    chain_shell(runner, monkeypatch, runner.END_MARK, [(2, runner.CONTINUE, "Task completed.")])
    status = runner.main(["chain", "--finished-file", str(finished), "--", "echo head", HEADLESS])
    out = capsys.readouterr().out
    assert status == 0
    assert "Chain finished after recipe line 2 of 2" in out
    assert finished.read_text(encoding="utf-8") == ""
    assert recorded == [True], "the file stands before the run waits for a keypress"


def test_the_finished_file_is_written_under_close_when_finished_too(runner, capsys, monkeypatch, waits, tmp_path):
    recorded, _ = waits
    finished = tmp_path / "finished"
    chain_shell(runner, monkeypatch, runner.END_MARK, [(1, runner.CONTINUE, "Task completed.")])
    status = runner.main(["chain", "--close-when-finished", "--finished-file", str(finished), "--", HEADLESS])
    capsys.readouterr()
    assert status == 0
    assert finished.exists()
    assert recorded == []


def test_a_chain_that_stopped_writes_no_finished_file(runner, capsys, monkeypatch, waits, tmp_path):
    recorded, _ = waits
    finished = tmp_path / "finished"
    chain_shell(runner, monkeypatch, "1", [(1, runner.STOP, "No task matches the given name.")], status=1)
    status = runner.main(["chain", "--finished-file", str(finished), "--", HEADLESS, "echo tail"])
    out = capsys.readouterr().out
    assert status == 1
    assert "Chain stopped at recipe line 1 of 2" in out
    assert not finished.exists()
    assert recorded == [False]


def test_a_chain_that_ended_early_writes_no_finished_file(runner, capsys, monkeypatch, waits, tmp_path):
    finished = tmp_path / "finished"
    chain_shell(runner, monkeypatch, "1", status=2)
    status = runner.main(["chain", "--close-when-finished", "--finished-file", str(finished), "--", "false", "echo tail"])
    out = capsys.readouterr().out
    assert status == 1
    assert "Chain ended early" in out
    assert not finished.exists()


def test_without_the_option_no_finished_file_is_written(runner, capsys, monkeypatch, waits, tmp_path):
    chain_shell(runner, monkeypatch, runner.END_MARK)
    status = runner.main(["chain", "--close-when-finished", "--", "echo head"])
    capsys.readouterr()
    assert status == 0
    assert list(tmp_path.iterdir()) == [tmp_path / "fixed_lines.tsv"]


def test_a_finished_file_that_cannot_be_written_is_reported_beneath_the_report(runner, capsys, monkeypatch, waits, tmp_path):
    finished = tmp_path / "missing" / "finished"
    chain_shell(runner, monkeypatch, runner.END_MARK)
    status = runner.main(["chain", "--close-when-finished", "--finished-file", str(finished), "--", "echo head"])
    out = capsys.readouterr().out
    assert status == 0
    lines = out.strip().splitlines()
    assert lines[0].startswith("Chain finished after recipe line 1 of 1")
    assert lines[-1].startswith(f"The finished file {finished} could not be written: ")
