## Purpose

This node is for maintainers of `docs/`. The folder holds four pages written for the plugin's users: the workflow, the skill reference, the headless chains, and the design claims. The root `README.md` and `CONTRIBUTING.md` link the pages and some of their heading anchors, and the pages link one another, so a renamed heading breaks a link somewhere else. This file is the one document in the folder not written for users. It holds the rules a page edit must keep and points at the sources the pages leave the mechanics to.

## Rules

- **The pages carry user content only.** A page says what a user needs to run the plugin: what each skill is for, when to run it, what it reads, writes, and refuses, and the commit it leaves; the phases and their order; the chains and their flags; the claims and their metrics. Reason: `docs/` serves the plugin's users alone, and maintainer material written beside the user content had grown the pages to 188,503 bytes, most of it detail a user never acts on. Retired forms, which must not return to a page: tool subcommands, flags, and output fields; fixed shell calls and scratch-file, batch-call, staging, and lock-retry mechanics; `core/` file and shared-procedure names; host slot wording and each host's subagent tool names; field measurements, dates, and the history of replaced forms; the list of which tests check which claim.
- **A mechanic already stated elsewhere is cut and not restated.** When a runtime file, a tool's `--help` or docstring, a test, or the build's docstring already states a mechanic, a page drops it, nothing restates it, and this node points at the source instead. Reason: the source is what runs and what the suite checks, and a second statement of it drifts from it without any check failing. Retired forms: moving the cut material into a node instead of dropping it; the Markdown table of fixed console lines in `docs/skill-reference.md`, now the data file `tests/fixed_console_lines.tsv` that the test and the extension's bundle script read, so the page describes the convention for a user and links the file, and never lists its rows or the test's checks again.

## Pointers

- → `docs/workflow.md` — The six phases of a mission, how the skills commit, and the answer-principle-learning loop. Read it before an edit that changes a phase, its order, or a commit subject.
- → `docs/skill-reference.md` — One entry per skill and one for the alternatives subagent, each heading spelling the skill's invocation as its Usage fence does. Read it before changing a skill's invocation, stops, or commit.
- → `docs/skill-reference.md#fixed-console-lines` — The user-facing description of the fixed first lines. Follow it when a skill's report lines change; the lines themselves live in the data file.
- → `docs/ways-of-using.md` — The headless chains and their per-host flags. Every chain line follows the Usage fence of the skill it invokes, so read it when a skill's arguments change.
- → `docs/design-claims.md` — The nineteen claims in Simplified Technical English, each with its design and one metric. Read it when a change could make a claim false.
- → `core/skills/` — Each skill's `SKILL.md` is its exact behaviour and holds its Usage fence. The skill reference and the chains defer to these; check a page against them.
- → `core/shared/` — The shared procedures behind the skills' stops, gates, and commits. Check a page's account of a phase against them; never name them on a page.
- → `core/tools/` — Each tool's `--help` and module docstring state its subcommands, flags, and output. Follow it for any tool mechanic a page once described.
- → `tests/fixed_console_lines.tsv` — Every fixed console line with its source and kind, one row per line. Change a row together with the line it lists; the skill reference only links this file.
- → `tests/` — The suite that pins the tools' and the fixed calls' behaviour. Follow it for a mechanic a test states rather than a page.
- → `scripts/build_hosts.py` — Its module docstring is the reference for the host build, the slot forms, and the check set. Follow it for anything about how a host's wording differs.
- → `README.md#installation` — How a user installs the plugin on each host, which the workflow page links rather than repeats.
- → `CONTRIBUTING.md#development` — The build loop and both test runs, for a maintainer changing anything a page describes.
