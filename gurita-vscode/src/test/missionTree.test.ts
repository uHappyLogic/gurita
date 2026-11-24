import { test } from 'node:test';
import * as assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { WATCHED_PATTERN } from '../refresh';
// The side-bar view's tree, against a stub of the `vscode` module standing in for the editor: a
// tree stand-in recording the view the extension creates and its data provider, the event
// emitter, tree items, and theme icons, beside the file system watcher, the terminals, the
// mission windows a row's click opens, the commands, the input boxes and input panels, the QuickPick,
// `workspaceState`, and the notifications the extension's activation reaches.
const Module = require('node:module') as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};

const disposable = { dispose(): void {} };

/** A file system watcher the stub's editor created: the glob it was created over and the listeners registered on it by event kind. */
interface StubWatcher {
  pattern: string;
  listeners: Record<'create' | 'change' | 'delete', ((uri: { fsPath: string }) => void)[]>;
}
const watchers: StubWatcher[] = [];

/** The watchers over the mission documents, leaving out the one over the git state. */
function documentWatchers(): StubWatcher[] {
  return watchers.filter((each) => each.pattern === WATCHED_PATTERN);
}

/** A terminal the stub's editor created, with the options it was created with. */
interface StubTerminal {
  name: string;
  options: { name: string; shellArgs?: string[]; cwd?: string; env?: Record<string, string> };
  show(preserveFocus?: boolean): void;
}
const terminals: StubTerminal[] = [];
let closeTerminal: ((terminal: StubTerminal) => void) | undefined;

/** A webview panel the stub's editor created: its view type, its title, its reveals, and the listener its page's messages reach. */
interface StubPanel {
  viewType: string;
  title: string;
  reveals: number;
  receive?: (message: unknown) => void;
}
/** Every webview panel the stub's editor created, in order. */
const webviewPanels: StubPanel[] = [];

/** The commands the extension registered, by id. */
const commands = new Map<string, (...args: unknown[]) => unknown>();

/** The answers the next input boxes give, in order, and the prompts each box was opened with. */
const inputAnswers: (string | undefined)[] = [];
const inputPrompts: string[] = [];

/** A QuickPick item as the extension offers it. */
interface StubPickItem {
  label: string;
  description?: string;
  detail?: string;
}
/** Every QuickPick the extension opened, with its items, and the label the next one picks, undefined dismissing it. */
const quickPicks: { items: StubPickItem[]; options: { title?: string } }[] = [];
let nextPick: string | undefined;

/** The error notifications the extension showed. */
const errors: string[] = [];

/** The information and warning notifications the extension showed. */
const notices: string[] = [];

/** The tree data provider the stub's editor was given, as the tree stand-in holds it. */
interface StubProvider {
  onDidChangeTreeData: (listener: () => void) => { dispose(): void };
  getTreeItem(element: unknown): StubTreeItem;
  getChildren(element?: unknown): unknown[];
}
/** Every tree view the extension created, by the view id it named, with the view object it was given. */
const treeViews: { id: string; provider: StubProvider; view: { message?: string; dispose(): void } }[] = [];

class StubTreeItem {
  id?: string;
  description?: string;
  tooltip?: string;
  iconPath?: StubThemeIcon;
  command?: { command: string; title: string; arguments?: unknown[] };
  contextValue?: string;
  constructor(
    readonly label: string,
    readonly collapsibleState: number,
  ) {}
}

class StubThemeIcon {
  constructor(readonly id: string) {}
}

class StubEventEmitter<T> {
  private listeners: ((value: T) => void)[] = [];
  readonly event = (listener: (value: T) => void) => {
    this.listeners.push(listener);
    return {
      dispose: () => {
        this.listeners = this.listeners.filter((each) => each !== listener);
      },
    };
  };
  fire(value: T): void {
    for (const listener of [...this.listeners]) {
      listener(value);
    }
  }
  dispose(): void {
    this.listeners = [];
  }
}

const workspace = { folders: undefined as { uri: { fsPath: string } }[] | undefined };
const packaged = new Map<string, string>();

const stub = {
  Uri: {
    joinPath: (...parts: unknown[]) => ({ parts }),
    file: (fsPath: string) => ({ fsPath }),
  },
  ViewColumn: { Active: -1 },
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  TreeItem: StubTreeItem,
  ThemeIcon: StubThemeIcon,
  EventEmitter: StubEventEmitter,
  RelativePattern: class {
    constructor(
      readonly base: unknown,
      readonly pattern: string,
    ) {}
  },
  commands: {
    registerCommand(id: string, run: (...args: unknown[]) => unknown) {
      commands.set(id, run);
      return disposable;
    },
  },
  workspace: {
    get workspaceFolders() {
      return workspace.folders;
    },
    getConfiguration: () => ({ get: () => undefined }),
    createFileSystemWatcher: (glob: { pattern: string }) => {
      const watcher: StubWatcher = { pattern: glob.pattern, listeners: { create: [], change: [], delete: [] } };
      watchers.push(watcher);
      const on = (kind: keyof StubWatcher['listeners']) => (listener: (uri: { fsPath: string }) => void) => {
        watcher.listeners[kind].push(listener);
        return disposable;
      };
      return { onDidCreate: on('create'), onDidChange: on('change'), onDidDelete: on('delete'), dispose(): void {} };
    },
    registerTextDocumentContentProvider: () => disposable,
  },
  window: {
    createWebviewPanel(viewType: string, title: string): unknown {
      const record: StubPanel = { viewType, title, reveals: 0 };
      webviewPanels.push(record);
      let receive: ((message: unknown) => void) | undefined;
      let disposed: (() => void) | undefined;
      const panel = {
        visible: true,
        reveal(): void {
          record.reveals++;
        },
        webview: {
          html: '',
          cspSource: 'stub-csp',
          asWebviewUri: (uri: unknown) => ({ toString: () => `webview:${JSON.stringify(uri)}` }),
          onDidReceiveMessage: (listener: (message: unknown) => void) => {
            receive = listener;
            record.receive = listener;
            return disposable;
          },
          postMessage: (message: { type?: string; prompt?: string }) => {
            if (message?.type === 'input' && typeof message.prompt === 'string') {
              inputPrompts.push(message.prompt);
            }
            return Promise.resolve(true);
          },
        },
        onDidChangeViewState: () => disposable,
        onDidDispose: (listener: () => void) => {
          disposed = listener;
          return disposable;
        },
        dispose(): void {
          const listener = disposed;
          disposed = undefined;
          listener?.();
        },
      };
      // An input panel is answered as its page and the person do: its ready message, then Run with
      // the next of `inputAnswers` typed, or, that answer undefined, its tab closed.
      if (viewType === 'gurita.input') {
        setTimeout(() => {
          receive?.({ type: 'ready' });
          const typed = inputAnswers.shift();
          if (typed === undefined) {
            panel.dispose();
          } else {
            receive?.({ type: 'run', value: typed });
          }
        }, 0);
      }
      return panel;
    },
    registerWebviewPanelSerializer: () => disposable,
    createTreeView(id: string, options: { treeDataProvider: StubProvider }) {
      const view: { message?: string; dispose(): void } = { ...disposable, message: undefined };
      treeViews.push({ id, provider: options.treeDataProvider, view });
      return view;
    },
    createTerminal(options: StubTerminal['options']): StubTerminal {
      const terminal = { name: options.name, options, show(): void {} };
      terminals.push(terminal);
      return terminal;
    },
    onDidCloseTerminal(listener: (terminal: StubTerminal) => void) {
      closeTerminal = listener;
      return disposable;
    },
    showInformationMessage: (message: string) => {
      notices.push(message);
      return Promise.resolve(undefined);
    },
    showWarningMessage: (message: string) => {
      notices.push(message);
      return Promise.resolve(undefined);
    },
    showErrorMessage: (message: string) => {
      errors.push(message);
      return Promise.resolve(undefined);
    },
    showInputBox: (options: { prompt: string }) => {
      inputPrompts.push(options.prompt);
      return Promise.resolve(inputAnswers.shift());
    },
    showQuickPick: <T extends StubPickItem>(items: T[], options: { title?: string }) => {
      quickPicks.push({ items, options });
      return Promise.resolve(items.find((item) => item.label === nextPick));
    },
  },
};

const load = Module._load;
Module._load = (request, parent, isMain) => (request === 'vscode' ? stub : load(request, parent, isMain));
const extension = require('../extension') as typeof import('../extension');
const runs = require('../runs') as typeof import('../runs');
const missionTree = require('../missionTree') as typeof import('../missionTree');
const pane = require('../pane') as typeof import('../pane');
const startingRows = require('../startingRows') as typeof import('../startingRows');
const selections = require('../selections') as typeof import('../selections');
const settingsWindow = require('../settingsWindow') as typeof import('../settingsWindow');
const pluginNotice = require('../pluginNotice') as typeof import('../pluginNotice');
const bootstrapOffer = require('../bootstrapOffer') as typeof import('../bootstrapOffer');
Module._load = load;

/** The project's `workspaceState`, by key. */
const stored = new Map<string, unknown>();

const context = {
  subscriptions: [] as unknown[],
  extensionUri: { fsPath: '/extension' },
  asAbsolutePath: (file: string) => packaged.get(file) ?? `/extension/${file}`,
  workspaceState: {
    keys: () => [...stored.keys()],
    get: (key: string) => stored.get(key),
    update: (key: string, value: unknown) => {
      stored.set(key, value);
      return Promise.resolve();
    },
  },
} as unknown as import('vscode').ExtensionContext;

const ALPHA = 'lib/mission_alpha/';
const BETA = 'mission_beta/';
const GAMMA = 'pkg/mission_gamma/';
const DELTA = 'tools/mission_delta/';

const TWO_QUESTIONS =
  '<open-questions>\n' +
  '  <open-question id="Pane Layout">\n    <question>Which layout?</question>\n  </open-question>\n' +
  '  <open-question id="Tab Order">\n    <question>Which order?</question>\n  </open-question>\n' +
  '</open-questions>\n';

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { cwd, stdio: 'ignore' });
}

/** Writes `files`, by path from the project root, and commits them under `subject`. */
function commit(root: string, subject: string, files: Record<string, string>): void {
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', subject);
}

/** A context file holding the workflow section, which keeps the bootstrap offer row away. */
const BOOTSTRAPPED = '# Project\n\nNotes.\n\n## Mission Workflow\n\nThis project uses the mission-driven workflow.\n';

/** A fresh empty git project whose `CLAUDE.md` holds the workflow section, so no bootstrap offer row stands. */
function emptyProject(): string {
  const empty = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-tree-empty-')));
  git(empty, 'init', '-q');
  fs.writeFileSync(path.join(empty, 'CLAUDE.md'), BOOTSTRAPPED);
  return empty;
}

/**
 * A fresh git project of four live missions, its `CLAUDE.md` holding the workflow section: alpha
 * with two questions lacking alternatives and no task, beta with no question and one task, gamma
 * with no question document, and delta with no question and a task list holding a conflict marker.
 */
function project(): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-tree-')));
  git(root, 'init', '-q');
  commit(root, 'Workflow-bootstrap: missions', { 'CLAUDE.md': BOOTSTRAPPED });
  commit(root, `Mission-definition: ${ALPHA}`, {
    [`${ALPHA}requirements.md`]: '# Alpha mission\n\n## Goal\n\nA goal.\n',
    [`${ALPHA}open_questions.xml`]: TWO_QUESTIONS,
    [`${ALPHA}TASKS_TODO.md`]: '# TASKS TODO\n',
  });
  commit(root, `Mission-definition: ${BETA}`, {
    [`${BETA}requirements.md`]: '# Beta mission\n\n## Goal\n\nA goal.\n',
    [`${BETA}open_questions.xml`]: '<open-questions/>\n',
    [`${BETA}TASKS_TODO.md`]: '# TASKS TODO\n',
  });
  commit(root, `Task-derivation: ${BETA}`, { [`${BETA}TASKS_TODO.md`]: '# TASKS TODO\n\n## Build it\n\nBuild it.\n\n---\n' });
  commit(root, `Mission-definition: ${GAMMA}`, {
    [`${GAMMA}requirements.md`]: '# Gamma mission\n\n## Goal\n\nA goal.\n',
    [`${GAMMA}TASKS_TODO.md`]: '# TASKS TODO\n',
  });
  commit(root, `Mission-definition: ${DELTA}`, {
    [`${DELTA}requirements.md`]: '# Delta mission\n\n## Goal\n\nA goal.\n',
    [`${DELTA}open_questions.xml`]: '<open-questions/>\n',
    [`${DELTA}TASKS_TODO.md`]: '# TASKS TODO\n\n<<<<<<< ours\n## One\n=======\n## Two\n>>>>>>> theirs\n',
  });
  return root;
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

process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-tree-home-'));
packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
packaged.set('bundled/shipped_recipes.md', path.join(__dirname, '..', '..', 'shipped_recipes.md'));

/**
 * A stand-in for the packaged check script, logging each run and printing the result the test last
 * wrote to `CHECK_RESULT`, or, while `CHECK_FAILS` exists, failing with its text on stderr.
 */
const checkDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-tree-check-'));
const CHECK_LOG = path.join(checkDir, 'runs.log');
const CHECK_RESULT = path.join(checkDir, 'result.json');
const CHECK_FAILS = path.join(checkDir, 'fails.txt');
fs.writeFileSync(
  path.join(checkDir, 'harness_check.py'),
  [
    'import os, sys',
    `open(${JSON.stringify(CHECK_LOG)}, "a").write("run\\n")`,
    `if os.path.exists(${JSON.stringify(CHECK_FAILS)}):`,
    `    sys.stderr.write(open(${JSON.stringify(CHECK_FAILS)}).read())`,
    '    sys.exit(1)',
    `sys.stdout.write(open(${JSON.stringify(CHECK_RESULT)}).read())`,
    '',
  ].join('\n'),
);
fs.writeFileSync(path.join(checkDir, 'plugin_version.txt'), '2.0.0\n');
packaged.set('harness_check.py', path.join(checkDir, 'harness_check.py'));
packaged.set('bundled/plugin_version.txt', path.join(checkDir, 'plugin_version.txt'));

/** One harness's print as the check script gives it. */
type PrintedHarness = { found: boolean; installed: boolean; version: string | null; disabled?: boolean; error?: string };
const PASSING: PrintedHarness = { found: true, installed: true, version: '2.0.0' };

/** Writes the result the stand-in check prints next: every harness passing but those `changed` names. */
function checkPrints(changed: Partial<Record<'claude' | 'antigravity' | 'codex', PrintedHarness>> = {}): void {
  fs.writeFileSync(CHECK_RESULT, JSON.stringify({ claude: PASSING, antigravity: PASSING, codex: PASSING, ...changed }));
}
checkPrints();

/** The number of times the check script ran. */
function checkRuns(): number {
  return fs.existsSync(CHECK_LOG) ? fs.readFileSync(CHECK_LOG, 'utf8').split('\n').filter((line) => line !== '').length : 0;
}

/** The line of the own variant `quick` that `define-mission-goal` gains from the own recipe file. */
const QUICK_LINE = 'agy -p "/gurita:define-mission-goal --at <scope> <goal>" --model "gemini-4-argon" --effort low;';
fs.mkdirSync(path.join(process.env.HOME, '.gurita'));
fs.writeFileSync(
  path.join(process.env.HOME, '.gurita', 'recipes.md'),
  '### define-mission-goal\n\n#### quick\n```\n' + QUICK_LINE + '\n```\n',
);

/** The labels of the two mission-starting rows, standing above every mission row. */
const STARTING_LABELS = ['New mission', 'Define mission'];
const root = project();
workspace.folders = [{ uri: { fsPath: root } }];

extension.activate(context);
assert.strictEqual(treeViews.length, 1, 'activation creates one tree view');
const { provider, view } = treeViews[0];
let redraws = 0;
provider.onDidChangeTreeData(() => {
  redraws++;
});

/** The tree items of the view's root, as the editor draws them on resolving it. */
function items(): StubTreeItem[] {
  return provider.getChildren().map((row) => provider.getTreeItem(row));
}

function item(label: string): StubTreeItem {
  const found = items().find((each) => each.label === label);
  assert.ok(found !== undefined, `no row labelled ${label}`);
  return found;
}

test("the tree is created under the manifest's view id, and nothing is read before the view's first resolution, which starts the session's read", async () => {
  assert.strictEqual(treeViews[0].id, missionTree.MISSIONS_VIEW);
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.strictEqual(watchers.length, 0, 'no file is watched before the view is resolved');
  assert.strictEqual(redraws, 0, 'no read is kept before the view is resolved');
  assert.strictEqual(checkRuns(), 0, 'the harness check does not run before the view is resolved');
  assert.deepStrictEqual(
    items().map((each) => each.label),
    STARTING_LABELS,
    'the first resolution draws the two mission-starting rows and no mission row until the read settles',
  );
  await until(() => redraws > 0, 'the first read redraws the tree');
  assert.strictEqual(documentWatchers().length, 1, 'the first read that succeeds watches the mission documents');
  await until(() => checkRuns() === 1, "the view's first resolution runs the harness check in the background");
  assert.deepStrictEqual(
    items().map((each) => each.label),
    [...STARTING_LABELS, 'Alpha mission', 'Beta mission', 'Gamma mission', 'Delta mission'],
    'one row per live mission, in the order the live read prints them, beneath the two mission-starting rows',
  );
  for (const row of provider.getChildren()) {
    assert.deepStrictEqual(provider.getChildren(row), [], 'no row has child rows');
  }
});

test("each row is a leaf labelled with the title, described by the step and both counts, with the path and five facts in its tooltip, its click running the open-mission command with its path", () => {
  const alpha = item('Alpha mission');
  assert.strictEqual(alpha.collapsibleState, stub.TreeItemCollapsibleState.None);
  assert.deepStrictEqual(alpha.command, { command: missionTree.OPEN_MISSION_COMMAND, title: 'Open Mission', arguments: [ALPHA] });
  assert.strictEqual(alpha.id, ALPHA);
  assert.strictEqual(alpha.description, 'First review round · 2 questions · 0 tasks');
  assert.strictEqual(
    alpha.tooltip,
    ['Alpha mission', ALPHA, 'Next step: First review round', 'Open questions: 2', 'Remaining tasks: 0', 'Run: not going'].join('\n'),
  );
  assert.strictEqual(alpha.iconPath?.id, missionTree.MISSION_ICON);
  assert.strictEqual(item('Beta mission').description, 'Execute tasks · 0 questions · 1 task');
});

test("a click on a mission's row opens that mission's own window in the editor area, a second click revealing it, and several missions' windows open at once", () => {
  const open = commands.get(missionTree.OPEN_MISSION_COMMAND);
  assert.ok(open !== undefined, 'activation registers the open-mission command');
  const count = webviewPanels.length;
  const click = (label: string) => {
    const row = item(label);
    assert.ok(row.command !== undefined);
    commands.get(row.command.command)?.(...(row.command.arguments ?? []));
  };
  click('Alpha mission');
  assert.deepStrictEqual(
    webviewPanels.slice(count).map((each) => [each.viewType, each.title]),
    [[pane.MISSION_VIEW_TYPE, 'Alpha mission']],
    "the click opens one window of the mission view type, titled with the mission's title",
  );
  click('Beta mission');
  assert.deepStrictEqual(
    webviewPanels.slice(count).map((each) => each.title),
    ['Alpha mission', 'Beta mission'],
    "another mission's click opens a window of its own beside the first",
  );
  click('Alpha mission');
  assert.strictEqual(webviewPanels.length, count + 2, 'a click for a mission whose window is open creates no second window');
  assert.strictEqual(webviewPanels[count].reveals, 1, 'it reveals the open window');
  assert.strictEqual(webviewPanels[count + 1].reveals, 0);
  assert.deepStrictEqual(pane.openMissionWindows(), [ALPHA, BETA]);
  const before = terminals.length;
  open?.();
  open?.(42);
  assert.strictEqual(webviewPanels.length, count + 2, 'the command opens nothing without a mission path');
  assert.strictEqual(terminals.length, before, 'and a click starts no run');
});

test('a step or count that could not be read shows the placeholder in its own slot, with the cause in the hover text and no other icon', () => {
  const gamma = item('Gamma mission');
  assert.strictEqual(gamma.description, '? · ? questions · 0 tasks');
  assert.ok(gamma.tooltip?.includes(`\nNext step: not read (${GAMMA}open_questions.xml is missing)\n`), gamma.tooltip);
  assert.ok(gamma.tooltip?.includes(`\nOpen questions: not read (${GAMMA}open_questions.xml is missing)\n`), gamma.tooltip);
  assert.strictEqual(gamma.iconPath?.id, missionTree.MISSION_ICON);
  const delta = item('Delta mission');
  assert.strictEqual(delta.description, '? · 0 questions · ? tasks');
  assert.ok(delta.tooltip?.includes(`\nRemaining tasks: not read (${DELTA}TASKS_TODO.md does not parse: `), delta.tooltip);
  assert.ok(delta.tooltip?.includes(`\nNext step: not read (${DELTA}TASKS_TODO.md does not parse: `), delta.tooltip);
  assert.strictEqual(delta.iconPath?.id, missionTree.MISSION_ICON);
});

test("a run's start and end each redraw the tree, its mission's row spinning while it goes", async () => {
  const before = redraws;
  runs.startChain(context, root, ALPHA, 'review', ['echo review'], { path: ALPHA });
  assert.strictEqual(redraws, before + 1, "the run's start redraws the tree");
  assert.strictEqual(item('Alpha mission').iconPath?.id, missionTree.RUNNING_ICON);
  assert.ok(item('Alpha mission').tooltip?.endsWith('\nRun: going'));
  assert.strictEqual(item('Beta mission').iconPath?.id, missionTree.MISSION_ICON, "another mission's row stays steady");
  assert.ok(closeTerminal !== undefined);
  closeTerminal(terminals[terminals.length - 1]);
  assert.strictEqual(redraws, before + 2, "the run's end redraws the tree");
  assert.strictEqual(item('Alpha mission').iconPath?.id, missionTree.MISSION_ICON);
  await until(() => redraws >= before + 3, "the re-read after the run's end redraws the tree");
});

test('a burst of file events and the refresh command each re-read and redraw the tree', async () => {
  fs.writeFileSync(path.join(root, BETA, 'TASKS_TODO.md'), '# TASKS TODO\n\n## Build it\n\nBuild it.\n\n---\n\n## Test it\n\nTest it.\n\n---\n');
  const before = redraws;
  for (const listener of documentWatchers()[0].listeners.change) {
    listener({ fsPath: path.join(root, BETA, 'TASKS_TODO.md') });
  }
  await until(() => redraws > before && item('Beta mission').description === 'Execute tasks · 0 questions · 2 tasks', 'the burst redraws the row');
  fs.writeFileSync(path.join(root, ALPHA, 'open_questions.xml'), '<open-questions/>\n');
  const again = redraws;
  const refresh = commands.get(missionTree.REFRESH_COMMAND);
  assert.ok(refresh !== undefined);
  refresh();
  await until(() => redraws > again, 'the refresh redraws the tree');
  assert.strictEqual(item('Alpha mission').description, 'First review round · 0 questions · 0 tasks');
});

test('the view shows no mission live and a failed read through its message with no row, and a read with missions clears it', async () => {
  assert.strictEqual(view.message, undefined, 'a read with missions shows no message');
  const empty = emptyProject();
  const refresh = commands.get(missionTree.REFRESH_COMMAND);
  assert.ok(refresh !== undefined);
  workspace.folders = [{ uri: { fsPath: empty } }];
  refresh();
  await until(() => view.message === missionTree.NO_MISSION_MESSAGE, 'the view shows that no mission is live');
  assert.strictEqual(view.message, 'No mission is live.');
  assert.deepStrictEqual(items().map((each) => each.label), STARTING_LABELS, 'no mission row is drawn with no mission live');
  workspace.folders = undefined;
  refresh();
  await until(() => view.message !== missionTree.NO_MISSION_MESSAGE, 'the view shows the failed read');
  assert.strictEqual(view.message, 'The live missions could not be read. No folder is open in this window.');
  assert.deepStrictEqual(items().map((each) => each.label), STARTING_LABELS, 'no mission row is drawn while the read fails');
  workspace.folders = [{ uri: { fsPath: root } }];
  refresh();
  await until(() => view.message === undefined, 'a read with missions clears the message');
  assert.deepStrictEqual(
    items().map((each) => each.label),
    [...STARTING_LABELS, 'Alpha mission', 'Beta mission', 'Gamma mission', 'Delta mission'],
  );
});

test("the two mission-starting rows are described by the remembered variant's harness, model, and effort, and a click runs it", () => {
  const discuss = item('New mission');
  assert.strictEqual(discuss.collapsibleState, stub.TreeItemCollapsibleState.None);
  assert.strictEqual(discuss.description, 'Claude Code · fable · xhigh');
  assert.strictEqual(discuss.contextValue, missionTree.STARTING_ROW_CONTEXT);
  assert.strictEqual(discuss.command?.command, 'gurita.newMission');
  assert.ok(discuss.tooltip?.startsWith('New mission\nAction: discuss-mission-goal\nVariant: default\nclaude '), discuss.tooltip);
  const define = item('Define mission');
  assert.strictEqual(define.description, 'Claude Code · sonnet · medium', "the recipe's default stands with nothing remembered");
  assert.strictEqual(define.command?.command, 'gurita.defineMission');
  assert.strictEqual(define.contextValue, missionTree.STARTING_ROW_CONTEXT);
  assert.strictEqual(item('Alpha mission').contextValue, undefined, 'a mission row offers no variant action');
});

test('a click on Define mission asks for the goal and then the scope and runs the variant its row shows, for no mission', async () => {
  item('Define mission');
  const before = terminals.length;
  inputPrompts.length = 0;
  inputAnswers.push('Ship the thing', 'pkg');
  await commands.get('gurita.defineMission')?.();
  assert.strictEqual(inputPrompts.length, 2, 'the goal is asked for and then the scope');
  assert.match(inputPrompts[0], /goal/);
  assert.match(inputPrompts[1], /scope/);
  assert.deepStrictEqual(
    webviewPanels.slice(-1).map((each) => [each.viewType, each.title]),
    [['gurita.input', 'Gurita: Goal']],
    'the goal is asked for in the input panel, the scope in an input box',
  );
  assert.strictEqual(terminals.length, before + 1, 'one run starts');
  const run = terminals[terminals.length - 1];
  assert.strictEqual(run.name, 'Gurita: define-mission-goal', 'the run belongs to no mission');
  assert.strictEqual(run.options.cwd, root, 'the run starts at the project root');
  assert.ok(run.options.shellArgs?.some((arg) => arg.startsWith('claude -p "/gurita:define-mission-goal') && arg.includes('"sonnet"')), String(run.options.shellArgs));
  assert.strictEqual(run.options.env?.GURITA_GOAL, 'Ship the thing');
  assert.strictEqual(run.options.env?.GURITA_SCOPE, 'pkg');
  closeTerminal?.(run);

  const again = terminals.length;
  inputAnswers.push(undefined);
  await commands.get('gurita.newMission')?.();
  assert.strictEqual(terminals.length, again, 'a goal panel closed starts nothing');
});

test("a QuickPick pick changes the remembered variant and the row's description without starting a run, and a dismissed one changes nothing", async () => {
  const defineRow = provider.getChildren().find((row) => provider.getTreeItem(row).label === 'Define mission');
  assert.ok(defineRow !== undefined);
  const before = terminals.length;
  const redrawn = redraws;
  nextPick = undefined;
  await commands.get(missionTree.PICK_VARIANT_COMMAND)?.(defineRow);
  assert.strictEqual(quickPicks.length, 1, 'the action opens one QuickPick');
  assert.deepStrictEqual(
    quickPicks[0].items.map((each) => [each.label, each.description, each.detail]),
    [
      ['default', 'Claude Code · sonnet · medium', 'Selected'],
      ['quick', 'Antigravity · gemini-4-argon · low', undefined],
    ],
    "the QuickPick offers the recipe's variants, the one selected marked",
  );
  assert.strictEqual(quickPicks[0].options.title, 'define-mission-goal');
  assert.strictEqual(stored.get(selections.PROJECT_SELECTIONS_KEY), undefined, 'a dismissed QuickPick remembers nothing');
  assert.strictEqual(item('Define mission').description, 'Claude Code · sonnet · medium');

  nextPick = 'quick';
  await commands.get(missionTree.PICK_VARIANT_COMMAND)?.(defineRow);
  assert.deepStrictEqual(stored.get(selections.PROJECT_SELECTIONS_KEY), { 'define-mission-goal': 'quick' }, 'the pick is remembered once per project');
  assert.ok(redraws > redrawn, 'the pick redraws the tree');
  assert.strictEqual(item('Define mission').description, 'Antigravity · gemini-4-argon · low');
  assert.ok(item('Define mission').tooltip?.endsWith(`\nVariant: quick\n${QUICK_LINE}`), item('Define mission').tooltip);
  assert.strictEqual(item('New mission').description, 'Claude Code · fable · xhigh', 'the other row keeps its variant');
  assert.strictEqual(terminals.length, before, 'a pick starts no run');
  nextPick = undefined;
  await commands.get(missionTree.PICK_VARIANT_COMMAND)?.(defineRow);
  assert.deepStrictEqual(quickPicks[2].items.map((each) => each.detail), [undefined, 'Selected'], 'the next QuickPick marks the variant picked');

  inputAnswers.push('Another goal', '.');
  await commands.get('gurita.defineMission')?.();
  assert.strictEqual(terminals.length, before + 1);
  const run = terminals[terminals.length - 1];
  assert.ok(run.options.shellArgs?.some((arg) => arg.startsWith('agy -p "/gurita:define-mission-goal')), 'a click then runs the variant picked');
  closeTerminal?.(run);
});

test('a row describes a variant whose lines carry no harness by its name, and one with no variant to run by why', () => {
  const offered = { state: 'offered' as const, recipe: 'r', variants: [{ name: 'plain', lines: ['echo hi'] }], selected: 0 };
  assert.strictEqual(startingRows.startingRow('discussGoal', 'New mission', offered).description, 'plain');
  assert.strictEqual(startingRows.variantValues(['claude -p "x" --model a --effort high;', 'codex exec -m b "y"']), 'Claude Code, Codex · a, b · high');
  const disabled = startingRows.startingRow('defineMission', 'Define mission', { state: 'disabled', recipe: 'r', cause: 'Every variant is off.' });
  assert.strictEqual(disabled.description, startingRows.DISABLED_DESCRIPTION);
  assert.strictEqual(disabled.tooltip, 'Define mission\nEvery variant is off.');
  const refused = startingRows.startingRow('defineMission', 'Define mission', { state: 'refused', cause: 'No action is named r.' });
  assert.strictEqual(refused.description, startingRows.REFUSED_DESCRIPTION);
});

test("the manifest contributes the activity-bar container with the tracked icon, holding the one side-bar view", () => {
  const extensionRoot = path.join(__dirname, '..', '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'package.json'), 'utf8'));
  assert.deepStrictEqual(manifest.contributes.viewsContainers, {
    activitybar: [{ id: 'gurita', title: 'Gurita', icon: 'media/activity-bar.svg' }],
  });
  assert.deepStrictEqual(manifest.contributes.views, { gurita: [{ id: missionTree.MISSIONS_VIEW, name: 'Missions' }] });
  assert.ok(manifest.activationEvents.includes(`onView:${missionTree.MISSIONS_VIEW}`));
  assert.ok(fs.statSync(path.join(extensionRoot, 'media', 'activity-bar.svg')).isFile(), 'the container names a tracked icon file');
});

test('the manifest hides the command behind the mission rows, contributes no pane command, and offers the refresh command alone in the Command Palette', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));
  const contributed = manifest.contributes.commands.map((each: { command: string }) => each.command);
  assert.ok(contributed.includes(missionTree.OPEN_MISSION_COMMAND), 'the open-mission command is contributed');
  assert.ok(!contributed.includes('gurita.openMissionPane'), 'the pane command is removed');
  assert.ok(!manifest.activationEvents.some((event: string) => event.includes('openMissionPane')), 'and so is its activation event');
  const hidden = new Set(
    manifest.contributes.menus.commandPalette.filter((entry: { when: string }) => entry.when === 'false').map((entry: { command: string }) => entry.command),
  );
  assert.deepStrictEqual(
    contributed.filter((command: string) => !hidden.has(command)),
    [missionTree.REFRESH_COMMAND],
    'every contributed command but the refresh command is hidden from the Command Palette',
  );
});

test('the manifest offers the variant action inline and in the context menu of the mission-starting rows, and hides the commands behind the rows from the Command Palette', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));
  const hidden = [
    missionTree.STARTING_COMMANDS.bootstrap,
    missionTree.STARTING_COMMANDS.discussGoal,
    missionTree.STARTING_COMMANDS.defineMission,
    missionTree.PICK_VARIANT_COMMAND,
  ];
  const contributed = manifest.contributes.commands.map((each: { command: string }) => each.command);
  for (const command of hidden) {
    assert.ok(contributed.includes(command), `${command} is contributed`);
    assert.ok(
      manifest.contributes.menus.commandPalette.some((entry: { command: string; when: string }) => entry.command === command && entry.when === 'false'),
      `${command} is hidden from the Command Palette`,
    );
  }
  const pick = manifest.contributes.commands.find((each: { command: string }) => each.command === missionTree.PICK_VARIANT_COMMAND);
  assert.match(pick.icon, /^\$\([a-z-]+\)$/, 'the action has an icon');
  const entries = manifest.contributes.menus['view/item/context'].filter(
    (entry: { command: string }) => entry.command === missionTree.PICK_VARIANT_COMMAND,
  );
  const when = `view == ${missionTree.MISSIONS_VIEW} && viewItem == ${missionTree.STARTING_ROW_CONTEXT}`;
  assert.ok(entries.some((entry: { when: string; group?: string }) => entry.when === when && entry.group === 'inline'), 'offered inline');
  assert.ok(entries.some((entry: { when: string; group?: string }) => entry.when === when && entry.group !== 'inline'), 'offered in the context menu');
});

test('the refresh command re-reads the live missions, a mission defined since the last read gaining its row and one finished since losing it', async () => {
  const refresh = commands.get(missionTree.REFRESH_COMMAND);
  assert.ok(refresh !== undefined, 'activation registers the refresh command');
  const EPSILON = 'web/mission_epsilon/';
  commit(root, `Mission-definition: ${EPSILON}`, {
    [`${EPSILON}requirements.md`]: '# Epsilon mission\n\n## Goal\n\nA goal.\n',
    [`${EPSILON}open_questions.xml`]: '<open-questions/>\n',
    [`${EPSILON}TASKS_TODO.md`]: '# TASKS TODO\n',
  });
  const before = redraws;
  refresh();
  await until(() => redraws > before && items().some((each) => each.label === 'Epsilon mission'), 'the refresh draws the new mission');
  assert.deepStrictEqual(
    items().map((each) => each.label),
    [...STARTING_LABELS, 'Alpha mission', 'Beta mission', 'Gamma mission', 'Delta mission', 'Epsilon mission'],
    'the fresh read of the live missions is drawn, in the order it prints them',
  );
  git(root, 'rm', '-r', '-q', EPSILON);
  git(root, 'commit', '-q', '-m', `Mission-finish: ${EPSILON}`);
  const again = redraws;
  refresh();
  await until(() => redraws > again && !items().some((each) => each.label === 'Epsilon mission'), 'the refresh drops the finished mission');
  assert.deepStrictEqual(
    items().map((each) => each.label),
    [...STARTING_LABELS, 'Alpha mission', 'Beta mission', 'Gamma mission', 'Delta mission'],
  );
});

test('the manifest contributes the refresh command, offered in the Command Palette as Gurita: Refresh Missions, and runs it from an icon action in the view title bar', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));
  const contributed = manifest.contributes.commands.map((each: { command: string }) => each.command);
  assert.ok(!contributed.includes('gurita.refreshMissionPane'), 'the old refresh command id is removed');
  const refresh = manifest.contributes.commands.find((each: { command: string }) => each.command === missionTree.REFRESH_COMMAND);
  assert.ok(refresh !== undefined, 'the refresh command is contributed');
  assert.strictEqual(`${refresh.category}: ${refresh.title}`, 'Gurita: Refresh Missions', 'its title names missions rather than the pane');
  assert.match(refresh.icon, /^\$\([a-z-]+\)$/, 'the action has an icon');
  assert.ok(
    !manifest.contributes.menus.commandPalette.some((entry: { command: string }) => entry.command === missionTree.REFRESH_COMMAND),
    'the refresh command is not hidden from the Command Palette',
  );
  assert.deepStrictEqual(
    manifest.contributes.menus['view/title'].filter((entry: { command: string }) => entry.command === missionTree.REFRESH_COMMAND),
    [{ command: missionTree.REFRESH_COMMAND, when: `view == ${missionTree.MISSIONS_VIEW}`, group: 'navigation@1' }],
    "the view's title bar runs the same command as an icon action, first in its group",
  );
});

/** The Settings window open now, opened by its command when none is. */
function settingsPanel(): StubPanel {
  commands.get(settingsWindow.SETTINGS_COMMAND)?.();
  const found = webviewPanels.filter((each) => each.viewType === settingsWindow.SETTINGS_VIEW_TYPE);
  assert.ok(found.length > 0, 'the Settings command opens the Settings window');
  return found[found.length - 1];
}

/** Runs the harness check afresh as the Settings window's Check again does, and waits until it has finished. */
async function checkAgain(): Promise<void> {
  const before = settingsWindow.sessionHarnessCheck();
  const runsBefore = checkRuns();
  settingsPanel().receive?.({ type: 'checkHarnesses' });
  await until(() => checkRuns() > runsBefore && settingsWindow.sessionHarnessCheck() !== before, 'the check run afresh finishes');
}

/** The plugin notice row's tree item when the tree holds it, its first row, else undefined. */
function noticeRow(): StubTreeItem | undefined {
  const first = items()[0];
  return first?.label === pluginNotice.PLUGIN_NOTICE_LABEL ? first : undefined;
}

const MISSION_LABELS = ['Alpha mission', 'Beta mission', 'Gamma mission', 'Delta mission'];

test("the harness check runs once, in the background from the view's first resolution, a passing check standing no notice row, and neither Refresh nor a re-read runs it again", async () => {
  assert.strictEqual(checkRuns(), 1, 'every re-read and Refresh so far left the one background run');
  assert.strictEqual(settingsWindow.sessionHarnessCheck()?.state, 'checked');
  assert.deepStrictEqual(items().map((each) => each.label), [...STARTING_LABELS, ...MISSION_LABELS], 'a passing check stands no notice row');
  const refresh = commands.get(missionTree.REFRESH_COMMAND);
  assert.ok(refresh !== undefined);
  const before = redraws;
  refresh();
  await until(() => redraws > before, 'the refresh redraws the tree');
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.strictEqual(checkRuns(), 1, 'Refresh does not run the check');
});

test('each enabled harness whose CLI is found and whose plugin is not installed, unreadable, disabled, or older stands the notice row at the top, a warning whose click opens the Settings window', async () => {
  const errorsBefore = errors.length;
  const noticesBefore = notices.length;
  const cases: [Partial<Record<'claude' | 'antigravity' | 'codex', PrintedHarness>>, string][] = [
    [{ claude: { found: true, installed: false, version: null } }, 'Claude Code: the Gurita plugin is not installed'],
    [{ antigravity: { found: true, installed: false, version: null, error: 'the listing printed no JSON' } }, 'Antigravity: the plugin listing could not be read (the listing printed no JSON)'],
    [{ codex: { found: true, installed: false, version: null, disabled: true } }, 'Codex: the Gurita plugin is installed but disabled'],
    [{ claude: { found: true, installed: true, version: '1.9.9' } }, 'Claude Code: installed version 1.9.9 is older than the packaged 2.0.0'],
  ];
  for (const [printed, line] of cases) {
    checkPrints(printed);
    await checkAgain();
    await until(() => noticeRow()?.tooltip?.includes(line) === true, `the notice row names ${line}`);
    const row = noticeRow();
    assert.ok(row !== undefined);
    assert.strictEqual(row.tooltip, [pluginNotice.PLUGIN_NOTICE_LABEL, line, pluginNotice.PLUGIN_NOTICE_CLICK].join('\n'));
    assert.strictEqual(row.collapsibleState, stub.TreeItemCollapsibleState.None);
    assert.strictEqual(row.iconPath?.id, missionTree.PLUGIN_NOTICE_ICON);
    assert.strictEqual(row.iconPath?.id, 'warning');
    assert.deepStrictEqual(row.command, { command: settingsWindow.SETTINGS_COMMAND, title: 'Open Settings' });
    assert.deepStrictEqual(
      items().map((each) => each.label),
      [pluginNotice.PLUGIN_NOTICE_LABEL, ...STARTING_LABELS, ...MISSION_LABELS],
      'the notice row stands above New mission and Define mission',
    );
    assert.strictEqual(view.message, undefined, "the view's message is left to the live read");
  }
  const window = settingsPanel();
  const reveals = window.reveals;
  const click = noticeRow()?.command;
  assert.ok(click !== undefined);
  commands.get(click.command)?.(...(click.arguments ?? []));
  assert.strictEqual(window.reveals, reveals + 1, "the row's click opens the Settings window, revealing it when it is open");
  assert.strictEqual(errors.length, errorsBefore, 'no error notification is shown');
  assert.strictEqual(notices.length, noticesBefore, 'no other notification is shown');
});

test('a harness whose CLI is not found, or one disabled in the Settings window, never counts toward the notice row', async () => {
  checkPrints({ claude: { found: false, installed: false, version: null } });
  await checkAgain();
  await until(() => noticeRow() === undefined, 'a harness whose CLI is not found stands no row');
  checkPrints({ codex: { found: true, installed: true, version: '1.0.0' } });
  await checkAgain();
  await until(() => noticeRow() !== undefined, 'the older Codex copy stands the row');
  const window = settingsPanel();
  let before = redraws;
  window.receive?.({ type: 'setHarnessEnabled', harness: 'codex', enabled: false });
  await until(() => redraws > before && noticeRow() === undefined, "disabling Codex in the Settings window takes the row away");
  checkPrints({ codex: { found: true, installed: false, version: null } });
  await checkAgain();
  assert.strictEqual(noticeRow(), undefined, 'a disabled harness never counts, whatever its check gives');
  before = redraws;
  window.receive?.({ type: 'setHarnessEnabled', harness: 'codex', enabled: true });
  await until(() => redraws > before && noticeRow()?.tooltip?.includes('Codex: the Gurita plugin is not installed') === true, 'enabling Codex again stands the row');
  checkPrints();
  await checkAgain();
  await until(() => noticeRow() === undefined, 'a passing check takes the row away');
});

test("a check that could not be run at all stands the notice row with its cause, the view's message keeping only the live read's lines", async () => {
  const noticesBefore = notices.length;
  const errorsBefore = errors.length;
  fs.writeFileSync(CHECK_FAILS, 'Error: the check broke');
  await checkAgain();
  await until(() => noticeRow() !== undefined, 'a check that could not be run stands the row');
  assert.strictEqual(
    noticeRow()?.tooltip,
    [pluginNotice.PLUGIN_NOTICE_LABEL, `${pluginNotice.CHECK_NOT_RUN} Error: the check broke`, pluginNotice.PLUGIN_NOTICE_CLICK].join('\n'),
  );
  const empty = emptyProject();
  const refresh = commands.get(missionTree.REFRESH_COMMAND);
  assert.ok(refresh !== undefined);
  workspace.folders = [{ uri: { fsPath: empty } }];
  refresh();
  await until(() => view.message === missionTree.NO_MISSION_MESSAGE, 'the view shows that no mission is live');
  assert.deepStrictEqual(items().map((each) => each.label), [pluginNotice.PLUGIN_NOTICE_LABEL, ...STARTING_LABELS]);
  workspace.folders = undefined;
  refresh();
  await until(() => view.message !== missionTree.NO_MISSION_MESSAGE, 'the view shows the failed read');
  assert.strictEqual(view.message, 'The live missions could not be read. No folder is open in this window.');
  assert.deepStrictEqual(items().map((each) => each.label), [pluginNotice.PLUGIN_NOTICE_LABEL, ...STARTING_LABELS]);
  workspace.folders = [{ uri: { fsPath: root } }];
  refresh();
  await until(() => view.message === undefined, 'a read with missions clears the message');
  fs.rmSync(CHECK_FAILS);
  await checkAgain();
  await until(() => noticeRow() === undefined, 'a passing check takes the row away');
  assert.strictEqual(notices.length, noticesBefore, 'no notification is shown');
  assert.strictEqual(errors.length, errorsBefore, 'no error notification is shown');
});

/** The bootstrap offer row's label. */
const BOOTSTRAP_LABEL = 'Bootstrap the workflow';

/** The bootstrap offer row's tree item when the tree holds it, else undefined. */
function bootstrapRow(): StubTreeItem | undefined {
  return items().find((each) => each.label === BOOTSTRAP_LABEL);
}

/** Writes the project's two context files as `files` gives them, an undefined entry removing that file, and refreshes the view. */
async function contextFiles(files: { claude?: string; agents?: string }): Promise<void> {
  for (const [name, text] of [['CLAUDE.md', files.claude], ['AGENTS.md', files.agents]] as const) {
    const file = path.join(root, name);
    if (text === undefined) {
      fs.rmSync(file, { force: true });
    } else {
      fs.writeFileSync(file, text);
    }
  }
  const before = redraws;
  commands.get(missionTree.REFRESH_COMMAND)?.();
  await until(() => redraws > before, 'the refresh redraws the tree');
}

/** A context file holding no workflow section, the older section's heading included. */
const UNBOOTSTRAPPED = '# Project\n\n## Milestone Workflow\n\nOlder guidance.\n\n### Mission Workflow\n\nNot the heading.\n';

test('the bootstrap offer row stands at the top, above New mission and Define mission, only while neither CLAUDE.md nor AGENTS.md holds the workflow heading', async () => {
  assert.strictEqual(bootstrapRow(), undefined, "a CLAUDE.md holding the heading stands no row");
  const states: [{ claude?: string; agents?: string }, boolean, string][] = [
    [{ claude: UNBOOTSTRAPPED }, true, 'a CLAUDE.md without the heading and no AGENTS.md'],
    [{}, true, 'neither file'],
    [{ agents: UNBOOTSTRAPPED }, true, 'an AGENTS.md without the heading and no CLAUDE.md'],
    [{ claude: UNBOOTSTRAPPED, agents: UNBOOTSTRAPPED }, true, 'both files without the heading'],
    [{ agents: BOOTSTRAPPED }, false, 'an AGENTS.md holding the heading and no CLAUDE.md'],
    [{ claude: UNBOOTSTRAPPED, agents: BOOTSTRAPPED }, false, 'an AGENTS.md holding the heading beside a CLAUDE.md without it'],
    [{ claude: BOOTSTRAPPED, agents: UNBOOTSTRAPPED }, false, 'a CLAUDE.md holding the heading beside an AGENTS.md without it'],
    [{ claude: BOOTSTRAPPED, agents: BOOTSTRAPPED }, false, 'both files holding the heading'],
    [{ claude: BOOTSTRAPPED }, false, 'a CLAUDE.md holding the heading and no AGENTS.md'],
  ];
  for (const [files, stands, what] of states) {
    await contextFiles(files);
    assert.deepStrictEqual(
      items().map((each) => each.label),
      stands ? [BOOTSTRAP_LABEL, ...STARTING_LABELS, ...MISSION_LABELS] : [...STARTING_LABELS, ...MISSION_LABELS],
      `${what}: ${stands ? 'the row stands above the mission-starting rows' : 'no row stands'}`,
    );
  }
  assert.strictEqual(view.message, undefined, "the view's message is left to the live read");
});

test("the bootstrap offer row is drawn as the mission-starting rows are, from the shipped init-mission-base-workflow recipe, its hover text saying why it stands", async () => {
  await contextFiles({});
  const row = bootstrapRow();
  assert.ok(row !== undefined);
  assert.strictEqual(row.collapsibleState, stub.TreeItemCollapsibleState.None);
  assert.strictEqual(row.description, 'Claude Code · sonnet · medium');
  assert.strictEqual(
    row.tooltip,
    [
      BOOTSTRAP_LABEL,
      bootstrapOffer.BOOTSTRAP_REASON,
      'Action: init-mission-base-workflow',
      'Variant: default',
      'claude -p "/gurita:init-mission-base-workflow" --dangerously-skip-permissions --model "sonnet" --effort medium;',
    ].join('\n'),
  );
  assert.strictEqual(row.iconPath?.id, missionTree.STARTING_ICONS.bootstrap);
  assert.strictEqual(row.contextValue, missionTree.STARTING_ROW_CONTEXT, 'it offers the variant action as the mission-starting rows do');
  assert.deepStrictEqual(row.command, { command: missionTree.STARTING_COMMANDS.bootstrap, title: BOOTSTRAP_LABEL });
  assert.strictEqual(missionTree.STARTING_COMMANDS.bootstrap, 'gurita.bootstrapWorkflow');
});

test('a click on the bootstrap offer row runs init-mission-base-workflow at the project root, asking for nothing, and the row is gone once the run has written the heading', async () => {
  await contextFiles({ claude: UNBOOTSTRAPPED });
  assert.ok(bootstrapRow() !== undefined);
  const before = terminals.length;
  const panels = webviewPanels.length;
  inputPrompts.length = 0;
  const errorsBefore = errors.length;
  await commands.get(missionTree.STARTING_COMMANDS.bootstrap)?.();
  assert.strictEqual(inputPrompts.length, 0, 'no value is asked for');
  assert.strictEqual(webviewPanels.length, panels, 'no input panel opens');
  assert.strictEqual(errors.length, errorsBefore, 'no error notification is shown');
  assert.strictEqual(terminals.length, before + 1, 'one run starts');
  const run = terminals[terminals.length - 1];
  assert.strictEqual(run.name, 'Gurita: init-mission-base-workflow', 'the run belongs to no mission');
  assert.strictEqual(run.options.cwd, root, 'the run starts at the project root');
  assert.ok(
    run.options.shellArgs?.some((arg) => arg.startsWith('claude -p "/gurita:init-mission-base-workflow"') && arg.includes('"sonnet"')),
    String(run.options.shellArgs),
  );
  fs.writeFileSync(path.join(root, 'CLAUDE.md'), `${UNBOOTSTRAPPED}\n## Mission Workflow\n\nThis project uses the mission-driven workflow.\n`);
  git(root, 'add', 'CLAUDE.md');
  git(root, 'commit', '-q', '-m', 'Workflow-bootstrap: missions');
  const redrawn = redraws;
  closeTerminal?.(run);
  assert.ok(redraws > redrawn, "the run's end redraws the tree");
  assert.strictEqual(bootstrapRow(), undefined, 'the offer is gone once CLAUDE.md holds the heading');
  assert.deepStrictEqual(items().map((each) => each.label), [...STARTING_LABELS, ...MISSION_LABELS]);
  await contextFiles({ claude: BOOTSTRAPPED });
});

test('the bootstrap offer row stands beneath the plugin notice row, whatever harnesses are enabled', async () => {
  await contextFiles({ claude: UNBOOTSTRAPPED });
  checkPrints({ claude: { found: true, installed: false, version: null } });
  await checkAgain();
  await until(() => noticeRow() !== undefined, 'the notice row stands');
  assert.deepStrictEqual(
    items().map((each) => each.label),
    [pluginNotice.PLUGIN_NOTICE_LABEL, BOOTSTRAP_LABEL, ...STARTING_LABELS, ...MISSION_LABELS],
    'the notice row first, then the bootstrap offer row, then the mission-starting rows',
  );
  checkPrints();
  await checkAgain();
  await until(() => noticeRow() === undefined, 'a passing check takes the notice row away');
  const window = settingsPanel();
  for (const harness of ['claude', 'antigravity', 'codex']) {
    const before = redraws;
    window.receive?.({ type: 'setHarnessEnabled', harness, enabled: false });
    await until(() => redraws > before, `disabling ${harness} redraws the tree`);
  }
  const row = bootstrapRow();
  assert.ok(row !== undefined, 'every harness disabled, the row still stands');
  assert.strictEqual(row.description, 'no variant enabled', 'saying it has no variant to run');
  for (const harness of ['claude', 'antigravity', 'codex']) {
    const before = redraws;
    window.receive?.({ type: 'setHarnessEnabled', harness, enabled: true });
    await until(() => redraws > before, `enabling ${harness} redraws the tree`);
  }
  assert.strictEqual(bootstrapRow()?.description, 'Claude Code · sonnet · medium');
  await contextFiles({ claude: BOOTSTRAPPED });
  assert.strictEqual(bootstrapRow(), undefined);
});
