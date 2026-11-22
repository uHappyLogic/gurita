# Recipe variants and harness settings view

## Goal

Replace the mission page's host-grouped recipe list in Gurita for VS Code with one button per recipe carrying selectable variants. Each variant is a literal block of command lines; the button shows the harness, models, and efforts of the selected variant, read from its lines, and a dropdown beside it switches variants, the choice remembered. Add a settings view to the pane that checks each harness (its CLI found through the runner's shell, its installed Gurita plugin, and that copy's version against the one the extension was packaged from), enables or disables it, holds its model and effort lists, and edits variants: duplicate, rename, delete, pick the default, and change each line's model and effort, stored as literal lines in a per-user file. The looped task run, its rule file, and the runner stay as they are.

## Relevant starting state

## Decisions

## Out of Scope

