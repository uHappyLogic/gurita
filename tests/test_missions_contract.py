"""The missions tool's shared contract: its help states the record's limits (a shallow clone's
truncated log, with no check made for it, the record's start at the first Task-completion:
commit and the finished missions' at the first Mission-finish: commit, a task commit made
before the mission rename listed under the placeholder, and the finish subjects read only in
the path form) for the tasks query and the three history queries,
the live query's started test reading the same log, the gate and since queries the two that
refuse a shallow repository, and the trailer rule over every printed body; every failure is one
Error line on stderr with exit 1 and nothing on stdout, a malformed invocation gets argparse's
exit 2, no traceback reaches the caller, and a query writes nothing: the repository's status
and HEAD are the same after it as before."""

import os

import pytest

FIRST = "mission_first/"


@pytest.fixture
def seeded(repo):
    return repo({FIRST: "parallel_first"}, files={FIRST + "requirements.md": b"# First\n"})


def assert_one_error_line(result):
    assert result.returncode == 1
    assert result.stdout == b""
    text = result.stderr.decode("utf-8")
    assert "Traceback" not in text
    lines = text.splitlines()
    assert len(lines) == 1
    assert lines[0].startswith("Error: ")
    return lines[0]


@pytest.mark.parametrize("args", [("--help",), ("tasks", "--help")])
def test_the_help_states_the_shallow_clone_limit_and_where_the_record_starts(tmp_path, run_missions, args):
    result = run_missions(tmp_path, *args)
    assert result.returncode == 0
    text = " ".join(result.stdout.decode("utf-8").split())
    assert "shallow clone" in text
    assert "no check is made" in text
    assert "Task-completion:" in text
    assert "2026-09-02" in text
    assert "Tasklist-completion:" in text


@pytest.mark.parametrize("args", [("--help",), ("live", "--help")])
def test_the_help_states_that_the_started_test_reads_a_shallow_clones_log(tmp_path, run_missions, args):
    result = run_missions(tmp_path, *args)
    assert result.returncode == 0
    text = " ".join(result.stdout.decode("utf-8").split())
    assert "started test" in text
    assert "shallow clone" in text
    assert 'reads "defined"' in text


@pytest.mark.parametrize("query", ["missions", "summary", "record", "show"])
def test_each_history_querys_help_states_the_shallow_clone_limit(tmp_path, run_missions, query):
    result = run_missions(tmp_path, query, "--help")
    assert result.returncode == 0
    text = " ".join(result.stdout.decode("utf-8").split())
    assert "shallow clone" in text
    assert "no check is made" in text
    assert "finish" in text
    assert "Mission-finish:" in text
    assert "the record of finished missions starts at that marker's first use" in text
    assert "Task-completion:" in text


def test_the_top_level_help_states_the_finish_subject_limit_and_names_every_query(tmp_path, run_missions):
    text = " ".join(run_missions(tmp_path, "--help").stdout.decode("utf-8").split())
    assert "Mission-finish: subjects naming a mission path" in text
    assert "the record of finished missions starts at that marker's first use" in text
    for query in ("live", "gate", "tasks", "missions", "summary", "record", "since", "show"):
        assert query in text


def test_the_top_level_help_states_that_gate_and_since_check_for_a_shallow_clone(tmp_path, run_missions):
    text = " ".join(run_missions(tmp_path, "--help").stdout.decode("utf-8").split())
    assert "two queries check, gate and since, each refusing a shallow repository" in text
    assert "alone checks" not in text


def test_the_gate_help_names_its_scope_rule_and_both_refusals(tmp_path, run_missions):
    result = run_missions(tmp_path, "gate", "--help")
    assert result.returncode == 0
    text = " ".join(result.stdout.decode("utf-8").split())
    assert "MISSION_PATH" in text
    assert "one bare path per line" in text
    assert "started" in text
    assert "equals MISSION_PATH's scope, contains it, or lies under it" in text
    assert "exits 0 whether or not it prints" in text
    assert "git rev-parse --is-shallow-repository" in text
    assert "git fetch --unshallow" in text
    assert "naming no mission_ directory is refused" in text


@pytest.mark.parametrize(
    "args", [("tasks", "--help"), ("summary", "--help"), ("record", "--help")]
)
def test_the_help_of_each_body_printer_states_the_trailer_rule(tmp_path, run_missions, args):
    text = " ".join(run_missions(tmp_path, *args).stdout.decode("utf-8").split())
    assert "trailing paragraph whose every line is a trailer" in text
    assert "Token: value" in text


def test_the_history_helps_name_their_line_shapes(tmp_path, run_missions):
    missions = " ".join(run_missions(tmp_path, "missions", "--help").stdout.decode("utf-8").split())
    assert '"live" or "finished"' in missions
    assert "YYYY-MM-DD" in missions
    assert "Every live line stands above every finished one" in missions
    summary = " ".join(run_missions(tmp_path, "summary", "--help").stdout.decode("utf-8").split())
    assert '"live"' in summary and "## Goal" in summary
    record = " ".join(run_missions(tmp_path, "record", "--help").stdout.decode("utf-8").split())
    assert "column 0" in record and "four spaces" in record and "no bar" in record


def test_the_live_help_names_the_discovery_pattern_and_the_line(tmp_path, run_missions):
    text = " ".join(run_missions(tmp_path, "live", "--help").stdout.decode("utf-8").split())
    assert "**/mission_*/requirements.md" in text
    assert "started" in text and "defined" in text
    assert "--diff-filter=M" in text


def test_the_help_names_the_query_and_its_body_flag(tmp_path, run_missions):
    text = run_missions(tmp_path, "tasks", "--help").stdout.decode("utf-8")
    assert "PATH" in text
    assert "--with-body" in text
    assert "**/mission_*/TASKS_TODO.md" in text


@pytest.mark.parametrize("args", [("--help",), ("tasks", "--help")])
def test_the_help_states_that_a_task_commit_made_before_the_rename_lists_under_the_placeholder(
    tmp_path, run_missions, args
):
    text = " ".join(run_missions(tmp_path, *args).stdout.decode("utf-8").split())
    assert "a task commit made before the mission rename" in text
    assert 'the placeholder "-"' in text
    assert "its bar beneath it under --with-body" in text


def test_outside_a_git_repository_the_query_fails_on_one_error_line(tmp_path, run_missions):
    outside = tmp_path / "outside"
    outside.mkdir()
    line = assert_one_error_line(run_missions(outside, "tasks", "."))
    assert "git log" in line


def test_outside_a_git_repository_live_fails_on_one_error_line(tmp_path, run_missions):
    outside = tmp_path / "outside"
    outside.mkdir()
    line = assert_one_error_line(run_missions(outside, "live"))
    assert "git ls-files" in line


@pytest.mark.parametrize("query", ["gate", "since"])
def test_outside_a_git_repository_gate_and_since_fail_on_one_error_line(tmp_path, run_missions, query):
    outside = tmp_path / "outside"
    outside.mkdir()
    line = assert_one_error_line(run_missions(outside, query, FIRST))
    assert "git rev-parse" in line


@pytest.mark.parametrize("args", [("missions", "."), ("summary", FIRST), ("record", "."), ("show", FIRST)])
def test_outside_a_git_repository_a_history_query_fails_on_one_error_line(tmp_path, run_missions, args):
    outside = tmp_path / "outside"
    outside.mkdir()
    line = assert_one_error_line(run_missions(outside, *args))
    assert "git" in line


@pytest.mark.parametrize("query", ["live", "gate", "tasks", "missions", "summary", "record", "since", "show"])
def test_an_empty_path_is_refused(seeded, run_missions, query):
    assert_one_error_line(run_missions(seeded, query, ""))


def test_a_missing_git_fails_on_one_error_line(seeded, run_missions, environment, tmp_path):
    empty_bin = tmp_path / "no-git-bin"
    empty_bin.mkdir()
    env = dict(environment, PATH=str(empty_bin))
    line = assert_one_error_line(run_missions(seeded, "tasks", FIRST, env=env))
    assert "git" in line
    line = assert_one_error_line(run_missions(seeded, "live", env=env))
    assert "git" in line
    for args in (("live", FIRST), ("gate", FIRST), ("missions", "."), ("summary", FIRST), ("record", "."), ("since", FIRST), ("show", FIRST)):
        line = assert_one_error_line(run_missions(seeded, *args, env=env))
        assert "git" in line


@pytest.mark.skipif(hasattr(os, "geteuid") and os.geteuid() == 0, reason="root reads a file whatever its mode")
def test_an_unreadable_live_requirements_file_fails_on_one_error_line(seeded, run_missions):
    requirements = seeded / FIRST / "requirements.md"
    requirements.chmod(0)
    try:
        for args in (("missions", "."), ("summary", FIRST), ("record", "."), ("show", FIRST)):
            line = assert_one_error_line(run_missions(seeded, *args))
            assert "requirements.md" in line
    finally:
        requirements.chmod(0o644)


@pytest.mark.parametrize(
    "args",
    [
        (),
        ("tasks",),
        ("unknown", FIRST),
        ("tasks", FIRST, "--body"),
        ("live", FIRST, FIRST),
        ("live", "--with-body"),
        ("live", FIRST, "--with-body"),
        ("gate",),
        ("gate", FIRST, FIRST),
        ("gate", FIRST, "--with-body"),
        ("missions",),
        ("missions", FIRST, FIRST),
        ("missions", FIRST, "--with-body"),
        ("summary",),
        ("summary", FIRST, FIRST),
        ("summary", FIRST, "--with-body"),
        ("record",),
        ("record", FIRST, FIRST),
        ("record", FIRST, "--with-body"),
        ("since",),
        ("since", FIRST, FIRST),
        ("since", FIRST, "--with-body"),
        ("show",),
        ("show", FIRST, "requirements.md"),
        ("show", FIRST, "--with-body"),
    ],
)
def test_a_malformed_invocation_exits_2(seeded, run_missions, args):
    result = run_missions(seeded, *args)
    assert result.returncode == 2
    assert result.stdout == b""
    assert "Traceback" not in result.stderr.decode("utf-8")


def test_a_query_writes_nothing(seeded, make_commit, run_missions, git, environment):
    make_commit(seeded, "Task-completion: A Task", files={FIRST + "TASKS_TODO.md": b"a\n"}, body="- done\n")
    (seeded / "untracked.txt").write_bytes(b"x\n")
    before = (
        git(seeded, environment, "status", "--porcelain", "--ignored"),
        git(seeded, environment, "rev-parse", "HEAD"),
        sorted(os.listdir(seeded / ".git")),
    )
    for args in (
        ("tasks", FIRST),
        ("tasks", FIRST, "--with-body"),
        ("tasks", "untracked.txt"),
        ("tasks", "nope"),
        ("live",),
        ("live", FIRST),
        ("live", "nope/"),
        ("gate", FIRST),
        ("gate", "nope/"),
        ("gate", "mission_nope/"),
        ("missions", "."),
        ("missions", "nope"),
        ("summary", FIRST),
        ("summary", "nope/"),
        ("record", "."),
        ("record", FIRST),
        ("since", FIRST),
        ("since", FIRST, "--missions"),
        ("since", "nope/"),
        ("show", FIRST),
        ("show", "nope/"),
    ):
        run_missions(seeded, *args)
    after = (
        git(seeded, environment, "status", "--porcelain", "--ignored"),
        git(seeded, environment, "rev-parse", "HEAD"),
        sorted(os.listdir(seeded / ".git")),
    )
    assert after == before


@pytest.mark.parametrize(
    "args",
    [
        ("milestones", "."),
        ("missions", "--milestone", FIRST),
        ("since", FIRST, "--milestones"),
    ],
)
def test_the_query_and_flags_named_before_the_rename_are_not_accepted(seeded, run_missions, args):
    result = run_missions(seeded, *args)
    assert result.returncode == 2
    assert result.stdout == b""
    assert "Traceback" not in result.stderr.decode("utf-8")
