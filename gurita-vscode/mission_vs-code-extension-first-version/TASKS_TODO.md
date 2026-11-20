# TASKS TODO

## Runner Verdict From Last Fixed Line

Change the check step of `gurita-vscode/runner.py` so that a headless line's verdict is read from the last whole line of its print that is a success, no-op, or stop line of the bundled fixed-line file, verdict-kind lines never counting, with a print holding no such line stopping the chain as an unlisted first line does today, because `claude -p` prints one message per turn when a skill's background agents wake its session and the first non-blank line of the whole print is then an interim message: a First run chain stopped at its alternatives line on `I've started 15 background agents…` although that line's final message opened with `Alternatives embedded.`. The looped run's `Task completed.` test reads the same line, each line still runs exactly as its recipe writes it with no output flag added, and the runner's docstring and `gurita-vscode/README.md` state the new reading where they state the old one. It is verified by runner tests covering a print of several messages (interim text above a success line, a success line followed by the review's still-open list and verdict line, and a print with no fixed line) passing in both pytest runs.

---
