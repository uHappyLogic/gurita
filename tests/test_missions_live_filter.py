"""The missions tool's live query filtered by a MISSION_PATH: read lexically relative to the
workspace root as the gate query reads its argument, and refused on one Error line with exit 1
and nothing on stdout when it names no mission_ directory, its last component opening with
mission_, it prints, in the unchanged three-field line and path order, every other live
mission, started or defined, whose scope (the directory holding its own directory) equals the
named mission's scope, contains it, or lies under it, the named mission left out as the
gate query leaves it out; with no argument the query prints every live mission, as it always
has. Every test runs on a repository seeded through the conftest factory, then given commits
made through the conftest helper, a mission being started by a task-derivation-shaped commit
writing its task list."""

import pytest

ROOT = "mission_root-work/"
ROOT_TOO = "mission_more-root-work/"
API = "packages/api/mission_rate-limits/"
API_TOO = "packages/api/mission_caching/"
API_DEEP = "packages/api/v2/mission_endpoints/"
WEB = "packages/web/mission_forms/"
TODO = b"# TASKS TODO\n\n"


def title(directory):
    return "Work in " + directory


def mission_files(directory):
    return {
        directory + "requirements.md": f"# {title(directory)}\n\n## Goal\n\nThe goal.\n".encode("utf-8"),
        directory + "TASKS_TODO.md": TODO,
        directory + "open_questions.xml": b"<open-questions/>\n",
    }


def seed(repo, *directories):
    files = {"README.md": b"# A project\n"}
    for directory in directories:
        files.update(mission_files(directory))
    return repo({}, files=files)


def start(make_commit, repo, directory):
    """Start a mission the way task entry does: one commit writing tasks into its list."""
    tasks = TODO + b"## A Task\n\nDo it.\n\n---\n"
    make_commit(repo, "Task-derivation: " + directory, files={directory + "TASKS_TODO.md": tasks})


def live(run_missions, repo, *args):
    result = run_missions(repo, "live", *args)
    assert result.returncode == 0, result.stderr
    assert result.stderr == b""
    return result.stdout.decode("utf-8")


def line(directory, state):
    return f"{directory}\t{state}\t{title(directory)}\n"


def assert_one_error_line(result):
    assert result.returncode == 1
    assert result.stdout == b""
    text = result.stderr.decode("utf-8")
    assert "Traceback" not in text
    lines = text.splitlines()
    assert len(lines) == 1
    assert lines[0].startswith("Error: ")
    return lines[0]


# --- overlap ------------------------------------------------------------------------------


def test_a_mission_whose_scope_contains_the_named_one_is_listed(repo, run_missions):
    seeded = seed(repo, ROOT, API)
    assert live(run_missions, seeded, API) == line(ROOT, "defined")


def test_a_mission_whose_scope_lies_under_the_named_one_is_listed(repo, run_missions):
    seeded = seed(repo, ROOT, API)
    assert live(run_missions, seeded, ROOT) == line(API, "defined")


def test_overlap_reaches_through_every_level_in_both_directions(repo, run_missions):
    seeded = seed(repo, API, API_DEEP)
    assert live(run_missions, seeded, API_DEEP) == line(API, "defined")
    assert live(run_missions, seeded, API) == line(API_DEEP, "defined")


def test_a_mission_in_the_same_scope_is_listed(repo, run_missions):
    seeded = seed(repo, API, API_TOO)
    assert live(run_missions, seeded, API) == line(API_TOO, "defined")


def test_a_disjoint_scope_is_not_listed(repo, make_commit, run_missions):
    seeded = seed(repo, API, WEB)
    start(make_commit, seeded, WEB)
    assert live(run_missions, seeded, API) == ""
    assert live(run_missions, seeded, WEB) == ""


def test_scope_is_compared_by_whole_components_not_by_prefix(repo, run_missions):
    near = "packages/api-extra/mission_other/"
    seeded = seed(repo, API, near)
    assert live(run_missions, seeded, API) == ""


# --- what is listed -----------------------------------------------------------------------


def test_a_defined_and_a_started_sibling_are_both_listed_with_their_state(repo, make_commit, run_missions):
    seeded = seed(repo, ROOT, ROOT_TOO, API)
    start(make_commit, seeded, API)
    assert live(run_missions, seeded, ROOT) == line(ROOT_TOO, "defined") + line(API, "started")


def test_the_named_mission_is_left_out_started_or_not(repo, make_commit, run_missions):
    seeded = seed(repo, ROOT, ROOT_TOO)
    assert live(run_missions, seeded, ROOT) == line(ROOT_TOO, "defined")
    start(make_commit, seeded, ROOT)
    assert live(run_missions, seeded, ROOT) == line(ROOT_TOO, "defined")


def test_every_listed_line_is_the_unfiltered_line_in_path_order(repo, make_commit, run_missions):
    seeded = seed(repo, ROOT, ROOT_TOO, API, API_TOO, API_DEEP, WEB)
    for directory in (WEB, API_DEEP, ROOT_TOO):
        start(make_commit, seeded, directory)
    unfiltered = live(run_missions, seeded).splitlines(keepends=True)
    by_path = {printed.split("\t")[0]: printed for printed in unfiltered}
    assert live(run_missions, seeded, API) == "".join(by_path[d] for d in sorted([ROOT, ROOT_TOO, API_TOO, API_DEEP]))
    assert live(run_missions, seeded, ROOT) == "".join(by_path[d] for d in sorted(by_path) if d != ROOT)


def test_a_finished_mission_whose_directory_is_gone_is_not_listed(repo, make_commit, run_missions):
    seeded = seed(repo, ROOT, ROOT_TOO)
    start(make_commit, seeded, ROOT_TOO)
    make_commit(
        seeded,
        "Mission-finish: " + ROOT_TOO,
        removed=tuple(ROOT_TOO + name for name in ("requirements.md", "TASKS_TODO.md", "open_questions.xml")),
        body="Work\n\n- built it\n",
    )
    assert live(run_missions, seeded, ROOT) == ""


# --- reading MISSION_PATH ---------------------------------------------------------------


@pytest.mark.parametrize("spelling", ["./mission_root-work/", "mission_root-work", ".//mission_root-work/"])
def test_the_named_path_is_read_lexically(repo, run_missions, spelling):
    seeded = seed(repo, ROOT, ROOT_TOO)
    assert live(run_missions, seeded, spelling) == line(ROOT_TOO, "defined")


def test_the_named_mission_need_not_be_live(repo, make_commit, run_missions):
    seeded = seed(repo, ROOT, WEB)
    start(make_commit, seeded, ROOT)
    assert live(run_missions, seeded, "packages/api/mission_not-defined-yet/") == line(ROOT, "started")


def test_no_overlapping_mission_prints_nothing_and_exits_0(repo, run_missions):
    seeded = repo({}, files={"README.md": b"# A project\n"})
    result = run_missions(seeded, "live", ROOT)
    assert (result.returncode, result.stdout, result.stderr) == (0, b"", b"")


# --- refusals -----------------------------------------------------------------------------


@pytest.mark.parametrize(
    "path",
    [
        "packages/api/",
        "rate-limits/",
        ".",
        "./",
        "mission",
        "mission-root-work/",
        "missions/root-work/",
        "my_mission_root-work/",
        "Mission_root-work/",
        "mission_root-work/nested/",
        "milestones/root-work/",
        "packages/api/milestones/rate-limits/",
        "/abs/mission_root-work/",
        "../mission_root-work/",
        "mission_root-work/../../..",
    ],
)
def test_a_path_naming_no_mission_directory_is_refused(repo, run_missions, path):
    seeded = seed(repo, ROOT, ROOT_TOO)
    line = assert_one_error_line(run_missions(seeded, "live", path))
    assert path in line
    assert "names no mission_ directory" in line


def test_an_empty_path_is_refused(repo, run_missions):
    seeded = seed(repo, ROOT)
    line = assert_one_error_line(run_missions(seeded, "live", ""))
    assert "empty" in line


# --- no argument --------------------------------------------------------------------------


def test_with_no_argument_every_live_mission_is_printed_as_before(repo, make_commit, run_missions):
    seeded = seed(repo, ROOT, API, WEB)
    start(make_commit, seeded, API)
    assert live(run_missions, seeded) == line(ROOT, "defined") + line(API, "started") + line(WEB, "defined")


def test_the_live_help_states_the_filter(tmp_path, run_missions):
    result = run_missions(tmp_path, "live", "--help")
    assert result.returncode == 0
    text = " ".join(result.stdout.decode("utf-8").split())
    assert "MISSION_PATH" in text
    assert "started or defined" in text
    assert "equals MISSION_PATH's scope, contains it, or lies under it" in text
    assert "left out" in text
