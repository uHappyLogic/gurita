#!/usr/bin/env python3
"""The stand-in for the `claude` CLI that `capture_demo.js` places first on `PATH` while it
records the listing's demo GIF, so the recipe run the GIF shows is deterministic and starts no
model session.

Stdlib only, Python 3.9 or later. It takes the command line a recipe line gives `claude` (the
prompt `/gurita:<skill> --mission <path>`, with or without `-p`, and any further flags, which it
ignores), carries out a scripted version of the four skills of the shipped `First run` recipe on
the seeded sample mission, from the project root the run starts in, and ends its print on the
skill's fixed console line, so the runner's check reads the line a real run would end on:

- `specify-mission-starting-state` prints its progress and `Starting state recorded.`;
- `review-mission-requirements` adds one question through the plugin's open-question tool and
  commits it under `Requirements-review: <path>`;
- `provide-alternatives-to-all-open-questions` embeds a prepared alternative set into every
  question lacking one, one commit per question;
- `recommend-all-open-questions` embeds a prepared pick into every question lacking one and
  commits them together.

Every document write goes through the checkout's own `core/tools/open_questions.py`, found
beside this file's directory, and every commit names its paths.

It also answers the two listings the extension's harness check runs, so the side-bar view and the
Settings window show Claude Code with its Gurita copy installed and up to date:
`plugin list --json` prints one enabled user-scope `gurita@gurita` entry at the checkout's
`VERSION`, the version the package records, and `plugin marketplace list --json` one `gurita`
marketplace read from the distribution repository. Any other skill, or a command line naming none,
prints one `Error:` line and exits 1.
"""

import json
import os
import re
import subprocess
import sys
import time

CHECKOUT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.realpath(__file__))))
TOOLS = os.path.join(CHECKOUT, "core", "tools")
OPEN_QUESTIONS = os.path.join(TOOLS, "open_questions.py")
VERSION_FILE = os.path.join(CHECKOUT, "VERSION")

PROMPT = re.compile(r"^/gurita:([a-z-]+)\s+--mission\s+(\S+)")

PAUSE = 0.9

ADDED_QUESTION = (
    "Category naming",
    "Should an expense's category be typed freely or chosen from a fixed list?",
)

ALTERNATIVES = {
    "Data file format": [
        ("CSV", "One CSV file, a header row and one row per expense.",
         "Readable and editable in any spreadsheet.", "Quoting rules must be handled for free-text fields."),
        ("JSON lines", "One JSON object per line, appended per expense.",
         "Appending never rewrites the file.", "Less convenient to open in a spreadsheet."),
        ("SQLite", "One SQLite database file holding an expenses table.",
         "Queries for the summary come for free.", "The file cannot be read or fixed by hand."),
    ],
    "Date input form": [
        ("ISO dates only", "The date is typed as YYYY-MM-DD and nothing else is accepted.",
         "One unambiguous form, trivially parsed.", "Typing today's date is tedious."),
        ("ISO dates and relative words", "YYYY-MM-DD, or the words today and yesterday.",
         "The common case is one short word.", "Two forms to document and test."),
    ],
    "Summary period selection": [
        ("Month flag", "The summary takes --month YYYY-MM, the current month by default.",
         "Matches the month-end reading habit.", "Arbitrary ranges are not possible."),
        ("From and to flags", "The summary takes --from and --to dates, both inclusive.",
         "Any period can be named.", "The usual month needs two dates."),
    ],
    "Category naming": [
        ("Free text", "Any category name the user types is accepted as written.",
         "Nothing to configure before the first expense.", "Typos split one category in two."),
        ("Free text, case-folded", "Any name is accepted, compared and stored case-folded.",
         "Keeps the freedom and merges Food with food.", "Other typos still split categories."),
        ("Fixed list", "Categories come from a fixed list shipped with the tool.",
         "Totals always group cleanly.", "The list never fits everyone."),
    ],
}

PICKS = {
    "Data file format": ("CSV", "a few dozen rows a month stay readable and editable by hand."),
    "Date input form": ("ISO dates and relative words", "most expenses are entered the day they happen."),
    "Summary period selection": ("Month flag", "the summary is read at month end."),
    "Category naming": ("Free text, case-folded", "it keeps entry quick and merges the commonest split."),
}


def escape(text):
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def tool(*args, body=None):
    subprocess.run(
        [sys.executable, OPEN_QUESTIONS, *args],
        input=body,
        text=True,
        check=True,
    )


def listed(mission, *flags):
    result = subprocess.run(
        [sys.executable, OPEN_QUESTIONS, "list", *flags, mission],
        capture_output=True,
        text=True,
        check=True,
    )
    return [line for line in result.stdout.splitlines() if line]


def commit(subject, *paths, body=None):
    subprocess.run(["git", "add", "--", *paths], check=True)
    message = ["-m", subject] + (["-m", body] if body else [])
    subprocess.run(["git", "commit", "-q", *message, "--", *paths], check=True)


def say(text, pause=PAUSE):
    print(text, flush=True)
    time.sleep(pause)


def starting_state(mission):
    say("Reading the project and the missions record.")
    say("Exploring the scope for what the goal reaches.")
    say("Starting state recorded.", 0)


def review(mission):
    say("Reading the requirements against the open questions.")
    title, question = ADDED_QUESTION
    tool("add", mission, title, body=question + "\n")
    commit(f"Requirements-review: {mission}", os.path.join(mission, "open_questions.xml"))
    say(f"Added a question: {title}")
    say("Requirements reviewed.", 0)


def alternatives(mission):
    questions = listed(mission, "--without-alternatives")
    say(f"Dispatching {len(questions)} alternatives agents.")
    for title in questions:
        lines = []
        for option, what, advantage, drawback in ALTERNATIVES[title]:
            lines.append(f'<alternative id="{escape(option)}">{escape(what)}'
                         f"<advantage>{escape(advantage)}</advantage>"
                         f"<drawback>{escape(drawback)}</drawback></alternative>")
        tool("embed", "--alternatives", mission, title, body="\n".join(lines) + "\n")
        commit(f"Alternatives-annotation: {title}", os.path.join(mission, "open_questions.xml"))
        say(f"  {title}: {len(lines)} alternatives")
    say("Alternatives embedded.", 0)


def recommendations(mission):
    questions = listed(mission, "--without-recommendation")
    say(f"Weighing {len(questions)} questions together.")
    lifted = []
    for title in questions:
        option, rationale = PICKS[title]
        tool("embed", "--recommendation", mission, title,
             body=f'<recommendation option="{escape(option)}">{escape(rationale)}</recommendation>\n')
        lifted.append(f"{option} — {rationale}")
        say(f"  {title}: {option}", PAUSE / 2)
    commit(f"Recommendation-annotation: {mission}", os.path.join(mission, "open_questions.xml"),
           body="\n".join(lifted))
    say("Recommendations embedded.", 0)


SKILLS = {
    "specify-mission-starting-state": starting_state,
    "review-mission-requirements": review,
    "provide-alternatives-to-all-open-questions": alternatives,
    "recommend-all-open-questions": recommendations,
}


def plugin_listing():
    with open(VERSION_FILE, encoding="utf-8") as handle:
        version = handle.read().strip()
    return [{"id": "gurita@gurita", "scope": "user", "enabled": True, "version": version}]


MARKETPLACE_LISTING = [{"name": "gurita", "source": "github", "repo": "uHappyLogic/gurita-claude"}]


def main(argv):
    if argv == ["plugin", "list", "--json"]:
        print(json.dumps(plugin_listing()))
        return 0
    if argv == ["plugin", "marketplace", "list", "--json"]:
        print(json.dumps(MARKETPLACE_LISTING))
        return 0
    prompts = [arg for arg in argv if arg.startswith("/gurita:")]
    found = PROMPT.match(prompts[0]) if prompts else None
    if found is None or found.group(1) not in SKILLS:
        print(f"Error: the demo stand-in runs none of: {' '.join(argv)}", file=sys.stderr)
        return 1
    SKILLS[found.group(1)](found.group(2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
