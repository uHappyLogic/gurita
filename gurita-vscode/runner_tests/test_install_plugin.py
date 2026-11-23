"""The install script, gurita-vscode/install_plugin.py: its first step, reading the tag of the
latest published release of the harness's distribution repository through GitHub's
`releases/latest` endpoint and, when that fails, through the `/releases/latest` page redirect,
with the two reads stubbed: the endpoint answering, only the redirect answering, and both
failing, which prints the cause and exits non-zero before any install or update step runs, with
no other ref fallen back to. The reads' own handling of an answer is driven through a stand-in
opener, so no test contacts the network."""

import io
import json
import urllib.error
import urllib.request
from email.message import Message

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
        def run(tag):
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
    status = install.main([harness, "install"], reads, all_steps(recorder))
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
    status = install.main(["claude", "install"], reads, all_steps(recorder))
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
    assert install.main(["claude", "update"], reads, {}) == 1
    assert capsys.readouterr().err == "Error: this script holds no update for claude\n"


def test_an_unknown_harness_is_refused_by_the_parser(install):
    with pytest.raises(SystemExit) as stopped:
        install.main(["vscode", "install"], (), {})
    assert stopped.value.code == 2


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
