import { test } from 'node:test';
import * as assert from 'node:assert';
// The run path against a stub of the `vscode` module, standing in for the editor: the terminals it
// creates, the terminal-close event, the notification, and the `gurita` settings.
import * as fs from 'node:fs';
import * as path from 'node:path';
const Module = require('node:module') as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};

interface StubTerminal {
  name: string;
  shown: number;
  args?: string[];
}

/** The `gurita` settings the stub answers with, a key absent standing for a setting left unset. */
const settings: Record<string, unknown> = {};

const created: StubTerminal[] = [];
const notifications: string[] = [];
let closeListener: ((terminal: StubTerminal) => void) | undefined;

const stub = {
  window: {
    createTerminal(options: { name: string; shellArgs?: string[] }): StubTerminal {
      const terminal = { name: options.name, shown: 0, args: [...(options.shellArgs ?? [])], show(): void {} };
      terminal.show = () => {
        terminal.shown += 1;
      };
      created.push(terminal);
      return terminal;
    },
    onDidCloseTerminal(listener: (terminal: StubTerminal) => void): { dispose(): void } {
      closeListener = listener;
      return { dispose(): void {} };
    },
    showInformationMessage(message: string): Promise<undefined> {
      notifications.push(message);
      return Promise.resolve(undefined);
    },
  },
  workspace: {
    getConfiguration(section: string): { get(key: string, fallback?: unknown): unknown } {
      assert.strictEqual(section, 'gurita');
      return { get: (key: string, fallback?: unknown) => (key in settings ? settings[key] : fallback) };
    },
  },
};

const load = Module._load;
Module._load = (request, parent, isMain) => (request === 'vscode' ? stub : load(request, parent, isMain));
const runs = require('../runs') as typeof import('../runs');
Module._load = load;

const context = {
  subscriptions: [] as unknown[],
  asAbsolutePath: (file: string) => `/extension/${file}`,
} as unknown as import('vscode').ExtensionContext;

const events: string[] = [];
runs.registerRuns(context, {
  started: () => events.push(`started ${runs.runningMissions().join(',')}`),
  ended: () => events.push(`ended ${runs.runningMissions().join(',')}`),
});

function close(terminal: StubTerminal): void {
  assert.ok(closeListener !== undefined);
  closeListener(terminal);
}

test("a mission's run is posted as held when it starts and as cleared when its terminal closes", () => {
  events.length = 0;
  runs.startChain(context, '/project', 'lib/mission_alpha/', 'review', ['echo review'], { path: 'lib/mission_alpha/' });
  const alpha = created[created.length - 1];
  assert.deepStrictEqual(events, ['started lib/mission_alpha/']);
  assert.deepStrictEqual(runs.runningMissions(), ['lib/mission_alpha/']);

  runs.startChain(context, '/project', 'mission_beta/', 'review', ['echo review'], { path: 'mission_beta/' });
  const beta = created[created.length - 1];
  assert.deepStrictEqual(runs.runningMissions(), ['lib/mission_alpha/', 'mission_beta/']);

  close(alpha);
  assert.deepStrictEqual(events, ['started lib/mission_alpha/', 'started lib/mission_alpha/,mission_beta/', 'ended mission_beta/']);
  assert.deepStrictEqual(runs.runningMissions(), ['mission_beta/']);
  close(beta);
  assert.deepStrictEqual(runs.runningMissions(), []);
});

test('a click that reaches the extension while its mission runs is refused, as the fallback', () => {
  notifications.length = 0;
  runs.startChain(context, '/project', 'lib/mission_alpha/', 'review', ['echo review'], { path: 'lib/mission_alpha/' });
  const alpha = created[created.length - 1];
  const count = created.length;
  const shown = alpha.shown;
  events.length = 0;
  runs.startChain(context, '/project', 'lib/mission_alpha/', 'review', ['echo review'], { path: 'lib/mission_alpha/' });
  assert.strictEqual(created.length, count);
  assert.deepStrictEqual(notifications, [runs.ALREADY_RUNNING]);
  assert.strictEqual(alpha.shown, shown + 1);
  assert.deepStrictEqual(events, []);
  assert.strictEqual(runs.startLoop('/project', 'lib/mission_alpha/', 'complete', ['/extension/runner.py', 'loop']), false);
  assert.strictEqual(created.length, count);
  close(alpha);
  assert.deepStrictEqual(runs.runningMissions(), []);
});

test('a mission-starting run holds no mission and is still posted', () => {
  events.length = 0;
  runs.startChain(context, '/project', undefined, 'define', ['echo define'], { goal: 'A goal', scope: '.' });
  const starting = created[created.length - 1];
  assert.deepStrictEqual(events, ['started ']);
  assert.deepStrictEqual(runs.runningMissions(), []);
  close(starting);
  assert.deepStrictEqual(events, ['started ', 'ended ']);
});

test("a closed terminal the extension never started is not the end of a run", () => {
  events.length = 0;
  close({ name: 'another', shown: 0 });
  assert.deepStrictEqual(events, []);
});

const LOOP_ARGS = ['/extension/runner.py', 'loop', '--mission', 'mission_gamma/', '--', '<single-task line>'];

test('the runner is told to close a finished run by itself while the auto-close setting is unset or on, for a chain and a loop alike', () => {
  for (const value of [undefined, true]) {
    if (value === undefined) {
      delete settings[runs.AUTO_CLOSE_SETTING];
    } else {
      settings[runs.AUTO_CLOSE_SETTING] = value;
    }
    runs.startChain(context, '/project', 'mission_gamma/', 'review', ['echo review'], { path: 'mission_gamma/' });
    const chain = created[created.length - 1];
    assert.deepStrictEqual(chain.args, ['/extension/runner.py', 'chain', '--close-when-finished', '--', 'echo review']);
    close(chain);
    assert.strictEqual(runs.startLoop('/project', 'mission_gamma/', 'complete', LOOP_ARGS), true);
    const loop = created[created.length - 1];
    assert.deepStrictEqual(loop.args, [
      '/extension/runner.py',
      'loop',
      '--close-when-finished',
      '--mission',
      'mission_gamma/',
      '--',
      '<single-task line>',
    ]);
    close(loop);
  }
});

test('with the auto-close setting off the runner is started without the option, so every run waits for a keypress', () => {
  settings[runs.AUTO_CLOSE_SETTING] = false;
  try {
    runs.startChain(context, '/project', undefined, 'define', ['echo define'], { goal: 'A goal', scope: '.' });
    const chain = created[created.length - 1];
    assert.deepStrictEqual(chain.args, ['/extension/runner.py', 'chain', '--', 'echo define']);
    close(chain);
    assert.strictEqual(runs.startLoop('/project', 'mission_gamma/', 'complete', LOOP_ARGS), true);
    const loop = created[created.length - 1];
    assert.deepStrictEqual(loop.args, LOOP_ARGS);
    close(loop);
  } finally {
    delete settings[runs.AUTO_CLOSE_SETTING];
  }
});

test('the option is written directly after the runner command, the rest of the arguments unchanged', () => {
  assert.deepStrictEqual(runs.runnerArguments(['r.py', 'chain', '--', 'a'], true), ['r.py', 'chain', '--close-when-finished', '--', 'a']);
  assert.deepStrictEqual(runs.runnerArguments(['r.py', 'chain', '--', 'a'], false), ['r.py', 'chain', '--', 'a']);
});

test('the manifest contributes the auto-close setting as a boolean, shipped on', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8')) as {
    contributes: { configuration: { properties: Record<string, { type: string; default: unknown }> } };
  };
  const setting = manifest.contributes.configuration.properties[`gurita.${runs.AUTO_CLOSE_SETTING}`];
  assert.ok(setting !== undefined);
  assert.strictEqual(setting.type, 'boolean');
  assert.strictEqual(setting.default, true);
});
