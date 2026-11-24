import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { documentFacts, readMissionDocuments } from '../documents';

const REPOSITORY_FIXTURES = path.join(__dirname, '..', '..', '..', 'tests', 'fixtures');
const OWN_FIXTURES = path.join(__dirname, '..', '..', 'src', 'test', 'fixtures');
const MISSION = 'lib/mission_alpha/';

/** A project root holding one mission directory with the given documents, `undefined` left out. */
function project(questions: string | undefined, tasks: string | undefined): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-documents-'));
  const dir = path.join(root, MISSION);
  fs.mkdirSync(dir, { recursive: true });
  if (questions !== undefined) {
    fs.writeFileSync(path.join(dir, 'open_questions.xml'), questions);
  }
  if (tasks !== undefined) {
    fs.writeFileSync(path.join(dir, 'TASKS_TODO.md'), tasks);
  }
  return root;
}

function repositoryText(...parts: string[]): string {
  return fs.readFileSync(path.join(REPOSITORY_FIXTURES, ...parts), 'utf8');
}

function ownText(...parts: string[]): string {
  return fs.readFileSync(path.join(OWN_FIXTURES, ...parts), 'utf8');
}

const TASKS = '# TASKS TODO\n\n## First Task\n\nA brief.\n\n---\n\n## Second Task\n\nAnother `brief`.\n\n- With a list\n\n---\n';
const REMAINING = [
  { title: 'First Task', brief: 'A brief.' },
  { title: 'Second Task', brief: 'Another `brief`.\n\n- With a list' },
];

test('the module imports nothing from vscode', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'documents.ts'), 'utf8');
  assert.doesNotMatch(source, /from\s+['"]vscode['"]|require\(\s*['"]vscode['"]\s*\)/);
});

test('both documents read: every block whole, each task with its brief, and every document fact', () => {
  const read = readMissionDocuments(project(repositoryText('annotated', 'open_questions.xml'), TASKS), MISSION);
  assert.strictEqual(read.questions.state, 'read');
  assert.ok(read.questions.state === 'read' && read.questions.questions.length > 0);
  assert.deepStrictEqual(read.tasks, { state: 'read', remaining: REMAINING });
  assert.strictEqual(read.facts.questionsEmpty, false);
  assert.strictEqual(read.facts.tasksRemain, true);
  assert.strictEqual(typeof read.facts.lacksAlternatives, 'boolean');
  assert.strictEqual(typeof read.facts.lacksPick, 'boolean');
});

test('the document facts follow the blocks lacking alternatives or a pick', () => {
  const bare = readMissionDocuments(project(repositoryText('bare', 'open_questions.xml'), '# TASKS TODO\n'), MISSION);
  assert.deepStrictEqual(bare.facts, { lacksAlternatives: true, lacksPick: true, questionsEmpty: false, tasksRemain: false });

  const picked = readMissionDocuments(
    project(
      '<open-questions>\n  <open-question id="A">\n    <question>Q?</question>\n    <recommendation option="X">Why.</recommendation>\n    <alternative id="X">It.<advantage>Good.</advantage><drawback>Bad.</drawback></alternative>\n  </open-question>\n</open-questions>\n',
      TASKS,
    ),
    MISSION,
  );
  assert.deepStrictEqual(picked.facts, { lacksAlternatives: false, lacksPick: false, questionsEmpty: false, tasksRemain: true });
});

test('an empty question document reads as the empty question list', () => {
  const read = readMissionDocuments(project('<open-questions/>\n', TASKS), MISSION);
  assert.deepStrictEqual(read.questions, { state: 'read', questions: [] });
  assert.deepStrictEqual(read.facts, { lacksAlternatives: false, lacksPick: false, questionsEmpty: true, tasksRemain: true });
});

test('a missing question document yields its notice and leaves the task part and fact drawn', () => {
  const read = readMissionDocuments(project(undefined, TASKS), MISSION);
  assert.deepStrictEqual(read.questions, {
    state: 'failed',
    notice: { file: 'lib/mission_alpha/open_questions.xml', reason: 'missing' },
  });
  assert.deepStrictEqual(read.tasks, { state: 'read', remaining: REMAINING });
  assert.deepStrictEqual(read.facts, { tasksRemain: true });
});

test('a question document with conflict markers yields its notice with the parser message', () => {
  const read = readMissionDocuments(project(ownText('questions', 'conflict.xml'), TASKS), MISSION);
  assert.strictEqual(read.questions.state, 'failed');
  if (read.questions.state === 'failed') {
    assert.strictEqual(read.questions.notice.file, 'lib/mission_alpha/open_questions.xml');
    assert.strictEqual(read.questions.notice.reason, 'unparsable');
    assert.match(read.questions.notice.message ?? '', /merge-conflict marker at line 2/);
  }
  assert.deepStrictEqual(read.facts, { tasksRemain: true });
});

test('a malformed question document yields the parser message verbatim', () => {
  const read = readMissionDocuments(project(ownText('questions', 'malformed.xml'), TASKS), MISSION);
  assert.ok(read.questions.state === 'failed');
  assert.match(read.questions.notice.message ?? '', /^open_questions\.xml/);
});

test('a missing task list yields its notice and leaves the question part and facts drawn', () => {
  const read = readMissionDocuments(project('<open-questions/>\n', undefined), MISSION);
  assert.deepStrictEqual(read.tasks, {
    state: 'failed',
    notice: { file: 'lib/mission_alpha/TASKS_TODO.md', reason: 'missing' },
  });
  assert.deepStrictEqual(read.facts, { lacksAlternatives: false, lacksPick: false, questionsEmpty: true });
});

test('a task list with conflict markers yields its notice with the reader message', () => {
  const read = readMissionDocuments(project('<open-questions/>\n', ownText('tasks', 'conflict.md')), MISSION);
  assert.ok(read.tasks.state === 'failed');
  assert.strictEqual(read.tasks.notice.reason, 'unparsable');
  assert.match(read.tasks.notice.message ?? '', /TASKS_TODO\.md holds a merge-conflict marker/);
  assert.strictEqual(read.facts.tasksRemain, undefined);
});

test('both documents failing leave no document fact from either', () => {
  const read = readMissionDocuments(project(undefined, undefined), MISSION);
  assert.deepStrictEqual(read.facts, {});
  assert.deepStrictEqual(documentFacts(read.questions, read.tasks), {});
});

test('the introduction carries the title and goal of the requirements file, which leaves every other part and fact as it is', () => {
  const root = project('<open-questions/>\n', TASKS);
  fs.writeFileSync(path.join(root, MISSION, 'requirements.md'), '# Alpha  mission\n\n## Goal\n\nShip `alpha`.\n\n- One\n\n## Decisions\n');
  const read = readMissionDocuments(root, MISSION);
  assert.deepStrictEqual(read.introduction, { state: 'read', title: 'Alpha mission', goal: 'Ship `alpha`.\n\n- One' });
  assert.deepStrictEqual(read.tasks, { state: 'read', remaining: REMAINING });
  assert.deepStrictEqual(read.facts, { lacksAlternatives: false, lacksPick: false, questionsEmpty: true, tasksRemain: true });
});

test('a missing requirements file yields its notice in the introduction and leaves the other parts drawn', () => {
  const read = readMissionDocuments(project('<open-questions/>\n', TASKS), MISSION);
  assert.deepStrictEqual(read.introduction, {
    state: 'failed',
    notice: { file: 'lib/mission_alpha/requirements.md', reason: 'missing' },
  });
  assert.deepStrictEqual(read.questions, { state: 'read', questions: [] });
  assert.deepStrictEqual(read.tasks, { state: 'read', remaining: REMAINING });
});
