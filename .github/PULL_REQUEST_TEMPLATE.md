Mission: `<scope>/mission_<slug>/` <!-- the reserved path: the one the maintainer's `Mission-definition: <path>` commit on `main` names, trailing slash included -->
Closes #<proposal issue>

## Finished-mission checklist

The reviewer confirms the branch carries what a finished contributor mission leaves in the tree and the log — the one check CI does not make.

- [ ] The mission's directory, `<path>`, is gone from the tree: the branch carries one `Mission-finish: <path>` commit that removes it, which `/finish-mission` makes only once no open question and no task section stands, and whose body is the mission's summary — its title line, a blank line, and its bullets (`python3 core/tools/missions.py summary <path>` prints it back).
- [ ] The branch carries one `Task-completion: <task heading>` commit per completed task, each with the task's verified `- ` bullets as its body (`python3 core/tools/missions.py tasks <path> --with-body` lists them).
- [ ] The knowledge tree is touched only for lasting changes, each written into the node of the folder holding what it governs (that folder's `README.md`, or its description in the root `CLAUDE.md`), and the root `CLAUDE.md` itself only for what binds everywhere.
- [ ] `hosts/` is rebuilt — the `drift-gate` status check passes on this pull request.
