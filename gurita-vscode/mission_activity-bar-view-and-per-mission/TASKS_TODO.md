# TASKS TODO

## Centre Arm Drawing for the Icon

Draw the icon's centre arm by hand as a plain-text file of its own, `assets/icon-centre-arm.txt`, printable ASCII with one grid row per line in the form `assets/banner.txt` uses: an arm that is none of the banner's eight, in the banner's characters and style at a larger character scale, with more rows and columns than the banner's ten-row long arm. It is the icon's second hand-drawn source beside the banner's drawing, which the icon script reads for the centre arm; verified by checking the file's character set and its row and column counts against the banner's long arm, with `assets/banner.txt` and `assets/banner.svg` left unchanged.

---

## Icon Script and Tracked Activity-Bar Icon

Add `scripts/render_icon.py`, a stdlib-only Python script run by hand like `scripts/render_banner.py`, which stays unchanged, that writes the activity-bar icon as a tracked SVG under `gurita-vscode/media/`: two short arms cut verbatim from `assets/banner.txt` as a mirrored pair curling inward, one from the drawing's left half on the left and one from its right half on the right, either side of the centre arm read from `assets/icon-centre-arm.txt`, the three composed at one common character scale with no arm magnified. Each arm is drawn as a filled, tapering outline derived from its drawing, with its curl, in one fill colour and with no character drawn as text, the centre arm keeping its suckers as round holes cut out of the fill, the two side arms plain silhouettes with no holes, and the brackets surviving only as the shapes' edges. Verified by a new pytest test under `tests/`, shaped like `tests/test_banner.py`, that loads the script and asserts the tracked icon is well-formed SVG and equals what the script renders from the two drawings, passing in both pytest runs.

---

## Live Read and Watcher Last the Session

Take the live read and the one file watcher off the mission pane's lifetime: the extension still reads no mission and watches no file until a Gurita command first runs, and from then the read and the watcher last until the extension deactivates, released neither when the pane is hidden nor when it is closed. Every debounced burst of file events re-reads what it touches whatever is visible, a hidden pane is redrawn from the current read by its ready message when shown, and no stale flag is left; this is the one read the side-bar tree and every window will draw from. Verified by the pane tests against the `vscode` stub, the watcher surviving the pane's disposal and an event during a hidden pane showing in what its next ready message is answered with.

---

## Side-Bar Tree of Live Missions

Contribute an activity-bar container, its icon the tracked SVG under `gurita-vscode/media/`, holding one side-bar view: a native tree with one leaf row per live mission and no child rows, the row's label the mission's title, its description the next workflow step's name followed by both counts in a compact form such as "Derive tasks · 3 questions · 2 tasks", its icon a spinning `ThemeIcon` while the mission's run is going and a steady mission icon otherwise, and its tooltip all five facts spelled out in full beside the mission's path, a click on the row opening nothing yet. Each step or count that could not be read is replaced, on its own, by one fixed placeholder in its slot, never a zero count, with the row's hover text naming the cause (the missing or unparsable file with its path, or for the step a failed git read) and no warning icon or colour. The view's first resolution starts the session's read and the tree is redrawn on every re-read and at every run's start and end; verified by tests of the rows against a tree stand-in added to the `vscode` stub, a check of the manifest, and the packaged VSIX carrying the icon, with `gurita-vscode/README.md` describing the view.

---

## Side-Bar View Message With No Mission Row

Show both states in which the side-bar view has no mission row to draw through the tree view's own `message` property (`TreeView.message`), the tree returning no mission row: today's line `No mission is live.` with no mission live, and today's failure line `The live missions could not be read.` followed by the cause as the read gave it when the live read fails, a successful read with missions clearing the message. Nothing is added to the manifest for either state, with no welcome content, context key, or placeholder row, and the view's other contents stay as they are; verified by tests of the message in the three states against the `vscode` stub, with `gurita-vscode/README.md` naming both lines.

---

## New Mission and Define Mission Tree Rows

Add New mission and Define mission to the side-bar tree as two rows standing above the mission rows in every state of the view, each labelled with its control's name, its `description` showing the harness, model, and effort of the remembered variant, read from that variant's lines, and a click on the row running that variant, its goal, and for Define mission then its scope, asked for in VS Code's input box as today. An inline icon action on the row, also offered in its context menu, opens a QuickPick of the recipe's variants that changes the remembered selection, kept once per project as today, without starting a run, and the commands behind the rows and the action are hidden from the Command Palette through `menus.commandPalette` entries whose `when` is `false`. Verified by tests against the `vscode` stub of the two rows, a click's run, and a QuickPick pick, with `gurita-vscode/README.md` describing the rows.

---

## Refresh Missions Command and Title-Bar Action

Replace `gurita.refreshMissionPane` with a refresh command under a new id whose title names missions rather than the pane, Gurita: Refresh Missions, and add Refresh as an icon action in the side-bar view's title bar that runs that same registered command. The command re-reads the side-bar tree and every open window, and it is the one command of the extension's own the Command Palette is to offer beside the focus command VS Code generates for the view; verified by a check of the manifest and a test against the `vscode` stub that running it re-reads the live missions and redraws the tree, with `gurita-vscode/README.md` naming the command.

---

## Settings Window of Its Own

Move the settings view out of the mission pane's page into a Settings window of its own in the editor area, opened, or revealed when already open, by a Settings command that is hidden from the Command Palette and run by an icon action in the side-bar view's title bar beside Refresh; the pane's tab row loses its Settings control and the view its Close settings control. The harness check first runs on the first opening of the Settings window after the extension activates, its result kept in the extension's own module state for the rest of that session across every close and reopening of the window, only the check-again control running it afresh and no timestamp or stored record added, and every edit made in the window shows at once on every other surface, the refresh command re-reading the window too. Verified by tests against the `vscode` stub of the window's opening and reveal, the check's one run across a close and a reopening, and an edit reaching the mission pages and the two tree rows, with `gurita-vscode/README.md` describing the window.

---

## Mission Windows Replace the Mission Pane

Replace the one mission pane with a window per mission: a click on a mission's row in the side-bar tree does nothing beyond opening that mission's own window in the editor area, or revealing it when open, several windows open at once, each showing that one mission's page with no tab row and drawing from the session's one read. While the live read fails every open window replaces its whole page with the line `The live missions could not be read.` and the cause beneath it, and a window whose mission stops being live stays open showing one fixed notice that the mission is no longer live, with no diagram, recipe, pane, or action button, each drawing its mission's page again once a live read lists the path. The pane, its tab row, and `gurita.openMissionPane` are removed and the command behind the row click is hidden from the Command Palette, leaving the refresh command the only one of the extension's own it offers; verified by the pane and page tests reworked for several windows, with `gurita-vscode/README.md` describing the windows.

---

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
