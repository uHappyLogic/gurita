"""The install script, gurita-vscode/install_plugin.py: its first step, reading the tag of the
latest published release of the harness's distribution repository through GitHub's
`releases/latest` endpoint and, when that fails, through the `/releases/latest` page redirect,
with the two reads stubbed: the endpoint answering, only the redirect answering, and both
failing, which prints the cause and exits non-zero before any install or update step runs, with
no other ref fallen back to. The reads' own handling of an answer is driven through a stand-in
opener, so no test contacts the network. The Antigravity install and staged-swap update run
against local archives under an overridden home: a fresh install, an update leaving exactly what
the new release ships, and a staged copy failing its check with the old directory untouched. The
Claude Code install and update run in the runner's session shell against a stand-in `claude` on
`PATH` that records each call, its arguments and the directory it ran in: an install at each
scope, an update over one scope and over several, and a failing command ending the run with a
non-zero status. The Codex install and update run the same way against a stand-in `codex`: the
install's marketplace add at the tag and plugin add, the update's marketplace remove, add, and
plugin add in that order with no plugin removed, and an update stopped by a failed step running
none of the steps after it. With `--wait` the script waits for a keypress once the run is over,
its exit status kept, the wait recorded rather than waited for."""

import io
import json
import os
import stat
import tarfile
import urllib.error
import urllib.request
from email.message import Message
from pathlib import Path

import pytest

import install_plugin as install_plugin_module


@pytest.fixture
def install():
    """The install script module."""
    return install_plugin_module


class Recorder:
    """Stub reads and steps, recording every call in order."""

    def __init__(self):
        self.calls = []

    def answering(self, name, tag):
        def read(repository):
            self.calls.append((name, repository))
            return tag

        return read

    def failing(self, name, install, cause):
        def read(repository):
            self.calls.append((name, repository))
            raise install.ReadError(cause)

        return read

    def step(self, name, status=0):
        def run(tag, target):
            self.calls.append((name, tag))
            return status

        return run


def stub_reads(install, recorder, endpoint=None, redirect=None):
    """The two reads, each answering the tag given or failing when given None."""
    reads = []
    for name, tag in (("endpoint", endpoint), ("redirect", redirect)):
        if tag is None:
            reads.append((name, recorder.failing(name, install, f"{name} unreachable")))
        else:
            reads.append((name, recorder.answering(name, tag)))
    return tuple(reads)


def arguments(harness, action):
    """The command line naming `harness` and `action`, with the one scope Claude Code needs."""
    return [harness, action] + (["--scope", "user"] if harness == "claude" else [])


def all_steps(recorder):
    return {
        (harness, action): recorder.step(f"{harness} {action}")
        for harness in ("claude", "antigravity", "codex")
        for action in ("install", "update")
    }


# The lookup as the script's first step


@pytest.mark.parametrize(
    "harness,repository",
    [
        ("claude", "uHappyLogic/gurita-claude"),
        ("antigravity", "uHappyLogic/gurita-antigravity"),
        ("codex", "uHappyLogic/gurita-codex"),
    ],
)
def test_endpoint_answering_gives_its_tag_and_the_redirect_is_not_read(install, capsys, harness, repository):
    recorder = Recorder()
    reads = stub_reads(install, recorder, endpoint="2.1.0", redirect="9.9.9")
    status = install.main(arguments(harness, "install"), reads, all_steps(recorder))
    assert status == 0
    assert recorder.calls == [("endpoint", repository), (f"{harness} install", "2.1.0")]
    assert capsys.readouterr().out == f"Latest release of {repository}: 2.1.0\n"


def test_only_the_redirect_answering_gives_its_tag(install, capsys):
    recorder = Recorder()
    reads = stub_reads(install, recorder, endpoint=None, redirect="2.1.0")
    status = install.main(["codex", "update"], reads, all_steps(recorder))
    assert status == 0
    assert recorder.calls == [
        ("endpoint", "uHappyLogic/gurita-codex"),
        ("redirect", "uHappyLogic/gurita-codex"),
        ("codex update", "2.1.0"),
    ]
    out = capsys.readouterr()
    assert out.out == "Latest release of uHappyLogic/gurita-codex: 2.1.0\n"
    assert out.err == ""


def test_both_reads_failing_prints_the_cause_and_exits_non_zero_before_any_step(install, capsys):
    recorder = Recorder()
    reads = stub_reads(install, recorder, endpoint=None, redirect=None)
    status = install.main(arguments("claude", "install"), reads, all_steps(recorder))
    assert status != 0
    assert recorder.calls == [
        ("endpoint", "uHappyLogic/gurita-claude"),
        ("redirect", "uHappyLogic/gurita-claude"),
    ]
    out = capsys.readouterr()
    assert out.out == ""
    lines = out.err.splitlines()
    assert len(lines) == 1
    assert lines[0].startswith("Error: the latest release of uHappyLogic/gurita-claude could not be read")
    assert "endpoint: endpoint unreachable" in lines[0]
    assert "redirect: redirect unreachable" in lines[0]


def test_a_step_status_is_the_exit_status(install):
    recorder = Recorder()
    reads = stub_reads(install, recorder, endpoint="2.1.0")
    steps = {("antigravity", "update"): recorder.step("antigravity update", status=3)}
    assert install.main(["antigravity", "update"], reads, steps) == 3


def test_a_harness_and_action_with_no_step_is_refused_after_the_lookup(install, capsys):
    recorder = Recorder()
    reads = stub_reads(install, recorder, endpoint="2.1.0")
    assert install.main(arguments("claude", "update"), reads, {}) == 1
    assert capsys.readouterr().err == "Error: this script holds no update for claude\n"


def test_an_unknown_harness_is_refused_by_the_parser(install):
    with pytest.raises(SystemExit) as stopped:
        install.main(["vscode", "install"], (), {})
    assert stopped.value.code == 2


# The keypress the extension's terminal waits for


@pytest.fixture
def keypresses(install, monkeypatch):
    """Every wait for a keypress the script makes, recorded instead of waited for."""
    waits = []
    monkeypatch.setattr(install.runner, "wait_for_key", lambda: waits.append("wait"))
    return waits


@pytest.mark.parametrize("status", [0, 3])
def test_wait_waits_for_a_keypress_after_the_run_keeping_its_status(install, keypresses, status):
    recorder = Recorder()
    reads = stub_reads(install, recorder, endpoint="2.1.0")
    steps = {("codex", "install"): recorder.step("codex install", status=status)}
    assert install.main(["codex", "install", "--wait"], reads, steps) == status
    assert recorder.calls == [("endpoint", "uHappyLogic/gurita-codex"), ("codex install", "2.1.0")]
    assert keypresses == ["wait"]


def test_wait_waits_after_a_failed_lookup_too(install, keypresses, capsys):
    recorder = Recorder()
    reads = stub_reads(install, recorder)
    assert install.main(["antigravity", "update", "--wait"], reads, all_steps(recorder)) == 1
    assert capsys.readouterr().err.startswith("Error: the latest release of uHappyLogic/gurita-antigravity could not be read")
    assert keypresses == ["wait"]


def test_without_wait_the_script_exits_with_no_keypress(install, keypresses):
    recorder = Recorder()
    reads = stub_reads(install, recorder, endpoint="2.1.0")
    assert install.main(["antigravity", "install"], reads, all_steps(recorder)) == 0
    assert keypresses == []


def test_the_keypress_wait_returns_at_once_with_no_terminal(install, monkeypatch, capsys):
    monkeypatch.setattr("sys.stdin", io.StringIO(""))
    install.runner.wait_for_key()
    assert capsys.readouterr().out == ""


# The two reads, through a stand-in opener


class Response(io.BytesIO):
    """A response body usable as the context manager `urlopen` returns."""


def headers(**fields):
    message = Message()
    for key, value in fields.items():
        message[key] = value
    return message


def http_error(url, code, **fields):
    return urllib.error.HTTPError(url, code, "Found" if code == 302 else "Not Found", headers(**fields), io.BytesIO(b""))


def opener_returning(body, seen):
    def opener(request, timeout):
        seen.append((request.get_method(), request.full_url))
        return Response(body)

    return opener


def opener_raising(error, seen):
    def opener(request, timeout):
        seen.append((request.get_method(), request.full_url))
        raise error

    return opener


def test_endpoint_read_takes_the_tag_name(install):
    seen = []
    body = json.dumps({"tag_name": "2.0.0", "name": "2.0.0", "draft": False}).encode()
    assert install.endpoint_tag("uHappyLogic/gurita-claude", opener_returning(body, seen)) == "2.0.0"
    assert seen == [("GET", "https://api.github.com/repos/uHappyLogic/gurita-claude/releases/latest")]


@pytest.mark.parametrize(
    "error",
    [
        http_error("u", 404),
        urllib.error.URLError("nodename nor servname provided"),
        TimeoutError("timed out"),
    ],
)
def test_endpoint_read_failing_is_a_read_error(install, error):
    with pytest.raises(install.ReadError):
        install.endpoint_tag("uHappyLogic/gurita-claude", opener_raising(error, []))


@pytest.mark.parametrize("body", [b"not json", b"[]", json.dumps({"name": "2.0.0"}).encode(),
                                  json.dumps({"tag_name": "2.0.0; rm -rf ~"}).encode()])
def test_endpoint_answer_naming_no_plain_tag_is_a_read_error(install, body):
    with pytest.raises(install.ReadError):
        install.endpoint_tag("uHappyLogic/gurita-claude", opener_returning(body, []))


def test_redirect_read_takes_the_last_path_component_of_the_location(install):
    seen = []
    location = "https://github.com/uHappyLogic/gurita-codex/releases/tag/2.0.0"
    error = http_error("u", 302, Location=location)
    assert install.redirect_tag("uHappyLogic/gurita-codex", opener_raising(error, seen)) == "2.0.0"
    assert seen == [("HEAD", "https://github.com/uHappyLogic/gurita-codex/releases/latest")]


@pytest.mark.parametrize(
    "error",
    [
        http_error("u", 404),
        http_error("u", 302),
        http_error("u", 302, Location="https://github.com/uHappyLogic/gurita-codex/releases"),
        urllib.error.URLError("no route"),
    ],
)
def test_redirect_read_naming_no_tag_is_a_read_error(install, error):
    with pytest.raises(install.ReadError):
        install.redirect_tag("uHappyLogic/gurita-codex", opener_raising(error, []))


def test_redirect_read_answered_with_no_redirect_is_a_read_error(install):
    with pytest.raises(install.ReadError):
        install.redirect_tag("uHappyLogic/gurita-codex", opener_returning(b"", []))


def test_the_redirect_opener_follows_no_redirect(install):
    handler = install.NoRedirect()
    request = urllib.request.Request("https://github.com/x/y/releases/latest", method="HEAD")
    assert handler.redirect_request(request, None, 302, "Found", headers(), "https://example.com/") is None


# Antigravity: install and staged-swap update, against a local archive and an overridden home


ANTIGRAVITY_URL = "https://github.com/uHappyLogic/gurita-antigravity/archive/refs/tags/{tag}.tar.gz"


def release_files(version, extra=None):
    """A release tree's files, by path relative to its root."""
    files = {
        "plugin.json": json.dumps({"name": "gurita", "version": version}) + "\n",
        "README.md": f"# Gurita {version}\n",
        "skills/complete-task/SKILL.md": f"complete-task {version}\n",
        "agents/complete-task.md": f"agent {version}\n",
        "tools/open_questions.py": f"# tool {version}\n",
    }
    files.update(extra or {})
    return files


def archive_bytes(files, top="gurita-antigravity-2.1.0", links=()):
    """A gzipped tar archive holding `files` beneath one top directory, as GitHub serves it."""
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as archive:
        directories = set()
        for path in files:
            parts = path.split("/")[:-1]
            for depth in range(len(parts) + 1):
                directories.add("/".join(filter(None, [top] + parts[:depth])) if top else "/".join(parts[:depth]))
        for directory in sorted(d for d in directories if d):
            info = tarfile.TarInfo(directory)
            info.type = tarfile.DIRTYPE
            info.mode = 0o755
            archive.addfile(info)
        for path, text in files.items():
            data = text.encode()
            info = tarfile.TarInfo(f"{top}/{path}" if top else path)
            info.size = len(data)
            info.mode = 0o644
            archive.addfile(info, io.BytesIO(data))
        for name, target in links:
            info = tarfile.TarInfo(name)
            info.type = tarfile.SYMTYPE
            info.linkname = target
            archive.addfile(info)
    return buffer.getvalue()


def tree(directory):
    """Every file under `directory`, by relative path, with its text."""
    return {
        str(path.relative_to(directory)).replace(os.sep, "/"): path.read_text()
        for path in sorted(directory.rglob("*"))
        if path.is_file()
    }


def archive_opener(data, seen):
    def opener(request, timeout):
        seen.append(request.full_url)
        return Response(data)

    return opener


@pytest.fixture
def home(tmp_path):
    directory = tmp_path / "home"
    directory.mkdir()
    return directory


def plugin_dir(home):
    return home / ".gemini" / "config" / "plugins" / "gurita"


def test_fresh_install_extracts_the_release_stripped_of_its_top_directory(install, home, capsys):
    seen = []
    files = release_files("2.1.0")
    status = install.install_antigravity("2.1.0", home=home, opener=archive_opener(archive_bytes(files), seen))
    assert status == 0
    assert seen == [ANTIGRAVITY_URL.format(tag="2.1.0")]
    assert tree(plugin_dir(home)) == files
    assert sorted(p.name for p in (home / ".gemini" / "config").iterdir()) == ["plugins"]
    out = capsys.readouterr().out
    assert f"Downloading {ANTIGRAVITY_URL.format(tag='2.1.0')}" in out
    assert f"Installed Gurita 2.1.0 into {plugin_dir(home)}" in out


def test_install_through_main_reads_the_home_and_downloads_with_urllib(install, home, tmp_path, monkeypatch, capsys):
    served = tmp_path / "served"
    archive = served / "uHappyLogic" / "gurita-antigravity" / "2.1.0.tar.gz"
    archive.parent.mkdir(parents=True)
    files = release_files("2.1.0")
    archive.write_bytes(archive_bytes(files))
    monkeypatch.setattr(install, "ARCHIVE_URL", served.as_uri() + "/{repository}/{tag}.tar.gz")
    monkeypatch.setenv("HOME", str(home))
    recorder = Recorder()
    status = install.main(["antigravity", "install"], stub_reads(install, recorder, endpoint="2.1.0"))
    assert status == 0
    assert tree(plugin_dir(home)) == files
    assert capsys.readouterr().err == ""


def test_update_leaves_exactly_what_the_new_release_ships(install, home, capsys):
    old = release_files("2.0.0", {"skills/retired-skill/SKILL.md": "retired\n", "notes.txt": "local\n"})
    assert install.install_antigravity("2.0.0", home=home, opener=archive_opener(archive_bytes(old, "gurita-antigravity-2.0.0"), [])) == 0
    (plugin_dir(home) / "hand-added.md").write_text("added by hand\n")
    new = release_files("2.1.0")
    seen = []
    status = install.update_antigravity("2.1.0", home=home, opener=archive_opener(archive_bytes(new), seen))
    assert status == 0
    assert seen == [ANTIGRAVITY_URL.format(tag="2.1.0")]
    assert tree(plugin_dir(home)) == new
    assert sorted(p.name for p in (home / ".gemini" / "config").iterdir()) == ["plugins"]
    assert sorted(p.name for p in plugin_dir(home).parent.iterdir()) == ["gurita"]
    assert f"Updated Gurita to 2.1.0 in {plugin_dir(home)}" in capsys.readouterr().out


def test_update_stages_outside_the_plugins_directory_on_the_same_filesystem_then_renames(install, home, monkeypatch):
    install.install_antigravity("2.0.0", home=home, opener=archive_opener(archive_bytes(release_files("2.0.0")), []))
    renames = []
    real_rename = os.rename

    def rename(source, target):
        source_path, target_path = Path(source), Path(target)
        renames.append((source_path, target_path, (source_path / "plugin.json").is_file(), target_path.exists()))
        assert os.stat(source_path).st_dev == os.stat(target_path.parent).st_dev
        real_rename(source, target)

    monkeypatch.setattr(install.os, "rename", rename)
    assert install.update_antigravity("2.1.0", home=home, opener=archive_opener(archive_bytes(release_files("2.1.0")), [])) == 0
    assert len(renames) == 1
    source, target, staged_checked, target_present = renames[0]
    config = home / ".gemini" / "config"
    assert target == plugin_dir(home)
    assert source.parent.parent == config
    assert config / "plugins" not in source.parents
    assert staged_checked and not target_present


@pytest.mark.parametrize(
    "files,cause",
    [
        ({"README.md": "no manifest\n", "skills/a/SKILL.md": "a\n"}, "holds no root plugin.json"),
        ({"plugin.json": json.dumps({"name": "gurita"}), "README.md": "x\n"}, "carries no version"),
        ({"plugin.json": "not json", "README.md": "x\n"}, "could not be read"),
    ],
)
def test_a_staged_copy_failing_its_check_leaves_the_old_directory_untouched(install, home, capsys, files, cause):
    old = release_files("2.0.0")
    install.install_antigravity("2.0.0", home=home, opener=archive_opener(archive_bytes(old, "gurita-antigravity-2.0.0"), []))
    before = tree(plugin_dir(home))
    capsys.readouterr()
    recorder = Recorder()
    steps = {("antigravity", "update"): lambda tag, target: install.update_antigravity(tag, home=home, opener=archive_opener(archive_bytes(files), []))}
    status = install.main(["antigravity", "update"], stub_reads(install, recorder, endpoint="2.1.0"), steps)
    assert status == 1
    assert tree(plugin_dir(home)) == before == old
    assert sorted(p.name for p in (home / ".gemini" / "config").iterdir()) == ["plugins"]
    lines = capsys.readouterr().err.splitlines()
    assert len(lines) == 1
    assert lines[0].startswith("Error: ")
    assert cause in lines[0]
    assert lines[0].endswith(f"{plugin_dir(home)} was left as it stands")


def test_a_failed_download_leaves_the_old_directory_untouched(install, home, capsys):
    old = release_files("2.0.0")
    install.install_antigravity("2.0.0", home=home, opener=archive_opener(archive_bytes(old, "gurita-antigravity-2.0.0"), []))
    with pytest.raises(install.InstallError, match="could not be downloaded"):
        install.update_antigravity("2.1.0", home=home, opener=opener_raising(http_error("u", 404), []))
    assert tree(plugin_dir(home)) == old
    assert sorted(p.name for p in (home / ".gemini" / "config").iterdir()) == ["plugins"]


@pytest.mark.parametrize(
    "data",
    [
        archive_bytes({"plugin.json": "{}", "README.md": "x\n"}, top=""),
        archive_bytes({"a/plugin.json": "{}", "b/README.md": "x\n"}, top=""),
        archive_bytes(release_files("2.1.0"), links=[("gurita-antigravity-2.1.0/link", "/etc/passwd")]),
        archive_bytes(release_files("2.1.0"))[:40],
    ],
    ids=["no-top-directory", "two-top-directories", "symlink", "truncated"],
)
def test_an_archive_that_cannot_be_extracted_safely_is_refused(install, home, data):
    with pytest.raises(install.InstallError):
        install.install_antigravity("2.1.0", home=home, opener=archive_opener(data, []))
    assert not plugin_dir(home).exists() or tree(plugin_dir(home)) == {}


def test_a_member_reaching_outside_the_directory_is_refused(install, home, tmp_path):
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as archive:
        for name in ("gurita-antigravity-2.1.0", "gurita-antigravity-2.1.0/../../escaped.txt"):
            info = tarfile.TarInfo(name)
            if name.endswith(".txt"):
                info.size = 1
                archive.addfile(info, io.BytesIO(b"x"))
            else:
                info.type = tarfile.DIRTYPE
                archive.addfile(info)
    with pytest.raises(install.InstallError, match="reaches outside"):
        install.install_antigravity("2.1.0", home=home, opener=archive_opener(buffer.getvalue(), []))
    assert not list(tmp_path.rglob("escaped.txt"))


def test_antigravity_steps_are_registered(install):
    assert install.STEPS[("antigravity", "install")] is install.install_antigravity
    assert install.STEPS[("antigravity", "update")] is install.update_antigravity


# Claude Code, against a stand-in `claude` recording its calls

STAND_IN_CLAUDE = """#!/bin/sh
{
  pwd -P
  for word in "$@"; do printf '\\t%s' "$word"; done
  printf '\\n'
} | tr -d '\\n' >>"$CLAUDE_CALLS"
printf '\\n' >>"$CLAUDE_CALLS"
if [ -n "$CLAUDE_FAIL" ]; then
  case "$*" in
    "$CLAUDE_FAIL") exit 3 ;;
  esac
fi
exit 0
"""


@pytest.fixture
def stand_in_claude(tmp_path, monkeypatch):
    """A stand-in `claude` first on `PATH`, appending one line per call to a log: the directory it
    ran in, then each argument, tab-separated. The session shell is the runner's fallback,
    `/bin/sh`, so no startup file of the person running the tests takes part."""
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    cli = bin_dir / "claude"
    cli.write_text(STAND_IN_CLAUDE)
    cli.chmod(cli.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    log = tmp_path / "claude_calls.log"
    monkeypatch.setenv("PATH", f"{bin_dir}{os.pathsep}{os.environ.get('PATH', '')}")
    monkeypatch.delenv("SHELL", raising=False)
    monkeypatch.delenv("CLAUDE_FAIL", raising=False)
    monkeypatch.setenv("CLAUDE_CALLS", str(log))
    return log


@pytest.fixture
def project(tmp_path):
    directory = tmp_path / "project"
    directory.mkdir()
    return directory


def recorded_calls(log):
    """Each recorded call as the directory it ran in and its argument list."""
    if not log.exists():
        return []
    calls = []
    for line in log.read_text().splitlines():
        directory, *words = line.split("\t")
        calls.append((directory, words))
    return calls


def run_claude(install, project, action, *scopes):
    argv = ["claude", action, "--project", str(project)]
    for scope in scopes:
        argv += ["--scope", scope]
    return install.main(argv, stub_reads(install, Recorder(), endpoint="2.1.0"))


SOURCE = "uHappyLogic/gurita-claude#2.1.0"


@pytest.mark.parametrize("scope", ["user", "project", "local"])
def test_claude_install_adds_the_marketplace_at_the_scope_then_installs_there(install, stand_in_claude, project, scope):
    assert run_claude(install, project, "install", scope) == 0
    root = os.path.realpath(project)
    assert recorded_calls(stand_in_claude) == [
        (root, ["plugin", "marketplace", "add", "--scope", scope, SOURCE]),
        (root, ["plugin", "install", "gurita@gurita", "--scope", scope]),
    ]


def test_claude_update_over_one_scope(install, stand_in_claude, project):
    assert run_claude(install, project, "update", "project") == 0
    root = os.path.realpath(project)
    assert recorded_calls(stand_in_claude) == [
        (root, ["plugin", "marketplace", "add", "--scope", "project", SOURCE]),
        (root, ["plugin", "marketplace", "update", "gurita"]),
        (root, ["plugin", "update", "gurita@gurita", "-s", "project"]),
    ]


def test_claude_update_over_several_scopes_takes_them_user_project_local(install, stand_in_claude, project):
    assert run_claude(install, project, "update", "local", "user", "project") == 0
    root = os.path.realpath(project)
    assert recorded_calls(stand_in_claude) == [
        (root, ["plugin", "marketplace", "add", "--scope", "user", SOURCE]),
        (root, ["plugin", "marketplace", "add", "--scope", "project", SOURCE]),
        (root, ["plugin", "marketplace", "add", "--scope", "local", SOURCE]),
        (root, ["plugin", "marketplace", "update", "gurita"]),
        (root, ["plugin", "update", "gurita@gurita", "-s", "user"]),
        (root, ["plugin", "update", "gurita@gurita", "-s", "project"]),
        (root, ["plugin", "update", "gurita@gurita", "-s", "local"]),
    ]


@pytest.mark.parametrize(
    "action,scopes,failing,ran",
    [
        ("install", ("project",), f"plugin marketplace add --scope project {SOURCE}", 1),
        ("update", ("user", "local"), "plugin marketplace update gurita", 3),
        ("update", ("user", "local"), "plugin update gurita@gurita -s user", 4),
    ],
)
def test_a_failing_claude_command_ends_the_run_with_a_non_zero_status(
    install, stand_in_claude, project, monkeypatch, action, scopes, failing, ran
):
    monkeypatch.setenv("CLAUDE_FAIL", failing)
    assert run_claude(install, project, action, *scopes) != 0
    calls = recorded_calls(stand_in_claude)
    assert len(calls) == ran
    assert " ".join(calls[-1][1]) == failing


def test_claude_runs_in_the_runners_session_shell_at_the_root(install, runner, project):
    seen = []

    def session(script, root):
        seen.append((script, root))
        return 0

    target = install.Target(str(project), ("user",))
    assert install.install_claude("2.1.0", target, session) == 0
    script, root = seen[0]
    assert root == str(project)
    assert script == (
        "claude plugin marketplace add --scope user 'uHappyLogic/gurita-claude#2.1.0' && "
        "claude plugin install gurita@gurita --scope user\n"
    )


def test_the_session_uses_the_runners_shell_and_the_terminals_own_streams(install, runner, project, monkeypatch):
    started = []

    class Process:
        def wait(self):
            return 5

    def popen(argv, **options):
        started.append((argv, options))
        return Process()

    monkeypatch.setattr(install.subprocess, "Popen", popen)
    environ = {"SHELL": "/bin/sh-not-in-family", "PATH": "/usr/bin"}
    assert install.run_session("true\n", str(project), environ) == 5
    argv, options = started[0]
    assert argv == runner.session_shell(environ) + ["-c", "true\n"]
    assert options == {"cwd": str(project), "env": environ}


@pytest.mark.parametrize(
    "argv,cause",
    [
        (["claude", "install"], "a Claude Code install needs --scope"),
        (["claude", "update"], "a Claude Code update needs --scope"),
        (["claude", "install", "--scope", "user", "--scope", "local"], "a Claude Code install takes exactly one --scope"),
        (["codex", "install", "--scope", "user"], "codex takes no --scope"),
        (["antigravity", "update", "--scope", "user"], "antigravity takes no --scope"),
    ],
)
def test_scopes_that_do_not_fit_are_refused_before_the_lookup(install, capsys, argv, cause):
    recorder = Recorder()
    status = install.main(argv, stub_reads(install, recorder, endpoint="2.1.0"), all_steps(recorder))
    assert status == 1
    assert recorder.calls == []
    err = capsys.readouterr().err
    assert err.count("\n") == 1
    assert err.startswith(f"Error: {cause}")


def test_a_project_root_that_is_not_a_directory_is_refused_before_the_lookup(install, tmp_path, capsys):
    recorder = Recorder()
    missing = tmp_path / "missing"
    argv = ["claude", "install", "--scope", "user", "--project", str(missing)]
    assert install.main(argv, stub_reads(install, recorder, endpoint="2.1.0"), all_steps(recorder)) == 1
    assert recorder.calls == []
    assert capsys.readouterr().err == f"Error: the project root {missing} is not a directory\n"


def test_claude_steps_are_registered(install):
    assert install.STEPS[("claude", "install")] is install.install_claude
    assert install.STEPS[("claude", "update")] is install.update_claude


# Codex, against a stand-in `codex` recording its calls

STAND_IN_CODEX = STAND_IN_CLAUDE.replace("$CLAUDE_CALLS", "$CODEX_CALLS").replace("$CLAUDE_FAIL", "$CODEX_FAIL")


@pytest.fixture
def stand_in_codex(tmp_path, monkeypatch):
    """A stand-in `codex` first on `PATH`, logging its calls as the stand-in `claude` does, under
    the runner's fallback session shell, `/bin/sh`."""
    bin_dir = tmp_path / "codex_bin"
    bin_dir.mkdir()
    cli = bin_dir / "codex"
    cli.write_text(STAND_IN_CODEX)
    cli.chmod(cli.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    log = tmp_path / "codex_calls.log"
    monkeypatch.setenv("PATH", f"{bin_dir}{os.pathsep}{os.environ.get('PATH', '')}")
    monkeypatch.delenv("SHELL", raising=False)
    monkeypatch.delenv("CODEX_FAIL", raising=False)
    monkeypatch.setenv("CODEX_CALLS", str(log))
    return log


def run_codex(install, project, action):
    argv = ["codex", action, "--project", str(project)]
    return install.main(argv, stub_reads(install, Recorder(), endpoint="2.1.0"))


CODEX_ADD = ["plugin", "marketplace", "add", "uHappyLogic/gurita-codex", "--ref", "2.1.0"]
CODEX_UPDATE = [
    ["plugin", "marketplace", "remove", "gurita"],
    CODEX_ADD,
    ["plugin", "add", "gurita@gurita"],
]


def test_codex_install_adds_the_marketplace_at_the_tag_then_the_plugin(install, stand_in_codex, project):
    assert run_codex(install, project, "install") == 0
    root = os.path.realpath(project)
    assert recorded_calls(stand_in_codex) == [
        (root, CODEX_ADD),
        (root, ["plugin", "add", "gurita@gurita"]),
    ]


def test_codex_update_removes_and_re_adds_the_marketplace_then_adds_the_plugin(install, stand_in_codex, project):
    assert run_codex(install, project, "update") == 0
    root = os.path.realpath(project)
    calls = recorded_calls(stand_in_codex)
    assert calls == [(root, words) for words in CODEX_UPDATE]
    assert not any(words[:2] == ["plugin", "remove"] for _, words in calls)


@pytest.mark.parametrize("failing_at", range(len(CODEX_UPDATE)))
def test_an_update_stopped_by_a_failed_step_runs_no_later_step(install, stand_in_codex, project, monkeypatch, capsys, failing_at):
    monkeypatch.setenv("CODEX_FAIL", " ".join(CODEX_UPDATE[failing_at]))
    assert run_codex(install, project, "update") == 3
    root = os.path.realpath(project)
    assert recorded_calls(stand_in_codex) == [(root, words) for words in CODEX_UPDATE[: failing_at + 1]]


def test_a_failed_codex_install_step_ends_the_run_with_a_non_zero_status(install, stand_in_codex, project, monkeypatch):
    monkeypatch.setenv("CODEX_FAIL", " ".join(CODEX_ADD))
    assert run_codex(install, project, "install") != 0
    assert [words for _, words in recorded_calls(stand_in_codex)] == [CODEX_ADD]


def test_codex_runs_in_the_runners_session_shell_at_the_root(install, project):
    seen = []

    def session(script, root):
        seen.append((script, root))
        return 0

    target = install.Target(str(project))
    assert install.install_codex("2.1.0", target, session) == 0
    assert install.update_codex("2.1.0", target, session) == 0
    assert seen == [
        (
            "codex plugin marketplace add uHappyLogic/gurita-codex --ref 2.1.0 && "
            "codex plugin add gurita@gurita\n",
            str(project),
        ),
        (
            "codex plugin marketplace remove gurita && "
            "codex plugin marketplace add uHappyLogic/gurita-codex --ref 2.1.0 && "
            "codex plugin add gurita@gurita\n",
            str(project),
        ),
    ]


def test_codex_steps_are_registered(install):
    assert install.STEPS[("codex", "install")] is install.install_codex
    assert install.STEPS[("codex", "update")] is install.update_codex
