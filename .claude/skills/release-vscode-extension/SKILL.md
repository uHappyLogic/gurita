---
name: release-vscode-extension
description: Cut a Gurita for VS Code release at a given MAJOR.MINOR.PATCH version, pushing the tag whose workflow publishes it to both registries.
---

# release-vscode-extension

Releases Gurita for VS Code, the extension under `gurita-vscode/`, published as
`BusyMinds.gurita-vscode`, at a maintainer-supplied `MAJOR.MINOR.PATCH` version. This
`SKILL.md` is the single place the extension's release procedure is documented. It is a
maintainer-only, project-local skill beside `/release-plugin`: it lives under `.claude/skills/`,
outside `core/`, so no host build renders it and it never reaches a consuming project. The
plugin itself is released by `/release-plugin`, never by this skill.

The skill prepares a release on this machine and publishes nothing itself. It runs its checks,
writes the version, prepends the notes to `gurita-vscode/CHANGELOG.md`, and makes one
`Extension-release: <VERSION>` commit; then, after one confirmation, it pushes `main` and the
lightweight tag `gurita-vscode-<VERSION>`. The push of the tag starts the workflow
`.github/workflows/publish-vscode-extension.yml`, which builds the VSIX from the tagged commit
and publishes it to the Visual Studio Marketplace (`vsce publish --oidc`, through Trusted
Publishing) and to Open VSX (`ovsx publish`, with the `OVSX_PAT` secret of the
`extension-release` environment). The skill watches that run and reports its outcome as the
release's own. It never runs `vsce publish`, `ovsx publish`, or any other publish command on
this machine, never reads a token (not `.env.publish`, not a secret's value), and creates no
GitHub release anywhere: the repository's releases page holds plugin releases alone.

Extension releases carry tags of their own, `gurita-vscode-<VERSION>` (for example
`gurita-vscode-0.2.0`), and every tag lookup here matches only that form, so a bare plugin tag
never stands in for an extension release. The extension's version is its own, kept in
`gurita-vscode/package.json` and repeated at two sites of `gurita-vscode/package-lock.json`,
independent of the plugin's `VERSION`.

Nothing is written, committed, pushed, or tagged until every check of steps 2 to 4 has passed.
Those checks are hard stops: on a failure, report the specific reason and exit, having changed
nothing. Never work around a check, and never ask the maintainer to waive one.

**Resuming an interrupted release.** Re-running with the same version after a failed or
stopped run is the whole recovery story. A resumption is detected once, up front:

```bash
git log -1 --format='%s' HEAD
```

If that prints exactly `Extension-release: <VERSION>`, this version's release commit is
already recorded and the run is a **resumption**. On a resumption step 1 excludes this run's
own tag from the last-release lookup, step 2's Open VSX query is skipped (a re-run asks no
registry anything), step 4 tolerates a tag that points at `HEAD` and requires the changelog
entry it would otherwise forbid, and steps 5 and 6 are skipped whole, the notes and the commit
already existing. Every other step runs unchanged, and steps 8 and 9 pick the run up from what
it finds: a tag already pushed means no push at all and a re-run of the failed jobs of the
tag's publish workflow run.

## Usage

```
/release-vscode-extension <MAJOR.MINOR.PATCH>
```

- `<MAJOR.MINOR.PATCH>`: the extension version to release, e.g. `0.2.0`. Bare, required, no
  `v` prefix, no suffix.

**Example:**
```
/release-vscode-extension 0.2.0
```

Call the argument `<VERSION>` from here on, and `gurita-vscode-<VERSION>` the release tag.

Every `<NAME>` placeholder in the commands below is substituted as the literal value or as a
**braced** shell variable (`${NAME}`), never unbraced: the session shell may be zsh, where a
variable followed by `:` and a letter is read as a modifier. No command in this file contains a
`$` followed by a digit, since the skill loader substitutes positional-argument tokens into
this text before it is read. Every Node command runs under Node 22 through nvm, in a subshell,
from the repository root, in the form `(source "$HOME/.nvm/nvm.sh" && nvm use 22 >/dev/null &&
cd gurita-vscode && <command>)`; Node and npm are not on `PATH` otherwise.

## Workflow

### 1. Resolve the last extension release

The last extension release is the nearest extension tag reachable from `HEAD`:

```bash
git describe --tags --abbrev=0 --match 'gurita-vscode-*'
```

On a **resumption**, exclude this run's own tag so the anchor stays the *previous* release:

```bash
git describe --tags --abbrev=0 --match 'gurita-vscode-*' --exclude='gurita-vscode-<VERSION>'
```

Call the exact tag string it prints `<LAST_TAG>`, and the version after its
`gurita-vscode-` prefix `<LAST_VERSION>`. When the command fails, list the extension tags:

```bash
git tag --list 'gurita-vscode-*'
```

Empty output (or, on a resumption, output naming only `gurita-vscode-<VERSION>`) means this is
the **first extension release**: there is no `<LAST_TAG>`, and the notes in step 5 reach back
to the beginning. Any other output means extension tags exist but none is reachable from
`HEAD`: stop and report the tags found.

### 2. Pre-flight stops

Run every check below. None of them writes anything tracked; `npm ci` and the build write only
the git-ignored `node_modules/`, `out/`, `bundled/`, and `dist/`. Any failure stops the run:
report the check, its output, and that nothing was changed.

**a. Repository state.**

```bash
git status --porcelain --untracked-files=no
git rev-parse --abbrev-ref HEAD
git fetch origin main
git rev-list --count main..origin/main
git ls-files --others --exclude-standard -- gurita-vscode/
```

The tracked tree is clean (the first command prints nothing), `HEAD` is on `main` (the second
prints exactly `main`; a detached `HEAD` prints `HEAD`), `main` is not behind `origin/main`
(the count is `0`; being ahead is expected, those commits are pushed in step 8), and no
untracked file stands under the extension's source paths (the last command prints nothing; it
already leaves out the git-ignored build directories).

**b. Toolchain.** Node 22 answers through nvm, `npm ci` installs the pinned dependencies, and
both local publishing binaries resolve, `vsce` (pinned at `4.1.1`) and `ovsx` (pinned in
`devDependencies`), from `node_modules/` alone, `--no-install` keeping `npx` from fetching
anything:

```bash
(source "$HOME/.nvm/nvm.sh" && nvm use 22 >/dev/null && node --version)
(source "$HOME/.nvm/nvm.sh" && nvm use 22 >/dev/null && cd gurita-vscode && npm ci)
(source "$HOME/.nvm/nvm.sh" && nvm use 22 >/dev/null && cd gurita-vscode && npx --no-install vsce --version && npx --no-install ovsx --version)
```

The first prints a `v22.` version; each later command exits 0, the last printing the two
versions. The binaries are only resolved here, never run to publish.

**c. Tests.** The extension's `node:test` suite and the runner's pytest tests pass:

```bash
(source "$HOME/.nvm/nvm.sh" && nvm use 22 >/dev/null && cd gurita-vscode && npm test)
uv run pytest gurita-vscode/runner_tests
```

**d. Build.** The package builds into the ignored `dist/`:

```bash
(source "$HOME/.nvm/nvm.sh" && nvm use 22 >/dev/null && cd gurita-vscode && npm run package)
```

It exits 0 and `gurita-vscode/dist/gurita-vscode.vsix` exists. This local package is a check
only: the published package is the one the workflow builds from the tagged commit.

**e. Publishing setup.** Prefix every `gh` command with whatever this machine needs for `gh` to
reach the maintainer's account. Each check reads names only, never a value:

```bash
gh repo view uHappyLogic/gurita --json nameWithOwner
git cat-file -e main:.github/workflows/publish-vscode-extension.yml
gh api repos/uHappyLogic/gurita/environments/extension-release --jq .name
gh secret list --repo uHappyLogic/gurita --env extension-release
```

`gh` reaches `uHappyLogic/gurita` (the first exits 0); the publish workflow stands on `main`
(the second exits 0, and it reaches the remote with `main` in step 8a, ahead of the tag that
triggers it); the `extension-release` environment exists (the third prints
`extension-release`); and it holds a secret named `OVSX_PAT` (a line of the fourth's output
begins with `OVSX_PAT`, read by name, its value never asked for). Then, on a fresh run only,
the Open VSX namespace `BusyMinds` exists, observed through a registry query:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://open-vsx.org/api/BusyMinds
```

`200` passes; anything else stops the run. Skip this query on a resumption. The Marketplace's
trusted-publishing policy on the `BusyMinds` publisher cannot be read from this machine: the
publish workflow's run is its check.

### 3. Bundled plugin state

Every package carries files the build copies from the checkout's plugin sources (the missions
tool, the fixed console lines, and the plugin version), so an extension release may be built
only from a `main` whose three bundled sources are byte-identical to those at the plugin tag
named by `VERSION`. The extension's own code may sit anywhere after that tag. Read the version
and look its tag up:

```bash
cat VERSION
git rev-parse --verify --quiet 'refs/tags/<PLUGIN_VERSION>'
git diff --name-only '<PLUGIN_VERSION>' HEAD -- core/tools/missions.py docs/skill-reference.md VERSION
```

`<PLUGIN_VERSION>` is the line `VERSION` holds. The check passes when the tag resolves and the
diff prints nothing. Otherwise stop with nothing changed, opening the report with this fixed
line, then the detail below it:

```
Bundled plugin sources differ from the released plugin.
```

Below the line, list each differing file the diff printed (or state that no tag
`<PLUGIN_VERSION>` exists, when the lookup printed nothing), then the remedy: release the plugin
first with `/release-plugin`, or wait until the plugin's sources on `main` are released, and
re-run `/release-vscode-extension <VERSION>`. Builds made by hand are not restricted by this
check.

### 4. Validate the version argument

All refusals here are hard and pre-mutation.

**a. The literal is well-formed.** `<VERSION>` matches `^[0-9]+\.[0-9]+\.[0-9]+$`: three
dot-separated numeric components, no `v` prefix, no suffix. Otherwise stop and report the
expected shape.

**b. The tag does not already exist.** Look the exact name up locally and on the remote:

```bash
git tag --list 'gurita-vscode-<VERSION>'
git ls-remote --tags origin 'refs/tags/gurita-vscode-<VERSION>'
```

Output from either means the tag is taken: stop and report which side has it. On a
**resumption** a tag on either side that resolves to `HEAD` is this release's own, left by an
earlier run: leave it and continue, steps 8 and 9 reading it again. A tag resolving to any other
commit stops the run.

**c. The changelog carries the version's entry exactly when the run is a resumption.**

```bash
git show HEAD:gurita-vscode/CHANGELOG.md | python3 -c '
import sys
v = sys.argv[1]
print(sum(1 for line in sys.stdin if line.split()[:2] == ["##", v]))
' '<VERSION>'
```

A heading counts when its first field is `##` and its second is exactly `<VERSION>`, the
`## <VERSION> — <YYYY-MM-DD>` form step 6b writes. On a fresh run the count must be `0`; on a
resumption exactly `1`. Any other count stops the run, reporting it. If `git show` fails, the
changelog is not tracked at `HEAD`: stop and report it, since the release prepends to that file
and never creates it.

**d. The version moves forward.** Read the manifest's version:

```bash
python3 -c 'import json; print(json.load(open("gurita-vscode/package.json"))["version"])'
```

Call it `<MANIFEST_VERSION>`. Compare versions as numeric `(major, minor, patch)` tuples, never
by string sort. On a fresh run `<VERSION>` must be strictly greater than `<MANIFEST_VERSION>`
and, when step 1 resolved one, than `<LAST_VERSION>`. On a resumption `<MANIFEST_VERSION>` must
equal `<VERSION>` (the release commit wrote it) and `<VERSION>` must be strictly greater than
`<LAST_VERSION>`, when there is one. Otherwise stop, reporting the versions compared.

### 5. Draft the release notes

Skip this step on a resumption: the notes are the entry the `Extension-release: <VERSION>`
commit already prepended, which step 7 reads back.

This step still writes nothing. It drafts the notes from the finish summaries of the missions
under `gurita-vscode/` finished since `<LAST_TAG>`, read through the plugin's missions tool,
never through a `git log` of its own. Call the draft `<RELEASE_BODY>`.

**a. List the extension's missions.**

```bash
python3 core/tools/missions.py missions gurita-vscode/
```

Each line is four tab-separated fields: `live` or `finished`, a date, the mission path, and the
title. Keep only `finished` lines whose path field starts with `gurita-vscode/`: a mission
scoped elsewhere, the root included, belongs to the plugin's notes even when it changed the
extension. On the first extension release keep every such line. Otherwise read the last
release's date:

```bash
git log -1 --format=%as '<LAST_TAG>'
```

and keep the lines dated later than it, comparing the two `YYYY-MM-DD` strings. A line dated
exactly that day is kept only when the changelog does not already hold its section, which this
count reports with the line's title written in place of `<Title>`:

```bash
python3 -c '
import re, sys
title = sys.stdin.read().strip("\n")
heading = re.compile("### " + re.escape(title))
print(sum(1 for line in open("gurita-vscode/CHANGELOG.md", encoding="utf-8")
          if heading.fullmatch(line.rstrip("\n"))))
' <<'EOF'
<Title>
EOF
```

`0` keeps the line; any other count drops it.

**b. Read each kept mission's summary**, in the order step 5a printed them, newest finish first:

```bash
python3 core/tools/missions.py summary <MISSION_PATH>
```

`<MISSION_PATH>` is the line's path field exactly as printed. Below the finish date stand the
mission's title line, a blank line, and its bullets.

**c. Compose one section per kept mission**, newest finish first:

```markdown
### <Title>

- <condensed user-facing change>
```

`<Title>` is the summary's title line, verbatim. The bullets are condensed rewrites, never
verbatim copies: keep what a person using the extension would notice (what it now does, what
changed, was added, renamed, or retired) and cut mission-internal process detail (task counts,
audit passes, how the work was verified). Every heading in the body is `###`, and the body holds
**no line beginning `## `**, since the next such line ends the entry when step 7 extracts it.

**d. No finished mission in the range.** When step 5a keeps no line, state that plainly, then
draft the notes from the commits in the range instead, read with

```bash
git log --format='%h %s' <LAST_TAG>..HEAD -- gurita-vscode/
```

(on the first extension release, `git log --format='%h %s' -- gurita-vscode/`), reading bodies
where a subject is not self-explanatory, condensed into a single `### Changes since <LAST_TAG>`
section (`### Changes` on the first release) under the same rewrite rule.

The draft is the skill's proposal, never the final text: the maintainer revises or adds to it
at step 7's pause, for instance to name the work of a mission still live at release time, and
the maintainer's revised text is what is published.

### 6. Write the version and the changelog, and record the release commit

Skip this step on a resumption: the `Extension-release: <VERSION>` commit at `HEAD` is the
commit it produces. Otherwise this is where the run first writes, and it produces **exactly one
commit**, unattended.

**a. Write the version.**

```bash
(source "$HOME/.nvm/nvm.sh" && nvm use 22 >/dev/null && cd gurita-vscode && npm version <VERSION> --no-git-tag-version)
```

npm writes `<VERSION>` into `gurita-vscode/package.json` and at both sites of
`gurita-vscode/package-lock.json`, and makes no commit and no tag. A non-zero exit stops the
run; report what npm printed.

**b. Prepend the changelog entry.** The entry is the heading `## <VERSION> — <YYYY-MM-DD>`, a
blank line, `<RELEASE_BODY>` verbatim, and a blank line, the date being today's UTC date
(`date -u +%Y-%m-%d`) and the separator an em dash (`—`) with one space on each side. It goes
immediately above the first line of `gurita-vscode/CHANGELOG.md` that begins `## `, the previous
release's heading, or at the end of the file when it holds none yet, below the `# Changelog`
title and its note, which are never touched:

```bash
python3 -c '
import sys
heading = sys.argv[1]
body = sys.stdin.read().strip("\n")
path = "gurita-vscode/CHANGELOG.md"
lines = open(path, encoding="utf-8").read().splitlines(keepends=True)
entry = [heading + "\n", "\n"] + [line + "\n" for line in body.split("\n")] + ["\n"]
at = next((i for i, line in enumerate(lines) if line.startswith("## ")), None)
if at is None:
    if lines and not lines[-1].endswith("\n"):
        lines[-1] += "\n"
    if lines and lines[-1].strip():
        lines.append("\n")
    lines += entry[:-1]
else:
    lines[at:at] = entry
open(path, "w", encoding="utf-8").write("".join(lines))
' '## <VERSION> — <YYYY-MM-DD>' <<'EOF'
<RELEASE_BODY>
EOF
```

Then confirm the write: `git diff --numstat -- gurita-vscode/CHANGELOG.md` shows added lines
only (`0` deletions), and the first `## ` line of `grep -n '^## ' gurita-vscode/CHANGELOG.md`
is the new heading, followed by `<LAST_TAG>`'s when there is one. Anything else stops the run
with nothing committed.

**c. Commit once.** Stage exactly the three written paths, never `git add -A`:

```bash
git add -- gurita-vscode/package.json gurita-vscode/package-lock.json gurita-vscode/CHANGELOG.md
```

and commit with the subject exactly

```
Extension-release: <VERSION>
```

and the body the repository's commit conventions call for. Then
`git status --porcelain --untracked-files=no` must print nothing; a tracked change left behind
stops the run before anything is pushed. The commit holds only the extension's version slots
and its changelog entry.

### 7. Confirm before publishing

This is the run's **single pause**, on every run, fresh or resumed: everything before it is
local work, and everything after it is public. It is never skipped and no flag bypasses it.

**Extract the entry** from the committed changelog, never from context: the lines under the
`## <VERSION> — <YYYY-MM-DD>` heading up to the next `## ` line, blank lines at either end
trimmed:

```bash
git show HEAD:gurita-vscode/CHANGELOG.md | python3 -c '
import sys
v = sys.argv[1]
found, lines = False, []
for line in sys.stdin:
    line = line.rstrip("\n")
    if line.startswith("## "):
        if found:
            break
        found = line.split()[:2] == ["##", v]
    elif found:
        lines.append(line)
while lines and lines[0] == "":
    del lines[0]
while lines and lines[-1] == "":
    del lines[-1]
sys.stdout.write("".join(line + "\n" for line in lines))
' '<VERSION>'
```

Call what it prints `<ENTRY>`; an empty `<ENTRY>` stops the run. Show the maintainer
`<VERSION>`, the version about to be published, and `<ENTRY>` in full, verbatim, exactly as the
listings' changelog tabs will show it, never a summary of it. Then ask whether to publish. The
answer takes one of three forms:

- **Publish**, an explicit affirmative: proceed to step 8.
- **Revise**, a stated change to the notes, or word that the maintainer edited the entry by hand
  in the working `gurita-vscode/CHANGELOG.md`: take the revision path below, which shows the
  version and the notes again and asks again.
- **Anything else** (a refusal, a question, an ambiguous reply) stops the run with nothing
  public done. Say that the release commit stays at `HEAD`, unpushed and revertible unless an
  earlier run pushed it, and that re-running `/release-vscode-extension <VERSION>` resumes from
  this pause.

**Revise the entry.** A revision amends the release commit, so it is allowed only while that
commit is unpushed:

```bash
git fetch origin main
git merge-base --is-ancestor HEAD origin/main
```

A non-zero exit means `origin/main` does not carry `HEAD`: continue. A zero exit means the
release commit is already pushed and its notes are frozen: stop and report it with nothing
changed. Then apply the change to the `<VERSION>` entry alone in the working changelog (or take
the maintainer's hand edit as it stands), keeping every section at `###` and adding no `## `
line, confirm that nothing outside the entry changed, then amend, keeping the subject:

```bash
git diff -U0 HEAD -- gurita-vscode/CHANGELOG.md
git add -- gurita-vscode/CHANGELOG.md
git commit --amend --no-edit
git log -1 --format='%s' HEAD
```

Every hunk of the diff must lie inside the `<VERSION>` entry and touch no `## ` line; when the
diff is empty there is nothing to amend, so say so and ask again. The last command must still
print exactly `Extension-release: <VERSION>`. Then extract `<ENTRY>` again, show the version and
the revised entry, and ask again.

### 8. Push `main` and the tag

Each push is **check-then-do**: query first, skip what is already done, and stop and report
whatever exists but disagrees, never forcing, moving, or deleting anything.

**a. Push `main`.**

```bash
git fetch origin main
git rev-parse origin/main
```

Equal to `git rev-parse HEAD`: already pushed, skip. Otherwise, when
`git merge-base --is-ancestor origin/main HEAD` succeeds, push:

```bash
git push origin main
```

When that ancestry check fails, `origin/main` carries a commit `HEAD` does not: stop and report
both SHAs.

**b. Push the tag.**

```bash
git ls-remote --tags origin 'refs/tags/gurita-vscode-<VERSION>'
```

- **No output**: create the lightweight tag on the release commit and push it, which starts the
  publish workflow:

  ```bash
  git tag 'gurita-vscode-<VERSION>' HEAD
  git push origin 'refs/tags/gurita-vscode-<VERSION>'
  ```

  When a local tag of that name already exists, skip the `git tag` and push it only once
  `git rev-parse 'gurita-vscode-<VERSION>'` prints `HEAD`'s SHA; otherwise stop and report.
  Step 9 then takes its **first-run** branch.
- **Output whose SHA is `HEAD`'s**: the tag was pushed by an earlier run. Push nothing; step 9
  takes its **re-run** branch.
- **Output whose SHA is anything else**: stop and report both SHAs.

### 9. Watch the publish workflow run and report its outcome

**Find the run** the tag's push started. It can take a few seconds to appear, so the lookup
retries:

```bash
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  run="$(gh run list --repo uHappyLogic/gurita --branch 'gurita-vscode-<VERSION>' --event push --json databaseId,workflowName,headSha,status,conclusion --jq '.[] | select(.workflowName == "publish-vscode-extension") | [.databaseId, .headSha, .status, .conclusion] | @tsv')"
  [ -n "${run}" ] && break
  sleep 10
done
printf '%s\n' "${run}"
```

It prints one tab-separated line: the run id, its commit, its status, and its conclusion. Call
the id `<RUN_ID>`. No line means no run started for the tag: stop and report it (the workflow
may be disabled, or missing from the tagged commit). More than one line, or a commit other than
`HEAD`'s, stops the run, reporting what was found.

**First-run branch.** Watch the run.

**Re-run branch.** Push nothing and query no registry. When the run is still in progress
(status other than `completed`), watch it. When it completed with conclusion `success`, the
release is already published: skip to the report. Otherwise re-run its failed jobs:

```bash
gh run rerun <RUN_ID> --repo uHappyLogic/gurita --failed
```

then watch it as on a first run. Both publish steps carry `--skip-duplicate`, so the registry
that already holds the version succeeds silently and the other receives it from a package
rebuilt from the tagged commit.

**Watch** the run until it ends. It can outlast a foreground call's limit, so run it as a
background command and wait for its completion notice rather than polling:

```bash
gh run watch <RUN_ID> --repo uHappyLogic/gurita --exit-status --compact
```

Then read the run's outcome and its steps:

```bash
gh run view <RUN_ID> --repo uHappyLogic/gurita --json conclusion,url,jobs --jq '.conclusion, .url, (.jobs[].steps[] | [.name, .conclusion] | @tsv)'
```

**Report the run's outcome as the release's own.** The release is published when the run's
conclusion is `success` with both its `Publish to the Visual Studio Marketplace` and its
`Publish to Open VSX` steps at `success`: report `BusyMinds.gurita-vscode` `<VERSION>` published
to both registries, with the run's URL. Any other outcome is a failed release: report the
conclusion, every step that did not succeed, and the run's URL, and say that the tag is pushed
and stays, and that once the cause is fixed outside the repository (a Marketplace
trusted-publishing policy naming `uHappyLogic/gurita`, `publish-vscode-extension.yml`, and
`extension-release`, or the `OVSX_PAT` secret), re-running `/release-vscode-extension <VERSION>`
re-runs the run's failed jobs. A cause inside the tagged commit cannot be fixed by a re-run of
this version: it needs a new version.
