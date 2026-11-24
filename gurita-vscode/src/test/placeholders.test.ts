import { test } from 'node:test';
import * as assert from 'node:assert';
import {
  OPTIONAL_PLACEHOLDERS,
  buildLine,
  dropEmptyOptional,
  fillPlaceholders,
  sessionEnvironment,
  sessionVariable,
} from '../placeholders';
import { KNOWN_PLACEHOLDERS } from '../recipes';

test('each session variable is GURITA_ and the placeholder upper-cased, spaces turned into underscores', () => {
  assert.deepStrictEqual(KNOWN_PLACEHOLDERS.map(sessionVariable), [
    'GURITA_PATH',
    'GURITA_TASK_TITLE',
    'GURITA_SHORT_TITLE',
    'GURITA_ALTERNATIVE_ID',
    'GURITA_GOAL',
    'GURITA_SCOPE',
    'GURITA_ANSWER_TEXT',
    'GURITA_ISSUE_DESCRIPTION',
    'GURITA_QUESTION',
    'GURITA_NOTE',
  ]);
});

test('the issue description is a known placeholder, filled through GURITA_ISSUE_DESCRIPTION', () => {
  assert.ok(KNOWN_PLACEHOLDERS.includes('issue description'));
  assert.strictEqual(sessionVariable('issue description'), 'GURITA_ISSUE_DESCRIPTION');
  assert.strictEqual(
    fillPlaceholders(
      'claude "/gurita:discuss-new-task --mission <path> <issue description>" --dangerously-skip-permissions --model "fable" --effort xhigh; # interactive',
      KNOWN_PLACEHOLDERS,
    ),
    'claude "/gurita:discuss-new-task --mission ${GURITA_PATH} ${GURITA_ISSUE_DESCRIPTION}" --dangerously-skip-permissions --model "fable" --effort xhigh; # interactive',
  );
  assert.deepStrictEqual(sessionEnvironment({ path: 'gurita-vscode/mission_x/', 'issue description': 'The pane is slow' }), {
    GURITA_PATH: 'gurita-vscode/mission_x/',
    GURITA_ISSUE_DESCRIPTION: 'The pane is slow',
  });
});

test('the question is a known, required placeholder, filled through GURITA_QUESTION', () => {
  assert.ok(KNOWN_PLACEHOLDERS.includes('question'));
  assert.ok(!OPTIONAL_PLACEHOLDERS.includes('question'), 'an empty question is never dropped from a line');
  assert.strictEqual(sessionVariable('question'), 'GURITA_QUESTION');
  assert.strictEqual(
    buildLine(
      'claude "/gurita:ask-in-mission-context --mission <path> <question>" --dangerously-skip-permissions --model "fable" --effort high; # interactive',
      { path: 'gurita-vscode/mission_x/', question: 'Why two panes?' },
    ),
    'claude "/gurita:ask-in-mission-context --mission ${GURITA_PATH} ${GURITA_QUESTION}" --dangerously-skip-permissions --model "fable" --effort high; # interactive',
  );
});

test('a placeholder inside double quotes is written as a bare reference', () => {
  assert.strictEqual(
    fillPlaceholders('claude -p "/gurita:derive-tasks --mission <path>" --model "fable";', ['path']),
    'claude -p "/gurita:derive-tasks --mission ${GURITA_PATH}" --model "fable";',
  );
  assert.strictEqual(
    fillPlaceholders('claude -p "/gurita:answer-open-question --mission <path> <Short Title>. <answer text>";', [
      'path',
      'Short Title',
      'answer text',
    ]),
    'claude -p "/gurita:answer-open-question --mission ${GURITA_PATH} ${GURITA_SHORT_TITLE}. ${GURITA_ANSWER_TEXT}";',
  );
});

test('a placeholder inside single quotes closes and reopens them, and one outside quotes is quoted', () => {
  assert.strictEqual(
    fillPlaceholders("codex exec '$gurita:finish-mission --mission <path>';", ['path']),
    "codex exec '$gurita:finish-mission --mission '\"${GURITA_PATH}\"'';",
  );
  assert.strictEqual(fillPlaceholders('echo <path> done', ['path']), 'echo "${GURITA_PATH}" done');
});

test('only the given names are filled, and an escaped quote opens no quote', () => {
  assert.strictEqual(
    fillPlaceholders('echo \\"<path> <Task Title>', ['path']),
    'echo \\""${GURITA_PATH}" <Task Title>',
  );
});

test('the session environment maps each placeholder to its variable', () => {
  assert.deepStrictEqual(sessionEnvironment({ path: 'gurita-vscode/mission_x/', 'Short Title': 'A B' }), {
    GURITA_PATH: 'gurita-vscode/mission_x/',
    GURITA_SHORT_TITLE: 'A B',
  });
});

const DISCUSS_LINE =
  'claude "/gurita:discuss-open-question --mission <path> <Short Title>. <note>" --dangerously-skip-permissions --model "fable" --effort xhigh; # interactive';

test('the discussion note is the one optional known placeholder, filled through GURITA_NOTE', () => {
  assert.deepStrictEqual(OPTIONAL_PLACEHOLDERS, ['note']);
  assert.ok(KNOWN_PLACEHOLDERS.includes('note'));
  assert.strictEqual(sessionVariable('note'), 'GURITA_NOTE');
});

test('the discuss line built with a note carries it directly after the Short Title', () => {
  const values = { path: 'gurita-vscode/mission_x/', 'Short Title': 'Pane Layout', note: 'Keep the tabs' };
  assert.strictEqual(dropEmptyOptional(DISCUSS_LINE, values), DISCUSS_LINE);
  assert.strictEqual(
    buildLine(DISCUSS_LINE, values),
    'claude "/gurita:discuss-open-question --mission ${GURITA_PATH} ${GURITA_SHORT_TITLE}. ${GURITA_NOTE}" --dangerously-skip-permissions --model "fable" --effort xhigh; # interactive',
  );
  assert.deepStrictEqual(sessionEnvironment(values), {
    GURITA_PATH: 'gurita-vscode/mission_x/',
    GURITA_SHORT_TITLE: 'Pane Layout',
    GURITA_NOTE: 'Keep the tabs',
  });
});

test('the discuss line built with no note is exactly the line without one', () => {
  const today =
    'claude "/gurita:discuss-open-question --mission ${GURITA_PATH} ${GURITA_SHORT_TITLE}" --dangerously-skip-permissions --model "fable" --effort xhigh; # interactive';
  for (const note of [undefined, '', '   ']) {
    const values: Record<string, string> = { path: 'gurita-vscode/mission_x/', 'Short Title': 'Pane Layout' };
    if (note !== undefined) {
      values.note = note;
    }
    assert.strictEqual(
      dropEmptyOptional(DISCUSS_LINE, values),
      'claude "/gurita:discuss-open-question --mission <path> <Short Title>" --dangerously-skip-permissions --model "fable" --effort xhigh; # interactive',
    );
    assert.strictEqual(buildLine(DISCUSS_LINE, values), today);
  }
});

test('an empty note written without the dot before it is dropped alone, and other lines are left as they are', () => {
  assert.strictEqual(buildLine('echo <Short Title> <note>', { 'Short Title': 'A', note: '' }), 'echo "${GURITA_SHORT_TITLE}" ');
  assert.strictEqual(
    buildLine('claude -p "/gurita:answer-open-question --mission <path> <Short Title>. <answer text>";', { path: 'p/' }),
    'claude -p "/gurita:answer-open-question --mission ${GURITA_PATH} ${GURITA_SHORT_TITLE}. ${GURITA_ANSWER_TEXT}";',
  );
});
