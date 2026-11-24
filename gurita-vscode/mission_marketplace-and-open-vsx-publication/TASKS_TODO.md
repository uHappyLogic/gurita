# TASKS TODO

## First Publication Through the Release Skill

Make the first publication, which ends the mission's goal: the maintainer first adds the trusted-publishing policy on the `BusyMinds` publisher on the Marketplace's manage page, naming the repository `uHappyLogic/gurita`, the workflow `publish-vscode-extension.yml`, and the environment `extension-release`, then runs `/release-vscode-extension` by hand with a pre-1.0 version above `0.1.0`, such as `0.2.0`, and this maintainer-only task then verifies that run, changing no tracked file, the release's own commits landing separately from its `Task-completion:` commit. It is verified from what a completed run leaves, the `Extension-release: <VERSION>` commit on `main` with that version in the manifest and at both sites of `package-lock.json`, the `gurita-vscode-<VERSION>` tag pushed to `origin`, and the tag's publish workflow run succeeded with both publish steps passing, read back through `gh`, with no listing page opened, no registry queried, and the published extension installed in no editor. When the release has not been made or its run has not succeeded the task ends as failed, naming what the maintainer must still do, and a re-run after it completes the task.

---

## Root Documents Mention the Published Extension

After the first publication, give the root `README.md` a short subsection with links to both listings and to `gurita-vscode/README.md`, and give `CONTRIBUTING.md`'s `## Development` a pointer saying the extension under `gurita-vscode/` has a build and test loop of its own (Node 22 through nvm, independent of the host build and `VERSION`), documented in `gurita-vscode/BUILDING.md` rather than in its README, and is released through `/release-vscode-extension` rather than `/release-plugin`; `docs/` stays untouched. It is verified by reading both documents, the two listing links naming `BusyMinds.gurita-vscode` on the Visual Studio Marketplace and on Open VSX.

---
