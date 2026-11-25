"""The missions tool's tasks query with its bodies bound: with --bodies N beside --with-body
every task line is printed, in the unbounded order, and only the N newest tasks, the first N
lines, carry their bodies beneath them, every older task printing as its task line alone, the
form a commit with no body already takes, so one reader parses both. N is a whole number, zero
included; a negative or non-numeric N, and --bodies without --with-body, get argparse's exit 2
with nothing printed. The help text states the flag. Every test runs on a repository seeded
through the conftest factory and given commits made through the conftest helper."""

import pytest

FIRST = "mission_first/"
TODO = FIRST + "TASKS_TODO.md"
BODY_FLAG = "--with-body"
BODIES_FLAG = "--bodies"

TITLES = ["Newest Task", "Middle Task", "Oldest Task"]


@pytest.fixture
def three(repo, make_commit):
    seeded = repo({FIRST: "parallel_first"})
    # Committed out of date order, so the bound follows the printed order (newest first by
    # author timestamp), never git's commit order.
    make_commit(
        seeded,
        "Task-completion: Middle Task",
        files={TODO: b"b\n"},
        body="- middle criterion\n",
        date="2026-03-02T10:00:00+00:00",
    )
    make_commit(
        seeded,
        "Task-completion: Oldest Task",
        files={TODO: b"a\n"},
        body="- oldest criterion\n- oldest second\n",
        date="2026-03-01T10:00:00+00:00",
    )
    make_commit(
        seeded,
        "Task-completion: Newest Task",
        files={TODO: b"c\n"},
        body="- newest criterion\n",
        date="2026-03-03T10:00:00+00:00",
    )
    return seeded


def tasks(run_missions, repo, *args):
    result = run_missions(repo, "tasks", *args)
    assert result.returncode == 0, result.stderr
    assert result.stderr == b""
    return result.stdout.decode("utf-8")


def blocks(printed):
    """The print split at each column-0 line: one [task line, body lines...] list per task."""
    grouped = []
    for line in printed.splitlines(keepends=True):
        if line.startswith("    "):
            grouped[-1].append(line)
        else:
            grouped.append([line])
    return grouped


@pytest.mark.parametrize("bound", [0, 1, 2, 3, 4])
def test_every_task_line_is_printed_and_only_the_n_newest_carry_their_bodies(three, run_missions, bound):
    unbounded = blocks(tasks(run_missions, three, FIRST, BODY_FLAG))
    bounded = blocks(tasks(run_missions, three, FIRST, BODY_FLAG, BODIES_FLAG, str(bound)))
    assert [block[0].rstrip("\n").split("\t")[3] for block in bounded] == TITLES
    assert bounded == [
        block if index < bound else block[:1] for index, block in enumerate(unbounded)
    ]


def test_an_older_task_prints_as_its_unflagged_line_alone(three, run_missions):
    without = tasks(run_missions, three, FIRST)
    bounded = tasks(run_missions, three, FIRST, BODY_FLAG, BODIES_FLAG, "1")
    lines = without.splitlines(keepends=True)
    assert bounded == lines[0] + "    - newest criterion\n" + lines[1] + lines[2]


def test_a_bound_of_zero_prints_what_the_unflagged_query_prints(three, run_missions):
    assert tasks(run_missions, three, FIRST, BODY_FLAG, BODIES_FLAG, "0") == tasks(run_missions, three, FIRST)


def test_a_body_less_task_among_the_newest_still_counts_toward_the_bound(three, make_commit, run_missions):
    make_commit(
        three,
        "Task-completion: Subject Only",
        files={TODO: b"d\n"},
        date="2026-03-04T10:00:00+00:00",
    )
    bounded = blocks(tasks(run_missions, three, FIRST, BODY_FLAG, BODIES_FLAG, "2"))
    assert [len(block) for block in bounded] == [1, 2, 1, 1]
    assert bounded[1][0].endswith("\tNewest Task\n")


def test_without_the_bound_every_body_is_printed(three, run_missions):
    assert [len(block) for block in blocks(tasks(run_missions, three, FIRST, BODY_FLAG))] == [2, 2, 3]


@pytest.mark.parametrize(
    "args",
    [
        (FIRST, BODIES_FLAG, "1"),
        (FIRST, BODY_FLAG, BODIES_FLAG, "-1"),
        (FIRST, BODY_FLAG, BODIES_FLAG, "x"),
        (FIRST, BODY_FLAG, BODIES_FLAG),
    ],
)
def test_a_malformed_bound_exits_2_and_prints_nothing(three, run_missions, args):
    result = run_missions(three, "tasks", *args)
    assert result.returncode == 2
    assert result.stdout == b""
    assert b"Traceback" not in result.stderr


def test_the_help_states_the_bodies_flag(tmp_path, run_missions):
    text = " ".join(run_missions(tmp_path, "tasks", "--help").stdout.decode("utf-8").split())
    assert "--bodies N" in text
    assert "only the N newest tasks" in text
    assert "--bodies without --with-body is refused" in text
