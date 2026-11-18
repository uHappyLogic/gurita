"""The missions tool's missions query in its mission-path form and under its bound: with
--mission MISSION_PATH in place of PATH, read lexically relative to the workspace root as the
gate query reads its argument and refused on one Error line with exit 1 and nothing on stdout
when it names no mission_ directory, its last component opening with mission_, the query prints
exactly the overview it prints with that mission's scope (the directory holding its own
directory, "." for the root) as PATH; with --last N it prints every live line and only the N
newest finished lines; and with neither it prints what it always has. Every test runs on a
repository seeded through the conftest factory, then given finish-shaped commits made through
the conftest helper."""

import pytest

ROOT_A = "mission_alpha/"
ROOT_B = "mission_beta/"
ROOT_C = "mission_gamma/"
ROOT_D = "mission_delta/"
API = "packages/api/mission_rate-limits/"
API_TOO = "packages/api/mission_caching/"
WEB = "packages/web/mission_forms/"
TODO = b"# TASKS TODO\n\n"


def mission_files(directory, title):
    return {
        directory + "requirements.md": f"# {title}\n\n## Goal\n\nThe goal of {title}.\n".encode("utf-8"),
        directory + "TASKS_TODO.md": TODO,
        directory + "open_questions.xml": b"<open-questions/>\n",
    }


def finish(make_commit, repo, directory, title, date):
    removed = sorted(
        str(path.relative_to(repo)) for path in (repo / directory).rglob("*") if path.is_file()
    )
    body = title + "\n\n- built it\n"
    return make_commit(repo, "Mission-finish: " + directory, removed=removed, body=body, date=date)


def query(run_missions, repo, *args):
    result = run_missions(repo, "missions", *args)
    assert result.returncode == 0, result.stderr
    assert result.stderr == b""
    return result.stdout.decode("utf-8")


def assert_one_error_line(result, value):
    assert result.returncode == 1
    assert result.stdout == b""
    lines = result.stderr.decode("utf-8").splitlines()
    assert len(lines) == 1
    assert lines[0].startswith("Error: ")
    assert value in lines[0]


@pytest.fixture
def project(repo, make_commit):
    """Four root missions and three package ones, three root and one package mission
    finished on distinct days, so live and finished lines stand in both scopes."""
    files = {"README.md": b"# A project\n", "packages/api/src/limit.py": b"a\n", "packages/web/src/form.js": b"b\n"}
    for directory, title in (
        (ROOT_A, "Alpha Work"),
        (ROOT_B, "Beta Work"),
        (ROOT_C, "Gamma Work"),
        (ROOT_D, "Delta Work"),
        (API, "Rate Limits"),
        (API_TOO, "Caching"),
        (WEB, "Forms"),
    ):
        files.update(mission_files(directory, title))
    seeded = repo({}, files=files)
    finish(make_commit, seeded, ROOT_B, "Beta Work", "2026-03-01T10:00:00+00:00")
    finish(make_commit, seeded, ROOT_C, "Gamma Work", "2026-03-03T10:00:00+00:00")
    finish(make_commit, seeded, ROOT_D, "Delta Work", "2026-03-02T10:00:00+00:00")
    finish(make_commit, seeded, API_TOO, "Caching", "2026-03-04T10:00:00+00:00")
    return seeded


@pytest.mark.parametrize(
    "mission, scope",
    [
        (ROOT_A, "."),
        (API, "packages/api"),
        (WEB, "packages/web"),
        (API_TOO, "packages/api"),
        ("packages/api/mission_not-yet/", "packages/api"),
    ],
)
def test_the_mission_path_form_prints_the_scope_calls_overview(project, run_missions, mission, scope):
    expected = query(run_missions, project, scope)
    assert expected
    assert query(run_missions, project, "--mission", mission) == expected


def test_the_package_form_lists_the_root_and_its_own_scope_only(project, run_missions):
    assert query(run_missions, project, "--mission", API) == (
        f"live\t-\t{ROOT_A}\tAlpha Work\n"
        f"live\t-\t{API}\tRate Limits\n"
        f"finished\t2026-03-04\t{API_TOO}\tCaching\n"
        f"finished\t2026-03-03\t{ROOT_C}\tGamma Work\n"
        f"finished\t2026-03-02\t{ROOT_D}\tDelta Work\n"
        f"finished\t2026-03-01\t{ROOT_B}\tBeta Work\n"
    )


@pytest.mark.parametrize("spelling", ["./packages/api/mission_rate-limits", "packages//api/mission_rate-limits/./"])
def test_the_mission_path_is_read_lexically(project, run_missions, spelling):
    assert query(run_missions, project, "--mission", spelling) == query(run_missions, project, "packages/api")


@pytest.mark.parametrize(
    "value",
    [
        "packages/api/",
        "packages/api/src/limit.py",
        "missions/alpha/",
        "milestones/alpha/",
        "packages/api/milestones/rate-limits/",
        "/abs/mission_alpha/",
        "../mission_alpha/",
        "mission_alpha/extra/",
    ],
)
def test_a_value_naming_no_mission_directory_is_refused(project, run_missions, value):
    assert_one_error_line(run_missions(project, "missions", "--mission", value), value)


def test_an_empty_mission_path_is_refused(project, run_missions):
    assert_one_error_line(run_missions(project, "missions", "--mission", ""), "MISSION_PATH")


@pytest.mark.parametrize("args", [(), (".", "--mission", ROOT_A), ("--last", "2"), (".", "--last", "-1"), (".", "--last", "x")])
def test_a_malformed_form_exits_2(project, run_missions, args):
    result = run_missions(project, "missions", *args)
    assert result.returncode == 2
    assert result.stdout == b""


@pytest.mark.parametrize("last", [0, 1, 2, 3])
def test_the_bound_keeps_every_live_line_and_the_newest_finished_lines(project, run_missions, last):
    unbounded = query(run_missions, project, ".").splitlines(keepends=True)
    live = [line for line in unbounded if line.startswith("live\t")]
    finished = [line for line in unbounded if line.startswith("finished\t")]
    assert len(live) == 3 and len(finished) == 4
    assert query(run_missions, project, ".", "--last", str(last)) == "".join(live + finished[:last])


def test_the_bound_keeps_the_newest_by_finish_timestamp(project, run_missions):
    assert query(run_missions, project, ".", "--last", "2").splitlines()[-2:] == [
        f"finished\t2026-03-04\t{API_TOO}\tCaching",
        f"finished\t2026-03-03\t{ROOT_C}\tGamma Work",
    ]


def test_a_bound_wider_than_the_record_prints_it_whole(project, run_missions):
    assert query(run_missions, project, ".", "--last", "10") == query(run_missions, project, ".")


def test_the_bound_applies_to_the_mission_path_form(project, run_missions):
    assert query(run_missions, project, "--mission", WEB, "--last", "1") == (
        f"live\t-\t{ROOT_A}\tAlpha Work\n"
        f"live\t-\t{WEB}\tForms\n"
        f"finished\t2026-03-03\t{ROOT_C}\tGamma Work\n"
    )


def test_the_unbounded_print_is_unchanged(project, run_missions):
    assert query(run_missions, project, ".") == (
        f"live\t-\t{ROOT_A}\tAlpha Work\n"
        f"live\t-\t{API}\tRate Limits\n"
        f"live\t-\t{WEB}\tForms\n"
        f"finished\t2026-03-04\t{API_TOO}\tCaching\n"
        f"finished\t2026-03-03\t{ROOT_C}\tGamma Work\n"
        f"finished\t2026-03-02\t{ROOT_D}\tDelta Work\n"
        f"finished\t2026-03-01\t{ROOT_B}\tBeta Work\n"
    )


def test_the_record_query_takes_no_bound(project, run_missions):
    result = run_missions(project, "record", ".", "--last", "1")
    assert result.returncode == 2
