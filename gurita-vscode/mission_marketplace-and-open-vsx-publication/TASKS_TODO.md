# TASKS TODO

## Listing README and Checkout Build File

Rewrite `gurita-vscode/README.md` for a person installing from a listing: it keeps the extension's whole use documentation at its present depth (the side-bar view and its rows, the mission windows, the Settings window with the harness check, `### Installing and updating the plugin`, harness enabling, model and effort lists, variants, and single-task lines, the recipes with the shipped recipe file and the user's own, the looped task run and its rule file, and the runner), states that the extension runs only on macOS, Linux, or through Remote-WSL, carries no banner and no still screenshot, and takes out or rewords only the passages addressed to someone building from the checkout. Its Requirements, Building and packaging, and hand-install sections move into a new tracked `gurita-vscode/BUILDING.md`, kept out of the VSIX through `.vscodeignore` and linked from the README by an absolute repository URL, and `CLAUDE.md`'s pointers that send the reader to `gurita-vscode/README.md` for the package build are repointed to that file. It is verified by every use section the README holds today standing in the rewritten one, by a built VSIX carrying the README and not the build file, and by no pointer to the package build still naming the README.

---

## Demo GIF From a Capture Script

Write a tracked script under `gurita-vscode/scripts/` that seeds a sample project and mission from the host suite's fixture project, launches VS Code with a throwaway profile and the extension loaded, opens the mission from the side-bar view, starts a recipe run against a stand-in for the harness CLI placed first on `PATH`, so the run is deterministic and uses no model session, captures frames, and assembles them into one animated GIF tracked under `gurita-vscode/`; run it, and reference the GIF near the top of the listing README by a relative path the packager resolves against the repository's raw files, the README's only image, so the script, the GIF, and the reference land in one commit. It is verified by the script exiting cleanly, by the file standing at its path, opening with a GIF signature, and staying under the size bound the task's bar states, by that path being the one the listing README references, and by the captured frames showing the intended flow, a sample mission opened from the side-bar view and a recipe run progressing in a mission window. No test compares the committed GIF with the generator's output, because a capture is not reproducible byte for byte.

---

## Extension Build and Tests in CI

Extend the existing `drift-gate` job with a Node setup (`actions/setup-node`, pinned to a SHA, Node 22) and then `npm ci`, `npm test`, and `npm run package` in `gurita-vscode/`, the built VSIX discarded, so the extension's `node:test` tests and its package build run in CI; CI stays one job with no path filter and publishes nothing. It is verified by the workflow file parsing with the new action pinned to a full SHA, and by the same three commands passing locally from a fresh `npm ci`.

---

## Pin ovsx as a Dev Dependency

Add `ovsx` to `devDependencies` in `gurita-vscode/package.json` at an exact version, beside `@vscode/vsce` 4.1.1, and record it in `package-lock.json`, so the publish workflow and the release skill's pre-flight get the Open VSX publishing tool from the extension's own Node project after `npm ci`. It is verified by `npm ci` under the nvm Node 22 wrapper installing it into `node_modules/` and the local binary answering there, with `npm test` and `npm run package` still passing.

---

## Tag-Triggered Publish Workflow

Add `.github/workflows/publish-vscode-extension.yml` to `uHappyLogic/gurita`, triggered only by a pushed tag matching `gurita-vscode-*`, with one job running in the GitHub environment `extension-release` and holding `permissions: id-token: write`: it checks out the tagged commit, sets up Node 22 with `actions/checkout` and `actions/setup-node` pinned to full SHAs as in the other workflows, runs `npm ci`, `npm test`, and `npm run package` in `gurita-vscode/`, and publishes the one VSIX it built to the Marketplace through the pinned `vsce publish --oidc` and to Open VSX through the local `ovsx publish`, each with `--skip-duplicate`, `ovsx` reading the token from the `OVSX_PAT` environment variable mapped from the environment's secret, so no token appears on any command line or in any log and no Marketplace token exists. It is verified without publishing: by the workflow file parsing, by its trigger matching only `gurita-vscode-*` tags and every action pinned to a full SHA, by each publish command's flags read against `vsce publish --help` and `ovsx publish --help` from the pinned local binaries, and by its build steps passing locally from a fresh `npm ci`.

---

## Release-Plugin Ignores Extension Tags and Missions

Change `/release-plugin` so an extension release never reaches a plugin release: both of its lookups of the last plugin release gain the positive pattern only the bare plugin form matches, `git describe --tags --abbrev=0 --match '[0-9]*'`, with the same `--match` beside `--exclude=<VERSION>` on a resumption, and its step 5 drops every finished mission whose path lies under `gurita-vscode/`, by the path field `missions .` already prints, the extension missions already finished after `2.0.0` included, while a mission scoped elsewhere stays in the notes even when it changed the extension. It is verified by the lookup printing `2.0.0` in a scratch clone that also holds a `gurita-vscode-` tag nearer to `HEAD`, the 37 existing tags left as they are, and by reading step 5 against today's `missions .` print, from which it then keeps no mission under `gurita-vscode/`.

---

## Extension Release Skill and Changelog

Author the maintainer-only skill `.claude/skills/release-vscode-extension/SKILL.md` (`name: release-vscode-extension`, run as `/release-vscode-extension` with a required bare `MAJOR.MINOR.PATCH`) as every entry under `### Release skill` in `requirements.md` fixes it: the hard-stop pre-flight, its publishing-setup checks being `gh` reaching `uHappyLogic/gurita`, the publish workflow standing on `main`, the `extension-release` environment holding a secret named `OVSX_PAT` (read by name, never by value), and the Open VSX namespace `BusyMinds` existing through a registry query, with both local publishing binaries resolving; the bundled-plugin-state stop on its fixed line; the last extension release found with `--match 'gurita-vscode-*'`; the notes drafted from the missions finished under `gurita-vscode/` since it; the version written with `npm version <VERSION> --no-git-tag-version`; the notes prepended as an entry to a new tracked `gurita-vscode/CHANGELOG.md`; the one `Extension-release: <VERSION>` commit by which it recognises its own interrupted run; the single confirmation pause before any push; the push of `main` and of the lightweight tag `gurita-vscode-<VERSION>` that starts the publish workflow, whose run it watches with `gh run watch` and reports as its own outcome; on a re-run with the tag already pushed, no push and `gh run rerun --failed` on that run; and no publish command run on the machine, no token read, and no GitHub release. It is verified without publishing anything: by reading the skill against each of those entries, by running each of its read-only checks and lookups as written, and by a built VSIX carrying the changelog.

---

## First Publication Through the Release Skill

Make the first publication, which ends the mission's goal: the maintainer first adds the trusted-publishing policy on the `BusyMinds` publisher on the Marketplace's manage page, naming the repository `uHappyLogic/gurita`, the workflow `publish-vscode-extension.yml`, and the environment `extension-release`, then runs `/release-vscode-extension` by hand with a pre-1.0 version above `0.1.0`, such as `0.2.0`, and this maintainer-only task then verifies that run, changing no tracked file, the release's own commits landing separately from its `Task-completion:` commit. It is verified from what a completed run leaves, the `Extension-release: <VERSION>` commit on `main` with that version in the manifest and at both sites of `package-lock.json`, the `gurita-vscode-<VERSION>` tag pushed to `origin`, and the tag's publish workflow run succeeded with both publish steps passing, read back through `gh`, with no listing page opened, no registry queried, and the published extension installed in no editor. When the release has not been made or its run has not succeeded the task ends as failed, naming what the maintainer must still do, and a re-run after it completes the task.

---

## Root Documents Mention the Published Extension

After the first publication, give the root `README.md` a short subsection with links to both listings and to `gurita-vscode/README.md`, and give `CONTRIBUTING.md`'s `## Development` a pointer saying the extension under `gurita-vscode/` has a build and test loop of its own (Node 22 through nvm, independent of the host build and `VERSION`), documented in `gurita-vscode/BUILDING.md` rather than in its README, and is released through `/release-vscode-extension` rather than `/release-plugin`; `docs/` stays untouched. It is verified by reading both documents, the two listing links naming `BusyMinds.gurita-vscode` on the Visual Studio Marketplace and on Open VSX.

---
