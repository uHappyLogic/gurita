"""The inline complete-task skill's fixed call, as the committed Claude Code tree renders it, run
against another process's .git/index.lock: the one fenced block of the skill file holding the
task-list tool's remove, filled as the runner fills it (the mission directory, the task's full
heading, its bar as bullets, and the paths the task edited and created, one per line of the
heredoc that feeds the commit tool's `--path-file -`), and run under bash in a
temporary git repository seeded through the conftest factory, with another run's change staged
and an untracked file beside it. Git's own trace, written to a file, counts the attempts the
commit tool makes, so the test knows the first `git add` met the held lock before it releases
it. A lock released within the retry window lets the completion commit land carrying only its
own paths and the bar, exactly, as its body; a lock never released ends the call within a limit
a little above the retry bound, passing git's message on in the commit tool's one Error: line,
with no commit. An empty bar, filled as the runner would leave it, is refused by the call's own
test before anything is removed or committed. A recorded path holding a space and shell syntax
(an apostrophe, a command substitution, a backtick, a glob) reaches the commit tool as written
from its heredoc line, runs nothing, and is committed. This is the suite's one fixed call run against a
held lock: the retry schedule itself is the commit tool's and is tested in test_commit_retry.py,
and the parallel test is not relied on for it."""

import os
import re
import subprocess
import time
from pathlib import Path

import pytest

import commit

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILL = REPO_ROOT / "hosts" / "claude" / "skills" / "complete-task" / "SKILL.md"
FIXTURES = Path(__file__).resolve().parent / "fixtures"

REMOVE_COMMAND = "/tools/task_list.py remove "
COMMIT_COMMAND = "/tools/commit.py "
BAR_PLACEHOLDER = "- <criterion "
PATHS_PLACEHOLDER = ["<recorded path 1>", "<recorded path 2>"]

# The line feeding the commit tool its paths from the second heredoc.
COMMIT_LINE = (
    '{ out="$(python3 ${CLAUDE_PLUGIN_ROOT}/tools/commit.py --subject "Task-completion: <Task Title>" '
    '--body "$bar" --path-file -)"; } <<\'EOF\' &&'
)

# The lines the call opens with: the bar captured from its heredoc, then the empty-bar test.
CAPTURE_LINE = "{ bar=\"$(cat)\"; } <<'EOF' &&"
EMPTY_BAR_TEST = [
    "if ! printf '%s\\n' \"$bar\" | grep -q '[^[:space:]]'; then",
    "  echo 'acceptance bar empty'",
    "  false",
    "fi &&",
]
ACCEPTANCE_BAR_EMPTY = "acceptance bar empty\n"

# <MISSION_DIR> as the runner fills it: the --mission path, its trailing slash included.
MISSION = "mission_lock-retry-fixture/"
TODO = MISSION + "TASKS_TODO.md"

# The golden task list's first task, its bar as the runner verified it (an apostrophe and
# parentheses included, which the group-fed capture must carry through every shell), and the
# paths its work edited (a tracked file) and created (a new one), in the order the runner
# recorded them.
TASK_TITLE = "Build The Parser First"
BAR = [
    "- `src/parser.py` reads the whole file into its heading and sections (the file's preamble dropped)",
    "- `src/parser_test.py` round-trips the golden files byte for byte",
]
EDITED = "src/parser.py"
CREATED = "src/parser_test.py"
OWN_PATHS = [EDITED, CREATED, TODO]

# A project path a task may create that the command line would have broken: a space, an
# apostrophe, a command substitution, a backtick, and a glob character, none of which may run
# or expand.
SHELL_SYNTAX = "docs/User Guide/it's $(touch pwned) `touch pwned` [x]*.md"

# Another run's work in the same tree: a staged edit and an untracked file.
STAGED_ELSEWHERE = "README.md"
UNTRACKED_ELSEWHERE = "notes.txt"

COMPLETION_COMMIT_LANDED = "completion commit landed\n"

# The retry bound is the commit tool's one schedule: a pause between every two attempts. The
# limit adds less than one more window, enough for the call's processes, so a call within it
# ran the schedule once and gave up.
WINDOW = (commit.ATTEMPTS - 1) * commit.PAUSE
LIMIT = WINDOW + 3.0

# One line of git's trace per git command run, the subcommand unquoted in current git and
# quoted in older releases.
ADD_TRACE = re.compile(r"trace: built-in: git '?add'? ")
COMMIT_TRACE = re.compile(r"trace: built-in: git '?commit'? ")


# --- extracting and filling the call --------------------------------------------------------


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
    assert current is None, "an unclosed fence in the skill file"
    return blocks


def fixed_call():
    """The one fence of the rendered skill file holding the removal, which also runs the commit
    tool."""
    holding = [block for block in fenced_blocks(SKILL.read_text(encoding="utf-8")) if any(REMOVE_COMMAND in line for line in block)]
    assert len(holding) == 1, f"{len(holding)} fences of the skill file hold the removal, not one"
    lines = holding[0]
    assert sum(COMMIT_COMMAND in line for line in lines) == 1, "the call does not run the commit tool once"
    return lines


def completion_call(bar=BAR, paths=(EDITED, CREATED)):
    """The call written out as the runner writes it: the template's bar bullets replaced by the
    given bar (the verified one unless another is given), the two recorded-path placeholder lines
    by the task's recorded paths, one per line (the edited and created ones unless others are
    given), and every other placeholder by its value."""
    template = fixed_call()
    bullets = [index for index, line in enumerate(template) if line.startswith(BAR_PLACEHOLDER)]
    assert bullets and bullets == list(range(bullets[0], bullets[-1] + 1)), "the bar's bullets are not one run"
    lines = template[: bullets[0]] + list(bar) + template[bullets[-1] + 1 :]
    first = lines.index(PATHS_PLACEHOLDER[0])
    assert lines[first : first + len(PATHS_PLACEHOLDER)] == PATHS_PLACEHOLDER
    lines = lines[:first] + list(paths) + lines[first + len(PATHS_PLACEHOLDER) :]
    call = "\n".join(lines) + "\n"
    call = call.replace("<MISSION_DIR>", MISSION).replace("<Task Title>", TASK_TITLE)
    assert not re.search(r"<[A-Za-z][^<>\n]*>", call), "a placeholder is left unfilled"
    return call


# --- the temporary repository and the run ---------------------------------------------------


@pytest.fixture
def project(repo, environment, git):
    """A repository whose one commit holds the golden task list at MISSION, the file the task
    edits, and an unrelated tracked file, with the task's edits made and another run's staged
    edit and untracked file in the tree beside them."""
    root = repo(
        {},
        files={
            TODO: (FIXTURES / "task_list_todo.md").read_bytes(),
            EDITED: b"def parse(text):\n    raise NotImplementedError\n",
            STAGED_ELSEWHERE: b"An unrelated tracked file.\n",
        },
    )
    (root / EDITED).write_bytes(b"def parse(text):\n    return text.split('\\n## ')\n")
    (root / CREATED).write_bytes(b"from parser import parse\n")
    (root / STAGED_ELSEWHERE).write_bytes(b"An unrelated tracked file, edited by another run.\n")
    git(root, environment, "add", "--", STAGED_ELSEWHERE)
    (root / UNTRACKED_ELSEWHERE).write_bytes(b"An untracked file.\n")
    return root


def start(project, environment, trace):
    """Start the filled call under bash from the repository root, git tracing every command it
    runs into the trace file."""
    return subprocess.Popen(
        ["bash", "-c", completion_call()],
        cwd=str(project),
        env=dict(environment, GIT_TRACE=str(trace)),
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )


def finish(process):
    """Wait for the call to end within the limit, killing it and failing otherwise: -> (stdout,
    stderr) as text."""
    try:
        stdout, stderr = process.communicate(timeout=LIMIT)
    except subprocess.TimeoutExpired:
        process.kill()
        process.communicate()
        pytest.fail(f"the call was still running {LIMIT} seconds after it started")
    return stdout.decode("utf-8"), stderr.decode("utf-8")


def attempts(trace, pattern):
    """How many git commands of the given subcommand the trace records."""
    if not trace.exists():
        return 0
    return sum(1 for line in trace.read_text(encoding="utf-8", errors="replace").splitlines() if pattern.search(line))


def head(git, project, environment):
    return git(project, environment, "rev-parse", "HEAD").strip()


def message(git, project, environment):
    """HEAD's whole commit message as git stored it: the subject, a blank line, and the body."""
    return git(project, environment, "cat-file", "commit", "HEAD").split("\n\n", 1)[1]


def staged(git, project, environment):
    return git(project, environment, "diff", "--cached", "--name-only").split()


# --- the template as the rendered tree holds it ---------------------------------------------


def test_the_call_captures_and_tests_the_bar_then_chains_the_removal_with_the_commit_tool():
    lines = fixed_call()
    text = "\n".join(lines)
    assert lines[0] == CAPTURE_LINE
    eof = lines.index("EOF")
    assert eof == 1 + sum(line.startswith(BAR_PLACEHOLDER) for line in lines)
    assert lines[eof + 1 : eof + 1 + len(EMPTY_BAR_TEST)] == EMPTY_BAR_TEST
    remove_line = lines[eof + 1 + len(EMPTY_BAR_TEST)]
    assert remove_line == 'python3 ${CLAUDE_PLUGIN_ROOT}/tools/task_list.py remove <MISSION_DIR> "<Task Title>" &&'
    commit_index = eof + 2 + len(EMPTY_BAR_TEST)
    assert lines[commit_index] == COMMIT_LINE
    # The commit tool names no path on its command line: every path is a line of its heredoc.
    assert lines[commit_index + 1 :][: len(PATHS_PLACEHOLDER) + 2] == PATHS_PLACEHOLDER + ["<MISSION_DIR>/TASKS_TODO.md", "EOF"]
    assert "<<'EOF'" not in remove_line, "the removal reads a heredoc"
    assert text.count("<<'EOF'") == 2
    assert lines.count("EOF") == 2
    assert "echo 'completion commit landed'" in text


# --- the call run under bash against a held lock --------------------------------------------


def test_a_lock_released_within_the_window_lets_the_commit_land_with_only_its_own_paths(
    project, environment, git, tmp_path
):
    trace = tmp_path / "git-trace.log"
    lock = project / ".git" / "index.lock"
    before = head(git, project, environment)
    lock.write_bytes(b"")
    started = time.monotonic()
    process = start(project, environment, trace)
    try:
        # The second `git add` starts only once the first has ended, and the first ran while the
        # lock was held, so two traced adds mean the lock refused one and the tool repeated it.
        while attempts(trace, ADD_TRACE) < 2 and time.monotonic() - started < WINDOW:
            time.sleep(0.02)
        repeated = attempts(trace, ADD_TRACE)
    finally:
        lock.unlink()
    stdout, stderr = finish(process)

    assert repeated >= 2, "the commit tool's git add was not repeated while the lock was held"
    assert (process.returncode, stdout, stderr) == (0, COMPLETION_COMMIT_LANDED, "")
    assert attempts(trace, COMMIT_TRACE) == 1
    assert git(project, environment, "rev-parse", "HEAD^").strip() == before
    assert message(git, project, environment) == f"Task-completion: {TASK_TITLE}\n\n" + "\n".join(BAR) + "\n"
    committed = git(project, environment, "show", "--name-only", "--format=", "HEAD").splitlines()
    assert sorted(committed) == sorted(OWN_PATHS)
    todo = git(project, environment, "show", f"HEAD:{TODO}")
    assert f"## {TASK_TITLE}\n" not in todo
    assert todo.startswith("# TASKS TODO\n\n## Keep A Body Separator Line\n")
    assert sorted(path.name for path in (project / MISSION).iterdir()) == ["TASKS_TODO.md"]
    assert staged(git, project, environment) == [STAGED_ELSEWHERE]
    assert git(project, environment, "status", "--porcelain").splitlines() == [
        f"M  {STAGED_ELSEWHERE}",
        f"?? {UNTRACKED_ELSEWHERE}",
    ]


def test_a_lock_never_released_ends_the_call_within_the_limit_with_gits_message_and_no_commit(
    project, environment, git, tmp_path
):
    trace = tmp_path / "git-trace.log"
    lock = project / ".git" / "index.lock"
    before = head(git, project, environment)
    lock.write_bytes(b"")
    started = time.monotonic()
    process = start(project, environment, trace)
    stdout, stderr = finish(process)
    elapsed = time.monotonic() - started

    assert WINDOW <= elapsed < LIMIT
    assert process.returncode != 0
    assert stdout == ""
    lines = stderr.split("\n")
    assert len(lines) == 2 and lines[1] == "", "the call printed more than the commit tool's one Error: line"
    assert lines[0].startswith("Error: git add ")
    assert f"Unable to create '{os.path.realpath(lock)}': File exists." in lines[0]
    assert attempts(trace, ADD_TRACE) == commit.ATTEMPTS
    assert attempts(trace, COMMIT_TRACE) == 0
    assert head(git, project, environment) == before
    assert git(project, environment, "rev-list", "--count", "HEAD").strip() == "1"
    lock.unlink()
    assert staged(git, project, environment) == [STAGED_ELSEWHERE]
    # The removal landed before the commit tool ran, so the completion stays in the tree for a
    # rerun of the commit.
    assert f"## {TASK_TITLE}\n" not in (project / TODO).read_text(encoding="utf-8")


# --- a project path holding a space and shell syntax --------------------------------------


def test_a_recorded_path_holding_a_space_and_shell_syntax_is_committed_as_written(project, environment, git, run_call):
    target = project / SHELL_SYNTAX
    target.parent.mkdir(parents=True)
    target.write_bytes(b"A guide page the task created.\n")
    status, stdout, stderr = run_call(project, environment, completion_call(paths=(EDITED, CREATED, SHELL_SYNTAX)))
    assert (status, stdout, stderr) == (0, COMPLETION_COMMIT_LANDED, "")
    assert message(git, project, environment) == f"Task-completion: {TASK_TITLE}\n\n" + "\n".join(BAR) + "\n"
    committed = git(project, environment, "show", "-z", "--name-only", "--format=", "HEAD").split("\0")
    assert sorted(path for path in committed if path) == sorted(OWN_PATHS + [SHELL_SYNTAX])
    assert not (project / "pwned").exists(), "a recorded path ran a command"
    assert staged(git, project, environment) == [STAGED_ELSEWHERE]


# --- an empty bar ---------------------------------------------------------------------------


@pytest.mark.parametrize("bar", [[], [""], ["   ", "\t", ""]], ids=["no-line", "blank-line", "whitespace-lines"])
def test_an_empty_bar_prints_the_one_line_and_removes_and_commits_nothing(project, environment, git, run_call, bar):
    before = head(git, project, environment)
    todo_before = (project / TODO).read_bytes()
    status, stdout, stderr = run_call(project, environment, completion_call(bar))
    assert status != 0
    assert (stdout, stderr) == (ACCEPTANCE_BAR_EMPTY, "")
    assert (project / TODO).read_bytes() == todo_before
    assert head(git, project, environment) == before
    assert staged(git, project, environment) == [STAGED_ELSEWHERE]
    assert git(project, environment, "status", "--porcelain").splitlines() == [
        f"M  {STAGED_ELSEWHERE}",
        f" M {EDITED}",
        f"?? {UNTRACKED_ELSEWHERE}",
        f"?? {CREATED}",
    ]
