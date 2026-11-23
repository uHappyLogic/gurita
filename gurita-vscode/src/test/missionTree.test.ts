import { test } from 'node:test';
import * as assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
// The side-bar view's tree, against a stub of the `vscode` module standing in for the editor: a
// tree stand-in recording the view the extension creates and its data provider, the event
// emitter, tree items, and theme icons, beside the file system watcher, the terminals, the
// commands, and the notifications the extension's activation reaches.
const Module = require('node:module') as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};

const disposable = { dispose(): void {} };

/** A file system watcher the stub's editor created: the listeners registered on it by event kind. */
interface StubWatcher {
  listeners: Record<'create' | 'change' | 'delete', ((uri: { fsPath: string }) => void)[]>;
}
const watchers: StubWatcher[] = [];

/** A terminal the stub's editor created. */
interface StubTerminal {
  name: string;
  show(preserveFocus?: boolean): void;
}
const terminals: StubTerminal[] = [];
let closeTerminal: ((terminal: StubTerminal) => void) | undefined;

/** The commands the extension registered, by id. */
const commands = new Map<string, () => void>();

/** The tree data provider the stub's editor was given, as the tree stand-in holds it. */
interface StubProvider {
  onDidChangeTreeData: (listener: () => void) => { dispose(): void };
  getTreeItem(element: unknown): StubTreeItem;
  getChildren(element?: unknown): unknown[];
}
/** Every tree view the extension created, by the view id it named. */
const treeViews: { id: string; provider: StubProvider }[] = [];

class StubTreeItem {
  id?: string;
  description?: string;
  tooltip?: string;
  iconPath?: StubThemeIcon;
  command?: unknown;
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
    registerCommand(id: string, run: () => void) {
      commands.set(id, run);
      return disposable;
    },
  },
  workspace: {
    get workspaceFolders() {
      return workspace.folders;
    },
    getConfiguration: () => ({ get: () => undefined }),
    createFileSystemWatcher: () => {
      const watcher: StubWatcher = { listeners: { create: [], change: [], delete: [] } };
      watchers.push(watcher);
      const on = (kind: keyof StubWatcher['listeners']) => (listener: (uri: { fsPath: string }) => void) => {
        watcher.listeners[kind].push(listener);
        return disposable;
      };
      return { onDidCreate: on('create'), onDidChange: on('change'), onDidDelete: on('delete'), dispose(): void {} };
    },
  },
  window: {
    createTreeView(id: string, options: { treeDataProvider: StubProvider }) {
      treeViews.push({ id, provider: options.treeDataProvider });
      return { ...disposable, message: undefined };
    },
    createTerminal(options: { name: string }): StubTerminal {
      const terminal = { name: options.name, show(): void {} };
      terminals.push(terminal);
      return terminal;
    },
    onDidCloseTerminal(listener: (terminal: StubTerminal) => void) {
      closeTerminal = listener;
      return disposable;
    },
    showInformationMessage: () => Promise.resolve(undefined),
    showWarningMessage: () => Promise.resolve(undefined),
    showErrorMessage: () => Promise.resolve(undefined),
  },
};

const load = Module._load;
Module._load = (request, parent, isMain) => (request === 'vscode' ? stub : load(request, parent, isMain));
const extension = require('../extension') as typeof import('../extension');
const runs = require('../runs') as typeof import('../runs');
const missionTree = require('../missionTree') as typeof import('../missionTree');
Module._load = load;

const context = {
  subscriptions: [] as unknown[],
  extensionUri: { fsPath: '/extension' },
  asAbsolutePath: (file: string) => packaged.get(file) ?? `/extension/${file}`,
  workspaceState: { keys: () => [], get: () => undefined, update: () => Promise.resolve() },
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

/**
 * A fresh git project of four live missions: alpha with two questions lacking alternatives and no
 * task, beta with no question and one task, gamma with no question document, and delta with no
 * question and a task list holding a conflict marker.
 */
function project(): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-tree-')));
  git(root, 'init', '-q');
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
const root = project();
workspace.folders = [{ uri: { fsPath: root } }];

extension.activate(context);
assert.strictEqual(treeViews.length, 1, 'activation creates one tree view');
const { provider } = treeViews[0];
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
  assert.deepStrictEqual(provider.getChildren(), [], 'the first resolution draws no row until the read settles');
  await until(() => redraws > 0, 'the first read redraws the tree');
  assert.strictEqual(watchers.length, 1, 'the first read that succeeds watches the mission documents');
  assert.deepStrictEqual(
    items().map((each) => each.label),
    ['Alpha mission', 'Beta mission', 'Gamma mission', 'Delta mission'],
    'one row per live mission, in the order the live read prints them',
  );
  assert.deepStrictEqual(provider.getChildren(provider.getChildren()[0]), [], 'a mission row has no child rows');
});

test('each row is a leaf labelled with the title, described by the step and both counts, with the path and five facts in its tooltip and no command', () => {
  const alpha = item('Alpha mission');
  assert.strictEqual(alpha.collapsibleState, stub.TreeItemCollapsibleState.None);
  assert.strictEqual(alpha.command, undefined, 'a click on the row opens nothing');
  assert.strictEqual(alpha.id, ALPHA);
  assert.strictEqual(alpha.description, 'First review round · 2 questions · 0 tasks');
  assert.strictEqual(
    alpha.tooltip,
    ['Alpha mission', ALPHA, 'Next step: First review round', 'Open questions: 2', 'Remaining tasks: 0', 'Run: not going'].join('\n'),
  );
  assert.strictEqual(alpha.iconPath?.id, missionTree.MISSION_ICON);
  assert.strictEqual(item('Beta mission').description, 'Execute tasks · 0 questions · 1 task');
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
  for (const listener of watchers[0].listeners.change) {
    listener({ fsPath: path.join(root, BETA, 'TASKS_TODO.md') });
  }
  await until(() => redraws > before && item('Beta mission').description === 'Execute tasks · 0 questions · 2 tasks', 'the burst redraws the row');
  fs.writeFileSync(path.join(root, ALPHA, 'open_questions.xml'), '<open-questions/>\n');
  const again = redraws;
  const refresh = commands.get('gurita.refreshMissionPane');
  assert.ok(refresh !== undefined);
  refresh();
  await until(() => redraws > again, 'the refresh redraws the tree');
  assert.strictEqual(item('Alpha mission').description, 'First review round · 0 questions · 0 tasks');
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
