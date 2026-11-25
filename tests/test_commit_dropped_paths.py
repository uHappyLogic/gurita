"""The commit tool records a named path that `git rm` or `git mv` already took out of the index:
ahead of the path-scoped `git add` it asks git, through a read with optional locks off, which
named paths the index or the working tree still holds, stages only those, skips the add when
none is left, and keeps every named path in the commit's pathspec, which git matches against
HEAD as well as the index. Before the change, `git add` of such a path exited 128 on every
attempt of the retry schedule and the call ended on its `Error:` line with nothing committed. A
path git knows nowhere is still refused, at the commit, with git's exit 1 and no repeat."""

import time

import pytest

import commit

WINDOW = (commit.ATTEMPTS - 1) * commit.PAUSE

FILES = {"README.md": b"# A project\n", "notes/a.md": b"a\n", "notes/b.md": b"b\n"}


@pytest.fixture
def project(repo):
    """A repository whose initial commit holds README.md, notes/a.md, and notes/b.md."""
    return repo({}, files=dict(FILES))


def changes(git, root, environment):
    """The HEAD commit's changes as sorted name-status lines, renames shown as a removal and
    an addition."""
    output = git(root, environment, "show", "--no-renames", "--name-status", "--format=", "HEAD")
    return sorted(line for line in output.split("\n") if line)


def head(git, root, environment):
    return git(root, environment, "rev-parse", "HEAD").strip()


def staged(git, root, environment):
    output = git(root, environment, "diff", "-z", "--cached", "--name-only")
    return sorted(name for name in output.split("\0") if name)


def traced(environment, tmp_path):
    """The environment with git's trace written to a file: -> (the environment, a function
    returning the git subcommands the tool ran, in order)."""
    trace = tmp_path / "git-trace.log"
    env = dict(environment, GIT_TRACE=str(trace))

    def subcommands():
        if not trace.exists():
            return []
        found = []
        for line in trace.read_text(encoding="utf-8").splitlines():
            if "built-in: git " not in line:
                continue
            words = line.split("built-in: git ", 1)[1].split()
            found.append(next(word for word in words if not word.startswith("-")))
        return found

    return env, subcommands


def assert_landed(result, started):
    assert (result.returncode, result.stdout, result.stderr) == (0, b"", b"")
    assert time.monotonic() - started < WINDOW, "a git write was repeated"


def test_a_path_git_rm_took_out_of_the_index_is_committed_as_its_removal(run_commit, project, git, environment):
    before = head(git, project, environment)
    git(project, environment, "rm", "-q", "--", "notes/b.md")
    started = time.monotonic()
    result = run_commit(project, "--subject", "Task-completion: Remove b", "--", "notes/b.md")
    assert_landed(result, started)
    assert git(project, environment, "rev-parse", "HEAD~1").strip() == before
    assert changes(git, project, environment) == ["D\tnotes/b.md"]
    assert git(project, environment, "status", "--porcelain") == ""


def test_both_paths_of_a_git_mv_are_committed_as_the_move(run_commit, project, git, environment):
    git(project, environment, "mv", "--", "notes/a.md", "notes/c.md")
    started = time.monotonic()
    result = run_commit(project, "--subject", "Task-completion: Move a", "--", "notes/a.md", "notes/c.md")
    assert_landed(result, started)
    assert changes(git, project, environment) == ["A\tnotes/c.md", "D\tnotes/a.md"]
    assert git(project, environment, "show", "--format=", "HEAD:notes/c.md") == "a\n"
    assert git(project, environment, "status", "--porcelain") == ""


def test_a_moved_then_edited_file_and_a_removal_land_together_from_a_path_file(run_commit, project, git, environment, tmp_path):
    git(project, environment, "mv", "--", "notes/a.md", "notes/c.md")
    (project / "notes" / "c.md").write_bytes(b"a, moved and edited\n")
    git(project, environment, "rm", "-q", "--", "notes/b.md")
    (project / "README.md").write_bytes(b"# An edited project\n")
    path_file = tmp_path / "paths.txt"
    path_file.write_bytes(b"README.md\nnotes/a.md\nnotes/c.md\nnotes/b.md\n")
    started = time.monotonic()
    result = run_commit(project, "--subject", "Task-completion: Rework notes", "--path-file", str(path_file))
    assert_landed(result, started)
    assert changes(git, project, environment) == ["A\tnotes/c.md", "D\tnotes/a.md", "D\tnotes/b.md", "M\tREADME.md"]
    assert git(project, environment, "show", "--format=", "HEAD:notes/c.md") == "a, moved and edited\n"
    assert git(project, environment, "status", "--porcelain") == ""


def test_the_add_is_skipped_when_no_named_path_is_still_held(run_commit, project, git, environment, tmp_path):
    git(project, environment, "rm", "-q", "--", "notes/a.md", "notes/b.md")
    env, subcommands = traced(environment, tmp_path)
    result = run_commit(project, "--subject", "Only removals", "--", "notes/a.md", "notes/b.md", env=env)
    assert (result.returncode, result.stdout, result.stderr) == (0, b"", b"")
    ran = subcommands()
    assert "add" not in ran
    assert ran.count("ls-files") == 2
    assert ran.count("commit") == 1
    assert changes(git, project, environment) == ["D\tnotes/a.md", "D\tnotes/b.md"]


def test_the_add_names_only_the_held_paths(run_commit, project, git, environment, tmp_path):
    git(project, environment, "rm", "-q", "--", "notes/b.md")
    (project / "notes" / "a.md").write_bytes(b"a changed\n")
    env, _ = traced(environment, tmp_path)
    result = run_commit(project, "--subject", "Mixed", "--", "notes/a.md", "notes/b.md", env=env)
    assert (result.returncode, result.stdout, result.stderr) == (0, b"", b"")
    trace = (tmp_path / "git-trace.log").read_text(encoding="utf-8")
    adds = [line.split("built-in: ", 1)[1] for line in trace.splitlines() if "built-in: git add" in line]
    assert adds == ["git add -- notes/a.md"] or adds == ["git --literal-pathspecs add -- notes/a.md"]
    assert changes(git, project, environment) == ["D\tnotes/b.md", "M\tnotes/a.md"]


def test_a_path_git_knows_nowhere_is_still_refused_at_the_commit_with_exit_1(run_commit, project, git, environment):
    before = head(git, project, environment)
    (project / "notes" / "a.md").write_bytes(b"a changed\n")
    started = time.monotonic()
    result = run_commit(project, "--subject", "Mistyped", "--", "notes/a.md", "notes/mistyped.md")
    elapsed = time.monotonic() - started
    assert result.returncode == 1
    assert result.stdout == b""
    lines = result.stderr.decode("utf-8").split("\n")
    assert len(lines) == 2 and lines[1] == ""
    assert lines[0].startswith("Error: git commit exited 1: ")
    assert "notes/mistyped.md" in lines[0]
    assert b"Traceback" not in result.stderr
    assert elapsed < WINDOW
    assert head(git, project, environment) == before
    assert staged(git, project, environment) == ["notes/a.md"]
