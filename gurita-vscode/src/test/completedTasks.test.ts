import { test } from 'node:test';
import * as assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { TasksPrintError, parseCompletedTasks, readCompletedTasks } from '../completedTasks';

// The read of a mission's completed tasks, against its stated print and git fixtures run through
// the plugin's own missions tool.

const MISSIONS_TOOL = path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py');

const ALPHA = 'pkg/mission_alpha/';
const BETA = 'pkg/mission_beta/';

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { cwd, stdio: 'ignore' });
}

/** Commits every change in `root` under `message`, at the author date `date` when given. */
function commit(root: string, message: string, date?: string): void {
  git(root, 'add', '-A');
  const env = date === undefined ? process.env : { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date };
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-q', '-m', message], { cwd: root, stdio: 'ignore', env });
}

/** A git repository holding the given missions, each defined in a commit of its own. */
function project(...missions: string[]): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-completed-')));
  git(root, 'init', '-q');
  for (const mission of missions) {
    fs.mkdirSync(path.join(root, mission), { recursive: true });
    fs.writeFileSync(path.join(root, mission, 'requirements.md'), '# A mission\n\n## Goal\n\nA goal.\n');
    fs.writeFileSync(path.join(root, mission, 'open_questions.xml'), '<open-questions/>\n');
    fs.writeFileSync(path.join(root, mission, 'TASKS_TODO.md'), '# TASKS TODO\n');
    commit(root, `Mission-definition: ${mission}`);
  }
  return root;
}

/** Writes the task list of the mission at `mission` with one section per title. */
function taskList(root: string, mission: string, ...titles: string[]): void {
  const sections = titles.map((title) => `## ${title}\n\nA brief of ${title}.\n\n---\n`).join('\n');
  fs.writeFileSync(path.join(root, mission, 'TASKS_TODO.md'), `# TASKS TODO\n${sections === '' ? '' : `\n${sections}`}`);
}

test('the module imports nothing from vscode', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'completedTasks.ts'), 'utf8');
  assert.doesNotMatch(source, /from\s+['"]vscode['"]|require\(\s*['"]vscode['"]\s*\)/);
});

test('a print is read as one completed task per column-0 line, its indented body lines beneath it its verified bar', () => {
  const print = [
    `abc1234\t2026-11-24\t${ALPHA}\tSecond Task`,
    '    - The `second` criterion',
    '    ',
    '    - Another criterion',
    `def5678\t2026-11-23\t${ALPHA}\tBare Task`,
    '0123abc\t2026-11-22\t-\tFirst Task',
    '        - An indented line keeps its own indent',
    '',
  ].join('\n');
  assert.deepStrictEqual(parseCompletedTasks(print), [
    { hash: 'abc1234', date: '2026-11-24', mission: ALPHA, title: 'Second Task', bar: '- The `second` criterion\n\n- Another criterion' },
    { hash: 'def5678', date: '2026-11-23', mission: ALPHA, title: 'Bare Task', bar: '' },
    { hash: '0123abc', date: '2026-11-22', mission: '-', title: 'First Task', bar: '    - An indented line keeps its own indent' },
  ]);
  assert.deepStrictEqual(parseCompletedTasks(''), [], 'an empty print is no completed task');
  assert.deepStrictEqual(
    parseCompletedTasks(`abc1234\t2026-11-24\t${ALPHA}\tA Task\r\n    - A bar\r\n`),
    [{ hash: 'abc1234', date: '2026-11-24', mission: ALPHA, title: 'A Task', bar: '- A bar' }],
    'CRLF line endings are dropped',
  );
});

test('a print not in the stated form is refused with a message of its own', () => {
  assert.throws(() => parseCompletedTasks('    - A bar before any task\n'), TasksPrintError);
  assert.throws(() => parseCompletedTasks('abc1234\t2026-11-24\tA Task\n'), TasksPrintError);
  assert.throws(() => parseCompletedTasks(`abc1234\t\t${ALPHA}\tA Task\n`), TasksPrintError);
});

test("a mission's completed tasks are read from its Task-completion commits, newest first, each with its verified bar, and only its own", async () => {
  const root = project(ALPHA, BETA);
  assert.deepStrictEqual(await readCompletedTasks(root, MISSIONS_TOOL, ALPHA), { state: 'read', tasks: [] }, 'a fresh mission has no completed task');

  taskList(root, ALPHA, 'First Task', 'Second Task');
  taskList(root, BETA, 'Beta Task');
  commit(root, 'Task-derivation: both missions', '2026-11-20T10:00:00');
  taskList(root, ALPHA, 'Second Task');
  commit(root, 'Task-completion: First Task\n\n- The `first` criterion\n- Another criterion', '2026-11-21T10:00:00');
  taskList(root, BETA);
  commit(root, 'Task-completion: Beta Task\n\n- A criterion of beta', '2026-11-22T10:00:00');
  taskList(root, ALPHA);
  commit(root, 'Task-completion: Second Task', '2026-11-23T10:00:00');

  const read = await readCompletedTasks(root, MISSIONS_TOOL, ALPHA);
  assert.strictEqual(read.state, 'read');
  assert.deepStrictEqual(
    read.state === 'read' ? read.tasks.map(({ date, mission, title, bar }) => ({ date, mission, title, bar })) : [],
    [
      { date: '2026-11-23', mission: ALPHA, title: 'Second Task', bar: '' },
      { date: '2026-11-21', mission: ALPHA, title: 'First Task', bar: '- The `first` criterion\n- Another criterion' },
    ],
  );
  if (read.state === 'read') {
    for (const task of read.tasks) {
      assert.match(task.hash, /^[0-9a-f]{7,}$/, 'each carries its commit hash');
    }
  }
});

test('a read that fails carries its cause: the tool refusing the path, or python not starting', async () => {
  const root = project(ALPHA);
  const refused = await readCompletedTasks(root, MISSIONS_TOOL, 'pkg/mission_typo/');
  assert.strictEqual(refused.state, 'failed');
  assert.match(refused.state === 'failed' ? refused.cause : '', /^Error: /, "the tool's Error: line");
  const unstarted = await readCompletedTasks(root, MISSIONS_TOOL, ALPHA, path.join(root, 'no-python'));
  assert.strictEqual(unstarted.state, 'failed');
  assert.match(unstarted.state === 'failed' ? unstarted.cause : '', /ENOENT/);
});
