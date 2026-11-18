"""The missions tool's live query: one line per live mission, ordered by path, each three
tab-separated fields (the mission path with its trailing slash, "started" or "defined" by the
path-scoped git log -1 --diff-filter=M test on its TASKS_TODO.md, and the title from the first
"# " heading of its requirements.md with whitespace folded, "-" when it has none), a live
mission being the directory of a tracked file matching the discovery pattern
**/mission_*/requirements.md that is present in the working tree, its name opening with
mission_, and no pattern read for any other form, a milestones/ container included. Given no
argument the query prints every live mission, and nothing, exiting 0, when no mission is
live; its MISSION_PATH filter is pinned in test_missions_live_filter.py. Every test runs on a
repository seeded through the conftest factory, then given commits made through the conftest
helper."""

import pytest

ALPHA = "mission_alpha/"
BETA = "mission_beta/"
REQUIREMENTS = b"# Alpha Work\n\n## Goal\n\nBuild the alpha.\n"
TODO = b"# TASKS TODO\n\n"


def mission_files(directory, title="Alpha Work", todo=True):
    files = {directory + "requirements.md": f"# {title}\n\n## Goal\n\nThe goal.\n".encode("utf-8")}
    if todo:
        files[directory + "TASKS_TODO.md"] = TODO
    return files


def live(run_missions, repo):
    result = run_missions(repo, "live")
    assert result.returncode == 0, result.stderr
    assert result.stderr == b""
    return result.stdout.decode("utf-8")


def test_a_line_is_path_state_and_title_tab_separated(repo, run_missions):
    seeded = repo({}, files={ALPHA + "requirements.md": REQUIREMENTS, ALPHA + "TASKS_TODO.md": TODO})
    assert live(run_missions, seeded) == f"{ALPHA}\tdefined\tAlpha Work\n"


def test_a_task_list_modified_after_the_commit_adding_it_reads_started(repo, make_commit, run_missions):
    seeded = repo({}, files={**mission_files(ALPHA), **mission_files(BETA, "Beta Work")})
    make_commit(seeded, "Task-derivation: mission_alpha/", files={ALPHA + "TASKS_TODO.md": TODO + b"## A Task\n"})
    assert live(run_missions, seeded) == f"{ALPHA}\tstarted\tAlpha Work\n{BETA}\tdefined\tBeta Work\n"


def test_a_mission_added_by_a_later_commit_still_reads_defined(repo, make_commit, run_missions):
    seeded = repo({}, files={"README.md": b"# A project\n"})
    make_commit(seeded, "Mission-definition: mission_alpha/", files=mission_files(ALPHA))
    assert live(run_missions, seeded) == f"{ALPHA}\tdefined\tAlpha Work\n"


def test_a_commit_changing_only_other_files_starts_nothing(repo, make_commit, run_missions):
    seeded = repo({}, files={**mission_files(ALPHA), **mission_files(BETA, "Beta Work")})
    make_commit(
        seeded,
        "Requirements-review: mission_alpha/",
        files={ALPHA + "requirements.md": REQUIREMENTS + b"\n## Decisions\n", "src/app.txt": b"one\n"},
    )
    make_commit(seeded, "Task-derivation: mission_beta/", files={BETA + "TASKS_TODO.md": TODO + b"## B Task\n"})
    assert live(run_missions, seeded) == f"{ALPHA}\tdefined\tAlpha Work\n{BETA}\tstarted\tBeta Work\n"


def test_a_mission_with_no_task_list_reads_defined(repo, run_missions):
    seeded = repo({}, files=mission_files(ALPHA, todo=False))
    assert live(run_missions, seeded) == f"{ALPHA}\tdefined\tAlpha Work\n"


@pytest.mark.parametrize(
    "directory",
    [
        "mission_alpha/",
        "pkg/mission_alpha/",
        "packages/api/mission_rate limits/",
        "a/mission_b/mission_c/",
    ],
)
def test_the_discovery_pattern_matches_a_mission_directory_at_any_depth(repo, run_missions, directory):
    seeded = repo({}, files=mission_files(directory))
    assert live(run_missions, seeded) == f"{directory}\tdefined\tAlpha Work\n"


@pytest.mark.parametrize(
    "name",
    [
        "requirements.md",
        "mission/requirements.md",
        "mission-alpha/requirements.md",
        "missions/alpha/requirements.md",
        "my_mission_alpha/requirements.md",
        "Mission_alpha/requirements.md",
        "mission_alpha/nested/requirements.md",
        "mission_alpha/requirements.md.bak",
        "mission_alpha/README.md",
        "milestones/alpha/requirements.md",
        "pkg/milestones/alpha/requirements.md",
    ],
)
def test_a_path_outside_the_discovery_pattern_is_not_a_mission(repo, run_missions, name):
    seeded = repo({}, files={name: REQUIREMENTS})
    assert live(run_missions, seeded) == ""


def test_lines_are_ordered_by_path(repo, run_missions):
    directories = ["pkg/mission_zeta/", "mission_beta/", "mission_alpha/", "docs/mission_gamma/"]
    files = {}
    for directory in directories:
        files.update(mission_files(directory))
    seeded = repo({}, files=files)
    printed = [line.split("\t")[0] for line in live(run_missions, seeded).splitlines()]
    assert printed == sorted(directories)


def test_an_untracked_requirements_file_is_not_live(repo, run_missions):
    seeded = repo({}, files=mission_files(ALPHA))
    (seeded / "mission_beta").mkdir()
    (seeded / "mission_beta" / "requirements.md").write_bytes(b"# Beta Work\n")
    assert live(run_missions, seeded) == f"{ALPHA}\tdefined\tAlpha Work\n"


def test_a_tracked_requirements_file_missing_from_the_working_tree_is_not_live(repo, run_missions):
    seeded = repo({}, files={**mission_files(ALPHA), **mission_files(BETA, "Beta Work")})
    (seeded / "mission_beta" / "requirements.md").unlink()
    assert live(run_missions, seeded) == f"{ALPHA}\tdefined\tAlpha Work\n"


def test_a_removed_mission_is_not_live_though_its_task_commits_remain(repo, make_commit, run_missions):
    seeded = repo({}, files={**mission_files(ALPHA), **mission_files(BETA, "Beta Work")})
    make_commit(seeded, "Task-completion: A Task", files={BETA + "TASKS_TODO.md": TODO + b"\n"})
    make_commit(
        seeded, "Mission-finish: mission_beta/", removed=(BETA + "requirements.md", BETA + "TASKS_TODO.md")
    )
    assert live(run_missions, seeded) == f"{ALPHA}\tdefined\tAlpha Work\n"
    tasks = run_missions(seeded, "tasks", BETA)
    assert tasks.returncode == 0, tasks.stderr


@pytest.mark.parametrize(
    "heading, title",
    [
        ("# Missions addressed by path", "Missions addressed by path"),
        ("# Mission planning", "Mission planning"),
        ("# Spaced \t title  here ", "Spaced title here"),
        ("# ", "-"),
        ("## Goal", "-"),
    ],
)
def test_the_title_is_the_first_heading_with_whitespace_folded(repo, run_missions, heading, title):
    seeded = repo({}, files={ALPHA + "requirements.md": f"{heading}\n\n## Goal\n\nThe goal.\n".encode("utf-8")})
    assert live(run_missions, seeded) == f"{ALPHA}\tdefined\t{title}\n"


def test_the_title_comes_from_the_first_top_level_heading_of_the_working_tree_file(repo, run_missions):
    seeded = repo({}, files={ALPHA + "requirements.md": b"Preamble line\n\n## Goal\n\n# First Title\n\n# Second\n"})
    assert live(run_missions, seeded) == f"{ALPHA}\tdefined\tFirst Title\n"
    (seeded / "mission_alpha" / "requirements.md").write_bytes(b"# Edited Title\n")
    assert live(run_missions, seeded) == f"{ALPHA}\tdefined\tEdited Title\n"


def test_a_requirements_file_with_no_heading_gets_the_placeholder_title(repo, run_missions):
    seeded = repo({}, files={ALPHA + "requirements.md": b"No heading at all.\n"})
    assert live(run_missions, seeded) == f"{ALPHA}\tdefined\t-\n"


def test_no_live_mission_prints_nothing(repo, run_missions):
    seeded = repo({}, files={"README.md": b"# A project\n", "answer_decision_principles.md": b"# P\n"})
    result = run_missions(seeded, "live")
    assert (result.returncode, result.stdout, result.stderr) == (0, b"", b"")
