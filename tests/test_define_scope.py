"""define_mission.py placement: the required --at scope, normalized lexically and printed in its
canonical repo-relative form, the root spelled "." or "./"; an empty, absolute, or climbing scope
and one missing from the working tree or not a directory refused on one Error line naming it as
given; the mission directory created directly in the scope, with no container and nothing else;
and no number, the directory named mission_ and its slug alone."""

import os

import pytest

import define_mission

GOAL = b"Ship it.\n"


def printed(result):
    """The two printed lines of a successful call: (subject, path)."""
    assert result.returncode == 0, result.stderr
    assert result.stderr == b""
    subject, path = result.stdout.decode("utf-8").splitlines()
    return subject, path


def tree(root):
    """Every path under root, relative and sorted, directories with a trailing slash."""
    entries = []
    for directory, names, files in os.walk(root):
        relative = os.path.relpath(directory, root)
        for name in names:
            entries.append(os.path.normpath(os.path.join(relative, name)) + "/")
        for name in files:
            entries.append(os.path.normpath(os.path.join(relative, name)))
    return sorted(entries)


# --- the canonical path -----------------------------------------------------------------


@pytest.mark.parametrize("scope", [".", "./", ".//", "./.", "pkg/..", "pkg/sub/../.."])
def test_every_spelling_of_the_root_prints_the_root_mission_path(run_define, workspace, scope):
    root = workspace()
    (root / "pkg" / "sub").mkdir(parents=True)
    subject, path = printed(run_define("--at", scope, "--title", "Root work", stdin=GOAL, cwd=root))
    assert (subject, path) == ("Mission-definition: mission_root-work/", "mission_root-work/")
    assert (root / "mission_root-work" / "requirements.md").is_file()


@pytest.mark.parametrize(
    "scope",
    [
        "packages/ledger",
        "packages/ledger/",
        "./packages/ledger",
        "packages//ledger",
        "./packages/./ledger//",
        "packages/other/../ledger",
    ],
)
def test_every_spelling_of_a_package_prints_one_canonical_path(run_define, workspace, scope):
    root = workspace()
    (root / "packages" / "ledger").mkdir(parents=True)
    (root / "packages" / "other").mkdir()
    subject, path = printed(run_define("--at", scope, "--title", "Ledger import", stdin=GOAL, cwd=root))
    assert path == "packages/ledger/mission_ledger-import/"
    assert subject == "Mission-definition: " + path
    assert (root / path / "requirements.md").is_file()


def test_the_printed_path_is_the_directory_the_files_were_written_into(run_define, workspace):
    root = workspace()
    (root / "a" / "b" / "c").mkdir(parents=True)
    _, path = printed(run_define("--at", "a/b/c", "--title", "Deep core", stdin=GOAL, cwd=root))
    assert path == "a/b/c/mission_deep-core/"
    assert sorted(entry.name for entry in (root / path).iterdir()) == ["TASKS_TODO.md", "open_questions.xml", "requirements.md"]
    assert tree(root) == [
        "a/",
        "a/b/",
        "a/b/c/",
        "a/b/c/mission_deep-core/",
        "a/b/c/mission_deep-core/TASKS_TODO.md",
        "a/b/c/mission_deep-core/open_questions.xml",
        "a/b/c/mission_deep-core/requirements.md",
    ]


@pytest.mark.parametrize(
    ("value", "scope"),
    [
        (".", "."),
        ("./", "."),
        ("pkg", "pkg"),
        ("pkg/", "pkg"),
        ("./pkg", "pkg"),
        ("pkg//sub///", "pkg/sub"),
        ("./pkg/./sub/.", "pkg/sub"),
        ("pkg/..", "."),
        ("a/b/../c", "a/c"),
        ("a space/b", "a space/b"),
    ],
)
def test_normalize_scope_collapses_lexically(value, scope):
    assert define_mission.normalize_scope(value) == scope


def test_normalization_reads_no_filesystem(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    assert define_mission.normalize_scope("nowhere/../at/./all/") == "at/all"
    assert list(tmp_path.iterdir()) == []


# --- refusals -----------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("scope", "reason"),
    [
        ("", "the scope given as --at is empty"),
        ("/", "the scope / given as --at is an absolute path; name a directory relative to the workspace root"),
        ("/tmp", "the scope /tmp given as --at is an absolute path; name a directory relative to the workspace root"),
        ("//pkg", "the scope //pkg given as --at is an absolute path; name a directory relative to the workspace root"),
        ("..", "the scope .. given as --at climbs out of the workspace root with .."),
        ("../", "the scope ../ given as --at climbs out of the workspace root with .."),
        ("../elsewhere", "the scope ../elsewhere given as --at climbs out of the workspace root with .."),
        ("pkg/../..", "the scope pkg/../.. given as --at climbs out of the workspace root with .."),
        ("./pkg/../../pkg", "the scope ./pkg/../../pkg given as --at climbs out of the workspace root with .."),
    ],
)
def test_an_empty_absolute_or_climbing_scope_is_refused_naming_it_as_given(run_define, workspace, scope, reason):
    root = workspace()
    (root / "pkg").mkdir()
    result = run_define("--at", scope, "--title", "First", stdin=GOAL, cwd=root)
    assert (result.returncode, result.stdout) == (1, b"")
    assert result.stderr == f"Error: {reason}\n".encode("utf-8")
    assert tree(root) == ["pkg/"]


@pytest.mark.parametrize("scope", ["missing", "missing/", "./pkg/missing", "pkg//missing/./"])
def test_a_scope_missing_from_the_working_tree_is_refused_naming_it_as_given(run_define, workspace, scope):
    root = workspace()
    (root / "pkg").mkdir()
    result = run_define("--at", scope, "--title", "First", stdin=GOAL, cwd=root)
    assert (result.returncode, result.stdout) == (1, b"")
    assert result.stderr == (
        f"Error: the scope {scope} given as --at does not exist in the working tree; nothing was written\n".encode("utf-8")
    )
    assert tree(root) == ["pkg/"]


def test_a_scope_naming_a_file_is_refused_naming_it_as_given(run_define, workspace):
    root = workspace()
    (root / "pkg").mkdir()
    (root / "pkg" / "module.py").write_bytes(b"code")
    result = run_define("--at", "./pkg/module.py", "--title", "First", stdin=GOAL, cwd=root)
    assert (result.returncode, result.stdout) == (1, b"")
    assert result.stderr == b"Error: the scope ./pkg/module.py given as --at is not a directory; nothing was written\n"
    assert tree(root) == ["pkg/", "pkg/module.py"]


def test_a_scope_that_is_a_dangling_symlink_is_refused(run_define, workspace, tmp_path):
    root = workspace()
    (root / "gone").symlink_to(tmp_path / "missing")
    result = run_define("--at", "gone", "--title", "First", stdin=GOAL, cwd=root)
    assert (result.returncode, result.stdout) == (1, b"")
    assert result.stderr == b"Error: the scope gone given as --at is not a directory; nothing was written\n"
    assert not (tmp_path / "missing").exists()


def test_a_scope_that_is_a_symlink_to_a_directory_is_accepted(run_define, workspace, tmp_path):
    root = workspace()
    target = tmp_path / "real"
    target.mkdir()
    (root / "linked").symlink_to(target, target_is_directory=True)
    _, path = printed(run_define("--at", "linked", "--title", "Linked core", stdin=GOAL, cwd=root))
    assert path == "linked/mission_linked-core/"
    assert (target / "mission_linked-core" / "requirements.md").is_file()


def test_the_scope_is_never_created(run_define, workspace):
    root = workspace()
    result = run_define("--at", "packages/new-core", "--title", "First", stdin=GOAL, cwd=root)
    assert result.returncode == 1
    assert list(root.iterdir()) == []


# --- no container -----------------------------------------------------------------------


def test_a_root_mission_stands_directly_in_the_root(run_define, workspace):
    root = workspace()
    _, path = printed(run_define("--at", ".", "--title", "First", stdin=GOAL, cwd=root))
    assert path == "mission_first/"
    assert tree(root) == [
        "mission_first/",
        "mission_first/TASKS_TODO.md",
        "mission_first/open_questions.xml",
        "mission_first/requirements.md",
    ]


def test_a_package_mission_stands_directly_in_the_package_and_nothing_else_is_created(run_define, workspace):
    root = workspace()
    (root / "pkg").mkdir()
    (root / "pkg" / "module.py").write_bytes(b"code")
    printed(run_define("--at", "pkg", "--title", "First", stdin=GOAL, cwd=root))
    assert tree(root) == [
        "pkg/",
        "pkg/mission_first/",
        "pkg/mission_first/TASKS_TODO.md",
        "pkg/mission_first/open_questions.xml",
        "pkg/mission_first/requirements.md",
        "pkg/module.py",
    ]


def test_the_scope_keeps_everything_already_in_it(run_define, workspace):
    root = workspace("mission_live-one", files=("answer_decision_principles.md",))
    printed(run_define("--at", ".", "--title", "Second", stdin=GOAL, cwd=root))
    assert sorted(entry.name for entry in root.iterdir()) == [
        "answer_decision_principles.md",
        "mission_live-one",
        "mission_second",
    ]


# --- no number ----------------------------------------------------------------------------


def test_the_directory_is_named_by_the_slug_alone(run_define, workspace):
    root = workspace("mission_07_seven", "mission_99_last")
    subject, path = printed(run_define("--at", ".", "--title", "Next", stdin=GOAL, cwd=root))
    assert (subject, path) == ("Mission-definition: mission_next/", "mission_next/")
    assert sorted(entry.name for entry in root.iterdir()) == ["mission_07_seven", "mission_99_last", "mission_next"]


def test_the_heading_carries_the_title_alone(run_define, workspace):
    root = workspace("mission_06_six")
    printed(run_define("--at", ".", "--title", "Seventh", stdin=GOAL, cwd=root))
    requirements = (root / "mission_seventh" / "requirements.md").read_text(encoding="utf-8")
    assert requirements.startswith("# Seventh\n\n## Goal\n")


def test_two_scopes_take_two_missions(run_define, workspace):
    root = workspace()
    (root / "app").mkdir()
    (root / "lib").mkdir()
    first = printed(run_define("--at", "app", "--title", "Parser rework", stdin=GOAL, cwd=root))
    second = printed(run_define("--at", "lib", "--title", "Parser rework", stdin=GOAL, cwd=root))
    third = printed(run_define("--at", ".", "--title", "Parser rework", stdin=GOAL, cwd=root))
    assert [path for _, path in (first, second, third)] == [
        "app/mission_parser-rework/",
        "lib/mission_parser-rework/",
        "mission_parser-rework/",
    ]
