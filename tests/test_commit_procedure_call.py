"""The shared commit procedure's one shell call, as the committed Claude Code tree renders it: the
one fenced block of the procedure file running the commit tool, which captures BODY from a quoted
heredoc in the group-fed form and passes it on as `--body "$body"`. The call is filled as a runner
following the procedure fills it (the subject, the body's lines between the heredoc's two lines,
each removal after its own `--remove`, and the paths after `--`) and run in a temporary git
repository seeded through the conftest factory, under bash and, where it is installed, zsh. A body
holding a backtick, a `$`, a `"`, an apostrophe, and a backslash, written with nothing escaped,
reaches the commit as written and runs nothing; a call whose caller supplies no BODY, the capture
and `--body "$body"` both left out, makes a subject-only commit; and a removal rides in the same
commit as the body. The commit tool's own body handling is tested in test_commit_contract.py."""

import re
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
PROCEDURE = REPO_ROOT / "hosts" / "claude" / "shared" / "commit-procedure.md"

COMMIT_COMMAND = "/tools/commit.py "
CAPTURE_LINE = "{ body=\"$(cat)\"; } <<'EOF' &&"
COMMIT_LINE = (
    'python3 ${CLAUDE_PLUGIN_ROOT}/tools/commit.py --subject "<SUBJECT>" --body "$body" '
    "--remove <REMOVAL> -- <PATHS>"
)
BODY_ARGUMENT = ' --body "$body"'
REMOVAL_ARGUMENT = " --remove <REMOVAL>"

MISSION = "mission_commit-procedure-fixture/"
SUBJECT = "Mission-finish: " + MISSION

# A finish body as finish-mission composes it, every character a double-quoted argument would
# have expanded or ended on included: a backtick pair holding a command, a `$( )` and a `$name`,
# a double quote, an apostrophe, and a backslash.
BODY = [
    "Commit procedure fixture",
    "",
    "- `touch pwned` names a file the summary only mentions",
    "- `$(touch pwned)` and $HOME stay as written",
    '- the "quoted" word and the user\'s apostrophe survive',
    "- a backslash \\n stays two characters",
]

SHELLS = [shell for shell in ("bash", "zsh") if shutil.which(shell)]


def fenced_blocks(text):
    """Every fenced block of a Markdown file, as the list of its lines between the fences."""
    blocks, current = [], None
    for line in text.splitlines():
        if current is None:
            if line.startswith("```"):
                current = []
        elif line.strip() == "```":
            blocks.append(current)
            current = None
        else:
            current.append(line)
    assert current is None, "an unclosed fence in the procedure file"
    return blocks


def fixed_call():
    """The one fence of the rendered procedure file running the commit tool."""
    holding = [block for block in fenced_blocks(PROCEDURE.read_text(encoding="utf-8")) if any(COMMIT_COMMAND in line for line in block)]
    assert len(holding) == 1, f"{len(holding)} fences of the procedure file run the commit tool, not one"
    return holding[0]


def procedure_call(body=BODY, paths=(), removals=()):
    """The call written out as a runner following the procedure writes it: the body's lines in
    place of `<BODY>`, or the capture and `--body "$body"` left out when there is no body; one
    `--remove` per removal, or none; and the paths after `--`, or `-- <PATHS>` left out when
    there are none."""
    lines = list(fixed_call())
    capture = lines.index(CAPTURE_LINE)
    eof = lines.index("EOF")
    if body is None:
        lines = lines[:capture] + lines[eof + 1 :]
    else:
        lines = lines[: capture + 1] + list(body) + lines[eof:]
    command = lines[-1]
    if body is None:
        command = command.replace(BODY_ARGUMENT, "")
    command = command.replace(REMOVAL_ARGUMENT, "".join(f" --remove {path}" for path in removals))
    command = command.replace(" -- <PATHS>", (" -- " + " ".join(paths)) if paths else "")
    command = command.replace("<SUBJECT>", SUBJECT)
    lines[-1] = command
    call = "\n".join(lines) + "\n"
    assert not re.search(r"<[A-Z][A-Z]*>", call), "a placeholder is left unfilled"
    return call


def run(shell, cwd, env, call):
    result = subprocess.run(
        [shell, "-c", call], cwd=str(cwd), env=env, stdin=subprocess.DEVNULL, capture_output=True, check=False
    )
    return result.returncode, result.stdout.decode("utf-8"), result.stderr.decode("utf-8")


def message(git, project, environment):
    """HEAD's whole commit message as git stored it: the subject, then a blank line and the body."""
    return git(project, environment, "cat-file", "commit", "HEAD").split("\n\n", 1)[1]


def committed(git, project, environment):
    return sorted(git(project, environment, "show", "--name-only", "--format=", "HEAD").split())


@pytest.fixture
def project(repo):
    """A repository whose one commit holds a mission directory and a context file, the context
    file then edited as a finish's lasting-changes edit."""
    root = repo(
        {},
        files={
            MISSION + "requirements.md": b"# Commit procedure fixture\n",
            MISSION + "TASKS_TODO.md": b"# TASKS TODO\n",
            "CLAUDE.md": b"# Context\n",
        },
    )
    (root / "CLAUDE.md").write_bytes(b"# Context\n\nA lasting change.\n")
    return root


# --- the template as the rendered tree holds it ---------------------------------------------


def test_the_call_captures_the_body_from_a_quoted_heredoc_and_passes_it_on_quoted():
    assert fixed_call() == [CAPTURE_LINE, "<BODY>", "EOF", COMMIT_LINE]


# --- the call run under each shell ----------------------------------------------------------


@pytest.mark.parametrize("shell", SHELLS)
def test_a_body_holding_shell_syntax_is_committed_as_written_and_runs_nothing(project, environment, git, shell):
    status, stdout, stderr = run(shell, project, environment, procedure_call(paths=("CLAUDE.md",)))
    assert (status, stdout, stderr) == (0, "", "")
    assert message(git, project, environment) == SUBJECT + "\n\n" + "\n".join(BODY) + "\n"
    assert committed(git, project, environment) == ["CLAUDE.md"]
    assert not (project / "pwned").exists(), "the body ran a command"


@pytest.mark.parametrize("shell", SHELLS)
def test_a_removal_rides_in_the_same_commit_as_the_body(project, environment, git, shell):
    status, stdout, stderr = run(shell, project, environment, procedure_call(paths=("CLAUDE.md",), removals=(MISSION,)))
    assert (status, stdout, stderr) == (0, "", "")
    assert message(git, project, environment) == SUBJECT + "\n\n" + "\n".join(BODY) + "\n"
    assert committed(git, project, environment) == sorted(["CLAUDE.md", MISSION + "TASKS_TODO.md", MISSION + "requirements.md"])
    assert not (project / MISSION).exists()
    assert not (project / "pwned").exists()


@pytest.mark.parametrize("shell", SHELLS)
def test_a_call_with_no_body_leaves_out_the_capture_and_commits_subject_only(project, environment, git, shell):
    call = procedure_call(body=None, paths=("CLAUDE.md",))
    assert "<<'EOF'" not in call and "$body" not in call
    status, stdout, stderr = run(shell, project, environment, call)
    assert (status, stdout, stderr) == (0, "", "")
    assert message(git, project, environment) == SUBJECT + "\n"
    assert committed(git, project, environment) == ["CLAUDE.md"]
