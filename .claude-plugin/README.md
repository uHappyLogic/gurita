## Purpose

This node is for maintainers of `.claude-plugin/`. The folder holds one file, `marketplace.json`: the maintainer's directory marketplace, named `gurita`, whose one `plugins[]` entry points at `./hosts/claude`. A checkout registered as a directory marketplace installs the plugin straight from the working tree's built Claude Code tree, with no release. Users never install from here: they install from the distribution repository `gurita-claude`, which carries its own marketplace file rendered under `hosts/claude/`. No plugin manifest stands at the repository root; the Claude Code manifest is rendered under `hosts/claude/` like the rest of that tree.

## Rules

- **The marketplace stays a working directory marketplace pointing at the built Claude Code tree.** The entry's `source` stays `./hosts/claude`, the committed build output, and its `name` stays `gurita`, so `gurita@gurita` installs from a checkout and the host suite's Claude Code run finds the copy it compares with `hosts/claude/`. Reason: the checkout is the maintainer's install source while developing, and Claude Code reads the marketplace from the checkout directory, so what it installs is exactly the tree the build committed. Retired forms: a root `plugin.json`, a `source` pointing at `core/` or at any path the build does not write.
- **The entry's `version` is a mirror of `VERSION`, never edited by hand.** `scripts/set_version.py` writes it in lockstep with `VERSION`, `pyproject.toml`, and `uv.lock`, and the build's `root-marketplace-version` check fails when any `plugins[]` entry carries another literal. Reason: one version literal cannot drift from its mirrors. Retired forms: a hand-edited version here.
- → `scripts/README.md#rules` — The `VERSION` rule whole, with the release path that bumps it. Read it before changing the version or adding a version surface.

## Commands

- `/plugin marketplace add /path/to/gurita` — register a checkout as a directory marketplace in Claude Code.
- `/plugin install gurita@gurita` — install the plugin from that marketplace; rebuild `hosts/` first so the installed tree is current.

## Pointers

- → `CONTRIBUTING.md#development` — How a contributor registers the checkout, refreshes the install, and where each host's installed copy is found. Follow it when the install from the checkout misbehaves.
- → `scripts/set_version.py` — Its docstring lists every version surface it writes and what it deliberately leaves to the build. Read it before touching any version literal.
- → `scripts/build_hosts.py` — Its docstring states the `root-marketplace-version` check and the files the build reads from the root. Read it before changing this file's shape.
