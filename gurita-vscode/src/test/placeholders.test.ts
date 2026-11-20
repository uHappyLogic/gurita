import { test } from 'node:test';
import * as assert from 'node:assert';
import { fillPlaceholders, sessionEnvironment, sessionVariable } from '../placeholders';
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
  ]);
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
