import { test } from 'node:test';
import * as assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DocumentFacts } from '../documents';
import {
  OPTIONAL_STEPS,
  WORKFLOW_STEPS,
  additionalRounds,
  countReviewSubjects,
  defaultPane,
  missionWorkflow,
  nextStep,
  reviewCount,
} from '../workflow';

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

test('the diagram holds the seven blocks in flow order, the additional review round and follow up tasks optional', () => {
  assert.deepStrictEqual(
    [...WORKFLOW_STEPS],
    ['define', 'first-review', 'additional-review', 'derive', 'execute', 'follow-up', 'finish'],
  );
  assert.deepStrictEqual([...OPTIONAL_STEPS], ['additional-review', 'follow-up']);
});

test('a question lacking alternatives or a pick makes the first review round the step while at most one review commit stands', () => {
  for (const reviews of [0, 1]) {
    for (const state of ['started', 'defined']) {
      assert.strictEqual(nextStep(state, open(true, true, false), reviews), 'first-review');
      assert.strictEqual(nextStep(state, open(false, true, false), reviews), 'first-review');
      assert.strictEqual(nextStep(state, open(true, false, false), reviews), 'first-review');
    }
  }
});

test('a question lacking alternatives or a pick makes the additional review round the step once two or more review commits stand', () => {
  for (const reviews of [2, 3, 7]) {
    for (const state of ['started', 'defined']) {
      assert.strictEqual(nextStep(state, open(true, true, false), reviews), 'additional-review');
      assert.strictEqual(nextStep(state, open(false, true, false), reviews), 'additional-review');
      assert.strictEqual(nextStep(state, open(true, false, false), reviews), 'additional-review');
    }
  }
});

test('every open question carrying a pick makes derive tasks the step, whatever the review count', () => {
  for (const reviews of [undefined, 0, 1, 2, 5]) {
    assert.strictEqual(nextStep('defined', open(false, false, false), reviews), 'derive');
    assert.strictEqual(nextStep('started', open(false, false, false), reviews), 'derive');
  }
});

test('an open question outranks a remaining task', () => {
  assert.strictEqual(nextStep('started', open(true, true, true), 0), 'first-review');
  assert.strictEqual(nextStep('started', open(false, true, true), 1), 'first-review');
  assert.strictEqual(nextStep('started', open(false, true, true), 2), 'additional-review');
  assert.strictEqual(nextStep('started', open(false, false, true), 2), 'derive');
});

test('no open question and tasks remaining make execute tasks the step, whatever the review count', () => {
  for (const reviews of [undefined, 0, 1, 3]) {
    assert.strictEqual(nextStep('started', empty(true), reviews), 'execute');
    assert.strictEqual(nextStep('defined', empty(true), reviews), 'execute');
  }
});

test('a started mission with no open question and no task makes finish the step, whatever the review count', () => {
  for (const reviews of [undefined, 0, 1, 2]) {
    assert.strictEqual(nextStep('started', empty(false), reviews), 'finish');
  }
});

test('a defined mission with neither makes derive tasks the step once a review commit stands, the first review round while none does', () => {
  assert.strictEqual(nextStep('defined', empty(false), 0), 'first-review');
  for (const reviews of [1, 2, 4]) {
    assert.strictEqual(nextStep('defined', empty(false), reviews), 'derive');
  }
});

test('define and follow up tasks are never the step', () => {
  const states = ['started', 'defined', 'other'];
  const facts: DocumentFacts[] = [
    {},
    { tasksRemain: true },
    empty(),
    empty(true),
    empty(false),
    open(true, true),
    open(true, true, true),
    open(false, true, false),
    open(true, false, true),
    open(false, false),
    open(false, false, true),
  ];
  for (const state of states) {
    for (const each of facts) {
      for (const reviews of [undefined, 0, 1, 2, 3]) {
        assert.ok(!['define', 'follow-up'].includes(nextStep(state, each, reviews) as string));
      }
    }
  }
});

test('no step is chosen when a document the choice needs did not read', () => {
  assert.strictEqual(nextStep('started', {}, 1), undefined);
  assert.strictEqual(nextStep('started', { tasksRemain: true }, 1), undefined);
  assert.strictEqual(nextStep('started', empty(), 1), undefined);
  assert.strictEqual(nextStep('defined', empty(), 1), undefined);
});

test('a task list that did not read leaves an open question its step', () => {
  assert.strictEqual(nextStep('started', open(true, true), 0), 'first-review');
  assert.strictEqual(nextStep('started', open(true, true), 2), 'additional-review');
  assert.strictEqual(nextStep('started', open(false, false)), 'derive');
});

test('no step is chosen when the git read the choice needs failed', () => {
  assert.strictEqual(nextStep('defined', empty(false)), undefined);
  assert.strictEqual(nextStep('defined', open(true, true, false)), undefined);
  assert.strictEqual(nextStep('started', open(false, true, true)), undefined);
});

test('the additional review round carries the review commits beyond the first once two or more stand', () => {
  assert.strictEqual(additionalRounds(undefined), undefined);
  assert.strictEqual(additionalRounds(0), undefined);
  assert.strictEqual(additionalRounds(1), undefined);
  assert.strictEqual(additionalRounds(2), 1);
  assert.strictEqual(additionalRounds(3), 2);
  assert.strictEqual(additionalRounds(10), 9);
});

test('with no question open, Remaining tasks is the default pane once a review commit stands and Open questions while none does', () => {
  for (const tasksRemain of [undefined, true, false]) {
    assert.strictEqual(defaultPane(empty(tasksRemain), 0), 'questions');
    for (const reviews of [1, 2, 3, 7]) {
      assert.strictEqual(defaultPane(empty(tasksRemain), reviews), 'tasks', `${reviews} review commits`);
    }
  }
});

test('an open question makes Open questions the default pane whatever the review count', () => {
  const facts = [open(true, true), open(false, true, true), open(true, false, false), open(false, false, true), open(false, false)];
  for (const each of facts) {
    for (const reviews of [undefined, 0, 1, 2, 3, 7]) {
      assert.strictEqual(defaultPane(each, reviews), 'questions', `${reviews} review commits`);
    }
  }
});

test('a failed git read makes Open questions the default pane', () => {
  for (const tasksRemain of [undefined, true, false]) {
    assert.strictEqual(defaultPane(empty(tasksRemain), undefined), 'questions');
  }
});

test('a question document that did not read makes Open questions the default pane whatever the review count', () => {
  for (const reviews of [undefined, 0, 1, 2, 5]) {
    assert.strictEqual(defaultPane({}, reviews), 'questions');
    assert.strictEqual(defaultPane({ tasksRemain: true }, reviews), 'questions');
    assert.strictEqual(defaultPane({ tasksRemain: false }, reviews), 'questions');
  }
});

test('the page is read from git once for every mission, leaving out what there is none of and always carrying the default pane', async () => {
  let reads = 0;
  const reviews = (value: number | undefined) => async () => {
    reads += 1;
    return value;
  };
  assert.deepStrictEqual(await missionWorkflow('started', empty(true), reviews(0)), { step: 'execute', defaultPane: 'questions' });
  assert.deepStrictEqual(await missionWorkflow('started', empty(true), reviews(1)), { step: 'execute', defaultPane: 'tasks' });
  assert.deepStrictEqual(await missionWorkflow('started', empty(true), reviews(3)), {
    step: 'execute',
    additionalRounds: 2,
    defaultPane: 'tasks',
  });
  assert.deepStrictEqual(await missionWorkflow('started', empty(false), reviews(2)), {
    step: 'finish',
    additionalRounds: 1,
    defaultPane: 'tasks',
  });
  assert.deepStrictEqual(await missionWorkflow('defined', open(true, true, false), reviews(1)), {
    step: 'first-review',
    defaultPane: 'questions',
  });
  assert.deepStrictEqual(await missionWorkflow('defined', open(false, true, false), reviews(2)), {
    step: 'additional-review',
    additionalRounds: 1,
    defaultPane: 'questions',
  });
  assert.deepStrictEqual(await missionWorkflow('defined', open(false, false, false), reviews(4)), {
    step: 'derive',
    additionalRounds: 3,
    defaultPane: 'questions',
  });
  assert.deepStrictEqual(await missionWorkflow('defined', empty(false), reviews(0)), { step: 'first-review', defaultPane: 'questions' });
  assert.deepStrictEqual(await missionWorkflow('defined', empty(false), reviews(1)), { step: 'derive', defaultPane: 'tasks' });
  assert.deepStrictEqual(await missionWorkflow('defined', empty(false), reviews(undefined)), { defaultPane: 'questions' });
  assert.deepStrictEqual(await missionWorkflow('started', empty(true), reviews(undefined)), { step: 'execute', defaultPane: 'questions' });
  assert.deepStrictEqual(await missionWorkflow('started', {}, reviews(5)), { additionalRounds: 4, defaultPane: 'questions' });
  assert.strictEqual(reads, 12);
});

test('a review subject counts only for the mission path exactly', () => {
  assert.strictEqual(countReviewSubjects(`Requirements-review: ${MISSION}\n`, MISSION), 1);
  assert.strictEqual(countReviewSubjects(`Requirements-review: ${MISSION}\nRequirements-review: ${MISSION}\r\n`, MISSION), 2);
  assert.strictEqual(countReviewSubjects('Requirements-review: lib/mission_alpha_two/\n', MISSION), 0);
  assert.strictEqual(countReviewSubjects(`Starting-state: ${MISSION}\n`, MISSION), 0);
  assert.strictEqual(countReviewSubjects('', MISSION), 0);
});

test('git holding review commits for the mission reads as their count', async () => {
  assert.strictEqual(await reviewCount(repository(`Mission-definition: ${MISSION}`), MISSION), 0);
  assert.strictEqual(await reviewCount(repository(`Mission-definition: ${MISSION}`, `Requirements-review: ${MISSION}`), MISSION), 1);
  const reviewed = repository(
    `Mission-definition: ${MISSION}`,
    `Requirements-review: ${MISSION}`,
    `Recommendation-answer: Pane Layout`,
    `Requirements-review: ${MISSION}`,
    `Requirements-review: ${MISSION}`,
  );
  assert.strictEqual(await reviewCount(reviewed, MISSION), 3);
});

test("another mission's review commits and a body mention are not counted", async () => {
  const root = repository(
    `Mission-definition: ${MISSION}`,
    'Requirements-review: lib/mission_alpha_two/',
    `Starting-state: ${MISSION}\n\nRequirements-review: ${MISSION}`,
    `Requirements-review: ${MISSION}`,
  );
  assert.strictEqual(await reviewCount(root, MISSION), 1);
});

test('a git read that fails reads as unknown', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-workflow-')));
  assert.strictEqual(await reviewCount(root, MISSION), undefined);
});
