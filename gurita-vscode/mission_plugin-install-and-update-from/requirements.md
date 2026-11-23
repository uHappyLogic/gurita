# Plugin install and update from Settings

## Goal

The Settings window of Gurita for VS Code installs and updates the Gurita plugin on each supported harness (Claude Code, Antigravity, and Codex) by that harness's own install path, fetching the latest published release from its distribution repository. Each harness offers the scopes it supports natively: user, project, and local on Claude Code, and per-user only on Antigravity and Codex. For a copy already installed, the window shows the scope or scopes it was detected at. The window adds no uninstall control, runs no project bootstrap, and installs no missing harness CLI.

## Relevant starting state

### The Settings window's Harnesses part

The Settings window is one webview panel (`gurita.settings`, titled Gurita Settings) run by `gurita-vscode/src/settingsWindow.ts`, its page drawn by `src/webview/settings.ts`. Under **Harnesses** it lists Claude Code, Antigravity, and Codex, each with one line of check result and an **Enabled** or **Disabled** state with its one switching control, and beneath them a **Check again** control, disabled while a check runs. The page posts `ready`, `checkHarnesses`, `setHarnessEnabled`, and the list, variant, and line edits; no message installs, updates, or removes anything. The page holds buttons and dropdowns only, every typed value being asked for in VS Code's own input box, and a failure of an edit is told in an error notification. The harness check runs on the first opening of the window in the extension's session and its result is kept in the module's state until a restart or reload, only **Check again** running it afresh.

### The harness check, `harness_check.py` and `src/harnessCheck.ts`

The packaged `gurita-vscode/harness_check.py` runs, in one session of the runner's shell (`$SHELL -i` for the sh, bash, zsh family, `/bin/sh` otherwise) with a 120-second limit, each CLI's `command -v` lookup and its listing: `claude plugin list --json`, `agy plugin list --json`, and `codex plugin list -m gurita --json`. It prints one JSON object keyed `claude`, `antigravity`, and `codex`, each holding `found`, `installed`, `version`, and `error` when the listing could not be read, and no scope. For Claude Code it picks one copy among the `gurita@gurita` entries that apply to the project root, the `user` entry and every `project` or `local` entry whose `projectPath` equals the root, `local` winning over `project` over `user`, a disabled winner counting as not installed even beside an enabled less specific entry; its version is `folderVersion` when the entry carries `readFromFolder`. `src/harnessCheck.ts` runs the script through `execFile` from the project root and names the first failed check per harness (CLI not found, plugin not installed, installed version differing from the packaged one), the packaged version being `bundled/plugin_version.txt`, the root `VERSION` of the checkout the package was built from, `2.0.0` today. The comparison is with that packaged version alone: nothing reads the version a distribution repository holds.

### How the extension starts processes

A run is a terminal whose own process is `python3 runner.py chain -- LINE...` (or `loop`), started by `src/runs.ts` at the project root, one run noted per mission and a mission-starting row's run belonging to none; the runner composes the lines into one script for the session shell. The extension's own child processes (`git rev-parse`, `missions.py`, `runner.py preview`, `harness_check.py`) are started with `execFile` through no shell. The check's root is `startingRoot()` in `src/pane.ts`: the project root of the latest live read, else the git top level of the first workspace folder, else that folder, and the home directory when no folder is open. No source of the extension, the runner, the check script, or `shipped_recipes.md` holds an install, update, or marketplace command, and none contacts the network.

### Claude Code's install path and scopes

The root `README.md` and the distribution README document the install as `/plugin marketplace add uHappyLogic/gurita-claude` then `/plugin install gurita@gurita`. Checked on this machine on 2026-11-23 against `claude` 2.1.330: `claude plugin install <plugin>` takes `-s, --scope` of `user`, `project`, or `local` (default `user`), `--marketplace <source>` (an `owner/repo`, a git or https URL, or a path, a marketplace not yet added being added first in user settings), `--json`, and `-y`; `claude plugin marketplace add <source>` takes `--scope` of `user` (default), `project`, or `local`; `claude plugin update <plugin>` takes `-s` of `user`, `project`, `local`, or `managed` (default auto-detect) and says a restart is required to apply; `claude plugin marketplace update [name]` refreshes a marketplace from its source; and `claude plugin list --json` takes `--available` to include the marketplaces' plugins. The listing prints one entry per plugin, scope, and project, each with `id`, `version`, `scope`, `enabled`, `projectPath`, and `installPath`, and `readFromFolder` with `folderVersion` where the copy is read from a folder.

### Antigravity's install path

The READMEs document the install as a shell pipeline, not an `agy` command: `mkdir -p ~/.gemini/config/plugins/gurita` and a `curl` of `https://github.com/uHappyLogic/gurita-antigravity/archive/refs/heads/main.tar.gz` piped into `tar -xz --strip-components=1 -C` that directory, the global path Antigravity loads the plugin from in every project, followed by a restart of any running `agy` session, since a new plugin directory is discovered only on startup. Checked on 2026-11-23 against `agy` 1.5.15: `agy plugin` lists the commands `list`, `import`, `install <target>` ("supports plugin[@marketplace]"), `uninstall`, `enable`, `disable`, `validate`, and `link`, with no update command and no scope option, and `agy plugin install --help` answered `Error: install target must be a directory: --help`. The Antigravity host definition's hands-on record (`scripts/hosts/antigravity/settings.toml`) notes that a workspace's own `.agents/plugins/` root is loaded beside the global install at session start though `agy plugin list` does not show it.

### Codex's install path

The READMEs document the install as `codex plugin marketplace add uHappyLogic/gurita-codex` then `codex plugin add gurita@gurita`. Checked on 2026-11-23 against `codex-cli` 0.159.3: `codex plugin marketplace add <SOURCE>` takes a local path, `owner/repo[@ref]`, or a Git URL, with `--ref`, `--sparse`, and `--json`; `codex plugin add <PLUGIN[@MARKETPLACE]>` takes `-m` and `--json` and no scope option; `codex plugin` has no update command, and `codex plugin marketplace upgrade [MARKETPLACE_NAME]` refreshes the configured Git marketplace snapshots. The installed copy stands under `~/.codex/plugins/cache/gurita/gurita/<version>/`.

### The distribution repositories

`/release-plugin` publishes each `hosts/<host>/` tree verbatim into `uHappyLogic/gurita-<host>` as one commit on `main`, tagged with the bare release version and carrying a GitHub release with the same notes. Checked with `git ls-remote` on 2026-11-23, each of `gurita-claude`, `gurita-antigravity`, and `gurita-codex` holds the branches `main` and `traffic-data` and the one tag `2.0.0`, `main` standing at the tagged commit. The Claude Code tree is a marketplace named `gurita` whose `.claude-plugin/marketplace.json` and `plugin.json` both carry the version; the Codex tree is a marketplace named `gurita` with the plugin under `plugins/gurita/`, the version in its `.codex-plugin/plugin.json`; the Antigravity tree carries `plugin.json` with the version at its root. This repository's root `.claude-plugin/marketplace.json` is also a marketplace named `gurita`, pointing at `./hosts/claude`, so a checkout registered as a directory marketplace and the distribution repository answer to the same marketplace name and the same `gurita@gurita` id.

### What this machine has installed

On 2026-11-23 `claude plugin list --json` holds two `gurita@gurita` entries, one at `user` scope and one at `project` scope for this repository, both enabled, `version` 1.9.0, `readFromFolder` this checkout's `hosts/claude`, `folderVersion` 2.0.0, and `claude plugin marketplace list --json` gives the marketplace `gurita` as a directory source at the checkout. The tracked `.claude/settings.json` holds `"gurita@gurita": true` under `enabledPlugins`, and `.claude/settings.local.json`, ignored through the user's global git ignore, holds no Gurita entry. `agy plugin list --json` holds `gurita` enabled at `~/.gemini/config/plugins/gurita`, version 1.9.0, `source` `antigravity`; `codex plugin list -m gurita --json` holds `gurita@gurita` installed and enabled, version 1.9.0, from the local marketplace `gurita` rooted at this checkout's `hosts/codex`. No harness here holds a copy installed from a distribution repository.

### Tests and documentation

`gurita-vscode/runner_tests/test_harness_check.py`, collected by both pytest runs, covers the script's copy selection per harness, its session, and its print; `src/test/harnessCheck.test.ts`, `settingsWindow.test.ts`, and `settingsPage.test.ts` cover the outcomes, the session-kept check, and the page's drawing against a stub of the `vscode` module and a stand-in for the DOM, with the script's print stubbed. Nothing runs inside an editor and no test starts a harness CLI. `gurita-vscode/README.md` documents the window under `## The Settings window`, with `### The harness check` and `### Enabling and disabling harnesses`, and its Requirements ask for `claude` and `agy`, each with the Gurita plugin installed, on the runner's `PATH`. The host suite, `host_tests/`, writes nothing to any installation and leaves bringing a copy up to date to the maintainer.

### The record and what is in flight

Three finished missions built the extension in this scope: `gurita-vscode/mission_vs-code-extension-first-version/` (2026-11-20), `gurita-vscode/mission_recipe-variants-and-harness-settings/`, and `gurita-vscode/mission_activity-bar-view-and-per-mission/` (both 2026-11-23). The second added the harness check and decided what this mission starts from: the check runs in a stdlib script beside the unchanged `runner.py` and in its session shell; one Claude Code entry wins by scope and its `enabled` value counts; a failed check shows in the settings alone and blocks nothing; every harness starts enabled whatever its check reports; every typed value goes through VS Code's input box; and everything the settings hold is stored in the per-user `~/.gurita/variants.json`, nothing in VS Code settings or the extension's stored state. The third made Settings a window of its own and kept the check's result for the extension's session. One other live mission overlaps this scope, `gurita-vscode/mission_marketplace-and-open-vsx-publication/`, `defined`: its goal is to publish the extension on the Visual Studio Marketplace and Open VSX with a user-facing README, an icon, listing metadata, and a release skill of its own, and it states that the check comparing the installed plugin's version with the packaged one stays as it is.

### Known gaps

Nothing in the extension installs or updates the plugin on any harness, and nothing reads a distribution repository or the latest published version. The check reports one Claude Code copy and no scope, so the window has no scope to show for an installed copy. Antigravity's CLI offers no update command and its documented install is a `curl` and `tar` pipeline. No install, update, or marketplace command was run against any harness in this exploration, so what each prints, how long it takes, whether it prompts, and what `agy plugin install` accepts beyond a directory are unobserved.

## Decisions

### Release fetched

- **Published release ref.** The latest published release of a harness's distribution repository is the one GitHub marks as latest for it: the newest release that is neither a draft nor a prerelease, or one a maintainer marked as latest. The extension reads it through GitHub's `releases/latest` endpoint or the `/releases/latest` page redirect and passes that release's tag to the harness's install path as an explicit ref: to Codex as `uHappyLogic/gurita-codex@<tag>` or `--ref <tag>`, to Antigravity as `archive/refs/tags/<tag>.tar.gz`, and to Claude Code through a marketplace source that carries the ref. An update reads the latest release again and moves the harness to its tag.

### Claude Code scopes

- **Marketplace registration scope.** For a Claude Code install made from the Settings window, the `gurita` marketplace is registered at the same scope as the install. A project or local install first runs `claude plugin marketplace add --scope <project|local>` on the distribution repository `uHappyLogic/gurita-claude`, its source carrying the release's ref as the published release ref decision states, which declares the marketplace in `.claude/settings.json` for a project install or `.claude/settings.local.json` for a local one, and then runs `claude plugin install gurita@gurita --scope <project|local>`, whether or not the marketplace is already known at user scope. A user-scope install registers the marketplace at user scope.

- **Scope selection.** The Claude Code row carries one Install control, like the other harnesses. A click on it opens VS Code's own quick pick (`showQuickPick`, which the extension already uses to pick a starting variant) listing user, project, and local, each with a one-line description of where it is recorded: user settings, the project's shared `.claude/settings.json`, or the project's local settings. The install runs at the scope picked, a dismissed pick installs nothing, and nothing is selected or stored on the page.

- **Install beside an existing copy.** While Claude Code holds a Gurita copy at one or more scopes that apply to the open project, the Settings window still offers Install for Claude Code, at every one of the three scopes (user, project, local) that holds no copy applying to the project, whether that scope is more or less specific than the copy that wins. A scope already holding an applying copy is not offered for Install, that copy being reached through Update. Copies at project or local scope recorded for other project roots do not count, since they do not apply to the open project.

- **Update target scopes.** One click on Update acts on every scope at which a Gurita copy was detected for the open project: the user entry and each project or local entry whose `projectPath` equals the project root. The window runs one scoped update per such scope in one run (`claude plugin update gurita@gurita -s user`, then `-s project`, then `-s local`, as detected), and the person chooses nothing about scope.

- **Disabled copy.** When the Claude Code entry that wins for the open project is disabled, its scope is listed as a detected scope, marked disabled. No Install is offered at that scope and no enable control is added: the window says the copy is disabled and must be enabled in Claude Code itself, through its `/plugin` menu or `claude plugin enable`.

- **Scopes with no folder open.** With no workspace folder open, the Settings window offers a Claude Code install at user scope alone: project and local are not among the scopes it offers, and nothing on the page mentions them until a folder is open. The home directory stays only the root the harness check runs from.

- **Several-scope display.** When Claude Code holds Gurita copies at several scopes that apply to the open project, the window names every applying detected scope and shows one version, the winning copy's. The winning scope is set apart, for example by being named first as the scope in effect with the others listed after it as also installed, and no version is shown for a scope that does not win. The harness check prints the scope names and which of them won.

### Running an install or update

- **Install run form.** An install or update started from the Settings window runs in a terminal the extension opens and shows, as a recipe run does, so its output and any prompt are visible and answerable there. The extension also watches that terminal's process end, taking its exit status through the terminal or through a VS Code task run in the terminal panel, and the window then reports how the run ended, success or failure, beside the harness or in a notification.

- **Check after install.** Whenever an install or update ends, whether it succeeded or failed, the window runs the whole harness check afresh by itself, for all three harnesses, exactly as Check again does and through that one code path, and the new result replaces the kept one for every harness.

- **Restart notice.** After every install or update that succeeds, on any of the three harnesses, the window adds one sentence to whatever reports how the run ended, for example a VS Code information notification: running sessions of that harness must be restarted to use the new copy. The sentence is the same for every harness and is shown whether or not the version changed, and nothing on the page persists it.

### Install and Update controls

- **Update control availability.** Update is offered for every harness whose check found the CLI and an installed Gurita copy. The version comparison does not gate it: a copy whose version matches the compared version gets the same enabled Update control as one that differs, and the check line beside it still reports whether the versions differ.

- **No confirmation.** A click on Install or Update starts the install or update at once, on every harness and at every scope, the click itself being the person's consent. The window asks for no confirmation first and then reports how the run ended.

- **Copy from another source.** Where a harness's existing Gurita copy, or its marketplace named `gurita`, comes from a source other than the distribution repository, for example a local checkout registered as a directory marketplace under the same name and plugin id, the window detects that source and, for that harness, neither installs nor updates: the control is refused or not offered, and the window states the source found and the CLI commands that would switch the harness to its distribution repository. A harness registered to the distribution repository, or holding no `gurita` marketplace, is installed and updated as usual. On Antigravity, whose listing names no source, the copy is acted on like any other.

### Antigravity install and update

- **Install mechanism.** The Antigravity install is done by a packaged stdlib Python script standing beside `harness_check.py`: it downloads the distribution repository's archive at the published release ref with `urllib` and extracts it with `tarfile`, stripping the archive's top directory, directly into `~/.gemini/config/plugins/gurita`. No shell pipeline and no `agy` command take part.

## Out of Scope

