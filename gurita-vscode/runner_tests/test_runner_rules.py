"""Rule matching and the default: the rule file's lines read as `pattern -> name`, split at the
last arrow, each pattern searched case-insensitively in the task's title and brief joined by a
newline, the first match in file order winning and the one bare `*` line the default."""

import pytest


def rules_from(runner, tmp_path, text):
    path = tmp_path / "task_line_rules.txt"
    path.write_text(text, encoding="utf-8")
    return runner.read_rules(str(path))


def test_the_first_matching_rule_in_file_order_wins(runner, tmp_path):
    rules = rules_from(runner, tmp_path, "parser -> First\nparser|runner -> Second\n* -> Default\n")
    assert rules.state == runner.RULES_READ
    assert rules.line_name("A Parser Task", "") == "First"
    assert rules.line_name("The runner", "") == "Second"


def test_a_pattern_is_searched_case_insensitively_in_the_title_and_brief(runner, tmp_path):
    rules = rules_from(runner, tmp_path, r"\.py\b -> Strong" + "\n")
    assert rules.line_name("Plain title", "Edit `core/tools/MISSIONS.PY` to add a query.") == "Strong"
    assert rules.line_name("Plain title", "Edit the .pyc cache") is None


def test_title_and_brief_are_joined_by_a_newline(runner, tmp_path):
    rules = rules_from(runner, tmp_path, "words\\nBrief -> Joined\nwords Brief -> Spaced\n")
    assert rules.line_name("Title words", "Brief starts here") == "Joined"
    rules = rules_from(runner, tmp_path, "Title ends$ -> End\n(?m)Title ends$ -> Line end\n")
    assert rules.line_name("Title ends", "More") == "Line end"


def test_the_default_names_the_line_when_no_rule_matches(runner, tmp_path):
    rules = rules_from(runner, tmp_path, "* -> Single task with Opus High (Claude Code)\ntest -> Strong\n")
    assert rules.default == "Single task with Opus High (Claude Code)"
    assert rules.line_name("Write the README", "Docs only.") == "Single task with Opus High (Claude Code)"
    assert rules.line_name("Add a test", "") == "Strong"


def test_without_a_default_an_unmatched_task_gets_no_line(runner, tmp_path):
    rules = rules_from(runner, tmp_path, "test -> Strong\n")
    assert rules.state == runner.RULES_READ
    assert rules.line_name("Write the README", "") is None


def test_the_line_is_split_at_its_last_arrow(runner, tmp_path):
    rules = rules_from(runner, tmp_path, "a -> b -> Name\n")
    assert rules.line_name("x a -> b y", "") == "Name"
    assert rules.line_name("a", "") is None


def test_blank_and_comment_lines_are_skipped(runner, tmp_path):
    rules = rules_from(runner, tmp_path, "# a comment -> not a rule\n\n   \n  # indented comment\nx -> X\n")
    assert rules.state == runner.RULES_READ
    assert [(rule.name, rule.number) for rule in rules.rules] == [("X", 5)]


def test_names_and_patterns_are_stripped_of_outer_whitespace(runner, tmp_path):
    rules = rules_from(runner, tmp_path, "  parser   ->   Opus xHigh (Claude Code)  \r\n")
    assert rules.line_name("parser", "") == "Opus xHigh (Claude Code)"


def test_a_second_default_line_is_refused(runner, tmp_path):
    rules = rules_from(runner, tmp_path, "* -> A\nx -> X\n* -> B\n")
    assert rules.state == runner.RULES_REFUSED
    assert rules.problems == ["line 3: a second default line; the first is line 1"]


@pytest.mark.parametrize(
    "text, problem",
    [
        ("no arrow here\n", "line 1: no ' -> ' between a pattern and a line name"),
        ("x->Y\n", "line 1: no ' -> ' between a pattern and a line name"),
        ("x ->Y\n", "line 1: no ' -> ' between a pattern and a line name"),
        (" -> Name\n", "line 1: the pattern before ' -> ' is empty"),
        ("   ->  Name\n", "line 1: the pattern before ' -> ' is empty"),
        ("x ->   \n", "line 1: the line name after ' -> ' is empty"),
        ("x ->  -> \n", "line 1: the line name after ' -> ' is empty"),
    ],
)
def test_a_line_not_split_into_a_pattern_and_a_name_is_refused(runner, tmp_path, text, problem):
    rules = rules_from(runner, tmp_path, text)
    assert rules.state == runner.RULES_REFUSED
    assert rules.problems == [problem]


def test_an_invalid_pattern_is_refused_with_its_reason(runner, tmp_path):
    rules = rules_from(runner, tmp_path, "ok -> A\nfoo( -> B\n")
    assert rules.state == runner.RULES_REFUSED
    assert len(rules.problems) == 1
    assert rules.problems[0].startswith("line 2: the pattern is not a valid regular expression: ")
    assert rules.rules == [] and rules.default is None


def test_every_unreadable_line_is_reported_in_order(runner, tmp_path):
    path = tmp_path / "task_line_rules.txt"
    path.write_bytes(b"* -> A\nbad\n\xff\xfe -> B\n[ -> C\n* -> D\n")
    rules = runner.read_rules(str(path))
    assert rules.state == runner.RULES_REFUSED
    assert [problem.split(":")[0] for problem in rules.problems] == ["line 2", "line 3", "line 4", "line 5"]
    assert rules.problems[1] == "line 3: not UTF-8 text"


def test_a_missing_rule_file_holds_no_rule_and_no_default(runner, tmp_path):
    rules = runner.read_rules(str(tmp_path / "absent.txt"))
    assert rules.state == runner.RULES_MISSING
    assert rules.rules == [] and rules.default is None


def test_a_rule_file_that_cannot_be_opened_is_refused(runner, tmp_path):
    rules = runner.read_rules(str(tmp_path))
    assert rules.state == runner.RULES_REFUSED
    assert len(rules.problems) == 1
    assert rules.problems[0].startswith("the file cannot be read: ")
