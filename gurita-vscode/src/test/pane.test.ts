import { test } from 'node:test';
import * as assert from 'node:assert';
// The pane's answer to a tab click, against a stub of the `vscode` module standing in for the
// editor: the webview panel and the messages its page posts, the terminals the run path creates,
// and the notifications.
const Module = require('node:module') as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};

interface StubTerminal {
  name: string;
  /** The `preserveFocus` argument of every `show` call, in order. */
  shows: (boolean | undefined)[];
}

const created: StubTerminal[] = [];
const notifications: string[] = [];
/** Every message the extension posted to the page. */
const posted: unknown[] = [];
let receive: ((message: unknown) => void) | undefined;

function notify(message: string): Promise<undefined> {
  notifications.push(message);
  return Promise.resolve(undefined);
}

const disposable = { dispose(): void {} };

const stub = {
  Uri: {
    joinPath: (...parts: unknown[]) => ({ parts }),
    file: (fsPath: string) => ({ fsPath }),
  },
  ViewColumn: { Active: -1 },
  window: {
    createWebviewPanel(): unknown {
      return {
        visible: true,
        reveal(): void {},
        webview: {
          html: '',
          cspSource: 'stub-csp',
          asWebviewUri: (uri: unknown) => ({ toString: () => `webview:${JSON.stringify(uri)}` }),
          onDidReceiveMessage(listener: (message: unknown) => void) {
            receive = listener;
            return disposable;
          },
          postMessage(message: unknown): Promise<boolean> {
            posted.push(message);
            return Promise.resolve(true);
          },
        },
        onDidChangeViewState: () => disposable,
        onDidDispose: () => disposable,
      };
    },
    createTerminal(options: { name: string }): StubTerminal & { show(preserveFocus?: boolean): void } {
      const terminal = {
        name: options.name,
        shows: [] as (boolean | undefined)[],
        show(preserveFocus?: boolean): void {
          terminal.shows.push(preserveFocus);
        },
      };
      created.push(terminal);
      return terminal;
    },
    onDidCloseTerminal: () => disposable,
    showInformationMessage: notify,
    showWarningMessage: notify,
    showErrorMessage: notify,
  },
};

const load = Module._load;
Module._load = (request, parent, isMain) => (request === 'vscode' ? stub : load(request, parent, isMain));
const pane = require('../pane') as typeof import('../pane');
const runs = require('../runs') as typeof import('../runs');
Module._load = load;

const context = {
  subscriptions: [] as unknown[],
  extensionUri: { fsPath: '/extension' },
  asAbsolutePath: (file: string) => `/extension/${file}`,
} as unknown as import('vscode').ExtensionContext;

const ALPHA = 'lib/mission_alpha/';
const BETA = 'mission_beta/';

pane.openMissionPane(context);

/** Delivers a message to the extension as the page posts it. */
function send(message: unknown): void {
  assert.ok(receive !== undefined, 'the pane listens to its page');
  receive(message);
}

/** Starts a held run for `mission` through the run path and returns its terminal. */
function startRun(mission: string): StubTerminal {
  runs.startChain(context, '/project', mission, 'review', ['echo review'], { path: mission });
  return created[created.length - 1];
}

test("a tab click's message brings forward and focuses the terminal of its mission's held run, with no notification", () => {
  const alpha = startRun(ALPHA);
  const beta = startRun(BETA);
  const [alphaShows, betaShows] = [alpha.shows.length, beta.shows.length];
  const count = created.length;
  notifications.length = 0;
  posted.length = 0;
  send({ type: 'missionTab', mission: ALPHA });
  assert.deepStrictEqual(alpha.shows.slice(alphaShows), [undefined], 'shown once, taking the focus');
  assert.strictEqual(beta.shows.length, betaShows, "the other mission's terminal is not shown");
  send({ type: 'missionTab', mission: ALPHA });
  assert.deepStrictEqual(alpha.shows.slice(alphaShows), [undefined, undefined], 'every click shows it again');
  assert.deepStrictEqual(notifications, []);
  assert.strictEqual(created.length, count, 'no terminal is created');
  assert.deepStrictEqual(posted, [], 'nothing is posted to the page');
});

test("a tab click's message for a mission with no held run shows nothing and no notification", () => {
  const shows = created.map((terminal) => terminal.shows.length);
  const count = created.length;
  notifications.length = 0;
  posted.length = 0;
  send({ type: 'missionTab', mission: 'other/mission_gamma/' });
  send({ type: 'missionTab' });
  assert.deepStrictEqual(
    created.map((terminal) => terminal.shows.length),
    shows,
    'no terminal is shown',
  );
  assert.deepStrictEqual(notifications, []);
  assert.strictEqual(created.length, count, 'no terminal is created');
  assert.deepStrictEqual(posted, [], 'nothing is posted to the page');
});
