# TASKS TODO

## Write the Extension README

Write `gurita-vscode/README.md`, the extension's one document, holding everything a person who builds, installs, and uses it needs: the Node 22 build and packaging commands in the nvm form the goal states, where the VSIX lands and how to install it by hand with `code --install-extension`, the shipped recipe file and a person's own recipe file, the tracked rule file, and the user setting `gurita.ownRecipesFile`, while `README.md`, `CONTRIBUTING.md`, and `docs/` stay untouched. It is what the maintainer follows to package and install the first version. Verified by running each build and packaging command the file gives as written and by checking every path, name, and setting it states against the built extension.

---

## Write the Extension Follow-Up Document

Write `ideas/vscode_extension_follow_up.md`, flat in `ideas/` beside the draft, holding everything the first version leaves out, each item in a section of its own, grouped by kind under a few `##` headings: the guards of a long-lived extension (the drift-gate Node steps, the fixed-line, parse, and heading cross-checks, any tests left out), the checks left unmade (what a Codex line's plain print opens with, stated as unchecked), and deferred product work such as publication. It is the record the goal asks for of what was left out as potential follow-up work. Verified by reading it against the Drift-gate guards and Codex print check decisions and against the built extension, so that every left-out item appears and nothing it lists was in fact built.

---

## Revise the Design Draft After Delivery

Revise `ideas/vscode_extension.md` the way `ideas/gurita.md` was revised after the rename: its status sentences record the first version as built by this mission, each item under "Questions for the work" is marked as answered and carries the decision that settled it (the name, path, or format chosen), the two checks the draft left unmade are marked with their result or as moved to `ideas/vscode_extension_follow_up.md`, and the publication question stays open. Every other section (the rationale, what was measured, Decided, Considered and dropped, and the body's descriptions and examples) stays as written. Verified by the diff, which touches only the status sentences and "Questions for the work", and by checking every name, path, and format it records against the built extension.

---
