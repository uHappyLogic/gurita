#!/usr/bin/env python3
"""The Gurita for VS Code plugin install and update: what the install or update terminal runs.

Stdlib only, Python 3.9 or later, shipped in the extension's package beside `harness_check.py`
and runnable by hand outside the editor.

    install_plugin.py HARNESS ACTION [--project ROOT] [--scope SCOPE]...

HARNESS is one of `claude`, `antigravity`, and `codex`, ACTION one of `install` and `update`.
ROOT is the project root a harness CLI's commands run at, the current directory when it is not
given; a ROOT that is not a directory prints one `Error:` line and exits 1. `--scope`, one of
`user`, `project`, and `local`, is taken by Claude Code alone and required there: an install
takes exactly one, the scope it installs at, and an update one or more, the scopes at which a
Gurita copy was detected. A scope given to another harness, a Claude Code install given none or
several, or an update given none prints one `Error:` line and exits 1. These refusals come
before the release lookup, so nothing is read and nothing runs.

Its first step reads the tag of the latest published release of the harness's distribution
repository (`uHappyLogic/gurita-claude`, `uHappyLogic/gurita-antigravity`,
`uHappyLogic/gurita-codex`), the release GitHub marks as latest: the `tag_name` of GitHub's
`releases/latest` endpoint (`https://api.github.com/repos/<repository>/releases/latest`) and,
when that read fails, the last path component of the `Location` the repository's
`/releases/latest` page (`https://github.com/<repository>/releases/latest`) redirects to,
`.../releases/tag/<tag>`, read from a HEAD request whose redirect is not followed. It prints the
tag it read in one line. When both reads fail it prints the cause of each in one `Error:` line
on stderr and exits with status 1 before any install, update, or marketplace command runs,
falling back to no other ref.

With the tag read it carries out ACTION for HARNESS at that tag; a harness and action whose
steps the script does not hold print one `Error:` line and exit 1.

On Claude Code the commands run as one chain in one session of the runner's session shell (its
`session_shell`: `$SHELL -i` for the sh, bash, zsh family, `/bin/sh` otherwise), started at
ROOT with the terminal's own input and output, each command behind the previous one's success,
so a harness CLI is found on the `PATH` a recipe run finds it on and any prompt is answerable in
the terminal. The marketplace source is `uHappyLogic/gurita-claude#<tag>`, the distribution
repository at the release's tag. An install at SCOPE runs
`claude plugin marketplace add --scope SCOPE <source>` and then
`claude plugin install gurita@gurita --scope SCOPE`. An update over its scopes, taken in the
order user, project, local whatever order they were given in, re-runs that marketplace add at
each of them with the new tag, moving the `gurita` declaration there and removing nothing, then
runs `claude plugin marketplace update gurita`, then `claude plugin update gurita@gurita -s
SCOPE` for each. A command that fails ends the chain, and the script exits with the session's
status, non-zero.

On Antigravity no shell pipeline and no `agy` command take part. Both actions download the
distribution repository's archive at the tag,
`https://github.com/uHappyLogic/gurita-antigravity/archive/refs/tags/<tag>.tar.gz`, with
`urllib`, and extract it with `tarfile`, stripped of its one top directory. The install extracts
it directly into `~/.gemini/config/plugins/gurita`. The update extracts it into a fresh staging
directory under `~/.gemini/config/`, outside `plugins/` and on the same filesystem, checks that
the staged copy's root `plugin.json` is present and reads its version, and only then removes the
old `gurita` directory and renames the staged one into its place, keeping no backup; a staged
copy failing its check is discarded with the old directory left untouched. Either action
refuses, with one `Error:` line and exit 1, an archive that cannot be downloaded or read, that
holds no single top directory, or that holds a member other than a file or directory or one
reaching outside the directory it is extracted into.
"""

import argparse
import io
import json
import os
import shlex
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path, PurePosixPath
from typing import Callable, Dict, List, NamedTuple, Optional, Sequence, Tuple

# The extension's directory is packaged into the VSIX, so importing the runner from it must
# leave no __pycache__ behind there.
sys.dont_write_bytecode = True

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import runner  # noqa: E402

CLAUDE = "claude"
ANTIGRAVITY = "antigravity"
CODEX = "codex"
HARNESSES = (CLAUDE, ANTIGRAVITY, CODEX)

INSTALL = "install"
UPDATE = "update"
ACTIONS = (INSTALL, UPDATE)

# Claude Code's scopes, in the order an update takes them.
SCOPES = ("user", "project", "local")

# Each harness's distribution repository, as GitHub's `owner/repo`.
REPOSITORY = {
    CLAUDE: "uHappyLogic/gurita-claude",
    ANTIGRAVITY: "uHappyLogic/gurita-antigravity",
    CODEX: "uHappyLogic/gurita-codex",
}

ENDPOINT_URL = "https://api.github.com/repos/{repository}/releases/latest"
PAGE_URL = "https://github.com/{repository}/releases/latest"
REDIRECT_CODES = (301, 302, 303, 307, 308)
READ_TIMEOUT = 30

# A tag the later steps may pass on as a ref: no whitespace, quoting, or path separator.
TAG_CHARACTERS = frozenset("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._+-")


class InstallError(Exception):
    """A refusal reported as one `Error:` line."""


class ReadError(Exception):
    """One read of the latest release that failed, carrying its cause."""


def checked_tag(tag: object) -> str:
    """The tag a read gave, or a ReadError when it is not one the later steps may pass on."""
    if not isinstance(tag, str) or not tag:
        raise ReadError("it named no tag")
    if not set(tag) <= TAG_CHARACTERS or tag[0] in ".-":
        raise ReadError(f"it named the tag {tag!r}, which is not a plain release tag")
    return tag


def describe(error: BaseException) -> str:
    """One line saying why a request failed."""
    if isinstance(error, urllib.error.HTTPError):
        return f"HTTP status {error.code}{' ' + error.reason if error.reason else ''}"
    if isinstance(error, urllib.error.URLError):
        return f"no answer ({error.reason})"
    return f"no answer ({error})"


def open_url(request: urllib.request.Request, timeout: float) -> object:
    """Open `request`, following redirects."""
    return urllib.request.urlopen(request, timeout=timeout)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    """A redirect handler that follows no redirect, so the redirect itself is answered as an
    HTTPError carrying its status and `Location`."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        return None


def open_url_unredirected(request: urllib.request.Request, timeout: float) -> object:
    """Open `request`, following no redirect."""
    return urllib.request.build_opener(NoRedirect).open(request, timeout=timeout)


def endpoint_tag(repository: str, opener: Callable[..., object] = open_url) -> str:
    """The `tag_name` GitHub's `releases/latest` endpoint gives for `repository`."""
    request = urllib.request.Request(ENDPOINT_URL.format(repository=repository))
    try:
        with opener(request, timeout=READ_TIMEOUT) as response:  # type: ignore[attr-defined]
            body = response.read()
    except (urllib.error.URLError, OSError, ValueError) as error:
        raise ReadError(describe(error)) from None
    try:
        release = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        raise ReadError("it answered no JSON") from None
    if not isinstance(release, dict):
        raise ReadError("it answered no JSON object")
    return checked_tag(release.get("tag_name"))


def redirect_tag(repository: str, opener: Callable[..., object] = open_url_unredirected) -> str:
    """The tag the repository's `/releases/latest` page redirects to, the last path component of
    its `Location`, read with the redirect not followed."""
    request = urllib.request.Request(PAGE_URL.format(repository=repository), method="HEAD")
    try:
        with opener(request, timeout=READ_TIMEOUT):  # type: ignore[attr-defined]
            pass
    except urllib.error.HTTPError as error:
        if error.code not in REDIRECT_CODES:
            raise ReadError(describe(error)) from None
        location = error.headers.get("Location") if error.headers is not None else None
    except (urllib.error.URLError, OSError, ValueError) as error:
        raise ReadError(describe(error)) from None
    else:
        raise ReadError("it answered with no redirect")
    if not location:
        raise ReadError("it redirected to no location")
    path = urllib.parse.urlsplit(location).path.rstrip("/")
    parts = path.split("/")
    if len(parts) < 2 or parts[-2] != "tag":
        raise ReadError(f"it redirected to {location}, which names no release tag")
    return checked_tag(urllib.parse.unquote(parts[-1]))


Read = Callable[[str], str]
READS: Tuple[Tuple[str, Read], ...] = (
    ("the releases/latest endpoint", endpoint_tag),
    ("the /releases/latest page redirect", redirect_tag),
)


def latest_tag(repository: str, reads: Tuple[Tuple[str, Read], ...] = READS) -> str:
    """The latest published release's tag of `repository`, from the first of `reads` that
    answers, or an InstallError naming every read's cause when none does."""
    causes: List[str] = []
    for name, read in reads:
        try:
            return read(repository)
        except ReadError as error:
            causes.append(f"{name}: {error}")
    raise InstallError(
        f"the latest release of {repository} could not be read, so nothing was installed or "
        f"updated ({'; '.join(causes)})"
    )


class Target(NamedTuple):
    """Where a step acts: the project root a harness CLI's commands run at and, on Claude Code,
    the scopes it acts on, in the order user, project, local."""

    root: str
    scopes: Tuple[str, ...] = ()


# A step runs with the release's tag and its target and returns the exit status.
Step = Callable[[str, Target], int]


def resolve_target(harness: str, action: str, project: Optional[str], scopes: Optional[Sequence[str]]) -> Target:
    """The target the command line names, or an InstallError when its root is not a directory or
    its scopes do not fit the harness and action."""
    root = os.path.abspath(project if project is not None else os.getcwd())
    if not os.path.isdir(root):
        raise InstallError(f"the project root {root} is not a directory")
    given = list(scopes or ())
    if harness != CLAUDE:
        if given:
            raise InstallError(f"{harness} takes no --scope, its plugin being installed per user")
        return Target(root)
    ordered = tuple(scope for scope in SCOPES if scope in given)
    if not ordered:
        raise InstallError(f"a Claude Code {action} needs --scope")
    if action == INSTALL and len(given) != 1:
        raise InstallError("a Claude Code install takes exactly one --scope")
    return Target(root, ordered)


# The session the harness CLIs' commands run in.


def run_session(script: str, root: str, environ: Optional[Dict[str, str]] = None) -> int:
    """Run `script` in one session of the runner's session shell, started at `root` with the
    terminal's own input and output; the session's exit status, a session ended by a signal
    giving 128 plus its number."""
    environ = dict(os.environ) if environ is None else environ
    sys.stdout.flush()
    process = subprocess.Popen(runner.session_shell(environ) + ["-c", script], cwd=root, env=environ)
    status = runner.wait_for_shell(process)
    return 128 - status if status < 0 else status


def chain(commands: Sequence[Sequence[str]]) -> str:
    """The session script running `commands` in order, each behind the previous one's success,
    every word quoted."""
    return " && ".join(" ".join(shlex.quote(word) for word in command) for command in commands) + "\n"


Session = Callable[[str, str], int]


# Claude Code: the marketplace registered at the scope from the distribution repository at the
# tag, then the plugin installed or updated there.

CLAUDE_CLI = "claude"
CLAUDE_MARKETPLACE = "gurita"
CLAUDE_PLUGIN_ID = "gurita@gurita"


def claude_source(tag: str) -> str:
    """The marketplace source naming the distribution repository at `tag`."""
    return f"{REPOSITORY[CLAUDE]}#{tag}"


def claude_marketplace_add(tag: str, scope: str) -> List[str]:
    return [CLAUDE_CLI, "plugin", "marketplace", "add", "--scope", scope, claude_source(tag)]


def claude_install_commands(tag: str, scope: str) -> List[List[str]]:
    """An install at `scope`: the marketplace added there at `tag`, then the plugin installed."""
    return [
        claude_marketplace_add(tag, scope),
        [CLAUDE_CLI, "plugin", "install", CLAUDE_PLUGIN_ID, "--scope", scope],
    ]


def claude_update_commands(tag: str, scopes: Sequence[str]) -> List[List[str]]:
    """An update over `scopes`: the marketplace re-added at each at `tag`, the marketplace
    refreshed, then the plugin updated at each."""
    return (
        [claude_marketplace_add(tag, scope) for scope in scopes]
        + [[CLAUDE_CLI, "plugin", "marketplace", "update", CLAUDE_MARKETPLACE]]
        + [[CLAUDE_CLI, "plugin", "update", CLAUDE_PLUGIN_ID, "-s", scope] for scope in scopes]
    )


def install_claude(tag: str, target: Target, session: Session = run_session) -> int:
    """Install the release at `tag` at the target's one scope."""
    return session(chain(claude_install_commands(tag, target.scopes[0])), target.root)


def update_claude(tag: str, target: Target, session: Session = run_session) -> int:
    """Move every target scope to the release at `tag`."""
    return session(chain(claude_update_commands(tag, target.scopes)), target.root)


# Antigravity: the archive at the tag, extracted into the global plugin directory.

ARCHIVE_URL = "https://github.com/{repository}/archive/refs/tags/{tag}.tar.gz"
DOWNLOAD_TIMEOUT = 120
STAGING_PREFIX = ".gurita-staging-"


def gemini_config_dir(home: Optional[Path] = None) -> Path:
    """`~/.gemini/config`, under `home` when one is given."""
    return (Path.home() if home is None else home) / ".gemini" / "config"


def antigravity_plugin_dir(home: Optional[Path] = None) -> Path:
    """`~/.gemini/config/plugins/gurita`, the directory Antigravity loads the plugin from in
    every project."""
    return gemini_config_dir(home) / "plugins" / "gurita"


def download_archive(url: str, opener: Callable[..., object] = open_url) -> bytes:
    """The bytes `url` answers with, following redirects."""
    request = urllib.request.Request(url)
    try:
        with opener(request, timeout=DOWNLOAD_TIMEOUT) as response:  # type: ignore[attr-defined]
            return response.read()
    except (urllib.error.URLError, OSError, ValueError) as error:
        raise InstallError(f"the archive {url} could not be downloaded ({describe(error)})") from None


def stripped_members(archive: tarfile.TarFile, url: str) -> List[tarfile.TarInfo]:
    """The archive's members with its one top directory stripped from their names, the top
    directory itself left out; an InstallError when the archive holds no single top directory,
    a member other than a file or directory, or a name reaching outside the directory."""
    members = archive.getmembers()
    tops = {PurePosixPath(member.name).parts[0] for member in members if PurePosixPath(member.name).parts}
    if len(tops) != 1:
        raise InstallError(f"the archive {url} holds no single top directory")
    stripped: List[tarfile.TarInfo] = []
    for member in members:
        path = PurePosixPath(member.name)
        if member.name.startswith("/") or ".." in path.parts:
            raise InstallError(f"the archive {url} holds {member.name!r}, which reaches outside its directory")
        if not (member.isfile() or member.isdir()):
            raise InstallError(f"the archive {url} holds {member.name!r}, which is neither a file nor a directory")
        if len(path.parts) == 1:
            if not member.isdir():
                raise InstallError(f"the archive {url} holds no single top directory")
            continue
        member.name = str(PurePosixPath(*path.parts[1:]))
        stripped.append(member)
    return stripped


def extract_archive(data: bytes, url: str, destination: Path) -> None:
    """Extract the gzipped tar archive `data`, stripped of its top directory, into
    `destination`, which is created when missing."""
    try:
        with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
            members = stripped_members(archive, url)
            destination.mkdir(parents=True, exist_ok=True)
            if hasattr(tarfile, "data_filter"):
                archive.extractall(destination, members=members, filter="data")  # type: ignore[call-arg]
            else:
                archive.extractall(destination, members=members)
    except (tarfile.TarError, EOFError, OSError, ValueError) as error:
        raise InstallError(f"the archive {url} could not be extracted ({error})") from None


def plugin_version(directory: Path) -> str:
    """The version the root `plugin.json` of `directory` carries, or an InstallError when it is
    absent or carries none."""
    manifest = directory / "plugin.json"
    try:
        document = json.loads(manifest.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise InstallError("the downloaded release holds no root plugin.json") from None
    except (OSError, UnicodeDecodeError, ValueError) as error:
        raise InstallError(f"the downloaded release's plugin.json could not be read ({error})") from None
    version = document.get("version") if isinstance(document, dict) else None
    if not isinstance(version, str) or not version:
        raise InstallError("the downloaded release's plugin.json carries no version")
    return version


def antigravity_archive(tag: str, opener: Callable[..., object]) -> Tuple[str, bytes]:
    url = ARCHIVE_URL.format(repository=REPOSITORY[ANTIGRAVITY], tag=tag)
    sys.stdout.write(f"Downloading {url}\n")
    sys.stdout.flush()
    return url, download_archive(url, opener)


def install_antigravity(
    tag: str,
    target: Optional[Target] = None,
    home: Optional[Path] = None,
    opener: Callable[..., object] = open_url,
) -> int:
    """Download the release at `tag` and extract it directly into the plugin directory; the
    target is not read, the plugin being installed per user."""
    url, data = antigravity_archive(tag, opener)
    destination = antigravity_plugin_dir(home)
    extract_archive(data, url, destination)
    sys.stdout.write(f"Installed Gurita {tag} into {destination}\n")
    return 0


def update_antigravity(
    tag: str,
    target: Optional[Target] = None,
    home: Optional[Path] = None,
    opener: Callable[..., object] = open_url,
) -> int:
    """Download the release at `tag` into a staging directory, check it, and only then replace
    the plugin directory with it, keeping no backup; the target is not read."""
    url, data = antigravity_archive(tag, opener)
    destination = antigravity_plugin_dir(home)
    config = gemini_config_dir(home)
    try:
        config.mkdir(parents=True, exist_ok=True)
        staging_root = Path(tempfile.mkdtemp(prefix=STAGING_PREFIX, dir=str(config)))
    except OSError as error:
        raise InstallError(f"no staging directory could be made under {config} ({error})") from None
    try:
        staged = staging_root / "gurita"
        try:
            extract_archive(data, url, staged)
            version = plugin_version(staged)
        except InstallError as error:
            raise InstallError(f"{error}; {destination} was left as it stands") from None
        try:
            if destination.is_symlink() or destination.is_file():
                destination.unlink()
            elif destination.exists():
                shutil.rmtree(str(destination))
            destination.parent.mkdir(parents=True, exist_ok=True)
            os.rename(str(staged), str(destination))
        except OSError as error:
            raise InstallError(f"{destination} could not be replaced with the new release ({error})") from None
    finally:
        shutil.rmtree(str(staging_root), ignore_errors=True)
    sys.stdout.write(f"Updated Gurita to {version} in {destination}\n")
    return 0


# The install and update steps, by harness and action, each run with the release's tag and its
# target and returning the exit status.
STEPS: Dict[Tuple[str, str], Step] = {
    (CLAUDE, INSTALL): install_claude,
    (CLAUDE, UPDATE): update_claude,
    (ANTIGRAVITY, INSTALL): install_antigravity,
    (ANTIGRAVITY, UPDATE): update_antigravity,
}


def run(
    harness: str,
    action: str,
    target: Target,
    reads: Tuple[Tuple[str, Read], ...] = READS,
    steps: Optional[Dict[Tuple[str, str], Step]] = None,
) -> int:
    """Read the latest release's tag of `harness`'s distribution repository, then carry out
    `action` at that tag on `target`; the exit status."""
    steps = STEPS if steps is None else steps
    repository = REPOSITORY[harness]
    tag = latest_tag(repository, reads)
    sys.stdout.write(f"Latest release of {repository}: {tag}\n")
    sys.stdout.flush()
    step = steps.get((harness, action))
    if step is None:
        raise InstallError(f"this script holds no {action} for {harness}")
    return step(tag, target)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="install_plugin.py",
        description="Install or update the Gurita plugin on one harness from the latest "
        "published release of its distribution repository.",
    )
    parser.add_argument("harness", choices=HARNESSES, help="the harness to install or update on")
    parser.add_argument("action", choices=ACTIONS, help="whether to install or update")
    parser.add_argument(
        "--project",
        metavar="ROOT",
        help="the project root the harness CLI's commands run at (default: the current directory)",
    )
    parser.add_argument(
        "--scope",
        action="append",
        choices=SCOPES,
        help="a Claude Code scope: the one an install installs at, or, repeated, each one an "
        "update acts on",
    )
    return parser


def main(
    argv: Optional[List[str]] = None,
    reads: Tuple[Tuple[str, Read], ...] = READS,
    steps: Optional[Dict[Tuple[str, str], Step]] = None,
) -> int:
    args = build_parser().parse_args(argv)
    try:
        target = resolve_target(args.harness, args.action, args.project, args.scope)
        return run(args.harness, args.action, target, reads, steps)
    except InstallError as error:
        sys.stdout.flush()
        sys.stderr.write(f"Error: {error}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
