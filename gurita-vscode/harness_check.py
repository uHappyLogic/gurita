#!/usr/bin/env python3
"""The Gurita for VS Code harness check: which harness CLIs are found and which Gurita copy each has.

Stdlib only, Python 3.9 or later, shipped in the extension's package beside `runner.py` and
runnable by hand outside the editor.

    harness_check.py --project ROOT

It imports the runner as a module and takes the session shell from its `session_shell`, so a
harness's CLI is looked up on the `PATH` the shell a chain runs in builds from the person's
startup files. In that one session, started at ROOT with no input, it runs for each of Claude
Code, Antigravity, and Codex the shell's `command -v` lookup of the CLI and, when the CLI is
found, its listing (`claude plugin list --json`, `agy plugin list --json`,
`codex plugin list -m gurita --json`), each listing's print, error print, and exit status
written to a run-local file, so nothing the startup files print reaches the result.

It prints one JSON object on one line, keyed `claude`, `antigravity`, and `codex`, each holding
`found` (whether the CLI was found), `installed` (whether an enabled Gurita copy is installed),
`version` (the version that copy reads, null when none is installed or the entry carries no
version), and `disabled` (whether the copy the harness holds is installed but disabled, its
`installed` then false and its `version` null), so a copy is in one of three states: not
installed, installed, or installed but disabled; and `error` beside them when the listing could
not be read: it exited non-zero, did not finish within the session's time limit, or printed no
JSON of the listing's shape, the copy then counted as not installed and not disabled. Claude
Code's result also holds `scopes` (every scope holding a `gurita@gurita` entry that applies to
ROOT, the winning one first and the rest from the most specific down, empty when none applies or
the listing could not be read) and `scope` (the winning scope, null when none applies), its
`disabled` saying whether the winning entry reads `enabled` false.

Claude Code's copy is chosen among the `gurita@gurita` entries that apply to ROOT: the
`user`-scope entry and every `project`- or `local`-scope entry whose `projectPath` equals ROOT,
other projects' entries and `synced` entries ignored, `local` winning over `project` over
`user`, a winning entry whose `enabled` is false meaning not installed, its scope still listed
and marked disabled. Its version is `folderVersion` whenever the entry carries `readFromFolder`
and `version` otherwise.
Antigravity's copy is the `gurita` entry of the listing's array, Codex's the `gurita@gurita`
entry of the listing's `installed` array; a Codex entry reading `installed` false counts as not
installed, and an entry of either reading `enabled` false as installed but disabled; each enabled
copy's version is its `version`.

The exit status is 0 whenever the result is printed; a ROOT that is not a directory prints one
`Error:` line and exits 1.
"""

import argparse
import json
import os
import shlex
import signal
import subprocess
import sys
import tempfile
from typing import Any, Callable, Dict, List, NamedTuple, Optional, Tuple

# The extension's directory is packaged into the VSIX, so importing the runner from it must
# leave no __pycache__ behind there.
sys.dont_write_bytecode = True

CHECK_DIR = os.path.dirname(os.path.abspath(__file__))
if CHECK_DIR not in sys.path:
    sys.path.insert(0, CHECK_DIR)

import runner  # noqa: E402

CLAUDE = "claude"
ANTIGRAVITY = "antigravity"
CODEX = "codex"

# Each harness: its result key, its CLI, and the listing's arguments after the CLI.
HARNESSES: Tuple[Tuple[str, str, Tuple[str, ...]], ...] = (
    (CLAUDE, "claude", ("plugin", "list", "--json")),
    (ANTIGRAVITY, "agy", ("plugin", "list", "--json")),
    (CODEX, "codex", ("plugin", "list", "-m", "gurita", "--json")),
)

CLAUDE_PLUGIN_ID = "gurita@gurita"
ANTIGRAVITY_PLUGIN_NAME = "gurita"
CODEX_PLUGIN_ID = "gurita@gurita"
SCOPE_RANK = {"user": 0, "project": 1, "local": 2}
PROJECT_SCOPES = ("project", "local")

FOUND_SUFFIX = ".found"
OUT_SUFFIX = ".out"
ERR_SUFFIX = ".err"
STATUS_SUFFIX = ".status"

SESSION_TIMEOUT = 120


class CheckError(Exception):
    """A refusal reported as one `Error:` line."""


class ListingError(Exception):
    """A listing that could not be read, carried as the harness result's `error`."""


def compose_script(run_dir: str) -> str:
    """The session's script: for each harness the CLI lookup and, when found, its listing,
    each outcome written to a file named for the harness in `run_dir`."""
    parts: List[str] = []
    for key, cli, arguments in HARNESSES:
        base = shlex.quote(os.path.join(run_dir, key))
        listing = " ".join(shlex.quote(word) for word in (cli,) + arguments)
        parts.append(
            f"if command -v {shlex.quote(cli)} >/dev/null 2>&1; then "
            f": >{base}{FOUND_SUFFIX}; "
            f"{listing} >{base}{OUT_SUFFIX} 2>{base}{ERR_SUFFIX} </dev/null; "
            f"printf '%s\\n' \"$?\" >{base}{STATUS_SUFFIX}; "
            "fi"
        )
    return "\n".join(parts) + "\n"


def run_session(argv: List[str], root: str, timeout: float) -> None:
    """Run the session shell's argv at `root` with no input and its prints discarded, killing
    its whole process group once `timeout` seconds have passed."""
    process = subprocess.Popen(
        argv,
        cwd=root,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    try:
        process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except OSError:
            pass
        process.wait()


def same_path(left: str, right: str) -> bool:
    return os.path.realpath(left) == os.path.realpath(right)


def parse_json(text: str) -> Any:
    try:
        return json.loads(text)
    except ValueError as error:
        raise ListingError(f"the listing printed no JSON ({error})") from None


def entry_version(entry: Dict[str, Any], key: str) -> Optional[str]:
    value = entry.get(key)
    return value if isinstance(value, str) and value else None


class ClaudeCopy(NamedTuple):
    """What Claude Code's listing holds for a project root: whether a Gurita copy is installed
    there and its version, every scope holding an applying entry (the winning one first), the
    winning scope, and whether the winning entry is disabled."""

    installed: bool
    version: Optional[str]
    scopes: List[str]
    scope: Optional[str]
    disabled: bool


def claude_copy(text: str, root: str) -> ClaudeCopy:
    """Which Gurita copies Claude Code's listing holds for `root`, and the one that wins."""
    entries = parse_json(text)
    if not isinstance(entries, list):
        raise ListingError("the listing is not a JSON array")
    applying: Dict[str, Dict[str, Any]] = {}
    for entry in entries:
        if not isinstance(entry, dict) or entry.get("id") != CLAUDE_PLUGIN_ID:
            continue
        scope = entry.get("scope")
        if scope not in SCOPE_RANK:
            continue
        if scope in PROJECT_SCOPES:
            project = entry.get("projectPath")
            if not isinstance(project, str) or not same_path(project, root):
                continue
        applying.setdefault(scope, entry)
    scopes = sorted(applying, key=lambda name: SCOPE_RANK[name], reverse=True)
    if not scopes:
        return ClaudeCopy(False, None, [], None, False)
    winner = applying[scopes[0]]
    if winner.get("enabled") is False:
        return ClaudeCopy(False, None, scopes, scopes[0], True)
    key = "folderVersion" if "readFromFolder" in winner else "version"
    return ClaudeCopy(True, entry_version(winner, key), scopes, scopes[0], False)


class Copy(NamedTuple):
    """What Antigravity's or Codex's listing holds: whether an enabled Gurita copy is installed
    and its version, and whether the copy it holds is installed but disabled."""

    installed: bool
    version: Optional[str]
    disabled: bool


NOT_INSTALLED = Copy(False, None, False)
DISABLED = Copy(False, None, True)


def antigravity_copy(text: str) -> Copy:
    """Whether Antigravity's listing holds an enabled Gurita copy and its version, or a disabled one."""
    entries = parse_json(text)
    if not isinstance(entries, list):
        raise ListingError("the listing is not a JSON array")
    for entry in entries:
        if isinstance(entry, dict) and entry.get("name") == ANTIGRAVITY_PLUGIN_NAME:
            if entry.get("enabled") is False:
                return DISABLED
            return Copy(True, entry_version(entry, "version"), False)
    return NOT_INSTALLED


def codex_copy(text: str) -> Copy:
    """Whether Codex's listing holds an installed, enabled Gurita copy and its version, or an
    installed, disabled one."""
    listing = parse_json(text)
    installed = listing.get("installed") if isinstance(listing, dict) else None
    if not isinstance(installed, list):
        raise ListingError("the listing holds no `installed` array")
    for entry in installed:
        if isinstance(entry, dict) and entry.get("pluginId") == CODEX_PLUGIN_ID:
            if entry.get("installed") is False:
                return NOT_INSTALLED
            if entry.get("enabled") is False:
                return DISABLED
            return Copy(True, entry_version(entry, "version"), False)
    return NOT_INSTALLED


def read_copy(key: str, text: str) -> Copy:
    """Antigravity's or Codex's copy, by the harness's key."""
    if key == ANTIGRAVITY:
        return antigravity_copy(text)
    return codex_copy(text)


def read_file(path: str) -> Optional[str]:
    try:
        with open(path, encoding="utf-8", errors="replace") as handle:
            return handle.read()
    except OSError:
        return None


def harness_result(key: str, run_dir: str, root: str) -> Dict[str, Any]:
    """One harness's result from the files the session wrote for it in `run_dir`."""
    base = os.path.join(run_dir, key)
    result: Dict[str, Any] = {"found": False, "installed": False, "version": None, "disabled": False}
    if key == CLAUDE:
        result.update({"scopes": [], "scope": None})
    if not os.path.exists(base + FOUND_SUFFIX):
        return result
    result["found"] = True
    status = read_file(base + STATUS_SUFFIX)
    try:
        if status is None:
            raise ListingError("the listing did not finish")
        if status.strip() != "0":
            detail = (read_file(base + ERR_SUFFIX) or "").strip().splitlines()
            reason = f"the listing exited with status {status.strip()}"
            raise ListingError(f"{reason}: {detail[-1]}" if detail else reason)
        text = read_file(base + OUT_SUFFIX) or ""
        if key == CLAUDE:
            claude = claude_copy(text, root)
            installed, version, disabled = claude.installed, claude.version, claude.disabled
            result.update({"scopes": claude.scopes, "scope": claude.scope})
        else:
            installed, version, disabled = read_copy(key, text)
    except ListingError as error:
        result["error"] = str(error)
        return result
    result["installed"] = installed
    result["version"] = version
    result["disabled"] = disabled
    return result


def check(
    root: str,
    environ: Dict[str, str],
    session: Callable[[List[str], str, float], None] = run_session,
    timeout: float = SESSION_TIMEOUT,
) -> Dict[str, Dict[str, Any]]:
    """Every harness's result, the lookups and listings run in one session started at `root`."""
    if not os.path.isdir(root):
        raise CheckError(f"the project root {root} is not a directory")
    run_dir = tempfile.mkdtemp(prefix="gurita-check-")
    try:
        argv = runner.session_shell(environ) + ["-c", compose_script(run_dir)]
        session(argv, root, timeout)
        return {key: harness_result(key, run_dir, root) for key, _, _ in HARNESSES}
    finally:
        for name in os.listdir(run_dir):
            try:
                os.remove(os.path.join(run_dir, name))
            except OSError:
                pass
        try:
            os.rmdir(run_dir)
        except OSError:
            pass


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="harness_check.py",
        description="Print, as one JSON object, whether each harness's CLI is found in the "
        "runner's session shell and which version its installed Gurita copy reads.",
    )
    parser.add_argument(
        "--project",
        required=True,
        metavar="ROOT",
        help="the project root, which Claude Code's project and local entries are matched on",
    )
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        result = check(args.project, dict(os.environ), run_session)
    except CheckError as error:
        sys.stderr.write(f"Error: {error}\n")
        return 1
    sys.stdout.write(json.dumps(result) + "\n")
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())
