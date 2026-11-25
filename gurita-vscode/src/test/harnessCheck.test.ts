import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  CLI_HARNESSES,
  DESKTOP_BUNDLE,
  HARNESSES,
  desktopOutcome,
  harnessOutcomes,
  isCliHarnessKey,
  readDesktopPresence,
  readPackagedVersion,
  runHarnessCheck,
  switchCommands,
  versionAtLeast,
} from '../harnessCheck';

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

test("a Claude Code or Codex copy from another source carries the source found and the commands that switch it to the distribution repository", () => {
  const outcomes = harnessOutcomes(
    print(
      { found: true, installed: true, version: '2.0.0', scopes: ['project', 'user'], scope: 'project', disabled: false, source: 'the directory /work/gurita' },
      PASSING,
      { found: true, installed: true, version: '1.9.0', disabled: false, source: 'the local directory /work/gurita/hosts/codex' },
    ),
    '2.0.0',
  );
  assert.deepStrictEqual(outcomes[0], {
    key: 'claude',
    name: 'Claude Code',
    cli: 'claude',
    packaged: '2.0.0',
    installed: '2.0.0',
    scopes: ['project', 'user'],
    source: {
      found: 'the directory /work/gurita',
      repository: 'uHappyLogic/gurita-claude',
      commands: [
        'claude plugin marketplace remove gurita',
        'claude plugin marketplace add uHappyLogic/gurita-claude',
        'claude plugin install gurita@gurita --scope user',
        'claude plugin install gurita@gurita --scope project',
      ],
    },
  });
  assert.strictEqual(outcomes[0].failed, undefined, 'the source fails no check of its own');
  assert.deepStrictEqual(outcomes[2], {
    key: 'codex',
    name: 'Codex',
    cli: 'codex',
    packaged: '2.0.0',
    installed: '1.9.0',
    failed: 'version',
    source: {
      found: 'the local directory /work/gurita/hosts/codex',
      repository: 'uHappyLogic/gurita-codex',
      commands: ['codex plugin marketplace remove gurita', 'codex plugin marketplace add uHappyLogic/gurita-codex', 'codex plugin add gurita@gurita'],
    },
  });
  assert.strictEqual(outcomes[1].source, undefined, 'Antigravity carries no source');
});

test('the distribution repository, or no gurita marketplace, carries no source', () => {
  const outcomes = harnessOutcomes(
    print(
      { found: true, installed: true, version: '2.0.0', scopes: ['user'], scope: 'user', disabled: false, source: null },
      { ...PASSING, source: 'ignored' },
      { found: true, installed: false, version: null, disabled: false, source: null },
    ),
    '2.0.0',
  );
  assert.strictEqual(outcomes[0].source, undefined);
  assert.strictEqual(outcomes[1].source, undefined, "Antigravity's source is never read");
  assert.strictEqual(outcomes[2].source, undefined);
  assert.throws(() => harnessOutcomes(print({ ...PASSING, source: 3 }), '2.0.0'), /for claude/);
});

test('the switching commands reinstall at every detected Claude Code scope, and on Codex only over a held copy', () => {
  assert.deepStrictEqual(switchCommands('claude', [], false), [
    'claude plugin marketplace remove gurita',
    'claude plugin marketplace add uHappyLogic/gurita-claude',
  ]);
  assert.deepStrictEqual(switchCommands('claude', ['local', 'user', 'project'], true)?.slice(2), [
    'claude plugin install gurita@gurita --scope user',
    'claude plugin install gurita@gurita --scope project',
    'claude plugin install gurita@gurita --scope local',
  ]);
  assert.deepStrictEqual(switchCommands('codex', [], false), [
    'codex plugin marketplace remove gurita',
    'codex plugin marketplace add uHappyLogic/gurita-codex',
  ]);
  assert.deepStrictEqual(switchCommands('codex', [], true)?.slice(2), ['codex plugin add gurita@gurita']);
  assert.strictEqual(switchCommands('antigravity', [], true), undefined);
  const disabled = harnessOutcomes(
    print(PASSING, PASSING, { found: true, installed: false, version: null, disabled: true, source: 'the local directory /x' }),
    '2.0.0',
  )[2];
  assert.deepStrictEqual(disabled.source?.commands.slice(2), ['codex plugin add gurita@gurita'], 'a disabled copy is held');
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

/** A Claude Desktop bundle in a fresh directory, its `Info.plist` holding `plist` when given. */
function desktopBundle(plist?: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-desktop-'));
  const bundle = path.join(dir, 'Claude.app');
  fs.mkdirSync(path.join(bundle, 'Contents'), { recursive: true });
  if (plist !== undefined) {
    fs.writeFileSync(path.join(bundle, 'Contents', 'Info.plist'), plist);
  }
  return bundle;
}

/** An XML `Info.plist` as Claude Desktop's bundle holds it, reading the version `version`. */
function infoPlist(version: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    '    <key>CFBundleIdentifier</key>',
    '    <string>com.anthropic.claudefordesktop</string>',
    '    <key>CFBundleShortVersionString</key>',
    `    <string>${version}</string>`,
    '    <key>CFBundleVersion</key>',
    '    <string>0.0.1</string>',
    '</dict>',
    '</plist>',
    '',
  ].join('\n');
}

test('Claude Desktop is the fourth harness, its command word claude-desktop, after the three CLIs', () => {
  assert.deepStrictEqual(
    HARNESSES.map((harness) => [harness.key, harness.name, harness.cli]),
    [
      ['claude', 'Claude Code', 'claude'],
      ['antigravity', 'Antigravity', 'agy'],
      ['codex', 'Codex', 'codex'],
      ['claude-desktop', 'Claude Desktop', 'claude-desktop'],
    ],
  );
  assert.deepStrictEqual(CLI_HARNESSES.map((harness) => harness.key), ['claude', 'antigravity', 'codex']);
  assert.ok(isCliHarnessKey('codex') && !isCliHarnessKey('claude-desktop') && !isCliHarnessKey(undefined));
  assert.strictEqual(DESKTOP_BUNDLE, '/Applications/Claude.app');
  assert.deepStrictEqual(harnessOutcomes(print(PASSING), '2.0.0').map((outcome) => outcome.key), ['claude', 'antigravity', 'codex'], 'the script covers the CLIs alone');
});

test('a dated block of the hands-on check findings stands beside the Claude Desktop entry', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'harnessCheck.ts'), 'utf8');
  const block = source.slice(source.indexOf('// Hands-on check of Claude Desktop'), source.indexOf('export const DESKTOP_HARNESS'));
  assert.ok(block.startsWith('// Hands-on check of Claude Desktop, 2026-11-25, on Claude Desktop 6.28899.6'), 'the day and the version checked');
  for (const finding of ['What was passed:', 'What arrived:', '`claude://code/new`', '14,336 characters', '`--desktop`']) {
    assert.ok(block.includes(finding), `the block names ${finding}`);
  }
});

test("Claude Desktop's presence is read from its bundle: installed with the bundle's version, or not found", () => {
  assert.deepStrictEqual(readDesktopPresence(desktopBundle(infoPlist('6.28899.6'))), { installed: true, version: '6.28899.6' });
  assert.deepStrictEqual(readDesktopPresence(desktopBundle()), { installed: true }, 'a bundle with no Info.plist is installed, its version not read');
  assert.deepStrictEqual(readDesktopPresence(desktopBundle('<plist><dict></dict></plist>')), { installed: true }, 'a plist naming no version');
  const missing = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-desktop-')), 'Claude.app');
  assert.deepStrictEqual(readDesktopPresence(missing), { installed: false });
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-desktop-')), 'Claude.app');
  fs.writeFileSync(file, '');
  assert.deepStrictEqual(readDesktopPresence(file), { installed: false }, 'a file that is no bundle directory');
});

test("Claude Desktop's presence is read through the file system, never through a command in the shell", () => {
  for (const read of [readDesktopPresence, desktopOutcome]) {
    assert.doesNotMatch(read.toString(), /execFile|execSync|spawn|child_process|\bexec\(/);
  }
});

test("Claude Desktop's outcome makes its one presence check, its version information only, and no plugin or version check", () => {
  assert.deepStrictEqual(desktopOutcome({ installed: true, version: '6.28899.6' }), {
    key: 'claude-desktop',
    name: 'Claude Desktop',
    cli: 'claude-desktop',
    application: { bundle: '/Applications/Claude.app', version: '6.28899.6' },
  });
  assert.deepStrictEqual(desktopOutcome({ installed: true, version: '0.0.1' }).failed, undefined, 'any version passes, compared with nothing');
  assert.deepStrictEqual(desktopOutcome({ installed: false }, '/elsewhere/Claude.app'), {
    key: 'claude-desktop',
    name: 'Claude Desktop',
    cli: 'claude-desktop',
    application: { bundle: '/elsewhere/Claude.app' },
    failed: 'application',
  });
  const outcome = desktopOutcome({ installed: true });
  for (const field of ['installed', 'packaged', 'detail', 'scopes', 'disabled', 'source'] as const) {
    assert.strictEqual(outcome[field], undefined, `no ${field}`);
  }
});

test("a finished check gives Claude Desktop's outcome after the script's three, read from the bundle", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-check-'));
  const script = path.join(dir, 'check.js');
  fs.writeFileSync(script, `process.stdout.write(${JSON.stringify(print(PASSING))});\n`);
  const bundle = desktopBundle(infoPlist('6.28899.6'));
  const result = await runHarnessCheck(script, dir, '2.0.0', process.execPath, bundle);
  assert.strictEqual(result.state, 'checked');
  assert.deepStrictEqual(
    result.state === 'checked' ? result.harnesses.map((outcome) => [outcome.key, outcome.failed]) : [],
    [
      ['claude', undefined],
      ['antigravity', undefined],
      ['codex', undefined],
      ['claude-desktop', undefined],
    ],
  );
  assert.deepStrictEqual(result.state === 'checked' ? result.harnesses[3].application : undefined, { bundle, version: '6.28899.6' });
  const absent = await runHarnessCheck(script, dir, '2.0.0', process.execPath, path.join(dir, 'Claude.app'));
  assert.strictEqual(absent.state === 'checked' ? absent.harnesses[3].failed : undefined, 'application');
});
