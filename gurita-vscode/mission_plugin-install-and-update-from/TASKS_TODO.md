# TASKS TODO

## Install and Update Runs in a Terminal

Have the Settings window start an install or update as a terminal whose own process is the packaged install script, opened and shown as a recipe run's terminal is, with a note of the run kept in the extension's state for the session, so that at most one goes at a time and the page draws **Check again** disabled meanwhile. When that terminal's process ends, the window reads its exit status from the terminal and reports how the run ended in a notification, a success adding the one sentence that running sessions of that harness must be restarted to use the new copy and a failure, a failed release lookup included, told as an error, and then runs the whole harness check afresh through the Check again code path. Verified by the extension's unit tests against the `vscode` stub for a successful run, a failed run, and a second run refused while one is going, the README describing the run.

---

## Update Control for Installed Copies

Draw an Update control under **Harnesses** for every harness whose check found the CLI and an installed Gurita copy, enabled whether or not the versions differ, and none for a disabled copy or a copy from another source. A click starts the update run at once with no confirmation, on Claude Code over every scope at which a copy applying to the project was detected, and the control is drawn disabled while any install or update run is going. Verified by the extension's unit tests of the drawn rows and of the run a click starts, the README describing the control.

---

## Install Control With Claude Code Scope Pick

Draw one Install control under **Harnesses** for every harness whose CLI the check found and that has an install to offer: Antigravity or Codex holding no copy, and Claude Code while any of user, project, and local holds no copy applying to the project, a disabled copy's scope counting as held; none is drawn for a disabled Antigravity or Codex copy or a copy from another source, and the window gains no uninstall control. A click starts the install at once with no confirmation, per-user on Antigravity and Codex, and on Claude Code after VS Code's `showQuickPick` lists the scopes on offer, each with one line saying where it is recorded (user settings, the project's shared `.claude/settings.json`, or the project's local settings), user alone when no workspace folder is open; a dismissed pick installs nothing, and the control is drawn disabled while any install or update run is going. Verified by the extension's unit tests of the drawn rows, the scopes the pick offers, and the run a click starts, the README describing the control.

---
