import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseTaskHeadings, readTaskList, TASK_LIST_NAME, TaskListError, tasksRemain } from '../tasks';

const REPOSITORY_FIXTURES = path.join(__dirname, '..', '..', '..', 'tests', 'fixtures');
const OWN_FIXTURES = path.join(__dirname, '..', '..', 'src', 'test', 'fixtures', 'tasks');

function ownText(name: string): string {
  return fs.readFileSync(path.join(OWN_FIXTURES, name), 'utf8');
}

function refusal(text: string): string {
  try {
    parseTaskHeadings(text);
  } catch (error) {
    assert.ok(error instanceof TaskListError, `not a TaskListError: ${error}`);
    return error.message;
  }
  assert.fail('the task list read');
}

test('the module imports nothing from vscode', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'tasks.ts'), 'utf8');
  assert.doesNotMatch(source, /from\s+['"]vscode['"]|require\(\s*['"]vscode['"]\s*\)/);
});

test('the repository fixture yields its headings in file order', () => {
  const headings = parseTaskHeadings(fs.readFileSync(path.join(REPOSITORY_FIXTURES, 'task_list_todo.md'), 'utf8'));
  assert.deepStrictEqual(headings, [
    'Build The Parser First',
    'Keep A Body Separator Line',
    'Render Unicode — Text As Given',
  ]);
  assert.strictEqual(tasksRemain(headings), true);
});

test('a list holding only its heading leaves no task', () => {
  const headings = parseTaskHeadings(ownText('empty.md'));
  assert.deepStrictEqual(headings, []);
  assert.strictEqual(tasksRemain(headings), false);
});

test('only column-0 "## " lines are headings, a fenced one included, their text trimmed', () => {
  assert.deepStrictEqual(parseTaskHeadings(ownText('structure.md')), [
    'Fenced Heading Task',
    'Heading Inside A Fence',
    'Spaced Title',
  ]);
});

test('CRLF line ends are read as LF', () => {
  assert.deepStrictEqual(parseTaskHeadings('# TASKS TODO\r\n\r\n## One\r\n\r\nBrief.\r\n\r\n---\r\n## Two\r\n'), ['One', 'Two']);
});

test('a conflict-marker line makes the list unreadable', () => {
  assert.match(refusal(ownText('conflict.md')), /^TASKS_TODO\.md holds a merge-conflict marker at line 9: <<<<<<< HEAD$/);
  for (const marker of ['<<<<<<< ours', '=======', '>>>>>>> theirs']) {
    assert.match(refusal(`# TASKS TODO\n\n## One\n\nBrief.\n\n${marker}\n\n---\n`), /merge-conflict marker at line 7/);
  }
});

test('a marker away from column 0 is body text', () => {
  assert.deepStrictEqual(parseTaskHeadings('# TASKS TODO\n\n## One\n\n  =======\n and >>>>>>> mid-line\n\n---\n'), ['One']);
});

test('readTaskList reports a read, a missing file, and an unreadable one', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-tasks-'));
  try {
    const file = path.join(directory, TASK_LIST_NAME);
    assert.deepStrictEqual(readTaskList(file), { state: 'missing', file });
    assert.deepStrictEqual(readTaskList(path.join(directory, 'absent', TASK_LIST_NAME)).state, 'missing');

    fs.copyFileSync(path.join(REPOSITORY_FIXTURES, 'task_list_todo.md'), file);
    const read = readTaskList(file);
    assert.strictEqual(read.state, 'read');
    assert.strictEqual(read.state === 'read' && read.headings.length, 3);

    fs.copyFileSync(path.join(OWN_FIXTURES, 'conflict.md'), file);
    const unreadable = readTaskList(file);
    assert.strictEqual(unreadable.state, 'unreadable');
    assert.match(unreadable.state === 'unreadable' ? unreadable.message : '', /merge-conflict marker at line 9/);

    const asDirectory = path.join(directory, 'list_is_a_directory');
    fs.mkdirSync(asDirectory);
    const failed = readTaskList(asDirectory);
    assert.strictEqual(failed.state, 'unreadable');
    assert.match(failed.state === 'unreadable' ? failed.message : '', /^TASKS_TODO\.md could not be read: /);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
