import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  NO_SINGLE_TASK_LINE_CAUSE,
  PreviewPrintError,
  RULE_FILE_NAME,
  loopArguments,
  parsePreview,
  previewArguments,
  ruleFile,
  runOverrides,
  runPreview,
  singleTaskLines,
} from '../loop';
import { mergeRecipes, parseOwnRecipes, parseShippedRecipes } from '../recipes';

const FIXTURES = path.join(__dirname, '..', '..', 'src', 'test', 'fixtures', 'recipes');
const SHIPPED = path.join(FIXTURES, 'shipped.md');
const OWN = path.join(FIXTURES, 'own.md');
const RUNNER = path.join(__dirname, '..', '..', 'runner.py');

const HIGH = { name: 'Single task high', line: 'claude -p "/gurita:complete-task --mission <path> <Task Title>" --effort high;' };
const XHIGH = { name: 'Single task xhigh', line: 'claude -p "/gurita:complete-task --mission <path> <Task Title>" --effort xhigh;' };

/** A project root holding one mission with two remaining tasks, and the rule file when given. */
function project(rules?: string): { root: string; mission: string } {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-loop-')));
  const mission = 'mission_alpha/';
  fs.mkdirSync(path.join(root, mission));
  fs.writeFileSync(
    path.join(root, mission, 'TASKS_TODO.md'),
    '# TASKS TODO\n\n## Fix the parser\n\nThe parser drops a line.\n\n---\n\n## Write the README\n\nDocument the build.\n\n---\n',
  );
  if (rules !== undefined) {
    fs.writeFileSync(path.join(root, RULE_FILE_NAME), rules);
  }
  return { root, mission };
}

test('the module imports nothing from vscode', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'loop.ts'), 'utf8');
  assert.doesNotMatch(source, /from\s+['"]vscode['"]|require\(\s*['"]vscode['"]\s*\)/);
});

test('the rule file stands directly in the project root as task_line_rules.txt', () => {
  assert.strictEqual(RULE_FILE_NAME, 'task_line_rules.txt');
  assert.strictEqual(ruleFile('/srv/project'), path.join('/srv/project', 'task_line_rules.txt'));
});

test('the named single-task lines are every recipe the recognition test passes, in the merged order', () => {
  const shipped = parseShippedRecipes(fs.readFileSync(SHIPPED, 'utf8'), SHIPPED);
  const own = parseOwnRecipes(fs.readFileSync(OWN, 'utf8'), OWN);
  assert.deepStrictEqual(singleTaskLines(mergeRecipes(shipped, own)), [
    { name: 'Single task (Claude Code)', line: 'claude -p "/gurita:complete-task --mission <path> <Task Title>" --model "opus" --effort high;' },
    { name: 'Single task (Antigravity)', line: "codex exec '$gurita:complete-task --mission <path> <Task Title>';" },
  ]);
});

test('a preview print yields its tasks in the order printed, a title keeping any tab it holds', () => {
  assert.deepStrictEqual(parsePreview('resolved\tHigh\tFirst task\nmissing\tGone\tSecond\ttask\r\nmissing\t\tThird\n'), [
    { state: 'resolved', name: 'High', title: 'First task' },
    { state: 'missing', name: 'Gone', title: 'Second\ttask' },
    { state: 'missing', name: '', title: 'Third' },
  ]);
  assert.deepStrictEqual(parsePreview(''), []);
  assert.throws(() => parsePreview('unknown\tHigh\tTask\n'), PreviewPrintError);
  assert.throws(() => parsePreview('resolved\tHigh\n'), PreviewPrintError);
});

test('the preview and loop command lines follow the runner subcommands, the recipe lines last after --', () => {
  assert.deepStrictEqual(previewArguments('/x/runner.py', 'mission_a/', '/p/task_line_rules.txt', [HIGH, XHIGH]), [
    '/x/runner.py', 'preview', '--mission', 'mission_a/', '--rules', '/p/task_line_rules.txt',
    '--line', HIGH.name, HIGH.line, '--line', XHIGH.name, XHIGH.line,
  ]);
  assert.deepStrictEqual(
    loopArguments('/x/runner.py', 'mission_a/', '/p/task_line_rules.txt', [HIGH, XHIGH], [['Fix the parser', XHIGH.name]], [
      '-v starts with a dash',
      '<single-task line>',
    ]),
    [
      '/x/runner.py', 'loop', '--mission', 'mission_a/', '--rules', '/p/task_line_rules.txt',
      '--line', HIGH.name, HIGH.line, '--line', XHIGH.name, XHIGH.line,
      '--override', 'Fix the parser', XHIGH.name,
      '--', '-v starts with a dash', '<single-task line>',
    ],
  );
});

test('an override is passed only when it names a named single-task line', () => {
  assert.deepStrictEqual(runOverrides({ 'Fix the parser': XHIGH.name, 'Write the README': 'No such line' }, [HIGH, XHIGH]), [
    ['Fix the parser', XHIGH.name],
  ]);
});

test('a preview with rules resolves each task by the runner and carries no notice', async () => {
  const { root, mission } = project(`\\bparser\\b -> ${XHIGH.name}\n* -> ${HIGH.name}\n`);
  assert.deepStrictEqual(await runPreview(RUNNER, root, mission, [HIGH, XHIGH]), {
    state: 'read',
    tasks: [
      { state: 'resolved', name: XHIGH.name, title: 'Fix the parser' },
      { state: 'resolved', name: HIGH.name, title: 'Write the README' },
    ],
  });
});

test('a rule naming no named line leaves its task missing, naming the missing line', async () => {
  const { root, mission } = project(`* -> Single task gone\n`);
  const read = await runPreview(RUNNER, root, mission, [HIGH]);
  assert.ok(read.state === 'read');
  assert.deepStrictEqual(read.tasks.map((task) => [task.state, task.name]), [
    ['missing', 'Single task gone'],
    ['missing', 'Single task gone'],
  ]);
});

test('a missing rule file lists every task unresolved, the notice naming the path looked for', async () => {
  const { root, mission } = project();
  const read = await runPreview(RUNNER, root, mission, [HIGH]);
  assert.ok(read.state === 'read');
  assert.deepStrictEqual(read.tasks.map((task) => [task.state, task.name, task.title]), [
    ['missing', '', 'Fix the parser'],
    ['missing', '', 'Write the README'],
  ]);
  assert.strictEqual(read.notice, `No rule file stands at ${path.join(root, RULE_FILE_NAME)}; no task is assigned a line.`);
});

test('an unreadable rule file lists every task unresolved, the notice giving each line number and reason', async () => {
  const { root, mission } = project(`# a comment\n( -> ${HIGH.name}\nno arrow here\n* -> ${HIGH.name}\n`);
  const read = await runPreview(RUNNER, root, mission, [HIGH]);
  assert.ok(read.state === 'read');
  assert.deepStrictEqual(read.tasks.map((task) => task.state), ['missing', 'missing']);
  const notice = (read.notice ?? '').split('\n');
  assert.strictEqual(notice[0], `Rule file refused: ${path.join(root, RULE_FILE_NAME)}`);
  assert.match(notice[1], /^line 2: the pattern is not a valid regular expression/);
  assert.strictEqual(notice[2], "line 3: no ' -> ' between a pattern and a line name");
  assert.strictEqual(notice.length, 3);
});

test('a task list that cannot be read fails the preview with the runner Error line', async () => {
  const { root } = project();
  const read = await runPreview(RUNNER, root, 'mission_none/', [HIGH]);
  assert.ok(read.state === 'failed');
  assert.match(read.cause, /^Error: cannot read the task list/);
});

test('a preview with no named single-task line runs nothing and says why', async () => {
  const { root, mission } = project();
  assert.deepStrictEqual(await runPreview(RUNNER, root, mission, []), { state: 'failed', cause: NO_SINGLE_TASK_LINE_CAUSE });
});

test('a spawn error fails the preview with the error itself', async () => {
  const { root, mission } = project();
  const read = await runPreview(RUNNER, root, mission, [HIGH], path.join(root, 'no-such-python'));
  assert.ok(read.state === 'failed');
  assert.match(read.cause, /ENOENT/);
});
