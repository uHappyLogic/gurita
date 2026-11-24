import { test } from 'node:test';
import * as assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
// A finished mission's window, against a stub of the `vscode` module standing in for the editor: the
// webview panel it opens, the answer its page's ready message gets, read from a git fixture through
// the plugin's own missions tool, and the commit documents a click on a commit link opens.
const Module = require('node:module') as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};

const disposable = { dispose(): void {} };

/** A webview panel the stub's editor created: its view type, title, icon, page shell, reveals, posts, and the listener its page's messages reach. */
interface StubPanel {
  viewType: string;
  title: string;
  iconPath?: { id: string };
  html: string;
  reveals: number;
  posted: unknown[];
  receive?: (message: unknown) => void;
  dispose(): void;
}
const panels: StubPanel[] = [];

/** A URI as the stub's editor builds it from its components. */
interface StubUri {
  scheme: string;
  path: string;
  query: string;
}

/** Every text document the stub's editor opened, by URI. */
const opened: StubUri[] = [];
const shown: unknown[] = [];

const stub = {
  Uri: {
    joinPath: (base: { path: string }, ...segments: string[]) => ({ path: [base.path, ...segments].join('/') }),
    from: (components: StubUri): StubUri => ({ scheme: components.scheme, path: components.path, query: components.query }),
  },
  ViewColumn: { Active: -1 },
  ThemeIcon: class {
    constructor(readonly id: string) {}
  },
  workspace: {
    openTextDocument: (uri: StubUri) => {
      opened.push(uri);
      return Promise.resolve({ uri, languageId: 'diff' });
    },
  },
  languages: {
    setTextDocumentLanguage: (document: unknown) => Promise.resolve(document),
  },
  window: {
    createWebviewPanel(viewType: string, title: string): unknown {
      let disposed: (() => void) | undefined;
      const record: StubPanel = {
        viewType,
        title,
        html: '',
        reveals: 0,
        posted: [],
        dispose(): void {
          const listener = disposed;
          disposed = undefined;
          listener?.();
        },
      };
      panels.push(record);
      const panel = {
        set iconPath(icon: { id: string }) {
          record.iconPath = icon;
        },
        reveal(): void {
          record.reveals++;
        },
        webview: {
          set html(html: string) {
            record.html = html;
          },
          cspSource: 'stub-csp',
          asWebviewUri: (uri: { path: string }) => ({ toString: () => `webview:${uri.path}` }),
          onDidReceiveMessage: (listener: (message: unknown) => void) => {
            record.receive = listener;
            return disposable;
          },
          postMessage: (message: unknown) => {
            record.posted.push(message);
            return Promise.resolve(true);
          },
        },
        onDidDispose: (listener: () => void) => {
          disposed = listener;
          return disposable;
        },
        dispose: () => record.dispose(),
      };
      return panel;
    },
    showTextDocument: (document: unknown) => {
      shown.push(document);
      return Promise.resolve(undefined);
    },
    showErrorMessage: () => Promise.resolve(undefined),
  },
};

const load = Module._load;
Module._load = (request, parent, isMain) => (request === 'vscode' ? stub : load(request, parent, isMain));
const finishedWindow = require('../finishedWindow') as typeof import('../finishedWindow');
Module._load = load;

const MISSIONS_TOOL = path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py');

const context = {
  subscriptions: [] as unknown[],
  extensionUri: { fsPath: '/extension', path: '/extension' },
  asAbsolutePath: (file: string) => (file === 'bundled/missions.py' ? MISSIONS_TOOL : `/extension/${file}`),
} as unknown as import('vscode').ExtensionContext;

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { cwd, encoding: 'utf8' });
}

const MISSION = 'pkg/mission_done/';

/** A project whose mission `MISSION` completed one task and was finished, returning its root and the task commit's abbreviated hash. */
function project(): { root: string; hash: string } {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-finished-window-')));
  git(root, 'init', '-q');
  const dir = path.join(root, MISSION);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'requirements.md'), '# The done mission\n\n## Goal\n\nA goal.\n');
  fs.writeFileSync(path.join(dir, 'open_questions.xml'), '<open-questions/>\n');
  fs.writeFileSync(path.join(dir, 'TASKS_TODO.md'), '# TASKS TODO\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', `Mission-definition: ${MISSION}`);
  fs.writeFileSync(path.join(dir, 'TASKS_TODO.md'), '# TASKS TODO\n\n## Build It\n\nBuild it.\n\n---\n');
  git(root, 'commit', '-q', '-am', `Task-derivation: ${MISSION}`);
  fs.writeFileSync(path.join(dir, 'TASKS_TODO.md'), '# TASKS TODO\n');
  git(root, 'commit', '-q', '-am', 'Task-completion: Build It\n\n- It is `built`');
  const hash = git(root, 'rev-parse', '--short', 'HEAD').trim();
  git(root, 'rm', '-r', '-q', MISSION);
  git(root, 'commit', '-q', '-m', `Mission-finish: ${MISSION}\n\nThe done mission\n\n- It was built.`);
  return { root, hash };
}

/** Waits until `condition` holds, failing with `what` after a few seconds. */
async function until(condition: () => boolean, what: string): Promise<void> {
  for (let attempt = 0; attempt < 400; attempt++) {
    if (condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail(`timed out waiting until ${what}`);
}

const { root, hash } = project();

test("opening a finished mission's window creates one panel of its own view type, titled with the mission's title, loading the text renderer and its page script", () => {
  finishedWindow.openFinishedWindow(context, root, MISSION, 'The done mission');
  assert.strictEqual(panels.length, 1);
  const [panel] = panels;
  assert.strictEqual(panel.viewType, finishedWindow.FINISHED_VIEW_TYPE);
  assert.strictEqual(panel.title, 'The done mission');
  assert.strictEqual(panel.iconPath?.id, finishedWindow.FINISHED_WINDOW_ICON);
  const scripts = [...panel.html.matchAll(/<script nonce="[^"]+" src="webview:([^"]+)"><\/script>/g)].map((match) => match[1]);
  assert.deepStrictEqual(scripts, ['/extension/out/webview/text.js', '/extension/out/webview/finished.js']);
  assert.deepStrictEqual(finishedWindow.openFinishedWindows(), [MISSION]);
  finishedWindow.openFinishedWindow(context, root, MISSION, 'The done mission');
  assert.strictEqual(panels.length, 1, 'a second open creates no second window');
  assert.strictEqual(panel.reveals, 1, 'it reveals the open one');
});

test("the page's ready message is answered with the mission's summary and its completed tasks, each with its verified bar, read from the record", async () => {
  const [panel] = panels;
  panel.receive?.({ type: 'ready' });
  await until(() => panel.posted.length === 1, 'the answer is posted');
  const posted = panel.posted[0] as import('../finishedWindow').FinishedMessage;
  assert.strictEqual(posted.type, 'finished');
  assert.strictEqual(posted.mission.path, MISSION);
  assert.strictEqual(posted.mission.title, 'The done mission');
  assert.strictEqual(posted.mission.summary.state, 'read');
  assert.deepStrictEqual(posted.mission.summary.state === 'read' ? posted.mission.summary.summary : undefined, {
    date: posted.mission.summary.state === 'read' ? posted.mission.summary.summary.date : '',
    title: 'The done mission',
    summary: '- It was built.',
  });
  assert.match(posted.mission.summary.state === 'read' ? posted.mission.summary.summary.date : '', /^\d{4}-\d{2}-\d{2}$/);
  assert.deepStrictEqual(
    posted.mission.completed.state === 'read' ? posted.mission.completed.tasks.map(({ hash: each, title, bar }) => ({ hash: each, title, bar })) : [],
    [{ hash, title: 'Build It', bar: '- It is `built`' }],
  );
});

test('a click on a posted commit link opens that commit as a document of the commit scheme, and any other hash or mission opens nothing', async () => {
  const [panel] = panels;
  panel.receive?.({ type: 'openCommit', mission: MISSION, hash: 'abcdef0' });
  panel.receive?.({ type: 'openCommit', mission: 'pkg/mission_other/', hash });
  panel.receive?.({ type: 'openCommit', mission: MISSION, hash: ['abc'] });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.deepStrictEqual(opened, [], 'nothing opens for a hash not posted or another mission');
  panel.receive?.({ type: 'openCommit', mission: MISSION, hash });
  await until(() => shown.length === 1, 'the commit is shown');
  assert.deepStrictEqual(opened, [{ scheme: 'gurita-commit', path: `/${hash}.diff`, query: root }]);
});

test('a closed window is forgotten, and opening it again creates a fresh one', () => {
  panels[0].dispose();
  assert.deepStrictEqual(finishedWindow.openFinishedWindows(), []);
  finishedWindow.openFinishedWindow(context, root, MISSION, 'The done mission');
  assert.strictEqual(panels.length, 2);
});
