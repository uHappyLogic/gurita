# TASKS TODO

## Open Questions and Remaining Tasks as Tabbed Panes

Each mission page's stacked "Open questions" and "Remaining tasks" sections, drawn by `gurita-vscode/src/webview/page.ts` and styled in the stylesheet of `src/pane.ts`, become two panes behind one tab row whose two equal-width headers together fill the pane's whole width, only the selected pane's content shown beneath them and the New task button kept inside "Remaining tasks". The default selection is "Remaining tasks" when git holds at least one `Requirements-review:` commit for the mission (the count the workflow diagram already reads) and no question is open, and "Open questions" otherwise, a failed git read included; a tab the person clicks stays selected through redraws and file-event refreshes while the mission stays shown, is not saved, and gives way to the default worked out again on every switch of mission tab and every reopening of the pane. Verified by unit tests over the default rule (review count 0, 1, and 2 or more, with and without open questions, and a failed read), by rendering the page in a WKWebView with the pane's own stylesheet (the two headers spanning the row, one pane shown at a time, the default switching with the mission), by `gurita-vscode/README.md` and the source comments describing the two panes, and by `npm test` and `npm run package` passing under Node 22 through nvm.

---

## Focus a Mission's Run Terminal From Its Tab

Clicking a mission's tab in the pane drawn by `gurita-vscode/src/webview/page.ts`, whether or not that tab is already selected, brings forward and focuses the terminal of that mission's running runner when it has one, and does nothing more, with no notification, when it has none: the page posts the clicked mission's path to the extension on every tab click, and `src/pane.ts` answers by calling `show()` on the terminal `src/runs.ts` keeps for that mission. Verified by unit tests (a tab click posting its mission's path for a selected and an unselected tab, the terminal shown for a mission with a held run, nothing shown and no notification for one without), by `gurita-vscode/README.md` and the source comments describing the behaviour, and by `npm test` and `npm run package` passing under Node 22 through nvm.

---
