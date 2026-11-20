# VS Code extension first version

## Goal

Deliver a first version of Gurita for VS Code (`gurita-vscode`), built in this repository from the design in `ideas/vscode_extension.md` and packaged as a VSIX. It carries all three of the draft's layers: the mission pane with its question view, the recipe and per-question buttons run under the bundled Python runner, and the looped task run with its tracked rule file, preview, and overrides.

The draft's decisions stand for what the person sees and clicks. The parts that only guard a long-lived extension, such as the Node steps in the drift-gate workflow and the cross-checks against the plugin's tools and fixed-line table, may be left out. Everything left out is written into one or more new documents under `ideas/` as potential follow-up work.

The mission's last task is the maintainer's own: installing the VSIX into their editor to try it, after which they may submit follow-up tasks by hand. Node commands run under Node 22 through nvm, as `(source "$HOME/.nvm/nvm.sh" && nvm use 22 && cd <directory> && <command>)`.

## Relevant starting state

## Decisions

## Out of Scope

