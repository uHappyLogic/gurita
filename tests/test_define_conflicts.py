"""define_mission.py conflicts: the exclusive create of the mission directory is the only
check, anything already at that path refuses the call before a write, a title whose slug a
mission of the same scope already holds is refused, and the same slug stands in two scopes."""

import io
import sys

import define_mission

GOAL = b"Ship it.\n"
CONFLICT = b"Error: mission_same-title already exists; nothing was written\n"


def entries(root):
    return sorted(path.name for path in root.iterdir())


def test_a_file_at_the_computed_path_is_a_conflict(run_define, workspace):
    root = workspace("mission_one", files=("mission_same-title",))
    blocker = root / "mission_same-title"
    blocker.write_bytes(b"keep me")
    result = run_define("--at", ".", "--title", "Same title", stdin=GOAL, cwd=root)
    assert (result.returncode, result.stdout, result.stderr) == (1, b"", CONFLICT)
    assert blocker.read_bytes() == b"keep me"
    assert entries(root) == ["mission_one", "mission_same-title"]


def test_a_dangling_symlink_at_the_computed_path_is_a_conflict(run_define, workspace, tmp_path):
    root = workspace("mission_one")
    link = root / "mission_same-title"
    link.symlink_to(tmp_path / "missing")
    result = run_define("--at", ".", "--title", "Same title", stdin=GOAL, cwd=root)
    assert (result.returncode, result.stdout, result.stderr) == (1, b"", CONFLICT)
    assert link.is_symlink() and not (tmp_path / "missing").exists()
    assert entries(root) == ["mission_one", "mission_same-title"]


def test_a_symlink_to_a_file_at_the_computed_path_is_a_conflict(run_define, workspace, tmp_path):
    root = workspace("mission_one")
    target = tmp_path / "target.txt"
    target.write_bytes(b"untouched")
    (root / "mission_same-title").symlink_to(target)
    result = run_define("--at", ".", "--title", "Same title", stdin=GOAL, cwd=root)
    assert (result.returncode, result.stdout, result.stderr) == (1, b"", CONFLICT)
    assert target.read_bytes() == b"untouched"


def test_a_directory_at_the_computed_path_is_a_conflict(run_define, workspace):
    root = workspace("mission_one")
    existing = root / "mission_same-title"
    existing.mkdir()
    (existing / "requirements.md").write_bytes(b"theirs")
    result = run_define("--at", ".", "--title", "Same title", stdin=GOAL, cwd=root)
    assert (result.returncode, result.stdout, result.stderr) == (1, b"", CONFLICT)
    assert sorted(path.name for path in existing.iterdir()) == ["requirements.md"]
    assert (existing / "requirements.md").read_bytes() == b"theirs"


def test_defining_the_same_title_twice_in_one_scope_is_a_conflict(run_define, workspace):
    root = workspace()
    first = run_define("--at", ".", "--title", "Same title", stdin=GOAL, cwd=root)
    assert first.returncode == 0, first.stderr
    requirements = (root / "mission_same-title" / "requirements.md").read_bytes()
    second = run_define("--at", "./", "--title", "Same  TITLE", stdin=b"Another goal.\n", cwd=root)
    assert (second.returncode, second.stdout, second.stderr) == (1, b"", CONFLICT)
    assert (root / "mission_same-title" / "requirements.md").read_bytes() == requirements
    assert entries(root) == ["mission_same-title"]


def test_a_conflict_in_a_package_names_the_package_path(run_define, workspace):
    root = workspace()
    (root / "pkg" / "mission_same-title").mkdir(parents=True)
    result = run_define("--at", "pkg/", "--title", "Same title", stdin=GOAL, cwd=root)
    assert (result.returncode, result.stdout) == (1, b"")
    assert result.stderr == b"Error: pkg/mission_same-title already exists; nothing was written\n"
    assert list((root / "pkg" / "mission_same-title").iterdir()) == []


def test_a_directory_raced_in_before_the_exclusive_create_is_refused_and_never_removed(workspace, monkeypatch, capsys):
    root = workspace()
    real = define_mission.create_directory

    def race_then_create(directory):
        (root / "mission_same-title").mkdir()
        (root / "mission_same-title" / "requirements.md").write_bytes(b"theirs")
        return real(directory)

    monkeypatch.chdir(root)
    monkeypatch.setattr(sys, "stdin", io.TextIOWrapper(io.BytesIO(GOAL)))
    monkeypatch.setattr(define_mission, "create_directory", race_then_create)
    assert define_mission.main(["--at", ".", "--title", "Same title"]) == 1
    captured = capsys.readouterr()
    assert (captured.out, captured.err) == ("", CONFLICT.decode("utf-8"))
    assert entries(root) == ["mission_same-title"]
    assert (root / "mission_same-title" / "requirements.md").read_bytes() == b"theirs"


def test_the_same_slug_in_two_scopes_is_not_a_conflict(run_define, workspace):
    root = workspace("mission_same-title")
    (root / "pkg").mkdir()
    result = run_define("--at", "pkg", "--title", "Same title", stdin=GOAL, cwd=root)
    assert result.returncode == 0, result.stderr
    assert entries(root) == ["mission_same-title", "pkg"]
    assert (root / "pkg" / "mission_same-title" / "requirements.md").is_file()


def test_a_directory_holding_the_slug_without_the_prefix_is_not_a_conflict(run_define, workspace):
    root = workspace("same-title", "mission_03_same-title")
    result = run_define("--at", ".", "--title", "Same title", stdin=GOAL, cwd=root)
    assert result.returncode == 0, result.stderr
    assert entries(root) == ["mission_03_same-title", "mission_same-title", "same-title"]
