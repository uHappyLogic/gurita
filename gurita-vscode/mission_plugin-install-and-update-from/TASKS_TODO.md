# TASKS TODO

## Claude Code Detected Scopes in the Check

Have `harness_check.py` print, for Claude Code, every scope holding a `gurita@gurita` copy that applies to the project root, which of them won, and whether the winner is disabled, and have the Settings window show them: the winning scope first as the one in effect, the others as also installed, one version, the winner's, and a disabled winner's scope marked disabled with the statement that the copy must be enabled in Claude Code itself, through its `/plugin` menu or `claude plugin enable`. The window needs this to show where an installed copy stands and, in later tasks, which scopes Install and Update act on. Verified by the script's pytest tests on listings holding one scope, several scopes, and a disabled winning scope, and by the extension's unit tests of the outcome and the drawn row, the README's harness-check section saying the same.

---

## Disabled Antigravity and Codex Copies Reported

Have the harness check report a disabled Antigravity or Codex copy as a state of its own, installed but disabled, beside the not-installed and installed states, and have the Settings window say for it that the copy is disabled and must be enabled in the harness itself, on Antigravity with `agy plugin enable gurita` and on Codex through its own plugin settings. Verified by the script's pytest tests on a disabled entry of each listing and by the extension's unit tests of the outcome and the drawn row, the README saying the same.

---

## Copies From Another Source Detected

Have the harness check detect, for Claude Code and Codex, when the existing Gurita copy or the marketplace named `gurita` comes from a source other than the harness's distribution repository (`uHappyLogic/gurita-claude`, `uHappyLogic/gurita-codex`), such as a local checkout registered as a directory marketplace, and have the Settings window state the source found and the CLI commands that would switch the harness to its distribution repository; Antigravity, whose listing names no source, is reported as before. Verified by the script's pytest tests on listings in this machine's directory-marketplace shape and in the distribution-repository shape the hands-on verification recorded, and by the extension's unit tests of the outcome and the drawn row, the README saying the same.

---

## Install Script With the Release Lookup

Add the packaged stdlib Python script the install or update terminal will run, beside `harness_check.py`, with its first step: reading the tag of the latest published release of a harness's distribution repository through GitHub's `releases/latest` endpoint and, when that read fails, through the `/releases/latest` page redirect. When both reads fail it prints the cause and exits with a non-zero status before any install, update, or marketplace command runs, falling back to no other ref. Verified by pytest tests in `runner_tests/`, under both pytest runs, with the two reads stubbed: the endpoint answering, only the redirect answering, and both failing.

---

## Antigravity Install and Staged-Swap Update

Give the install script its Antigravity install and update, with no shell pipeline and no `agy` command: the install downloads the distribution repository's `archive/refs/tags/<tag>.tar.gz` with `urllib` and extracts it with `tarfile`, stripped of its top directory, directly into `~/.gemini/config/plugins/gurita`, while the update extracts the new release into a fresh staging directory outside `~/.gemini/config/plugins/` on the same filesystem, checks that its root `plugin.json` is present and reads its version, and only then removes the old `gurita` directory and moves the staged one into its place, keeping no backup. Verified by pytest tests against a local archive and an overridden home: a fresh install, an update leaving exactly what the new release ships, and a staged copy failing its check with the old directory left untouched.

---

## Claude Code Install and Update Commands

Give the install script its Claude Code install and update, run through the runner's session shell at the project root with the terminal's own input and output: an install at a given scope runs `claude plugin marketplace add --scope <scope>` on `uHappyLogic/gurita-claude` with a source carrying the release's tag and then `claude plugin install gurita@gurita --scope <scope>`, and an update over the given detected scopes re-runs that marketplace add at each of them with the new tag, then `claude plugin marketplace update gurita`, then `claude plugin update gurita@gurita -s <scope>` for each, in the order user, project, local. A command that fails ends the run with a non-zero status. Verified by pytest tests with a stand-in `claude` recording its calls, for an install at each scope and an update over one scope and over several.

---

## Codex Install and Update Commands

Give the install script its Codex install and update, run through the runner's session shell with the terminal's own input and output: the install runs `codex plugin marketplace add uHappyLogic/gurita-codex --ref <tag>` and then `codex plugin add gurita@gurita`, and the update runs `codex plugin marketplace remove gurita`, then that marketplace add at the newer tag, then `codex plugin add gurita@gurita`, in that order, each behind the previous one's success, never removing the installed plugin. Verified by pytest tests with a stand-in `codex` recording its calls, an update stopped by a failed step included.

---

## Install and Update Runs in a Terminal

Have the Settings window start an install or update as a terminal whose own process is the packaged install script, opened and shown as a recipe run's terminal is, with a note of the run kept in the extension's state for the session, so that at most one goes at a time and the page draws **Check again** disabled meanwhile. When that terminal's process ends, the window reads its exit status from the terminal and reports how the run ended in a notification, a success adding the one sentence that running sessions of that harness must be restarted to use the new copy and a failure, a failed release lookup included, told as an error, and then runs the whole harness check afresh through the Check again code path. Verified by the extension's unit tests against the `vscode` stub for a successful run, a failed run, and a second run refused while one is going, the README describing the run.

---

## Update Control for Installed Copies

Draw an Update control under **Harnesses** for every harness whose check found the CLI and an installed Gurita copy, enabled whether or not the versions differ, and none for a disabled copy or a copy from another source. A click starts the update run at once with no confirmation, on Claude Code over every scope at which a copy applying to the project was detected, and the control is drawn disabled while any install or update run is going. Verified by the extension's unit tests of the drawn rows and of the run a click starts, the README describing the control.

---

## Install Control With Claude Code Scope Pick

Draw one Install control under **Harnesses** for every harness whose CLI the check found and that has an install to offer: Antigravity or Codex holding no copy, and Claude Code while any of user, project, and local holds no copy applying to the project, a disabled copy's scope counting as held; none is drawn for a disabled Antigravity or Codex copy or a copy from another source, and the window gains no uninstall control. A click starts the install at once with no confirmation, per-user on Antigravity and Codex, and on Claude Code after VS Code's `showQuickPick` lists the scopes on offer, each with one line saying where it is recorded (user settings, the project's shared `.claude/settings.json`, or the project's local settings), user alone when no workspace folder is open; a dismissed pick installs nothing, and the control is drawn disabled while any install or update run is going. Verified by the extension's unit tests of the drawn rows, the scopes the pick offers, and the run a click starts, the README describing the control.

---
