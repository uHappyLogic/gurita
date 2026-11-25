import { test } from 'node:test';
import * as assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
// A finished mission's window, against a stub of the `vscode` module standing in for the editor: the
// webview panel it opens, the answer its page's ready message gets, read from a git fixture through
// the plugin's own missions tool, the commit documents a click on a commit link opens, and the run its
// Capture principles button starts from the shipped recipe file.
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

/** A terminal the stub's editor created: its name, its runner arguments, its environment, and each time it was shown. */
interface StubTerminal {
  name: string;
  cwd?: string;
  args: string[];
  env?: Record<string, string>;
  shows: (boolean | undefined)[];
  show(preserveFocus?: boolean): void;
}
const terminals: StubTerminal[] = [];
const errors: string[] = [];
const notices: string[] = [];

// The person's own recipe file and variant store are read from a home of the test's own.
process.env.HOME = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-finished-home-')));

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
    getConfiguration: () => ({ get: (_key: string, fallback?: unknown) => fallback }),
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
    showErrorMessage: (message: string) => {
      errors.push(message);
      return Promise.resolve(undefined);
    },
    showInformationMessage: (message: string) => {
      notices.push(message);
      return Promise.resolve(undefined);
    },
    createTerminal(options: { name: string; cwd?: string; shellArgs?: string[]; env?: Record<string, string> }): StubTerminal {
      const terminal: StubTerminal = {
        name: options.name,
        cwd: options.cwd,
        args: [...(options.shellArgs ?? [])],
        env: options.env === undefined ? undefined : { ...options.env },
        shows: [],
        show(preserveFocus?: boolean): void {
          terminal.shows.push(preserveFocus);
        },
      };
      terminals.push(terminal);
      return terminal;
    },
  },
};

/** Every call `open`, the opener a send to Claude Desktop calls, received. */
const desktopOpens: { file: string; args: string[] }[] = [];
/** The `node:child_process` the send module alone is given, standing in for `open`; every other module keeps the real one, for git and the tools. */
const desktopChildProcess = {
  execFile(file: string, args: string[], callback: (error: Error | null, stdout: string, stderr: string) => void): void {
    desktopOpens.push({ file, args: [...args] });
    setImmediate(() => callback(null, '', ''));
  },
};

const load = Module._load;
Module._load = (request, parent, isMain) =>
  request === 'vscode'
    ? stub
    : request === 'node:child_process' && ((parent as { filename?: string } | undefined)?.filename ?? '').endsWith(`${path.sep}desktop.js`)
      ? desktopChildProcess
      : load(request, parent, isMain);
const finishedWindow = require('../finishedWindow') as typeof import('../finishedWindow');
Module._load = load;

const MISSIONS_TOOL = path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py');
const SHIPPED_RECIPES = path.join(__dirname, '..', '..', 'shipped_recipes.md');

/** The project's `workspaceState` as the stub's editor keeps it, by key. */
const workspaceState = new Map<string, unknown>();

const context = {
  subscriptions: [] as unknown[],
  extensionUri: { fsPath: '/extension', path: '/extension' },
  workspaceState: {
    get: (key: string) => workspaceState.get(key),
    update: (key: string, value: unknown) => {
      workspaceState.set(key, JSON.parse(JSON.stringify(value)));
      return Promise.resolve();
    },
  },
  asAbsolutePath: (file: string) =>
    file === 'bundled/missions.py' ? MISSIONS_TOOL : file === 'bundled/shipped_recipes.md' ? SHIPPED_RECIPES : `/extension/${file}`,
} as unknown as import('vscode').ExtensionContext;

/** The line the shipped capture-mission-principle-updates recipe carries. */
const CAPTURE_LINE = 'claude "/gurita:capture-mission-principle-updates <path>" --dangerously-skip-permissions --model "fable" --effort high; # interactive';

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
  assert.deepStrictEqual(
    posted.mission.capture,
    { state: 'offered', lines: [CAPTURE_LINE], variants: [{ name: 'default', own: false }], selected: 0 },
    'the Capture principles button runs the shipped capture-mission-principle-updates recipe, standing on its default',
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

test("a click on Capture principles starts the posted variant's run at the project root, held under the finished mission's path, its path filling <path> with no --mission, and nothing else starts one", async () => {
  const [panel] = panels;
  panel.receive?.({ type: 'capturePrinciples', mission: 'pkg/mission_other/', variant: 'default' });
  panel.receive?.({ type: 'capturePrinciples', mission: MISSION, variant: 'Opus' });
  panel.receive?.({ type: 'capturePrinciples', mission: MISSION });
  assert.strictEqual(terminals.length, 0, 'another mission, a variant not posted, or none starts nothing');

  panel.receive?.({ type: 'capturePrinciples', mission: MISSION, variant: 'default' });
  assert.strictEqual(terminals.length, 1);
  const [run] = terminals;
  assert.strictEqual(run.name, `Gurita: capture-mission-principle-updates (${MISSION})`, "the run is held under the finished mission's path");
  assert.strictEqual(run.cwd, root, 'it starts at the project root');
  assert.deepStrictEqual(run.args, [
    '/extension/runner.py',
    'chain',
    '--close-when-finished',
    '--',
    'claude "/gurita:capture-mission-principle-updates ${GURITA_PATH}" --dangerously-skip-permissions --model "fable" --effort high; # interactive',
  ]);
  assert.ok(!run.args[4].includes('--mission'), 'the path is the positional argument, with no --mission');
  assert.deepStrictEqual(run.env, { GURITA_PATH: MISSION }, "the mission's path is its one value, nothing typed");
  assert.deepStrictEqual(run.shows, [undefined], 'its terminal is shown');

  panel.receive?.({ type: 'capturePrinciples', mission: MISSION, variant: 'default' });
  assert.strictEqual(terminals.length, 1, 'a second click while it is going starts nothing');
  assert.deepStrictEqual(notices, ['A chain is already running for this mission.']);
  assert.deepStrictEqual(run.shows, [undefined, undefined], 'and reveals its terminal');
});

test("an own recipe's variant of capture-mission-principle-updates is offered beside the shipped one, and a pick is remembered once per project and answered again", async () => {
  const [panel] = panels;
  const home = process.env.HOME as string;
  fs.mkdirSync(path.join(home, '.gurita'), { recursive: true });
  const opus = 'claude "/gurita:capture-mission-principle-updates <path>" --model "opus" --effort xhigh; # interactive';
  fs.writeFileSync(path.join(home, '.gurita', 'recipes.md'), `## Recipes\n\n### capture-mission-principle-updates\n#### Opus\n\`\`\`\n${opus}\n\`\`\`\n`);
  const before = panel.posted.length;
  panel.receive?.({ type: 'ready' });
  await until(() => panel.posted.length === before + 1, 'the answer is posted');
  let posted = panel.posted[panel.posted.length - 1] as import('../finishedWindow').FinishedMessage;
  assert.deepStrictEqual(posted.mission.capture, {
    state: 'offered',
    lines: [CAPTURE_LINE],
    variants: [
      { name: 'default', own: false },
      { name: 'Opus', own: true },
    ],
    selected: 0,
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  panel.receive?.({ type: 'selectCaptureVariant', mission: 'pkg/mission_other/', variant: 'Opus' });
  panel.receive?.({ type: 'selectCaptureVariant', mission: MISSION, variant: 'Sonnet' });
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.strictEqual(workspaceState.get('gurita.projectVariantSelections'), undefined, 'another mission or a variant not offered is not remembered');
  assert.strictEqual(panel.posted.length, before + 1);

  panel.receive?.({ type: 'selectCaptureVariant', mission: MISSION, variant: 'Opus' });
  await until(() => panel.posted.length === before + 2, 'the window is answered again');
  assert.deepStrictEqual(workspaceState.get('gurita.projectVariantSelections'), { 'capture-mission-principle-updates': 'Opus' }, 'remembered once per project');
  posted = panel.posted[panel.posted.length - 1] as import('../finishedWindow').FinishedMessage;
  assert.ok(posted.mission.capture?.state === 'offered');
  assert.strictEqual(posted.mission.capture.selected, 1, 'the button stands on the variant picked');
  assert.deepStrictEqual(posted.mission.capture.lines, [opus]);
});

test('a closed window is forgotten, and opening it again creates a fresh one', () => {
  panels[0].dispose();
  assert.deepStrictEqual(finishedWindow.openFinishedWindows(), []);
  finishedWindow.openFinishedWindow(context, root, MISSION, 'The done mission');
  assert.strictEqual(panels.length, 2);
});

test("a Capture principles variant of one claude-desktop line is sent to Claude Desktop through open, the mission's path written in and the project root as folder, starting no run", async () => {
  const other = 'pkg/mission_sent/';
  const home = process.env.HOME as string;
  fs.mkdirSync(path.join(home, '.gurita'), { recursive: true });
  const line = 'claude-desktop "/gurita:capture-mission-principle-updates <path>"; # interactive';
  fs.writeFileSync(path.join(home, '.gurita', 'recipes.md'), `## Recipes\n\n### capture-mission-principle-updates\n#### Desktop\n\`\`\`\n${line}\n\`\`\`\n`);
  const count = panels.length;
  finishedWindow.openFinishedWindow(context, root, other, 'The sent mission');
  const panel = panels[count];
  panel.receive?.({ type: 'ready' });
  await until(() => panel.posted.length === 1, 'the answer is posted');
  await new Promise((resolve) => setTimeout(resolve, 0));
  panel.receive?.({ type: 'selectCaptureVariant', mission: other, variant: 'Desktop' });
  await until(() => panel.posted.length === 2, 'the window is answered again');
  const posted = panel.posted[1] as import('../finishedWindow').FinishedMessage;
  assert.ok(posted.mission.capture?.state === 'offered');
  assert.deepStrictEqual(posted.mission.capture.lines, [line]);

  const terminalCount = terminals.length;
  const errorCount = errors.length;
  const noticeCount = notices.length;
  panel.receive?.({ type: 'capturePrinciples', mission: other, variant: 'Desktop' });
  await until(() => desktopOpens.length === 1, 'the link is passed to open');
  assert.deepStrictEqual(desktopOpens, [
    {
      file: 'open',
      args: [`claude://code/new?q=${encodeURIComponent(`/gurita:capture-mission-principle-updates ${other}`)}&folder=${encodeURIComponent(root)}`],
    },
  ]);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.strictEqual(terminals.length, terminalCount, 'no terminal is created');
  assert.strictEqual(errors.length, errorCount, 'a send that went out shows nothing');
  assert.strictEqual(notices.length, noticeCount);

  // Nothing is held under the mission's path, so a second click sends again.
  panel.receive?.({ type: 'capturePrinciples', mission: other, variant: 'Desktop' });
  await until(() => desktopOpens.length === 2, 'a second click sends again');
  assert.strictEqual(terminals.length, terminalCount);
});
