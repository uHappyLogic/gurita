import { test } from 'node:test';
import * as assert from 'node:assert';
// The run path against a stub of the `vscode` module, standing in for the editor: the terminals it
// creates, the terminal-close event, and the notification.
const Module = require('node:module') as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};

interface StubTerminal {
  name: string;
  shown: number;
}

const created: StubTerminal[] = [];
const notifications: string[] = [];
let closeListener: ((terminal: StubTerminal) => void) | undefined;

const stub = {
  window: {
    createTerminal(options: { name: string }): StubTerminal {
      const terminal = { name: options.name, shown: 0, show(): void {} };
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

test("a tab click shows the terminal of its mission's held run, with no notification", () => {
  notifications.length = 0;
  runs.startChain(context, '/project', 'lib/mission_alpha/', 'review', ['echo review'], { path: 'lib/mission_alpha/' });
  const alpha = created[created.length - 1];
  runs.startChain(context, '/project', 'mission_beta/', 'review', ['echo review'], { path: 'mission_beta/' });
  const beta = created[created.length - 1];
  const count = created.length;
  const [alphaShown, betaShown] = [alpha.shown, beta.shown];
  events.length = 0;
  assert.strictEqual(runs.showRun('lib/mission_alpha/'), true);
  assert.strictEqual(alpha.shown, alphaShown + 1);
  assert.strictEqual(beta.shown, betaShown);
  assert.strictEqual(runs.showRun('lib/mission_alpha/'), true);
  assert.strictEqual(alpha.shown, alphaShown + 2);
  assert.deepStrictEqual(notifications, []);
  assert.strictEqual(created.length, count);
  assert.deepStrictEqual(events, []);
  assert.deepStrictEqual(runs.runningMissions(), ['lib/mission_alpha/', 'mission_beta/']);
  close(alpha);
  close(beta);
});

test('a tab click shows nothing and no notification for a mission with no held run', () => {
  notifications.length = 0;
  runs.startChain(context, '/project', 'mission_beta/', 'review', ['echo review'], { path: 'mission_beta/' });
  const beta = created[created.length - 1];
  runs.startChain(context, '/project', undefined, 'define', ['echo define'], { goal: 'A goal', scope: '.' });
  const starting = created[created.length - 1];
  const shown = created.map((terminal) => terminal.shown);
  const count = created.length;
  events.length = 0;
  assert.strictEqual(runs.showRun('lib/mission_alpha/'), false);
  close(beta);
  assert.strictEqual(runs.showRun('mission_beta/'), false, 'a run whose terminal closed is no longer shown');
  assert.deepStrictEqual(created.map((terminal) => terminal.shown), shown);
  assert.deepStrictEqual(notifications, []);
  assert.strictEqual(created.length, count);
  close(starting);
});

test("a closed terminal the extension never started is not the end of a run", () => {
  events.length = 0;
  close({ name: 'another', shown: 0 });
  assert.deepStrictEqual(events, []);
});
