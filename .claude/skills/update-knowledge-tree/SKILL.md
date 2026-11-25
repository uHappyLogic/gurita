---
name: update-knowledge-tree
description: Bring this repository's knowledge-tree nodes up to date with the commits made since the last update and repair every knowledge-tree check failure.
---

# update-knowledge-tree

Keeps this repository's knowledge tree honest: the root `CLAUDE.md` and the `README.md` nodes
below it, each holding its folder's purpose, rules, commands, and pointers. This `SKILL.md` is
the single place the tree's upkeep procedure is documented; the knowledge tree's
`.claude/README.md` node points at it and no other file restates it. It is a maintainer-only,
project-local skill beside `/release-plugin` and `/release-vscode-extension`: it lives under
`.claude/skills/`, outside `core/`, so no host build renders it and it never reaches a
consuming project.

One run brings the nodes up to date with the commits made since the skill's last run, and
repairs every failure of the knowledge-tree check, `tests/test_knowledge_tree.py`. Its
**anchor** is the latest commit under its own subject marker, `Knowledge-tree-update:`, found
in the log the way the missions tool's `since` finds a starting state's anchor, so nothing in
the tree records where the last run stopped and nothing can drift from the log. With no
anchor, the run is a first run and compares every node with its folder. The run commits its
edits under that marker, which moves the anchor to the commit it makes.

The tree's own rules are the root `CLAUDE.md`'s `## Rules`: where an area's lasting knowledge
goes, how nodes are read, where a rule spanning folders is stated, the fixed parts of a node,
the pointer form, folder coverage, and the budgets. Read them before step 1 and follow them in
every edit this run makes; this skill restates none of them.

The run writes only node files: the root `CLAUDE.md` and the `README.md` files the check counts
as nodes (every tracked `README.md` but the root landing page, `gurita-vscode/README.md`, the
build output under `hosts/`, and the host templates `scripts/hosts/<host>/README.md`, as
`is_node` in the check states). It edits no runtime file, tool, test, page, or other document
to make a node true; a node that the tree no longer matches is corrected to the tree, never the
tree to the node.

## Usage

```
/update-knowledge-tree
```

The skill takes no argument. Run it from the repository root, on any branch.

Every `<NAME>` placeholder in the commands below is substituted as the literal value, and no
command in this file holds a `$` followed by a digit, since the skill loader substitutes
positional-argument tokens into this text before it is read.

## Workflow

### 1. Pre-flight stops

Each stop changes nothing, reports its one line first and its detail beneath it, and ends the
run.

- **Shallow clone.** Run `git rev-parse --is-shallow-repository`. On `true`, stop with
  `Knowledge tree not updated — the clone is shallow.` and the remedy `git fetch --unshallow`
  beneath it: a truncated log can hide the anchor, and a first run taken in its place would
  re-compare every node for no reason, or read the commits since the anchor as fewer than
  they are.
- **Uncommitted node changes.** Run `git status --porcelain -- CLAUDE.md '*README.md'` and set
  aside the lines for the files that are not nodes (the root `README.md`,
  `gurita-vscode/README.md`, anything under `hosts/`, and `scripts/hosts/<host>/README.md`).
  If any line is left, stop with `Knowledge tree not updated — a node holds uncommitted
  changes.` and those lines beneath it: the run's commit is path-scoped to the nodes it
  edits, so an uncommitted change already in one would ride into it under this skill's
  marker. Uncommitted changes anywhere else in the tree are not the run's and are left
  exactly as they stand.

### 2. Find the anchor

```bash
git log --no-merges --format='%h %s' | grep -m 1 -E '^[0-9a-f]+ Knowledge-tree-update:' | cut -d ' ' -f 1
```

It prints the abbreviated hash of the latest non-merge commit whose subject opens with
`Knowledge-tree-update:`, or nothing. Call the hash `<ANCHOR>` from here on. Hold the
abbreviated hash of `HEAD` (`git rev-parse --short HEAD`) as `<HEAD>`.

- **No line** — a first run: skip step 3, and in step 4 every node is an affected node, each
  compared whole with its folder.
- **A hash** — read what moved since in step 3.

### 3. Read what changed since the anchor

```bash
git log --no-merges --format='%h%x09%ad%x09%s' --date=short <ANCHOR>..HEAD
git diff --name-status -M <ANCHOR> HEAD
```

The first prints the commits made since the anchor, newest first; the second the net set of
paths they changed, a renamed or moved file on one `R` line with its old and new path. If the
log prints nothing, no commit moved the tree: go to step 5, which still runs the check.

Read each commit's subject, and for a commit whose subject alone does not say what it changed
(every `Task-completion:` and `Mission-finish:` commit among them) its body, with
`git show -s --format=%B <hash>`: a task's verified bar and a finished mission's summary say
what the work made lasting, which is what a node records. Read the diff of a changed file
wherever its subject and body leave open whether a node's sentence still holds.

Map each changed path, the old and the new path of a rename both, to the **node of the folder
holding it**: walk up from the path's own folder to the first folder that has a node, where a
folder's node is its `README.md` node, or, for `core/`, `hosts/`, `gurita-vscode/`, and
`.github/`, its `### <folder>/` description in the root `CLAUDE.md`, and a file at the
repository root maps to the root `CLAUDE.md`. Leave out every path inside a `mission_*/`
directory: a mission's own files are the workflow's record of that mission, held by no node,
and the work it carried out lands in the tree's other paths, which map as above. A path under
`core/` maps to its subfolder's node, `core/tools/`, `core/shared/`, `core/skills/`, or
`core/agents/`. The nodes the paths map to are the **affected nodes**; every node the commits
edited themselves is one of them.

### 4. Update the affected nodes in place

For each affected node, read it whole, list its folder with `git ls-files <folder>`, and read
the files its sentences are about as they now stand, every changed path that maps to it
included. On a first run do this for every node, the root `CLAUDE.md` with its four
descriptions included. Then edit the node in place, by targeted edits:

- **A sentence still true stays byte-identical**, its line breaks included. Only a sentence the
  commits made untrue is rewritten, and only as far as the change makes it untrue; nothing is
  reworded for style, reordered, or re-wrapped, so the commit's diff is the change in the tree
  and nothing else.
- **Lasting knowledge the commits added and no node holds yet is added** where the root's
  rules on where knowledge lives put it: into the node of the folder holding what it governs,
  a rule spanning folders stated once, whole, in the node of the folder it chiefly governs,
  with a pointer line beneath the rules of every other node it touches. A rule is written in
  the node's rule shape, its bold statement, its `Reason:`, and its `Retired forms:`.
- **A rule is changed only as far as a commit since the anchor changed what it governs**, and
  it leaves the tree only when its subject no longer exists in the tree. A rule whose subject
  stands is never dropped, merged, or reworded on the run's own judgment, and a rule placed
  under `core/` names no host and carries no "milestone", since the build's
  `host-name-in-core` and `old-word-in-core` checks scan the four nodes there.
- **What a file documents itself is pointed at, never restated** in a node: a module
  docstring, a tool's `--help`, a definition's `settings.toml` header, a skill's own text, a
  test's docstring.
- **No `README.md` is created under `core/`** beyond the four subfolder nodes, since every
  host definition's `exclude` key keeps only those four out of the host trees, and a fifth
  would be rendered into every host tree.

Then update the **pointer notes above** each node this step changed: the pointer line naming
it in its parent node (or the nearest ancestor node, or the root's `## Pointers`), whose
when-to-follow note is rewritten only where the node's purpose or rules changed what the note
says, and every pointer line, in any node, whose anchor names a heading this step renamed.

Record each node file as you create or edit it, in a running list of the run's paths, never
reconstructed afterwards from `git status`.

### 5. Run the check and repair every failure

```bash
uv run pytest tests/test_knowledge_tree.py -q
```

Its `test_the_repository_tree_passes` lists every failure of the tree, one message each. Repair
each one, adding every node file you edit to the running list, and run the check again until
it passes:

- **A pointer naming no tracked file or folder, or a heading its target lacks** — re-point it at
  where the target now stands (the `R` lines of step 3's diff, or `git log --follow` on the
  old path), or at the heading's current slug; where the target is gone and nothing replaced
  it, drop the pointer line.
- **A pointer not of the fixed form** — rewrite it in the form the root's pointer rule states,
  keeping its path and its note.
- **An uncovered top-level folder** — write a `README.md` node for it, from the files it holds,
  with at least `## Purpose`, and add a pointer line to it under the root's `## Pointers`;
  where the folder's `README.md` name is taken or rendered, add a `### <folder>/` description
  under the root's `## Pointers` instead.
- **A deeper node nothing points at** — add a pointer line to it in the Pointers part of its
  parent folder's node, or of the nearest ancestor node where the parent has none.
- **A heading outside a node's part set or out of its order** — move the text under it into
  the part it belongs to, in the fixed order, changing no sentence.
- **A file, node, or note over its budget** — compress that file only, and only as far as the
  failure forces: shorten the sentences that carry the least, keeping every rule with its
  statement, its reason, and its retired forms, and never moving a rule out of the tree; a note
  over its budget is shortened alone.
- **A tracked `.github/README.md`** — carry whatever it holds that binds work into the root's
  `### .github/` description and remove the file, recording it as a removal for step 6.

When the run edited a node under `core/`, also run `uv run scripts/build_hosts.py --check` and
repair what `host-name-in-core` or `old-word-in-core` reports in that node; the four nodes are
excluded from every host tree, so the build's output does not change.

### 6. Commit under the marker

If the running list is empty and nothing was removed, the tree already matches its commits and
passes the check: commit nothing and report `Knowledge tree already up to date.` as the whole
report. The anchor stays where it was, so the next run reads the same commits again, the cost
of keeping no state outside the log.

Otherwise run this one shell call, written out in full exactly as shown, with only the body's
bullets, the descriptor, the recorded paths, and any removal replaced:

```bash
{ body="$(cat)"; } <<'EOF' &&
- <node path> — <what changed in it, in one sentence>
EOF
{ out="$(python3 core/tools/commit.py --subject "Knowledge-tree-update: <descriptor>" --body "$body" --path-file -)"; } <<'EOF' &&
<recorded path 1>
<recorded path 2>
EOF
if [ -z "$out" ]; then
  echo 'knowledge tree update landed'
else
  printf '%s\n' "$out"
fi
```

The descriptor is `<ANCHOR>..<HEAD>`, the range of commits the run brought the tree up to, or
`all nodes` on a first run. The body holds one `- ` bullet per node file the run created,
edited, or removed, naming its path and what changed in it. The paths reach the commit tool,
the repository's own `core/tools/commit.py`, as `--path-file -` fed by the second heredoc: one
recorded path per line, every path written out in full on a line of its own, none held in a
shell variable. For a removed `.github/README.md`, add `--remove .github/README.md` to the
commit tool's command line. Each heredoc's delimiter is quoted so nothing inside is expanded;
pick a delimiter line the text does not contain. The tool stages exactly those paths and commits
them as the commit's pathspec, so nothing else the index holds rides in the commit, and it
retries a git write another process's lock refused. `body` and `out` are each one quoted value
set and used within this one call.

The call prints `knowledge tree update landed` when the commit landed, which moves the anchor
to it; the tool's fixed no-op line when none of the paths changed; or the tool's one `Error:`
line, with nothing committed. On an `Error:` line, stop with `Knowledge tree update not
committed.` and that line beneath it, the edits left in the tree for the next run to commit.

### 7. Report

On the success path print `Knowledge tree updated.` as the first line, then one line per node
file the commit recorded, and nothing else.
