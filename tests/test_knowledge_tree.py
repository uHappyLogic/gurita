"""The knowledge tree's shape, checked over the repository's tracked files: the root CLAUDE.md and
every README.md node. A pointer line (``- → `path#anchor` — note``) must name a tracked file or
folder and, with an anchor, a heading of that file by its GitHub-style slug; every tracked
top-level folder but the root mission_*/ directories must have a README.md node or a
`### <folder>/` description under the root's `## Pointers`; a deeper node must be pointed at from
its parent folder's node or, where the parent has none, from the nearest ancestor's (the root for
a top-level folder it describes); the root stays within 20,000 bytes, a node within 12,000, and a
pointer's note within 400; the root holds only `## Purpose`, `## Rules`, `## Commands`,
`## Pointers`, and `## Mission Workflow` in that order (Purpose and Mission Workflow required), a
node only the first four (Purpose required), and a root description only those four as `####`
headings (Purpose required); and no `.github/README.md` is tracked. A README.md is not a node
when its name is taken or rendered: the root landing page, the extension's listing README, the
host trees' build output, and the host templates under scripts/hosts/<host>/. The rules
themselves are stated in the root CLAUDE.md; each failure is reproduced here on a synthetic tree.
The test reads only files git tracks, so it runs under both interpreters."""

import re
import subprocess
from pathlib import Path, PurePosixPath

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
ROOT_NODE = "CLAUDE.md"
ROOT_BUDGET = 20_000
NODE_BUDGET = 12_000
NOTE_BUDGET = 400
NODE_PARTS = ("Purpose", "Rules", "Commands", "Pointers")
ROOT_PARTS = NODE_PARTS + ("Mission Workflow",)
GITHUB_README = ".github/README.md"

POINTER_OPENING = "- →"
POINTER = re.compile(r"^- → `([^`]+)` — (\S.*)$")
HEADING = re.compile(r"^(#{1,6})[ \t]+(.*?)[ \t]*$")
FENCE = re.compile(r"^ {0,3}(```|~~~)")
DESCRIPTION = re.compile(r"^([^/\s]+)/$")


# --- reading -----------------------------------------------------------------------------------


def tracked_files():
    """Every path git tracks in the repository, as repo-relative POSIX strings."""
    out = subprocess.run(
        ["git", "ls-files", "-z"], cwd=REPO_ROOT, capture_output=True, check=True
    ).stdout.decode("utf-8")
    return [path for path in out.split("\0") if path]


def unfenced_lines(text):
    """Each (line number, line) of a Markdown text outside its fenced code blocks."""
    fenced = False
    for number, line in enumerate(text.split("\n"), start=1):
        if FENCE.match(line):
            fenced = not fenced
            continue
        if not fenced:
            yield number, line


def headings(text):
    """Each (line number, level, text) of a Markdown text's ATX headings, fences skipped."""
    for number, line in unfenced_lines(text):
        match = HEADING.match(line)
        if match:
            yield number, len(match.group(1)), match.group(2)


def slugs(text):
    """The GitHub-style anchor slug of every heading, a repeated slug suffixed -1, -2, …"""
    seen, result = {}, set()
    for _, _, heading in headings(text):
        slug = re.sub(r"[^\w\- ]", "", heading.strip().lower()).replace(" ", "-")
        count = seen.get(slug, 0)
        seen[slug] = count + 1
        result.add(slug if count == 0 else f"{slug}-{count}")
    return result


def is_node(path):
    """Whether a tracked path is a README.md node, not a README.md whose name is taken or
    rendered."""
    parts = PurePosixPath(path).parts
    if parts[-1] != "README.md" or len(parts) == 1:
        return False  # not a README.md, or the root landing page
    if path in ("gurita-vscode/README.md", GITHUB_README):
        return False  # the VSIX's listing README; GitHub's front page, refused on its own
    if parts[0] == "hosts":
        return False  # build output rendered from the host templates
    if len(parts) == 4 and parts[:2] == ("scripts", "hosts"):
        return False  # a host template the build renders into hosts/<host>/
    return True


# --- the check ---------------------------------------------------------------------------------


class Tree:
    def __init__(self, root, tracked):
        self.root = Path(root)
        self.files = {path for path in tracked if (self.root / path).exists()}
        self.folders = {
            str(parent)
            for path in self.files
            for parent in PurePosixPath(path).parents
            if str(parent) != "."
        }
        self.top_folders = {
            path.split("/", 1)[0]
            for path in self.files
            if "/" in path and not path.split("/", 1)[0].startswith("mission_")
        }
        self.nodes = sorted(path for path in self.files if is_node(path))
        self.failures = []
        self.described = set()
        self.pointers = {}

    def text(self, path):
        return (self.root / path).read_text(encoding="utf-8")

    def fail(self, message):
        self.failures.append(message)

    def check(self):
        if ROOT_NODE not in self.files:
            self.fail(f"{ROOT_NODE}: the root node is not tracked")
            return self.failures
        if GITHUB_README in self.files:
            self.fail(
                f"{GITHUB_README}: is tracked, and GitHub shows a README in .github/ as the "
                "repository's front page ahead of the root README.md"
            )
        self.check_root_headings()
        for node in self.nodes:
            self.check_node_headings(node)
        for path in [ROOT_NODE] + self.nodes:
            self.check_budget(path)
            self.check_pointers(path)
        self.check_coverage()
        self.check_orphans()
        return self.failures

    def check_budget(self, path):
        budget = ROOT_BUDGET if path == ROOT_NODE else NODE_BUDGET
        size = len((self.root / path).read_bytes())
        if size > budget:
            self.fail(f"{path}: {size} bytes, over its budget of {budget}")

    def check_root_headings(self):
        seen, section, folder, part = -1, None, None, -1
        found, parts_of = set(), {}
        for number, level, heading in headings(self.text(ROOT_NODE)):
            where = f"{ROOT_NODE}:{number}: heading {'#' * level} {heading}"
            if level == 2:
                folder = None
                if heading not in ROOT_PARTS:
                    self.fail(f"{where} is outside the allowed set {ROOT_PARTS}")
                    section = None
                    continue
                index = ROOT_PARTS.index(heading)
                if index <= seen:
                    self.fail(f"{where} is out of the order {ROOT_PARTS}")
                seen, section = max(seen, index), heading
                found.add(heading)
            elif level == 3 and section == "Pointers":
                match = DESCRIPTION.match(heading)
                folder, part = (match.group(1) if match else heading), -1
                if not match or folder not in self.top_folders:
                    self.fail(f"{where} names no tracked top-level folder as `### <folder>/`")
                elif folder in self.described:
                    self.fail(f"{where} describes {folder}/ a second time")
                else:
                    self.described.add(folder)
                parts_of.setdefault(folder, set())
            elif level == 4 and folder is not None:
                if heading not in NODE_PARTS:
                    self.fail(f"{where} is outside the allowed set {NODE_PARTS}")
                    continue
                index = NODE_PARTS.index(heading)
                if index <= part:
                    self.fail(f"{where} is out of the order {NODE_PARTS}")
                part = max(part, index)
                parts_of[folder].add(heading)
            else:
                self.fail(f"{where} is outside the allowed set")
        for required in ("Purpose", "Mission Workflow"):
            if required not in found:
                self.fail(f"{ROOT_NODE}: has no ## {required}")
        for folder, parts in sorted(parts_of.items()):
            if "Purpose" not in parts:
                self.fail(f"{ROOT_NODE}: the description of {folder}/ has no #### Purpose")

    def check_node_headings(self, path):
        seen, found = -1, set()
        for number, level, heading in headings(self.text(path)):
            where = f"{path}:{number}: heading {'#' * level} {heading}"
            if level != 2 or heading not in NODE_PARTS:
                self.fail(f"{where} is outside the allowed set {NODE_PARTS}")
                continue
            index = NODE_PARTS.index(heading)
            if index <= seen:
                self.fail(f"{where} is out of the order {NODE_PARTS}")
            seen = max(seen, index)
            found.add(heading)
        if "Purpose" not in found:
            self.fail(f"{path}: has no ## Purpose")

    def check_pointers(self, path):
        targets = self.pointers.setdefault(path, set())
        for number, line in unfenced_lines(self.text(path)):
            if not line.startswith(POINTER_OPENING):
                continue
            where = f"{path}:{number}: pointer"
            match = POINTER.match(line)
            if not match:
                self.fail(f"{where} is not of the form - → `path#anchor` — note: {line}")
                continue
            target, note = match.groups()
            size = len(note.encode("utf-8"))
            if size > NOTE_BUDGET:
                self.fail(f"{where} to {target}: note of {size} bytes, over its budget of {NOTE_BUDGET}")
            file, _, anchor = target.partition("#")
            if self.resolve(where, target, file, anchor):
                targets.add(file)

    def resolve(self, where, target, file, anchor):
        name = file.rstrip("/")
        if not name or file.startswith("/") or ".." in PurePosixPath(name).parts:
            self.fail(f"{where} to {target}: not a repo-relative path")
            return False
        is_file = name in self.files and not file.endswith("/")
        if not is_file and name not in self.folders:
            self.fail(f"{where} to {target}: names no tracked file or folder")
            return False
        if anchor:
            if not is_file:
                self.fail(f"{where} to {target}: an anchor on a path that is not a tracked file")
                return False
            if anchor not in slugs(self.text(name)):
                self.fail(f"{where} to {target}: {name} has no heading with the slug {anchor}")
                return False
        return True

    def node_of(self, folder):
        """The node holding a folder's knowledge: its README.md node, or the root for a
        top-level folder the root describes or for the repository root itself; None when the
        folder has neither."""
        if folder == ".":
            return ROOT_NODE
        readme = f"{folder}/README.md"
        if readme in self.nodes:
            return readme
        if folder in self.described:
            return ROOT_NODE
        return None

    def check_coverage(self):
        for folder in sorted(self.top_folders):
            if self.node_of(folder) is None:
                self.fail(
                    f"{folder}/: a tracked top-level folder with neither a README.md node nor a "
                    f"### {folder}/ description in {ROOT_NODE}"
                )

    def check_orphans(self):
        for node in self.nodes:
            folder = PurePosixPath(node).parent
            if len(folder.parts) < 2:
                continue  # a top-level folder's node
            ancestor = folder.parent
            while self.node_of(str(ancestor)) is None:
                ancestor = ancestor.parent
            pointing = self.node_of(str(ancestor))
            if node not in self.pointers.get(pointing, set()):
                self.fail(f"{node}: a deeper node no pointer line of {pointing} points at")


def check_tree(root, tracked):
    """Every knowledge-tree failure of the tree at root over its tracked paths, as messages."""
    return Tree(root, tracked).check()


# --- the repository ----------------------------------------------------------------------------


def test_the_repository_tree_passes():
    failures = check_tree(REPO_ROOT, tracked_files())
    assert not failures, "knowledge-tree failures:\n" + "\n".join(failures)


# --- synthetic trees ---------------------------------------------------------------------------

ROOT_TEXT = """## Purpose

The synthetic root.

## Rules

- **A rule.** Reason: none.
- → `docs/page.md#a-heading` — Where the page's heading is. Read it first.

## Pointers

- → `docs/README.md` — The docs node. Read it before editing a page.

### core/

#### Purpose

The runtime layer.

#### Pointers

- → `core/tools/README.md` — The tools node. Read it before changing a tool.

### hosts/

#### Purpose

Rendered output.

## Mission Workflow

The workflow.
"""

DOCS_TEXT = """## Purpose

The docs node.

## Pointers

- → `docs/page.md` — The page. Read it for users.
- → `docs/guide/README.md` — The guide node. Read it before editing the guide.
- → `docs/a/b/README.md` — A node two levels down. Read it there.
"""

PAGE_TEXT = """# A page

## A heading

Text.

```
## Not a heading
- → `nowhere.md` — inside a fence, never read
```
"""

LEAF_TEXT = """## Purpose

A deeper node.
"""


def base_files():
    return {
        ROOT_NODE: ROOT_TEXT,
        "README.md": "# Landing page\n\n### Any heading\n",
        "docs/README.md": DOCS_TEXT,
        "docs/page.md": PAGE_TEXT,
        "docs/guide/README.md": LEAF_TEXT,
        "docs/a/b/README.md": LEAF_TEXT,
        "core/tools/README.md": LEAF_TEXT,
        "core/tools/tool.py": "",
        "hosts/claude/README.md": "# Rendered\n",
        "scripts/hosts/claude/README.md": "# Template\n",
        "scripts/README.md": LEAF_TEXT,
        "mission_some-goal/requirements.md": "# Some goal\n",
    }


def write_tree(root, files):
    for path, text in files.items():
        target = root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8")
    return sorted(files)


def failures_of(tmp_path, change):
    files = base_files()
    change(files)
    return check_tree(tmp_path, write_tree(tmp_path, files))


def test_the_synthetic_base_tree_passes(tmp_path):
    assert failures_of(tmp_path, lambda files: None) == []


def replace(path, old, new):
    def change(files):
        assert old in files[path], f"{old!r} is not in the synthetic {path}"
        files[path] = files[path].replace(old, new, 1)

    return change


def add(path, text):
    def change(files):
        files[path] = text

    return change


def chain(*changes):
    def change(files):
        for each in changes:
            each(files)

    return change


CASES = {
    "pointer path": (
        replace("docs/README.md", "`docs/page.md`", "`docs/missing.md`"),
        "docs/README.md:7: pointer to docs/missing.md: names no tracked file or folder",
    ),
    "pointer anchor": (
        replace(ROOT_NODE, "#a-heading", "#no-such-heading"),
        "has no heading with the slug no-such-heading",
    ),
    "anchor on a folder": (
        replace("docs/README.md", "`docs/page.md`", "`docs/guide/#purpose`"),
        "an anchor on a path that is not a tracked file",
    ),
    "malformed pointer": (
        replace("docs/README.md", "`docs/page.md` — ", "docs/page.md — "),
        "is not of the form",
    ),
    "uncovered folder": (
        add("ideas/draft.md", "A draft.\n"),
        "ideas/: a tracked top-level folder with neither a README.md node nor a ### ideas/",
    ),
    "orphaned deeper node": (
        replace("docs/README.md", "- → `docs/guide/README.md` — The guide node. Read it before editing the guide.\n", ""),
        "docs/guide/README.md: a deeper node no pointer line of docs/README.md points at",
    ),
    "orphaned under a described folder": (
        replace(ROOT_NODE, "- → `core/tools/README.md` — The tools node. Read it before changing a tool.\n", ""),
        "core/tools/README.md: a deeper node no pointer line of CLAUDE.md points at",
    ),
    "pointed at past its parent's node": (
        chain(
            add("docs/a/README.md", LEAF_TEXT),
            replace("docs/README.md", "- → `docs/a/b/README.md`", "- → `docs/a/README.md` — A node. Read it.\n- → `docs/a/b/README.md`"),
        ),
        "docs/a/b/README.md: a deeper node no pointer line of docs/a/README.md points at",
    ),
    "root over budget": (
        replace(ROOT_NODE, "The synthetic root.", "x" * ROOT_BUDGET),
        f"CLAUDE.md: {len(ROOT_TEXT.encode()) + ROOT_BUDGET - len('The synthetic root.')} bytes, over its budget of 20000",
    ),
    "node over budget": (
        replace("docs/guide/README.md", "A deeper node.", "x" * NODE_BUDGET),
        f"docs/guide/README.md: {len(LEAF_TEXT) + NODE_BUDGET - len('A deeper node.')} bytes, over its budget of 12000",
    ),
    "note over budget": (
        replace("docs/README.md", "The page. Read it for users.", "é" * 201),
        "pointer to docs/page.md: note of 402 bytes, over its budget of 400",
    ),
    "root heading outside the set": (
        replace(ROOT_NODE, "## Pointers\n", "## Notes\n\nA note.\n\n## Pointers\n"),
        "CLAUDE.md:10: heading ## Notes is outside the allowed set",
    ),
    "root heading out of order": (
        replace(ROOT_NODE, "## Rules\n", "## Commands\n\n- `true` — nothing.\n\n## Rules\n"),
        "CLAUDE.md:9: heading ## Rules is out of the order",
    ),
    "root without its workflow section": (
        replace(ROOT_NODE, "## Mission Workflow\n\nThe workflow.\n", ""),
        "CLAUDE.md: has no ## Mission Workflow",
    ),
    "root title heading": (
        replace(ROOT_NODE, "## Purpose\n", "# Title\n\n## Purpose\n"),
        "CLAUDE.md:1: heading # Title is outside the allowed set",
    ),
    "root description outside the pointers": (
        replace(ROOT_NODE, "## Rules\n", "### docs/\n\n## Rules\n"),
        "CLAUDE.md:5: heading ### docs/ is outside the allowed set",
    ),
    "root description of no folder": (
        replace(ROOT_NODE, "### hosts/", "### nowhere/\n\n#### Purpose\n\nNothing.\n\n### hosts/"),
        "heading ### nowhere/ names no tracked top-level folder",
    ),
    "description heading outside the set": (
        replace(ROOT_NODE, "#### Pointers", "#### Files"),
        "heading #### Files is outside the allowed set",
    ),
    "description heading out of order": (
        replace(ROOT_NODE, "#### Purpose\n\nThe runtime layer.\n\n#### Pointers", "#### Pointers\n\n#### Purpose\n\nThe runtime layer.\n"),
        "heading #### Purpose is out of the order",
    ),
    "description without its purpose": (
        replace(ROOT_NODE, "#### Purpose\n\nThe runtime layer.\n\n", ""),
        "CLAUDE.md: the description of core/ has no #### Purpose",
    ),
    "node heading outside the set": (
        replace("docs/README.md", "## Pointers", "### Pointers"),
        "docs/README.md:5: heading ### Pointers is outside the allowed set",
    ),
    "node heading out of order": (
        replace("docs/README.md", "## Purpose\n\nThe docs node.\n\n## Pointers", "## Pointers\n\n## Purpose\n\nThe docs node.\n"),
        "docs/README.md:3: heading ## Purpose is out of the order",
    ),
    "node without its purpose": (
        replace("scripts/README.md", "## Purpose", "## Rules"),
        "scripts/README.md: has no ## Purpose",
    ),
    "root description repeated": (
        replace(ROOT_NODE, "### hosts/", "### core/\n\n#### Purpose\n\nAgain.\n\n### hosts/"),
        "heading ### core/ describes core/ a second time",
    ),
    "github readme": (
        chain(add(".github/README.md", LEAF_TEXT), replace(ROOT_NODE, "### core/", "### .github/\n\n#### Purpose\n\nGitHub's files.\n\n### core/")),
        "GitHub shows a README in .github/ as the repository's front page",
    ),
}


@pytest.mark.parametrize("name", sorted(CASES))
def test_each_failure_is_reproduced(tmp_path, name):
    change, expected = CASES[name]
    failures = failures_of(tmp_path, change)
    assert len(failures) == 1, failures
    assert expected in failures[0], failures
