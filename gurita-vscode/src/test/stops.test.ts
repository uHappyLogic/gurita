import { test } from 'node:test';
import * as assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { readGate, readMissionFileChanges, readMissionStops } from '../stops';

// The reads of what would stop a run of a mission, against git fixtures and the plugin's own
// missions tool.

const MISSIONS_TOOL = path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py');

const ALPHA = 'pkg/mission_alpha/';
const BETA = 'pkg/mission_beta/';
const NESTED = 'pkg/sub/mission_nested/';
const APART = 'other/mission_apart/';

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { cwd, stdio: 'ignore' });
}

/** A git repository holding the given missions, each defined in a commit of its own. */
function project(...missions: string[]): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-stops-')));
  git(root, 'init', '-q');
  for (const mission of missions) {
    fs.mkdirSync(path.join(root, mission), { recursive: true });
    fs.writeFileSync(path.join(root, mission, 'requirements.md'), '# A mission\n\n## Goal\n\nA goal.\n');
    fs.writeFileSync(path.join(root, mission, 'open_questions.xml'), '<open-questions/>\n');
    fs.writeFileSync(path.join(root, mission, 'TASKS_TODO.md'), '# TASKS TODO\n');
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', `Mission-definition: ${mission}`);
  }
  return root;
}

/** Starts the mission at `mission` as the plugin does: a committed task entry into its task list. */
function start(root: string, mission: string): void {
  fs.writeFileSync(path.join(root, mission, 'TASKS_TODO.md'), '# TASKS TODO\n\n## A task\n\nA brief.\n\n---\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', `Task-derivation: ${mission}`);
}

test('the module imports nothing from vscode', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'stops.ts'), 'utf8');
  assert.doesNotMatch(source, /from\s+['"]vscode['"]|require\(\s*['"]vscode['"]\s*\)/);
});

test('the scope gate is free while no other started mission holds the scope', async () => {
  const root = project(ALPHA, BETA);
  assert.deepStrictEqual(await readGate(root, MISSIONS_TOOL, BETA), { state: 'free' }, 'a defined sibling holds nothing');
  start(root, BETA);
  assert.deepStrictEqual(await readGate(root, MISSIONS_TOOL, BETA), { state: 'free' }, 'a started mission does not hold its own scope');
});

test('the scope gate is held by every other started mission whose scope equals, contains, or lies under this one, by the paths it printed', async () => {
  const root = project(ALPHA, BETA, NESTED, APART);
  start(root, ALPHA);
  assert.deepStrictEqual(await readGate(root, MISSIONS_TOOL, BETA), { state: 'held', holders: [ALPHA] }, 'a started sibling in the same scope holds it');
  start(root, NESTED);
  assert.deepStrictEqual(await readGate(root, MISSIONS_TOOL, BETA), { state: 'held', holders: [ALPHA, NESTED] }, 'a started mission under the scope holds it too');
  assert.deepStrictEqual(await readGate(root, MISSIONS_TOOL, APART), { state: 'free' }, 'a disjoint scope is never held');
});

test('the scope gate is held only while the holder stands: its directory removed by its finish frees the scope', async () => {
  const root = project(ALPHA, BETA);
  start(root, ALPHA);
  assert.strictEqual((await readGate(root, MISSIONS_TOOL, BETA)).state, 'held');
  git(root, 'rm', '-r', '-q', ALPHA);
  git(root, 'commit', '-q', '-m', `Mission-finish: ${ALPHA}`);
  assert.deepStrictEqual(await readGate(root, MISSIONS_TOOL, BETA), { state: 'free' });
});

test("a gate that cannot check is not checked, carrying the tool's Error line or the spawn error", async () => {
  const root = project(ALPHA);
  const refused = await readGate(root, MISSIONS_TOOL, 'pkg/alpha/');
  assert.strictEqual(refused.state, 'unchecked', 'a path naming no mission_ directory is refused by the gate');
  assert.match((refused as { cause: string }).cause, /^Error: /);

  const tool = path.join(root, 'printing.py');
  fs.writeFileSync(tool, 'import sys\nsys.stderr.write("a warning\\n")\n');
  assert.deepStrictEqual(await readGate(root, tool, ALPHA), { state: 'unchecked', cause: 'a warning' }, 'anything on stderr closes the gate, even on exit 0');

  const missing = await readGate(root, MISSIONS_TOOL, ALPHA, 'gurita-no-such-python');
  assert.strictEqual(missing.state, 'unchecked');
  assert.match((missing as { cause: string }).cause, /spawn gurita-no-such-python ENOENT/);
});

test("the mission files' changes are the porcelain lines of requirements.md and open_questions.xml alone, staged, unstaged, and untracked alike", async () => {
  const root = project(ALPHA, BETA);
  assert.deepStrictEqual(await readMissionFileChanges(root, ALPHA), [], 'a clean mission holds no change');

  fs.writeFileSync(path.join(root, ALPHA, 'TASKS_TODO.md'), '# TASKS TODO\n\n## Edited\n\nA brief.\n\n---\n');
  fs.writeFileSync(path.join(root, BETA, 'requirements.md'), '# Beta edited\n');
  fs.writeFileSync(path.join(root, ALPHA, 'notes.txt'), 'unrelated\n');
  assert.deepStrictEqual(await readMissionFileChanges(root, ALPHA), [], "the task list, another mission's files, and other files count for nothing");

  fs.writeFileSync(path.join(root, ALPHA, 'requirements.md'), '# A mission\n\n## Goal\n\nAn edited goal.\n');
  assert.deepStrictEqual(await readMissionFileChanges(root, ALPHA), [` M ${ALPHA}requirements.md`], 'an unstaged edit counts');

  fs.writeFileSync(path.join(root, ALPHA, 'open_questions.xml'), '<open-questions>\n</open-questions>\n');
  git(root, 'add', `${ALPHA}open_questions.xml`);
  assert.deepStrictEqual(
    await readMissionFileChanges(root, ALPHA),
    [`M  ${ALPHA}open_questions.xml`, ` M ${ALPHA}requirements.md`],
    'a staged change counts beside it',
  );

  git(root, 'commit', '-q', '-m', 'commit both', '--', `${ALPHA}open_questions.xml`, `${ALPHA}requirements.md`);
  assert.deepStrictEqual(await readMissionFileChanges(root, ALPHA), [], 'committing the changes clears them');

  const fresh = project();
  fs.mkdirSync(path.join(fresh, ALPHA), { recursive: true });
  fs.writeFileSync(path.join(fresh, ALPHA, 'requirements.md'), '# Untracked\n');
  assert.deepStrictEqual(await readMissionFileChanges(fresh, ALPHA), [`?? ${ALPHA}requirements.md`], 'an untracked file counts');
});

test('a git read that fails reads as unknown', async () => {
  const outside = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-stops-none-')));
  assert.strictEqual(await readMissionFileChanges(outside, ALPHA), undefined);
  assert.strictEqual(await readMissionFileChanges(project(ALPHA), ALPHA, 'gurita-no-such-git'), undefined);
});

test('both conditions are read at once, the changes left out when git does not read', async () => {
  const root = project(ALPHA, BETA);
  assert.deepStrictEqual(await readMissionStops(root, MISSIONS_TOOL, BETA), { gate: { state: 'free' }, changes: [] });
  start(root, ALPHA);
  fs.writeFileSync(path.join(root, BETA, 'requirements.md'), '# Edited\n');
  assert.deepStrictEqual(await readMissionStops(root, MISSIONS_TOOL, BETA), {
    gate: { state: 'held', holders: [ALPHA] },
    changes: [` M ${BETA}requirements.md`],
  });
  const read = await readMissionStops(root, MISSIONS_TOOL, BETA, 'python3', 'gurita-no-such-git');
  assert.deepStrictEqual(read, { gate: { state: 'held', holders: [ALPHA] } });
});
