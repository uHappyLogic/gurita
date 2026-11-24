# Changelog

The release notes of Gurita for VS Code, one entry per version published to the Visual Studio Marketplace and Open VSX, newest first.

## 0.2.0 — 2026-11-24

### Marketplace and Open VSX publication

- Gurita for VS Code is published as `BusyMinds.gurita-vscode` on the Visual Studio Marketplace and Open VSX, with a listing icon, description, keywords, and a demo of a recipe run.
- It installs on VS Code forks such as VSCodium, Cursor, Windsurf, and Antigravity, through its lowered engine floor.
- On native Windows it shows one message saying it runs only on macOS, Linux, or through Remote-WSL, and stays inert.
- Bug reports go through an extension bug form, linked from the listing beside the documentation and Q&A links.

### Plugin install and update from Settings

- The Settings window offers an Install control for each harness whose CLI is found, Claude Code asking which scope (user, project, or local) to install into.
- An Update control beside each installed copy updates it to the latest published plugin release, every detected Claude Code scope at once.
- Install and update run in a visible terminal, one at a time, and the harness check runs again when they finish.
- The harness check now shows Claude Code's installed scopes, disabled Antigravity and Codex copies, and copies installed from another source, with the commands to switch.

### Activity bar view and per-mission windows

- A Gurita entry in the activity bar opens a Missions side-bar view listing every live mission with its title, next workflow step, open-question and remaining-task counts, and a marker while a run is going.
- New mission and Define mission rows stand above the missions, with Refresh and Settings as title-bar actions.
- Clicking a mission opens its own window in the editor area, several at once, replacing the single mission pane.
- Settings opens as a window of its own, and a mission's run terminal comes forward when its window becomes active.
- Mission and Settings windows are restored after a restart or window reload.

### Recipe variants and harness settings view

- Each recipe button carries a dropdown of its variants, the choice remembered per mission.
- The extension ships its own recipe file, and a recipe of your own with a shipped name joins that recipe as further variants.
- A Settings view checks Claude Code, Antigravity, and Codex: the CLI found, the Gurita plugin installed, and its version.
- Each harness can be enabled or disabled and holds editable model and effort lists.
- Variants and single-task lines can be duplicated, renamed, deleted, reset, and made the default, and each line's harness, model, and effort edited, every change stored in `~/.gurita/variants.json`.
- The answer, alternative, and New task buttons carry variant dropdowns of their own.

### VS Code extension first version

- A page per live mission shows the seven-step workflow diagram, the runs in progress, and the open questions and remaining tasks, refreshed as the mission's files change.
- Recipe, per-question, discuss, answer, new-task, and mission-starting buttons start runs in terminals, each chain run as one shell session.
- Looped task runs assign each task a single-task recipe line through a rule file, previewed and overridable before the run starts.
