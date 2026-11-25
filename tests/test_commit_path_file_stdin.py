"""The commit tool's path-file reader takes `-` for standard input: `--path-file -` reads the
path list from stdin by the same line-exact rule as a file (split at newlines only, each line
one whole path, blank lines skipped, the last line needing no newline), so a caller feeding it
from a quoted heredoc puts no path on its command line and a path holding a space or shell
syntax reaches git as written. An empty, blank-only, or non-UTF-8 stdin is refused with one
Error: line and nothing recorded, a file named `-` is never read in its place, and a no-op
prints the tool's one fixed line."""

import subprocess
import sys
from pathlib import Path

import pytest

COMMIT_TOOL = Path(__file__).resolve().parent.parent / "core" / "tools" / "commit.py"

NO_OP_LINE = "Nothing committed — none of the paths changed.\n".encode("utf-8")

FILES = {"README.md": b"# A project\n", "notes/a.md": b"a\n", "notes/b.md": b"b\n"}

# A path the command line would break: a space, an apostrophe, a command substitution, a
# backtick, a double quote, and glob characters.
SHELL_SYNTAX = "notes/User Guide/it's $(touch pwned) `touch pwned` \"q\" [x]*.md"


@pytest.fixture
def project(repo):
    """A repository whose initial commit holds README.md, notes/a.md, and notes/b.md."""
    return repo({}, files=dict(FILES))


def run_stdin(environment, cwd, stdin, *args):
    """Run the commit tool with `--path-file -`, the given bytes on its standard input."""
    return subprocess.run(
        [sys.executable, "-B", str(COMMIT_TOOL), *args, "--path-file", "-"],
        cwd=str(cwd),
        env=environment,
        input=stdin,
        capture_output=True,
        check=False,
    )


def committed(git, root, environment):
    output = git(root, environment, "show", "-z", "--name-only", "--format=", "HEAD")
    return sorted(name for name in output.split("\0") if name.strip())


def head(git, root, environment):
    return git(root, environment, "rev-parse", "HEAD").strip()


def assert_landed(result):
    assert (result.returncode, result.stdout, result.stderr) == (0, b"", b"")


def test_stdin_is_read_one_whole_line_per_path(project, git, environment):
    (project / "notes" / "a.md").write_bytes(b"a changed\n")
    (project / "notes" / "b.md").write_bytes(b"b changed\n")
    (project / "notes" / "with two  spaces.md").write_bytes(b"new\n")
    (project / "README.md").write_bytes(b"# An edited project\n")
    stdin = b"notes/a.md\n\nnotes/with two  spaces.md\nnotes/b.md"
    result = run_stdin(environment, project, stdin, "--subject", "From stdin")
    assert_landed(result)
    assert committed(git, project, environment) == ["notes/a.md", "notes/b.md", "notes/with two  spaces.md"]
    assert git(project, environment, "status", "--porcelain").splitlines() == [" M README.md"]


def test_a_path_holding_a_space_and_shell_syntax_is_committed_as_written(project, git, environment):
    target = project / SHELL_SYNTAX
    target.parent.mkdir(parents=True)
    target.write_bytes(b"a guide page\n")
    (project / "notes" / "xy.md").write_bytes(b"matched by the pattern, never by the path\n")
    result = run_stdin(environment, project, (SHELL_SYNTAX + "\n").encode("utf-8"), "--subject", "Shell syntax")
    assert_landed(result)
    assert committed(git, project, environment) == [SHELL_SYNTAX]
    assert not (project / "pwned").exists()
    assert git(project, environment, "status", "--porcelain", "--", "notes/xy.md") == "?? notes/xy.md\n"


def test_a_body_and_a_heredoc_fed_list_land_together_under_bash(project, git, environment, run_call):
    (project / "notes" / "a.md").write_bytes(b"a changed\n")
    target = project / SHELL_SYNTAX
    target.parent.mkdir(parents=True)
    target.write_bytes(b"a guide page\n")
    call = (
        f'{{ out="$({sys.executable} -B {COMMIT_TOOL} --subject "Heredoc" --body "- a bullet" --path-file -)"; }} <<\'EOF\' &&\n'
        f"notes/a.md\n{SHELL_SYNTAX}\nEOF\n"
        'if [ -z "$out" ]; then\n  echo landed\nfi\n'
    )
    status, stdout, stderr = run_call(project, environment, call)
    assert (status, stdout, stderr) == (0, "landed\n", "")
    assert committed(git, project, environment) == sorted(["notes/a.md", SHELL_SYNTAX])
    assert not (project / "pwned").exists()


def test_a_file_named_dash_is_never_read_in_place_of_stdin(project, git, environment):
    (project / "notes" / "a.md").write_bytes(b"a changed\n")
    (project / "notes" / "b.md").write_bytes(b"b changed\n")
    (project / "-").write_bytes(b"notes/b.md\n")
    result = run_stdin(environment, project, b"notes/a.md\n", "--subject", "Stdin wins")
    assert_landed(result)
    assert committed(git, project, environment) == ["notes/a.md"]


def test_a_no_op_through_stdin_prints_the_one_line(project, git, environment):
    before = head(git, project, environment)
    result = run_stdin(environment, project, b"README.md\nnotes/a.md\n", "--subject", "Nothing")
    assert (result.returncode, result.stdout, result.stderr) == (0, NO_OP_LINE, b"")
    assert head(git, project, environment) == before


@pytest.mark.parametrize(
    "data, reason",
    [(b"", b"names no path"), (b"\n\n\n", b"names no path"), (b"README\xff.md\n", b"is not UTF-8 text")],
    ids=["empty", "blank-lines-only", "not-utf8"],
)
def test_stdin_naming_no_usable_path_is_refused(project, git, environment, data, reason):
    before = head(git, project, environment)
    (project / "README.md").write_bytes(b"# A changed project\n")
    result = run_stdin(environment, project, data, "--subject", "Bad stdin")
    assert result.returncode == 1 and result.stdout == b""
    lines = result.stderr.split(b"\n")
    assert len(lines) == 2 and lines[1] == b"" and lines[0].startswith(b"Error: the path list on standard input ")
    assert reason in result.stderr
    assert head(git, project, environment) == before
    assert git(project, environment, "diff", "--cached", "--name-only") == ""


def test_stdin_and_path_arguments_together_are_a_usage_error(project, git, environment):
    (project / "README.md").write_bytes(b"# A changed project\n")
    result = subprocess.run(
        [sys.executable, "-B", str(COMMIT_TOOL), "--subject", "Both", "--path-file", "-", "README.md"],
        cwd=str(project),
        env=environment,
        input=b"README.md\n",
        capture_output=True,
        check=False,
    )
    assert result.returncode == 2
    assert b"not both" in result.stderr


def test_the_help_states_the_stdin_form(environment, tmp_path):
    result = subprocess.run(
        [sys.executable, "-B", str(COMMIT_TOOL), "--help"],
        cwd=str(tmp_path),
        env=environment,
        stdin=subprocess.DEVNULL,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0
    assert b"'-' for standard input" in b" ".join(result.stdout.split())
