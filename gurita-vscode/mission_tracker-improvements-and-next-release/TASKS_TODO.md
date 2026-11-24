# TASKS TODO

## Interactive Lines Switched to Codex

Extend the harness dropdown's Codex switch to interactive lines, after one hands-on check on the installed `codex` (0.159.3 today) that a `$gurita:` skill named in the initial prompt of a bare `codex` runs and that the session stays open on its result. The switch keeps the line interactive: the command word becomes a bare `codex` with no `exec`, the prompt is rewritten from `"/gurita:…"` to `'$gurita:…'`, `--dangerously-skip-permissions` becomes `--dangerously-bypass-approvals-and-sandbox`, the model and effort are written as `-m` and `-c model_reasoning_effort=…` under the headless switch's empty-list rules, any `-i` an `agy` line carried is dropped, and the trailing `# interactive` mark is kept, a switch back giving `claude "…"` or `agy -i "…"`. Verified by line-value tests of the switch and its round trip from both harnesses, with the extension's documentation giving the interactive Codex form beside the headless one as checked.

---

## Shipped Codex Single-Task Recipe

Add exactly one Codex recipe to `gurita-vscode/shipped_recipes.md`, a single-task recipe standing beside the shipped single-task lines: one headless `codex exec '$gurita:complete-task …' --dangerously-bypass-approvals-and-sandbox` line that also carries `-m` with a named Codex model id taken from the catalog `codex debug models` prints, the recipe's name saying the model as the Claude Code single-task names do. No chain and no button recipe gains a Codex line or variant; verified by reader tests of the recipe as a named single-task line and a runner test of its line read as headless, with `gurita-vscode/README.md` naming the recipe.

---

## Screenshots and Demo From One Capture

Extend `gurita-vscode/scripts/capture_demo.js` so the one run that records `media/demo.gif` also writes three screenshots as PNG files under `gurita-vscode/media/`: full-resolution frames of the side-bar view once the mission row shows and of the mission page once it has filled `derive tasks` with the questions' alternatives and picks drawn, and, in one more step after the run, of the Settings window before the session closes, against the same fixture project seeded from `tests/fixtures/host_project/` and the same `scripts/demo_claude.py` stand-in. Bring the script's flow up to the finished UI, run it, and commit the re-captured GIF with the three stills, BUILDING.md's recording entry covering both. Verified by the one command ending with all four files written and each showing the finished UI.

---

## Listing README Shortened to a Showcase

Move the reference prose of `gurita-vscode/README.md` into one new Markdown file beside it, `gurita-vscode/USAGE.md`, keeping the current section order (side-bar view, mission windows, Settings window, recipes, looped task run, runner), kept out of the VSIX by `.vscodeignore` as `BUILDING.md` is. The shortened README leads with the three screenshots of the side-bar view, a mission page, and the Settings window, saying what each is for, and links to the reference document by its absolute GitHub URL, the form its `BUILDING.md` link already takes. Verified by the packaged VSIX carrying the short README and no `USAGE.md`, the README's images and links resolving, and no reference prose lost in the move.

---

## Root README Leads With the Extension

Open the root `README.md` with a showcase of using Gurita for VS Code, with the screenshots of the finished UI and links to both listings, ahead of `## Installation`, so the plugin's manual installation moves further down and the extension no longer appears only as that section's last subsection. Verified by the README's section order and by its images and links resolving.

---

## Delete the Improvements Tracker

Delete `ideas/vs_code_extension_improvements_tracker.md`, once each of its 26 entries is confirmed carried out in the extension and the two READMEs as they stand. Verified by the file's absence, the other files under `ideas/` unchanged, and no file outside the mission directory naming it.

---
