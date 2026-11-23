# TASKS TODO

## Run Terminal Shown on Window Activation

Each time a mission's window becomes the active editor while that mission's run is going, by a click on its row in the side-bar tree, a click on its editor tab, or keyboard navigation between editors, bring that run's terminal forward without taking the focus (`terminal.show(true)`), read from the panel's `onDidChangeViewState`. Neither the side-bar tree nor the mission's page draws a control for it, and a click for a mission whose run is going is still refused with the notification and that run's terminal shown; verified by a test against the `vscode` stub that records each `show` call's `preserveFocus` argument, with `gurita-vscode/README.md` saying when the terminal comes forward.

---

## Mission Window Tab Titles and Icon

Title each mission window's editor tab with the mission's title alone, every colliding tab gaining its mission's scope after a separator while another live mission carries the same title, and re-title the tabs on every live re-read. Set every mission window's `iconPath` to one fixed built-in codicon through a `ThemeIcon`, with no image file and no light-theme variant made for it; verified by tests against the `vscode` stub of a lone title, two live missions sharing one, and a re-read that ends the collision.

---

## Settings Gear on Mission Window Title Bars

Offer Settings on every mission window as an icon action, a gear codicon, in that window's editor title bar, contributed through a `menus` `editor/title` entry whose `when` matches the mission window's webview view type (`activeWebviewPanelId`) only, so it is offered on the mission's page, the failure state, and the no-longer-live notice alike. It runs the same hidden Settings command the side-bar's title-bar action runs, and the mission's page draws no Settings control; verified by a check of the manifest's entry against the view type the extension registers, with `gurita-vscode/README.md` naming the action.

---

## Windows Restored After a Reload

Bring the mission windows and the Settings window that were open back after a restart or a window reload, in the editor group and tab position they held: the extension registers a `WebviewPanelSerializer` for the mission window's view type and one for the Settings window's, and the manifest carries an `onWebviewPanel:` activation event for each. Each mission window keeps its mission's path in its webview state and is redrawn on restore from a fresh read of the live missions for that path, its `setState` values coming back with it and its restore starting the session's read as the view's first resolution does, and the Settings window is redrawn from fresh reads. A restored window first shown while a window for the same mission, or the Settings window, is already open is closed, as is one whose saved state is missing or cannot be read; verified by tests against the `vscode` stub of each of those restores and a check of the manifest, with `gurita-vscode/README.md` saying the windows survive a reload.

---

## Remove the VS Code Extension Design Drafts

Remove `ideas/vscode_extension.md` and `ideas/vscode_extension_follow_up.md` together, rewriting none of the follow-up's citations and moving nothing of the draft's What was checked of VS Code section or its Sources list into another file, so both stand only in git history. The `ideas/` entry of `CLAUDE.md`'s repository layout stops listing them, so no document is left holding a reference to either; verified by a search of the tracked files outside mission directories for `vscode_extension` finding nothing.

---
