# TASKS TODO

## Add The Knowledge Tree Update Skill

Add a maintainer-only skill under `.claude/skills/`, outside `core/` so that no host renders it, opening with `name` and `description` frontmatter: one run finds its anchor in the log, the latest commit under the skill's own subject marker (with no anchor, the first run compares every node with its folder), updates in place the nodes of the folders changed since and the pointer notes above them, keeping every still-true sentence byte-identical, repairs every failure of the knowledge-tree check, re-compressing a node only as far as a budget failure forces, and commits under its marker, which moves the anchor. Verified by reading the skill step by step against the recorded update-skill decision, by `.claude/README.md` covering the new skill within its limits, and by the knowledge-tree check and both pytest runs passing.

---
