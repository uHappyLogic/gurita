import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseTasks, readTaskList, TASK_LIST_NAME, TaskListError, tasksRemain } from '../tasks';

const REPOSITORY_FIXTURES = path.join(__dirname, '..', '..', '..', 'tests', 'fixtures');
const OWN_FIXTURES = path.join(__dirname, '..', '..', 'src', 'test', 'fixtures', 'tasks');

function ownText(name: string): string {
  return fs.readFileSync(path.join(OWN_FIXTURES, name), 'utf8');
}

/** The titles of a task list's text, in file order. */
function titles(text: string): string[] {
  return parseTasks(text).map((each) => each.title);
}

function refusal(text: string): string {
  try {
    parseTasks(text);
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

test('the repository fixture yields each heading with its brief in file order, a body separator line kept as brief text', () => {
  const tasks = parseTasks(fs.readFileSync(path.join(REPOSITORY_FIXTURES, 'task_list_todo.md'), 'utf8'));
  assert.deepStrictEqual(tasks, [
    {
      title: 'Build The Parser First',
      brief:
        'Write the parser that reads the whole file into its heading and sections, so every later write renders from one model. Verified by its round trip on the golden files.',
    },
    {
      title: 'Keep A Body Separator Line',
      brief:
        'A body may hold a separator line of its own that is not the section\'s end.\n\n---\n\nThe line above stays body text, because the next non-blank line is this prose rather than a heading.',
    },
    {
      title: 'Render Unicode — Text As Given',
      brief: 'Carry `code`, ${VAR}, $(cmd), &amp; entities, and "quotes" through untouched, including non-ASCII text like zażółć gęślą jaźń.',
    },
  ]);
  assert.strictEqual(tasksRemain(tasks), true);
});

test('a list holding only its heading leaves no task', () => {
  const tasks = parseTasks(ownText('empty.md'));
  assert.deepStrictEqual(tasks, []);
  assert.strictEqual(tasksRemain(tasks), false);
});

test('a brief is its section body with outer blank lines trimmed, ending at the separator or the next heading', () => {
  const text = [
    'Preamble text above the first section is no brief.',
    '## Terminated',
    '',
    '',
    'First line of the brief.',
    'Second line.',
    '',
    '- A list item',
    '',
    '',
    '---',
    '',
    '## Unterminated',
    'Brief straight under its heading.',
    '## Empty',
    '',
    '---',
    '',
    '## Last At The End',
    '',
    'Its brief runs to the end of the file.',
    '   ',
  ].join('\n');
  assert.deepStrictEqual(parseTasks(text), [
    { title: 'Terminated', brief: 'First line of the brief.\nSecond line.\n\n- A list item' },
    { title: 'Unterminated', brief: 'Brief straight under its heading.' },
    { title: 'Empty', brief: '' },
    { title: 'Last At The End', brief: 'Its brief runs to the end of the file.' },
  ]);
});

test('only column-0 "## " lines are headings, a fenced one included, their text trimmed', () => {
  assert.deepStrictEqual(titles(ownText('structure.md')), [
    'Fenced Heading Task',
    'Heading Inside A Fence',
    'Spaced Title',
  ]);
});

test('CRLF line ends are read as LF', () => {
  assert.deepStrictEqual(parseTasks('# TASKS TODO\r\n\r\n## One\r\n\r\nBrief.\r\nOn two lines.\r\n\r\n---\r\n## Two\r\n'), [
    { title: 'One', brief: 'Brief.\nOn two lines.' },
    { title: 'Two', brief: '' },
  ]);
});

test('a conflict-marker line makes the list unreadable', () => {
  assert.match(refusal(ownText('conflict.md')), /^TASKS_TODO\.md holds a merge-conflict marker at line 9: <<<<<<< HEAD$/);
  for (const marker of ['<<<<<<< ours', '=======', '>>>>>>> theirs']) {
    assert.match(refusal(`# TASKS TODO\n\n## One\n\nBrief.\n\n${marker}\n\n---\n`), /merge-conflict marker at line 7/);
  }
});

test('a marker away from column 0 is body text', () => {
  assert.deepStrictEqual(parseTasks('# TASKS TODO\n\n## One\n\n  =======\n and >>>>>>> mid-line\n\n---\n'), [
    { title: 'One', brief: '  =======\n and >>>>>>> mid-line' },
  ]);
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
    assert.deepStrictEqual(read.state === 'read' && read.tasks.map((each) => each.title), [
      'Build The Parser First',
      'Keep A Body Separator Line',
      'Render Unicode — Text As Given',
    ]);
    assert.strictEqual(read.state === 'read' && read.tasks[0].brief.startsWith('Write the parser'), true);

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
