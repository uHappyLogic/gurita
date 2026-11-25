"""The fold's refusals beyond the baseline input failures: an empty decision, a decision holding
a line that opens at column 0 with "## " or "### ", an empty heading, and a requirements.md holding no column-0 "## Decisions" heading or more than one, each one
Error line with exit 1 and the file byte-for-byte unchanged."""

import pytest

import requirements

NAME = requirements.REQUIREMENTS_NAME


def assert_refused(result, reason):
    assert result.returncode == 1
    assert result.stdout == b""
    lines = result.stderr.decode("utf-8").split("\n")
    assert len(lines) == 2 and lines[1] == ""
    assert lines[0].startswith("Error: ")
    assert reason in lines[0]
    assert "Traceback" not in lines[0]


# --- an empty decision ------------------------------------------------------------------


@pytest.mark.parametrize("decision", [b"", b"\n", b"\n\n\n", b"  \n\t\n \r\n"], ids=["empty", "newline", "newlines", "whitespace"])
def test_an_empty_decision_is_refused(run_requirements, requirements_dir, decision):
    target = requirements_dir()
    before = (target / NAME).read_bytes()
    result = run_requirements("fold", str(target), "--section", "Prose decision", stdin=decision)
    assert_refused(result, "the decision on standard input is empty")
    assert (target / NAME).read_bytes() == before


@pytest.mark.parametrize("section", ["", "   ", "\n\t"], ids=["empty", "spaces", "whitespace"])
def test_an_empty_heading_is_refused(run_requirements, requirements_dir, section):
    target = requirements_dir()
    before = (target / NAME).read_bytes()
    result = run_requirements("fold", str(target), "--section", section, stdin=b"A decision.\n")
    assert_refused(result, "the subsection heading given as --section is empty")
    assert (target / NAME).read_bytes() == before


# --- no single Decisions section --------------------------------------------------------


@pytest.mark.parametrize(
    "original",
    [
        b"# None\n\n## Goal\n\nShip it.\n\n## Out of Scope\n",
        b"## Goal\n\n ## Decisions\n\nAn indented heading is not a section.\n",
        b"## Goal\n\n### Decisions\n\nA subsection is not the section.\n",
        b"## Goal\n\n## Decision\n\nThe singular is another title.\n",
        b"## Goal\n\n## Decisions made\n\nA longer title is another title.\n",
        b"## Goal\n\nThe prose names `## Decisions` without holding the heading.\n",
        b"",
    ],
    ids=["absent", "indented", "subsection", "singular", "longer", "in-prose", "empty-file"],
)
def test_a_file_holding_no_decisions_heading_is_refused(run_requirements, requirements_dir, original):
    target = requirements_dir(original)
    result = run_requirements("fold", str(target), "--section", "Kept", stdin=b"A decision.\n")
    assert_refused(result, 'holds no column-0 "## Decisions" heading')
    assert (target / NAME).read_bytes() == original


@pytest.mark.parametrize(
    "original, numbers",
    [
        (b"## Decisions\n\n### Kept\n\nPara.\n\n## Decisions\n\nAgain.\n", "lines 1, 7"),
        (b"## Goal\n\n## Decisions\n\n## Out of Scope\n\n## decisions\n", "lines 3, 7"),
        (b"## Decisions\n## Decisions\n## Decisions\n", "lines 1, 2, 3"),
    ],
    ids=["two", "case-folded", "three"],
)
def test_a_file_holding_more_than_one_decisions_heading_is_refused(run_requirements, requirements_dir, original, numbers):
    target = requirements_dir(original)
    result = run_requirements("fold", str(target), "--section", "Kept", stdin=b"A decision.\n")
    assert_refused(result, 'column-0 "## Decisions" headings')
    assert numbers in result.stderr.decode("utf-8")
    assert (target / NAME).read_bytes() == original


# --- a heading line in the decision ---------------------------------------------------------


@pytest.mark.parametrize(
    "decision, named",
    [
        (b"A decision.\n\n## Out of Scope\n\nA stray section.\n", '"## Out of Scope"'),
        (b"### A stray subsection\n\nA decision.\n", '"### A stray subsection"'),
        (b"A decision.\r\n## Out of Scope\r\n", '"## Out of Scope"'),
        (b"A decision.\n\n### First stray\n\n## Second stray\n", '"### First stray"'),
    ],
    ids=["section-heading", "subsection-heading", "crlf", "the-first-is-named"],
)
def test_a_decision_holding_a_heading_line_is_refused(run_requirements, requirements_dir, decision, named):
    target = requirements_dir()
    before = (target / NAME).read_bytes()
    result = run_requirements("fold", str(target), "--section", "Prose decision", stdin=decision)
    assert_refused(result, "the decision on standard input holds the heading line " + named)
    assert (target / NAME).read_bytes() == before


def test_the_out_of_scope_case_leaves_one_heading_of_that_name(run_requirements, requirements_dir):
    target = requirements_dir()
    before = (target / NAME).read_bytes()
    assert before.count(b"\n## Out of Scope\n") == 1
    result = run_requirements("fold", str(target), "--section", "Prose decision", stdin=b"A decision.\n\n## Out of Scope\n")
    assert_refused(result, '"## Out of Scope"')
    assert (target / NAME).read_bytes() == before
