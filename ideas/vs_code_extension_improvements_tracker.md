# Gurita for VS Code: improvements tracker

A running list, started 2026-11-24, of changes to Gurita for VS Code (`BusyMinds.gurita-vscode`) noticed while using it. None is a mission yet. Each entry names what it changes by the label the extension shows today, and is grouped by where that label appears.

## Naming

- **Rename "Recipes" to "Actions".** This covers the heading of a mission page's list and every other place the user reads the word, such as "Your recipes" in the Settings window.
- **Rename the "Requirements iteration" recipe to "Approve all standing recommendations and review again".** The new name says what the chain does: it accepts every standing recommendation, then runs another review pass. This matches how Gurita is actually used, where recommendations are accepted in bulk and not one question at a time (see the next section).

## Question card

- **Remove the "Answer with recommendation" button.** It records one question's recommendation at a time, but in practice recommendations are accepted together through the renamed chain above. The card keeps "Discuss", "Answer", and the per-alternative buttons.
- **Stop drawing "Answer with this alternative" as a one-line button.** Today the button and its variant dropdown are squeezed onto one line. The variant the button will run should be stated after the button's title instead.
- **Add a "First" button before "Previous".** It jumps straight back to the first question without stepping back one at a time.
- **Draw the text between backticks as code.** The question, the pick's rationale, and each alternative's text, advantages, and drawbacks are drawn as plain text today, so the backticks around a file name or a command show literally.

## Mission page

- **Add an introduction section above the workflow diagram.** It shows the mission's title and its goal, so the page says which mission it is and what it is for before anything else.
- **Give the workflow diagram a heading of its own.** Once the introduction stands above it, the diagram needs a heading to mark where it starts.
- **Show when the mission is waiting for a terminal to exit.** While a run blocks the page, nothing says why it is blocked. Add an indicator that the mission is waiting for the run's terminal to close. Switching the indicator on or off must not move the page's content, so its space is reserved whether or not it shows.
- **Make "Ask in mission context" always available.** A question about the mission can come up at any step, so the action should not depend on the step the diagram fills.
- **Draw each recipe button on a row of its own, with a description to its right.** Today the buttons stand side by side in one wrapping row, and what a chain does can be read only from its raw lines in the button's hover text. Each recipe gets one line of description, written in the recipe file as a `Description:` line beside its `Stage:` line and shown in the button's row, to the right of the button.
- **Say before a run what would stop it.** Two conditions surface today only as a stopped chain in the terminal. One is another started mission holding the mission's scope, which stops every run that derives, adds, or completes tasks. The other is an uncommitted change in `requirements.md` or `open_questions.xml`, which stops the answer sweep. The page should show a notice for each while it holds.
- **Show each remaining task's brief.** The "Remaining tasks" pane lists the task headings alone. Each heading should carry its brief beneath it, read from the same `TASKS_TODO.md`.
- **List the completed tasks.** A completed task leaves the page today. The page should list the mission's completed tasks as the bundled missions tool's `tasks` query prints them, each with its verified bar and a link to its commit. They are hidden by default, behind one control that shows and hides them.

## Typed values

- **Ask for long values in a multi-line box.** An answer, a mission's goal, and a new task's issue description are each typed into VS Code's one-line input box today. Each needs room for several lines.

## Runs

- **Add a setting that closes a run's terminal by itself when its chain finishes.** Today every run waits for a keypress at its end, a successful one included, and the mission's page stays blocked until then. With the setting on, a chain that ran all its lines closes its terminal and unblocks the page. A chain that stopped keeps waiting, so its output can still be read.
- **Re-read the missions when git state changes.** Only the mission documents are watched, so a commit, a pull, or a branch switch made outside one of the extension's runs can leave a mission's next step and its review-round count stale until "Refresh".

## Side-bar view

- **Show a missing or outdated plugin in the view.** A failed harness check is shown only in the Settings window, and the check first runs when that window opens. Someone who has just installed the extension therefore sees `No mission is live.` and learns that the plugin is missing only from a run failing in its terminal. The view should say when the check fails and link to the Settings window, where "Install" and "Update" stand.
- **Offer the workflow bootstrap in the view.** No recipe or button runs `init-mission-base-workflow` today. The view should offer it while the project's context file holds no `## Mission Workflow` section.
- **List the finished missions under one expandable row.** A finished mission disappears from the view today, and `capture-mission-principle-updates` has no button. The view should hold one row, collapsed by default, that expands to the finished missions as the bundled missions tool lists them. Each opens that mission's summary and completed tasks and offers a "Capture principles" action.
- **Open the new mission's window when "Define mission" creates it.** Today the mission appears as a new row, which you find and click yourself.
- **Offer "Gurita: Open Mission…" in the Command Palette.** The command lists the live missions and opens the picked one's window. The Command Palette offers only "Gurita: Refresh Missions" today, and the extension's README names the side-bar view as the only entry point, so this reverses a stated choice.

## Recipes and harnesses

- **Read a recipe file from the project.** Recipes of your own live in one per-user file, `~/.gurita/recipes.md` or the path `gurita.ownRecipesFile` names, so a project's chains cannot be shared with the people working on it. A recipe file tracked in the repository, as `task_line_rules.txt` already is, should be read beside the shipped file and your own.
- **Offer Codex in the harness dropdown, and ship a Codex line.** The Settings window checks Codex and holds its model list, but a line's harness dropdown offers Claude Code and Antigravity only, and no shipped recipe holds a `codex` line.

## Listing README

- **Shorten it to a showcase.** `gurita-vscode/README.md` is the page the Visual Studio Marketplace and Open VSX show, and today it is about 950 lines of reference prose with one GIF. It should lead with screenshots of the side-bar view, a mission page, and the Settings window, saying what each is for, with the reference prose moved to a document the listing links to.

## Root README

- **Lead with the extension.** The root `README.md` should open with a showcase of using the extension, with the plugin's manual installation moved further down. Today "Installation" comes first and the extension appears only as the last subsection under it.
