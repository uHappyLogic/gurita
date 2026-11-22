"""The harness check, gurita-vscode/harness_check.py: the copy each canned listing gives, Claude
Code's chosen among the entries that apply to the project root, and the one JSON result the
check prints, its session replaced by a stub that writes the files a real session would, so no
shell session starts."""

import json
import os

import pytest

import harness_check as harness_check_module

ROOT = "/work/project"


@pytest.fixture
def check():
    """The harness check module."""
    return harness_check_module


def claude_entry(scope, version, project=None, enabled=True, folder=None, plugin="gurita@gurita"):
    entry = {
        "id": plugin,
        "version": version,
        "scope": scope,
        "enabled": enabled,
        "installPath": f"/cache/{plugin}/{version}",
    }
    if project is not None:
        entry["projectPath"] = project
    if folder is not None:
        entry["readFromFolder"] = "/work/gurita/hosts/claude"
        entry["folderVersion"] = folder
    return entry


def listing(entries):
    return json.dumps(entries)


# Claude Code


def test_claude_user_entry_alone_is_the_copy(check):
    text = listing([claude_entry("user", "1.9.0")])
    assert check.claude_copy(text, ROOT) == (True, "1.9.0")


def test_claude_project_entry_of_the_root_wins_over_user(check):
    text = listing([claude_entry("user", "1.8.0"), claude_entry("project", "1.9.0", ROOT)])
    assert check.claude_copy(text, ROOT) == (True, "1.9.0")


def test_claude_local_wins_over_project_and_user(check):
    text = listing(
        [
            claude_entry("local", "2.1.0", ROOT),
            claude_entry("project", "1.9.0", ROOT),
            claude_entry("user", "1.8.0"),
        ]
    )
    assert check.claude_copy(text, ROOT) == (True, "2.1.0")


def test_claude_other_projects_and_synced_entries_are_ignored(check):
    text = listing(
        [
            claude_entry("local", "3.0.0", "/work/other"),
            claude_entry("project", "3.0.0", "/work/other"),
            claude_entry("synced", "3.0.0"),
            claude_entry("project", "3.0.0", ROOT, plugin="other@gurita"),
            claude_entry("user", "1.9.0"),
        ]
    )
    assert check.claude_copy(text, ROOT) == (True, "1.9.0")


def test_claude_only_other_projects_means_not_installed(check):
    text = listing([claude_entry("project", "1.9.0", "/work/other"), claude_entry("synced", "1.9.0")])
    assert check.claude_copy(text, ROOT) == (False, None)


def test_claude_disabled_winning_entry_means_not_installed(check):
    text = listing([claude_entry("user", "1.9.0"), claude_entry("local", "1.9.0", ROOT, enabled=False)])
    assert check.claude_copy(text, ROOT) == (False, None)


def test_claude_disabled_less_specific_entry_does_not_count(check):
    text = listing([claude_entry("user", "1.8.0", enabled=False), claude_entry("project", "1.9.0", ROOT)])
    assert check.claude_copy(text, ROOT) == (True, "1.9.0")


def test_claude_folder_read_entry_reads_folder_version(check):
    text = listing(
        [
            claude_entry("user", "1.9.0", folder="2.0.0"),
            claude_entry("project", "1.9.0", ROOT, folder="2.0.0"),
        ]
    )
    assert check.claude_copy(text, ROOT) == (True, "2.0.0")


def test_claude_entry_without_folder_reads_version_even_beside_a_folder_entry(check):
    text = listing([claude_entry("user", "1.9.0", folder="2.0.0"), claude_entry("project", "1.7.0", ROOT)])
    assert check.claude_copy(text, ROOT) == (True, "1.7.0")


def test_claude_project_path_matched_whatever_the_spelling(check, tmp_path):
    root = tmp_path / "project"
    root.mkdir()
    text = listing([claude_entry("project", "1.9.0", str(root) + "/")])
    assert check.claude_copy(text, os.path.join(str(root), ".")) == (True, "1.9.0")


def test_claude_no_gurita_entry_means_not_installed(check):
    text = listing([claude_entry("user", "1.0.0", plugin="other@market")])
    assert check.claude_copy(text, ROOT) == (False, None)


@pytest.mark.parametrize("text", ["not json", "{}"])
def test_claude_unreadable_listing_is_an_error(check, text):
    with pytest.raises(check.ListingError):
        check.claude_copy(text, ROOT)


# Antigravity

AGY_LISTING = listing(
    [
        {"name": "other", "enabled": True, "version": "0.1.0"},
        {"name": "gurita", "enabled": True, "version": "1.9.0", "source": "antigravity"},
    ]
)


def test_antigravity_gurita_entry_is_the_copy(check):
    assert check.antigravity_copy(AGY_LISTING) == (True, "1.9.0")


def test_antigravity_without_gurita_is_not_installed(check):
    assert check.antigravity_copy(listing([{"name": "other", "version": "0.1.0"}])) == (False, None)


def test_antigravity_disabled_gurita_is_not_installed(check):
    text = listing([{"name": "gurita", "enabled": False, "version": "1.9.0"}])
    assert check.antigravity_copy(text) == (False, None)


def test_antigravity_unreadable_listing_is_an_error(check):
    with pytest.raises(check.ListingError):
        check.antigravity_copy('{"name": "gurita"}')


# Codex

CODEX_LISTING = json.dumps(
    {
        "installed": [
            {"pluginId": "gurita@gurita", "version": "1.9.0", "installed": True, "enabled": True}
        ],
        "available": [],
    }
)


def test_codex_installed_gurita_is_the_copy(check):
    assert check.codex_copy(CODEX_LISTING) == (True, "1.9.0")


def test_codex_empty_installed_is_not_installed(check):
    assert check.codex_copy(json.dumps({"installed": [], "available": []})) == (False, None)


@pytest.mark.parametrize("field", ["installed", "enabled"])
def test_codex_uninstalled_or_disabled_is_not_installed(check, field):
    entry = {"pluginId": "gurita@gurita", "version": "1.9.0", "installed": True, "enabled": True}
    entry[field] = False
    assert check.codex_copy(json.dumps({"installed": [entry]})) == (False, None)


@pytest.mark.parametrize("text", ["[]", "{}", ""])
def test_codex_unreadable_listing_is_an_error(check, text):
    with pytest.raises(check.ListingError):
        check.codex_copy(text)


# The composed session script


def test_script_looks_up_each_cli_and_runs_its_listing(check, tmp_path):
    script = check.compose_script(str(tmp_path))
    for cli in ("claude", "agy", "codex"):
        assert f"command -v {cli} >/dev/null 2>&1" in script
    assert "claude plugin list --json >" in script
    assert "agy plugin list --json >" in script
    assert "codex plugin list -m gurita --json >" in script


# The check, its session stubbed


def fake_session(files, calls):
    """A session stub that records its call and writes `files` (harness key and suffix to
    text) into the run directory the script names, as a real session's lookups would."""

    def session(argv, root, timeout):
        calls.append((argv, root))
        script = argv[-1]
        run_dir = script.split("command -v claude >/dev/null 2>&1; then : >", 1)[1].split("/claude.found", 1)[0]
        for (key, suffix), text in files.items():
            with open(os.path.join(run_dir, key + suffix), "w", encoding="utf-8") as handle:
                handle.write(text)

    return session


def found(key, out, status="0\n", err=""):
    return {(key, ".found"): "", (key, ".out"): out, (key, ".status"): status, (key, ".err"): err}


def test_check_runs_one_session_in_the_runners_shell_and_reports_each_harness(check, runner, tmp_path):
    root = str(tmp_path)
    files = {}
    files.update(found("claude", listing([claude_entry("project", "1.9.0", root, folder="2.0.0")])))
    files.update(found("codex", json.dumps({"installed": []})))
    calls = []
    environ = {"SHELL": "/bin/sh-not-in-family"}
    result = check.check(root, environ, fake_session(files, calls))
    assert len(calls) == 1
    argv, started_at = calls[0]
    assert argv[:-2] == runner.session_shell(environ)
    assert argv[-2] == "-c"
    assert started_at == root
    assert result == {
        "claude": {"found": True, "installed": True, "version": "2.0.0"},
        "antigravity": {"found": False, "installed": False, "version": None},
        "codex": {"found": True, "installed": False, "version": None},
    }


def test_check_failed_listing_reports_its_error(check, tmp_path):
    files = {}
    files.update(found("antigravity", "", status="1\n", err="some noise\nlisting failed\n"))
    files.update(found("codex", "not json"))
    files.update({("claude", ".found"): ""})
    result = check.check(str(tmp_path), {}, fake_session(files, []))
    assert result["antigravity"] == {
        "found": True,
        "installed": False,
        "version": None,
        "error": "the listing exited with status 1: listing failed",
    }
    assert result["codex"]["found"] is True
    assert result["codex"]["installed"] is False
    assert result["codex"]["error"].startswith("the listing printed no JSON")
    assert result["claude"]["error"] == "the listing did not finish"


def test_check_leaves_no_run_directory(check, tmp_path):
    seen = []

    def session(argv, root, timeout):
        seen.append(argv[-1].split(": >", 1)[1].split("/claude.found", 1)[0])
        fake_session(found("claude", "[]"), [])(argv, root, timeout)

    check.check(str(tmp_path), {}, session)
    assert not os.path.exists(seen[0])


def test_main_prints_one_json_line(check, tmp_path, monkeypatch, capsys):
    files = found("antigravity", AGY_LISTING)
    monkeypatch.setattr(check, "run_session", fake_session(files, []))
    assert check.main(["--project", str(tmp_path)]) == 0
    out = capsys.readouterr().out
    assert out.count("\n") == 1
    assert json.loads(out)["antigravity"] == {"found": True, "installed": True, "version": "1.9.0"}


def test_main_refuses_a_root_that_is_not_a_directory(check, tmp_path, monkeypatch, capsys):
    calls = []
    monkeypatch.setattr(check, "run_session", fake_session({}, calls))
    assert check.main(["--project", str(tmp_path / "missing")]) == 1
    captured = capsys.readouterr()
    assert captured.out == ""
    assert captured.err.startswith("Error: ") and captured.err.count("\n") == 1
    assert calls == []
