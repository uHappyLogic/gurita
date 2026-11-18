# ASCII art arms banner

## Goal

Add a banner of ASCII art to the top of the GitHub landing pages: several octopus arms curling up from the bottom edge of the banner, drawn in characters and coloured in a violet and grey-blue palette. Because GitHub strips colour from README text, the art is a committed SVG image, shown as the very first element of the root README and of the three host READMEs. Nothing else on those pages changes: the badges and the workflow diagram keep their colours.

## Relevant starting state

### Root README

`README.md` at the repository root is the landing page of `uHappyLogic/gurita`. Its first element today is a centred `<p align="center">` holding three shields.io badges (release, CI, licence), followed by a centred adoption table of traffic badges for the four repositories and a `---` rule; only then come the `# Gurita` title, the bold tagline "Decide first, then let the arms carry the work.", the pitch, the former-name sentence, and the Mermaid workflow diagram. The file is edited by hand and is no build input: the host build neither reads nor renders it.

### Host READMEs

Each host's README is a template at `scripts/hosts/<host>/README.md` (`claude`, `antigravity`, `codex`), rendered by the build to `hosts/<host>/README.md` with only `{{VERSION}}` and `{{NAME}}` filled; the committed `hosts/` copies are build output and never hand-edited. Each opens with a centred `<p align="center">` holding that repository's two traffic badges, then `# Gurita for <Host>` and the pitch; none carries the tagline, the diagram, or any other image. The three templates are separate files sharing no fragment, kept alike by hand.

### Images and colours on the pages today

No image file is tracked anywhere in the repository, and no assets or image directory exists. Every image the four READMEs show is a remote SVG referenced by absolute URL through `<img>` or Markdown image syntax: the shields.io badges (release `22c55e`, licence `3b82f6`) and the traffic badges served from each repository's `traffic-data` branch on `raw.githubusercontent.com` (colour `3b82f6`, set in the traffic workflow). The root README's Mermaid diagram is pinned to the `base` theme with white subgraph fills: violet for the decide phase (`#9333ea` stroke, `#faf5ff` fill, `#581c87` text), green for the execute phase (`#059669`, `#ecfdf5`, `#064e3b`), and slate grey-blue lines and borders (`#94a3b8`, `#475569`). No README uses a `<picture>` element or a theme-specific image variant. GitHub renders a referenced SVG as a static image, running no script in it and loading no external font, so a text element in it is drawn in whatever font the viewer's system supplies.

### How a file reaches a host tree

`scripts/build_hosts.py` writes a host tree from exactly three sources: `core/`'s four top-level directories through the definition's `[layout]`, every file in the definition directory other than `settings.toml` and those under `slots/` as a template rendered to the same relative path, and the root `LICENSE`, the one root file it copies into every tree. Nothing else shared reaches the trees, so a file needed in all three is today one copy per definition directory, kept in sync by hand as the three `traffic-badges.yml` copies are. A template that decodes as UTF-8, which an SVG does, has `{{VERSION}}` and `{{NAME}}` replaced and is scanned by the tree checks, `unfilled-placeholder` failing on any `{{` not preceded by `$` and `foreign-plugin-root` on another host's plugin-root literal; a file that is not UTF-8 is copied byte for byte and skipped by the checks. `--check` compares the committed trees byte for byte with a fresh render, in CI on every push and pull request and as a release pre-flight.

### Where a host tree goes

The Claude Code and Antigravity trees are the plugin itself (`plugin_dir` is empty, the Claude Code marketplace entry's `source` is `.`, and the Antigravity install extracts the whole repository archive into `~/.gemini/config/plugins/gurita`), so every file in them, the README included, is installed with the plugin. The Codex tree is a marketplace whose plugin sits under `plugins/gurita/`, so its root README is outside the installed plugin. Each release publishes the tree at `HEAD:hosts/<host>` verbatim as one commit into `uHappyLogic/gurita-<host>`, where the rendered README becomes that repository's landing page, so a path relative to that README resolves there only for a file the host tree itself carries. The host suite's prerequisite check compares each host's installed copy file for file with its plugin directory in the committed tree (`hosts/claude/`, `hosts/antigravity/`, `hosts/codex/plugins/gurita/`), and a change under `scripts/hosts/<host>/` is in that host's trigger set for the suite.

### Release state

`VERSION` reads 2.0.0, and the `Release: 2.0.0` commit (`8df0a529`, tagged `2.0.0` locally) is the latest release, made just before this mission was defined. A change to the root README shows on the source repository's page once pushed, while the three host pages change only when a release publishes the host trees. The release procedure's Release commit changes only version slots and the CHANGELOG entry, and its pre-flight requires every file under `core/` and `scripts/hosts/` to be committed and the committed trees to equal a fresh build.

### Record and in-flight work

One finished mission in the record bears on the goal, `mission_rename-cairn-to-gurita/` (finished 2026-11-18), which wrote the README's current opening: the title, the tagline drawn from the image of the arms and placed directly under the title, and the bare "(Indonesian for octopus)" gloss inside the pitch. It decided that the image of the arms is left to the tagline, that the name gets no section of its own, and that the three host READMEs change only by the plain rename, which is why they carry neither tagline nor gloss. `ideas/gurita.md`, the naming draft that mission carried out, records the image: an octopus has eight arms and no tentacles, "the plugin is the arms", and the English octopus vocabulary (octopus, octo-, tentacle, kraken) is ruled out as naming because Octopus Deploy uses it. No other mission is live, in this scope or any other.

### Known gaps

The banner does not exist in any form: there is no character drawing of the arms, no SVG, and no script or tool that turns character art into an SVG; `scripts/` holds only the host build and the version script, and the tooling project's one dependency is PyYAML. No test reads the content of the root README or of a host README template, so nothing pins their first element; `tests/test_build_rendering.py` renders a synthetic README template only.

## Decisions

### Banner delivery to host pages

One SVG is committed once in the source repository, at a root location such as an `assets/` directory, and the root README references it by a relative path. `scripts/build_hosts.py` is changed to copy that one file into every host tree at the tree root, beside the README, byte for byte as it copies the root `LICENSE`, and each host README template references its tree's copy by a relative path, so every page loads the banner from its own repository. No copy is kept by hand in a definition directory, and no README references the file by absolute URL. The build's tests are extended to cover the new copy, and `--check` holds every host copy equal to the one source file.

### Banner source of truth

The source of truth is a plain-text drawing of the arms, committed together with whatever colour mapping it needs. A new standalone script under `scripts/`, run by hand like `set_version.py`, reads the drawing and writes the SVG. The generated SVG is committed as derived output, never hand-edited, and is regenerated whenever the drawing changes.

### Art character set

The art uses only the 95 printable 7-bit ASCII characters (U+0020 to U+007E). The arms' curls are built from characters such as `/ \ | ( ) _ ~ ' . , o`, and no character outside that range appears anywhere in the drawing, so no box-drawing, block, or braille glyph is used.

### Light and dark themes

The banner is one SVG with no background fill, so the page shows through, and its violet and grey-blue colours are picked to keep enough contrast on both GitHub's white light background and its near-black dark background (`#0d1117`). Each README holds one plain image reference, with no `<picture>` element, no theme-specific variant, and no theme selection markup.

## Out of Scope

