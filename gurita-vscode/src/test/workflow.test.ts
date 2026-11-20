import { test } from 'node:test';
import * as assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DocumentFacts } from '../documents';
import { WORKFLOW_STEPS, holdsReviewSubject, missionStep, needsReviewRead, nextStep, reviewCommitted } from '../workflow';

const MISSION = 'lib/mission_alpha/';

/** Facts of a question document holding questions, as the document reader gives them. */
function open(lacksAlternatives: boolean, lacksPick: boolean, tasksRemain?: boolean): DocumentFacts {
  return { lacksAlternatives, lacksPick, questionsEmpty: false, ...(tasksRemain === undefined ? {} : { tasksRemain }) };
}

/** Facts of an empty question document, the task list read or not. */
function empty(tasksRemain?: boolean): DocumentFacts {
  return { lacksAlternatives: false, lacksPick: false, questionsEmpty: true, ...(tasksRemain === undefined ? {} : { tasksRemain }) };
}

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { cwd, stdio: 'ignore' });
}

/** A git repository whose commits carry the given messages, one empty commit each. */
function repository(...messages: string[]): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-workflow-')));
  git(root, 'init', '-q');
  for (const message of messages) {
    git(root, 'commit', '-q', '--allow-empty', '-m', message);
  }
  return root;
}

test('the module imports nothing from vscode', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'workflow.ts'), 'utf8');
  assert.doesNotMatch(source, /from\s+['"]vscode['"]|require\(\s*['"]vscode['"]\s*\)/);
});

test('the diagram holds the eight blocks in flow order, finish after complete', () => {
  assert.deepStrictEqual([...WORKFLOW_STEPS], ['define', 'review', 'alternatives', 'recommend', 'answer', 'derive', 'complete', 'finish']);
});

test('a question lacking alternatives makes provide alternatives the step', () => {
  assert.strictEqual(nextStep('started', open(true, true, false)), 'alternatives');
  assert.strictEqual(nextStep('defined', open(true, false, false)), 'alternatives');
});

test('every question with alternatives and one lacking a pick makes recommend the step', () => {
  assert.strictEqual(nextStep('defined', open(false, true, false)), 'recommend');
});

test('every question carrying a pick makes answer the step', () => {
  assert.strictEqual(nextStep('defined', open(false, false, false)), 'answer');
});

test('an open question outranks a remaining task', () => {
  assert.strictEqual(nextStep('started', open(true, true, true)), 'alternatives');
  assert.strictEqual(nextStep('started', open(false, true, true)), 'recommend');
  assert.strictEqual(nextStep('started', open(false, false, true)), 'answer');
});

test('no open question and tasks remaining make complete the step', () => {
  assert.strictEqual(nextStep('started', empty(true)), 'complete');
});

test('a started mission with no open question and no task makes finish the step', () => {
  assert.strictEqual(nextStep('started', empty(false)), 'finish');
  assert.strictEqual(nextStep('started', empty(false), false), 'finish');
});

test('a defined mission with neither makes derive the step once a review commit stands, review otherwise', () => {
  assert.strictEqual(nextStep('defined', empty(false), true), 'derive');
  assert.strictEqual(nextStep('defined', empty(false), false), 'review');
});

test('no step is chosen when a document the choice needs did not read', () => {
  assert.strictEqual(nextStep('started', {}), undefined);
  assert.strictEqual(nextStep('started', { tasksRemain: true }), undefined);
  assert.strictEqual(nextStep('started', empty()), undefined);
  assert.strictEqual(nextStep('defined', empty(), true), undefined);
});

test('a task list that did not read leaves an open question its step', () => {
  assert.strictEqual(nextStep('started', open(true, true)), 'alternatives');
  assert.strictEqual(nextStep('started', open(false, false)), 'answer');
});

test('no step is chosen for a defined mission with neither when the git read failed', () => {
  assert.strictEqual(nextStep('defined', empty(false)), undefined);
});

test('only a defined mission with no open question and no task needs the review read', () => {
  assert.strictEqual(needsReviewRead('defined', empty(false)), true);
  assert.strictEqual(needsReviewRead('started', empty(false)), false);
  assert.strictEqual(needsReviewRead('defined', empty(true)), false);
  assert.strictEqual(needsReviewRead('defined', open(false, false, false)), false);
  assert.strictEqual(needsReviewRead('defined', empty()), false);
  assert.strictEqual(needsReviewRead('defined', {}), false);
});

test('the step choice reads git only when it needs the review commit', async () => {
  let reads = 0;
  const reviewed = (value: boolean | undefined) => async () => {
    reads += 1;
    return value;
  };
  assert.strictEqual(await missionStep('started', empty(true), reviewed(true)), 'complete');
  assert.strictEqual(await missionStep('started', empty(false), reviewed(true)), 'finish');
  assert.strictEqual(await missionStep('defined', open(true, true, false), reviewed(true)), 'alternatives');
  assert.strictEqual(reads, 0);
  assert.strictEqual(await missionStep('defined', empty(false), reviewed(true)), 'derive');
  assert.strictEqual(await missionStep('defined', empty(false), reviewed(false)), 'review');
  assert.strictEqual(await missionStep('defined', empty(false), reviewed(undefined)), undefined);
  assert.strictEqual(reads, 3);
});

test('a review subject matches only the mission path exactly', () => {
  assert.strictEqual(holdsReviewSubject(`Requirements-review: ${MISSION}\n`, MISSION), true);
  assert.strictEqual(holdsReviewSubject('Requirements-review: lib/mission_alpha_two/\n', MISSION), false);
  assert.strictEqual(holdsReviewSubject(`Starting-state: ${MISSION}\n`, MISSION), false);
  assert.strictEqual(holdsReviewSubject('', MISSION), false);
});

test('git holding a review commit for the mission reads as reviewed', async () => {
  const root = repository(`Mission-definition: ${MISSION}`, `Requirements-review: ${MISSION}`);
  assert.strictEqual(await reviewCommitted(root, MISSION), true);
});

test("git holding no review commit, or only another mission's or a body mention, reads as not reviewed", async () => {
  const root = repository(
    `Mission-definition: ${MISSION}`,
    'Requirements-review: lib/mission_alpha_two/',
    `Starting-state: ${MISSION}\n\nRequirements-review: ${MISSION}`,
  );
  assert.strictEqual(await reviewCommitted(root, MISSION), false);
});

test('a git read that fails reads as unknown', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-workflow-')));
  assert.strictEqual(await reviewCommitted(root, MISSION), undefined);
});
