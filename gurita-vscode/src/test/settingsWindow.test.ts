import { test } from 'node:test';
import * as assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
// The Settings window, against a stub of the `vscode` module standing in for the editor: the
// webview panels the extension creates, one record per panel with the messages its page posts
// and its reveals, the side-bar view's tree stand-in, the commands, the terminals, and the
// notifications the extension's activation reaches. The terminals record how they were created and
// how often they were shown, and a test closes one with an exit status as the editor does when its
// process ends; the notifications are recorded by kind.
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

/** A terminal the stub's editor created: its options, the number of `show` calls, and its exit status once closed. */
interface StubTerminal {
  options: Record<string, unknown>;
  shows: number;
  exitStatus?: { code: number | undefined };
  show(): void;
}
/** Every terminal the stub's editor created, in order. */
const terminals: StubTerminal[] = [];
/** The listeners the extension registered for a terminal's close. */
const closeListeners: ((terminal: unknown) => void)[] = [];
/** Every notification the extension showed, in order, by kind. */
const notifications: { kind: 'information' | 'warning' | 'error'; message: string }[] = [];
/** Every input box and quick pick the extension opened, in order. */
const prompts: string[] = [];
/** One entry of a quick pick the extension opened. */
interface StubPickItem {
  label: string;
  description?: string;
  detail?: string;
}
/** Every quick pick the extension opened, in order: its entries and its options. */
const quickPicks: { items: StubPickItem[]; options: { title?: string; placeHolder?: string } }[] = [];
/** The labels the next quick picks are answered with, in order, undefined dismissing one; a pick none is queued for is dismissed. */
const pickAnswers: (string | undefined)[] = [];

/** Closes `terminal` with the exit status `code`, as the editor does when its process ends. */
function closeTerminal(terminal: StubTerminal, code: number | undefined): void {
  terminal.exitStatus = { code };
  for (const listener of [...closeListeners]) {
    listener(terminal);
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
    registerWebviewPanelSerializer: () => disposable,
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
    createTerminal(options: Record<string, unknown>): StubTerminal {
      const terminal: StubTerminal = {
        options,
        shows: 0,
        show(): void {
          terminal.shows++;
        },
      };
      terminals.push(terminal);
      return terminal;
    },
    onDidCloseTerminal(listener: (terminal: unknown) => void) {
      closeListeners.push(listener);
      return disposable;
    },
    showInformationMessage(message: string) {
      notifications.push({ kind: 'information', message });
      return Promise.resolve(undefined);
    },
    showWarningMessage(message: string) {
      notifications.push({ kind: 'warning', message });
      return Promise.resolve(undefined);
    },
    showErrorMessage(message: string) {
      notifications.push({ kind: 'error', message });
      return Promise.resolve(undefined);
    },
    showInputBox: () => {
      prompts.push('input box');
      return Promise.resolve(undefined);
    },
    showQuickPick: (items: StubPickItem[], options: { title?: string; placeHolder?: string }) => {
      prompts.push('quick pick');
      quickPicks.push({ items, options });
      const answer = pickAnswers.shift();
      return Promise.resolve(answer === undefined ? undefined : items.find((each) => each.label === answer));
    },
  },
};

const load = Module._load;
Module._load = (request, parent, isMain) => (request === 'vscode' ? stub : load(request, parent, isMain));
const extension = require('../extension') as typeof import('../extension');
const settingsWindow = require('../settingsWindow') as typeof import('../settingsWindow');
const missionTree = require('../missionTree') as typeof import('../missionTree');
const startingRows = require('../startingRows') as typeof import('../startingRows');
const pluginRuns = require('../pluginRuns') as typeof import('../pluginRuns');
const { MISSION_VIEW_TYPE } = require('../pane') as typeof import('../pane');
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

test("the manifest offers Settings as the gear icon action in every mission window's editor title bar, keyed on the mission window's view type alone", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));
  assert.deepStrictEqual(
    manifest.contributes.menus['editor/title'],
    [{ command: settingsWindow.SETTINGS_COMMAND, when: `activeWebviewPanelId == ${MISSION_VIEW_TYPE}`, group: 'navigation' }],
    "the mission window's title bar runs the same Settings command the side-bar's title-bar action runs",
  );
  const contributed = manifest.contributes.commands.find((each: { command: string }) => each.command === settingsWindow.SETTINGS_COMMAND);
  assert.strictEqual(contributed.icon, '$(gear)', 'shown as the gear codicon');
  assert.ok(
    manifest.contributes.menus['view/title'].some((entry: { command: string }) => entry.command === settingsWindow.SETTINGS_COMMAND),
    "the side-bar's title-bar action runs that one command",
  );
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
  assert.doesNotMatch(window.html, /page\.js/, "and not a mission window's");
  run();
  run();
  assert.strictEqual(settingsPanels().length, 1, 'a second run creates no second window');
  assert.strictEqual(window.reveals, 2, 'each later run reveals the open window');
  assert.deepStrictEqual(
    panels.filter((each) => each.viewType !== settingsWindow.SETTINGS_VIEW_TYPE),
    [],
    'the Settings window is a window of its own, no mission window opened beside it',
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

test("an edit made in the Settings window reaches the open mission windows' pages and the two mission-starting rows at once", async () => {
  commands.get(missionTree.OPEN_MISSION_COMMAND)?.(ALPHA);
  const pane = panels.find((each) => each.viewType === MISSION_VIEW_TYPE);
  assert.ok(pane?.receive !== undefined, "the mission's window is open");
  await until(() => {
    pane.receive?.({ type: 'ready' });
    return postedOf(pane, 'page').length > 0;
  }, "the mission's window draws the live read");
  assert.strictEqual(rowDescription('Define mission'), 'Claude Code · sonnet · medium', "the recipe's shipped default stands");

  let redraws = 0;
  tree.onDidChangeTreeData(() => {
    redraws++;
  });
  const window = openWindow();
  let from = window.posted.length;
  let paneFrom = pane.posted.length;
  sendSettings({ type: 'pickDefault', recipe: 'define-mission-goal', variant: { name: 'quick', origin: 'own' } });
  await until(() => postedOf(window, 'variants', from).length > 0 && postedOf(pane, 'page', paneFrom).length > 0, "the edit is posted to the Settings window and the mission's window");
  const listed = (postedOf(window, 'variants', from)[0].variants as { recipes: { name: string; variants: { name: string; isDefault: boolean }[] }[] }).recipes.find(
    (each) => each.name === 'define-mission-goal',
  );
  assert.deepStrictEqual(listed?.variants.filter((each) => each.isDefault).map((each) => each.name), ['quick'], 'the window lists the default picked');
  assert.ok(redraws > 0, 'the tree is redrawn');
  assert.strictEqual(rowDescription('Define mission'), 'Antigravity · gemini-4-argon · low', 'the Define mission row describes the default picked');

  redraws = 0;
  from = window.posted.length;
  paneFrom = pane.posted.length;
  sendSettings({ type: 'setHarnessEnabled', harness: 'antigravity', enabled: false });
  await until(() => postedOf(window, 'harnessSettings', from).length > 0 && postedOf(pane, 'page', paneFrom).length > 0, "the harness edit is posted to the Settings window and the mission's window");
  assert.ok(redraws > 0, 'the tree is redrawn');
  assert.strictEqual(rowDescription('Define mission'), 'Claude Code · sonnet · medium', 'the row falls back off the disabled harness at once');
  const narrowed = postedOf(pane, 'page', paneFrom)[0];
  assert.ok(
    !JSON.stringify(narrowed.mission).includes('agy '),
    "the mission's page is posted with no variant of the disabled harness selected",
  );

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

/** The install or update run notes posted to `panel` beyond the first `from`, in order. */
function runNotes(panel: StubPanel, from = 0): unknown[] {
  return postedOf(panel, 'pluginRun', from).map((message) => message.run);
}

/** The states of the harness checks posted to `panel` beyond the first `from`, in order. */
function checkStates(panel: StubPanel, from = 0): string[] {
  return postedOf(panel, 'harnessCheck', from).map((message) => (message.check as { state: string }).state);
}

/** Waits until no check is running, the last check posted to the open window being a result. */
async function checkSettled(): Promise<void> {
  await until(() => {
    const states = checkStates(openWindow());
    return states.length > 0 && states[states.length - 1] !== 'running';
  }, 'the check is done');
}

test('an install starts the packaged install script as a shown terminal of its own at the project root, its note kept and posted, and a success is reported with the restart sentence and the check run afresh', async () => {
  await checkSettled();
  const window = openWindow();
  const from = window.posted.length;
  const created = terminals.length;
  const runs = checkRuns();
  sendSettings({ type: 'runPlugin', harness: 'claude', action: 'install', scopes: ['project'] });
  await until(() => terminals.length === created + 1 && runNotes(window, from).length > 0, 'the run starts');
  const terminal = terminals[created];
  assert.deepStrictEqual(terminal.options, {
    name: 'Gurita: install on Claude Code (project)',
    shellPath: 'python3',
    shellArgs: ['/extension/install_plugin.py', 'claude', 'install', '--project', root, '--scope', 'project', '--wait'],
    cwd: root,
    isTransient: true,
  }, "the terminal's own process is the packaged install script, started at the project root");
  assert.strictEqual(terminal.shows, 1, 'the terminal is shown');
  assert.deepStrictEqual(runNotes(window, from), [{ harness: 'claude', action: 'install', scopes: ['project'] }], 'the window is posted the run going');
  assert.deepStrictEqual(pluginRuns.pluginRunGoing(), { harness: 'claude', action: 'install', scopes: ['project'] }, "the run's note is kept");

  const readyFrom = window.posted.length;
  sendSettings({ type: 'ready' });
  await until(() => runNotes(window, readyFrom).length > 0, 'the ready message is answered');
  assert.deepStrictEqual(runNotes(window, readyFrom), [{ harness: 'claude', action: 'install', scopes: ['project'] }], 'a ready message is posted the run going');
  sendSettings({ type: 'checkHarnesses' });
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.strictEqual(checkRuns(), runs, 'check again runs no check while the run goes');

  const told = notifications.length;
  const endFrom = window.posted.length;
  closeTerminal(terminal, 0);
  await until(() => checkRuns() === runs + 1 && checkStates(window, endFrom).includes('checked'), 'the run ending runs the check afresh');
  assert.deepStrictEqual(notifications.slice(told), [
    { kind: 'information', message: `The Gurita plugin was installed on Claude Code. ${pluginRuns.RESTART_SENTENCE}` },
  ], 'a success is reported in an information notification with the restart sentence');
  assert.strictEqual(pluginRuns.RESTART_SENTENCE, 'Running sessions of that harness must be restarted to use the new copy.');
  assert.deepStrictEqual(runNotes(window, endFrom), [null], 'the window is posted that no run is going');
  assert.deepStrictEqual(checkStates(window, endFrom), ['running', 'checked'], 'the whole check runs afresh, its result posted');
  assert.strictEqual(pluginRuns.pluginRunGoing(), undefined, "the run's note is cleared");
});

test('a failed run, a failed release lookup included, is reported as an error with no restart sentence, and the check runs afresh', async () => {
  await checkSettled();
  const window = openWindow();
  for (const [action, code, done] of [
    ['update', 1, 'updated'],
    ['install', undefined, 'installed'],
  ] as const) {
    const from = window.posted.length;
    const created = terminals.length;
    const runs = checkRuns();
    sendSettings({ type: 'runPlugin', harness: 'codex', action });
    await until(() => terminals.length === created + 1 && runNotes(window, from).length > 0, 'the run starts');
    const terminal = terminals[created];
    assert.deepStrictEqual(terminal.options.shellArgs, ['/extension/install_plugin.py', 'codex', action, '--project', root, '--wait'], 'Codex is given no scope');
    assert.strictEqual(terminal.options.name, `Gurita: ${action} on Codex`);
    const told = notifications.length;
    closeTerminal(terminal, code);
    await until(() => checkRuns() === runs + 1 && checkStates(window, from).includes('checked'), 'the run ending runs the check afresh');
    const why = code === undefined ? 'its terminal closed before the run ended' : `the run ended with exit status ${code}, its terminal having shown the cause`;
    assert.deepStrictEqual(notifications.slice(told), [{ kind: 'error', message: `The Gurita plugin could not be ${done} on Codex: ${why}.` }]);
    assert.ok(!notifications[told].message.includes(pluginRuns.RESTART_SENTENCE), 'a failure adds no restart sentence');
    assert.deepStrictEqual(runNotes(window, from).slice(-1), [null]);
    assert.strictEqual(pluginRuns.pluginRunGoing(), undefined);
  }
});

test('a second run is refused while one is going, its terminal revealed, and a closing terminal of another run does not end it', async () => {
  await checkSettled();
  const window = openWindow();
  const from = window.posted.length;
  const created = terminals.length;
  sendSettings({ type: 'runPlugin', harness: 'antigravity', action: 'update' });
  await until(() => terminals.length === created + 1 && runNotes(window, from).length > 0, 'the first run starts');
  const first = terminals[created];
  assert.deepStrictEqual(first.options.shellArgs, ['/extension/install_plugin.py', 'antigravity', 'update', '--project', root, '--wait']);
  const told = notifications.length;
  const shows = first.shows;
  for (const second of [
    { type: 'runPlugin', harness: 'codex', action: 'install' },
    { type: 'runPlugin', harness: 'claude', action: 'update', scopes: ['user', 'local'] },
  ]) {
    sendSettings(second);
  }
  await until(() => notifications.length === told + 2, 'each refusal is told');
  assert.strictEqual(terminals.length, created + 1, 'no second terminal is created');
  assert.deepStrictEqual(notifications.slice(told), [
    { kind: 'information', message: pluginRuns.RUN_GOING },
    { kind: 'information', message: pluginRuns.RUN_GOING },
  ]);
  assert.strictEqual(first.shows, shows + 2, "each refusal reveals the going run's terminal");
  assert.deepStrictEqual(pluginRuns.pluginRunGoing(), { harness: 'antigravity', action: 'update', scopes: [] }, 'the first run is still the one going');

  const other: StubTerminal = { options: {}, shows: 0, show(): void {} };
  closeTerminal(other, 0);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.ok(pluginRuns.pluginRunGoing() !== undefined, "another terminal's close leaves the run going");

  const runs = checkRuns();
  closeTerminal(first, 0);
  await until(() => checkRuns() === runs + 1, 'the run ending runs the check afresh');
  await checkSettled();
  const next = terminals.length;
  sendSettings({ type: 'runPlugin', harness: 'claude', action: 'update', scopes: ['user', 'local'] });
  await until(() => terminals.length === next + 1, 'once the run ended, another starts');
  assert.deepStrictEqual(terminals[next].options.shellArgs, [
    '/extension/install_plugin.py', 'claude', 'update', '--project', root, '--scope', 'user', '--scope', 'local', '--wait',
  ]);
  closeTerminal(terminals[next], 0);
  await until(() => pluginRuns.pluginRunGoing() === undefined, 'that run ends');
  await checkSettled();
});

test("an Update click's request starts the update at once with no confirmation, on Claude Code over every detected scope it names", async () => {
  await checkSettled();
  const window = openWindow();
  for (const [request, args, name] of [
    [
      { type: 'runPlugin', harness: 'claude', action: 'update', scopes: ['user', 'project', 'local'] },
      ['claude', 'update', '--project', root, '--scope', 'user', '--scope', 'project', '--scope', 'local', '--wait'],
      'Gurita: update on Claude Code (user, project, local)',
    ],
    [{ type: 'runPlugin', harness: 'antigravity', action: 'update' }, ['antigravity', 'update', '--project', root, '--wait'], 'Gurita: update on Antigravity'],
  ] as const) {
    const from = window.posted.length;
    const created = terminals.length;
    const told = notifications.length;
    const asked = prompts.length;
    sendSettings(request);
    await until(() => terminals.length === created + 1 && runNotes(window, from).length > 0, 'the update starts');
    const terminal = terminals[created];
    assert.deepStrictEqual(terminal.options.shellArgs, ['/extension/install_plugin.py', ...args], 'the update acts at every scope named');
    assert.strictEqual(terminal.options.name, name);
    assert.strictEqual(terminal.shows, 1, 'its terminal is shown');
    assert.deepStrictEqual(prompts.slice(asked), [], 'no input box or quick pick is opened first');
    assert.deepStrictEqual(notifications.slice(told), [], 'no confirmation or other notification is shown first');
    const runs = checkRuns();
    closeTerminal(terminal, 0);
    await until(() => pluginRuns.pluginRunGoing() === undefined && checkRuns() === runs + 1, 'the update ends');
    await checkSettled();
  }
});

test('a run request naming no harness, action, or scopes the install script takes starts nothing', async () => {
  const created = terminals.length;
  for (const request of [
    { type: 'runPlugin', harness: 'vscode', action: 'install' },
    { type: 'runPlugin', harness: 'codex', action: 'remove' },
    { type: 'runPlugin', harness: 'codex', action: 'install', scopes: ['user'] },
    { type: 'runPlugin', harness: 'claude', action: 'install' },
    { type: 'runPlugin', harness: 'claude', action: 'install', scopes: ['user', 'project'] },
    { type: 'runPlugin', harness: 'claude', action: 'update', scopes: ['managed'] },
    { type: 'runPlugin', harness: 'claude', action: 'update', scopes: ['user', 'user'] },
    { type: 'runPlugin', harness: 'claude', action: 'update', scopes: 'user' },
  ]) {
    sendSettings(request);
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.strictEqual(terminals.length, created, 'no terminal is created');
  assert.strictEqual(pluginRuns.pluginRunGoing(), undefined);
});

/** Delivers `request` and waits until the extension has opened a quick pick or started a terminal for it, or shown a notification. */
async function settledRequest(request: unknown, what: string): Promise<void> {
  const picks = quickPicks.length;
  const created = terminals.length;
  const told = notifications.length;
  sendSettings(request);
  await until(() => quickPicks.length > picks || terminals.length > created || notifications.length > told, what);
}

/** Ends the run going with a success and waits until the check that follows it is done. */
async function endRun(): Promise<void> {
  const going = terminals[terminals.length - 1];
  const runs = checkRuns();
  closeTerminal(going, 0);
  await until(() => pluginRuns.pluginRunGoing() === undefined && checkRuns() === runs + 1, 'the run ends');
  await checkSettled();
}

test("an Install click's request on Claude Code opens VS Code's quick pick of the scopes on offer, each saying where it is recorded, and installs at the scope picked with no confirmation", async () => {
  await checkSettled();
  const window = openWindow();
  for (const [offered, listed, answer] of [
    [['user', 'project', 'local'], ['user', 'project', 'local'], 'local'],
    [['local', 'user'], ['user', 'local'], 'user'],
    [['project'], ['project'], 'project'],
  ] as const) {
    const from = window.posted.length;
    const created = terminals.length;
    const told = notifications.length;
    const picks = quickPicks.length;
    const asked = prompts.length;
    pickAnswers.push(answer);
    sendSettings({ type: 'installPlugin', harness: 'claude', scopes: offered });
    await until(() => terminals.length === created + 1 && runNotes(window, from).length > 0, 'the install starts');
    assert.strictEqual(quickPicks.length, picks + 1, 'one quick pick is opened');
    assert.deepStrictEqual(prompts.slice(asked), ['quick pick'], 'no input box is opened');
    const pick = quickPicks[picks];
    assert.deepStrictEqual(
      pick.items.map((each) => [each.label, each.description]),
      listed.map((scope) => [scope, pluginRuns.CLAUDE_SCOPE_RECORDS[scope]]),
      'the scopes on offer are listed in the order user, project, local, each with where it is recorded',
    );
    assert.strictEqual(pick.options.title, 'Install the Gurita plugin on Claude Code');
    const terminal = terminals[created];
    assert.deepStrictEqual(terminal.options.shellArgs, ['/extension/install_plugin.py', 'claude', 'install', '--project', root, '--scope', answer, '--wait'], 'the install runs at the scope picked');
    assert.strictEqual(terminal.options.name, `Gurita: install on Claude Code (${answer})`);
    assert.strictEqual(terminal.shows, 1, 'its terminal is shown');
    assert.deepStrictEqual(notifications.slice(told), [], 'no confirmation or other notification is shown first');
    assert.deepStrictEqual(runNotes(window, from), [{ harness: 'claude', action: 'install', scopes: [answer] }]);
    await endRun();
  }
  assert.deepStrictEqual(pluginRuns.CLAUDE_SCOPE_RECORDS, {
    user: 'Recorded in your user settings',
    project: "Recorded in the project's shared .claude/settings.json",
    local: "Recorded in the project's local settings",
  });
});

test('a dismissed scope pick installs nothing', async () => {
  await checkSettled();
  const created = terminals.length;
  const told = notifications.length;
  pickAnswers.push(undefined);
  await settledRequest({ type: 'installPlugin', harness: 'claude', scopes: ['user', 'project'] }, 'the pick opens');
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.strictEqual(terminals.length, created, 'no terminal is created');
  assert.deepStrictEqual(notifications.slice(told), [], 'nothing is told');
  assert.strictEqual(pluginRuns.pluginRunGoing(), undefined);
});

test("an Install click's request on Antigravity or Codex starts the install at once, per-user, with no pick and no confirmation", async () => {
  await checkSettled();
  const window = openWindow();
  for (const [harness, name] of [
    ['antigravity', 'Antigravity'],
    ['codex', 'Codex'],
  ] as const) {
    const from = window.posted.length;
    const created = terminals.length;
    const told = notifications.length;
    const asked = prompts.length;
    sendSettings({ type: 'installPlugin', harness });
    await until(() => terminals.length === created + 1 && runNotes(window, from).length > 0, 'the install starts');
    const terminal = terminals[created];
    assert.deepStrictEqual(terminal.options.shellArgs, ['/extension/install_plugin.py', harness, 'install', '--project', root, '--wait'], 'no scope is given');
    assert.strictEqual(terminal.options.name, `Gurita: install on ${name}`);
    assert.deepStrictEqual(prompts.slice(asked), [], 'no input box or quick pick is opened first');
    assert.deepStrictEqual(notifications.slice(told), [], 'no confirmation or other notification is shown first');
    await endRun();
  }
});

test('with no workspace folder open the window is told so, and the scope pick offers user alone', async () => {
  await checkSettled();
  const window = openWindow();
  const readyFrom = window.posted.length;
  sendSettings({ type: 'ready' });
  await until(() => postedOf(window, 'workspace', readyFrom).length > 0, 'the ready message is answered');
  assert.deepStrictEqual(postedOf(window, 'workspace', readyFrom), [{ type: 'workspace', folderOpen: true }], 'a ready message is told a folder is open');

  const folders = workspace.folders;
  workspace.folders = undefined;
  try {
    const closedFrom = window.posted.length;
    sendSettings({ type: 'ready' });
    await until(() => postedOf(window, 'workspace', closedFrom).length > 0, 'the ready message is answered');
    assert.deepStrictEqual(postedOf(window, 'workspace', closedFrom), [{ type: 'workspace', folderOpen: false }], 'a ready message is told no folder is open');

    const picks = quickPicks.length;
    pickAnswers.push(undefined);
    await settledRequest({ type: 'installPlugin', harness: 'claude', scopes: ['user', 'project', 'local'] }, 'the pick opens');
    assert.deepStrictEqual(
      quickPicks[picks].items.map((each) => each.label),
      ['user'],
      'user alone is offered, project and local not named',
    );

    const created = terminals.length;
    sendSettings({ type: 'installPlugin', harness: 'claude', scopes: ['project', 'local'] });
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.strictEqual(quickPicks.length, picks + 1, 'no pick is opened when only project and local are asked for');
    assert.strictEqual(terminals.length, created, 'nothing is installed');
  } finally {
    workspace.folders = folders;
  }
});

test('an install request while a run is going opens no pick and is refused, its terminal revealed', async () => {
  await checkSettled();
  const window = openWindow();
  const from = window.posted.length;
  const created = terminals.length;
  sendSettings({ type: 'runPlugin', harness: 'codex', action: 'update' });
  await until(() => terminals.length === created + 1 && runNotes(window, from).length > 0, 'the update starts');
  const going = terminals[created];
  const shows = going.shows;
  const picks = quickPicks.length;
  const told = notifications.length;
  sendSettings({ type: 'installPlugin', harness: 'claude', scopes: ['user'] });
  sendSettings({ type: 'installPlugin', harness: 'antigravity' });
  await until(() => notifications.length === told + 2, 'each refusal is told');
  assert.strictEqual(quickPicks.length, picks, 'no quick pick is opened');
  assert.strictEqual(terminals.length, created + 1, 'no second terminal is created');
  assert.deepStrictEqual(notifications.slice(told), [
    { kind: 'information', message: pluginRuns.RUN_GOING },
    { kind: 'information', message: pluginRuns.RUN_GOING },
  ]);
  assert.strictEqual(going.shows, shows + 2, "the going run's terminal is revealed");
  await endRun();
});

test('an install request naming no harness, or no scope Claude Code offers, starts nothing and opens no pick', async () => {
  await checkSettled();
  const created = terminals.length;
  const picks = quickPicks.length;
  for (const request of [
    { type: 'installPlugin', harness: 'vscode' },
    { type: 'installPlugin', harness: 'codex', scopes: ['user'] },
    { type: 'installPlugin', harness: 'claude' },
    { type: 'installPlugin', harness: 'claude', scopes: [] },
    { type: 'installPlugin', harness: 'claude', scopes: ['managed'] },
    { type: 'installPlugin', harness: 'claude', scopes: ['user', 'user'] },
    { type: 'installPlugin', harness: 'claude', scopes: 'user' },
  ]) {
    sendSettings(request);
  }
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.strictEqual(quickPicks.length, picks, 'no quick pick is opened');
  assert.strictEqual(terminals.length, created, 'no terminal is created');
  assert.strictEqual(pluginRuns.pluginRunGoing(), undefined);
});
