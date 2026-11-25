# Project-defined knowledge placement

## Goal

Make the plugin agnostic about where a project keeps its lasting knowledge. `/finish-mission` stops writing lasting changes into the context file by rule and records them wherever the project's own context file says such knowledge belongs; the runners that read project context (the starting-state procedure, `derive-tasks`, the completion procedure) read the context file and then whatever it directs them to read for the area they work in. The plugin prescribes no structure of its own (no tree, no node format, no size rule), and a project whose context file states no such rules behaves exactly as today.

## Relevant starting state

## Decisions

## Out of Scope

