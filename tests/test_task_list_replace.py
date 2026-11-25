"""The replace subcommand: the body of the one TASKS_TODO.md section whose heading equals the
title (exact whitespace-folded, case-folded match) rewritten with the body read from standard
input, the section keeping its heading, its position, and its "---" and every other section
keeping its title and body, with the file rendered in the canonical layout; the title cannot
change; silent on success; a partial, shared, or unknown title, or an empty body, refused
with one Error line and the list byte-for-byte unchanged."""

import os
import subprocess
import sys
from pathlib import Path

import pytest

import task_list
from task_list import Section, parse_sections

TOOL = Path(task_list.__file__).resolve()

FIRST = "Build The Parser First"
SECOND = "Keep A Body Separator Line"
THIRD = "Render Unicode — Text As Given"

NEW_BODY = "Rewrite the brief after a finding, keeping the section where it stands. Verified by a test."


def silent(result):
    assert (result.returncode, result.stdout, result.stderr) == (0, b"", b"")


def snapshot(target):
    return (target / task_list.TODO_NAME).read_bytes()


def todo_of(target):
    return (target / task_list.TODO_NAME).read_text(encoding="utf-8")


def sections_of(target):
    _, sections = parse_sections(todo_of(target))
    return sections


def refused(result, target, before):
    assert result.returncode == 1
    assert result.stdout == b""
    assert result.stderr.startswith(b"Error: ") and result.stderr.count(b"\n") == 1
    assert b"Traceback" not in result.stderr
    assert snapshot(target) == before
    return result.stderr.decode("utf-8")


# --- the rewrite ------------------------------------------------------------------------


def test_replace_rewrites_the_body_and_keeps_heading_position_and_separator(run_task_list, task_list_dir):
    target = task_list_dir(
        todo=b"# TASKS TODO\n\n## First Task\n\nThe first body.\n\n---\n\n"
        b"## Second Task\n\nThe second body.\n\n---\n\n## Third Task\n\nThe third body.\n\n---\n"
    )
    silent(run_task_list("replace", str(target), "Second Task", stdin=b"The rewritten body.\n"))
    assert todo_of(target) == (
        "# TASKS TODO\n\n## First Task\n\nThe first body.\n\n---\n\n"
        "## Second Task\n\nThe rewritten body.\n\n---\n\n## Third Task\n\nThe third body.\n\n---\n"
    )


@pytest.mark.parametrize("title", [FIRST, SECOND, THIRD])
def test_replace_changes_exactly_the_named_body_wherever_it_stands(run_task_list, task_list_dir, title):
    target = task_list_dir()
    before = sections_of(target)
    silent(run_task_list("replace", str(target), title, stdin=NEW_BODY.encode("utf-8")))
    after = sections_of(target)
    assert [section.title for section in after] == [FIRST, SECOND, THIRD]
    assert after == [
        Section(section.title, NEW_BODY) if section.title == title else section for section in before
    ]


def test_the_heading_keeps_its_own_spelling_whatever_the_title_argument(run_task_list, task_list_dir):
    target = task_list_dir()
    silent(run_task_list("replace", str(target), "  build THE parser\tfirst ", stdin=NEW_BODY.encode("utf-8")))
    assert [section.title for section in sections_of(target)] == [FIRST, SECOND, THIRD]
    assert sections_of(target)[0].body == NEW_BODY
    assert "## build THE parser" not in todo_of(target)


def test_a_multi_line_body_lands_with_its_outer_blank_lines_trimmed(run_task_list, task_list_dir):
    target = task_list_dir()
    body = "\n\nFirst paragraph of the brief.\n\nSecond paragraph, `code` and $(cmd) as given.\n\n\n"
    silent(run_task_list("replace", str(target), THIRD, stdin=body.encode("utf-8")))
    assert todo_of(target).endswith(
        "## Render Unicode — Text As Given\n\n"
        "First paragraph of the brief.\n\nSecond paragraph, `code` and $(cmd) as given.\n\n---\n"
    )


def test_a_body_dash_line_is_written_as_body_text(run_task_list, task_list_dir):
    target = task_list_dir()
    body = "A rewritten brief.\n\n---\n\nThe line above stays body text."
    silent(run_task_list("replace", str(target), FIRST, stdin=body.encode("utf-8")))
    sections = sections_of(target)
    assert [section.title for section in sections] == [FIRST, SECOND, THIRD]
    assert sections[0].body == body


def test_a_section_without_its_separator_gains_one(run_task_list, task_list_dir):
    target = task_list_dir(todo=b"# TASKS TODO\n\n## First Task\n\nThe first body.\n## Second Task\n\nThe second body.\n\n---\n")
    silent(run_task_list("replace", str(target), "First Task", stdin=b"The new first body.\n"))
    assert todo_of(target) == (
        "# TASKS TODO\n\n## First Task\n\nThe new first body.\n\n---\n\n## Second Task\n\nThe second body.\n\n---\n"
    )


def test_the_rest_of_the_list_is_rendered_in_the_canonical_layout(run_task_list, task_list_dir):
    drifted = b"stray preamble\n## First Task\nThe first body.\n---\n\n\n\n## Second Task\n\n\nThe second body.\n---"
    target = task_list_dir(todo=drifted)
    silent(run_task_list("replace", str(target), "Second Task", stdin=b"The new second body.\n"))
    assert todo_of(target) == (
        "# TASKS TODO\n\n## First Task\n\nThe first body.\n\n---\n\n## Second Task\n\nThe new second body.\n\n---\n"
    )


def test_replacing_with_the_same_body_leaves_a_canonical_file_byte_identical(run_task_list, task_list_dir):
    target = task_list_dir()
    before = snapshot(target)
    body = sections_of(target)[1].body
    silent(run_task_list("replace", str(target), SECOND, stdin=body.encode("utf-8")))
    assert snapshot(target) == before


def test_replace_writes_no_other_file(run_task_list, task_list_dir):
    target = task_list_dir()
    silent(run_task_list("replace", str(target), FIRST, stdin=NEW_BODY.encode("utf-8")))
    assert sorted(path.name for path in target.iterdir()) == [task_list.TODO_NAME]


def test_a_write_keeps_the_task_list_mode(run_task_list, task_list_dir):
    target = task_list_dir()
    os.chmod(target / task_list.TODO_NAME, 0o640)
    silent(run_task_list("replace", str(target), FIRST, stdin=NEW_BODY.encode("utf-8")))
    assert (os.stat(target / task_list.TODO_NAME).st_mode & 0o777) == 0o640


# --- refusals ---------------------------------------------------------------------------


@pytest.mark.parametrize("title", ["Build The Parser", "Parser", "Build The Parser First Now", "No Such Task"])
def test_a_partial_or_unknown_title_is_refused(run_task_list, task_list_dir, title):
    target = task_list_dir()
    before = snapshot(target)
    message = refused(run_task_list("replace", str(target), title, stdin=NEW_BODY.encode("utf-8")), target, before)
    assert f'no section of {target / task_list.TODO_NAME} is titled "{title}"' in message
    assert f'"{FIRST}", "{SECOND}", "{THIRD}"' in message


def test_a_title_two_sections_share_is_refused(run_task_list, task_list_dir):
    target = task_list_dir(todo=b"# TASKS TODO\n\n## Twin\n\nOne.\n\n---\n\n## twin\n\nTwo.\n\n---\n")
    before = snapshot(target)
    message = refused(run_task_list("replace", str(target), "Twin", stdin=b"Three.\n"), target, before)
    assert "Error: 2 sections of" in message and "the title names no single section" in message


@pytest.mark.parametrize("body", [b"", b"\n", b"  \n\n\t\n"])
def test_an_empty_body_is_refused(run_task_list, task_list_dir, body):
    target = task_list_dir()
    before = snapshot(target)
    message = refused(run_task_list("replace", str(target), FIRST, stdin=body), target, before)
    assert "the task body on standard input is empty" in message


def test_replacing_in_an_empty_list_is_refused(run_task_list, task_list_dir):
    target = task_list_dir(todo=b"# TASKS TODO\n\n")
    before = snapshot(target)
    message = refused(run_task_list("replace", str(target), FIRST, stdin=NEW_BODY.encode("utf-8")), target, before)
    assert "it holds no section" in message


def test_a_missing_task_list_is_refused_and_nothing_is_written(run_task_list, task_list_dir):
    target = task_list_dir()
    (target / task_list.TODO_NAME).unlink()
    result = run_task_list("replace", str(target), FIRST, stdin=NEW_BODY.encode("utf-8"))
    assert result.returncode == 1 and result.stdout == b""
    assert result.stderr.startswith(b"Error: ") and b"does not exist" in result.stderr
    assert list(target.iterdir()) == []


def test_a_non_utf8_body_is_refused(run_task_list, task_list_dir):
    target = task_list_dir()
    before = snapshot(target)
    message = refused(run_task_list("replace", str(target), FIRST, stdin=b"Bad \xff\xfe bytes\n"), target, before)
    assert "is not UTF-8 text" in message


def test_a_terminal_stdin_is_refused_without_blocking(task_list_dir):
    pty = pytest.importorskip("pty")
    target = task_list_dir()
    before = snapshot(target)
    master, slave = pty.openpty()
    try:
        result = subprocess.run(
            [sys.executable, "-B", str(TOOL), "replace", str(target), FIRST],
            stdin=slave,
            capture_output=True,
            check=False,
            timeout=30,
        )
    finally:
        os.close(slave)
        os.close(master)
    message = refused(result, target, before)
    assert "must be piped on standard input" in message


def test_there_is_no_way_to_change_the_title(run_task_list, task_list_dir):
    target = task_list_dir()
    before = snapshot(target)
    result = run_task_list("replace", str(target), FIRST, "A New Title", stdin=NEW_BODY.encode("utf-8"))
    assert result.returncode == 2
    assert b"unrecognized arguments: A New Title" in result.stderr
    assert snapshot(target) == before


def test_replace_without_a_title_is_a_usage_error(run_task_list, task_list_dir):
    target = task_list_dir()
    before = snapshot(target)
    result = run_task_list("replace", str(target), stdin=NEW_BODY.encode("utf-8"))
    assert result.returncode == 2
    assert result.stdout == b""
    assert b"TASK_TITLE" in result.stderr
    assert snapshot(target) == before


def test_help_names_the_replace_subcommand(run_task_list):
    result = run_task_list("--help")
    assert result.returncode == 0
    assert b"replace" in result.stdout
    replace_help = run_task_list("replace", "--help")
    assert replace_help.returncode == 0
    assert b"the title cannot change" in replace_help.stdout
