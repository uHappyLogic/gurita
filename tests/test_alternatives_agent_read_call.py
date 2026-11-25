"""The alternatives agent's one read call, as the committed Claude Code tree renders it: the one
fenced block of the agent file holding `locate`, which runs `locate` on the agent's own Short
Title, a quoted `printf` separator line, and `list --with-question`. The call is filled with only
<MISSION_DIR> and the Short Title replaced, against a copy of the bare fixture mission, and run
under bash and, where it is installed, zsh, with the tree's plugin-root variable exported to the
tree root. The call writes nothing, so no git repository is needed. Its print is asserted to be
exactly the block `locate` prints, the separator line, and the `list --with-question` print, and
a title the document lacks to stop on the tool's `Error:` line with nothing else printed.

The separator failure the call replaced is reproduced beside it: the same call with its
`printf` line swapped for a bare `echo =====`, the separator runners wrote when they joined the
two reads themselves, loses the second read under zsh, which reads a word opening with `=` as
a command lookup and abandons the rest of the line."""

import os
import re
import shlex
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
TREE = REPO_ROOT / "hosts" / "claude"
AGENT = TREE / "agents" / "provide-alternatives-to-open-question.md"
PLUGIN_ROOT_VARIABLE = "CLAUDE_PLUGIN_ROOT"
TOOL = TREE / "tools" / "open_questions.py"
FIXTURE = Path(__file__).resolve().parent / "fixtures" / "bare"

LOCATE_COMMAND = "/tools/open_questions.py locate "
LIST_COMMAND = "/tools/open_questions.py list --with-question "
SEPARATOR_LINE = "printf '%s\\n' '--- sibling scope ---' &&"
SEPARATOR_PRINT = "--- sibling scope ---\n"
BARE_SEPARATOR_LINE = "echo ===== &&"

# <MISSION_DIR> as the orchestrator passes it: the resolved path, its trailing slash included.
MISSION = "mission_golden-bare/"
TITLE = "Second bare question"

SHELLS = [shell for shell in ("bash", "zsh") if shutil.which(shell)]


# --- extracting the call ----------------------------------------------------------------------


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
    assert current is None, "an unclosed fence in the agent file"
    return blocks


def read_call():
    """The one fence of the rendered agent file holding `locate`."""
    text = AGENT.read_text(encoding="utf-8")
    holding = [block for block in fenced_blocks(text) if any(LOCATE_COMMAND in line for line in block)]
    assert len(holding) == 1, f"{len(holding)} fences of the agent file hold locate, not one"
    return holding[0]


def filled(lines, mission, title):
    """The call written out with only <MISSION_DIR> and the Short Title replaced."""
    return "\n".join(lines).replace("<MISSION_DIR>", mission).replace("<Short Title>", title) + "\n"


# --- the environment and the run --------------------------------------------------------------


@pytest.fixture
def environment(tmp_path):
    """The call's environment: the tree's plugin-root variable exported to the tree root,
    `python3` resolving to the interpreter running the suite (so each pytest run drives the
    rendered tools under its own interpreter), no bytecode written into the tree, and no
    startup file read by either non-interactive shell."""
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    wrapper = bin_dir / "python3"
    wrapper.write_text(f'#!/bin/sh\nexec {shlex.quote(sys.executable)} "$@"\n', encoding="utf-8")
    wrapper.chmod(0o755)
    home = tmp_path / "home"
    home.mkdir()
    env = dict(os.environ)
    for name in ("BASH_ENV", "ENV", "ZDOTDIR"):
        env.pop(name, None)
    env.update(
        {
            PLUGIN_ROOT_VARIABLE: str(TREE),
            "PATH": str(bin_dir) + os.pathsep + env.get("PATH", ""),
            "PYTHONDONTWRITEBYTECODE": "1",
            "HOME": str(home),
        }
    )
    return env


@pytest.fixture
def project(tmp_path):
    """A project directory holding a copy of the bare fixture mission at MISSION."""
    root = tmp_path / "project"
    shutil.copytree(FIXTURE, root / MISSION)
    return root


def run_call(shell, cwd, env, call):
    command = [shell, "-f", "-c", call] if shell == "zsh" else [shell, "-c", call]
    result = subprocess.run(command, cwd=str(cwd), env=env, stdin=subprocess.DEVNULL, capture_output=True, check=False)
    return result.returncode, result.stdout.decode("utf-8"), result.stderr.decode("utf-8")


def tool_print(cwd, env, *arguments):
    """One open-question tool call run on its own, its stdout the part of the print it owns."""
    result = subprocess.run(
        [sys.executable, str(TOOL), *arguments], cwd=str(cwd), env=env, capture_output=True, check=True
    )
    return result.stdout.decode("utf-8")


# --- the template as the rendered tree holds it -----------------------------------------------


def test_the_call_is_the_one_fence_holding_locate_and_runs_both_reads_around_a_quoted_printf():
    lines = read_call()
    assert len(lines) == 3
    assert LOCATE_COMMAND in lines[0] and lines[0].endswith(" &&")
    assert lines[1] == SEPARATOR_LINE
    assert LIST_COMMAND in lines[2]
    for line in (lines[0], lines[2]):
        assert line.startswith(f"python3 ${{{PLUGIN_ROOT_VARIABLE}}}/tools/open_questions.py ")
    assert '"<Short Title>"' in lines[0]
    assert not re.search(r"<[A-Za-z][A-Za-z_ ]*>", filled(lines, MISSION, TITLE)), "a placeholder is left unfilled"


def test_no_other_fence_of_the_agent_file_runs_the_open_question_tool():
    holding = [
        block
        for block in fenced_blocks(AGENT.read_text(encoding="utf-8"))
        if any("/tools/open_questions.py " in line for line in block)
    ]
    assert holding == [read_call()]


# --- the call run under each shell ------------------------------------------------------------


@pytest.mark.parametrize("shell", SHELLS)
def test_the_call_prints_the_block_then_the_separator_then_every_sibling(shell, project, environment):
    document = project / MISSION / "open_questions.xml"
    pristine = document.read_bytes()
    expected = (
        tool_print(project, environment, "locate", MISSION, TITLE)
        + SEPARATOR_PRINT
        + tool_print(project, environment, "list", "--with-question", MISSION)
    )

    status, stdout, stderr = run_call(shell, project, environment, filled(read_call(), MISSION, TITLE))

    assert (status, stderr) == (0, "")
    assert stdout == expected
    assert '<open-question id="Second bare question">' in stdout
    assert stdout.endswith(
        SEPARATOR_PRINT
        + "First bare question\tWhat is the first thing to decide?\n"
        + "Second bare question\tWhat follows from the first decision?\n"
    )
    assert document.read_bytes() == pristine
    assert sorted(path.name for path in (project / MISSION).iterdir()) == ["open_questions.xml"]


@pytest.mark.parametrize("shell", SHELLS)
def test_a_title_the_document_lacks_stops_on_the_error_line_with_nothing_else_printed(shell, project, environment):
    status, stdout, stderr = run_call(shell, project, environment, filled(read_call(), MISSION, "Missing question"))

    assert status != 0
    assert stdout == ""
    assert len(stderr.splitlines()) == 1 and stderr.startswith("Error: ")


# --- the separator failure the call replaced --------------------------------------------------


@pytest.mark.skipif(shutil.which("zsh") is None, reason="zsh is not installed")
def test_a_bare_equals_separator_loses_the_second_read_under_zsh(project, environment):
    lines = read_call()
    assert lines[1] == SEPARATOR_LINE
    joined = filled([lines[0], BARE_SEPARATOR_LINE, lines[2]], MISSION, TITLE)

    status, stdout, stderr = run_call("zsh", project, environment, joined)

    assert status != 0
    assert stdout == tool_print(project, environment, "locate", MISSION, TITLE)
    assert "not found" in stderr
    assert "\t" not in stdout, "the sibling-scope read ran"
