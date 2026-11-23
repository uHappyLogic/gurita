"""The harness check, gurita-vscode/harness_check.py: the copy each canned listing gives, Claude
Code's chosen among the entries that apply to the project root with every applying scope listed,
the winning one first and marked disabled when it is, Antigravity's and Codex's each not
installed, installed, or installed but disabled, Claude Code's and Codex's copy or `gurita`
marketplace from a source other than the distribution repository detected in listings of this
machine's directory-marketplace shape and told apart from the distribution-repository shape the
hands-on verification recorded, and the one JSON result the check prints, its session replaced
by a stub that writes the files a real session would, so no shell session starts."""

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
    assert check.claude_copy(text, ROOT)[:2] == (True, "1.9.0")


def test_claude_project_entry_of_the_root_wins_over_user(check):
    text = listing([claude_entry("user", "1.8.0"), claude_entry("project", "1.9.0", ROOT)])
    assert check.claude_copy(text, ROOT)[:2] == (True, "1.9.0")


def test_claude_local_wins_over_project_and_user(check):
    text = listing(
        [
            claude_entry("local", "2.1.0", ROOT),
            claude_entry("project", "1.9.0", ROOT),
            claude_entry("user", "1.8.0"),
        ]
    )
    assert check.claude_copy(text, ROOT)[:2] == (True, "2.1.0")


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
    assert check.claude_copy(text, ROOT)[:2] == (True, "1.9.0")


def test_claude_only_other_projects_means_not_installed(check):
    text = listing([claude_entry("project", "1.9.0", "/work/other"), claude_entry("synced", "1.9.0")])
    assert check.claude_copy(text, ROOT)[:2] == (False, None)


def test_claude_disabled_winning_entry_means_not_installed(check):
    text = listing([claude_entry("user", "1.9.0"), claude_entry("local", "1.9.0", ROOT, enabled=False)])
    assert check.claude_copy(text, ROOT)[:2] == (False, None)


def test_claude_disabled_less_specific_entry_does_not_count(check):
    text = listing([claude_entry("user", "1.8.0", enabled=False), claude_entry("project", "1.9.0", ROOT)])
    assert check.claude_copy(text, ROOT)[:2] == (True, "1.9.0")


def test_claude_folder_read_entry_reads_folder_version(check):
    text = listing(
        [
            claude_entry("user", "1.9.0", folder="2.0.0"),
            claude_entry("project", "1.9.0", ROOT, folder="2.0.0"),
        ]
    )
    assert check.claude_copy(text, ROOT)[:2] == (True, "2.0.0")


def test_claude_entry_without_folder_reads_version_even_beside_a_folder_entry(check):
    text = listing([claude_entry("user", "1.9.0", folder="2.0.0"), claude_entry("project", "1.7.0", ROOT)])
    assert check.claude_copy(text, ROOT)[:2] == (True, "1.7.0")


def test_claude_project_path_matched_whatever_the_spelling(check, tmp_path):
    root = tmp_path / "project"
    root.mkdir()
    text = listing([claude_entry("project", "1.9.0", str(root) + "/")])
    assert check.claude_copy(text, os.path.join(str(root), "."))[:2] == (True, "1.9.0")


def test_claude_no_gurita_entry_means_not_installed(check):
    text = listing([claude_entry("user", "1.0.0", plugin="other@market")])
    assert check.claude_copy(text, ROOT)[:2] == (False, None)


def test_claude_one_scope_is_the_scope_in_effect(check):
    text = listing([claude_entry("user", "2.0.0"), claude_entry("local", "3.0.0", "/work/other")])
    assert check.claude_copy(text, ROOT) == check.ClaudeCopy(True, "2.0.0", ["user"], "user", False)


def test_claude_several_scopes_listed_winner_first_with_the_winners_version(check):
    text = listing(
        [
            claude_entry("user", "1.8.0"),
            claude_entry("local", "2.1.0", ROOT),
            claude_entry("project", "1.9.0", ROOT),
            claude_entry("project", "3.0.0", "/work/other"),
        ]
    )
    assert check.claude_copy(text, ROOT) == check.ClaudeCopy(
        True, "2.1.0", ["local", "project", "user"], "local", False
    )
    two = listing([claude_entry("user", "1.8.0"), claude_entry("project", "1.9.0", ROOT)])
    assert check.claude_copy(two, ROOT) == check.ClaudeCopy(True, "1.9.0", ["project", "user"], "project", False)


def test_claude_disabled_winning_scope_is_listed_and_marked_disabled(check):
    text = listing([claude_entry("user", "1.9.0"), claude_entry("local", "1.9.0", ROOT, enabled=False)])
    assert check.claude_copy(text, ROOT) == check.ClaudeCopy(False, None, ["local", "user"], "local", True)
    alone = listing([claude_entry("user", "1.9.0", enabled=False)])
    assert check.claude_copy(alone, ROOT) == check.ClaudeCopy(False, None, ["user"], "user", True)


def test_claude_disabled_less_specific_scope_is_still_listed(check):
    text = listing([claude_entry("user", "1.8.0", enabled=False), claude_entry("project", "1.9.0", ROOT)])
    assert check.claude_copy(text, ROOT) == check.ClaudeCopy(True, "1.9.0", ["project", "user"], "project", False)


def test_claude_no_applying_entry_lists_no_scope(check):
    text = listing([claude_entry("project", "1.9.0", "/work/other"), claude_entry("synced", "1.9.0")])
    assert check.claude_copy(text, ROOT) == check.ClaudeCopy(False, None, [], None, False)


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
    assert check.antigravity_copy(AGY_LISTING) == (True, "1.9.0", False)


def test_antigravity_without_gurita_is_not_installed(check):
    assert check.antigravity_copy(listing([{"name": "other", "version": "0.1.0"}])) == (False, None, False)


def test_antigravity_disabled_gurita_is_installed_but_disabled(check):
    text = listing([{"name": "gurita", "enabled": False, "version": "1.9.0", "path": "/home/.gemini/config/plugins/gurita"}])
    copy = check.antigravity_copy(text)
    assert copy == (False, None, True)
    assert copy.disabled is True


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
    assert check.codex_copy(CODEX_LISTING) == (True, "1.9.0", False)


def test_codex_empty_installed_is_not_installed(check):
    assert check.codex_copy(json.dumps({"installed": [], "available": []})) == (False, None, False)


@pytest.mark.parametrize("enabled", [True, False])
def test_codex_uninstalled_entry_is_not_installed(check, enabled):
    entry = {"pluginId": "gurita@gurita", "version": "1.9.0", "installed": False, "enabled": enabled}
    assert check.codex_copy(json.dumps({"installed": [entry]})) == (False, None, False)


def test_codex_disabled_gurita_is_installed_but_disabled(check):
    entry = {"pluginId": "gurita@gurita", "version": "1.9.0", "installed": True, "enabled": False}
    copy = check.codex_copy(json.dumps({"installed": [entry], "available": []}))
    assert copy == (False, None, True)
    assert copy.disabled is True


@pytest.mark.parametrize("text", ["[]", "{}", ""])
def test_codex_unreadable_listing_is_an_error(check, text):
    with pytest.raises(check.ListingError):
        check.codex_copy(text)


# Sources: this machine's directory-marketplace shape against the distribution-repository shape
# the hands-on verification recorded

# `claude plugin marketplace list --json` as this machine prints it: `gurita` a directory
# marketplace at the checkout, beside other marketplaces.
CLAUDE_DIRECTORY_MARKETPLACES = [
    {
        "name": "claude-plugins-official",
        "source": "github",
        "repo": "anthropics/claude-plugins-official",
        "installLocation": "/home/.claude/plugins/marketplaces/claude-plugins-official",
    },
    {"name": "gurita", "source": "directory", "path": "/work/gurita", "installLocation": "/work/gurita"},
]

# The `gurita` marketplace as the hands-on verification recorded it, added from the distribution
# repository at a release's tag.
CLAUDE_DISTRIBUTION_MARKETPLACE = {
    "name": "gurita",
    "source": "github",
    "repo": "uHappyLogic/gurita-claude",
    "ref": "2.0.0",
    "installLocation": "/cfg/plugins/marketplaces/gurita",
}


def distribution_claude_entry(scope, project=None):
    """A `gurita@gurita` entry as the hands-on verification recorded it: no `readFromFolder`."""
    entry = {
        "id": "gurita@gurita",
        "version": "2.0.0",
        "scope": scope,
        "enabled": True,
        "installPath": "/cfg/plugins/cache/gurita/gurita/2.0.0",
        "installedAt": "2026-11-23T10:00:00.000Z",
        "lastUpdated": "2026-11-23T10:00:00.000Z",
        "projectEnabled": True,
    }
    if project is not None:
        entry["projectPath"] = project
    return entry


def test_claude_directory_marketplace_is_another_source(check):
    text = listing([claude_entry("user", "1.9.0", folder="2.0.0"), claude_entry("project", "1.9.0", ROOT, folder="2.0.0")])
    assert check.claude_source(text, listing(CLAUDE_DIRECTORY_MARKETPLACES), ROOT) == "the directory /work/gurita"


def test_claude_directory_marketplace_with_no_copy_is_another_source(check):
    assert check.claude_source(listing([]), listing(CLAUDE_DIRECTORY_MARKETPLACES), ROOT) == "the directory /work/gurita"


def test_claude_distribution_repository_is_no_other_source(check):
    text = listing(
        [
            distribution_claude_entry("user"),
            distribution_claude_entry("project", ROOT),
            distribution_claude_entry("local", ROOT),
        ]
    )
    assert check.claude_source(text, listing([CLAUDE_DISTRIBUTION_MARKETPLACE]), ROOT) is None


@pytest.mark.parametrize(
    "marketplace",
    [
        dict(CLAUDE_DISTRIBUTION_MARKETPLACE, ref="main"),
        {k: v for k, v in CLAUDE_DISTRIBUTION_MARKETPLACE.items() if k != "ref"},
        dict(CLAUDE_DISTRIBUTION_MARKETPLACE, repo="uhappylogic/gurita-claude"),
        {"name": "gurita", "source": "git", "url": "https://github.com/uHappyLogic/gurita-claude.git"},
        {"name": "gurita", "source": "git", "url": "git@github.com:uHappyLogic/gurita-claude.git"},
    ],
)
def test_claude_distribution_repository_at_any_ref_or_url_form_is_no_other_source(check, marketplace):
    assert check.claude_source(listing([distribution_claude_entry("user")]), listing([marketplace]), ROOT) is None


def test_claude_no_gurita_marketplace_and_no_folder_is_no_other_source(check):
    others = [entry for entry in CLAUDE_DIRECTORY_MARKETPLACES if entry["name"] != "gurita"]
    assert check.claude_source(listing([distribution_claude_entry("user")]), listing(others), ROOT) is None
    assert check.claude_source(listing([]), listing([]), ROOT) is None


@pytest.mark.parametrize(
    ("marketplace", "described"),
    [
        (
            {"name": "gurita", "source": "github", "repo": "someone/gurita-claude"},
            "the GitHub repository someone/gurita-claude",
        ),
        (
            {"name": "gurita", "source": "git", "url": "https://example.com/gurita.git"},
            "the Git repository https://example.com/gurita.git",
        ),
        (
            {"name": "gurita", "source": "github", "repo": "uHappyLogic/gurita-codex"},
            "the GitHub repository uHappyLogic/gurita-codex",
        ),
        ({"name": "gurita", "source": "url", "url": "https://example.com/m.json"}, "a url source at https://example.com/m.json"),
    ],
)
def test_claude_other_marketplace_sources_are_described(check, marketplace, described):
    assert check.claude_source(listing([]), listing([marketplace]), ROOT) == described


def test_claude_folder_read_copy_beside_a_distribution_marketplace_is_another_source(check):
    text = listing([claude_entry("project", "1.9.0", ROOT, folder="2.0.0")])
    assert check.claude_source(text, listing([CLAUDE_DISTRIBUTION_MARKETPLACE]), ROOT) == "the folder /work/gurita/hosts/claude"


def test_claude_folder_read_copy_of_another_project_does_not_count(check):
    text = listing([claude_entry("project", "1.9.0", "/work/other", folder="2.0.0"), distribution_claude_entry("user")])
    assert check.claude_source(text, listing([CLAUDE_DISTRIBUTION_MARKETPLACE]), ROOT) is None


@pytest.mark.parametrize("text", ["not json", "{}"])
def test_claude_unreadable_marketplace_listing_is_an_error(check, text):
    with pytest.raises(check.ListingError):
        check.claude_source(listing([]), text, ROOT)


# `codex plugin list -m gurita --json` and `codex plugin marketplace list --json` as this machine
# prints them: `gurita` a local marketplace rooted at the checkout's `hosts/codex`.
CODEX_LOCAL_SOURCE = {"sourceType": "local", "source": "/work/gurita/hosts/codex"}
CODEX_LOCAL_LISTING = json.dumps(
    {
        "installed": [
            {
                "pluginId": "gurita@gurita",
                "name": "gurita",
                "marketplaceName": "gurita",
                "version": "1.9.0",
                "installed": True,
                "enabled": True,
                "source": {"source": "local", "path": "/work/gurita/hosts/codex/plugins/gurita"},
                "marketplaceSource": CODEX_LOCAL_SOURCE,
                "installPolicy": "AVAILABLE",
                "authPolicy": "ON_INSTALL",
            }
        ],
        "available": [],
    }
)
CODEX_LOCAL_MARKETPLACES = json.dumps(
    {
        "marketplaces": [
            {"name": "openai-curated", "root": "/home/.codex/.tmp/plugins"},
            {"name": "gurita", "root": "/work/gurita/hosts/codex", "marketplaceSource": CODEX_LOCAL_SOURCE},
        ]
    }
)

# The same two listings as the hands-on verification recorded them after the distribution
# repository was added at a release's tag and the plugin added from it.
CODEX_DISTRIBUTION_SOURCE = {"sourceType": "git", "source": "https://github.com/uHappyLogic/gurita-codex.git"}
CODEX_DISTRIBUTION_MARKETPLACE = {
    "name": "gurita",
    "root": "/codex-home/.tmp/marketplaces/gurita",
    "marketplaceSource": CODEX_DISTRIBUTION_SOURCE,
}
CODEX_DISTRIBUTION_LISTING = json.dumps(
    {
        "installed": [
            {
                "pluginId": "gurita@gurita",
                "version": "2.0.0",
                "installed": True,
                "enabled": True,
                "source": {"source": "local", "path": "/codex-home/.tmp/marketplaces/gurita/plugins/gurita"},
                "marketplaceSource": CODEX_DISTRIBUTION_SOURCE,
                "installPolicy": "AVAILABLE",
                "authPolicy": "ON_INSTALL",
            }
        ],
        "available": [],
    }
)


def test_codex_local_marketplace_is_another_source(check):
    assert check.codex_source(CODEX_LOCAL_LISTING, CODEX_LOCAL_MARKETPLACES) == "the local directory /work/gurita/hosts/codex"
    empty = json.dumps({"installed": [], "available": []})
    assert check.codex_source(empty, CODEX_LOCAL_MARKETPLACES) == "the local directory /work/gurita/hosts/codex", "with no copy"


def test_codex_distribution_repository_is_no_other_source(check):
    marketplaces = json.dumps({"marketplaces": [CODEX_DISTRIBUTION_MARKETPLACE]})
    assert check.codex_source(CODEX_DISTRIBUTION_LISTING, marketplaces) is None
    assert check.codex_source(json.dumps({"installed": [], "available": []}), marketplaces) is None


def test_codex_no_gurita_marketplace_is_no_other_source(check):
    marketplaces = json.dumps({"marketplaces": [{"name": "openai-curated", "root": "/home/.codex/.tmp/plugins"}]})
    assert check.codex_source(json.dumps({"installed": [], "available": []}), marketplaces) is None


def test_codex_other_git_repository_is_another_source(check):
    other = {"sourceType": "git", "source": "https://github.com/someone/gurita-codex.git"}
    marketplaces = json.dumps({"marketplaces": [dict(CODEX_DISTRIBUTION_MARKETPLACE, marketplaceSource=other)]})
    assert check.codex_source(CODEX_DISTRIBUTION_LISTING, marketplaces) == "the Git repository https://github.com/someone/gurita-codex.git"


def test_codex_copy_from_another_marketplace_source_is_another_source(check):
    marketplaces = json.dumps({"marketplaces": []})
    assert check.codex_source(CODEX_LOCAL_LISTING, marketplaces) == "the local directory /work/gurita/hosts/codex"


@pytest.mark.parametrize("text", ["not json", "[]", "{}"])
def test_codex_unreadable_marketplace_listing_is_an_error(check, text):
    with pytest.raises(check.ListingError):
        check.codex_source(CODEX_LOCAL_LISTING, text)


def test_check_prints_the_source_found_and_none_for_the_distribution_repository(check, tmp_path):
    root = str(tmp_path)
    files = {}
    files.update(found("claude", listing([claude_entry("user", "1.9.0", folder="2.0.0"), claude_entry("project", "1.9.0", root, folder="2.0.0")])))
    files.update(found("claude.market", listing(CLAUDE_DIRECTORY_MARKETPLACES)))
    files.update(found("codex", CODEX_LOCAL_LISTING))
    files.update(found("codex.market", CODEX_LOCAL_MARKETPLACES))
    files.update(found("antigravity", AGY_LISTING))
    result = check.check(root, {}, fake_session(files, []))
    assert result["claude"]["source"] == "the directory /work/gurita"
    assert result["claude"]["installed"] is True
    assert result["codex"]["source"] == "the local directory /work/gurita/hosts/codex"
    assert result["codex"]["installed"] is True
    assert "source" not in result["antigravity"], "Antigravity's listing names no source"

    files = {}
    files.update(found("claude", listing([distribution_claude_entry("user"), distribution_claude_entry("local", root)])))
    files.update(found("claude.market", listing([CLAUDE_DISTRIBUTION_MARKETPLACE])))
    files.update(found("codex", CODEX_DISTRIBUTION_LISTING))
    files.update(found("codex.market", json.dumps({"marketplaces": [CODEX_DISTRIBUTION_MARKETPLACE]})))
    result = check.check(root, {}, fake_session(files, []))
    assert result["claude"] == {
        "found": True,
        "installed": True,
        "version": "2.0.0",
        "disabled": False,
        "scopes": ["local", "user"],
        "scope": "local",
        "source": None,
    }
    assert result["codex"] == {"found": True, "installed": True, "version": "2.0.0", "disabled": False, "source": None}


def test_check_failed_marketplace_listing_reports_its_error(check, tmp_path):
    files = {}
    files.update(found("claude", listing([distribution_claude_entry("user")])))
    files.update(found("claude.market", "", status="1\n", err="marketplace listing failed\n"))
    files.update(found("codex", CODEX_DISTRIBUTION_LISTING))
    files.update({("codex.market", ".found"): ""})
    result = check.check(str(tmp_path), {}, fake_session(files, []))
    assert result["claude"] == {
        "found": True,
        "installed": False,
        "version": None,
        "disabled": False,
        "scopes": [],
        "scope": None,
        "source": None,
        "error": "the marketplace listing exited with status 1: marketplace listing failed",
    }
    assert result["codex"]["error"] == "the marketplace listing did not finish"
    assert (result["codex"]["installed"], result["codex"]["source"]) == (False, None)


# The composed session script


def test_script_looks_up_each_cli_and_runs_its_listing(check, tmp_path):
    script = check.compose_script(str(tmp_path))
    for cli in ("claude", "agy", "codex"):
        assert f"command -v {cli} >/dev/null 2>&1" in script
    assert "claude plugin list --json >" in script
    assert "agy plugin list --json >" in script
    assert "codex plugin list -m gurita --json >" in script
    assert "claude plugin marketplace list --json >" in script
    assert "codex plugin marketplace list --json >" in script
    assert "agy plugin marketplace" not in script


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
    files.update(found("claude.market", listing([CLAUDE_DISTRIBUTION_MARKETPLACE])))
    files.update(found("codex.market", json.dumps({"marketplaces": []})))
    calls = []
    environ = {"SHELL": "/bin/sh-not-in-family"}
    result = check.check(root, environ, fake_session(files, calls))
    assert len(calls) == 1
    argv, started_at = calls[0]
    assert argv[:-2] == runner.session_shell(environ)
    assert argv[-2] == "-c"
    assert started_at == root
    assert result == {
        "claude": {
            "found": True,
            "installed": True,
            "version": "2.0.0",
            "scopes": ["project"],
            "scope": "project",
            "disabled": False,
            "source": "the folder /work/gurita/hosts/claude",
        },
        "antigravity": {"found": False, "installed": False, "version": None, "disabled": False},
        "codex": {"found": True, "installed": False, "version": None, "disabled": False, "source": None},
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
        "disabled": False,
        "error": "the listing exited with status 1: listing failed",
    }
    assert result["codex"]["found"] is True
    assert result["codex"]["installed"] is False
    assert result["codex"]["error"].startswith("the listing printed no JSON")
    assert result["claude"]["error"] == "the listing did not finish"
    assert (result["claude"]["scopes"], result["claude"]["scope"], result["claude"]["disabled"]) == ([], None, False)
    assert result["claude"]["source"] is None


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
    assert json.loads(out)["antigravity"] == {"found": True, "installed": True, "version": "1.9.0", "disabled": False}


def test_main_prints_claude_codes_scopes_and_a_disabled_winner(check, tmp_path, monkeypatch, capsys):
    root = str(tmp_path)
    files = found(
        "claude",
        listing([claude_entry("user", "2.0.0"), claude_entry("local", "2.0.0", root, enabled=False)]),
    )
    files.update(found("claude.market", listing([CLAUDE_DISTRIBUTION_MARKETPLACE])))
    monkeypatch.setattr(check, "run_session", fake_session(files, []))
    assert check.main(["--project", root]) == 0
    printed = json.loads(capsys.readouterr().out)
    assert printed["claude"] == {
        "found": True,
        "installed": False,
        "version": None,
        "scopes": ["local", "user"],
        "scope": "local",
        "disabled": True,
        "source": None,
    }
    assert printed["codex"] == {"found": False, "installed": False, "version": None, "disabled": False, "source": None}


def test_main_prints_a_disabled_antigravity_and_codex_copy(check, tmp_path, monkeypatch, capsys):
    root = str(tmp_path)
    files = {}
    files.update(found("antigravity", listing([{"name": "gurita", "enabled": False, "version": "2.0.0"}])))
    files.update(
        found(
            "codex",
            json.dumps(
                {
                    "installed": [
                        {"pluginId": "gurita@gurita", "version": "2.0.0", "installed": True, "enabled": False}
                    ],
                    "available": [],
                }
            ),
        )
    )
    files.update(found("codex.market", json.dumps({"marketplaces": [CODEX_DISTRIBUTION_MARKETPLACE]})))
    monkeypatch.setattr(check, "run_session", fake_session(files, []))
    assert check.main(["--project", root]) == 0
    printed = json.loads(capsys.readouterr().out)
    disabled = {"found": True, "installed": False, "version": None, "disabled": True}
    assert printed["antigravity"] == disabled
    assert printed["codex"] == dict(disabled, source=None)


def test_main_refuses_a_root_that_is_not_a_directory(check, tmp_path, monkeypatch, capsys):
    calls = []
    monkeypatch.setattr(check, "run_session", fake_session({}, calls))
    assert check.main(["--project", str(tmp_path / "missing")]) == 1
    captured = capsys.readouterr()
    assert captured.out == ""
    assert captured.err.startswith("Error: ") and captured.err.count("\n") == 1
    assert calls == []
