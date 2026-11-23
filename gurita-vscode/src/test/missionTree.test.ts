import { test } from 'node:test';
import * as assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
// The side-bar view's tree, against a stub of the `vscode` module standing in for the editor: a
// tree stand-in recording the view the extension creates and its data provider, the event
// emitter, tree items, and theme icons, beside the file system watcher, the terminals, the
// mission windows a row's click opens, the commands, the input boxes, the QuickPick,
// `workspaceState`, and the notifications the extension's activation reaches.
const Module = require('node:module') as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};

const disposable = { dispose(): void {} };

/** A file system watcher the stub's editor created: the listeners registered on it by event kind. */
interface StubWatcher {
  listeners: Record<'create' | 'change' | 'delete', ((uri: { fsPath: string }) => void)[]>;
}
const watchers: StubWatcher[] = [];

/** A terminal the stub's editor created, with the options it was created with. */
interface StubTerminal {
  name: string;
  options: { name: string; shellArgs?: string[]; cwd?: string; env?: Record<string, string> };
  show(preserveFocus?: boolean): void;
}
const terminals: StubTerminal[] = [];
let closeTerminal: ((terminal: StubTerminal) => void) | undefined;

/** A webview panel the stub's editor created: its view type, its title, and its reveals. */
interface StubPanel {
  viewType: string;
  title: string;
  reveals: number;
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
    createWebviewPanel(viewType: string, title: string): unknown {
      const record: StubPanel = { viewType, title, reveals: 0 };
      webviewPanels.push(record);
      return {
        visible: true,
        reveal(): void {
          record.reveals++;
        },
        webview: {
          html: '',
          cspSource: 'stub-csp',
          asWebviewUri: (uri: unknown) => ({ toString: () => `webview:${JSON.stringify(uri)}` }),
          onDidReceiveMessage: () => disposable,
          postMessage: () => Promise.resolve(true),
        },
        onDidChangeViewState: () => disposable,
        onDidDispose: () => disposable,
      };
    },
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
    showInformationMessage: () => Promise.resolve(undefined),
    showWarningMessage: () => Promise.resolve(undefined),
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
packaged.set('bundled/shipped_recipes.md', path.join(__dirname, '..', '..', 'shipped_recipes.md'));

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
  assert.deepStrictEqual(
    items().map((each) => each.label),
    STARTING_LABELS,
    'the first resolution draws the two mission-starting rows and no mission row until the read settles',
  );
  await until(() => redraws > 0, 'the first read redraws the tree');
  assert.strictEqual(watchers.length, 1, 'the first read that succeeds watches the mission documents');
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
  for (const listener of watchers[0].listeners.change) {
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
  const empty = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-tree-empty-')));
  git(empty, 'init', '-q');
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
  assert.ok(discuss.tooltip?.startsWith('New mission\nRecipe: discuss-mission-goal\nVariant: default\nclaude '), discuss.tooltip);
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
  assert.strictEqual(inputPrompts.length, 2, 'two input boxes are opened');
  assert.match(inputPrompts[0], /goal/);
  assert.match(inputPrompts[1], /scope/);
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
  assert.strictEqual(terminals.length, again, 'a box dismissed with Escape starts nothing');
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
  const refused = startingRows.startingRow('defineMission', 'Define mission', { state: 'refused', cause: 'No recipe is named r.' });
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
  const hidden = [missionTree.STARTING_COMMANDS.discussGoal, missionTree.STARTING_COMMANDS.defineMission, missionTree.PICK_VARIANT_COMMAND];
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
