import { test } from 'node:test';
import * as assert from 'node:assert';
import { MissionDocuments, documentFacts } from '../documents';
import { LiveMission } from '../live';
import { GIT_READ_FAILED, UNREAD, missionRow } from '../missionRows';
import { Question } from '../questions';
import { MissionWorkflow } from '../workflow';

const MISSION: LiveMission = { path: 'lib/mission_alpha/', state: 'started', title: 'Alpha mission' };

function question(id: string): Question {
  return { id, question: `${id}?`, principles: [], dependsOn: [], alternatives: [] };
}

/** A mission's documents out of its question part and its task part, with the facts that follow. */
function documents(questions: MissionDocuments['questions'], tasks: MissionDocuments['tasks']): MissionDocuments {
  return { questions, tasks, facts: documentFacts(questions, tasks) };
}

const QUESTIONS_MISSING: MissionDocuments['questions'] = {
  state: 'failed',
  notice: { file: 'lib/mission_alpha/open_questions.xml', reason: 'missing' },
};
const TASKS_UNPARSABLE: MissionDocuments['tasks'] = {
  state: 'failed',
  notice: { file: 'lib/mission_alpha/TASKS_TODO.md', reason: 'unparsable', message: 'TASKS_TODO.md holds a merge-conflict marker at line 3: =======' },
};

test('a row reads its label from the title and its description from the step and both counts, in the compact form', () => {
  const read = documents({ state: 'read', questions: [question('A'), question('B'), question('C')] }, { state: 'read', headings: ['One', 'Two'] });
  const workflow: MissionWorkflow = { step: 'derive', defaultPane: 'questions' };
  const row = missionRow(MISSION, read, workflow, false);
  assert.strictEqual(row.path, MISSION.path);
  assert.strictEqual(row.label, 'Alpha mission');
  assert.strictEqual(row.description, 'Derive tasks · 3 questions · 2 tasks');
  assert.strictEqual(row.running, false);
  assert.strictEqual(
    row.tooltip,
    ['Alpha mission', 'lib/mission_alpha/', 'Next step: Derive tasks', 'Open questions: 3', 'Remaining tasks: 2', 'Run: not going'].join('\n'),
  );
});

test('a count of one takes the singular, a count of none stays a zero, and a going run is spelled out in the tooltip', () => {
  const read = documents({ state: 'read', questions: [question('A')] }, { state: 'read', headings: [] });
  const row = missionRow(MISSION, read, { step: 'first-review', defaultPane: 'questions' }, true);
  assert.strictEqual(row.description, 'First review round · 1 question · 0 tasks');
  assert.strictEqual(row.running, true);
  assert.ok(row.tooltip.endsWith('\nRun: going'));
  const one = missionRow(MISSION, documents({ state: 'read', questions: [] }, { state: 'read', headings: ['Only'] }), { step: 'execute', defaultPane: 'tasks' }, false);
  assert.strictEqual(one.description, 'Execute tasks · 0 questions · 1 task');
});

test('a missing question document puts the placeholder in the step and question slots alone, its hover text naming the file', () => {
  const read = documents(QUESTIONS_MISSING, { state: 'read', headings: ['One', 'Two'] });
  const row = missionRow(MISSION, read, { defaultPane: 'questions' }, false);
  assert.strictEqual(row.description, `${UNREAD} · ${UNREAD} questions · 2 tasks`);
  assert.strictEqual(
    row.tooltip,
    [
      'Alpha mission',
      'lib/mission_alpha/',
      'Next step: not read (lib/mission_alpha/open_questions.xml is missing)',
      'Open questions: not read (lib/mission_alpha/open_questions.xml is missing)',
      'Remaining tasks: 2',
      'Run: not going',
    ].join('\n'),
  );
});

test('an unparsable task list with no question open puts the placeholder in the step and task slots, its hover text naming the file', () => {
  const read = documents({ state: 'read', questions: [] }, TASKS_UNPARSABLE);
  const row = missionRow(MISSION, read, { defaultPane: 'questions' }, false);
  assert.strictEqual(row.description, `${UNREAD} · 0 questions · ${UNREAD} tasks`);
  const cause = 'lib/mission_alpha/TASKS_TODO.md does not parse: TASKS_TODO.md holds a merge-conflict marker at line 3: =======';
  assert.ok(row.tooltip.includes(`\nNext step: not read (${cause})\n`), row.tooltip);
  assert.ok(row.tooltip.includes(`\nRemaining tasks: not read (${cause})\n`), row.tooltip);
  assert.ok(row.tooltip.includes('\nOpen questions: 0\n'), row.tooltip);
});

test('an unparsable task list beside an open question leaves the step drawn and only the task slot unread', () => {
  const read = documents({ state: 'read', questions: [question('A'), question('B')] }, TASKS_UNPARSABLE);
  const row = missionRow(MISSION, read, { step: 'first-review', defaultPane: 'questions' }, false);
  assert.strictEqual(row.description, `First review round · 2 questions · ${UNREAD} tasks`);
});

test('a step left unchosen with every document read is a failed git read, named as such, the counts drawn as usual', () => {
  const read = documents({ state: 'read', questions: [question('A')] }, { state: 'read', headings: [] });
  const row = missionRow(MISSION, read, { defaultPane: 'questions' }, false);
  assert.strictEqual(row.description, `${UNREAD} · 1 question · 0 tasks`);
  assert.ok(row.tooltip.includes(`\nNext step: not read (${GIT_READ_FAILED})\n`), row.tooltip);
});
