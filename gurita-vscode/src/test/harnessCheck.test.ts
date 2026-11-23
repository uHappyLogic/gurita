import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { harnessOutcomes, readPackagedVersion, versionAtLeast } from '../harnessCheck';

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

test('the first failed check is named: CLI not found, then plugin not installed, then version older', () => {
  const failed = (claude: unknown, packaged: string | undefined = '2.0.0') => harnessOutcomes(print(claude), packaged)[0].failed;
  assert.strictEqual(failed({ found: false, installed: false, version: null }), 'cli');
  assert.strictEqual(failed({ found: true, installed: false, version: null }), 'plugin');
  assert.strictEqual(failed({ found: true, installed: false, version: null, error: 'the listing did not finish' }), 'plugin');
  assert.strictEqual(failed({ found: true, installed: true, version: '1.9.0' }), 'version');
  assert.strictEqual(failed({ found: true, installed: true, version: null }), 'version', 'a copy reading no version');
  assert.strictEqual(failed({ found: true, installed: true, version: 'v2.0.0' }), 'version', 'a copy reading no bare MAJOR.MINOR.PATCH');
  assert.strictEqual(harnessOutcomes(print(PASSING), undefined)[0].failed, 'version', 'no packaged version to meet');
  assert.strictEqual(failed(PASSING), undefined);
  assert.strictEqual(
    harnessOutcomes(print({ found: true, installed: false, version: null, error: 'boom' }), '2.0.0')[0].detail,
    'boom',
    "the listing's error is carried",
  );
});

test('the installed version is compared with the packaged one as a minimum: older fails, equal and newer pass', () => {
  const outcome = (version: string) => harnessOutcomes(print({ found: true, installed: true, version }), '2.0.0')[0];
  for (const older of ['1.9.0', '1.99.99', '0.10.0']) {
    assert.strictEqual(outcome(older).failed, 'version', `${older} is older`);
    assert.strictEqual(outcome(older).installed, older);
  }
  assert.strictEqual(outcome('2.0.0').failed, undefined, 'an equal copy passes');
  for (const newer of ['2.0.1', '2.1.0', '3.0.0', '10.0.0']) {
    assert.strictEqual(outcome(newer).failed, undefined, `${newer} is newer`);
    assert.strictEqual(outcome(newer).installed, newer);
  }
  assert.strictEqual(harnessOutcomes(print({ found: true, installed: true, version: '2.9.9' }), '2.10.0')[0].failed, 'version', 'parts are ordered as numbers');
  assert.strictEqual(harnessOutcomes(print({ found: true, installed: true, version: '2.10.0' }), '2.9.9')[0].failed, undefined, 'parts are ordered as numbers');
});

test('a version is at least another only when both are bare MAJOR.MINOR.PATCH', () => {
  assert.strictEqual(versionAtLeast('2.0.0', '2.0.0'), true);
  assert.strictEqual(versionAtLeast('2.0.1', '2.0.0'), true);
  assert.strictEqual(versionAtLeast('1.9.9', '2.0.0'), false);
  assert.strictEqual(versionAtLeast(null, '2.0.0'), false);
  assert.strictEqual(versionAtLeast('2.0.0', undefined), false);
  assert.strictEqual(versionAtLeast('2.0', '2.0.0'), false);
  assert.strictEqual(versionAtLeast('2.0.0-beta', '2.0.0'), false);
  assert.strictEqual(versionAtLeast('2.0.0', 'unknown'), false);
});

test("Claude Code's detected scopes are carried with the winning scope first, and a disabled winner is marked and fails the plugin check", () => {
  const claude = (printed: unknown) => harnessOutcomes(print(printed), '2.0.0')[0];
  assert.deepStrictEqual(claude({ found: true, installed: true, version: '2.0.0', scopes: ['user'], scope: 'user', disabled: false }), {
    key: 'claude',
    name: 'Claude Code',
    cli: 'claude',
    packaged: '2.0.0',
    installed: '2.0.0',
    scopes: ['user'],
  });
  assert.deepStrictEqual(
    claude({ found: true, installed: true, version: '2.1.0', scopes: ['local', 'project', 'user'], scope: 'local', disabled: false }),
    { key: 'claude', name: 'Claude Code', cli: 'claude', packaged: '2.0.0', installed: '2.1.0', scopes: ['local', 'project', 'user'] },
    "several scopes, one version: the winner's",
  );
  assert.deepStrictEqual(
    claude({ found: true, installed: true, version: '2.0.0', scopes: ['user', 'project'], scope: 'project', disabled: false }).scopes,
    ['project', 'user'],
    'the winning scope is put first whatever the printed order',
  );
  assert.deepStrictEqual(claude({ found: true, installed: false, version: null, scopes: ['local', 'user'], scope: 'local', disabled: true }), {
    key: 'claude',
    name: 'Claude Code',
    cli: 'claude',
    packaged: '2.0.0',
    failed: 'plugin',
    scopes: ['local', 'user'],
    disabled: true,
  });
  const none = claude({ found: true, installed: false, version: null, scopes: [], scope: null, disabled: false });
  assert.strictEqual(none.scopes, undefined, 'no scope detected, none carried');
  assert.strictEqual(none.disabled, undefined);
  assert.strictEqual(harnessOutcomes(print(PASSING), '2.0.0')[1].scopes, undefined, 'a harness printing no scopes carries none');
  assert.throws(() => harnessOutcomes(print({ ...PASSING, scopes: 'user' }), '2.0.0'), /for claude/);
  assert.throws(() => harnessOutcomes(print({ ...PASSING, scopes: ['user'], disabled: 'no' }), '2.0.0'), /for claude/);
});

test('a disabled Antigravity or Codex copy is a state of its own: marked disabled, failing the plugin check, beside not installed and installed', () => {
  const DISABLED = { found: true, installed: false, version: null, disabled: true };
  const NOT_INSTALLED = { found: true, installed: false, version: null, disabled: false };
  const outcomes = harnessOutcomes(print(PASSING, DISABLED, DISABLED), '2.0.0');
  assert.deepStrictEqual(outcomes[1], { key: 'antigravity', name: 'Antigravity', cli: 'agy', packaged: '2.0.0', failed: 'plugin', disabled: true });
  assert.deepStrictEqual(outcomes[2], { key: 'codex', name: 'Codex', cli: 'codex', packaged: '2.0.0', failed: 'plugin', disabled: true });
  const absent = harnessOutcomes(print(PASSING, NOT_INSTALLED, NOT_INSTALLED), '2.0.0');
  assert.deepStrictEqual(absent[1], { key: 'antigravity', name: 'Antigravity', cli: 'agy', packaged: '2.0.0', failed: 'plugin' }, 'not installed is not disabled');
  assert.strictEqual(absent[2].disabled, undefined);
  const installed = harnessOutcomes(print(PASSING, { ...PASSING, disabled: false }, { ...PASSING, disabled: false }), '2.0.0');
  assert.deepStrictEqual(installed[1], { key: 'antigravity', name: 'Antigravity', cli: 'agy', packaged: '2.0.0', installed: '2.0.0' }, 'installed is neither failed nor disabled');
  assert.strictEqual(installed[2].disabled, undefined);
  assert.throws(() => harnessOutcomes(print(PASSING, { ...DISABLED, disabled: 'yes' }), '2.0.0'), /for antigravity/);
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
