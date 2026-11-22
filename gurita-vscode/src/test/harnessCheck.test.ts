import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { harnessOutcomes, readPackagedVersion } from '../harnessCheck';

const PASSING = { found: true, installed: true, version: '2.0.0' };

function print(claude: unknown, antigravity: unknown = PASSING, codex: unknown = PASSING): string {
  return JSON.stringify({ claude, antigravity, codex }) + '\n';
}

test('every check passing gives each harness its installed version and no failed check', () => {
  assert.deepStrictEqual(harnessOutcomes(print(PASSING), '2.0.0'), [
    { key: 'claude', name: 'Claude Code', cli: 'claude', packaged: '2.0.0', installed: '2.0.0' },
    { key: 'antigravity', name: 'Antigravity', cli: 'agy', packaged: '2.0.0', installed: '2.0.0' },
    { key: 'codex', name: 'Codex', cli: 'codex', packaged: '2.0.0', installed: '2.0.0' },
  ]);
});

test('the first failed check is named: CLI not found, then plugin not installed, then version differing', () => {
  const failed = (claude: unknown, packaged: string | undefined = '2.0.0') => harnessOutcomes(print(claude), packaged)[0].failed;
  assert.strictEqual(failed({ found: false, installed: false, version: null }), 'cli');
  assert.strictEqual(failed({ found: true, installed: false, version: null }), 'plugin');
  assert.strictEqual(failed({ found: true, installed: false, version: null, error: 'the listing did not finish' }), 'plugin');
  assert.strictEqual(failed({ found: true, installed: true, version: '1.9.0' }), 'version');
  assert.strictEqual(failed({ found: true, installed: true, version: null }), 'version', 'a copy reading no version');
  assert.strictEqual(harnessOutcomes(print(PASSING), undefined)[0].failed, 'version', 'no packaged version to match');
  assert.strictEqual(failed(PASSING), undefined);
  assert.strictEqual(
    harnessOutcomes(print({ found: true, installed: false, version: null, error: 'boom' }), '2.0.0')[0].detail,
    'boom',
    "the listing's error is carried",
  );
});

test('a print not in the check script form throws', () => {
  assert.throws(() => harnessOutcomes('not json', '2.0.0'), /printed no JSON/);
  assert.throws(() => harnessOutcomes('[]', '2.0.0'), /no JSON object/);
  assert.throws(() => harnessOutcomes(JSON.stringify({ claude: PASSING, antigravity: PASSING }), '2.0.0'), /for codex/);
  assert.throws(() => harnessOutcomes(print({ found: 'yes', installed: true, version: '2.0.0' }), '2.0.0'), /for claude/);
});

test('the packaged version is the recorded line, and undefined when the file cannot be read', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-version-'));
  fs.writeFileSync(path.join(dir, 'plugin_version.txt'), '2.0.0\n');
  assert.strictEqual(readPackagedVersion(path.join(dir, 'plugin_version.txt')), '2.0.0');
  assert.strictEqual(readPackagedVersion(path.join(dir, 'missing.txt')), undefined);
});
