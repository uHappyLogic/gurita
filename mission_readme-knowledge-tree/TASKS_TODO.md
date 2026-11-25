# TASKS TODO

## Add The Knowledge Tree Check

Add a test under `tests/`, reading tracked files only so that it runs in both pytest runs, that fails when a pointer line's path or heading anchor does not resolve; when a tracked top-level folder, the root `mission_*/` directories left out, has neither a `README.md` node nor a description in the root; when a deeper `README.md` node is pointed at from neither its parent folder's node nor the nearest ancestor's; when the root `CLAUDE.md` exceeds 20,000 bytes, a `README.md` node 12,000 bytes, or a when-to-follow note 400 bytes; when the root, a node, or one of the root's folder descriptions holds a heading outside its allowed set and order; or when a tracked `.github/README.md` exists, that message naming GitHub's front-page precedence as the reason. Verified by each failure reproduced on a synthetic tree, by the test passing on the repository in both pytest runs with any node it fails repaired in the same task, and by the nodes covering the check stating it within their limits.

---

## Add The Knowledge Tree Update Skill

Add a maintainer-only skill under `.claude/skills/`, outside `core/` so that no host renders it, opening with `name` and `description` frontmatter: one run finds its anchor in the log, the latest commit under the skill's own subject marker (with no anchor, the first run compares every node with its folder), updates in place the nodes of the folders changed since and the pointer notes above them, keeping every still-true sentence byte-identical, repairs every failure of the knowledge-tree check, re-compressing a node only as far as a budget failure forces, and commits under its marker, which moves the anchor. Verified by reading the skill step by step against the recorded update-skill decision, by `.claude/README.md` covering the new skill within its limits, and by the knowledge-tree check and both pytest runs passing.

---
