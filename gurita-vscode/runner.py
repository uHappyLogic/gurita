#!/usr/bin/env python3
"""The Gurita for VS Code runner: runs a recipe's lines as one chain in one shell session.

Stdlib only, Python 3.9 or later, shipped in the extension's package beside its `bundled/`
directory and runnable by hand outside the editor.

    runner.py chain -- LINE...
    runner.py preview --mission PATH --rules FILE --line NAME LINE...

Each LINE is one argument after `--`. A line is one of three kinds, inferred from its text:
interactive when it ends in a `# interactive` comment, headless when it otherwise holds a
`gurita:` skill invocation (`/gurita:` or `$gurita:`), and a shell step otherwise. The whole
chain is composed into one script, run by the shell `$SHELL` names as an interactive shell
(`-i`, so it reads the person's startup files), or by `/bin/sh` with no startup files when
`$SHELL` is unset or names a shell outside the sh, bash, zsh family. Shell steps and
interactive lines stand in the script as written. Each headless line's output goes through
`tee` to the terminal and to a run-local file, and is followed by a check step, this runner
started as `runner.py check`, which reads the first line of that final message and makes the
shell exit unless the line is a success or no-op line of the bundled fixed-line file
`bundled/fixed_lines.tsv` (one `kind<TAB>line` row per line of the plugin's fixed console
line table). Once the shell has exited the runner prints the line the run ended on and the
recipe line it stopped at, then waits for a keypress before exiting.

The values a line references reach it through the environment the runner is started in, as
`"$GURITA_*"` session variables; the command line carries none.

`preview` runs no line. It reads the rule file FILE, which chooses each task's single-task
line, and prints, for each remaining task of the mission's `TASKS_TODO.md` in file order, one
line of three tab-separated fields: `resolved` when the line name the rules give the task is
among the names given by `--line` (each `--line` a single-task line's name and its raw text),
`missing` otherwise; then that line name (empty when the rules name none); then the task's
`##` title. The rule file is UTF-8 text holding one rule per line: the pattern, ` -> `, and the
single-task line's name, the line split at its last ` -> ` and both parts stripped of outer
whitespace. Blank lines and lines opening with `#` are skipped. The one line whose pattern is
a bare `*` is the default, and a second one is refused. Each pattern is applied with
`re.search` and `re.IGNORECASE` to the task's title and brief joined by a newline, and the
first rule in file order that matches wins, the default naming the line when none does. A
missing rule file holds no rule and no default, and the preview says so on stderr in one line
naming the path looked for. A rule file that exists but cannot be read as rules is refused
whole: stderr carries a `Rule file refused:` line naming it and, beneath, one line per
unreadable line with its number and reason, and every task is printed unresolved. Either way
the task lines are printed and the exit status is 0; a task list that cannot be read prints
one `Error:` line and exits 1.
"""

import argparse
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
from typing import Dict, List, Optional, Tuple

INTERACTIVE = "interactive"
HEADLESS = "headless"
SHELL_STEP = "shell"

INVOCATION = re.compile(r"[/$]gurita:")
INTERACTIVE_MARK = re.compile(r"(?:^|\s)#\s*interactive\s*$")

CONTINUING_KINDS = ("success", "no-op")
SHELL_FAMILY = ("sh", "bash", "zsh")
FALLBACK_SHELL = "/bin/sh"

RUNNER_DIR = os.path.dirname(os.path.abspath(__file__))
FIXED_LINES_FILE = os.path.join(RUNNER_DIR, "bundled", "fixed_lines.tsv")

PROGRESS_FILE = "at"
VERDICTS_FILE = "verdicts.tsv"
END_MARK = "end"

CONTINUE = "continue"
STOP = "stop"

TASK_LIST_NAME = "TASKS_TODO.md"
TASK_HEADING = "## "
TASK_SEPARATOR = "---"

RULE_ARROW = " -> "
DEFAULT_PATTERN = "*"
RULE_COMMENT = "#"
RULES_READ = "read"
RULES_MISSING = "missing"
RULES_REFUSED = "refused"

RESOLVED = "resolved"
MISSING = "missing"


class RunnerError(Exception):
    """A refusal reported as one `Error:` line."""


def line_kind(line: str) -> str:
    """The kind of one chain line: interactive, headless, or a shell step."""
    if INTERACTIVE_MARK.search(line):
        return INTERACTIVE
    if INVOCATION.search(line):
        return HEADLESS
    return SHELL_STEP


def read_fixed_lines(path: str) -> Dict[str, str]:
    """Each fixed console line mapped to its kind, read from `kind<TAB>line` rows by a plain split."""
    try:
        with open(path, encoding="utf-8") as handle:
            text = handle.read()
    except OSError as error:
        raise RunnerError(f"cannot read the fixed-line file {path}: {error.strerror}")
    fixed = {}
    for number, row in enumerate(text.splitlines(), start=1):
        if not row:
            continue
        kind, separator, line = row.partition("\t")
        if not separator or not kind or not line:
            raise RunnerError(f"{path} line {number} is not a kind, a tab, and a line")
        fixed[line] = kind
    return fixed


def first_line(message: str) -> Optional[str]:
    """The first non-blank line of a final message, stripped, or None when it holds none."""
    for line in message.splitlines():
        if line.strip():
            return line.strip()
    return None


def verdict(message: str, fixed: Dict[str, str]) -> Tuple[bool, Optional[str]]:
    """Whether the chain goes on after a headless line printing `message`, and the line read.

    It goes on only when the message's first line is a success or no-op line; a stop or
    verdict line, any line the file does not hold, and an empty print all stop it.
    """
    line = first_line(message)
    return (line is not None and fixed.get(line) in CONTINUING_KINDS), line


def session_shell(environ: Dict[str, str]) -> List[str]:
    """The argv prefix of the session shell, before its `-c SCRIPT`."""
    shell = environ.get("SHELL", "")
    if (
        shell
        and os.path.basename(shell) in SHELL_FAMILY
        and os.path.isfile(shell)
        and os.access(shell, os.X_OK)
    ):
        return [shell, "-i"]
    return [FALLBACK_SHELL]


def compose_script(lines: List[str], run_dir: str, fixed_lines: str) -> str:
    """The one shell script a chain runs as, every run-local path written out quoted."""
    progress = shlex.quote(os.path.join(run_dir, PROGRESS_FILE))
    verdicts = shlex.quote(os.path.join(run_dir, VERDICTS_FILE))
    check = " ".join(
        shlex.quote(part) for part in (sys.executable, os.path.abspath(__file__), "check")
    )
    parts = []
    for number, line in enumerate(lines, start=1):
        parts.append(f"printf '%s\\n' {number} >| {progress}")
        if line_kind(line) == HEADLESS:
            output = shlex.quote(os.path.join(run_dir, f"out-{number}.txt"))
            parts.append("{")
            parts.append(line)
            parts.append(f"}} | command tee {output}")
            parts.append(
                f"{check} --fixed-lines {shlex.quote(fixed_lines)} --output {output}"
                f" --verdicts {verdicts} --line {number} || exit 1"
            )
        else:
            parts.append(line)
    parts.append(f"printf '%s\\n' {END_MARK} >| {progress}")
    return "\n".join(parts) + "\n"


def read_progress(run_dir: str) -> Optional[str]:
    try:
        with open(os.path.join(run_dir, PROGRESS_FILE), encoding="utf-8") as handle:
            return handle.read().strip() or None
    except OSError:
        return None


def read_verdicts(run_dir: str) -> List[Tuple[int, str, str]]:
    """Every check's record, in the order the checks ran: line number, verdict, line read."""
    try:
        with open(os.path.join(run_dir, VERDICTS_FILE), encoding="utf-8") as handle:
            rows = handle.read().splitlines()
    except OSError:
        return []
    records = []
    for row in rows:
        number, _, rest = row.partition("\t")
        outcome, _, line = rest.partition("\t")
        if number.isdigit():
            records.append((int(number), outcome, line))
    return records


def report(lines: List[str], run_dir: str, status: int) -> Tuple[List[str], bool]:
    """The report the run ends on, and whether the chain ran to its end."""
    total = len(lines)
    progress = read_progress(run_dir)
    records = read_verdicts(run_dir)
    last = records[-1] if records else None
    read = last[2] if last and last[2] else None

    def at(number: int) -> str:
        return f"recipe line {number} of {total}: {lines[number - 1]}"

    if last and last[1] == STOP:
        ended = read if read is not None else "(the line printed nothing)"
        return [f"Chain stopped at {at(last[0])}", f"Run ended on: {ended}"], False
    if progress == END_MARK:
        if last and last[0] == total:
            ended = read
        elif total and line_kind(lines[-1]) == INTERACTIVE:
            ended = "an interactive line, which prints no final message to read"
        else:
            ended = "a shell step, which is not read"
        return [f"Chain finished after {at(total)}", f"Run ended on: {ended}"], True
    if progress and progress.isdigit() and 1 <= int(progress) <= total:
        where = at(int(progress))
    else:
        where = "its first line"
    return [
        f"Chain ended early, its shell exiting with status {status}, at {where}",
        f"Run ended on: {read if read is not None else '(no headless line read)'}",
    ], False


def wait_for_key() -> None:
    """Wait for one keypress on the terminal; return at once when there is no terminal."""
    if not sys.stdin.isatty():
        return
    import signal
    import termios
    import tty

    fd = sys.stdin.fileno()
    previous = signal.signal(signal.SIGTTOU, signal.SIG_IGN)
    try:
        # Take the terminal back from the session shell's process group.
        os.tcsetpgrp(fd, os.getpgrp())
    except OSError:
        pass
    finally:
        signal.signal(signal.SIGTTOU, previous)
    sys.stdout.write("Press any key to close this terminal.\n")
    sys.stdout.flush()
    try:
        saved = termios.tcgetattr(fd)
    except termios.error:
        sys.stdin.readline()
        return
    try:
        tty.setcbreak(fd)
        os.read(fd, 1)
    except (KeyboardInterrupt, OSError):
        pass
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, saved)


def run_chain(lines: List[str]) -> int:
    fixed_lines = FIXED_LINES_FILE
    if any(line_kind(line) == HEADLESS for line in lines):
        read_fixed_lines(fixed_lines)
    run_dir = tempfile.mkdtemp(prefix="gurita-run-")
    try:
        script = compose_script(lines, run_dir, fixed_lines)
        process = subprocess.Popen(session_shell(dict(os.environ)) + ["-c", script])
        while True:
            try:
                status = process.wait()
                break
            except KeyboardInterrupt:
                continue
        printed, finished = report(lines, run_dir, status)
    finally:
        shutil.rmtree(run_dir, ignore_errors=True)
    sys.stdout.write("\n" + "\n".join(printed) + "\n")
    sys.stdout.flush()
    wait_for_key()
    return 0 if finished else 1


def run_check(fixed_lines: str, output: str, verdicts: str, number: int) -> int:
    """The check step: record the verdict on one headless line's print; exit 1 to stop the chain."""
    try:
        fixed = read_fixed_lines(fixed_lines)
    except RunnerError:
        fixed = {}
    try:
        with open(output, encoding="utf-8", errors="replace") as handle:
            message = handle.read()
    except OSError:
        message = ""
    goes_on, line = verdict(message, fixed)
    with open(verdicts, "a", encoding="utf-8") as handle:
        handle.write(f"{number}\t{CONTINUE if goes_on else STOP}\t{line or ''}\n")
    return 0 if goes_on else 1


class Rule:
    """One rule of the rule file: its compiled pattern, the line name it gives, its line number."""

    def __init__(self, pattern: "re.Pattern[str]", name: str, number: int) -> None:
        self.pattern = pattern
        self.name = name
        self.number = number


class RuleFile:
    """A rule file as read: `read`, `missing`, or `refused` with each problem found."""

    def __init__(
        self,
        path: str,
        state: str,
        rules: Optional[List[Rule]] = None,
        default: Optional[str] = None,
        problems: Optional[List[str]] = None,
    ) -> None:
        self.path = path
        self.state = state
        self.rules = rules or []
        self.default = default
        self.problems = problems or []

    def line_name(self, title: str, brief: str) -> Optional[str]:
        """The single-task line name these rules give a task, or None when they give none."""
        text = f"{title}\n{brief}"
        for rule in self.rules:
            if rule.pattern.search(text):
                return rule.name
        return self.default


def parse_rules(text_lines: List[Optional[str]], path: str) -> RuleFile:
    """The rules of a rule file's lines, or a refusal listing every unreadable line in order;
    a line that did not decode as UTF-8 is given as None."""
    rules: List[Rule] = []
    default: Optional[str] = None
    default_number = 0
    problems: List[str] = []
    for number, raw in enumerate(text_lines, start=1):
        if raw is None:
            problems.append(f"line {number}: not UTF-8 text")
            continue
        line = raw.rstrip("\r")
        if not line.strip() or line.lstrip().startswith(RULE_COMMENT):
            continue
        pattern, arrow, name = line.rpartition(RULE_ARROW)
        pattern, name = pattern.strip(), name.strip()
        if not arrow:
            problems.append(f"line {number}: no ' -> ' between a pattern and a line name")
            continue
        if not pattern:
            problems.append(f"line {number}: the pattern before ' -> ' is empty")
            continue
        if not name:
            problems.append(f"line {number}: the line name after ' -> ' is empty")
            continue
        if pattern == DEFAULT_PATTERN:
            if default is not None:
                problems.append(f"line {number}: a second default line; the first is line {default_number}")
            else:
                default, default_number = name, number
            continue
        try:
            compiled = re.compile(pattern, re.IGNORECASE)
        except re.error as error:
            problems.append(f"line {number}: the pattern is not a valid regular expression: {error}")
            continue
        rules.append(Rule(compiled, name, number))
    if problems:
        return RuleFile(path, RULES_REFUSED, problems=problems)
    return RuleFile(path, RULES_READ, rules=rules, default=default)


def read_rules(path: str) -> RuleFile:
    """The rule file at `path`: missing when no file stands there, refused when it cannot be
    read as rules, and its rules and default otherwise."""
    try:
        with open(path, "rb") as handle:
            data = handle.read()
    except FileNotFoundError:
        return RuleFile(path, RULES_MISSING)
    except OSError as error:
        return RuleFile(path, RULES_REFUSED, problems=[f"the file cannot be read: {error.strerror}"])
    text_lines: List[Optional[str]] = []
    for raw in data.split(b"\n"):
        try:
            text_lines.append(raw.decode("utf-8"))
        except UnicodeDecodeError:
            text_lines.append(None)
    return parse_rules(text_lines, path)


def is_task_separator(lines: List[str], index: int) -> bool:
    """Whether lines[index] is a section's `---` separator: the next non-blank line is a heading
    or the end of the file."""
    if lines[index].rstrip() != TASK_SEPARATOR:
        return False
    following = index + 1
    while following < len(lines) and not lines[following].strip():
        following += 1
    return following == len(lines) or lines[following].startswith(TASK_HEADING)


def parse_tasks(text: str) -> List[Tuple[str, str]]:
    """Each remaining task's `##` title and brief, in file order, read as the plugin's task-list
    tool reads its sections: every column-0 `## ` line a heading, a section ending at its `---`
    separator or the next heading, the brief its body with outer blank lines trimmed."""
    lines = [line.rstrip("\r") for line in text.split("\n")]
    tasks = []
    index = 0
    while index < len(lines) and not lines[index].startswith(TASK_HEADING):
        index += 1
    while index < len(lines):
        title = lines[index][len(TASK_HEADING):].strip()
        index += 1
        body: List[str] = []
        while index < len(lines) and not lines[index].startswith(TASK_HEADING):
            if is_task_separator(lines, index):
                index += 1
                while index < len(lines) and not lines[index].startswith(TASK_HEADING):
                    index += 1
                break
            body.append(lines[index])
            index += 1
        while body and not body[0].strip():
            body.pop(0)
        while body and not body[-1].strip():
            body.pop()
        tasks.append((title, "\n".join(body)))
    return tasks


def read_tasks(mission: str) -> List[Tuple[str, str]]:
    """The remaining tasks of the mission directory's task list."""
    path = os.path.join(mission, TASK_LIST_NAME)
    try:
        with open(path, encoding="utf-8") as handle:
            text = handle.read()
    except OSError as error:
        raise RunnerError(f"cannot read the task list {path}: {error.strerror}")
    except UnicodeDecodeError:
        raise RunnerError(f"cannot read the task list {path}: not UTF-8 text")
    return parse_tasks(text)


def assignment(rule_file: RuleFile, names: List[str], title: str, brief: str) -> Tuple[str, str]:
    """A task's state word and the line name its rules give it (empty when they give none)."""
    name = rule_file.line_name(title, brief) if rule_file.state == RULES_READ else None
    if name is not None and name in names:
        return RESOLVED, name
    return MISSING, name or ""


def preview_lines(rule_file: RuleFile, names: List[str], tasks: List[Tuple[str, str]]) -> List[str]:
    """The preview's print: one `state<TAB>name<TAB>title` line per task."""
    printed = []
    for title, brief in tasks:
        state, name = assignment(rule_file, names, title, brief)
        printed.append(f"{state}\t{name}\t{title}")
    return printed


def rule_notice(rule_file: RuleFile) -> List[str]:
    """What the preview says on stderr about a rule file it could not use, or nothing."""
    if rule_file.state == RULES_MISSING:
        return [f"No rule file stands at {rule_file.path}; no task is assigned a line."]
    if rule_file.state == RULES_REFUSED:
        return [f"Rule file refused: {rule_file.path}"] + rule_file.problems
    return []


def run_preview(mission: str, rules: str, lines: List[Tuple[str, str]]) -> int:
    tasks = read_tasks(mission)
    rule_file = read_rules(rules)
    names = [name for name, _ in lines]
    notice = rule_notice(rule_file)
    if notice:
        sys.stderr.write("\n".join(notice) + "\n")
    printed = preview_lines(rule_file, names, tasks)
    if printed:
        sys.stdout.write("\n".join(printed) + "\n")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="runner.py",
        description="Run a Gurita recipe's lines as one chain in one shell session.",
    )
    commands = parser.add_subparsers(dest="command", metavar="COMMAND")
    commands.required = True
    chain = commands.add_parser(
        "chain",
        help="run the chain's lines, given one argument each after --",
        description="Run the chain's lines in one shell session, stopping after a headless "
        "line whose final message does not open with a success or no-op fixed line.",
    )
    chain.add_argument("lines", nargs="+", metavar="LINE")
    check = commands.add_parser(
        "check",
        help="the check step a chain's script runs after each headless line",
        description="Read the first line of one headless line's final message, record the "
        "verdict, and exit 1 unless the line is a success or no-op fixed line.",
    )
    check.add_argument("--fixed-lines", required=True, metavar="FILE")
    check.add_argument("--output", required=True, metavar="FILE")
    check.add_argument("--verdicts", required=True, metavar="FILE")
    check.add_argument("--line", required=True, type=int, metavar="N")
    preview = commands.add_parser(
        "preview",
        help="print the single-task line the rules give each remaining task, running no line",
        description="Print one line per remaining task of the mission's TASKS_TODO.md: "
        "`resolved` or `missing`, the line name the rule file gives the task, and the task's "
        "title, tab-separated. A missing or refused rule file is reported on stderr and every "
        "task printed unresolved.",
    )
    preview.add_argument("--mission", required=True, metavar="PATH", help="the mission directory")
    preview.add_argument("--rules", required=True, metavar="FILE", help="the rule file")
    preview.add_argument(
        "--line",
        required=True,
        nargs=2,
        action="append",
        metavar=("NAME", "LINE"),
        dest="lines",
        help="a named single-task line: its name and its raw text; repeatable",
    )
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.command == "chain":
            return run_chain(args.lines)
        if args.command == "preview":
            return run_preview(args.mission, args.rules, [tuple(pair) for pair in args.lines])
        return run_check(args.fixed_lines, args.output, args.verdicts, args.line)
    except RunnerError as error:
        sys.stderr.write(f"Error: {error}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
