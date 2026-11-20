import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { RunningRuns } from '../running';

test('the module imports nothing from vscode', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'running.ts'), 'utf8');
  assert.doesNotMatch(source, /from\s+['"]vscode['"]|require\(\s*['"]vscode['"]\s*\)/);
});

test("a mission's run is held until its terminal closes, other missions unaffected", () => {
  const runs = new RunningRuns<string>();
  assert.deepStrictEqual(runs.missions(), []);
  runs.hold('mission_beta/', 'beta terminal');
  runs.hold('lib/mission_alpha/', 'alpha terminal');
  assert.deepStrictEqual(runs.missions(), ['lib/mission_alpha/', 'mission_beta/']);
  assert.strictEqual(runs.terminal('lib/mission_alpha/'), 'alpha terminal');
  assert.strictEqual(runs.close('alpha terminal'), true);
  assert.deepStrictEqual(runs.missions(), ['mission_beta/']);
  assert.strictEqual(runs.terminal('lib/mission_alpha/'), undefined);
  assert.strictEqual(runs.terminal('mission_beta/'), 'beta terminal');
});

test('a mission-starting run belongs to no mission', () => {
  const runs = new RunningRuns<string>();
  runs.hold(undefined, 'starting terminal');
  assert.deepStrictEqual(runs.missions(), []);
  assert.strictEqual(runs.close('starting terminal'), true);
  assert.strictEqual(runs.close('starting terminal'), false);
});

test('a terminal the note never held clears nothing', () => {
  const runs = new RunningRuns<string>();
  runs.hold('mission_beta/', 'beta terminal');
  assert.strictEqual(runs.close('another terminal'), false);
  assert.deepStrictEqual(runs.missions(), ['mission_beta/']);
});
