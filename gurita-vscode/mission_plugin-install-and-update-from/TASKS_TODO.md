# TASKS TODO

## Install Control With Claude Code Scope Pick

Draw one Install control under **Harnesses** for every harness whose CLI the check found and that has an install to offer: Antigravity or Codex holding no copy, and Claude Code while any of user, project, and local holds no copy applying to the project, a disabled copy's scope counting as held; none is drawn for a disabled Antigravity or Codex copy or a copy from another source, and the window gains no uninstall control. A click starts the install at once with no confirmation, per-user on Antigravity and Codex, and on Claude Code after VS Code's `showQuickPick` lists the scopes on offer, each with one line saying where it is recorded (user settings, the project's shared `.claude/settings.json`, or the project's local settings), user alone when no workspace folder is open; a dismissed pick installs nothing, and the control is drawn disabled while any install or update run is going. Verified by the extension's unit tests of the drawn rows, the scopes the pick offers, and the run a click starts, the README describing the control.

---
