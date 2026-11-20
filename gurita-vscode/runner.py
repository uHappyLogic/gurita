#!/usr/bin/env python3
"""The Gurita for VS Code runner: runs a recipe's lines as one chain in one shell session.

Stdlib only, Python 3.9 or later, shipped in the extension's package beside its `bundled/`
directory and runnable by hand outside the editor.

    runner.py chain -- LINE...
    runner.py loop --mission PATH --rules FILE --line NAME LINE... [--override TITLE NAME]... -- LINE...
    runner.py preview --mission PATH --rules FILE --line NAME LINE...

Each LINE is one argument after `--`. A line is one of three kinds, inferred from its text:
interactive when it ends in a `# interactive` comment, headless when it otherwise holds a
`gurita:` skill invocation (`/gurita:` or `$gurita:`), and a shell step otherwise. The whole
chain is composed into one script, run by the shell `$SHELL` names as an interactive shell
(`-i`, so it reads the person's startup files), or by `/bin/sh` with no startup files when
`$SHELL` is unset or names a shell outside the sh, bash, zsh family. Before every line the
script prints one marker line to the terminal, `Step N of TOTAL: ` and the line's text with
every session-variable reference in it (`$GURITA_NAME` or `${GURITA_NAME}`, outside single quotes
and not escaped) shown as the value the session holds for it, a reference to a variable the
session does not hold left as written; nothing else in the line is expanded, the marker is
printed quoted, and the line that runs stays as written. The marker stands outside the `tee`
below, so it never reaches the file a check step reads. Shell steps and interactive lines stand
in the script as written. Each headless line's output goes through `tee` to the terminal and to a run-local
file, and is followed by a check step, this runner started as `runner.py check`, which reads
that line's verdict from the whole print the file holds, since a host may print several
messages for one line (an interim message each time the skill's background agents wake its
session, above its final one). The line read is the last whole line of the print, stripped of
outer whitespace, that is a success, no-op, or stop line of the bundled fixed-line file
`bundled/fixed_lines.tsv` (one `kind<TAB>line` row per line of the plugin's fixed console line
table); a verdict-kind line never counts, so the review's convergence line below its first
line is passed over. The check makes the shell exit unless that line is a success or no-op
line, and a print holding no such line stops the chain, its last non-blank line reported as
the line read. Once the shell has exited the runner prints the line the run ended on and the
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

`loop` is the looped task run, started once for the whole run. Its lines after `--` are the
looped recipe's, exactly one of them the slot line `<single-task line>`. Before each task it
re-reads the top remaining `##` heading of the mission's `TASKS_TODO.md` and chooses that task's
single-task line: the `--override` given for the task's title when there is one, and otherwise
the rules' result as `preview` gives it, the task unresolved when the name chosen is not among
the `--line` names or none is chosen. It shows the assignment it used, and an unresolved task
stops the run before anything runs for it. Otherwise it runs a fresh shell session, started as
a chain's is, with `GURITA_PATH` and `GURITA_TASK_TITLE` in its environment from its start,
filled from `--mission` and the re-read heading: the recipe's own lines at its head and the
chosen single-task line in the slot line's place, every `<path>` and `<Task Title>` in them
written as a reference to its variable in the form its quoting needs, so the values never
enter a line's text, only its step marker. The run goes on to the next task only when the
session ran to its end and the line the slot line's check read from its print, as a chain's check reads one, was
`Task completed.`, stops on any other line read, and ends when no heading remains; it closes as a chain does, on its report and a keypress.
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
SESSION_REFERENCE = re.compile(r"\$(?:\{(GURITA_[A-Za-z0-9_]*)\}|(GURITA_[A-Za-z0-9_]*))")
INTERACTIVE_MARK = re.compile(r"(?:^|\s)#\s*interactive\s*$")

CONTINUING_KINDS = ("success", "no-op")
READ_KINDS = CONTINUING_KINDS + ("stop",)
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

SLOT_LINE = "<single-task line>"
TASK_COMPLETED = "Task completed."
LOOP_PLACEHOLDERS = ("<path>", "<Task Title>")
BY_OVERRIDE = "override"
BY_RULES = "rules"


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


def fixed_line(message: str, fixed: Dict[str, str]) -> Optional[str]:
    """The last whole line of a print, stripped, that is a success, no-op, or stop line of
    `fixed`, or None when it holds none; a verdict-kind line never counts."""
    for line in reversed(message.splitlines()):
        if fixed.get(line.strip()) in READ_KINDS:
            return line.strip()
    return None


def last_line(message: str) -> Optional[str]:
    """The last non-blank line of a print, stripped, or None when it holds none."""
    for line in reversed(message.splitlines()):
        if line.strip():
            return line.strip()
    return None


def verdict(message: str, fixed: Dict[str, str]) -> Tuple[bool, Optional[str]]:
    """Whether the chain goes on after a headless line printing `message`, and the line read.

    The line read is the print's last success, no-op, or stop line, so interim messages above
    the final one and a list or verdict line below its first line are passed over; it goes on
    only when that line is a success or no-op line. A print holding no such line stops it, its
    last non-blank line given as the line read, and an empty print stops it with none.
    """
    line = fixed_line(message, fixed)
    if line is not None:
        return fixed[line] in CONTINUING_KINDS, line
    return False, last_line(message)


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


def show_session_values(line: str, values: Dict[str, str]) -> str:
    """The line with each session-variable reference, `$GURITA_NAME` or `${GURITA_NAME}`, that
    the shell would expand (outside single quotes, not escaped) written as its value in
    `values`; a reference to a variable `values` does not hold, and everything else in the
    line, stays as written."""
    shown: List[str] = []
    quote = ""
    index = 0
    while index < len(line):
        char = line[index]
        if char == "$" and quote != "'":
            found = SESSION_REFERENCE.match(line, index)
            if found is not None:
                name = found.group(1) or found.group(2)
                if name in values:
                    shown.append(values[name])
                    index = found.end()
                    continue
        shown.append(char)
        index += 1
        if char == "\\" and quote != "'" and index < len(line):
            shown.append(line[index])
            index += 1
        elif quote == "" and char in "'\"":
            quote = char
        elif char == quote:
            quote = ""
    return "".join(shown)


def step_marker(number: int, total: int, line: str, values: Optional[Dict[str, str]] = None) -> str:
    """The marker line printed to the terminal before a chain's line runs, its session-variable
    references shown as their values in `values`."""
    return f"Step {number} of {total}: {show_session_values(line, values or {})}"


def compose_script(
    lines: List[str], run_dir: str, fixed_lines: str, values: Optional[Dict[str, str]] = None
) -> str:
    """The one shell script a chain runs as, every run-local path written out quoted; before
    each line it prints that line's marker, its session-variable references shown as their
    values in `values`, outside a headless line's `tee` group."""
    progress = shlex.quote(os.path.join(run_dir, PROGRESS_FILE))
    verdicts = shlex.quote(os.path.join(run_dir, VERDICTS_FILE))
    check = " ".join(
        shlex.quote(part) for part in (sys.executable, os.path.abspath(__file__), "check")
    )
    total = len(lines)
    parts = []
    for number, line in enumerate(lines, start=1):
        parts.append(f"printf '%s\\n' {number} >| {progress}")
        parts.append(f"printf '%s\\n' {shlex.quote(step_marker(number, total, line, values))}")
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


def wait_for_shell(process: "subprocess.Popen[bytes]") -> int:
    """The session shell's exit status, an interrupt meant for the shell never ending the wait."""
    while True:
        try:
            return process.wait()
        except KeyboardInterrupt:
            continue


def run_chain(lines: List[str]) -> int:
    fixed_lines = FIXED_LINES_FILE
    if any(line_kind(line) == HEADLESS for line in lines):
        read_fixed_lines(fixed_lines)
    run_dir = tempfile.mkdtemp(prefix="gurita-run-")
    try:
        script = compose_script(lines, run_dir, fixed_lines, dict(os.environ))
        process = subprocess.Popen(session_shell(dict(os.environ)) + ["-c", script])
        status = wait_for_shell(process)
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


class Choice:
    """The single-task line a looped run takes for one task: its state word, the line name
    (empty when none is named), and whether an override or the rules named it."""

    def __init__(self, state: str, name: str, source: str) -> None:
        self.state = state
        self.name = name
        self.source = source

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Choice) and (self.state, self.name, self.source) == (
            other.state,
            other.name,
            other.source,
        )

    def __repr__(self) -> str:
        return f"Choice({self.state!r}, {self.name!r}, {self.source!r})"


def choose_line(
    rule_file: RuleFile, names: List[str], overrides: Dict[str, str], title: str, brief: str
) -> Choice:
    """A task's override when one was made for its title, and otherwise the rules' result; an
    override or a rule naming no line among `names` leaves the task unresolved."""
    if title in overrides:
        name = overrides[title]
        return Choice(RESOLVED if name in names else MISSING, name, BY_OVERRIDE)
    state, name = assignment(rule_file, names, title, brief)
    return Choice(state, name, BY_RULES)


def describe_choice(choice: Choice) -> str:
    """The assignment line a looped run shows before each task."""
    if choice.state == RESOLVED:
        return f"Line: {choice.name} (by {choice.source})"
    if choice.name:
        who = "the override names" if choice.source == BY_OVERRIDE else "the rules name"
        return f'Line: unresolved — {who} "{choice.name}", which no single-task line given carries'
    return "Line: unresolved — no rule gives the task a line"


def session_variable(placeholder: str) -> str:
    """The session variable a placeholder is filled through: `GURITA_`, then its text
    upper-cased with every space turned into an underscore."""
    return "GURITA_" + placeholder.strip("<>").upper().replace(" ", "_")


def fill_placeholders(line: str, placeholders: Tuple[str, ...] = LOOP_PLACEHOLDERS) -> str:
    """The line with each placeholder written as a reference to its session variable, in the
    form its quoting needs: `${NAME}` inside double quotes, `'"${NAME}"'` inside single quotes,
    and `"${NAME}"` outside them. The value itself never enters the line."""
    filled: List[str] = []
    quote = ""
    index = 0
    while index < len(line):
        found = next((p for p in placeholders if line.startswith(p, index)), None)
        if found is not None:
            reference = "${" + session_variable(found) + "}"
            if quote == '"':
                filled.append(reference)
            elif quote == "'":
                filled.append(f"'\"{reference}\"'")
            else:
                filled.append(f'"{reference}"')
            index += len(found)
            continue
        char = line[index]
        filled.append(char)
        index += 1
        if char == "\\" and quote != "'" and index < len(line):
            filled.append(line[index])
            index += 1
        elif quote == "" and char in "'\"":
            quote = char
        elif char == quote:
            quote = ""
    return "".join(filled)


def slot_number(lines: List[str]) -> int:
    """The 1-based number of the looped recipe's one slot line, refused unless exactly one
    line is the slot line."""
    numbers = [number for number, line in enumerate(lines, start=1) if line.strip() == SLOT_LINE]
    if len(numbers) != 1:
        raise RunnerError(
            f"the looped recipe holds {len(numbers)} slot lines {SLOT_LINE}; it must hold exactly one"
        )
    return numbers[0]


def session_lines(lines: List[str], slot: int, task_line: str) -> List[str]:
    """One task's session: the recipe's own lines with the chosen single-task line in the
    slot line's place, every `<path>` and `<Task Title>` written as its session variable."""
    composed = list(lines)
    composed[slot - 1] = task_line
    return [fill_placeholders(line) for line in composed]


def task_completed(progress: Optional[str], records: List[Tuple[int, str, str]], slot: int) -> bool:
    """The looped verdict: a task's session takes the run to the next task only when it ran to
    its end and the line its check read from the slot line's print is `Task completed.`; any
    other line read, the no-op line included, stops the run."""
    if progress != END_MARK:
        return False
    read = [line for number, _, line in records if number == slot]
    return bool(read) and read[-1] == TASK_COMPLETED


def run_task_session(lines: List[str], slot: int, values: Dict[str, str]) -> Tuple[List[str], bool]:
    """Run one task's session in a fresh shell holding `values` in its environment from its
    start; its report, and whether the task completed."""
    run_dir = tempfile.mkdtemp(prefix="gurita-task-")
    try:
        environ = dict(os.environ)
        environ.update(values)
        script = compose_script(lines, run_dir, FIXED_LINES_FILE, environ)
        process = subprocess.Popen(session_shell(environ) + ["-c", script], env=environ)
        status = wait_for_shell(process)
        printed, _ = report(lines, run_dir, status)
        completed = task_completed(read_progress(run_dir), read_verdicts(run_dir), slot)
    finally:
        shutil.rmtree(run_dir, ignore_errors=True)
    return printed, completed


def say(lines: List[str]) -> None:
    sys.stdout.write("\n".join(lines) + "\n")
    sys.stdout.flush()


def run_loop(
    mission: str,
    rules: str,
    named: List[Tuple[str, str]],
    overrides: List[Tuple[str, str]],
    lines: List[str],
) -> int:
    slot = slot_number(lines)
    read_fixed_lines(FIXED_LINES_FILE)
    texts: Dict[str, str] = {}
    for name, text in named:
        texts.setdefault(name, text)
    names = list(texts)
    chosen = dict(overrides)
    rule_file = read_rules(rules)
    notice = rule_notice(rule_file)
    if notice:
        say(notice)
    completed = 0
    finished = False
    while True:
        try:
            tasks = read_tasks(mission)
        except RunnerError as error:
            ending = [f"Loop stopped: {error}"]
            break
        if not tasks:
            ending = ["Loop finished: no task remains"]
            finished = True
            break
        title, brief = tasks[0]
        choice = choose_line(rule_file, names, chosen, title, brief)
        say(["", f"Task: {title}", describe_choice(choice)])
        if choice.state != RESOLVED:
            ending = [f"Loop stopped before running task: {title}", "Its assignment is unresolved."]
            break
        values = {"GURITA_PATH": mission, "GURITA_TASK_TITLE": title}
        printed, done = run_task_session(session_lines(lines, slot, texts[choice.name]), slot, values)
        say(printed)
        if not done:
            ending = [f"Loop stopped after task: {title}", f"It did not end on {TASK_COMPLETED}"]
            break
        completed += 1
    say(["", *ending, f"Tasks completed: {completed}"])
    wait_for_key()
    return 0 if finished else 1


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
        "line whose print's last success, no-op, or stop fixed line is not a success or no-op "
        "line, or whose print holds none.",
    )
    chain.add_argument("lines", nargs="+", metavar="LINE")
    check = commands.add_parser(
        "check",
        help="the check step a chain's script runs after each headless line",
        description="Read the last success, no-op, or stop fixed line of one headless line's "
        "print, record the verdict, and exit 1 unless the line is a success or no-op fixed line.",
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
    loop = commands.add_parser(
        "loop",
        help="run the remaining tasks one at a time, a fresh shell session per task",
        description="Before each task re-read the top remaining heading of the mission's "
        "TASKS_TODO.md, take its override or else the rules' result, and run the looped "
        "recipe's lines given after -- in a fresh shell session, the chosen single-task line in "
        f"the place of the slot line {SLOT_LINE}. Go on only when a task's run ends on the line "
        f"'{TASK_COMPLETED}', stop before "
        "running a task whose assignment is unresolved, and end when no heading remains.",
    )
    loop.add_argument("--mission", required=True, metavar="PATH", help="the mission directory")
    loop.add_argument("--rules", required=True, metavar="FILE", help="the rule file")
    loop.add_argument(
        "--line",
        required=True,
        nargs=2,
        action="append",
        metavar=("NAME", "LINE"),
        dest="named",
        help="a named single-task line: its name and its raw text; repeatable",
    )
    loop.add_argument(
        "--override",
        nargs=2,
        action="append",
        default=[],
        metavar=("TITLE", "NAME"),
        dest="overrides",
        help="the single-task line name a task takes in place of the rules' result; repeatable",
    )
    loop.add_argument("lines", nargs="+", metavar="LINE")
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.command == "chain":
            return run_chain(args.lines)
        if args.command == "loop":
            return run_loop(
                args.mission,
                args.rules,
                [tuple(pair) for pair in args.named],
                [tuple(pair) for pair in args.overrides],
                args.lines,
            )
        if args.command == "preview":
            return run_preview(args.mission, args.rules, [tuple(pair) for pair in args.lines])
        return run_check(args.fixed_lines, args.output, args.verdicts, args.line)
    except RunnerError as error:
        sys.stderr.write(f"Error: {error}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
