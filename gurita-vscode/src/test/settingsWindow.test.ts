import { test } from 'node:test';
import * as assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
// The Settings window, against a stub of the `vscode` module standing in for the editor: the
// webview panels the extension creates, one record per panel with the messages its page posts
// and its reveals, the side-bar view's tree stand-in, the commands, the terminals, and the
// notifications the extension's activation reaches.
const Module = require('node:module') as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};

const disposable = { dispose(): void {} };

/** A webview panel the stub's editor created: how it was created, what its page's messages reach, and what was posted to it. */
interface StubPanel {
  viewType: string;
  title: string;
  column: unknown;
  options: { enableScripts?: boolean };
  visible: boolean;
  /** The number of `reveal` calls made on it. */
  reveals: number;
  html: string;
  /** Every message the extension posted to its page, in order. */
  posted: Record<string, unknown>[];
  receive?: (message: unknown) => void;
  /** Closes the panel, as the editor does when the person closes it. */
  dispose?: () => void;
}
/** Every webview panel the stub's editor created, in order. */
const panels: StubPanel[] = [];

/** The commands the extension registered, by id. */
const commands = new Map<string, (...args: unknown[]) => unknown>();

/** The tree data provider the stub's editor was given. */
interface StubProvider {
  onDidChangeTreeData: (listener: () => void) => { dispose(): void };
  getTreeItem(element: unknown): StubTreeItem;
  getChildren(element?: unknown): unknown[];
}
let provider: StubProvider | undefined;

class StubTreeItem {
  id?: string;
  description?: string;
  tooltip?: string;
  iconPath?: unknown;
  command?: unknown;
  contextValue?: string;
  constructor(
    readonly label: string,
    readonly collapsibleState: number,
  ) {}
}

class StubEventEmitter<T> {
  private listeners: ((value: T) => void)[] = [];
  readonly event = (listener: (value: T) => void) => {
    this.listeners.push(listener);
    return disposable;
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
  ThemeIcon: class {
    constructor(readonly id: string) {}
  },
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
    createFileSystemWatcher: () => {
      const on = () => () => disposable;
      return { onDidCreate: on(), onDidChange: on(), onDidDelete: on(), dispose(): void {} };
    },
  },
  window: {
    createTreeView(_id: string, options: { treeDataProvider: StubProvider }) {
      provider = options.treeDataProvider;
      return { ...disposable, message: undefined };
    },
    createWebviewPanel(viewType: string, title: string, column: unknown, options: { enableScripts?: boolean }): unknown {
      const record: StubPanel = { viewType, title, column, options, visible: true, reveals: 0, html: '', posted: [] };
      panels.push(record);
      return {
        get visible() {
          return record.visible;
        },
        reveal(): void {
          record.reveals++;
        },
        webview: {
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
          record.dispose = listener;
          return disposable;
        },
      };
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
const settingsWindow = require('../settingsWindow') as typeof import('../settingsWindow');
const missionTree = require('../missionTree') as typeof import('../missionTree');
const startingRows = require('../startingRows') as typeof import('../startingRows');
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

/** A fresh git project holding one live mission. */
function project(): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-settings-')));
  git(root, 'init', '-q');
  fs.mkdirSync(path.join(root, ALPHA), { recursive: true });
  fs.writeFileSync(path.join(root, ALPHA, 'requirements.md'), '# Alpha mission\n\n## Goal\n\nA goal.\n');
  fs.writeFileSync(path.join(root, ALPHA, 'open_questions.xml'), '<open-questions/>\n');
  fs.writeFileSync(path.join(root, ALPHA, 'TASKS_TODO.md'), '# TASKS TODO\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', `Mission-definition: ${ALPHA}`);
  return root;
}

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-settings-home-'));
process.env.HOME = home;
fs.mkdirSync(path.join(home, '.gurita'));
/** The line of the own variant `quick` that `define-mission-goal` gains from the own recipe file. */
const QUICK_LINE = 'agy -p "/gurita:define-mission-goal --at <scope> <goal>" --model "gemini-4-argon" --effort low;';
fs.writeFileSync(path.join(home, '.gurita', 'recipes.md'), '### define-mission-goal\n\n#### quick\n```\n' + QUICK_LINE + '\n```\n');

/** A stand-in for the packaged check script, printing every harness found at the packaged version and logging each run. */
const checkDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-settings-check-'));
const CHECK_LOG = path.join(checkDir, 'runs.log');
fs.writeFileSync(
  path.join(checkDir, 'harness_check.py'),
  [
    'import json',
    `open(${JSON.stringify(CHECK_LOG)}, "a").write("run\\n")`,
    'print(json.dumps({key: {"found": True, "installed": True, "version": "2.0.0"} for key in ("claude", "antigravity", "codex")}))',
    '',
  ].join('\n'),
);
fs.writeFileSync(path.join(checkDir, 'plugin_version.txt'), '2.0.0\n');

/** The number of times the check script ran. */
function checkRuns(): number {
  return fs.existsSync(CHECK_LOG) ? fs.readFileSync(CHECK_LOG, 'utf8').split('\n').filter((line) => line !== '').length : 0;
}

packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
packaged.set('bundled/shipped_recipes.md', path.join(__dirname, '..', '..', 'shipped_recipes.md'));
packaged.set('harness_check.py', path.join(checkDir, 'harness_check.py'));
packaged.set('bundled/plugin_version.txt', path.join(checkDir, 'plugin_version.txt'));
const root = project();
workspace.folders = [{ uri: { fsPath: root } }];

extension.activate(context);
assert.ok(provider !== undefined, 'activation creates the side-bar tree');
const tree = provider;

/** The Settings windows the extension created, in order. */
function settingsPanels(): StubPanel[] {
  return panels.filter((each) => each.viewType === settingsWindow.SETTINGS_VIEW_TYPE);
}

/** The Settings window open now. */
function openWindow(): StubPanel {
  const found = settingsPanels().filter((each) => each.dispose !== undefined);
  assert.strictEqual(found.length, 1, 'one Settings window is open');
  return found[0];
}

/** Delivers `message` to the extension as the open Settings window's page posts it. */
function sendSettings(message: unknown): void {
  const window = openWindow();
  assert.ok(window.receive !== undefined);
  window.receive(message);
}

/** Closes the open Settings window, as the person closing its tab does. */
function closeWindow(): void {
  const window = openWindow();
  const dispose = window.dispose;
  window.dispose = undefined;
  window.receive = undefined;
  dispose?.();
}

/** The messages of `type` posted to `panel` beyond the first `from`. */
function postedOf(panel: StubPanel, type: string, from = 0): Record<string, unknown>[] {
  return panel.posted.slice(from).filter((message) => message.type === type);
}

/** The description of the side-bar view's row labelled `label`, its rows read afresh as the editor reads them on a redraw. */
function rowDescription(label: string): string | undefined {
  const item = tree
    .getChildren()
    .map((row) => tree.getTreeItem(row))
    .find((each) => each.label === label);
  assert.ok(item !== undefined, `no row labelled ${label}`);
  return item.description;
}

test('the manifest contributes the Settings command with a gear icon, hidden from the Command Palette and run by an icon action in the view title bar beside Refresh', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));
  const contributed = manifest.contributes.commands.find((each: { command: string }) => each.command === settingsWindow.SETTINGS_COMMAND);
  assert.ok(contributed !== undefined, 'the Settings command is contributed');
  assert.strictEqual(contributed.title, 'Settings');
  assert.strictEqual(contributed.icon, '$(gear)');
  assert.ok(
    manifest.contributes.menus.commandPalette.some((entry: { command: string; when: string }) => entry.command === settingsWindow.SETTINGS_COMMAND && entry.when === 'false'),
    'the Settings command is hidden from the Command Palette',
  );
  assert.deepStrictEqual(
    manifest.contributes.menus['view/title'],
    [
      { command: missionTree.REFRESH_COMMAND, when: `view == ${missionTree.MISSIONS_VIEW}`, group: 'navigation@1' },
      { command: settingsWindow.SETTINGS_COMMAND, when: `view == ${missionTree.MISSIONS_VIEW}`, group: 'navigation@2' },
    ],
    "the view's title bar runs Refresh and, beside it, Settings",
  );
  assert.ok(commands.has(settingsWindow.SETTINGS_COMMAND), 'activation registers the Settings command');
});

test('the Settings command opens one Settings window in the editor area, reveals it while it is open, and opens it afresh once it is closed', async () => {
  const run = commands.get(settingsWindow.SETTINGS_COMMAND);
  assert.ok(run !== undefined);
  assert.deepStrictEqual(settingsPanels(), [], 'no window opens before the command runs');
  run();
  const window = openWindow();
  assert.strictEqual(window.title, settingsWindow.SETTINGS_TITLE);
  assert.strictEqual(window.column, stub.ViewColumn.Active, 'opened in the editor area');
  assert.strictEqual(window.options.enableScripts, true);
  assert.match(window.html, /settings\.js/, "the window loads the Settings window's own script");
  assert.doesNotMatch(window.html, /page\.js/, "and not the pane's");
  run();
  run();
  assert.strictEqual(settingsPanels().length, 1, 'a second run creates no second window');
  assert.strictEqual(window.reveals, 2, 'each later run reveals the open window');
  assert.deepStrictEqual(
    panels.filter((each) => each.viewType !== settingsWindow.SETTINGS_VIEW_TYPE),
    [],
    'the Settings window is a window of its own, no pane opened beside it',
  );
  closeWindow();
  run();
  assert.strictEqual(settingsPanels().length, 2, 'a run after the close opens a window afresh');
  assert.strictEqual(openWindow().reveals, 0);
  assert.notStrictEqual(openWindow(), window);
  sendSettings({ type: 'ready' });
  await until(() => postedOf(openWindow(), 'harnessCheck').some((message) => (message.check as { state: string }).state === 'checked'), 'the check is posted');
});

test("the harness check runs once in the session, across the window's close and reopening, and again only on check again", async () => {
  await until(() => checkRuns() === 1, 'the first opening runs the check');
  sendSettings({ type: 'ready' });
  closeWindow();
  commands.get(settingsWindow.SETTINGS_COMMAND)?.();
  sendSettings({ type: 'ready' });
  const window = openWindow();
  await until(() => postedOf(window, 'harnessCheck').length > 0 && postedOf(window, 'singleTaskLines').length > 0, 'the reopened window is posted the check kept and its lists');
  assert.deepStrictEqual(
    postedOf(window, 'harnessCheck').map((message) => (message.check as { state: string }).state),
    ['checked'],
    'the reopened window is posted the result kept, never a run',
  );
  for (const kind of ['harnessSettings', 'harnessLists', 'variants', 'singleTaskLines']) {
    assert.strictEqual(postedOf(window, kind).length, 1, `the reopened window is posted the ${kind} read afresh`);
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.strictEqual(checkRuns(), 1, 'neither the close nor the reopening runs the check');
  sendSettings({ type: 'checkHarnesses' });
  await until(() => checkRuns() === 2, 'check again runs the check afresh');
});

test('an edit made in the Settings window reaches the mission pages and the two mission-starting rows at once', async () => {
  commands.get('gurita.openMissionPane')?.();
  const pane = panels.find((each) => each.viewType === 'gurita.missionPane');
  assert.ok(pane?.receive !== undefined, 'the pane is open');
  pane.receive({ type: 'ready' });
  await until(() => postedOf(pane, 'live').length > 0, 'the pane draws the live read');
  assert.strictEqual(rowDescription('Define mission'), 'Claude Code · sonnet · medium', "the recipe's shipped default stands");

  let redraws = 0;
  tree.onDidChangeTreeData(() => {
    redraws++;
  });
  const window = openWindow();
  let from = window.posted.length;
  let paneFrom = pane.posted.length;
  sendSettings({ type: 'pickDefault', recipe: 'define-mission-goal', variant: { name: 'quick', origin: 'own' } });
  await until(() => postedOf(window, 'variants', from).length > 0 && postedOf(pane, 'live', paneFrom).length > 0, 'the edit is posted to the window and the pane');
  const listed = (postedOf(window, 'variants', from)[0].variants as { recipes: { name: string; variants: { name: string; isDefault: boolean }[] }[] }).recipes.find(
    (each) => each.name === 'define-mission-goal',
  );
  assert.deepStrictEqual(listed?.variants.filter((each) => each.isDefault).map((each) => each.name), ['quick'], 'the window lists the default picked');
  const buttons = postedOf(pane, 'live', paneFrom)[0].buttons as Record<string, { variants: { name: string }[]; selected: number }>;
  assert.strictEqual(buttons.defineMission.variants[buttons.defineMission.selected].name, 'quick', "the pane's Define mission button stands on the default picked");
  assert.ok(redraws > 0, 'the tree is redrawn');
  assert.strictEqual(rowDescription('Define mission'), 'Antigravity · gemini-4-argon · low', 'the Define mission row describes the default picked');

  redraws = 0;
  from = window.posted.length;
  paneFrom = pane.posted.length;
  sendSettings({ type: 'setHarnessEnabled', harness: 'antigravity', enabled: false });
  await until(() => postedOf(window, 'harnessSettings', from).length > 0 && postedOf(pane, 'live', paneFrom).length > 0, 'the harness edit is posted to the window and the pane');
  assert.ok(redraws > 0, 'the tree is redrawn');
  assert.strictEqual(rowDescription('Define mission'), 'Claude Code · sonnet · medium', 'the row falls back off the disabled harness at once');
  const narrowed = postedOf(pane, 'live', paneFrom)[0].buttons as Record<string, { variants: { name: string }[] }>;
  assert.deepStrictEqual(narrowed.defineMission.variants.map((each) => each.name), ['default'], "the pane's dropdown leaves the disabled harness's variant out");

  // With Claude Code disabled too, neither row has a variant left to run, and both say so at once.
  assert.strictEqual(rowDescription('New mission'), 'Claude Code · fable · xhigh');
  from = window.posted.length;
  sendSettings({ type: 'setHarnessEnabled', harness: 'claude', enabled: false });
  await until(() => postedOf(window, 'harnessSettings', from).length > 0, 'the harness edit is posted to the window');
  await until(() => rowDescription('New mission') === startingRows.DISABLED_DESCRIPTION, 'the New mission row follows the edit');
  assert.strictEqual(rowDescription('Define mission'), startingRows.DISABLED_DESCRIPTION, 'and so does the Define mission row');
  from = window.posted.length;
  sendSettings({ type: 'setHarnessEnabled', harness: 'claude', enabled: true });
  await until(() => postedOf(window, 'harnessSettings', from).length > 0, 'the harness edit is posted to the window');
  assert.strictEqual(rowDescription('New mission'), 'Claude Code · fable · xhigh');
});

test('the refresh command re-reads the open Settings window, its lists posted afresh and the check left as it stands', async () => {
  const window = openWindow();
  const runs = checkRuns();
  const store = path.join(home, '.gurita', 'variants.json');
  const written = JSON.parse(fs.readFileSync(store, 'utf8'));
  written.harnesses = { ...written.harnesses, antigravity: { ...(written.harnesses?.antigravity ?? {}), enabled: true } };
  fs.writeFileSync(store, JSON.stringify(written));
  const from = window.posted.length;
  commands.get(missionTree.REFRESH_COMMAND)?.();
  await until(() => postedOf(window, 'singleTaskLines', from).length > 0, 'the refresh posts the window its lists afresh');
  assert.deepStrictEqual(
    (postedOf(window, 'harnessSettings', from)[0].settings as { enabled: Record<string, boolean> }).enabled,
    { claude: true, antigravity: true, codex: true },
    'the window shows the store as it stands now',
  );
  assert.strictEqual(postedOf(window, 'variants', from).length, 1);
  assert.strictEqual(postedOf(window, 'harnessLists', from).length, 1);
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.deepStrictEqual(postedOf(window, 'harnessCheck', from), [], 'the refresh posts no check');
  assert.strictEqual(checkRuns(), runs, 'and runs none');
});
