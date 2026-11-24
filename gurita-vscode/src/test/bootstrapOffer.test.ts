import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BOOTSTRAP_REASON, CONTEXT_FILES, WORKFLOW_HEADING, bootstrapOffered, holdsWorkflowHeading } from '../bootstrapOffer';

test('a text holds the workflow heading only as a line of its own, trailing whitespace aside', () => {
  assert.strictEqual(WORKFLOW_HEADING, '## Mission Workflow');
  assert.ok(holdsWorkflowHeading('# P\n\n## Mission Workflow\n\nText.\n'));
  assert.ok(holdsWorkflowHeading('## Mission Workflow'));
  assert.ok(holdsWorkflowHeading('# P\r\n## Mission Workflow  \r\n'));
  assert.ok(!holdsWorkflowHeading(''));
  assert.ok(!holdsWorkflowHeading('# P\n\n## Milestone Workflow\n'), 'the older heading is not the heading');
  assert.ok(!holdsWorkflowHeading('### Mission Workflow\n'), 'a deeper heading is not the heading');
  assert.ok(!holdsWorkflowHeading('See ## Mission Workflow below.\n'), 'a mention inside a line is not the heading');
  assert.ok(!holdsWorkflowHeading('## Mission Workflow guidance\n'));
});

test('the offer stands while neither CLAUDE.md nor AGENTS.md at the root holds the heading, a missing or unreadable file holding none', () => {
  assert.deepStrictEqual(CONTEXT_FILES, ['CLAUDE.md', 'AGENTS.md']);
  assert.match(BOOTSTRAP_REASON, /CLAUDE\.md/);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-bootstrap-'));
  const write = (name: string, text: string | undefined) => {
    fs.rmSync(path.join(root, name), { force: true, recursive: true });
    if (text !== undefined) {
      fs.writeFileSync(path.join(root, name), text);
    }
  };
  const held = '# P\n\n## Mission Workflow\n\nGuidance.\n';
  const bare = '# P\n\nNotes.\n';
  const cases: [string | undefined, string | undefined, boolean][] = [
    [undefined, undefined, true],
    [bare, undefined, true],
    [undefined, bare, true],
    [bare, bare, true],
    [held, undefined, false],
    [undefined, held, false],
    [held, bare, false],
    [bare, held, false],
    [held, held, false],
  ];
  for (const [claude, agents, offered] of cases) {
    write('CLAUDE.md', claude);
    write('AGENTS.md', agents);
    assert.strictEqual(bootstrapOffered(root), offered, `CLAUDE.md ${claude === undefined ? 'absent' : claude === held ? 'held' : 'bare'}, AGENTS.md ${agents === undefined ? 'absent' : agents === held ? 'held' : 'bare'}`);
  }
  write('CLAUDE.md', undefined);
  write('AGENTS.md', undefined);
  fs.mkdirSync(path.join(root, 'CLAUDE.md'));
  assert.strictEqual(bootstrapOffered(root), true, 'a CLAUDE.md that cannot be read as a file holds no heading');
});
