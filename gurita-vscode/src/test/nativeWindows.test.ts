import { test } from 'node:test';
import * as assert from 'node:assert';
// The check at activation for native Windows, against a stub of the `vscode` module standing in
// for the editor: the platform the extension host reports and whether the window is a remote one,
// the messages activation shows, and everything it registers for the side-bar view, the mission
// windows, the Settings window, and the runner's terminals.
const Module = require('node:module') as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};

const disposable = { dispose(): void {} };

/** What one activation did to the stub's editor. */
interface Activation {
  /** The messages it showed, each with its kind. */
  messages: { kind: 'information' | 'warning' | 'error'; text: string }[];
  /** The commands it registered, by id. */
  commands: string[];
  /** The tree views it created, by view id. */
  treeViews: string[];
  /** The webview panel serializers it registered, by view type. */
  serializers: string[];
  /** The number of terminal-close listeners it registered. */
  terminalListeners: number;
  /** The number of file system watchers it created. */
  watchers: number;
}

let activation: Activation = fresh();

function fresh(): Activation {
  return { messages: [], commands: [], treeViews: [], serializers: [], terminalListeners: 0, watchers: 0 };
}

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

/** The window's remote name as the stub's editor reports it: `undefined` in a local window. */
const env = { remoteName: undefined as string | undefined };

function message(kind: 'information' | 'warning' | 'error') {
  return (text: string) => {
    activation.messages.push({ kind, text });
    return Promise.resolve(undefined);
  };
}

const stub = {
  env,
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
    registerCommand(id: string) {
      activation.commands.push(id);
      return disposable;
    },
  },
  workspace: {
    workspaceFolders: undefined,
    getConfiguration: () => ({ get: () => undefined }),
    createFileSystemWatcher: () => {
      activation.watchers++;
      const on = () => () => disposable;
      return { onDidCreate: on(), onDidChange: on(), onDidDelete: on(), dispose(): void {} };
    },
  },
  window: {
    registerWebviewPanelSerializer(viewType: string) {
      activation.serializers.push(viewType);
      return disposable;
    },
    registerTreeDataProvider(viewId: string) {
      activation.treeViews.push(viewId);
      return disposable;
    },
    createTreeView(viewId: string) {
      activation.treeViews.push(viewId);
      return { ...disposable, message: undefined };
    },
    createWebviewPanel: () => assert.fail('activation opens no window'),
    createTerminal: () => assert.fail('activation starts no run'),
    onDidCloseTerminal: () => {
      activation.terminalListeners++;
      return disposable;
    },
    showInformationMessage: message('information'),
    showWarningMessage: message('warning'),
    showErrorMessage: message('error'),
  },
};

const load = Module._load;
Module._load = (request, parent, isMain) => (request === 'vscode' ? stub : load(request, parent, isMain));
const extension = require('../extension') as typeof import('../extension');
const pane = require('../pane') as typeof import('../pane');
const settingsWindow = require('../settingsWindow') as typeof import('../settingsWindow');
const missionTree = require('../missionTree') as typeof import('../missionTree');
Module._load = load;

const realPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
assert.ok(realPlatform !== undefined);

/**
 * Activates the extension as an extension host on `platform` would, in a window whose remote name
 * is `remoteName`, and returns what the activation did and the subscriptions it left on its context.
 */
function activateOn(platform: NodeJS.Platform, remoteName: string | undefined): { activation: Activation; subscriptions: unknown[] } {
  activation = fresh();
  env.remoteName = remoteName;
  const context = {
    subscriptions: [] as unknown[],
    extensionUri: { fsPath: '/extension' },
    asAbsolutePath: (file: string) => `/extension/${file}`,
    workspaceState: { keys: () => [], get: () => undefined, update: () => Promise.resolve() },
  } as unknown as import('vscode').ExtensionContext;
  Object.defineProperty(process, 'platform', { ...realPlatform, value: platform });
  try {
    extension.activate(context);
  } finally {
    Object.defineProperty(process, 'platform', realPlatform!);
  }
  return { activation, subscriptions: context.subscriptions };
}

/** Asserts that `run` activated the extension in full: its view, both windows, and the runner. */
function assertActive(run: { activation: Activation; subscriptions: unknown[] }, where: string): void {
  assert.deepStrictEqual(run.activation.messages, [], `${where}: activation shows no message`);
  assert.deepStrictEqual(run.activation.treeViews, [missionTree.MISSIONS_VIEW], `${where}: the side-bar view gets its tree`);
  assert.deepStrictEqual(
    [...run.activation.serializers].sort(),
    [pane.MISSION_VIEW_TYPE, settingsWindow.SETTINGS_VIEW_TYPE].sort(),
    `${where}: both windows can be restored`,
  );
  assert.ok(run.activation.commands.includes(pane.OPEN_MISSION_COMMAND), `${where}: a row's click opens a mission window`);
  assert.ok(run.activation.commands.includes(missionTree.REFRESH_COMMAND), `${where}: the refresh command is registered`);
  assert.ok(run.activation.terminalListeners > 0, `${where}: the runner watches its terminals`);
  assert.ok(run.subscriptions.length > 0, `${where}: activation keeps its registrations`);
}

test('on native Windows activation shows one message naming the supported platforms and leaves the view, windows, and runner inert', () => {
  const run = activateOn('win32', undefined);
  assert.deepStrictEqual(run.activation.messages, [{ kind: 'error', text: extension.NATIVE_WINDOWS_MESSAGE }], 'exactly one message');
  assert.match(extension.NATIVE_WINDOWS_MESSAGE, /macOS, Linux, or through Remote-WSL/);
  assert.deepStrictEqual(run.activation.treeViews, [], 'the side-bar view gets no tree');
  assert.deepStrictEqual(run.activation.serializers, [], 'no window is restored');
  assert.deepStrictEqual(run.activation.commands, [], 'no command is registered, so no window opens and no run starts');
  assert.strictEqual(run.activation.terminalListeners, 0, 'the runner watches no terminal');
  assert.strictEqual(run.activation.watchers, 0, 'nothing is read or watched');
  assert.deepStrictEqual(run.subscriptions, [], 'activation leaves nothing on its context');
});

test('in a remote window the check never fires, a Remote-WSL window on the Linux side included', () => {
  assertActive(activateOn('linux', 'wsl'), 'a Remote-WSL window');
  assertActive(activateOn('win32', 'wsl'), 'a remote window reported as win32');
  assertActive(activateOn('win32', 'ssh-remote'), 'an SSH remote window reported as win32');
});

test('on macOS and on Linux the check never fires and the extension activates in full', () => {
  assertActive(activateOn('darwin', undefined), 'macOS');
  assertActive(activateOn('linux', undefined), 'Linux');
});

test('the package stays universal, installable on every platform', () => {
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));
  for (const key of ['os', 'cpu']) {
    assert.strictEqual(manifest[key], undefined, `the manifest carries no ${key} entry`);
  }
  assert.doesNotMatch(manifest.scripts.package, /--target/, 'the package is built for no one platform');
});
