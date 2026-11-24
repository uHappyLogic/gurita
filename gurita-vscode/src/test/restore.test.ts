import { test } from 'node:test';
import * as assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadScript } from './fakePage';
import { WATCHED_PATTERN } from '../refresh';
// The mission windows and the Settings window restored after a restart or a window reload, against
// a stub of the `vscode` module standing in for the editor: the serializers the extension's
// activation registers, the panels the editor hands them on a restore and those the extension
// creates itself, the side-bar view's tree stand-in, the commands, the file system watcher, and the
// terminals the activation reaches.
const Module = require('node:module') as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};

const disposable = { dispose(): void {} };

/** A webview panel of the stub's editor: one it restored or one the extension created, with what was done to it. */
interface StubPanel {
  viewType: string;
  title: string;
  /** Whether the editor restored it rather than the extension creating it. */
  restored: boolean;
  /** The webview options the extension set on it, when it set any after its creation. */
  options?: { enableScripts?: boolean };
  iconPath?: unknown;
  visible: boolean;
  reveals: number;
  html: string;
  posted: Record<string, unknown>[];
  receive?: (message: unknown) => void;
  /** Whether the panel was closed, by the extension disposing it or the person closing it. */
  disposed: boolean;
  /** The listener of its disposal, which the editor calls when it is closed. */
  onDispose?: () => void;
}
const panels: StubPanel[] = [];

/** The serializers the extension registered, by view type. */
const serializers = new Map<string, { deserializeWebviewPanel(panel: unknown, state: unknown): Thenable<void> }>();

/** The commands the extension registered, by id. */
const commands = new Map<string, (...args: unknown[]) => unknown>();

/** The number of file system watchers over the mission documents the stub's editor created, the one over the git state left out. */
let watchers = 0;

class StubTreeItem {
  constructor(
    readonly label: string,
    readonly collapsibleState: number,
  ) {}
}

class StubThemeIcon {
  constructor(readonly id: string) {}
}

class StubEventEmitter<T> {
  readonly event = () => disposable;
  fire(_value: T): void {}
  dispose(): void {}
}

const workspace = { folders: undefined as { uri: { fsPath: string } }[] | undefined };
const packaged = new Map<string, string>();

/** A panel object as the stub's editor hands it to the extension, recording into `record`. */
function panelObject(record: StubPanel): unknown {
  panels.push(record);
  return {
    get title() {
      return record.title;
    },
    set title(value: string) {
      record.title = value;
    },
    get iconPath() {
      return record.iconPath;
    },
    set iconPath(value: unknown) {
      record.iconPath = value;
    },
    get visible() {
      return record.visible;
    },
    active: true,
    reveal(): void {
      record.reveals++;
    },
    dispose(): void {
      if (!record.disposed) {
        record.disposed = true;
        record.onDispose?.();
      }
    },
    webview: {
      set options(value: { enableScripts?: boolean }) {
        record.options = value;
      },
      set html(value: string) {
        record.html = value;
      },
      get html() {
        return record.html;
      },
      cspSource: 'stub-csp',
      asWebviewUri: (uri: unknown) => ({ toString: () => `webview:${JSON.stringify(uri)}` }),
      onDidReceiveMessage(listener: (message: unknown) => void) {
        record.receive = listener;
        return disposable;
      },
      postMessage(message: Record<string, unknown>): Promise<boolean> {
        record.posted.push(JSON.parse(JSON.stringify(message)));
        return Promise.resolve(true);
      },
    },
    onDidChangeViewState: () => disposable,
    onDidDispose(listener: () => void) {
      record.onDispose = listener;
      return disposable;
    },
  };
}

function newRecord(viewType: string, title: string, restored: boolean): StubPanel {
  return { viewType, title, restored, visible: true, reveals: 0, html: '', posted: [], disposed: false };
}

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
      if (glob.pattern === WATCHED_PATTERN) {
        watchers++;
      }
      const on = () => () => disposable;
      return { onDidCreate: on(), onDidChange: on(), onDidDelete: on(), dispose(): void {} };
    },
  },
  window: {
    registerWebviewPanelSerializer(viewType: string, serializer: { deserializeWebviewPanel(panel: unknown, state: unknown): Thenable<void> }) {
      serializers.set(viewType, serializer);
      return disposable;
    },
    createTreeView: () => ({ ...disposable, message: undefined }),
    createWebviewPanel(viewType: string, title: string): unknown {
      return panelObject(newRecord(viewType, title, false));
    },
    createTerminal: () => ({ show(): void {} }),
    onDidCloseTerminal: () => disposable,
    showInformationMessage: () => Promise.resolve(undefined),
    showWarningMessage: () => Promise.resolve(undefined),
    showErrorMessage: () => Promise.resolve(undefined),
    showInputBox: () => Promise.resolve(undefined),
    showQuickPick: () => Promise.resolve(undefined),
  },
};

const load = Module._load;
Module._load = (request, parent, isMain) => (request === 'vscode' ? stub : load(request, parent, isMain));
const extension = require('../extension') as typeof import('../extension');
const pane = require('../pane') as typeof import('../pane');
const settingsWindow = require('../settingsWindow') as typeof import('../settingsWindow');
const missionTree = require('../missionTree') as typeof import('../missionTree');
Module._load = load;

const context = {
  subscriptions: [] as unknown[],
  extensionUri: { fsPath: '/extension' },
  asAbsolutePath: (file: string) => packaged.get(file) ?? `/extension/${file}`,
  workspaceState: {
    keys: () => [],
    get: () => undefined,
    update: () => Promise.resolve(),
  },
} as unknown as import('vscode').ExtensionContext;

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { cwd, stdio: 'ignore' });
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

const ALPHA = 'lib/mission_alpha/';
const BETA = 'mission_beta/';

/** A fresh git project holding two live missions, each definition committed. */
function project(): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-restore-')));
  git(root, 'init', '-q');
  for (const [mission, title] of [
    [ALPHA, 'Alpha mission'],
    [BETA, 'Beta mission'],
  ]) {
    fs.mkdirSync(path.join(root, mission), { recursive: true });
    fs.writeFileSync(path.join(root, mission, 'requirements.md'), `# ${title}\n\n## Goal\n\nA goal.\n`);
    fs.writeFileSync(path.join(root, mission, 'open_questions.xml'), '<open-questions/>\n');
    fs.writeFileSync(path.join(root, mission, 'TASKS_TODO.md'), '# TASKS TODO\n');
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', `Mission-definition: ${mission}`);
  }
  return root;
}

process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-restore-home-'));
packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
packaged.set('bundled/shipped_recipes.md', path.join(__dirname, '..', '..', 'shipped_recipes.md'));
const root = project();
workspace.folders = [{ uri: { fsPath: root } }];

extension.activate(context);

/**
 * Restores a panel of `viewType` the editor kept across a reload, titled `title` as it was, handing
 * it and its saved webview state `state` to the extension's serializer as the editor does when the
 * panel is first shown, and returns the panel's record.
 */
async function restore(viewType: string, title: string, state: unknown): Promise<StubPanel> {
  const serializer = serializers.get(viewType);
  assert.ok(serializer !== undefined, `a serializer is registered for ${viewType}`);
  const record = newRecord(viewType, title, true);
  await serializer.deserializeWebviewPanel(panelObject(record), state);
  return record;
}

/** The state the mission page of `mission` saves on loading, as the page shell carries its path, with `state` given back by `getState`. */
function missionPageState(mission: string, state?: unknown): unknown {
  const page = loadScript('page.js', undefined, { dataset: { mission }, state });
  assert.ok(page.saved.length > 0, 'the page saves its state on loading');
  return page.saved[page.saved.length - 1];
}

/** The messages of `type` posted to `panel`. */
function postedOf(panel: StubPanel, type: string): Record<string, unknown>[] {
  return panel.posted.filter((message) => message.type === type);
}

test('the manifest activates the extension on a restore of either window, and activation registers a serializer for each view type', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));
  for (const viewType of [pane.MISSION_VIEW_TYPE, settingsWindow.SETTINGS_VIEW_TYPE]) {
    assert.ok(manifest.activationEvents.includes(`onWebviewPanel:${viewType}`), `an onWebviewPanel activation event for ${viewType}`);
  }
  assert.ok(manifest.activationEvents.includes(`onView:${missionTree.MISSIONS_VIEW}`), "the view's own activation stays");
  assert.deepStrictEqual([...serializers.keys()].sort(), [pane.MISSION_VIEW_TYPE, settingsWindow.SETTINGS_VIEW_TYPE].sort());
});

test("a mission page keeps its mission's path in its saved state from its first load, its question view's positions coming back with it", () => {
  assert.deepStrictEqual(missionPageState(ALPHA), { mission: ALPHA, positions: {} });
  const positions = { [ALPHA]: { title: 'Pane Layout', index: 1 } };
  assert.deepStrictEqual(missionPageState(ALPHA, { mission: ALPHA, positions }), { mission: ALPHA, positions }, 'a restored page saves the positions it was given back');
  const settings = loadScript('settings.js');
  assert.deepStrictEqual(settings.saved, [{ window: settingsWindow.SAVED_WINDOW }], 'the Settings page saves the one state naming its window');
});

test("a restored mission window starts the session's read, is taken over with its page shell carrying its path, and draws its page from that read", async () => {
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.strictEqual(watchers, 0, 'nothing is read before the restore');
  assert.deepStrictEqual(pane.openMissionWindows(), []);
  const restored = await restore(pane.MISSION_VIEW_TYPE, 'Alpha mission', missionPageState(ALPHA, { mission: ALPHA, positions: { [ALPHA]: { title: 'X', index: 0 } } }));
  assert.strictEqual(restored.disposed, false, 'a window with a readable state is kept');
  assert.deepStrictEqual(pane.openMissionWindows(), [ALPHA], 'and taken over as the window of its mission');
  assert.strictEqual(restored.options?.enableScripts, true, "its webview's scripts are enabled again");
  assert.match(restored.html, /page\.js/, "its page shell loads the mission page's script");
  assert.match(restored.html, /id="root" data-mission="lib\/mission_alpha\/"/, "and carries the mission's path for the page to save");
  assert.ok(restored.iconPath instanceof StubThemeIcon && restored.iconPath.id === pane.MISSION_WINDOW_ICON, 'its tab carries the mission codicon');
  assert.ok(restored.receive !== undefined, "it listens to its page's messages");
  await until(() => watchers === 1, "the restore starts the session's read, which watches the mission documents");
  restored.receive({ type: 'ready' });
  await until(() => postedOf(restored, 'page').length > 0, 'the page is drawn');
  assert.strictEqual((postedOf(restored, 'page')[0].mission as { path: string }).path, ALPHA, 'drawn from the read for its own path');
  assert.strictEqual(restored.title, 'Alpha mission');

  const before = panels.length;
  const open = commands.get(pane.OPEN_MISSION_COMMAND);
  assert.ok(open !== undefined);
  open(ALPHA);
  assert.strictEqual(panels.length, before, "a click on the mission's row creates no second window");
  assert.strictEqual(restored.reveals, 1, 'it reveals the restored one');
});

test('a restored mission window first shown while its mission already has a window, or with a saved state missing or unreadable, is closed', async () => {
  const duplicate = await restore(pane.MISSION_VIEW_TYPE, 'Alpha mission', missionPageState(ALPHA));
  assert.strictEqual(duplicate.disposed, true, 'a second window for the same mission is closed');
  assert.strictEqual(duplicate.html, '', 'and never drawn');
  assert.deepStrictEqual(pane.openMissionWindows(), [ALPHA], 'the window already open stays');
  for (const state of [undefined, null, 'lib/mission_alpha/', {}, { positions: {} }, { mission: 7 }, { mission: '' }, { mission: 'mission_beta' }]) {
    const unreadable = await restore(pane.MISSION_VIEW_TYPE, 'Beta mission', state);
    assert.strictEqual(unreadable.disposed, true, `a window saved as ${JSON.stringify(state)} is closed`);
    assert.strictEqual(unreadable.html, '', 'rather than drawn');
  }
  assert.deepStrictEqual(pane.openMissionWindows(), [ALPHA]);
  const beta = await restore(pane.MISSION_VIEW_TYPE, 'Beta mission', missionPageState(BETA));
  assert.strictEqual(beta.disposed, false, "another mission's window is restored beside it");
  assert.deepStrictEqual(pane.openMissionWindows(), [ALPHA, BETA]);
  beta.receive?.({ type: 'ready' });
  await until(() => postedOf(beta, 'page').length > 0, "the second window's page is drawn");
  assert.strictEqual((postedOf(beta, 'page')[0].mission as { path: string }).path, BETA);
});

test('a restored Settings window is taken over and drawn from fresh reads, and one first shown while it is open, or with a saved state missing or unreadable, is closed', async () => {
  for (const state of [undefined, null, 'settings', {}, { window: 'mission' }, { mission: ALPHA }]) {
    const unreadable = await restore(settingsWindow.SETTINGS_VIEW_TYPE, settingsWindow.SETTINGS_TITLE, state);
    assert.strictEqual(unreadable.disposed, true, `a Settings window saved as ${JSON.stringify(state)} is closed`);
    assert.strictEqual(unreadable.html, '', 'rather than drawn');
  }
  const settings = loadScript('settings.js');
  const restored = await restore(settingsWindow.SETTINGS_VIEW_TYPE, settingsWindow.SETTINGS_TITLE, settings.saved[settings.saved.length - 1]);
  assert.strictEqual(restored.disposed, false, 'the state its page saves is read');
  assert.strictEqual(restored.options?.enableScripts, true);
  assert.match(restored.html, /settings\.js/, "its page shell loads the Settings window's script");
  assert.doesNotMatch(restored.html, /data-mission/, 'and carries no mission');
  assert.ok(restored.receive !== undefined);
  restored.receive({ type: 'ready' });
  await until(
    () => ['harnessSettings', 'harnessLists', 'variants', 'singleTaskLines', 'harnessCheck'].every((type) => postedOf(restored, type).length > 0),
    'its ready message is answered with fresh reads and the harness check',
  );

  const duplicate = await restore(settingsWindow.SETTINGS_VIEW_TYPE, settingsWindow.SETTINGS_TITLE, { window: settingsWindow.SAVED_WINDOW });
  assert.strictEqual(duplicate.disposed, true, 'a second Settings window is closed');
  assert.strictEqual(duplicate.html, '');
  const before = panels.length;
  const run = commands.get(settingsWindow.SETTINGS_COMMAND);
  assert.ok(run !== undefined);
  run();
  assert.strictEqual(panels.length, before, 'the Settings command creates no second window');
  assert.strictEqual(restored.reveals, 1, 'it reveals the restored one');

  restored.disposed = true;
  restored.onDispose?.();
  const reopened = await restore(settingsWindow.SETTINGS_VIEW_TYPE, settingsWindow.SETTINGS_TITLE, { window: settingsWindow.SAVED_WINDOW });
  assert.strictEqual(reopened.disposed, false, 'once it is closed, a restored Settings window is kept again');
});
