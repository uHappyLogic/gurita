# TASKS TODO

## Centered Workflow Diagram With Vertical Fallback

Each mission page's seven-block workflow diagram, drawn by `gurita-vscode/src/webview/page.ts` and styled in the stylesheet of `src/pane.ts`, is centered horizontally in the mission pane and lies in one horizontal row while that row fits the pane's width; when the row would overflow, it switches to a vertical stack of the same blocks joined by downward arrows, likewise centered and keeping the dashed borders of the two optional blocks, the solid borders of the five required ones, and the filled block with its pulse, and it switches back once the pane is wide enough again, never wrapping or scrolling sideways. Verified by rendering the page in a WKWebView with the pane's own stylesheet at a wide and a narrow width (the diagram centered in both, horizontal when wide, vertical when narrow, and switching on resize), by `gurita-vscode/README.md` and the source comments describing the centering and the vertical fallback, and by `npm test` and `npm run package` passing under Node 22 through nvm.

---

## Seven-Step Workflow Diagram in the Root README

The Mermaid block at the top of the root `README.md`, which mirrors the pane's workflow diagram, is redrawn as the pane's seven blocks in one line under the names `gurita-vscode/src/webview/page.ts` gives them (define, first review round, additional review round, derive tasks, execute tasks, follow up tasks, finish), joined by arrows, with no subgraphs, loop edge, or handoff label, the two optional blocks (additional review round, follow up tasks) dash-bordered and the five required ones solid, nothing highlighted, and no count on the additional-round block, since the README's diagram is static. Verified by extracting the block and rendering it with `@mermaid-js/mermaid-cli` under Node 22 through nvm with no syntax error and all seven block names present, and by `git diff` naming only `README.md`, changed only inside the Mermaid block, with `README.md` still not mentioning the extension.

---

## Open Questions and Remaining Tasks as Tabbed Panes

Each mission page's stacked "Open questions" and "Remaining tasks" sections, drawn by `gurita-vscode/src/webview/page.ts` and styled in the stylesheet of `src/pane.ts`, become two panes behind one tab row whose two equal-width headers together fill the pane's whole width, only the selected pane's content shown beneath them and the New task button kept inside "Remaining tasks". The default selection is "Remaining tasks" when git holds at least one `Requirements-review:` commit for the mission (the count the workflow diagram already reads) and no question is open, and "Open questions" otherwise, a failed git read included; a tab the person clicks stays selected through redraws and file-event refreshes while the mission stays shown, is not saved, and gives way to the default worked out again on every switch of mission tab and every reopening of the pane. Verified by unit tests over the default rule (review count 0, 1, and 2 or more, with and without open questions, and a failed read), by rendering the page in a WKWebView with the pane's own stylesheet (the two headers spanning the row, one pane shown at a time, the default switching with the mission), by `gurita-vscode/README.md` and the source comments describing the two panes, and by `npm test` and `npm run package` passing under Node 22 through nvm.

---

## Focus a Mission's Run Terminal From Its Tab

Clicking a mission's tab in the pane drawn by `gurita-vscode/src/webview/page.ts`, whether or not that tab is already selected, brings forward and focuses the terminal of that mission's running runner when it has one, and does nothing more, with no notification, when it has none: the page posts the clicked mission's path to the extension on every tab click, and `src/pane.ts` answers by calling `show()` on the terminal `src/runs.ts` keeps for that mission. Verified by unit tests (a tab click posting its mission's path for a selected and an unselected tab, the terminal shown for a mission with a held run, nothing shown and no notification for one without), by `gurita-vscode/README.md` and the source comments describing the behaviour, and by `npm test` and `npm run package` passing under Node 22 through nvm.

---
