# TASKS TODO

## Runner Step Marker Before Each Line

Make the script `gurita-vscode/runner.py` composes print one marker line to the terminal before every recipe line, in a chain and in each task's session of a looped run, naming the line's number, the total, and the line's text as written (for example `Line 3 of 4: claude -p ...`), for headless, interactive, and shell-step lines alike, because today a step's start is recorded only in the run-local progress file and a person watching a run cannot see where each step began. The marker is printed outside the `{ ... } | tee` group, so it never reaches the file the check step reads, and it is verified by runner tests in `gurita-vscode/runner_tests/` passing in both pytest runs.

---
