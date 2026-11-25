import { test } from 'node:test';
import * as assert from 'node:assert';
import { CheckResult, HarnessOutcome } from '../harnessCheck';
import { HarnessStates } from '../harnessSettings';
import { CHECK_NOT_RUN, PLUGIN_NOTICE_CLICK, PLUGIN_NOTICE_LABEL, pluginNotice } from '../pluginNotice';

const ALL_ENABLED: HarnessStates = { claude: true, antigravity: true, codex: true, 'claude-desktop': true };

function passing(key: HarnessOutcome['key'], name: string, cli: string): HarnessOutcome {
  return { key, name, cli, installed: '2.0.0', packaged: '2.0.0' };
}

/** A finished check of every harness passing but those `changed` replaces. */
function checked(changed: Partial<Record<HarnessOutcome['key'], Partial<HarnessOutcome>>> = {}): CheckResult {
  const harnesses: HarnessOutcome[] = [
    passing('claude', 'Claude Code', 'claude'),
    passing('antigravity', 'Antigravity', 'agy'),
    passing('codex', 'Codex', 'codex'),
    { key: 'claude-desktop', name: 'Claude Desktop', cli: 'claude-desktop', application: { bundle: '/Applications/Claude.app', version: '6.28899.6' } },
  ];
  return { state: 'checked', harnesses: harnesses.map((each) => ({ ...each, ...(changed[each.key] ?? {}) })) };
}

function tooltip(...lines: string[]): string {
  return [PLUGIN_NOTICE_LABEL, ...lines, PLUGIN_NOTICE_CLICK].join('\n');
}

test('no notice stands before a check has finished or while every harness passes', () => {
  assert.strictEqual(pluginNotice(undefined, ALL_ENABLED), undefined);
  assert.strictEqual(pluginNotice(checked(), ALL_ENABLED), undefined);
});

test('an enabled harness whose plugin is not installed, unreadable, disabled, or older counts, each named', () => {
  assert.strictEqual(
    pluginNotice(checked({ claude: { failed: 'plugin', installed: undefined } }), ALL_ENABLED),
    tooltip('Claude Code: the Gurita plugin is not installed'),
  );
  assert.strictEqual(
    pluginNotice(checked({ antigravity: { failed: 'plugin', installed: undefined, detail: 'no JSON' } }), ALL_ENABLED),
    tooltip('Antigravity: the plugin listing could not be read (no JSON)'),
  );
  assert.strictEqual(
    pluginNotice(checked({ codex: { failed: 'plugin', installed: undefined, disabled: true } }), ALL_ENABLED),
    tooltip('Codex: the Gurita plugin is installed but disabled'),
  );
  assert.strictEqual(
    pluginNotice(checked({ claude: { failed: 'version', installed: '1.0.0' }, codex: { failed: 'plugin', installed: undefined } }), ALL_ENABLED),
    tooltip('Claude Code: installed version 1.0.0 is older than the packaged 2.0.0', 'Codex: the Gurita plugin is not installed'),
  );
});

test('a harness whose CLI is not found, or that is disabled, never counts', () => {
  assert.strictEqual(pluginNotice(checked({ claude: { failed: 'cli', installed: undefined } }), ALL_ENABLED), undefined);
  assert.strictEqual(
    pluginNotice(checked({ codex: { failed: 'version', installed: '1.0.0' } }), { ...ALL_ENABLED, codex: false }),
    undefined,
  );
  assert.strictEqual(
    pluginNotice(checked({ codex: { failed: 'version', installed: '1.0.0' }, antigravity: { failed: 'plugin', installed: undefined } }), { ...ALL_ENABLED, codex: false }),
    tooltip('Antigravity: the Gurita plugin is not installed'),
  );
});

test('a check that could not be run at all counts, whatever harnesses are enabled, its cause named', () => {
  const failed: CheckResult = { state: 'failed', cause: 'python3 not found' };
  assert.strictEqual(
    pluginNotice(failed, { claude: false, antigravity: false, codex: false, 'claude-desktop': false }),
    tooltip(`${CHECK_NOT_RUN} python3 not found`),
  );
});

test('a failed Claude Desktop presence check is never counted, enabled or not, and leaves the counted harnesses as they are', () => {
  const missing = { failed: 'application' as const, application: { bundle: '/Applications/Claude.app' } };
  assert.strictEqual(pluginNotice(checked({ 'claude-desktop': missing }), ALL_ENABLED), undefined, 'no row stands for it alone');
  assert.strictEqual(pluginNotice(checked({ 'claude-desktop': missing }), { ...ALL_ENABLED, 'claude-desktop': false }), undefined);
  assert.strictEqual(
    pluginNotice(checked({ 'claude-desktop': missing, codex: { failed: 'plugin', installed: undefined } }), ALL_ENABLED),
    tooltip('Codex: the Gurita plugin is not installed'),
    'the notice names the counted harness alone',
  );
});
