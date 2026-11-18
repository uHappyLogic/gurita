"""The missions tool's gate query: for a MISSION_PATH naming a mission_ directory, its last
component opening with mission_, read lexically relative to the workspace root, it prints one
bare path per line, ordered by path, for every other live mission that is started (its
TASKS_TODO.md modified after the commit adding it, by the path-scoped git log -1
--diff-filter=M test) and whose scope (the directory holding its own directory) equals the
named mission's scope, contains it, or lies under it, and exits 0 whether or not it prints.
It refuses a shallow repository (git rev-parse --is-shallow-repository printing true), naming
git fetch --unshallow, and a MISSION_PATH naming no mission_ directory, a path under a
milestones/ container included, each on one Error line with exit 1 and nothing on stdout.
Every test runs on a repository seeded through the conftest factory, then given commits made
through the conftest helper, a mission being started by a task-derivation-shaped commit
writing its task list."""

import subprocess

import pytest

ROOT = "mission_root-work/"
ROOT_TOO = "mission_more-root-work/"
API = "packages/api/mission_rate-limits/"
API_TOO = "packages/api/mission_caching/"
API_DEEP = "packages/api/v2/mission_endpoints/"
WEB = "packages/web/mission_forms/"
TODO = b"# TASKS TODO\n\n"


def mission_files(directory):
    return {
        directory + "requirements.md": f"# Work in {directory}\n\n## Goal\n\nThe goal.\n".encode("utf-8"),
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


def gate(run_missions, repo, path):
    result = run_missions(repo, "gate", path)
    assert result.returncode == 0, result.stderr
    assert result.stderr == b""
    return result.stdout.decode("utf-8")


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


def test_a_started_mission_in_the_same_scope_holds_the_scope(repo, make_commit, run_missions):
    seeded = seed(repo, ROOT, ROOT_TOO)
    start(make_commit, seeded, ROOT_TOO)
    assert gate(run_missions, seeded, ROOT) == ROOT_TOO + "\n"


def test_a_started_mission_whose_scope_contains_the_named_one_holds_it(repo, make_commit, run_missions):
    seeded = seed(repo, ROOT, API)
    start(make_commit, seeded, ROOT)
    assert gate(run_missions, seeded, API) == ROOT + "\n"


def test_a_started_mission_whose_scope_lies_under_the_named_one_holds_it(repo, make_commit, run_missions):
    seeded = seed(repo, ROOT, API)
    start(make_commit, seeded, API)
    assert gate(run_missions, seeded, ROOT) == API + "\n"


def test_overlap_reaches_through_every_level_in_both_directions(repo, make_commit, run_missions):
    seeded = seed(repo, API, API_DEEP)
    start(make_commit, seeded, API)
    assert gate(run_missions, seeded, API_DEEP) == API + "\n"
    start(make_commit, seeded, API_DEEP)
    assert gate(run_missions, seeded, API) == API_DEEP + "\n"


def test_disjoint_packages_hold_nothing_against_each_other(repo, make_commit, run_missions):
    seeded = seed(repo, API, WEB)
    start(make_commit, seeded, API)
    start(make_commit, seeded, WEB)
    assert gate(run_missions, seeded, API) == ""
    assert gate(run_missions, seeded, WEB) == ""


def test_scope_is_compared_by_whole_components_not_by_prefix(repo, make_commit, run_missions):
    near = "packages/api-extra/mission_other/"
    seeded = seed(repo, API, near)
    start(make_commit, seeded, near)
    assert gate(run_missions, seeded, API) == ""


def test_every_holder_is_printed_as_a_bare_path_ordered_by_path(repo, make_commit, run_missions):
    seeded = seed(repo, ROOT, ROOT_TOO, API, API_TOO, API_DEEP, WEB)
    for directory in (WEB, API_DEEP, ROOT_TOO, API_TOO):
        start(make_commit, seeded, directory)
    assert gate(run_missions, seeded, API) == "".join(
        line + "\n" for line in sorted([ROOT_TOO, API_TOO, API_DEEP])
    )
    assert gate(run_missions, seeded, ROOT) == "".join(
        line + "\n" for line in sorted([ROOT_TOO, API_TOO, API_DEEP, WEB])
    )


# --- what holds nothing -------------------------------------------------------------------


def test_a_defined_only_mission_holds_nothing(repo, make_commit, run_missions):
    seeded = seed(repo, ROOT, ROOT_TOO, API)
    make_commit(
        seeded,
        "Requirements-review: " + ROOT_TOO,
        files={ROOT_TOO + "requirements.md": b"# Work\n\n## Goal\n\nA revised goal.\n"},
    )
    assert gate(run_missions, seeded, ROOT) == ""
    assert gate(run_missions, seeded, API) == ""


def test_the_named_mission_itself_is_never_printed(repo, make_commit, run_missions):
    seeded = seed(repo, ROOT, ROOT_TOO)
    start(make_commit, seeded, ROOT)
    assert gate(run_missions, seeded, ROOT) == ""


def test_a_finished_mission_whose_directory_is_gone_holds_nothing(repo, make_commit, run_missions):
    seeded = seed(repo, ROOT, ROOT_TOO)
    start(make_commit, seeded, ROOT_TOO)
    make_commit(
        seeded,
        "Mission-finish: " + ROOT_TOO,
        removed=tuple(ROOT_TOO + name for name in ("requirements.md", "TASKS_TODO.md", "open_questions.xml")),
        body="Work\n\n- built it\n",
    )
    assert gate(run_missions, seeded, ROOT) == ""


def test_an_untracked_mission_directory_holds_nothing(repo, make_commit, run_missions):
    seeded = seed(repo, ROOT)
    (seeded / "mission_stray").mkdir()
    (seeded / "mission_stray" / "requirements.md").write_bytes(b"# Stray\n")
    (seeded / "mission_stray" / "TASKS_TODO.md").write_bytes(TODO + b"## A Task\n")
    assert gate(run_missions, seeded, ROOT) == ""


def test_a_started_directory_under_an_old_container_holds_nothing(repo, make_commit, run_missions):
    old = "milestones/old-work/"
    seeded = seed(repo, ROOT, old)
    start(make_commit, seeded, old)
    assert gate(run_missions, seeded, ROOT) == ""


# --- reading MISSION_PATH ---------------------------------------------------------------


@pytest.mark.parametrize("spelling", ["./mission_root-work/", "mission_root-work", ".//mission_root-work/"])
def test_the_named_path_is_read_lexically(repo, make_commit, run_missions, spelling):
    seeded = seed(repo, ROOT, ROOT_TOO)
    start(make_commit, seeded, ROOT)
    start(make_commit, seeded, ROOT_TOO)
    assert gate(run_missions, seeded, spelling) == ROOT_TOO + "\n"


def test_the_named_mission_need_not_be_live(repo, make_commit, run_missions):
    seeded = seed(repo, ROOT)
    start(make_commit, seeded, ROOT)
    assert gate(run_missions, seeded, "packages/api/mission_not-defined-yet/") == ROOT + "\n"


def test_no_live_mission_prints_nothing_and_exits_0(repo, run_missions):
    seeded = repo({}, files={"README.md": b"# A project\n"})
    result = run_missions(seeded, "gate", ROOT)
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
def test_a_path_naming_no_mission_directory_is_refused(repo, make_commit, run_missions, path):
    seeded = seed(repo, ROOT, ROOT_TOO)
    start(make_commit, seeded, ROOT_TOO)
    line = assert_one_error_line(run_missions(seeded, "gate", path))
    assert path in line
    assert "names no mission_ directory" in line


def shallow_clone(source, destination, environment):
    result = subprocess.run(
        ["git", "clone", "-q", "--depth", "1", source.as_uri(), str(destination)],
        env=environment,
        stdin=subprocess.DEVNULL,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr.decode("utf-8", "replace")
    return destination


def test_a_shallow_repository_is_refused_naming_the_unshallow_fetch(
    repo, make_commit, run_missions, environment, git, tmp_path
):
    seeded = seed(repo, ROOT, ROOT_TOO)
    start(make_commit, seeded, ROOT_TOO)
    assert gate(run_missions, seeded, ROOT) == ROOT_TOO + "\n"
    clone = shallow_clone(seeded, tmp_path / "shallow", environment)
    assert git(clone, environment, "rev-parse", "--is-shallow-repository").strip() == "true"
    line = assert_one_error_line(run_missions(clone, "gate", ROOT))
    assert "shallow" in line
    assert "git fetch --unshallow" in line


def test_a_shallow_repository_is_refused_whatever_the_path(repo, make_commit, run_missions, environment, tmp_path):
    seeded = seed(repo, ROOT)
    start(make_commit, seeded, ROOT)
    clone = shallow_clone(seeded, tmp_path / "shallow", environment)
    for path in (ROOT, API, "packages/api/"):
        line = assert_one_error_line(run_missions(clone, "gate", path))
        assert "git fetch --unshallow" in line


def test_a_complete_clone_is_not_refused(repo, make_commit, run_missions, environment, tmp_path):
    seeded = seed(repo, ROOT, ROOT_TOO)
    start(make_commit, seeded, ROOT_TOO)
    clone = tmp_path / "complete"
    result = subprocess.run(
        ["git", "clone", "-q", seeded.as_uri(), str(clone)],
        env=environment,
        stdin=subprocess.DEVNULL,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr.decode("utf-8", "replace")
    assert gate(run_missions, clone, ROOT) == ROOT_TOO + "\n"
