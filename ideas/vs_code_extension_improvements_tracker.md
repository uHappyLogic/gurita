# Gurita for VS Code: improvements tracker

A running list, started 2026-11-24, of changes to Gurita for VS Code (`BusyMinds.gurita-vscode`) noticed while using it. None is a mission yet. Each entry names what it changes by the label the extension shows today, and is grouped by where that label appears.

## Naming

- **Rename "Recipes" to "Actions".** This covers the heading of a mission page's list and every other place the user reads the word, such as "Your recipes" in the Settings window.
- **Rename the "Requirements iteration" recipe to "Approve all standing recommendations and review again".** The new name says what the chain does: it accepts every standing recommendation, then runs another review pass. This matches how Gurita is actually used, where recommendations are accepted in bulk and not one question at a time (see the next section).

## Question card

- **Remove the "Answer with recommendation" button.** It records one question's recommendation at a time, but in practice recommendations are accepted together through the renamed chain above. The card keeps "Discuss", "Answer", and the per-alternative buttons.
- **Stop drawing "Answer with this alternative" as a one-line button.** Today the button and its variant dropdown are squeezed onto one line. The variant the button will run should be stated after the button's title instead.
- **Add a "First" button before "Previous".** It jumps straight back to the first question without stepping back one at a time.

## Mission page

- **Add an introduction section above the workflow diagram.** It shows the mission's title and its goal, so the page says which mission it is and what it is for before anything else.
- **Give the workflow diagram a heading of its own.** Once the introduction stands above it, the diagram needs a heading to mark where it starts.
- **Show when the mission is waiting for a terminal to exit.** While a run blocks the page, nothing says why it is blocked. Add an indicator that the mission is waiting for the run's terminal to close. Switching the indicator on or off must not move the page's content, so its space is reserved whether or not it shows.
- **Make "Ask in mission context" always available.** A question about the mission can come up at any step, so the action should not depend on the step the diagram fills.

## Root README

- **Lead with the extension.** The root `README.md` should open with a showcase of using the extension, with the plugin's manual installation moved further down. Today "Installation" comes first and the extension appears only as the last subsection under it.
