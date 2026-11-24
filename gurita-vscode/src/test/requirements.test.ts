import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseIntroduction, readRequirements } from '../requirements';

// The read of a mission's `requirements.md` for its page's introduction: the title and the goal.

const REQUIREMENTS = [
  '# Tracker   improvements',
  '',
  '## Goal',
  '',
  'Carry out the `tracker` entries.',
  '',
  '- First part',
  '- Second part',
  '',
  '## Relevant starting state',
  '',
  'Not the goal.',
  '',
].join('\n');

test('the module imports nothing from vscode', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'requirements.ts'), 'utf8');
  assert.doesNotMatch(source, /from\s+['"]vscode['"]|require\(\s*['"]vscode['"]\s*\)/);
});

test('the title is the first # heading with its whitespace folded, and the goal the ## Goal body as written', () => {
  assert.deepStrictEqual(parseIntroduction(REQUIREMENTS), {
    title: 'Tracker improvements',
    goal: 'Carry out the `tracker` entries.\n\n- First part\n- Second part',
  });
});

test('the goal runs to the next # or ## heading or the end, a ### heading staying inside it, its outer blank lines dropped', () => {
  assert.strictEqual(parseIntroduction('# T\n## Goal\n\n\nOne.\n### Inner\nTwo.\n\n\n# Next\nNo.\n').goal, 'One.\n### Inner\nTwo.');
  assert.strictEqual(parseIntroduction('# T\n\n## Goal\n\nTo the end.\n\n').goal, 'To the end.');
});

test('a text with Windows line endings or a byte order mark reads as one with plain line endings', () => {
  assert.deepStrictEqual(parseIntroduction('﻿# Title\r\n\r\n## Goal\r\n\r\nA goal.\r\n\r\n## Decisions\r\n'), { title: 'Title', goal: 'A goal.' });
});

test('a text with no # heading holds no title, and one with no ## Goal section an empty goal', () => {
  assert.deepStrictEqual(parseIntroduction('## Goal\n\nA goal.\n'), { goal: 'A goal.' });
  assert.deepStrictEqual(parseIntroduction('#   \n\n## Goal\n\nA goal.\n'), { goal: 'A goal.' });
  assert.deepStrictEqual(parseIntroduction('# Title\n\n## Decisions\n\n- One.\n'), { title: 'Title', goal: '' });
  assert.deepStrictEqual(parseIntroduction('# Title\n\n## Goal\n\n## Decisions\n'), { title: 'Title', goal: '' });
});

test('only the first # heading is the title, and a heading not at column 0 or not followed by a space is none', () => {
  assert.strictEqual(parseIntroduction(' # Indented\n#NoSpace\n# First\n# Second\n').title, 'First');
});

test('the file reads into its title and goal, and a missing one reads as missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-requirements-'));
  const file = path.join(dir, 'requirements.md');
  fs.writeFileSync(file, REQUIREMENTS);
  assert.deepStrictEqual(readRequirements(file), {
    state: 'read',
    file,
    introduction: { title: 'Tracker improvements', goal: 'Carry out the `tracker` entries.\n\n- First part\n- Second part' },
  });
  const absent = path.join(dir, 'absent.md');
  assert.deepStrictEqual(readRequirements(absent), { state: 'missing', file: absent });
});

test('a file that cannot be read reads as unreadable with the module message', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-requirements-'));
  const read = readRequirements(dir);
  assert.strictEqual(read.state, 'unreadable');
  assert.ok(read.state === 'unreadable' && read.message.startsWith('requirements.md could not be read: '));
});
