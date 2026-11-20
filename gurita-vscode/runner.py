#!/usr/bin/env python3
"""The Gurita for VS Code runner: runs a recipe's lines as one chain in one shell session.

Stdlib only, Python 3.9 or later, shipped in the extension's package beside its `bundled/`
directory and runnable by hand outside the editor.

    runner.py chain -- LINE...

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
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.command == "chain":
            return run_chain(args.lines)
        return run_check(args.fixed_lines, args.output, args.verdicts, args.line)
    except RunnerError as error:
        sys.stderr.write(f"Error: {error}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
