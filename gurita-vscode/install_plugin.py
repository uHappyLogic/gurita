#!/usr/bin/env python3
"""The Gurita for VS Code plugin install and update: what the install or update terminal runs.

Stdlib only, Python 3.9 or later, shipped in the extension's package beside `harness_check.py`
and runnable by hand outside the editor.

    install_plugin.py HARNESS ACTION

HARNESS is one of `claude`, `antigravity`, and `codex`, ACTION one of `install` and `update`.

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
"""

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Callable, Dict, List, Optional, Tuple

CLAUDE = "claude"
ANTIGRAVITY = "antigravity"
CODEX = "codex"
HARNESSES = (CLAUDE, ANTIGRAVITY, CODEX)

INSTALL = "install"
UPDATE = "update"
ACTIONS = (INSTALL, UPDATE)

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


Step = Callable[[str], int]
# The install and update steps, by harness and action, each run with the release's tag and
# returning the exit status.
STEPS: Dict[Tuple[str, str], Step] = {}


def run(
    harness: str,
    action: str,
    reads: Tuple[Tuple[str, Read], ...] = READS,
    steps: Optional[Dict[Tuple[str, str], Step]] = None,
) -> int:
    """Read the latest release's tag of `harness`'s distribution repository, then carry out
    `action` at that tag; the exit status."""
    steps = STEPS if steps is None else steps
    repository = REPOSITORY[harness]
    tag = latest_tag(repository, reads)
    sys.stdout.write(f"Latest release of {repository}: {tag}\n")
    sys.stdout.flush()
    step = steps.get((harness, action))
    if step is None:
        raise InstallError(f"this script holds no {action} for {harness}")
    return step(tag)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="install_plugin.py",
        description="Install or update the Gurita plugin on one harness from the latest "
        "published release of its distribution repository.",
    )
    parser.add_argument("harness", choices=HARNESSES, help="the harness to install or update on")
    parser.add_argument("action", choices=ACTIONS, help="whether to install or update")
    return parser


def main(
    argv: Optional[List[str]] = None,
    reads: Tuple[Tuple[str, Read], ...] = READS,
    steps: Optional[Dict[Tuple[str, str], Step]] = None,
) -> int:
    args = build_parser().parse_args(argv)
    try:
        return run(args.harness, args.action, reads, steps)
    except InstallError as error:
        sys.stdout.flush()
        sys.stderr.write(f"Error: {error}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
