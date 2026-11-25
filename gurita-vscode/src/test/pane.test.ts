import { test } from 'node:test';
import * as assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { GIT_WATCHED_PATTERN, WATCHED_PATTERN } from '../refresh';
// The mission windows' and the Settings window's answers to what their pages post, against a stub
// of the `vscode` module standing in for the editor: the webview panels, a mission window per
// mission and the one Settings window, the messages each page posts and each panel is posted, the
// terminals the run path creates, and the notifications.
const Module = require('node:module') as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};

interface StubTerminal {
  name: string;
  /** The runner's arguments the terminal was created with. */
  args: string[];
  /** The `preserveFocus` argument of every `show` call, in order. */
  shows: (boolean | undefined)[];
  /** The environment the terminal was created with, its session variables among it. */
  env?: Record<string, string>;
}

const created: StubTerminal[] = [];
/** The listeners of terminal closes registered with the stub's editor, which a test calls as the editor does when a terminal closes. */
const closeListeners: ((terminal: unknown) => void)[] = [];
const notifications: string[] = [];
/** The values the stub's input boxes answer with, one per box in order; an empty queue dismisses the box. */
const typedValues: string[] = [];
/** The options of a box the stub's editor showed: its prompt, the text it opens with, and its validation. */
interface InputBoxOptions {
  prompt?: string;
  /** The text the box opens with. */
  value?: string;
  validateInput?: (value: string) => string | undefined;
}
/** The options of every input box the stub's editor showed, in order. */
const inputBoxes: InputBoxOptions[] = [];
/**
 * The entry of `typedValues` that answers an input panel by pressing its Cancel: every other entry
 * answers a panel by pressing Run with it typed, and an empty queue closes the panel's tab.
 */
const CANCEL_PANEL = '\u0000cancel';
/** An input panel the stub's editor answered: its editor tab's title and the prompt its page was posted. */
interface AnsweredPanel {
  title: string;
  prompt?: unknown;
}
/** Every input panel the stub's editor answered, in order. */
const inputPanels: AnsweredPanel[] = [];
/**
 * Whether the stub's editor answers each input panel by itself from `typedValues`, as soon as the
 * extension has hooked it: its page posting its ready message and then Run, Cancel, or the tab's
 * closing. A test driving a panel by hand turns it off.
 */
let answerPanels = true;
/** Every message the extension posted to any page, the mission windows' and the Settings window's, in order. */
const posted: unknown[] = [];

/** A webview panel the stub's editor created: what its page's messages reach, its disposal, and its reveals. */
interface StubPanel {
  viewType: string;
  /** Its editor tab's title, as created and as the extension last set it. */
  title: string;
  /** The icon its editor tab carries, as the extension last set it. */
  iconPath?: unknown;
  visible: boolean;
  /** Whether it is the active editor. */
  active: boolean;
  /** The number of `reveal` calls made on it. */
  reveals: number;
  /** The script its page shell loads. */
  html: string;
  /** Every message the extension posted to this panel's page, in order. */
  posts: Record<string, unknown>[];
  receive?: (message: unknown) => void;
  /** The listener of its view-state changes, with the panel object the editor hands it. */
  viewState?: () => void;
  /** Closes the panel, as the editor does when the person closes it. */
  dispose?: () => void;
}
/** Every webview panel the stub's editor created, in order. */
const panels: StubPanel[] = [];

/**
 * Makes `target` the active editor, as the editor does when a panel is created, revealed, or reached
 * through its tab or keyboard navigation: every other open panel that was active stops being so and
 * `target`, when it was not, becomes so, each change raising that panel's view-state event, the
 * created panel's own excepted, since the editor raises none for a panel's first state.
 */
function activate(target: StubPanel, created = false): void {
  for (const each of panels) {
    if (each !== target && each.active && each.dispose !== undefined) {
      each.active = false;
      each.viewState?.();
    }
  }
  if (!target.active) {
    target.active = true;
    if (!created) {
      target.viewState?.();
    }
  }
}

/** The panel of `viewType` the extension created last. */
function panelOf(viewType: string): StubPanel | undefined {
  return [...panels].reverse().find((each) => each.viewType === viewType);
}

function notify(message: string): Promise<undefined> {
  notifications.push(message);
  return Promise.resolve(undefined);
}

const disposable = { dispose(): void {} };

/** A built-in codicon as the stub's editor takes it, by its id. */
class StubThemeIcon {
  constructor(readonly id: string) {}
}

/**
 * A file system watcher the stub's editor created: the directory and glob it was created over, the
 * listeners registered on it by event kind, and whether it was disposed.
 */
interface StubWatcher {
  base: string;
  pattern: string;
  listeners: Record<'create' | 'change' | 'delete', ((uri: { fsPath: string }) => void)[]>;
  disposed: boolean;
}
/** Every file system watcher the stub's editor created, in order. */
const watchers: StubWatcher[] = [];

/** The watcher over the mission documents the extension created last. */
function documentWatcher(): StubWatcher {
  const found = [...watchers].reverse().find((each) => each.pattern === WATCHED_PATTERN);
  assert.ok(found !== undefined, 'the mission documents are watched');
  return found;
}

/** The workspace the stub's editor holds open: its folders and the `gurita` settings it answers with. */
const workspace = {
  folders: undefined as { uri: { fsPath: string } }[] | undefined,
  settings: {} as Record<string, unknown>,
};

/** The files the stub's extension package holds, by the relative path `asAbsolutePath` is given. */
const packaged = new Map<string, string>();

/** A URI as the stub's editor builds it from its components. */
interface StubUri {
  scheme: string;
  path: string;
  query: string;
}
/** A text document the stub's editor opened, by its URI, with its language. */
interface StubDocument {
  uri: StubUri;
  languageId: string;
}
/** Every text document the stub's editor showed in an editor tab, in order, with the options it was shown with. */
const shownDocuments: { document: StubDocument; options: unknown }[] = [];

const stub = {
  Uri: {
    joinPath: (...parts: unknown[]) => ({ parts }),
    file: (fsPath: string) => ({ fsPath }),
    from: (components: StubUri): StubUri => ({ scheme: components.scheme, path: components.path, query: components.query }),
  },
  ViewColumn: { Active: -1 },
  ThemeIcon: StubThemeIcon,
  languages: {
    setTextDocumentLanguage: (document: StubDocument, languageId: string) => Promise.resolve({ ...document, languageId }),
  },
  RelativePattern: class {
    constructor(
      readonly base: unknown,
      readonly pattern: string,
    ) {}
  },
  workspace: {
    get workspaceFolders() {
      return workspace.folders;
    },
    getConfiguration: () => ({ get: (key: string, fallback?: unknown) => (key in workspace.settings ? workspace.settings[key] : fallback) }),
    openTextDocument: (uri: StubUri): Promise<StubDocument> => Promise.resolve({ uri, languageId: 'plaintext' }),
    createFileSystemWatcher: (glob: { base: { fsPath: string }; pattern: string }) => {
      const watcher: StubWatcher = { base: glob.base.fsPath, pattern: glob.pattern, listeners: { create: [], change: [], delete: [] }, disposed: false };
      watchers.push(watcher);
      const on = (kind: keyof StubWatcher['listeners']) => (listener: (uri: { fsPath: string }) => void) => {
        watcher.listeners[kind].push(listener);
        return {
          dispose(): void {
            watcher.listeners[kind] = watcher.listeners[kind].filter((each) => each !== listener);
          },
        };
      };
      return {
        onDidCreate: on('create'),
        onDidChange: on('change'),
        onDidDelete: on('delete'),
        dispose(): void {
          watcher.disposed = true;
        },
      };
    },
  },
  window: {
    createWebviewPanel(viewType: string, title: string): unknown {
      const record: StubPanel = { viewType, title, visible: true, active: false, reveals: 0, html: '', posts: [] };
      panels.push(record);
      activate(record, true);
      const panel = {
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
        get active() {
          return record.active;
        },
        reveal(): void {
          record.reveals++;
          activate(record);
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
          postMessage(message: unknown): Promise<boolean> {
            posted.push(message);
            record.posts.push(message as Record<string, unknown>);
            return Promise.resolve(true);
          },
        },
        onDidChangeViewState(listener: (event: { webviewPanel: unknown }) => void) {
          record.viewState = () => listener({ webviewPanel: panel });
          return disposable;
        },
        onDidDispose(listener: () => void) {
          record.dispose = () => {
            record.active = false;
            listener();
          };
          return disposable;
        },
        dispose(): void {
          const dispose = record.dispose;
          record.dispose = undefined;
          record.receive = undefined;
          dispose?.();
        },
      };
      if (viewType === INPUT_VIEW_TYPE && answerPanels) {
        setTimeout(() => answerPanel(record), 0);
      }
      return panel;
    },
    createTerminal(options: { name: string; shellArgs?: string[]; env?: Record<string, string> }): StubTerminal & { show(preserveFocus?: boolean): void } {
      const terminal = {
        name: options.name,
        args: [...(options.shellArgs ?? [])],
        env: options.env === undefined ? undefined : { ...options.env },
        shows: [] as (boolean | undefined)[],
        show(preserveFocus?: boolean): void {
          terminal.shows.push(preserveFocus);
        },
      };
      created.push(terminal);
      return terminal;
    },
    onDidCloseTerminal(listener: (terminal: unknown) => void) {
      closeListeners.push(listener);
      return disposable;
    },
    showTextDocument: (document: StubDocument, options: unknown) => {
      shownDocuments.push({ document, options });
      return Promise.resolve(undefined);
    },
    showInputBox: (options: InputBoxOptions) => {
      inputBoxes.push(options);
      return Promise.resolve(typedValues.shift());
    },
    showInformationMessage: notify,
    showWarningMessage: notify,
    showErrorMessage: notify,
  },
};

/** The view type of the input panel, as `inputPanel.ts` names it. */
const INPUT_VIEW_TYPE = 'gurita.input';

/**
 * Answers the input panel `record` as its page and the person do: its ready message, then, by the
 * next entry of `typedValues`, Run with that text typed, Cancel, or, the queue empty, its tab closed.
 */
function answerPanel(record: StubPanel): void {
  const answered: AnsweredPanel = { title: record.title };
  inputPanels.push(answered);
  record.receive?.({ type: 'ready' });
  answered.prompt = record.posts.find((message) => message.type === 'input')?.prompt;
  const typed = typedValues.shift();
  if (typed === undefined) {
    record.dispose?.();
  } else if (typed === CANCEL_PANEL) {
    record.receive?.({ type: 'cancel' });
  } else {
    record.receive?.({ type: 'run', value: typed });
  }
}

const load = Module._load;
Module._load = (request, parent, isMain) => (request === 'vscode' ? stub : load(request, parent, isMain));
const pane = require('../pane') as typeof import('../pane');
const settingsWindow = require('../settingsWindow') as typeof import('../settingsWindow');
const runs = require('../runs') as typeof import('../runs');
Module._load = load;

/** The project's `workspaceState` as the stub's editor keeps it, by key. */
const workspaceState = new Map<string, unknown>();

const context = {
  subscriptions: [] as unknown[],
  extensionUri: { fsPath: '/extension' },
  asAbsolutePath: (file: string) => packaged.get(file) ?? `/extension/${file}`,
  workspaceState: {
    keys: () => [...workspaceState.keys()],
    get: (key: string) => workspaceState.get(key),
    update: (key: string, value: unknown) => {
      workspaceState.set(key, JSON.parse(JSON.stringify(value)));
      return Promise.resolve();
    },
  },
} as unknown as import('vscode').ExtensionContext;

/** The mission window open for each mission, by its path, as `openWindow` opened it. */
const windowOf = new Map<string, StubPanel>();

/**
 * Opens the window of `mission`, as a click on its row in the side-bar view does, or reveals it when
 * it is open, and returns it; a window created afresh is delivered the ready message its page posts
 * on loading.
 */
function openWindow(mission: string): StubPanel {
  const count = panels.length;
  pane.openMissionWindow(context, mission);
  if (panels.length > count) {
    const opened = panels[panels.length - 1];
    assert.strictEqual(opened.viewType, pane.MISSION_VIEW_TYPE);
    windowOf.set(mission, opened);
    opened.receive?.({ type: 'ready' });
  }
  const found = windowOf.get(mission);
  assert.ok(found?.receive !== undefined, `the window of ${mission} is open`);
  return found;
}

/** Closes the window of `mission`, as the person closing its editor tab does. */
function closeWindow(mission: string): void {
  const target = windowOf.get(mission);
  assert.ok(target?.dispose !== undefined, `the window of ${mission} is open`);
  const dispose = target.dispose;
  target.dispose = undefined;
  target.receive = undefined;
  windowOf.delete(mission);
  dispose();
}

/** The messages only the Settings window's page posts: its check-again control and its edits. */
const SETTINGS_MESSAGES = new Set([
  'checkHarnesses',
  'setHarnessEnabled',
  'addHarnessValue',
  'removeHarnessValue',
  'duplicateVariant',
  'renameVariant',
  'deleteVariant',
  'pickDefault',
  'resetVariant',
  'resetVariantLines',
  'replaceLineValue',
  'replaceLineHarness',
  'duplicateLine',
  'renameLine',
  'deleteLine',
  'resetLine',
]);

/**
 * Delivers a message to the extension as the page that posts it does: a message of the Settings
 * window's page from that window, opened first when it is not; `refresh` as the refresh command
 * runs it; and every other from the window of the mission it names, opened first when it is not, a
 * ready message naming its window's mission here alone, since a page's own carries none.
 */
function send(message: unknown): void {
  const { type, mission } = message as { type?: string; mission?: unknown };
  if (type === 'refresh') {
    pane.refreshMissions(context);
    return;
  }
  const settings = SETTINGS_MESSAGES.has(type ?? '');
  if (settings) {
    if (panelOf(settingsWindow.SETTINGS_VIEW_TYPE)?.dispose === undefined) {
      settingsWindow.openSettings(context);
    }
    const target = panelOf(settingsWindow.SETTINGS_VIEW_TYPE);
    assert.ok(target?.receive !== undefined, 'the Settings window listens to its page');
    target.receive(message);
    return;
  }
  assert.ok(typeof mission === 'string', `a ${type} message names its window's mission`);
  const target = openWindow(mission);
  assert.ok(target.receive !== undefined);
  target.receive(type === 'ready' ? { type: 'ready' } : message);
}

/** Waits until the window of `mission` has been posted a message of `type` beyond its first `from`, and returns it. */
async function windowPosted(mission: string, type: string, from: number): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 400; attempt++) {
    const found = windowOf.get(mission)?.posts.slice(from).find((message) => message.type === type);
    if (found !== undefined) {
      return found;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail(`no ${type} message was posted to the window of ${mission}`);
}

/** Delivers `message` to the extension as the page of the window of `mission` posts it, whatever mission it names. */
function sendFrom(mission: string, message: unknown): void {
  const target = openWindow(mission);
  assert.ok(target.receive !== undefined);
  target.receive(message);
}

/**
 * Opens the window of `mission`, sends `message`, and returns the mission its window is posted in
 * the next page message after it.
 */
async function pageAfter(message: unknown, mission: string): Promise<Record<string, unknown>> {
  const from = openWindow(mission).posts.length;
  send(message);
  return (await windowPosted(mission, 'page', from)).mission as Record<string, unknown>;
}

/** Opens the Settings window, or reveals it when it is open, and delivers the ready message its page posts on loading. */
function showSettings(): void {
  settingsWindow.openSettings(context);
  const target = panelOf(settingsWindow.SETTINGS_VIEW_TYPE);
  assert.ok(target?.receive !== undefined, 'the Settings window listens to its page');
  target.receive({ type: 'ready' });
}

/** Closes the panel of `viewType` the extension created last, as the person closing it does. */
function close(viewType: string): void {
  const target = panelOf(viewType);
  assert.ok(target?.dispose !== undefined, `a ${viewType} panel is open`);
  const dispose = target.dispose;
  target.dispose = undefined;
  target.receive = undefined;
  dispose();
}

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { cwd, stdio: 'ignore' });
}

const GAMMA = 'pkg/mission_gamma/';

/** The harnesses a headless line's harness dropdown offers, by key. */
const ALL_HARNESSES = ['claude', 'antigravity', 'codex'];

/** The shipped file the pane reads in the recipe-list test: one recipe section, as the reader takes it. */
const SHIPPED_TEXT = `# Snippets

## Recipes

### First run

#### Claude Code
\`\`\`
claude -p "/gurita:review-mission-requirements --mission <path>" --model "fable" --effort xhigh;
claude -p "/gurita:provide-alternatives-to-all-open-questions --mission <path>" --model "opus" --effort high;
claude -p "/gurita:recommend-all-open-questions --mission <path>" --model "fable" --effort xhigh;
\`\`\`

#### Antigravity
\`\`\`
agy -p "/gurita:review-mission-requirements --mission <path>" --model "gemini-4-argon" --effort medium;
\`\`\`

### Execute tasks one at a time
\`\`\`
<single-task line>
\`\`\`

### Mixed review
\`\`\`
agy -p "/gurita:review-mission-requirements --mission <path>" --model "gemini-4-argon" --effort medium;
\`\`\`
`;

/** The own file the pane reads in the recipe-list test: one recipe joining a shipped one, one of its own. */
const OWN_TEXT = `### First run
\`\`\`
claude -p "/gurita:review-mission-requirements --mission <path>" --model "sonnet";
\`\`\`

### Mine everywhere
\`\`\`
echo <path>
\`\`\`
`;

/** Waits until the extension has posted a message of `type` beyond the first `from`, and returns it. */
async function postedOf(type: string, from: number): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 400; attempt++) {
    const found = posted.slice(from).find((message) => (message as { type?: string }).type === type);
    if (found !== undefined) {
      return found as Record<string, unknown>;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail(`no ${type} message was posted`);
}

test("a mission window is posted its page's recipes in the shipped file's order, then its own, each with its first variant's lines and the variants its dropdown offers", async () => {
  const home = process.env.HOME;
  process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-home-'));
  try {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-')));
    git(root, 'init', '-q');
    fs.mkdirSync(path.join(root, GAMMA), { recursive: true });
    fs.writeFileSync(path.join(root, GAMMA, 'requirements.md'), '# Gamma mission\n\n## Goal\n\nA goal.\n');
    fs.writeFileSync(path.join(root, GAMMA, 'open_questions.xml'), '<open-questions/>\n');
    fs.writeFileSync(path.join(root, GAMMA, 'TASKS_TODO.md'), '# TASKS TODO\n');
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', `Mission-definition: ${GAMMA}`);
    const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-recipes-'));
    fs.writeFileSync(path.join(files, 'shipped_recipes.md'), SHIPPED_TEXT);
    fs.writeFileSync(path.join(files, 'recipes.md'), OWN_TEXT);
    packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
    packaged.set('bundled/shipped_recipes.md', path.join(files, 'shipped_recipes.md'));
    workspace.folders = [{ uri: { fsPath: root } }];
    workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
    const page = (await pageAfter({ type: 'refresh' }, GAMMA)) as { path: string; recipes: { state: string; recipes: unknown[] } };
    assert.strictEqual(page.path, GAMMA, "the window is posted its own mission's page");
    const recipes = page.recipes;
    assert.strictEqual(recipes.state, 'read');
    assert.deepStrictEqual(recipes.recipes, [
      {
        kind: 'runnable',
        name: 'First run',
        group: 'shipped',
        lines: [
          'claude -p "/gurita:review-mission-requirements --mission <path>" --model "fable" --effort xhigh;',
          'claude -p "/gurita:provide-alternatives-to-all-open-questions --mission <path>" --model "opus" --effort high;',
          'claude -p "/gurita:recommend-all-open-questions --mission <path>" --model "fable" --effort xhigh;',
        ],
        variants: [
          { name: 'Claude Code', own: false },
          { name: 'Antigravity', own: false },
          { name: 'default', own: true },
        ],
        selected: 0,
      },
      {
        kind: 'looped',
        name: 'Execute tasks one at a time',
        group: 'shipped',
        lines: ['<single-task line>'],
        variants: [{ name: 'default', own: false }],
        selected: 0,
      },
      {
        kind: 'runnable',
        name: 'Mixed review',
        group: 'shipped',
        lines: ['agy -p "/gurita:review-mission-requirements --mission <path>" --model "gemini-4-argon" --effort medium;'],
        variants: [{ name: 'default', own: false }],
        selected: 0,
      },
      {
        kind: 'runnable',
        name: 'Mine everywhere',
        group: 'own',
        lines: ['echo <path>'],
        variants: [{ name: 'default', own: true }],
        selected: 0,
      },
    ]);
    const count = created.length;
    send({ type: 'runRecipe', mission: GAMMA, recipe: 'First run', variant: 'Claude Code' });
    assert.deepStrictEqual(created.slice(count).map((terminal) => terminal.name), [`Gurita: First run (${GAMMA})`], 'a click runs the listed variant');
  } finally {
    process.env.HOME = home;
  }
});

const DELTA = 'tools/mission_delta/';
const EPSILON = 'mission_epsilon/';

/** A fresh git project holding the live missions `missions`, each definition committed. */
function project(...missions: string[]): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-')));
  git(root, 'init', '-q');
  for (const mission of missions) {
    fs.mkdirSync(path.join(root, mission), { recursive: true });
    fs.writeFileSync(path.join(root, mission, 'requirements.md'), '# A mission\n\n## Goal\n\nA goal.\n');
    fs.writeFileSync(path.join(root, mission, 'open_questions.xml'), '<open-questions/>\n');
    fs.writeFileSync(path.join(root, mission, 'TASKS_TODO.md'), '# TASKS TODO\n');
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', `Mission-definition: ${mission}`);
  }
  return root;
}

interface PostedEntry {
  name: string;
  lines: string[];
  variants: { name: string; own: boolean }[];
  selected: number;
}

/** Sends `message` and returns the entry of the recipe `recipe` on the page the window of `mission` is next posted. */
async function entryAfter(message: unknown, mission: string, recipe: string): Promise<PostedEntry> {
  const page = (await pageAfter(message, mission)) as { recipes: { recipes: PostedEntry[] } };
  const found = page.recipes.recipes.find((each) => each.name === recipe);
  assert.ok(found !== undefined, `no ${recipe} on ${mission}'s page`);
  return found;
}

/** The variant an entry's dropdown stands on. */
function selectedName(entry: PostedEntry): string {
  return entry.variants[entry.selected].name;
}

test('a selected variant is remembered per recipe on one mission in workspaceState, wins over the default, and is dropped once gone', async () => {
  const home = process.env.HOME;
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-home-'));
  process.env.HOME = fakeHome;
  try {
    const root = project(DELTA, EPSILON);
    const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-recipes-'));
    fs.writeFileSync(path.join(files, 'shipped_recipes.md'), SHIPPED_TEXT);
    fs.writeFileSync(path.join(files, 'recipes.md'), OWN_TEXT);
    fs.mkdirSync(path.join(fakeHome, '.gurita'));
    // The settings view's pick of a default: Antigravity, the second shipped variant.
    fs.writeFileSync(
      path.join(fakeHome, '.gurita', 'variants.json'),
      JSON.stringify({ defaults: [{ recipe: 'First run', name: 'Antigravity', origin: 'shipped' }] }),
    );
    packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
    packaged.set('bundled/shipped_recipes.md', path.join(files, 'shipped_recipes.md'));
    workspace.folders = [{ uri: { fsPath: root } }];
    workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
    workspaceState.clear();

    let entry = await entryAfter({ type: 'refresh' }, DELTA, 'First run');
    assert.strictEqual(selectedName(entry), 'Antigravity', 'with nothing remembered the dropdown stands on the default');
    assert.deepStrictEqual(entry.variants, [
      { name: 'Claude Code', own: false },
      { name: 'Antigravity', own: false },
      { name: 'default', own: true },
    ]);

    entry = await entryAfter({ type: 'selectVariant', mission: DELTA, recipe: 'First run', variant: 'default' }, DELTA, 'First run');
    assert.deepStrictEqual(workspaceState.get('gurita.variantSelections'), { [DELTA]: { 'First run': 'default' } });
    assert.strictEqual(selectedName(entry), 'default', 'a remembered selection wins over the default');
    assert.deepStrictEqual(entry.lines, ['claude -p "/gurita:review-mission-requirements --mission <path>" --model "sonnet";']);

    entry = await entryAfter({ type: 'refresh' }, DELTA, 'First run');
    assert.strictEqual(selectedName(entry), 'default', 'the selection is remembered through a re-read');
    entry = await entryAfter({ type: 'refresh' }, EPSILON, 'First run');
    assert.strictEqual(selectedName(entry), 'Antigravity', "another mission's page keeps its own selection, here the default");

    const count = created.length;
    send({ type: 'runRecipe', mission: DELTA, recipe: 'First run', variant: 'Antigravity' });
    send({ type: 'runRecipe', mission: DELTA, recipe: 'First run', variant: 'No such variant' });
    send({ type: 'selectVariant', mission: DELTA, recipe: 'First run', variant: 'No such variant' });
    sendFrom(DELTA, { type: 'selectVariant', mission: 'other/mission_zeta/', recipe: 'First run', variant: 'Claude Code' });
    sendFrom(EPSILON, { type: 'runRecipe', mission: DELTA, recipe: 'First run', variant: 'default' });
    sendFrom(EPSILON, { type: 'selectVariant', mission: DELTA, recipe: 'First run', variant: 'Claude Code' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.strictEqual(created.length, count, "a variant the last posted list does not show selected starts nothing, nor a click naming another window's mission");
    assert.deepStrictEqual(workspaceState.get('gurita.variantSelections'), { [DELTA]: { 'First run': 'default' } }, 'nor is remembered');
    send({ type: 'runRecipe', mission: DELTA, recipe: 'First run', variant: 'default' });
    assert.deepStrictEqual(created.slice(count).map((terminal) => terminal.name), [`Gurita: First run (${DELTA})`], 'the selected variant runs');

    // A default picked afresh leaves the remembered selection standing.
    fs.writeFileSync(
      path.join(fakeHome, '.gurita', 'variants.json'),
      JSON.stringify({ defaults: [{ recipe: 'First run', name: 'Claude Code', origin: 'shipped' }] }),
    );
    entry = await entryAfter({ type: 'refresh' }, DELTA, 'First run');
    assert.strictEqual(selectedName(entry), 'default');

    // The remembered variant goes from the own file: it is dropped and the button falls back to the current default.
    fs.writeFileSync(path.join(files, 'recipes.md'), '### Mine everywhere\n```\necho <path>\n```\n');
    entry = await entryAfter({ type: 'refresh' }, DELTA, 'First run');
    assert.strictEqual(selectedName(entry), 'Claude Code');
    assert.deepStrictEqual(workspaceState.get('gurita.variantSelections'), {}, 'the remembered variant is dropped');

    assert.strictEqual(execFileSync('git', ['status', '--porcelain', '--ignored'], { cwd: root, encoding: 'utf8' }), '', "nothing is written into the project's tree");
  } finally {
    process.env.HOME = home;
  }
});

/** Two missions of the windows test, the second of which stops being live and comes back. */
const ZETA = 'pkg/mission_zeta/';
const ZETA_TWO = 'mission_zeta_two/';

test("each open mission window is posted its own mission's page from the session's one read, the failure state while the read fails, and the notice while its mission is not live, its page again once it is", async () => {
  const home = process.env.HOME;
  process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-home-'));
  try {
    const root = project(ZETA, ZETA_TWO);
    const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-recipes-'));
    fs.writeFileSync(path.join(files, 'shipped_recipes.md'), SHIPPED_TEXT);
    packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
    packaged.set('bundled/shipped_recipes.md', path.join(files, 'shipped_recipes.md'));
    workspace.folders = [{ uri: { fsPath: root } }];
    workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
    workspaceState.clear();
    /** Refreshes and returns the next message of each window, by mission. */
    const refreshed = async (types: Record<string, string>): Promise<Record<string, Record<string, unknown>>> => {
      const from = Object.fromEntries(Object.keys(types).map((mission) => [mission, openWindow(mission).posts.length]));
      send({ type: 'refresh' });
      const answers: Record<string, Record<string, unknown>> = {};
      for (const [mission, type] of Object.entries(types)) {
        answers[mission] = await windowPosted(mission, type, from[mission]);
      }
      return answers;
    };

    const count = panels.length;
    const [zeta, two] = [openWindow(ZETA), openWindow(ZETA_TWO)];
    assert.strictEqual(panels.length, count + 2, 'each mission gets a window of its own');
    assert.deepStrictEqual([zeta.viewType, two.viewType], [pane.MISSION_VIEW_TYPE, pane.MISSION_VIEW_TYPE]);
    assert.match(zeta.html, /page\.js/, "each window loads the mission page's script");
    assert.match(zeta.html, /<script [^>]*text\.js[^>]*><\/script>\n<script [^>]*page\.js/, 'the text renderer loaded directly ahead of it');
    let answers = await refreshed({ [ZETA]: 'page', [ZETA_TWO]: 'page' });
    assert.strictEqual((answers[ZETA].mission as { path: string }).path, ZETA, 'each window is posted its own mission alone');
    assert.strictEqual((answers[ZETA_TWO].mission as { path: string }).path, ZETA_TWO);
    assert.ok(!('missions' in answers[ZETA]), 'and no other mission beside it');
    const reveals = zeta.reveals;
    assert.strictEqual(openWindow(ZETA), zeta, 'a second opening reveals the open window');
    assert.strictEqual(zeta.reveals, reveals + 1);
    assert.strictEqual(panels.length, count + 2, 'and creates none');
    assert.deepStrictEqual(pane.openMissionWindows().filter((mission) => [ZETA, ZETA_TWO].includes(mission)), [ZETA, ZETA_TWO]);

    // A window opened afresh draws from the session's read, reading nothing of its own.
    closeWindow(ZETA_TWO);
    fs.writeFileSync(path.join(root, ZETA_TWO, 'TASKS_TODO.md'), '# TASKS TODO\n\n## Unread task\n\nA brief.\n\n---\n');
    const reopened = openWindow(ZETA_TWO);
    assert.notStrictEqual(reopened, two, 'a closed window is opened afresh');
    assert.deepStrictEqual(
      ((reopened.posts.find((message) => message.type === 'page')?.mission as { tasks: { remaining: { title: string }[] } }).tasks.remaining.map((each) => each.title)),
      [],
      "its ready message is answered from the session's read",
    );

    // While the live read fails, every window is posted the failure state, and no click starts anything.
    workspace.folders = undefined;
    answers = await refreshed({ [ZETA]: 'liveFailure', [ZETA_TWO]: 'liveFailure' });
    assert.deepStrictEqual(answers[ZETA], { type: 'liveFailure', cause: 'No folder is open in this window.' });
    assert.deepStrictEqual(answers[ZETA_TWO], { type: 'liveFailure', cause: 'No folder is open in this window.' });
    let started = created.length;
    send({ type: 'runRecipe', mission: ZETA, recipe: 'First run', variant: 'Claude Code' });
    assert.strictEqual(created.length, started, 'a click against a failed read starts nothing');
    let from = zeta.posts.length;
    send({ type: 'ready', mission: ZETA });
    assert.deepStrictEqual(zeta.posts.slice(from), [{ type: 'liveFailure', cause: 'No folder is open in this window.' }], 'a ready message is answered with the failure state too');
    workspace.folders = [{ uri: { fsPath: root } }];
    answers = await refreshed({ [ZETA]: 'page', [ZETA_TWO]: 'page' });
    assert.strictEqual((answers[ZETA].mission as { path: string }).path, ZETA, 'each window draws its page again on the next read that succeeds');

    // A mission no longer live: its window stays open with the notice, the other window keeps its page.
    fs.rmSync(path.join(root, ZETA_TWO), { recursive: true });
    answers = await refreshed({ [ZETA]: 'page', [ZETA_TWO]: 'notLive' });
    assert.deepStrictEqual(answers[ZETA_TWO], { type: 'notLive', path: ZETA_TWO });
    assert.ok(pane.openMissionWindows().includes(ZETA_TWO), 'the window stays open');
    started = created.length;
    send({ type: 'runRecipe', mission: ZETA_TWO, recipe: 'First run', variant: 'Claude Code' });
    assert.strictEqual(created.length, started, 'a click reaching the notice starts nothing');
    from = reopened.posts.length;
    send({ type: 'ready', mission: ZETA_TWO });
    assert.deepStrictEqual(reopened.posts.slice(from), [{ type: 'notLive', path: ZETA_TWO }]);
    execFileSync('git', ['checkout', '--', ZETA_TWO], { cwd: root, stdio: 'ignore' });
    answers = await refreshed({ [ZETA_TWO]: 'page' });
    assert.strictEqual((answers[ZETA_TWO].mission as { path: string }).path, ZETA_TWO, 'listed again, the window draws its page again');
    send({ type: 'runRecipe', mission: ZETA_TWO, recipe: 'First run', variant: 'Claude Code' });
    assert.deepStrictEqual(created.slice(started).map((terminal) => terminal.name), [`Gurita: First run (${ZETA_TWO})`], 'and its clicks run again');

    // A click a window posts naming another mission starts nothing.
    started = created.length;
    sendFrom(ZETA, { type: 'runRecipe', mission: ZETA_TWO, recipe: 'Mixed review', variant: 'default' });
    assert.strictEqual(created.length, started);
    send({ type: 'runRecipe', mission: ZETA, recipe: 'Mixed review', variant: 'default' });
    assert.deepStrictEqual(created.slice(started).map((terminal) => terminal.name), [`Gurita: Mixed review (${ZETA})`]);

    // A run's start and end post the running missions to every open window.
    from = zeta.posts.length;
    const twoFrom = reopened.posts.length;
    pane.postRunning();
    assert.deepStrictEqual(zeta.posts.slice(from).map((message) => message.type), ['running']);
    assert.deepStrictEqual(reopened.posts.slice(twoFrom).map((message) => message.type), ['running']);
  } finally {
    process.env.HOME = home;
  }
});

/** Three missions of the tab-title test: two in different scopes that come to share a title, and one whose title no other carries. */
const CHI = 'lib/mission_chi/';
const CHI_ROOT = 'mission_chi/';
const PSI = 'app/mission_psi/';

test("a mission window's tab is titled with its mission's title alone, every colliding tab gaining its scope while another live mission shares the title, re-titled on every live re-read, and carries one fixed codicon", async () => {
  const home = process.env.HOME;
  process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-home-'));
  try {
    const root = project(CHI, CHI_ROOT, PSI);
    /** Gives the mission at `mission` the title `title` in its `requirements.md`. */
    const retitle = (mission: string, title: string): void => {
      fs.writeFileSync(path.join(root, mission, 'requirements.md'), `# ${title}\n\n## Goal\n\nA goal.\n`);
    };
    retitle(CHI, 'Shared title');
    retitle(CHI_ROOT, 'Another title');
    retitle(PSI, 'Lone title');
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', 'Titles');
    const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-recipes-'));
    fs.writeFileSync(path.join(files, 'shipped_recipes.md'), SHIPPED_TEXT);
    packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
    packaged.set('bundled/shipped_recipes.md', path.join(files, 'shipped_recipes.md'));
    workspace.folders = [{ uri: { fsPath: root } }];
    workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
    workspaceState.clear();
    /** Refreshes and waits until every window among `missions` is posted its answer. */
    const refreshed = async (...missions: string[]): Promise<void> => {
      const from = missions.map((mission) => openWindow(mission).posts.length);
      send({ type: 'refresh' });
      for (const [index, mission] of missions.entries()) {
        await windowPosted(mission, fs.existsSync(path.join(root, mission)) ? 'page' : 'notLive', from[index]);
      }
    };
    const titles = (): string[] => [CHI, CHI_ROOT, PSI].map((mission) => (windowOf.get(mission) as StubPanel).title);

    // A lone title: each tab carries its mission's title alone, and every one the fixed codicon.
    const psi = openWindow(PSI);
    await refreshed(PSI);
    assert.strictEqual(psi.title, 'Lone title');
    const [chi, chiRoot] = [openWindow(CHI), openWindow(CHI_ROOT)];
    assert.deepStrictEqual(titles(), ['Shared title', 'Another title', 'Lone title'], "a window opened afresh is titled from the session's read");
    for (const each of [chi, chiRoot, psi]) {
      assert.ok(each.iconPath instanceof StubThemeIcon, 'every mission tab carries a built-in codicon through a ThemeIcon');
      assert.strictEqual((each.iconPath as StubThemeIcon).id, pane.MISSION_WINDOW_ICON);
    }
    assert.strictEqual(pane.MISSION_WINDOW_ICON, 'rocket');

    // Two live missions sharing one title: both colliding tabs gain their scope, the lone one does not.
    retitle(CHI_ROOT, 'Shared title');
    await refreshed(CHI, CHI_ROOT, PSI);
    assert.deepStrictEqual(titles(), ['Shared title — lib', 'Shared title — .', 'Lone title'], 'a re-read re-titles the colliding tabs');
    assert.strictEqual(pane.TAB_SCOPE_SEPARATOR, ' — ');

    // A re-read that ends the collision: the title alone again.
    retitle(CHI_ROOT, 'Another title');
    await refreshed(CHI, CHI_ROOT, PSI);
    assert.deepStrictEqual(titles(), ['Shared title', 'Another title', 'Lone title'], 'the re-read ending the collision drops the scope');

    // The collision ended by a mission no longer live: the other tab drops its scope.
    retitle(CHI_ROOT, 'Shared title');
    await refreshed(CHI, CHI_ROOT, PSI);
    assert.deepStrictEqual(titles(), ['Shared title — lib', 'Shared title — .', 'Lone title']);
    fs.rmSync(path.join(root, CHI_ROOT), { recursive: true });
    await refreshed(CHI, CHI_ROOT, PSI);
    assert.strictEqual(chi.title, 'Shared title', 'a mission that stops being live ends the collision');

    // A failed read re-titles nothing.
    workspace.folders = undefined;
    const from = chi.posts.length;
    send({ type: 'refresh' });
    await windowPosted(CHI, 'liveFailure', from);
    assert.strictEqual(chi.title, 'Shared title');
    workspace.folders = [{ uri: { fsPath: root } }];
  } finally {
    process.env.HOME = home;
  }
});

/** Two missions of the run-terminal test, the first of which has a run going. */
const UPSILON = 'pkg/mission_upsilon/';
const PHI = 'mission_phi/';

test("a mission's window becoming the active editor while its run is going brings that run's terminal forward without taking the focus, by every route", async () => {
  const home = process.env.HOME;
  process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-home-'));
  try {
    const root = project(UPSILON, PHI);
    const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-recipes-'));
    fs.writeFileSync(path.join(files, 'shipped_recipes.md'), SHIPPED_TEXT);
    packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
    packaged.set('bundled/shipped_recipes.md', path.join(files, 'shipped_recipes.md'));
    workspace.folders = [{ uri: { fsPath: root } }];
    workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
    workspaceState.clear();

    await pageAfter({ type: 'refresh' }, PHI);
    await pageAfter({ type: 'refresh' }, UPSILON);
    const [upsilon, phi] = [openWindow(UPSILON), openWindow(PHI)];
    assert.ok(phi.active && !upsilon.active, 'the window opened or revealed last is the active editor');

    // A window becoming active while no run of its mission is going brings nothing forward.
    const others = created.map((terminal) => terminal.shows.length);
    activate(upsilon);
    activate(phi);
    assert.deepStrictEqual(created.map((terminal) => terminal.shows.length), others, 'no terminal is shown for a mission with no run going');

    // The run starts from the mission's window, its terminal shown as every run's start shows it.
    const count = created.length;
    send({ type: 'runRecipe', mission: UPSILON, recipe: 'First run', variant: 'Claude Code' });
    assert.deepStrictEqual(created.slice(count).map((terminal) => terminal.name), [`Gurita: First run (${UPSILON})`]);
    const run = created[created.length - 1];
    assert.deepStrictEqual(run.shows, [undefined], "the run's start shows its terminal");

    // A click on its editor tab, or keyboard navigation between editors, makes the window active.
    activate(phi);
    assert.deepStrictEqual(run.shows, [undefined], "another mission's window becoming active shows nothing of this run");
    activate(upsilon);
    assert.deepStrictEqual(run.shows, [undefined, true], 'the window becoming active brings the terminal forward, keeping the focus');
    activate(phi);
    activate(upsilon);
    assert.deepStrictEqual(run.shows, [undefined, true, true], 'and again each time it becomes active');

    // A click on its row reveals the window, which becomes active.
    activate(phi);
    openWindow(UPSILON);
    assert.deepStrictEqual(run.shows, [undefined, true, true, true], 'a row click revealing the window brings the terminal forward');
    openWindow(UPSILON);
    assert.deepStrictEqual(run.shows, [undefined, true, true, true], 'a reveal of the window already active changes nothing');

    // A row click opening the window afresh makes it the active editor at once.
    closeWindow(UPSILON);
    const reopened = openWindow(UPSILON);
    assert.notStrictEqual(reopened, upsilon);
    assert.ok(reopened.active);
    assert.deepStrictEqual(run.shows, [undefined, true, true, true, true], 'a window opened afresh brings the terminal forward');

    // The page posts no message of its own for the terminal: a stray one does nothing.
    sendFrom(UPSILON, { type: 'missionTab', mission: UPSILON });
    sendFrom(UPSILON, { type: 'showTerminal', mission: UPSILON });
    assert.deepStrictEqual(run.shows, [undefined, true, true, true, true]);

    // A click for the mission whose run is going is refused with the notification and the terminal shown.
    await windowPosted(UPSILON, 'page', 0);
    notifications.length = 0;
    send({ type: 'runRecipe', mission: UPSILON, recipe: 'First run', variant: 'Claude Code' });
    assert.strictEqual(created.length, count + 1, 'the refused click starts nothing');
    assert.deepStrictEqual(notifications, [runs.ALREADY_RUNNING]);
    assert.deepStrictEqual(run.shows, [undefined, true, true, true, true, undefined], 'the refusal shows the terminal as before');
  } finally {
    process.env.HOME = home;
  }
});

/**
 * A stand-in for the packaged check script: it prints the JSON held in `print`, and appends each
 * run's arguments and working directory to `log` as one JSON line.
 */
function stubCheckScript(dir: string): { script: string; print: string; log: string } {
  const script = path.join(dir, 'harness_check.py');
  const print = path.join(dir, 'print.json');
  const log = path.join(dir, 'runs.log');
  fs.writeFileSync(
    script,
    [
      'import json, os, sys',
      `with open(${JSON.stringify(log)}, "a") as handle:`,
      '    handle.write(json.dumps({"argv": sys.argv[1:], "cwd": os.getcwd()}) + "\\n")',
      `with open(${JSON.stringify(print)}) as handle:`,
      '    sys.stdout.write(handle.read())',
      '',
    ].join('\n'),
  );
  return { script, print, log };
}

/** The runs the stub check script logged, each its arguments and working directory. */
function checkRuns(log: string): { argv: string[]; cwd: string }[] {
  if (!fs.existsSync(log)) {
    return [];
  }
  return fs
    .readFileSync(log, 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line) as { argv: string[]; cwd: string });
}

/** Waits until the extension has posted a harness check of `state` beyond the first `from`, and returns it. */
async function checkPosted(state: string, from: number): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 400; attempt++) {
    const found = posted
      .slice(from)
      .find((message) => (message as { type?: string }).type === 'harnessCheck' && (message as { check: { state: string } }).check.state === state);
    if (found !== undefined) {
      return (found as { check: Record<string, unknown> }).check;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail(`no ${state} harness check was posted`);
}

const CHECK_PRINT = {
  claude: { found: true, installed: true, version: '2.0.0' },
  antigravity: { found: true, installed: true, version: '1.9.0' },
  codex: { found: false, installed: false, version: null },
};

/** A mission no earlier test holds a run for. */
const ETA = 'pkg/mission_eta/';

test("the Settings window's first opening runs the check once for the session, every later opening, a close and a reopening, and every re-read posting the result kept without running it", async () => {
  const root = project(ETA);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-check-'));
  const stubbed = stubCheckScript(dir);
  fs.writeFileSync(stubbed.print, JSON.stringify(CHECK_PRINT) + '\n');
  fs.writeFileSync(path.join(dir, 'plugin_version.txt'), '2.0.0\n');
  const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-recipes-'));
  fs.writeFileSync(path.join(files, 'shipped_recipes.md'), SHIPPED_TEXT);
  fs.writeFileSync(path.join(files, 'recipes.md'), OWN_TEXT);
  packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
  packaged.set('bundled/shipped_recipes.md', path.join(files, 'shipped_recipes.md'));
  packaged.set('harness_check.py', stubbed.script);
  packaged.set('bundled/plugin_version.txt', path.join(dir, 'plugin_version.txt'));
  workspace.folders = [{ uri: { fsPath: root } }];
  workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
  workspaceState.clear();

  const before = (await entryAfter({ type: 'refresh' }, ETA, 'First run')) as unknown;
  assert.deepStrictEqual(checkRuns(stubbed.log), [], "no answer to a mission window's page runs the check");

  let from = posted.length;
  showSettings();
  await checkPosted('running', from);
  const checked = await checkPosted('checked', from);
  assert.deepStrictEqual(checkRuns(stubbed.log), [{ argv: ['--project', root], cwd: root }], 'run once, from the project root');
  const desktop = (checked.harnesses as Record<string, unknown>[])[3];
  assert.deepStrictEqual(checked, {
    state: 'checked',
    harnesses: [
      { key: 'claude', name: 'Claude Code', cli: 'claude', packaged: '2.0.0', installed: '2.0.0' },
      { key: 'antigravity', name: 'Antigravity', cli: 'agy', packaged: '2.0.0', installed: '1.9.0', failed: 'version' },
      { key: 'codex', name: 'Codex', cli: 'codex', packaged: '2.0.0', failed: 'cli' },
      desktop,
    ],
  });
  assert.deepStrictEqual(
    [desktop.key, desktop.name, (desktop.application as { bundle: string }).bundle],
    ['claude-desktop', 'Claude Desktop', '/Applications/Claude.app'],
    "Claude Desktop's presence, read from its bundle on this machine, follows the script's three",
  );

  from = posted.length;
  showSettings();
  assert.deepStrictEqual(await checkPosted('checked', from), checked, 'the window shown again posts the result kept');

  // The window is closed and opened again: a fresh window, the result kept in the session posted to it.
  const first = panelOf(settingsWindow.SETTINGS_VIEW_TYPE);
  close(settingsWindow.SETTINGS_VIEW_TYPE);
  from = posted.length;
  showSettings();
  assert.notStrictEqual(panelOf(settingsWindow.SETTINGS_VIEW_TYPE), first, 'the reopening creates a window afresh');
  assert.deepStrictEqual(await checkPosted('checked', from), checked, 'the reopened window is posted the result kept');
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.strictEqual(checkRuns(stubbed.log).length, 1, 'a close and a reopening run no check');
  assert.ok(
    !posted.slice(from).some((message) => (message as { type?: string; check?: { state: string } }).type === 'harnessCheck' && (message as { check: { state: string } }).check.state === 'running'),
    'the reopened window never shows the check running',
  );

  const after = (await entryAfter({ type: 'refresh' }, ETA, 'First run')) as unknown;
  await entryAfter({ type: 'ready', mission: ETA }, ETA, 'First run');
  assert.strictEqual(checkRuns(stubbed.log).length, 1, 'no later opening, re-read, or Refresh runs the check');
  assert.deepStrictEqual(after, before, "a failed check leaves the mission page's recipes as posted");
  const count = created.length;
  send({ type: 'runRecipe', mission: ETA, recipe: 'First run', variant: 'Claude Code' });
  assert.deepStrictEqual(created.slice(count).map((terminal) => terminal.name), [`Gurita: First run (${ETA})`], 'a click runs the lines as written');

  fs.writeFileSync(stubbed.print, JSON.stringify({ ...CHECK_PRINT, antigravity: { found: true, installed: false, version: null } }) + '\n');
  from = posted.length;
  send({ type: 'checkHarnesses' });
  const again = (await checkPosted('checked', from)) as { harnesses: { key: string; failed?: string }[] };
  assert.strictEqual(checkRuns(stubbed.log).length, 2, 'check again runs it afresh');
  assert.deepStrictEqual(
    again.harnesses.slice(0, 3).map((each) => [each.key, each.failed]),
    [
      ['claude', undefined],
      ['antigravity', 'plugin'],
      ['codex', 'cli'],
    ],
  );
  assert.deepStrictEqual(again.harnesses[3], desktop, "Claude Desktop's presence is read again with the check");
  from = posted.length;
  showSettings();
  assert.deepStrictEqual(await checkPosted('checked', from), again, 'the fresh result is the one kept');

  fs.writeFileSync(stubbed.print, 'not json\n');
  from = posted.length;
  send({ type: 'checkHarnesses' });
  const failed = await checkPosted('failed', from);
  assert.match(String(failed.cause), /the harness check printed no JSON/);

  // Neither a mission window created afresh nor a Settings window created afresh runs the check again: only check again does.
  fs.writeFileSync(stubbed.print, JSON.stringify(CHECK_PRINT) + '\n');
  closeWindow(ETA);
  await entryAfter({ type: 'ready', mission: ETA }, ETA, 'First run');
  close(settingsWindow.SETTINGS_VIEW_TYPE);
  from = posted.length;
  showSettings();
  assert.deepStrictEqual(await checkPosted('failed', from), failed, 'the last result kept is posted, failed as it was');
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.strictEqual(checkRuns(stubbed.log).length, 3, 'no reopening of either window runs the check');
  from = posted.length;
  send({ type: 'checkHarnesses' });
  assert.deepStrictEqual(await checkPosted('checked', from), checked);
  assert.strictEqual(checkRuns(stubbed.log).length, 4);
});

/** The shipped file of the harness test: a recipe on both harnesses, one on Antigravity alone, the loop, a button recipe, and two single-task lines. */
const HARNESS_SHIPPED_TEXT = `${SHIPPED_TEXT}
### discuss-mission-goal
\`\`\`
agy "/gurita:discuss-mission-goal <goal>" --model "gemini-4-argon";
\`\`\`

### Single task (Claude Code)
\`\`\`
claude -p "/gurita:complete-task --mission <path> <Task Title>" --model "opus" --effort high;
\`\`\`

### Single task (Antigravity)
\`\`\`
agy -p "/gurita:complete-task --mission <path> <Task Title>" --model "claude-opus-5-5" --effort high;
\`\`\`
`;

/** A mission no earlier test holds a run for. */
const THETA = 'mission_theta/';

test("disabling a harness is stored in the variant store's harness part and leaves its variants out of the posted list alone", async () => {
  const home = process.env.HOME;
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-home-'));
  process.env.HOME = fakeHome;
  try {
    const root = project(THETA);
    const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-recipes-'));
    fs.writeFileSync(path.join(files, 'shipped_recipes.md'), HARNESS_SHIPPED_TEXT);
    packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
    packaged.set('bundled/shipped_recipes.md', path.join(files, 'shipped_recipes.md'));
    packaged.set('runner.py', path.join(__dirname, '..', '..', 'runner.py'));
    workspace.folders = [{ uri: { fsPath: root } }];
    workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
    workspaceState.clear();
    const store = path.join(fakeHome, '.gurita', 'variants.json');
    const page = async (message: unknown) => ((await pageAfter(message, THETA)) as { recipes: { recipes: PostedEntry[] } }).recipes.recipes;
    const shown = (entries: PostedEntry[]) => entries.map((entry) => [entry.name, entry.variants.map((each) => each.name), selectedName(entry)]);

    let from = posted.length;
    const initial = await page({ type: 'refresh' });
    assert.deepStrictEqual(shown(initial), [
      ['First run', ['Claude Code', 'Antigravity'], 'Claude Code'],
      ['Execute tasks one at a time', ['default'], 'default'],
      ['Mixed review', ['default'], 'default'],
    ]);
    await page({ type: 'selectVariant', mission: THETA, recipe: 'First run', variant: 'Antigravity' });

    from = posted.length;
    showSettings();
    assert.deepStrictEqual(await postedOf('harnessSettings', from), {
      type: 'harnessSettings',
      settings: { state: 'read', enabled: { claude: true, antigravity: true, codex: true, 'claude-desktop': true } },
    }, 'every harness starts enabled, whatever its check reports');
    assert.ok(!fs.existsSync(store), 'nothing is written until a harness is disabled');

    from = posted.length;
    let windowFrom = openWindow(THETA).posts.length;
    send({ type: 'setHarnessEnabled', harness: 'antigravity', enabled: false });
    assert.deepStrictEqual(await postedOf('harnessSettings', from), {
      type: 'harnessSettings',
      settings: { state: 'read', enabled: { claude: true, antigravity: false, codex: true, 'claude-desktop': true } },
    });
    const live = (await windowPosted(THETA, 'page', windowFrom)).mission as { recipes: { recipes: PostedEntry[] } };
    const narrowed = live.recipes.recipes;
    assert.deepStrictEqual(
      pane.startingOffers(context).discussGoal,
      { state: 'disabled', recipe: 'discuss-mission-goal', cause: 'Every variant of discuss-mission-goal this button can run has a line on a disabled harness.' },
      'the mission-starting control whose only variant runs on Antigravity offers no variant',
    );
    assert.deepStrictEqual(shown(narrowed), [
      ['First run', ['Claude Code'], 'Claude Code'],
      ['Execute tasks one at a time', ['default'], 'default'],
    ], 'the Antigravity variant leaves the dropdown, the recipe left with none its button, the remembered one giving way to the first listed');
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(store, 'utf8')).harnesses, { antigravity: { enabled: false } });
    assert.deepStrictEqual(workspaceState.get('gurita.variantSelections'), { [THETA]: { 'First run': 'Antigravity' } }, 'the remembered selection is kept');

    let count = created.length;
    send({ type: 'runRecipe', mission: THETA, recipe: 'First run', variant: 'Antigravity' });
    send({ type: 'runRecipe', mission: THETA, recipe: 'Mixed review', variant: 'default' });
    await page({ type: 'refresh' });
    assert.strictEqual(created.length, count, 'a click on a left-out variant or recipe is refused');
    assert.deepStrictEqual(shown(await page({ type: 'refresh' })), shown(narrowed), 'a re-read keeps the harness disabled');

    // The mission-starting row left with no variant starts nothing.
    const boxes = inputBoxes.length;
    await pane.runStartingRow(context, 'discussGoal');
    assert.strictEqual(created.length, count, 'a click on a mission-starting row left with no variant starts nothing');
    assert.strictEqual(inputBoxes.length, boxes, 'nor asks for its values');

    // The looped run's preview and run keep every named single-task line.
    windowFrom = openWindow(THETA).posts.length;
    send({ type: 'previewLoop', mission: THETA, recipe: 'Execute tasks one at a time', variant: 'default' });
    const preview = await windowPosted(THETA, 'preview', windowFrom);
    assert.deepStrictEqual(preview.names, ['Single task (Claude Code)', 'Single task (Antigravity)']);
    assert.deepStrictEqual((preview.result as { state: string }).state, 'read');
    count = created.length;
    send({ type: 'startLoop', mission: THETA, recipe: 'Execute tasks one at a time', overrides: {} });
    assert.strictEqual(created.length, count + 1);
    const args = created[created.length - 1].args;
    assert.deepStrictEqual(
      args.flatMap((arg, index) => (arg === '--line' ? [args[index + 1]] : [])),
      ['Single task (Claude Code)', 'Single task (Antigravity)'],
      'every named single-task line is passed as one --line',
    );

    windowFrom = openWindow(THETA).posts.length;
    send({ type: 'setHarnessEnabled', harness: 'antigravity', enabled: true });
    const again = (await windowPosted(THETA, 'page', windowFrom)).mission as { recipes: { recipes: PostedEntry[] } };
    assert.deepStrictEqual(
      shown(again.recipes.recipes)[0],
      ['First run', ['Claude Code', 'Antigravity'], 'Antigravity'],
      'enabled again, the remembered selection comes back',
    );
    assert.strictEqual(pane.startingOffers(context).discussGoal.state, 'offered', 'enabled again, the mission-starting control offers its variant');
    count = created.length;
    typedValues.push('A goal');
    void pane.runStartingRow(context, 'discussGoal');
    for (let attempt = 0; attempt < 200 && created.length === count; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.deepStrictEqual(created.slice(count).map((terminal) => terminal.name), ['Gurita: discuss-mission-goal']);
    assert.match(created[created.length - 1].args.join(' '), /^\S+ chain --close-when-finished -- agy /);

    from = posted.length;
    send({ type: 'setHarnessEnabled', harness: 'agy', enabled: false });
    send({ type: 'setHarnessEnabled', harness: 'codex', enabled: 'no' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.deepStrictEqual(posted.slice(from), [], 'a key naming no harness or a state not true or false writes nothing');
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(store, 'utf8')).harnesses, { antigravity: { enabled: true } });
    assert.strictEqual(execFileSync('git', ['status', '--porcelain', '--ignored'], { cwd: root, encoding: 'utf8' }), '', "nothing is written into the project's tree");
  } finally {
    process.env.HOME = home;
  }
});

/** Waits until the extension has posted the harness lists beyond the first `from`, and returns them as read. */
async function postedLists(from: number): Promise<Record<string, { models: string[]; efforts: string[] }>> {
  const message = (await postedOf('harnessLists', from)) as { lists: { state: string; lists?: Record<string, { models: string[]; efforts: string[] }> } };
  assert.strictEqual(message.lists.state, 'read', JSON.stringify(message.lists));
  return message.lists.lists as Record<string, { models: string[]; efforts: string[] }>;
}

test("the settings view's model and effort lists are derived from the recipe lines, and an added or removed entry is stored as an overlay in the harness part", async () => {
  const home = process.env.HOME;
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-home-'));
  process.env.HOME = fakeHome;
  try {
    const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-recipes-'));
    fs.writeFileSync(path.join(files, 'shipped_recipes.md'), HARNESS_SHIPPED_TEXT);
    fs.writeFileSync(path.join(files, 'recipes.md'), `${OWN_TEXT}
### Codex finish
\`\`\`
codex exec "/gurita:finish-mission --mission <path>" -m gpt-5.5 -c model_reasoning_effort=high;
\`\`\`
`);
    packaged.set('bundled/shipped_recipes.md', path.join(files, 'shipped_recipes.md'));
    workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
    const store = path.join(fakeHome, '.gurita', 'variants.json');
    fs.mkdirSync(path.dirname(store));
    fs.writeFileSync(
      store,
      JSON.stringify({
        variants: [{ recipe: 'First run', name: 'Neon', lines: ['agy -p "/gurita:review-mission-requirements --mission <path>" --model "gemini-4-neon" --effort xhigh;'] }],
        harnesses: { antigravity: { enabled: false } },
      }),
    );

    let from = posted.length;
    const opened = from;
    showSettings();
    assert.deepStrictEqual(await postedLists(from), {
      claude: { models: ['fable', 'opus', 'sonnet'], efforts: ['xhigh', 'high'] },
      antigravity: { models: ['gemini-4-argon', 'claude-opus-5-5', 'gemini-4-neon'], efforts: ['medium', 'high', 'xhigh'] },
      codex: { models: ['gpt-5.5'], efforts: ['high'] },
    }, "the shipped, own, and stored lines' values, Codex's effort read from its override");

    inputBoxes.length = 0;
    typedValues.length = 0;
    typedValues.push(' haiku ');
    from = posted.length;
    send({ type: 'addHarnessValue', harness: 'claude', kind: 'model' });
    assert.deepStrictEqual((await postedLists(from)).claude.models, ['fable', 'opus', 'sonnet', 'haiku']);
    assert.strictEqual(inputBoxes.length, 1, 'one input box asks for the entry');
    const validate = inputBoxes[0].validateInput;
    assert.ok(validate !== undefined);
    assert.ok(validate('') !== undefined && validate('  ') !== undefined, 'an empty entry is refused');
    assert.ok(validate('opus') !== undefined && validate(' fable') !== undefined, 'an entry the list already offers is refused');
    assert.strictEqual(validate('claude-sonnet-5'), undefined);

    from = posted.length;
    send({ type: 'removeHarnessValue', harness: 'antigravity', kind: 'model', value: 'claude-opus-5-5' });
    assert.deepStrictEqual((await postedLists(from)).antigravity.models, ['gemini-4-argon', 'gemini-4-neon']);
    typedValues.push('low');
    from = posted.length;
    send({ type: 'addHarnessValue', harness: 'antigravity', kind: 'effort' });
    assert.deepStrictEqual((await postedLists(from)).antigravity.efforts, ['medium', 'high', 'xhigh', 'low']);
    from = posted.length;
    send({ type: 'removeHarnessValue', harness: 'claude', kind: 'model', value: 'haiku' });
    assert.deepStrictEqual((await postedLists(from)).claude.models, ['fable', 'opus', 'sonnet']);
    typedValues.push('gpt-5.5-codex');
    from = posted.length;
    send({ type: 'addHarnessValue', harness: 'codex', kind: 'model' });
    assert.deepStrictEqual(await postedLists(from).then((lists) => lists.codex), { models: ['gpt-5.5', 'gpt-5.5-codex'], efforts: ['high'] });
    typedValues.push('low');
    from = posted.length;
    send({ type: 'addHarnessValue', harness: 'codex', kind: 'effort' });
    assert.deepStrictEqual(await postedLists(from).then((lists) => lists.codex), { models: ['gpt-5.5', 'gpt-5.5-codex'], efforts: ['high', 'low'] });
    from = posted.length;
    send({ type: 'removeHarnessValue', harness: 'codex', kind: 'effort', value: 'high' });
    assert.deepStrictEqual(await postedLists(from).then((lists) => lists.codex.efforts), ['low'], 'an effort a Codex line carries is taken out of the offer');

    const written = JSON.parse(fs.readFileSync(store, 'utf8'));
    assert.deepStrictEqual(written.harnesses, {
      antigravity: { enabled: false, removedModels: ['claude-opus-5-5'], addedEfforts: ['low'] },
      claude: {},
      codex: { addedModels: ['gpt-5.5-codex'], addedEfforts: ['low'], removedEfforts: ['high'] },
    }, 'the overlay is kept in the harness part beside the enabled state');
    assert.strictEqual(written.variants.length, 1, 'the stored variant is kept');
    assert.ok(!fs.readFileSync(path.join(files, 'recipes.md'), 'utf8').includes('gpt-5.5-codex'), 'the own recipe file is not written');

    const before = fs.readFileSync(store, 'utf8');
    const boxes = inputBoxes.length;
    from = posted.length;
    send({ type: 'addHarnessValue', harness: 'agy', kind: 'model' });
    send({ type: 'addHarnessValue', harness: 'claude', kind: 'models' });
    send({ type: 'removeHarnessValue', harness: 'claude', kind: 'model', value: 'not-offered' });
    send({ type: 'removeHarnessValue', harness: 'codex', kind: 'effort', value: 'high' });
    send({ type: 'addHarnessValue', harness: 'codex', kind: 'effort' });
    send({ type: 'addHarnessValue', harness: 'claude', kind: 'effort' });
    send({ type: 'addHarnessValue', harness: 'claude-desktop', kind: 'model' });
    send({ type: 'removeHarnessValue', harness: 'claude-desktop', kind: 'effort', value: 'high' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.strictEqual(inputBoxes.length, boxes + 2, "only a known CLI's model or effort list is asked for, Codex's effort list included and Claude Desktop, which has none, not");
    assert.deepStrictEqual(posted.slice(from), [], 'no harness or list named, no entry offered, or a dismissed box writes and posts nothing');
    assert.strictEqual(fs.readFileSync(store, 'utf8'), before);

    // A Codex line's effort dropdown offers Codex's effort list, and a pick rewrites the override's level.
    const listedCodex = (await postedVariants(opened)).find((each) => each.name === 'Codex finish');
    assert.ok(listedCodex !== undefined);
    assert.deepStrictEqual((listedCodex.variants as EditedVariant[]).map((each) => each.editors), [[{ harness: 'codex', model: 'gpt-5.5', effort: 'high', harnesses: ALL_HARNESSES }]]);
    send({ type: 'replaceLineValue', recipe: 'Codex finish', variant: { name: listedCodex.variants[0].name, origin: 'own' }, line: 0, kind: 'effort', value: 'max' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.strictEqual(fs.readFileSync(store, 'utf8'), before, 'an effort the Codex list does not offer writes nothing');
    from = posted.length;
    send({ type: 'replaceLineValue', recipe: 'Codex finish', variant: { name: listedCodex.variants[0].name, origin: 'own' }, line: 0, kind: 'effort', value: 'low' });
    const changedCodex = (await postedVariants(from)).find((each) => each.name === 'Codex finish');
    assert.ok(changedCodex !== undefined);
    const custom = changedCodex.variants[changedCodex.variants.length - 1] as EditedVariant;
    assert.deepStrictEqual(custom.lines, ['codex exec "/gurita:finish-mission --mission <path>" -m gpt-5.5 -c model_reasoning_effort=low;']);
    assert.deepStrictEqual(custom.editors, [{ harness: 'codex', model: 'gpt-5.5', effort: 'low', harnesses: ALL_HARNESSES }]);
  } finally {
    process.env.HOME = home;
  }
});

/** A mission no earlier test holds a run for. */
const IOTA = 'pkg/mission_iota/';

/** The own file of the variant-edit test: a variant joining a shipped chain, one joining a button recipe, and a recipe of its own. */
const VARIANT_OWN_TEXT = `${OWN_TEXT}
### discuss-mission-goal
\`\`\`
claude "/gurita:discuss-mission-goal <goal>" --model "opus"; # interactive
\`\`\`
`;

interface ListedVariant {
  name: string;
  origin: string;
  copies?: { name: string; origin: string };
  lines: string[];
  isDefault: boolean;
  from?: { name: string; origin: string; recipe?: string };
}

interface ListedRecipe {
  name: string;
  group: string;
  fixed: boolean;
  variants: ListedVariant[];
  hidden: { name: string; origin: string }[];
}

/** Waits until the extension has posted the variant list beyond the first `from`, and returns its recipes as read. */
async function postedVariants(from: number): Promise<ListedRecipe[]> {
  const message = (await postedOf('variants', from)) as { variants: { state: string; recipes?: ListedRecipe[] } };
  assert.strictEqual(message.variants.state, 'read', JSON.stringify(message.variants));
  return message.variants.recipes as ListedRecipe[];
}

/** Each listed recipe by its name, fixed mark, variants (name, origin, default), and hidden variants. */
function variantRows(recipes: ListedRecipe[]): [string, boolean, string[], string[]][] {
  return recipes.map((recipe): [string, boolean, string[], string[]] => [
    recipe.name,
    recipe.fixed,
    recipe.variants.map((each) => `${each.name} (${each.origin}${each.copies ? ` of ${each.copies.name}` : ''})${each.isDefault ? ' *' : ''}`),
    recipe.hidden.map((each) => `${each.name} (${each.origin})`),
  ]);
}

test('the settings view lists every recipe with its variants and carries out each variant edit through the store, the pages and buttons following', async () => {
  const home = process.env.HOME;
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-home-'));
  process.env.HOME = fakeHome;
  try {
    const root = project(IOTA);
    const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-recipes-'));
    fs.writeFileSync(path.join(files, 'shipped_recipes.md'), HARNESS_SHIPPED_TEXT);
    fs.writeFileSync(path.join(files, 'recipes.md'), VARIANT_OWN_TEXT);
    packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
    packaged.set('bundled/shipped_recipes.md', path.join(files, 'shipped_recipes.md'));
    packaged.set('runner.py', path.join(__dirname, '..', '..', 'runner.py'));
    workspace.folders = [{ uri: { fsPath: root } }];
    workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
    workspaceState.clear();
    inputBoxes.length = 0;
    typedValues.length = 0;
    const store = path.join(fakeHome, '.gurita', 'variants.json');
    const stored = () => JSON.parse(fs.readFileSync(store, 'utf8'));
    /** Sends `message` and returns the variant list and the First run dropdown on IOTA's page posted after it. */
    const edit = async (message: unknown) => {
      const from = posted.length;
      const windowFrom = openWindow(IOTA).posts.length;
      send(message);
      const recipes = await postedVariants(from);
      const live = (await windowPosted(IOTA, 'page', windowFrom)).mission as { recipes: { recipes: PostedEntry[] } };
      const firstRun = live.recipes.recipes.find((each) => each.name === 'First run');
      assert.ok(firstRun !== undefined);
      return { recipes, dropdown: firstRun.variants.map((each) => each.name), selected: selectedName(firstRun) };
    };
    /** Runs the New mission row, on the discuss-mission-goal variant it draws, with a typed goal and returns the runner's arguments. */
    const discussGoal = async () => {
      const count = created.length;
      typedValues.push('A goal');
      pane.startingOffers(context);
      void pane.runStartingRow(context, 'discussGoal');
      for (let attempt = 0; attempt < 200 && created.length === count; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.strictEqual(created.length, count + 1);
      return created[created.length - 1].args.join(' ');
    };

    await entryAfter({ type: 'refresh' }, IOTA, 'First run');
    let from = posted.length;
    showSettings();
    let recipes = await postedVariants(from);
    assert.deepStrictEqual(variantRows(recipes), [
      ['First run', false, ['Claude Code (shipped) *', 'Antigravity (shipped)', 'default (own)'], []],
      ['Execute tasks one at a time', false, ['default (shipped) *'], []],
      ['Mixed review', false, ['default (shipped) *'], []],
      ['discuss-mission-goal', true, ['default (shipped) *', 'default (own)'], []],
      ['Mine everywhere', false, ['default (own) *'], []],
    ], 'the chains, the fixed-name button recipe, and the own items, the single-task lines left out');
    assert.ok(!fs.existsSync(store), 'opening the view writes nothing');

    // Duplicate: the name is asked for in one input box, which refuses an empty name and one the recipe uses.
    typedValues.push(' Fast ');
    let shown = await edit({ type: 'duplicateVariant', recipe: 'First run', variant: { name: 'Claude Code', origin: 'shipped' } });
    assert.strictEqual(inputBoxes.length, 1, 'one input box asks for the name');
    let box = inputBoxes[0];
    assert.strictEqual(box.value, undefined, "a duplicate's box opens empty");
    assert.ok(box.validateInput !== undefined);
    assert.ok(box.validateInput('') !== undefined && box.validateInput('  ') !== undefined, 'an empty name is refused');
    assert.ok(box.validateInput('Antigravity') !== undefined && box.validateInput(' default') !== undefined, 'a name the recipe uses is refused');
    assert.strictEqual(box.validateInput(' default'), 'The action recipe already has a variant named default.', 'the refusal names the action recipe');
    assert.strictEqual(box.validateInput('Fast'), undefined);
    assert.deepStrictEqual(stored().variants, [
      { recipe: 'First run', name: 'Fast', lines: recipes[0].variants[0].lines, from: { name: 'Claude Code', origin: 'shipped' } },
    ], 'a duplicate remembers the variant it was made from');
    assert.deepStrictEqual(variantRows(shown.recipes)[0], ['First run', false, ['Claude Code (shipped) *', 'Antigravity (shipped)', 'default (own)', 'Fast (stored)'], []]);
    assert.deepStrictEqual(shown.dropdown, ['Claude Code', 'Antigravity', 'default', 'Fast'], "the duplicate reaches the mission page's dropdown");

    // Rename: the box opens on the current name; a shipped variant gets a stored copy in its place.
    typedValues.push('Gemini');
    shown = await edit({ type: 'renameVariant', recipe: 'First run', variant: { name: 'Antigravity', origin: 'shipped' } });
    box = inputBoxes[1];
    assert.strictEqual(box.value, 'Antigravity', 'a rename opens with the current name filled in');
    assert.ok(box.validateInput !== undefined);
    assert.ok(box.validateInput('') !== undefined, 'an empty name is refused');
    assert.ok(box.validateInput('Claude Code') !== undefined && box.validateInput('Fast') !== undefined, 'a name the recipe uses is refused');
    assert.strictEqual(box.validateInput('Antigravity'), undefined, 'the current name is no other variant');
    assert.deepStrictEqual(variantRows(shown.recipes)[0][2], ['Claude Code (shipped) *', 'Gemini (stored of Antigravity)', 'default (own)', 'Fast (stored)']);
    assert.deepStrictEqual(shown.dropdown, ['Claude Code', 'Gemini', 'default', 'Fast'], 'the renamed variant keeps its place');

    // Default: a pick on the stored copy; with nothing remembered the page's dropdown stands on it.
    shown = await edit({ type: 'pickDefault', recipe: 'First run', variant: { name: 'Gemini', origin: 'stored', copies: { name: 'Antigravity', origin: 'shipped' } } });
    assert.deepStrictEqual(stored().defaults, [{ recipe: 'First run', name: 'Antigravity', origin: 'shipped' }]);
    assert.deepStrictEqual(variantRows(shown.recipes)[0][2], ['Claude Code (shipped)', 'Gemini (stored of Antigravity) *', 'default (own)', 'Fast (stored)']);
    assert.strictEqual(shown.selected, 'Gemini');

    // Reset of a stored variant: each is listed with the variant it was made from; a reset keeps its name and entry.
    assert.deepStrictEqual(shown.recipes[0].variants.map((each) => [each.name, each.from]), [
      ['Claude Code', undefined],
      ['Gemini', { name: 'Antigravity', origin: 'shipped' }],
      ['default', undefined],
      ['Fast', { name: 'Claude Code', origin: 'shipped' }],
    ]);
    shown = await edit({ type: 'resetVariantLines', recipe: 'First run', variant: { name: 'Gemini', origin: 'stored', copies: { name: 'Antigravity', origin: 'shipped' } } });
    assert.deepStrictEqual(variantRows(shown.recipes)[0][2], ['Claude Code (shipped)', 'Gemini (stored of Antigravity) *', 'default (own)', 'Fast (stored)'], 'the reset copy keeps its name, its place, and the pick');
    assert.deepStrictEqual(shown.dropdown, ['Claude Code', 'Gemini', 'default', 'Fast']);

    // Delete: a shipped variant gets a hiding record, listed with its reset; the page's dropdown loses it.
    shown = await edit({ type: 'deleteVariant', recipe: 'First run', variant: { name: 'Claude Code', origin: 'shipped' } });
    assert.deepStrictEqual(variantRows(shown.recipes)[0], ['First run', false, ['Gemini (stored of Antigravity) *', 'default (own)', 'Fast (stored)'], ['Claude Code (shipped)']]);
    assert.deepStrictEqual(shown.dropdown, ['Gemini', 'default', 'Fast']);
    shown = await edit({ type: 'resetVariant', recipe: 'First run', original: { name: 'Claude Code', origin: 'shipped' } });
    assert.deepStrictEqual(shown.dropdown, ['Claude Code', 'Gemini', 'default', 'Fast'], 'reset, the deleted variant shows again');
    shown = await edit({ type: 'deleteVariant', recipe: 'First run', variant: { name: 'Fast', origin: 'stored' } });
    assert.deepStrictEqual(shown.dropdown, ['Claude Code', 'Gemini', 'default'], 'a deleted duplicate leaves the store');

    // The fixed-name button runs the default picked in the settings view, its pages posted again with every edit.
    assert.match(await discussGoal(), / chain --close-when-finished -- agy /, 'the shipped variant runs first');
    recipes = (await edit({ type: 'pickDefault', recipe: 'discuss-mission-goal', variant: { name: 'default', origin: 'own' } })).recipes;
    assert.deepStrictEqual(variantRows(recipes)[3][2], ['default (shipped)', 'default (own) *']);
    assert.match(await discussGoal(), / chain --close-when-finished -- claude /, 'the picked own variant runs');
    recipes = (await edit({ type: 'deleteVariant', recipe: 'discuss-mission-goal', variant: { name: 'default', origin: 'own' } })).recipes;
    assert.deepStrictEqual(variantRows(recipes)[3], ['discuss-mission-goal', true, ['default (shipped) *'], ['default (own)']]);
    assert.deepStrictEqual(stored().defaults, [{ recipe: 'First run', name: 'Antigravity', origin: 'shipped' }], 'deleting the picked default drops its pick');
    assert.match(await discussGoal(), / chain --close-when-finished -- agy /, 'the button falls back to the first listed variant');

    // A dismissed box, a message naming no listed variant, or no variant in form writes and posts nothing.
    const before = fs.readFileSync(store, 'utf8');
    const boxes = inputBoxes.length;
    from = posted.length;
    send({ type: 'renameVariant', recipe: 'First run', variant: { name: 'Claude Code', origin: 'shipped' } });
    send({ type: 'duplicateVariant', recipe: 'First run', variant: { name: 'No such variant', origin: 'shipped' } });
    send({ type: 'deleteVariant', recipe: 'No such recipe', variant: { name: 'Claude Code', origin: 'shipped' } });
    send({ type: 'pickDefault', recipe: 'First run', variant: { name: 'Claude Code', origin: 'elsewhere' } });
    send({ type: 'resetVariant', recipe: 'First run', original: { name: 'Antigravity', origin: 'shipped' } });
    send({ type: 'resetVariantLines', recipe: 'First run', variant: { name: 'Claude Code', origin: 'shipped' } });
    send({ type: 'deleteVariant', recipe: 'First run' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.strictEqual(inputBoxes.length, boxes + 1, 'only the rename of a listed variant asks for a name');
    assert.deepStrictEqual(posted.slice(from), []);
    assert.strictEqual(fs.readFileSync(store, 'utf8'), before);

    assert.strictEqual(fs.readFileSync(path.join(files, 'recipes.md'), 'utf8'), VARIANT_OWN_TEXT, 'the own recipe file is never written');
    assert.strictEqual(execFileSync('git', ['status', '--porcelain', '--ignored'], { cwd: root, encoding: 'utf8' }), '', "nothing is written into the project's tree");
  } finally {
    process.env.HOME = home;
  }
});

/** A mission no earlier test holds a run for. */
const KAPPA = 'pkg/mission_kappa/';

/** The row a line running a `gurita:` skill is posted with. */
type PostedRow = { skill: string; interactive: boolean; harness: string } | null;

interface EditedVariant extends ListedVariant {
  editors: ({ harness: string; model: string; effort?: string; harnesses?: string[] } | null)[];
  rows: PostedRow[];
}

test("a pick in a line's dropdown on a shipped variant leaves it unchanged beside a custom N holding the changed line, a second pick keeping the name and a reset restoring the lines", async () => {
  const home = process.env.HOME;
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-home-'));
  process.env.HOME = fakeHome;
  try {
    const root = project(KAPPA);
    const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-recipes-'));
    fs.writeFileSync(path.join(files, 'shipped_recipes.md'), HARNESS_SHIPPED_TEXT);
    fs.writeFileSync(path.join(files, 'recipes.md'), OWN_TEXT);
    packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
    packaged.set('bundled/shipped_recipes.md', path.join(files, 'shipped_recipes.md'));
    packaged.set('runner.py', path.join(__dirname, '..', '..', 'runner.py'));
    workspace.folders = [{ uri: { fsPath: root } }];
    workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
    workspaceState.clear();
    inputBoxes.length = 0;
    const store = path.join(fakeHome, '.gurita', 'variants.json');
    const stored = () => JSON.parse(fs.readFileSync(store, 'utf8'));
    /** Sends `message` and returns the variants of `recipe` listed and its entry on KAPPA's page posted after it. */
    const pick = async (message: unknown, recipe = 'First run') => {
      const from = posted.length;
      const windowFrom = openWindow(KAPPA).posts.length;
      send(message);
      const recipes = await postedVariants(from);
      const live = (await windowPosted(KAPPA, 'page', windowFrom)).mission as { recipes: { recipes: PostedEntry[] } };
      const entry = live.recipes.recipes.find((each) => each.name === recipe);
      const listed = recipes.find((each) => each.name === recipe);
      assert.ok(entry !== undefined && listed !== undefined);
      return { variants: listed.variants as EditedVariant[], entry };
    };

    await entryAfter({ type: 'refresh' }, KAPPA, 'First run');
    const from = posted.length;
    showSettings();
    const listed = (await postedVariants(from))[0].variants as EditedVariant[];
    const shippedLines = listed[0].lines;
    assert.deepStrictEqual(listed.map((each) => [each.name, each.origin, each.editors]), [
      ['Claude Code', 'shipped', [
        { harness: 'claude', model: 'fable', effort: 'xhigh', harnesses: ALL_HARNESSES },
        { harness: 'claude', model: 'opus', effort: 'high', harnesses: ALL_HARNESSES },
        { harness: 'claude', model: 'fable', effort: 'xhigh', harnesses: ALL_HARNESSES },
      ]],
      ['Antigravity', 'shipped', [{ harness: 'antigravity', model: 'gemini-4-argon', effort: 'medium', harnesses: ALL_HARNESSES }]],
      ['default', 'own', [null]],
    ], 'each line with both flags gets its editor, the own line carrying --model alone none');
    assert.deepStrictEqual(listed.map((each) => [each.name, each.rows]), [
      ['Claude Code', [
        { skill: 'review-mission-requirements', interactive: false, harness: 'claude' },
        { skill: 'provide-alternatives-to-all-open-questions', interactive: false, harness: 'claude' },
        { skill: 'recommend-all-open-questions', interactive: false, harness: 'claude' },
      ]],
      ['Antigravity', [{ skill: 'review-mission-requirements', interactive: false, harness: 'antigravity' }]],
      ['default', [{ skill: 'review-mission-requirements', interactive: false, harness: 'claude' }]],
    ], 'each line running a gurita: skill is posted with its row, the own line without an editor included');

    // A model pick on a shipped variant's line: the variant stays as it is, a custom 1 holding the changed line added after the others.
    let shown = await pick({ type: 'replaceLineValue', recipe: 'First run', variant: { name: 'Claude Code', origin: 'shipped' }, line: 1, kind: 'model', value: 'fable' });
    const changed = shippedLines[1].replace('--model "opus"', '--model "fable"');
    assert.deepStrictEqual(stored().variants, [
      { recipe: 'First run', name: 'custom 1', lines: [shippedLines[0], changed, shippedLines[2]], from: { name: 'Claude Code', origin: 'shipped' } },
    ]);
    assert.deepStrictEqual(shown.variants.map((each) => [each.name, each.origin, each.isDefault]), [
      ['Claude Code', 'shipped', true],
      ['Antigravity', 'shipped', false],
      ['default', 'own', false],
      ['custom 1', 'stored', false],
    ], 'the shipped variant stays listed and the default, custom 1 beside it');
    assert.deepStrictEqual(shown.variants[0].lines, shippedLines, 'the shipped variant is unchanged');
    assert.deepStrictEqual(shown.variants[3].lines, [shippedLines[0], changed, shippedLines[2]]);
    assert.deepStrictEqual(shown.variants[3].editors[1], { harness: 'claude', model: 'fable', effort: 'high', harnesses: ALL_HARNESSES });
    assert.deepStrictEqual(shown.variants[3].from, { name: 'Claude Code', origin: 'shipped' });
    assert.deepStrictEqual(shown.entry.variants.map((each) => each.name), ['Claude Code', 'Antigravity', 'default', 'custom 1'], "the mission page's dropdown lists custom 1 last");
    assert.strictEqual(selectedName(shown.entry), 'Claude Code', 'custom 1 is not selected');
    assert.deepStrictEqual(shown.entry.lines, shippedLines, "the page's button still runs the shipped lines");

    // An effort pick, from the harness's whole effort list, on custom 1 changes it in the store, its name kept.
    shown = await pick({ type: 'replaceLineValue', recipe: 'First run', variant: { name: 'custom 1', origin: 'stored' }, line: 1, kind: 'effort', value: 'xhigh' });
    assert.strictEqual(stored().variants.length, 1, 'custom 1 is changed in place');
    assert.strictEqual(stored().variants[0].name, 'custom 1', 'a second edit of custom 1 keeps its name');
    assert.strictEqual(stored().variants[0].lines[1], changed.replace('--effort high', '--effort xhigh'));

    // An Antigravity line takes its own harness's effort list, and its custom takes the next number.
    shown = await pick({ type: 'replaceLineValue', recipe: 'First run', variant: { name: 'Antigravity', origin: 'shipped' }, line: 0, kind: 'effort', value: 'high' });
    assert.match(shown.variants[4].lines[0], /--model "gemini-4-argon" --effort high;$/);
    assert.deepStrictEqual(shown.variants.map((each) => [each.name, each.origin]), [
      ['Claude Code', 'shipped'],
      ['Antigravity', 'shipped'],
      ['default', 'own'],
      ['custom 1', 'stored'],
      ['custom 2', 'stored'],
    ]);

    // A recipe of one block: its default stays unchanged beside its custom 1, a second edit keeps the name, and a reset restores the lines.
    const mixed = ['agy -p "/gurita:review-mission-requirements --mission <path>" --model "gemini-4-argon" --effort medium;'];
    shown = await pick({ type: 'replaceLineValue', recipe: 'Mixed review', variant: { name: 'default', origin: 'shipped' }, line: 0, kind: 'effort', value: 'high' }, 'Mixed review');
    assert.deepStrictEqual(shown.variants.map((each) => [each.name, each.origin, each.isDefault]), [['default', 'shipped', true], ['custom 1', 'stored', false]]);
    assert.deepStrictEqual(shown.variants[0].lines, mixed, 'the default is unchanged');
    shown = await pick({ type: 'replaceLineValue', recipe: 'Mixed review', variant: { name: 'custom 1', origin: 'stored' }, line: 0, kind: 'model', value: 'claude-opus-5-5' }, 'Mixed review');
    assert.deepStrictEqual(shown.variants.map((each) => each.name), ['default', 'custom 1'], 'a second edit of custom 1 keeps its name');
    assert.deepStrictEqual(shown.variants[1].lines, ['agy -p "/gurita:review-mission-requirements --mission <path>" --model "claude-opus-5-5" --effort high;']);
    assert.strictEqual(selectedName(shown.entry), 'default');
    shown = await pick({ type: 'resetVariantLines', recipe: 'Mixed review', variant: { name: 'custom 1', origin: 'stored' } }, 'Mixed review');
    assert.deepStrictEqual(shown.variants.map((each) => [each.name, each.origin, each.lines]), [['default', 'shipped', mixed], ['custom 1', 'stored', mixed]], 'the reset restores the lines under the same name');
    assert.deepStrictEqual(stored().variants.filter((each: { recipe: string }) => each.recipe === 'Mixed review').map((each: { name: string }) => each.name), ['custom 1'], 'its entry stays in the store');
    assert.deepStrictEqual(shown.entry.variants.map((each) => each.name), ['default', 'custom 1']);

    // A value the list does not offer, the value the line carries, a line without a control, a reset of a variant not stored, or a message not in form writes and posts nothing.
    const before = fs.readFileSync(store, 'utf8');
    const quiet = posted.length;
    const copy = { name: 'custom 1', origin: 'stored' };
    send({ type: 'replaceLineValue', recipe: 'First run', variant: copy, line: 0, kind: 'effort', value: 'max' });
    send({ type: 'replaceLineValue', recipe: 'First run', variant: copy, line: 0, kind: 'model', value: 'gemini-4-argon' });
    send({ type: 'replaceLineValue', recipe: 'First run', variant: copy, line: 0, kind: 'model', value: 'fable' });
    send({ type: 'replaceLineValue', recipe: 'First run', variant: { name: 'default', origin: 'own' }, line: 0, kind: 'model', value: 'opus' });
    send({ type: 'replaceLineValue', recipe: 'First run', variant: { name: 'default', origin: 'own' }, line: 0, kind: 'effort', value: 'high' });
    send({ type: 'replaceLineValue', recipe: 'First run', variant: copy, line: 3, kind: 'model', value: 'opus' });
    send({ type: 'replaceLineValue', recipe: 'First run', variant: copy, line: '0', kind: 'model', value: 'opus' });
    send({ type: 'replaceLineValue', recipe: 'First run', variant: copy, line: 0, kind: 'models', value: 'opus' });
    send({ type: 'replaceLineValue', recipe: 'Execute tasks one at a time', variant: { name: 'default', origin: 'shipped' }, line: 0, kind: 'model', value: 'opus' });
    send({ type: 'replaceLineValue', recipe: 'First run', variant: { name: 'custom 1', origin: 'shipped' }, line: 0, kind: 'model', value: 'opus' });
    send({ type: 'resetVariantLines', recipe: 'First run', variant: { name: 'Claude Code', origin: 'shipped' } });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.deepStrictEqual(posted.slice(quiet), []);
    assert.strictEqual(fs.readFileSync(store, 'utf8'), before);
    assert.strictEqual(inputBoxes.length, 0, 'a pick asks for nothing in an input box');

    assert.strictEqual(fs.readFileSync(path.join(files, 'recipes.md'), 'utf8'), OWN_TEXT, 'the own recipe file is never written');
    assert.strictEqual(fs.readFileSync(path.join(files, 'shipped_recipes.md'), 'utf8'), HARNESS_SHIPPED_TEXT, 'the shipped file is never written');
    assert.strictEqual(execFileSync('git', ['status', '--porcelain', '--ignored'], { cwd: root, encoding: 'utf8' }), '', "nothing is written into the project's tree");
  } finally {
    process.env.HOME = home;
  }
});

/** A mission no earlier test holds a run for. */
const SIGMA = 'pkg/mission_sigma/';

test("a pick in a line's harness dropdown rewrites the line onto the picked harness through the store's edit, the redrawn row and the page's button following", async () => {
  const home = process.env.HOME;
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-home-'));
  process.env.HOME = fakeHome;
  try {
    const root = project(SIGMA);
    const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-recipes-'));
    fs.writeFileSync(path.join(files, 'shipped_recipes.md'), HARNESS_SHIPPED_TEXT);
    fs.writeFileSync(path.join(files, 'recipes.md'), OWN_TEXT);
    packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
    packaged.set('bundled/shipped_recipes.md', path.join(files, 'shipped_recipes.md'));
    packaged.set('runner.py', path.join(__dirname, '..', '..', 'runner.py'));
    workspace.folders = [{ uri: { fsPath: root } }];
    workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
    workspaceState.clear();
    inputBoxes.length = 0;
    const store = path.join(fakeHome, '.gurita', 'variants.json');
    const stored = () => JSON.parse(fs.readFileSync(store, 'utf8'));
    /** Sends `message` and returns the First run variants listed, the single-task lines, and the First run entry on SIGMA's page posted after it. */
    const pick = async (message: unknown) => {
      const from = posted.length;
      const windowFrom = openWindow(SIGMA).posts.length;
      send(message);
      const recipes = await postedVariants(from);
      const lines = await postedLines(from);
      const live = (await windowPosted(SIGMA, 'page', windowFrom)).mission as { recipes: { recipes: PostedEntry[] } };
      const entry = live.recipes.recipes.find((each) => each.name === 'First run');
      assert.ok(entry !== undefined);
      return { variants: recipes[0].variants as EditedVariant[], lines: lines.lines, entry };
    };

    await entryAfter({ type: 'refresh' }, SIGMA, 'First run');
    const from = posted.length;
    showSettings();
    const shippedLines = ((await postedVariants(from))[0].variants as EditedVariant[])[0].lines;

    // Claude Code to Antigravity: the prompt and form kept, the first listed model, an effort not offered becoming the first listed.
    let shown = await pick({ type: 'replaceLineHarness', recipe: 'First run', variant: { name: 'Claude Code', origin: 'shipped' }, line: 0, harness: 'antigravity' });
    const onAgy = 'agy -p "/gurita:review-mission-requirements --mission <path>" --model "gemini-4-argon" --effort medium;';
    assert.deepStrictEqual(stored().variants, [
      { recipe: 'First run', name: 'custom 1', lines: [onAgy, shippedLines[1], shippedLines[2]], from: { name: 'Claude Code', origin: 'shipped' } },
    ], 'a shipped variant gets a custom 1 holding the rewritten line beside it');
    assert.deepStrictEqual(shown.variants.map((each) => [each.name, each.origin]), [['Claude Code', 'shipped'], ['Antigravity', 'shipped'], ['default', 'own'], ['custom 1', 'stored']]);
    assert.deepStrictEqual(shown.variants[0].lines, shippedLines, 'the shipped variant is unchanged');
    assert.deepStrictEqual(shown.variants[3].editors[0], { harness: 'antigravity', model: 'gemini-4-argon', effort: 'medium', harnesses: ALL_HARNESSES }, "the redrawn row's dropdowns stand on Antigravity");
    assert.deepStrictEqual(shown.variants[3].rows[0], { skill: 'review-mission-requirements', interactive: false, harness: 'antigravity' });
    assert.deepStrictEqual(shown.entry.lines, shippedLines, "the page's button still runs the selected shipped variant");
    const entry = await entryAfter({ type: 'selectVariant', mission: SIGMA, recipe: 'First run', variant: 'custom 1' }, SIGMA, 'First run');
    assert.strictEqual(selectedName(entry), 'custom 1');
    assert.deepStrictEqual(entry.lines, [onAgy, shippedLines[1], shippedLines[2]], "the page's button runs the rewritten line once custom 1 is selected");

    // An offered effort is kept, and custom 1 is changed in place.
    const copy = { name: 'custom 1', origin: 'stored' };
    shown = await pick({ type: 'replaceLineHarness', recipe: 'First run', variant: copy, line: 1, harness: 'antigravity' });
    assert.strictEqual(stored().variants.length, 1);
    assert.strictEqual(stored().variants[0].name, 'custom 1', 'a second edit of custom 1 keeps its name');
    assert.strictEqual(stored().variants[0].lines[1], 'agy -p "/gurita:provide-alternatives-to-all-open-questions --mission <path>" --model "gemini-4-argon" --effort high;');

    // Antigravity to Claude Code, and back again on custom 1.
    shown = await pick({ type: 'replaceLineHarness', recipe: 'First run', variant: { name: 'Antigravity', origin: 'shipped' }, line: 0, harness: 'claude' });
    assert.strictEqual(shown.variants[4].name, 'custom 2');
    assert.strictEqual(shown.variants[4].lines[0], 'claude -p "/gurita:review-mission-requirements --mission <path>" --model "fable" --effort xhigh;');
    assert.deepStrictEqual(shown.variants[4].editors[0], { harness: 'claude', model: 'fable', effort: 'xhigh', harnesses: ALL_HARNESSES });
    shown = await pick({ type: 'replaceLineHarness', recipe: 'First run', variant: copy, line: 0, harness: 'claude' });
    assert.strictEqual(shown.variants[3].lines[0], shippedLines[0], 'the way back gives the shipped line');

    // A named single-task line is rewritten as a variant's line is, custom 1 added under the line's name.
    shown = await pick({ type: 'replaceLineHarness', recipe: 'Single task (Antigravity)', variant: { name: 'default', origin: 'shipped' }, line: 0, harness: 'claude' });
    const line = shown.lines.find((each) => each.name === 'Single task (Antigravity)');
    assert.ok(line !== undefined);
    assert.deepStrictEqual(line.variants.map((each) => [each.name, each.origin, each.isDefault]), [['default', 'shipped', true], ['custom 1', 'stored', false]]);
    assert.deepStrictEqual(line.variants[1].lines, ['claude -p "/gurita:complete-task --mission <path> <Task Title>" --model "fable" --effort high;']);
    assert.deepStrictEqual(line.variants[1].editors, [{ harness: 'claude', model: 'fable', effort: 'high', harnesses: ALL_HARNESSES }]);

    // Claude Code to Codex: with no Codex model listed the switch is refused in today's error notification, nothing written.
    let before = fs.readFileSync(store, 'utf8');
    notifications.length = 0;
    shown = await pick({ type: 'replaceLineHarness', recipe: 'First run', variant: copy, line: 0, harness: 'codex' });
    assert.deepStrictEqual(notifications, ['The harness could not be changed: The codex model list offers no model to rewrite a line with.']);
    assert.strictEqual(fs.readFileSync(store, 'utf8'), before, 'a refused switch writes nothing');
    assert.strictEqual(shown.variants[3].lines[0], shippedLines[0]);

    // With a Codex model and no Codex effort listed, the switch goes ahead and writes no effort override.
    typedValues.push('gpt-5.5');
    const listsFrom = posted.length;
    send({ type: 'addHarnessValue', harness: 'codex', kind: 'model' });
    assert.deepStrictEqual((await postedLists(listsFrom)).codex, { models: ['gpt-5.5'], efforts: [] });
    shown = await pick({ type: 'replaceLineHarness', recipe: 'First run', variant: copy, line: 0, harness: 'codex' });
    const onCodex = "codex exec '$gurita:review-mission-requirements --mission <path>' -m \"gpt-5.5\";";
    assert.strictEqual(stored().variants[0].lines[0], onCodex);
    assert.deepStrictEqual(shown.variants[3].editors[0], { harness: 'codex', model: 'gpt-5.5', harnesses: ALL_HARNESSES }, 'a Codex line without the override gets no effort dropdown');
    assert.deepStrictEqual(shown.variants[3].rows[0], { skill: 'review-mission-requirements', interactive: false, harness: 'codex' });
    inputBoxes.length = 0;

    // With a Codex effort listed, an effort Codex offers is kept, written as the override.
    typedValues.push('high');
    const effortsFrom = posted.length;
    send({ type: 'addHarnessValue', harness: 'codex', kind: 'effort' });
    assert.deepStrictEqual((await postedLists(effortsFrom)).codex, { models: ['gpt-5.5'], efforts: ['high'] });
    shown = await pick({ type: 'replaceLineHarness', recipe: 'First run', variant: copy, line: 1, harness: 'codex' });
    assert.strictEqual(stored().variants[0].lines[1], "codex exec '$gurita:provide-alternatives-to-all-open-questions --mission <path>' -m \"gpt-5.5\" -c model_reasoning_effort=high;");
    assert.deepStrictEqual(shown.variants[3].editors[1], { harness: 'codex', model: 'gpt-5.5', effort: 'high', harnesses: ALL_HARNESSES });
    inputBoxes.length = 0;

    // Codex back to Claude Code: a line without the override takes the first listed effort, the shipped line given back.
    shown = await pick({ type: 'replaceLineHarness', recipe: 'First run', variant: copy, line: 0, harness: 'claude' });
    assert.strictEqual(shown.variants[3].lines[0], shippedLines[0], 'the round trip gives the shipped line');

    // The harness the line runs on, a harness not named, a line without both flags, or a message not in form writes and posts nothing.
    before = fs.readFileSync(store, 'utf8');
    const quiet = posted.length;
    send({ type: 'replaceLineHarness', recipe: 'First run', variant: copy, line: 0, harness: 'claude' });
    send({ type: 'replaceLineHarness', recipe: 'First run', variant: copy, line: 1, harness: 'codex' });
    send({ type: 'replaceLineHarness', recipe: 'First run', variant: copy, line: 0, harness: 'agy' });
    send({ type: 'replaceLineHarness', recipe: 'First run', variant: { name: 'default', origin: 'own' }, line: 0, harness: 'antigravity' });
    send({ type: 'replaceLineHarness', recipe: 'discuss-mission-goal', variant: { name: 'default', origin: 'shipped' }, line: 0, harness: 'claude' });
    send({ type: 'replaceLineHarness', recipe: 'First run', variant: copy, line: 3, harness: 'antigravity' });
    send({ type: 'replaceLineHarness', recipe: 'First run', variant: copy, line: '0', harness: 'antigravity' });
    send({ type: 'replaceLineHarness', recipe: 'Execute tasks one at a time', variant: { name: 'default', origin: 'shipped' }, line: 0, harness: 'antigravity' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.deepStrictEqual(posted.slice(quiet), []);
    assert.strictEqual(fs.readFileSync(store, 'utf8'), before);
    assert.strictEqual(inputBoxes.length, 0, 'a pick asks for nothing in an input box');

    assert.strictEqual(fs.readFileSync(path.join(files, 'recipes.md'), 'utf8'), OWN_TEXT, 'the own recipe file is never written');
    assert.strictEqual(fs.readFileSync(path.join(files, 'shipped_recipes.md'), 'utf8'), HARNESS_SHIPPED_TEXT, 'the shipped file is never written');
    assert.strictEqual(execFileSync('git', ['status', '--porcelain', '--ignored'], { cwd: root, encoding: 'utf8' }), '', "nothing is written into the project's tree");
  } finally {
    process.env.HOME = home;
  }
});

/** A mission no earlier test holds a run for. */
const LAMBDA = 'pkg/mission_lambda/';
/** The missions the line-edit test starts its looped runs on, one per run, since a running mission refuses another. */
const LAMBDA_LOOPS = [1, 2, 3, 4, 5].map((each) => `pkg/mission_lambda_${each}/`);

/** The own file of the line-edit test: a named single-task line of its own beside the recipes of the recipe-list test. */
const LINE_OWN_TEXT = `${OWN_TEXT}
### My own line
\`\`\`
claude -p "/gurita:complete-task --mission <path> <Task Title>" --model "sonnet" --effort medium;
\`\`\`
`;

interface ListedLine {
  name: string;
  variants: (EditedVariant & { copies?: { name: string; origin: string; recipe?: string } })[];
  hidden: { name: string; origin: string }[];
  reset?: { recipe: string; original: { name: string; origin: string } };
}

/** Waits until the extension has posted the single-task lines beyond the first `from`, and returns them as read. */
async function postedLines(from: number): Promise<{ lines: ListedLine[] }> {
  const message = (await postedOf('singleTaskLines', from)) as { lines: { state: string; lines?: ListedLine[] } };
  assert.strictEqual(message.lines.state, 'read', JSON.stringify(message.lines));
  return { lines: message.lines.lines as ListedLine[] };
}

/** The variant of a listed line the looped run passes as its `--line`, its default. */
function lineDefault(line: ListedLine): ListedLine['variants'][number] {
  const found = line.variants.find((each) => each.isDefault);
  assert.ok(found !== undefined, `the line ${line.name} has a default`);
  return found;
}

test("the settings view lists the named single-task lines and carries out each line edit through the store, the looped run's names following", async () => {
  const home = process.env.HOME;
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-home-'));
  process.env.HOME = fakeHome;
  try {
    const root = project(LAMBDA, ...LAMBDA_LOOPS);
    const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-recipes-'));
    fs.writeFileSync(path.join(files, 'shipped_recipes.md'), HARNESS_SHIPPED_TEXT);
    fs.writeFileSync(path.join(files, 'recipes.md'), LINE_OWN_TEXT);
    packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
    packaged.set('bundled/shipped_recipes.md', path.join(files, 'shipped_recipes.md'));
    packaged.set('runner.py', path.join(__dirname, '..', '..', 'runner.py'));
    workspace.folders = [{ uri: { fsPath: root } }];
    workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
    workspaceState.clear();
    inputBoxes.length = 0;
    typedValues.length = 0;
    const store = path.join(fakeHome, '.gurita', 'variants.json');
    const stored = () => JSON.parse(fs.readFileSync(store, 'utf8'));
    const CC = 'Single task (Claude Code)';
    const AGY = 'Single task (Antigravity)';
    const ccLine = 'claude -p "/gurita:complete-task --mission <path> <Task Title>" --model "opus" --effort high;';
    const agyLine = 'agy -p "/gurita:complete-task --mission <path> <Task Title>" --model "claude-opus-5-5" --effort high;';
    /** Each listed line that has a variant by its name, its default's origin, and the line its default holds. */
    const rows = (listed: { lines: ListedLine[] }) =>
      listed.lines.filter((each) => each.variants.length > 0).map((each) => [each.name, lineDefault(each).origin, lineDefault(each).lines[0]]);
    /** Sends `message` and returns the line list posted after it, checking the variant list and the pages are posted again too. */
    const edit = async (message: unknown) => {
      const from = posted.length;
      const windowFrom = openWindow(LAMBDA).posts.length;
      send(message);
      const listed = await postedLines(from);
      await postedVariants(from);
      await windowPosted(LAMBDA, 'page', windowFrom);
      return listed;
    };
    /** The looped run's preview on LAMBDA's page: the names its override list offers. */
    const previewNames = async () => {
      const from = openWindow(LAMBDA).posts.length;
      send({ type: 'previewLoop', mission: LAMBDA, recipe: 'Execute tasks one at a time', variant: 'default' });
      const preview = await windowPosted(LAMBDA, 'preview', from);
      assert.strictEqual((preview.result as { state: string }).state, 'read');
      return preview.names;
    };
    /** Previews and starts the looped run on the next mission no run holds yet, and returns its `--line` arguments, each as NAME=LINE. */
    const loopLines = async () => {
      const mission = LAMBDA_LOOPS.shift();
      assert.ok(mission !== undefined, 'a mission is left for the run');
      const from = openWindow(mission).posts.length;
      send({ type: 'previewLoop', mission, recipe: 'Execute tasks one at a time', variant: 'default' });
      assert.strictEqual(((await windowPosted(mission, 'preview', from)).result as { state: string }).state, 'read');
      const count = created.length;
      send({ type: 'startLoop', mission, recipe: 'Execute tasks one at a time', overrides: {} });
      assert.strictEqual(created.length, count + 1);
      const args = created[created.length - 1].args;
      return args.flatMap((arg, index) => (arg === '--line' ? [`${args[index + 1]}=${args[index + 2]}`] : []));
    };
    /** The line of the name `name` in a posted list. */
    const lineOf = (listed: { lines: ListedLine[] }, name: string): ListedLine => {
      const found = listed.lines.find((each) => each.name === name);
      assert.ok(found !== undefined, `the line ${name} is listed`);
      return found;
    };

    await entryAfter({ type: 'refresh' }, LAMBDA, 'First run');
    let from = posted.length;
    showSettings();
    let listed = await postedLines(from);
    assert.deepStrictEqual(rows(listed), [
      [CC, 'shipped', ccLine],
      [AGY, 'shipped', agyLine],
      ['My own line', 'own', 'claude -p "/gurita:complete-task --mission <path> <Task Title>" --model "sonnet" --effort medium;'],
    ], 'the shipped lines and the own one, each with its default');
    assert.deepStrictEqual(listed.lines.map((each) => each.variants.map((variant) => [variant.name, variant.isDefault])), [
      [['default', true]],
      [['default', true]],
      [['default', true]],
    ], 'each line lists its default variant beneath its name');
    assert.deepStrictEqual(listed.lines.map((each) => each.variants[0].editors), [
      [{ harness: 'claude', model: 'opus', effort: 'high', harnesses: ALL_HARNESSES }],
      [{ harness: 'antigravity', model: 'claude-opus-5-5', effort: 'high', harnesses: ALL_HARNESSES }],
      [{ harness: 'claude', model: 'sonnet', effort: 'medium', harnesses: ALL_HARNESSES }],
    ]);
    assert.deepStrictEqual(listed.lines.map((each) => each.variants[0].rows), [
      [{ skill: 'complete-task', interactive: false, harness: 'claude' }],
      [{ skill: 'complete-task', interactive: false, harness: 'antigravity' }],
      [{ skill: 'complete-task', interactive: false, harness: 'claude' }],
    ], 'each line is posted with its row');
    assert.ok(!fs.existsSync(store), 'opening the view writes nothing');

    // Duplicate: the name is asked for in one input box, which refuses an empty name and one a recipe or line carries.
    typedValues.push(' Single task (Sonnet) ');
    listed = await edit({ type: 'duplicateLine', line: CC, variant: { name: 'default', origin: 'shipped' } });
    let box = inputBoxes[0];
    assert.strictEqual(inputBoxes.length, 1);
    assert.strictEqual(box.value, undefined, "a duplicate's box opens empty");
    assert.ok(box.validateInput !== undefined);
    assert.ok(box.validateInput(' ') !== undefined && box.validateInput(AGY) !== undefined && box.validateInput('First run') !== undefined);
    assert.strictEqual(box.validateInput('First run'), 'An action recipe or line is already named First run.', 'the refusal names the action recipe');
    assert.strictEqual(box.validateInput('Single task (Sonnet)'), undefined);
    assert.deepStrictEqual(stored().variants, [
      { recipe: 'Single task (Sonnet)', name: 'Single task (Sonnet)', lines: [ccLine], from: { name: 'default', origin: 'shipped', recipe: 'Single task (Claude Code)' } },
    ]);
    assert.deepStrictEqual(rows(listed).map((each) => each[0]), [CC, AGY, 'My own line', 'Single task (Sonnet)']);
    assert.deepStrictEqual(await previewNames(), [CC, AGY, 'My own line', 'Single task (Sonnet)'], "the duplicate reaches the override list under its name");

    // Rename: the box opens on the current name; the shipped line gets a stored copy of the new name in its place.
    typedValues.push('Agy line');
    listed = await edit({ type: 'renameLine', line: AGY, variant: { name: 'default', origin: 'shipped' } });
    box = inputBoxes[1];
    assert.strictEqual(box.value, AGY, 'a rename opens with the current name filled in');
    assert.ok(box.validateInput !== undefined);
    assert.strictEqual(box.validateInput(AGY), undefined, 'the current name is no other line');
    assert.ok(box.validateInput(CC) !== undefined && box.validateInput('') !== undefined);
    assert.deepStrictEqual(rows(listed), [
      [CC, 'shipped', ccLine],
      ['Agy line', 'stored', agyLine],
      ['My own line', 'own', rows(listed)[2][2]],
      ['Single task (Sonnet)', 'stored', ccLine],
    ]);
    const renamed = lineOf(listed, 'Agy line');
    assert.deepStrictEqual(renamed.reset, { recipe: AGY, original: { name: 'default', origin: 'shipped' } });
    assert.deepStrictEqual(await previewNames(), [CC, 'Agy line', 'My own line', 'Single task (Sonnet)'], 'the renamed line keeps its place');

    // A model or effort pick on the renamed line changes the stored copy in place.
    listed = await edit({ type: 'replaceLineValue', recipe: 'Agy line', variant: renamed.variants[0], line: 0, kind: 'effort', value: 'medium' });
    assert.deepStrictEqual(lineOf(listed, 'Agy line').variants.map((each) => [each.name, each.lines[0]]), [['Agy line', agyLine.replace('--effort high', '--effort medium')]]);
    assert.strictEqual(stored().variants.length, 2);

    // A pick on a shipped line's default adds custom 1 under the same line name, which the looped run passes only once it is the default.
    const fableLine = ccLine.replace('"opus"', '"fable"');
    listed = await edit({ type: 'replaceLineValue', recipe: CC, variant: { name: 'default', origin: 'shipped' }, line: 0, kind: 'model', value: 'fable' });
    assert.deepStrictEqual(lineOf(listed, CC).variants.map((each) => [each.name, each.origin, each.isDefault, each.lines[0]]), [
      ['default', 'shipped', true, ccLine],
      ['custom 1', 'stored', false, fableLine],
    ], 'the shipped default stays listed and the default, custom 1 beneath it');
    assert.deepStrictEqual(stored().variants[2], { recipe: CC, name: 'custom 1', lines: [fableLine], from: { name: 'default', origin: 'shipped' } });
    assert.ok((await loopLines()).includes(`${CC}=${ccLine}`), 'until it is made the default, the looped run passes the shipped line');

    // Make default: the looped run passes custom 1 as the line's --line, under the line's name.
    listed = await edit({ type: 'pickDefault', recipe: CC, variant: { name: 'custom 1', origin: 'stored' } });
    assert.deepStrictEqual(lineOf(listed, CC).variants.map((each) => each.isDefault), [false, true]);
    assert.deepStrictEqual(stored().defaults, [{ recipe: CC, name: 'custom 1', origin: 'stored' }]);
    assert.deepStrictEqual(await previewNames(), [CC, 'Agy line', 'My own line', 'Single task (Sonnet)'], 'the override list keeps the line name');
    assert.deepStrictEqual(await loopLines(), [
      `${CC}=${fableLine}`,
      `Agy line=${agyLine.replace('--effort high', '--effort medium')}`,
      `My own line=${rows(listed)[2][2]}`,
      `Single task (Sonnet)=${ccLine}`,
    ], "made the default, custom 1 is the line the looped run passes as the line's --line");

    // A variant of a line is renamed as any recipe's variant is, its box refusing a name the line's other variants carry, the pick following it.
    typedValues.push('Fable');
    listed = await edit({ type: 'renameVariant', recipe: CC, variant: { name: 'custom 1', origin: 'stored' } });
    box = inputBoxes[2];
    assert.strictEqual(box.value, 'custom 1');
    assert.ok(box.validateInput !== undefined && box.validateInput('default') !== undefined);
    assert.deepStrictEqual(lineOf(listed, CC).variants.map((each) => [each.name, each.isDefault]), [['default', false], ['Fable', true]]);
    assert.ok((await loopLines()).includes(`${CC}=${fableLine}`));

    // Deleting the picked variant drops the pick, the line falling back to its first variant.
    listed = await edit({ type: 'deleteVariant', recipe: CC, variant: { name: 'Fable', origin: 'stored' } });
    assert.deepStrictEqual(lineOf(listed, CC).variants.map((each) => [each.name, each.isDefault]), [['default', true]]);
    assert.deepStrictEqual(stored().defaults, []);
    assert.ok((await loopLines()).includes(`${CC}=${ccLine}`));

    // Delete: the line-level delete hides a shipped line, which stays listed with its hidden variant for its reset.
    listed = await edit({ type: 'deleteLine', line: CC, variant: lineDefault(lineOf(listed, CC)) });
    assert.deepStrictEqual(rows(listed).map((each) => each[0]), ['Agy line', 'My own line', 'Single task (Sonnet)']);
    assert.deepStrictEqual([lineOf(listed, CC).variants, lineOf(listed, CC).hidden], [[], [{ name: 'default', origin: 'shipped' }]]);
    assert.deepStrictEqual(await previewNames(), ['Agy line', 'My own line', 'Single task (Sonnet)']);
    listed = await edit({ type: 'deleteLine', line: 'My own line', variant: { name: 'default', origin: 'own' } });
    assert.deepStrictEqual(stored().hidden, [{ recipe: CC, name: 'default', origin: 'shipped' }, { recipe: 'My own line', name: 'default', origin: 'own' }]);

    // Reset: the deleted and renamed lines show again as their files hold them.
    await edit({ type: 'resetLine', line: CC, original: { name: 'default', origin: 'shipped' } });
    await edit({ type: 'resetLine', line: 'My own line', original: { name: 'default', origin: 'own' } });
    listed = await edit({ type: 'resetLine', line: AGY, original: { name: 'default', origin: 'shipped' } });
    assert.deepStrictEqual(rows(listed).map((each) => [each[0], each[1]]), [
      [CC, 'shipped'],
      [AGY, 'shipped'],
      ['My own line', 'own'],
      ['Single task (Sonnet)', 'stored'],
    ]);
    assert.deepStrictEqual(listed.lines.map((each) => each.hidden), [[], [], [], []]);

    // The looped run passes every named line, the stored one included, as one --line.
    assert.deepStrictEqual(await previewNames(), [CC, AGY, 'My own line', 'Single task (Sonnet)']);
    assert.deepStrictEqual(await loopLines(), [`${CC}=${ccLine}`, `${AGY}=${agyLine}`, `My own line=${rows(listed)[2][2]}`, `Single task (Sonnet)=${ccLine}`]);

    // A dismissed box, a line the list does not hold, a chain named as a line, or a message not in form writes and posts nothing.
    const before = fs.readFileSync(store, 'utf8');
    const boxes = inputBoxes.length;
    from = posted.length;
    send({ type: 'renameLine', line: CC, variant: { name: 'default', origin: 'shipped' } });
    send({ type: 'duplicateLine', line: 'No such line', variant: { name: 'No such line', origin: 'shipped' } });
    send({ type: 'deleteLine', line: 'First run', variant: { name: 'Claude Code', origin: 'shipped' } });
    send({ type: 'deleteLine', line: CC });
    send({ type: 'resetLine', line: CC, original: { name: 'default', origin: 'shipped' } });
    send({ type: 'resetLine', line: CC, original: { name: 'default', origin: 'elsewhere' } });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.strictEqual(inputBoxes.length, boxes + 1, 'only the rename of a listed line asks for a name');
    assert.deepStrictEqual(posted.slice(from), []);
    assert.strictEqual(fs.readFileSync(store, 'utf8'), before);

    assert.strictEqual(fs.readFileSync(path.join(files, 'recipes.md'), 'utf8'), LINE_OWN_TEXT, 'the own recipe file is never written');
    assert.strictEqual(fs.readFileSync(path.join(files, 'shipped_recipes.md'), 'utf8'), HARNESS_SHIPPED_TEXT, 'the shipped file is never written');
    assert.strictEqual(execFileSync('git', ['status', '--porcelain', '--ignored'], { cwd: root, encoding: 'utf8' }), '', "nothing is written into the project's tree");
  } finally {
    process.env.HOME = home;
  }
});

/** A mission no earlier test holds a run for. */
const MU = 'pkg/mission_mu/';

/** The lines of the seven fixed-name button recipes in the fixed-button test's shipped file, by button. */
const BUTTON_LINES: Record<string, string> = {
  discussQuestion: 'claude "/gurita:discuss-open-question --mission <path> <Short Title>. <note>" --model "fable" --effort xhigh; # interactive',
  answerQuestion: 'claude -p "/gurita:answer-open-question --mission <path> <Short Title>. <answer text>" --model "fable" --effort high;',
  answerWithAlternative: 'claude -p "/gurita:answer-open-question-with-alternative --mission <path> <Short Title>. <Alternative Id>" --model "fable" --effort medium;',
  discussGoal: 'claude "/gurita:discuss-mission-goal <goal>" --model "fable" --effort xhigh; # interactive',
  defineMission: 'claude -p "/gurita:define-mission-goal --at <scope> <goal>" --model "sonnet" --effort medium;',
  discussTask: 'claude "/gurita:discuss-new-task --mission <path> <issue description>" --model "opus" --effort xhigh; # interactive',
  askMission: 'claude "/gurita:ask-in-mission-context --mission <path> <question>" --model "fable" --effort high; # interactive',
};

/** The fixed name of the recipe each button runs. */
const BUTTON_NAMES: Record<string, string> = {
  discussQuestion: 'discuss-open-question',
  answerQuestion: 'answer-open-question',
  answerWithAlternative: 'answer-open-question-with-alternative',
  discussGoal: 'discuss-mission-goal',
  defineMission: 'define-mission-goal',
  discussTask: 'discuss-new-task',
  askMission: 'ask-in-mission-context',
};

/** The shipped file of the fixed-button test: the recipe-list test's recipes and the seven button recipes. */
const BUTTON_SHIPPED_TEXT = `${SHIPPED_TEXT}${Object.keys(BUTTON_LINES)
  .map((key) => `\n### ${BUTTON_NAMES[key]}\n\`\`\`\n${BUTTON_LINES[key]}\n\`\`\`\n`)
  .join('')}`;

/**
 * The own file of the fixed-button test: one more variant for four of the button recipes, and a
 * recipe under the removed button name `answer-open-question-with-recommendation`, which no button runs.
 */
const BUTTON_OWN_TEXT = `### discuss-open-question
\`\`\`
agy -i "/gurita:discuss-open-question --mission <path> <Short Title>. <note>" --model "gemini-4-argon" --effort medium; # interactive
claude -p "/gurita:recommend-all-open-questions --mission <path>" --model "opus" --effort high;
\`\`\`

### define-mission-goal
\`\`\`
echo <goal> <scope>
\`\`\`

### discuss-new-task
\`\`\`
claude -p "/gurita:complete-task --mission <path> <Task Title>" --model "opus" --effort high;
\`\`\`

### ask-in-mission-context
#### Sonnet
\`\`\`
claude "/gurita:ask-in-mission-context --mission <path> <question>" --model "sonnet" --effort medium; # interactive
\`\`\`

### answer-open-question-with-recommendation
\`\`\`
claude -p "/gurita:answer-open-question-with-recommendation --mission <path> <Short Title>" --model "opus" --effort high;
\`\`\`
`;

/** What a fixed-name button is posted as running: the variants its dropdown offers, the one selected, and that variant's lines. */
type PostedButton =
  | {
      state: 'offered';
      lines: string[];
      variants: { name: string; own: boolean }[];
      selected: number;
    }
  | { state: 'disabled'; cause: string };

/** The fixed-name buttons a page message posts for its mission's page. */
function postedButtons(message: Record<string, unknown>): Record<string, PostedButton> {
  assert.strictEqual(message.type, 'page');
  return { ...(message.mission as { buttons: Record<string, PostedButton> }).buttons };
}

test("every fixed-name button on a mission's page is posted with the variants it can run and the lines of the one selected, following a default picked in the settings view", async () => {
  const home = process.env.HOME;
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-home-'));
  process.env.HOME = fakeHome;
  try {
    const root = project(MU);
    const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-recipes-'));
    fs.writeFileSync(path.join(files, 'shipped_recipes.md'), BUTTON_SHIPPED_TEXT);
    fs.writeFileSync(path.join(files, 'recipes.md'), BUTTON_OWN_TEXT);
    packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
    packaged.set('bundled/shipped_recipes.md', path.join(files, 'shipped_recipes.md'));
    packaged.set('runner.py', path.join(__dirname, '..', '..', 'runner.py'));
    workspace.folders = [{ uri: { fsPath: root } }];
    workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
    workspaceState.clear();
    /** Sends `message` and returns the buttons of the next page message the window of MU is posted after it. */
    const buttonsAfter = async (message: unknown) => {
      const from = openWindow(MU).posts.length;
      send(message);
      return postedButtons(await windowPosted(MU, 'page', from));
    };
    const shipped = (key: string, own?: string): PostedButton => ({
      state: 'offered',
      lines: [BUTTON_LINES[key]],
      variants: own !== undefined ? [{ name: 'default', own: false }, { name: own, own: true }] : [{ name: 'default', own: false }],
      selected: 0,
    });
    const initial: Record<string, PostedButton> = {
      discussQuestion: shipped('discussQuestion', 'default'),
      answerQuestion: shipped('answerQuestion'),
      discussTask: shipped('discussTask'),
      askMission: shipped('askMission', 'Sonnet'),
    };

    const first = await buttonsAfter({ type: 'refresh' });
    assert.deepStrictEqual(
      first,
      initial,
      'with no pick each button stands on its first listed variant, the shipped one, an own variant the button cannot run left out of its dropdown, the answer-with-alternative buttons posted per alternative instead',
    );
    const card = Object.keys(first).filter((key) => key !== 'discussTask' && key !== 'askMission');
    assert.deepStrictEqual(card, ['discussQuestion', 'answerQuestion'], "the card's two head buttons, and no answer-with-recommendation button even with a recipe of its old name standing");
    showSettings();

    // A pick of a two-line own variant: the button stands on it, carrying both lines.
    let buttons = await buttonsAfter({ type: 'pickDefault', recipe: 'discuss-open-question', variant: { name: 'default', origin: 'own' } });
    assert.deepStrictEqual(buttons.discussQuestion, {
      ...(initial.discussQuestion as object),
      lines: BUTTON_OWN_TEXT.split('\n').slice(2, 4),
      selected: 1,
    });
    assert.deepStrictEqual({ ...buttons, discussQuestion: undefined }, { ...initial, discussQuestion: undefined }, 'the other buttons stay as they were');

    // A pick of a variant the button cannot run: it stays out of the dropdown, which stands on the first variant offered.
    buttons = await buttonsAfter({ type: 'pickDefault', recipe: 'discuss-new-task', variant: { name: 'default', origin: 'own' } });
    assert.deepStrictEqual(buttons.discussTask, initial.discussTask);
    assert.deepStrictEqual(buttons.discussQuestion.state === 'offered' && buttons.discussQuestion.selected, 1, 'every earlier pick still stands');

    // Disabling a harness leaves its variants out of the buttons' dropdowns, the default giving way to the first offered.
    buttons = await buttonsAfter({ type: 'setHarnessEnabled', harness: 'antigravity', enabled: false });
    assert.deepStrictEqual(buttons.discussQuestion, shipped('discussQuestion'));
    buttons = await buttonsAfter({ type: 'setHarnessEnabled', harness: 'antigravity', enabled: true });
    assert.deepStrictEqual(buttons.discussQuestion.state === 'offered' && buttons.discussQuestion.selected, 1, 'enabled again, the default comes back');

    // The failure state is posted with no button, an edit made while it stands posts it again, and the next read draws the buttons again.
    workspace.folders = undefined;
    let from = openWindow(MU).posts.length;
    send({ type: 'refresh' });
    assert.deepStrictEqual(await windowPosted(MU, 'liveFailure', from), { type: 'liveFailure', cause: 'No folder is open in this window.' });
    from = openWindow(MU).posts.length;
    send({ type: 'pickDefault', recipe: 'define-mission-goal', variant: { name: 'default', origin: 'own' } });
    assert.deepStrictEqual(await windowPosted(MU, 'liveFailure', from), { type: 'liveFailure', cause: 'No folder is open in this window.' }, 'an edit posts the failure state again');
    workspace.folders = [{ uri: { fsPath: root } }];
    buttons = await buttonsAfter({ type: 'refresh' });
    assert.deepStrictEqual(buttons.discussTask, initial.discussTask);

    // A click runs the variant the label shows.
    const count = created.length;
    typedValues.push('An issue');
    send({ type: 'taskButton', mission: MU, variant: 'default' });
    for (let attempt = 0; attempt < 200 && created.length === count; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.strictEqual(created.length, count + 1);
    assert.match(created[created.length - 1].args.join(' '), / chain --close-when-finished -- claude "\/gurita:discuss-new-task/);
    assert.strictEqual(execFileSync('git', ['status', '--porcelain', '--ignored'], { cwd: root, encoding: 'utf8' }), '', "nothing is written into the project's tree");
  } finally {
    process.env.HOME = home;
  }
});

/** Missions no earlier test holds a run for, each starting at most one run in the Ask in mission context test. */
const TAU = 'pkg/mission_tau/';
const KOPPA = 'mission_koppa/';

test('the Ask in mission context button asks for a required question, refusing an empty one, and starts the variant its dropdown stands on with the question as GURITA_QUESTION', async () => {
  const home = process.env.HOME;
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-home-'));
  process.env.HOME = fakeHome;
  try {
    const root = project(TAU, KOPPA);
    const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-recipes-'));
    fs.writeFileSync(path.join(files, 'shipped_recipes.md'), BUTTON_SHIPPED_TEXT);
    fs.writeFileSync(path.join(files, 'recipes.md'), BUTTON_OWN_TEXT);
    packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
    packaged.set('bundled/shipped_recipes.md', path.join(files, 'shipped_recipes.md'));
    packaged.set('runner.py', path.join(__dirname, '..', '..', 'runner.py'));
    workspace.folders = [{ uri: { fsPath: root } }];
    workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
    workspaceState.clear();
    /** Sends `message` and returns the Ask in mission context entry of the next page message the window of `mission` is posted after it. */
    const askAfter = async (message: unknown, mission: string) => {
      const from = openWindow(mission).posts.length;
      send(message);
      return postedButtons(await windowPosted(mission, 'page', from)).askMission;
    };
    /** Sends an Ask click on the page of `mission` with `values` queued for its input boxes, and returns the terminal it starts, or none, and the boxes it showed. */
    const click = async (mission: string, variant: unknown, values: string[]) => {
      const count = created.length;
      const boxes = inputBoxes.length;
      typedValues.length = 0;
      typedValues.push(...values);
      send({ type: 'askButton', mission, variant });
      for (let attempt = 0; attempt < 50 && created.length === count; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      typedValues.length = 0;
      return { terminal: created.length === count ? undefined : created[created.length - 1], boxes: inputBoxes.slice(boxes) };
    };
    openWindow(KOPPA);

    let entry = await askAfter({ type: 'refresh' }, TAU);
    assert.deepStrictEqual(
      entry,
      {
        state: 'offered',
        lines: [BUTTON_LINES.askMission],
        variants: [{ name: 'default', own: false }, { name: 'Sonnet', own: true }],
        selected: 0,
      },
      'the button is posted with its dropdown offering the shipped and the own variant, standing on the shipped default',
    );

    // The Settings window lists its recipe as a fixed-name button recipe.
    const from = posted.length;
    showSettings();
    const listed = variantRows(await postedVariants(from)).find(([name]) => name === 'ask-in-mission-context');
    assert.deepStrictEqual(listed, ['ask-in-mission-context', true, ['default (shipped) *', 'Sonnet (own)'], []]);
    close(settingsWindow.SETTINGS_VIEW_TYPE);

    // A question box dismissed with Escape starts nothing.
    let run = await click(TAU, 'default', []);
    assert.strictEqual(run.boxes.length, 1, 'one input box asks for the question');
    assert.strictEqual(run.terminal, undefined, 'a dismissed box starts nothing');

    // A click asks for the question in one input box, which refuses an empty entry, and runs the line with the question as its session variable.
    run = await click(TAU, 'default', ['Why is the pane split in two?']);
    assert.strictEqual(run.boxes.length, 1, 'one input box asks for the question');
    const box = run.boxes[0];
    assert.strictEqual(box.prompt, 'The question, answered in the context of this mission');
    assert.ok(box.validateInput !== undefined);
    assert.strictEqual(box.validateInput(''), 'Type a value, or press Escape to start nothing.', 'an empty question is refused');
    assert.strictEqual(box.validateInput('   '), 'Type a value, or press Escape to start nothing.', 'and so is a blank one');
    assert.strictEqual(box.validateInput('Why?'), undefined);
    assert.ok(run.terminal !== undefined, 'the click starts a run');
    assert.ok(
      run.terminal.args.join(' ').includes(' chain --close-when-finished -- claude "/gurita:ask-in-mission-context --mission ${GURITA_PATH} ${GURITA_QUESTION}" --model "fable" --effort high; # interactive'),
      `the run's line is the interactive line of the variant selected, its placeholders written as session variables: ${run.terminal.args.join(' ')}`,
    );
    assert.strictEqual(run.terminal.env?.GURITA_PATH, TAU);
    assert.strictEqual(run.terminal.env?.GURITA_QUESTION, 'Why is the pane split in two?', 'the question reaches the line only as GURITA_QUESTION');

    // The dropdown's selection is remembered for the button on its mission alone, and a click then runs that variant.
    entry = await askAfter({ type: 'selectButtonVariant', button: 'askMission', mission: KOPPA, variant: 'Sonnet' }, KOPPA);
    assert.ok(entry.state === 'offered');
    assert.strictEqual(entry.selected, 1);
    assert.deepStrictEqual(entry.lines, [BUTTON_OWN_TEXT.split('\n').find((line) => line.startsWith('claude "/gurita:ask-in-mission-context'))]);
    assert.deepStrictEqual(workspaceState.get('gurita.variantSelections'), { [KOPPA]: { 'ask-in-mission-context': 'Sonnet' } });
    run = await click(KOPPA, 'default', ['Why?']);
    assert.strictEqual(run.terminal, undefined, 'a variant the button was not posted standing on starts nothing');
    assert.strictEqual(run.boxes.length, 0, 'nor asks for the question');
    run = await click(KOPPA, 'Sonnet', ['Why?']);
    assert.ok(run.terminal !== undefined);
    assert.ok(
      run.terminal.args.join(' ').includes(' chain --close-when-finished -- claude "/gurita:ask-in-mission-context --mission ${GURITA_PATH} ${GURITA_QUESTION}" --model "sonnet" --effort medium; # interactive'),
      run.terminal.args.join(' '),
    );
    assert.strictEqual(run.terminal.env?.GURITA_QUESTION, 'Why?');
    assert.strictEqual(execFileSync('git', ['status', '--porcelain', '--ignored'], { cwd: root, encoding: 'utf8' }), '', "nothing is written into the project's tree");
  } finally {
    process.env.HOME = home;
  }
});

/** Missions no earlier test holds a run for, each starting at most one run in the button-selection test. */
const NU = 'pkg/mission_nu/';
const XI = 'mission_xi/';
const OMICRON = 'mission_omicron/';
const PI = 'pkg/mission_pi/';
const RHO = 'mission_rho/';

/** The open question each mission of the button-selection test holds, with two alternatives. */
const SELECTION_QUESTIONS =
  '<open-questions>\n  <open-question id="Pane Layout">\n    <question>Which layout?</question>\n' +
  '    <alternative id="keep">Keep it.</alternative>\n    <alternative id="drop">Drop it.</alternative>\n  </open-question>\n</open-questions>\n';

/** The own file of the button-selection test: a named variant for three of the button recipes and one the buttons cannot run. */
const SELECTION_OWN_TEXT = `### discuss-open-question
#### Gemini
\`\`\`
agy -i "/gurita:discuss-open-question --mission <path> <Short Title>. <note>" --model "gemini-4-argon" --effort medium; # interactive
\`\`\`

### answer-open-question-with-alternative
#### Sonnet
\`\`\`
claude -p "/gurita:answer-open-question-with-alternative --mission <path> <Short Title>. <Alternative Id>" --model "sonnet" --effort high;
\`\`\`

### discuss-mission-goal
#### Opus
\`\`\`
claude "/gurita:discuss-mission-goal <goal>" --model "opus" --effort high; # interactive
\`\`\`

### discuss-new-task
#### Looped
\`\`\`
<single-task line>
\`\`\`
`;

test("a fixed-name button's dropdown selection is remembered in workspaceState per recipe on its mission, wins over the default, and is dropped once gone", async () => {
  const home = process.env.HOME;
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-home-'));
  process.env.HOME = fakeHome;
  try {
    const missions = [NU, XI, OMICRON, PI, RHO];
    const root = project(...missions);
    for (const mission of missions) {
      fs.writeFileSync(path.join(root, mission, 'open_questions.xml'), SELECTION_QUESTIONS);
    }
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', 'Questions');
    const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-recipes-'));
    fs.writeFileSync(path.join(files, 'shipped_recipes.md'), BUTTON_SHIPPED_TEXT);
    fs.writeFileSync(path.join(files, 'recipes.md'), SELECTION_OWN_TEXT);
    packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
    packaged.set('bundled/shipped_recipes.md', path.join(files, 'shipped_recipes.md'));
    packaged.set('runner.py', path.join(__dirname, '..', '..', 'runner.py'));
    workspace.folders = [{ uri: { fsPath: root } }];
    workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
    workspaceState.clear();
    /** The page message the window of `mission` was last posted. */
    const latest = (mission: string): Record<string, unknown> => {
      const pages = openWindow(mission).posts.filter((message) => message.type === 'page');
      assert.ok(pages.length > 0, `the window of ${mission} was posted a page`);
      return pages[pages.length - 1];
    };
    /** Sends `message` and waits until the window of `mission`, NU's unless given, is posted its page again. */
    const liveAfter = async (message: unknown, mission = NU) => {
      const from = openWindow(mission).posts.length;
      send(message);
      await windowPosted(mission, 'page', from);
    };
    /** The names a button's dropdown offers and the one it stands on, as the window of `mission` was last posted it. */
    const dropdown = (mission: string, key: string): [string[], string] => {
      const entry = postedButtons(latest(mission))[key];
      assert.ok(entry.state === 'offered', `${key} offers variants`);
      return [entry.variants.map((each) => each.name), entry.variants[entry.selected].name];
    };
    /** The names the answer-with-alternative button of `alternative` on the card of `question` offers and the one it stands on, as the window of `mission` was last posted it. */
    const alternativeDropdown = (mission: string, question: string, alternative: string): [string[], string] => {
      const page = latest(mission).mission as { alternativeButtons: { question: string; alternative: string; entry: PostedButton }[] };
      const entry = page.alternativeButtons.find((each) => each.question === question && each.alternative === alternative)?.entry;
      assert.ok(entry?.state === 'offered', `${alternative} of ${question} offers variants`);
      return [entry.variants.map((each) => each.name), entry.variants[entry.selected].name];
    };
    /** Sends a button's click and returns the runner's arguments of the terminal it starts, or undefined when it starts none. */
    const click = async (message: unknown, values: string[] = []) => {
      const count = created.length;
      typedValues.length = 0;
      typedValues.push(...values);
      send(message);
      for (let attempt = 0; attempt < 30 && created.length === count; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      typedValues.length = 0;
      return created.length === count ? undefined : created[created.length - 1].args.join(' ');
    };

    for (const mission of missions) {
      openWindow(mission);
    }
    await liveAfter({ type: 'refresh' });
    assert.deepStrictEqual(dropdown(NU, 'discussQuestion'), [['default', 'Gemini'], 'default'], 'with nothing remembered the dropdown stands on the default');
    assert.deepStrictEqual(alternativeDropdown(NU, 'Pane Layout', 'keep'), [['default', 'Sonnet'], 'default']);
    assert.deepStrictEqual(alternativeDropdown(NU, 'Pane Layout', 'drop'), [['default', 'Sonnet'], 'default']);
    assert.strictEqual(postedButtons(latest(NU)).answerWithAlternative, undefined, 'no one entry is posted for every alternative of the page');
    assert.strictEqual(postedButtons(latest(NU)).discussGoal, undefined, 'no mission-starting button is posted with a page');
    assert.deepStrictEqual(dropdown(NU, 'discussTask'), [['default'], 'default'], 'a looped variant the button cannot run is not offered');

    // A selection on a mission's page is remembered per recipe on that mission, and posted to that mission's window alone.
    const others = missions.filter((mission) => mission !== NU).map((mission) => openWindow(mission).posts.length);
    await liveAfter({ type: 'selectButtonVariant', button: 'discussQuestion', mission: NU, variant: 'Gemini' });
    assert.deepStrictEqual(
      missions.filter((mission) => mission !== NU).map((mission) => openWindow(mission).posts.length),
      others,
      "no other mission's window is posted its page again",
    );
    assert.deepStrictEqual(workspaceState.get('gurita.variantSelections'), { [NU]: { 'discuss-open-question': 'Gemini' } });
    assert.deepStrictEqual(dropdown(NU, 'discussQuestion'), [['default', 'Gemini'], 'Gemini'], 'a remembered selection wins over the default');
    assert.deepStrictEqual(dropdown(XI, 'discussQuestion')[1], 'default', "another mission's page keeps its own selection");
    const entry = postedButtons(latest(NU)).discussQuestion;
    assert.ok(entry.state === 'offered');
    assert.deepStrictEqual(entry.lines, [SELECTION_OWN_TEXT.split('\n')[3]], 'the label and hover text follow the selection');
    // An answer-with-alternative button's selection is remembered per mission, question, and alternative.
    await liveAfter({ type: 'selectAlternativeVariant', mission: NU, question: 'Pane Layout', alternative: 'drop', variant: 'Sonnet' });
    assert.deepStrictEqual(workspaceState.get('gurita.alternativeVariantSelections'), { [NU]: { 'Pane Layout': { drop: 'Sonnet' } } });
    assert.deepStrictEqual(workspaceState.get('gurita.variantSelections'), { [NU]: { 'discuss-open-question': 'Gemini' } }, "the other buttons' selections are untouched");
    assert.deepStrictEqual(alternativeDropdown(NU, 'Pane Layout', 'drop')[1], 'Sonnet', "the alternative's own dropdown stands on it");
    assert.deepStrictEqual(alternativeDropdown(NU, 'Pane Layout', 'keep')[1], 'default', 'every other alternative stays where it stood');
    assert.deepStrictEqual(alternativeDropdown(XI, 'Pane Layout', 'drop')[1], 'default', "another mission's card keeps its own selection");
    const alternativeEntry = (latest(NU).mission as { alternativeButtons: { alternative: string; entry: PostedButton }[] }).alternativeButtons.find(
      (each) => each.alternative === 'drop',
    )?.entry;
    assert.ok(alternativeEntry?.state === 'offered');
    assert.deepStrictEqual(alternativeEntry.lines, [SELECTION_OWN_TEXT.split('\n')[9]], "the button's label and hover text follow its own selection");
    await liveAfter({ type: 'selectAlternativeVariant', mission: OMICRON, question: 'Pane Layout', alternative: 'drop', variant: 'Sonnet' }, OMICRON);
    await liveAfter({ type: 'selectAlternativeVariant', mission: PI, question: 'Pane Layout', alternative: 'keep', variant: 'Sonnet' }, PI);
    assert.deepStrictEqual(workspaceState.get('gurita.alternativeVariantSelections'), {
      [NU]: { 'Pane Layout': { drop: 'Sonnet' } },
      [OMICRON]: { 'Pane Layout': { drop: 'Sonnet' } },
      [PI]: { 'Pane Layout': { keep: 'Sonnet' } },
    });
    await liveAfter({ type: 'selectButtonVariant', button: 'discussQuestion', mission: RHO, variant: 'Gemini' }, RHO);
    const remembered = () => workspaceState.get('gurita.variantSelections') as Record<string, Record<string, string>>;
    assert.deepStrictEqual(remembered()[RHO], { 'discuss-open-question': 'Gemini' });
    await liveAfter({ type: 'refresh' });
    assert.deepStrictEqual(dropdown(NU, 'discussQuestion')[1], 'Gemini', 'the selection is remembered through a re-read');
    assert.deepStrictEqual(dropdown(XI, 'discussQuestion')[1], 'default');

    // A pick the latest answer did not post is remembered nowhere.
    const before = JSON.stringify([
      workspaceState.get('gurita.variantSelections'),
      workspaceState.get('gurita.projectVariantSelections'),
      workspaceState.get('gurita.alternativeVariantSelections'),
    ]);
    const from = posted.length;
    send({ type: 'selectButtonVariant', button: 'answerWithAlternative', mission: NU, variant: 'Sonnet' });
    send({ type: 'selectAlternativeVariant', mission: NU, question: 'Pane Layout', alternative: 'keep', variant: 'No such variant' });
    send({ type: 'selectAlternativeVariant', mission: NU, question: 'Pane Layout', alternative: 'no such alternative', variant: 'Sonnet' });
    send({ type: 'selectAlternativeVariant', mission: NU, question: 'No Such Question', alternative: 'keep', variant: 'Sonnet' });
    sendFrom(NU, { type: 'selectAlternativeVariant', mission: 'other/mission_zeta/', question: 'Pane Layout', alternative: 'keep', variant: 'Sonnet' });
    sendFrom(NU, { type: 'selectAlternativeVariant', mission: XI, question: 'Pane Layout', alternative: 'keep', variant: 'Sonnet' });
    send({ type: 'selectButtonVariant', button: 'discussQuestion', mission: NU, variant: 'No such variant' });
    send({ type: 'selectButtonVariant', button: 'discussTask', mission: NU, variant: 'Looped' });
    sendFrom(NU, { type: 'selectButtonVariant', button: 'discussQuestion', mission: 'other/mission_zeta/', variant: 'Gemini' });
    sendFrom(NU, { type: 'selectButtonVariant', button: 'discussQuestion', mission: XI, variant: 'Gemini' });
    send({ type: 'selectButtonVariant', button: 'noSuchButton', mission: NU, variant: 'Gemini' });
    send({ type: 'selectButtonVariant', button: 'discussGoal', mission: NU, variant: 'Opus' });
    send({ type: 'missionButton', button: 'discussGoal', mission: NU, variant: 'default' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.strictEqual(
      JSON.stringify([
        workspaceState.get('gurita.variantSelections'),
        workspaceState.get('gurita.projectVariantSelections'),
        workspaceState.get('gurita.alternativeVariantSelections'),
      ]),
      before,
    );
    assert.deepStrictEqual(posted.slice(from), [], 'nor posts the pages again');
    assert.deepStrictEqual(workspaceState.get('gurita.projectVariantSelections'), undefined, 'a page selects no mission-starting variant');

    // A click runs the variant selected, and only when the latest answer posted the button standing on it.
    assert.strictEqual(await click({ type: 'questionButton', button: 'discussQuestion', mission: NU, question: 'Pane Layout', variant: 'default' }, ['']), undefined, 'a variant the button was not posted standing on starts nothing');
    assert.strictEqual(await click({ type: 'questionButton', button: 'discussQuestion', mission: NU, question: 'Pane Layout' }, ['']), undefined, 'nor does a click naming none');
    assert.strictEqual(await click({ type: 'taskButton', mission: NU, variant: 'Looped' }, ['An issue']), undefined, 'nor one naming a variant the button does not offer');
    assert.strictEqual(
      await click({ type: 'questionButton', button: 'answerWithRecommendation', mission: NU, question: 'Pane Layout', variant: 'default' }),
      undefined,
      'a click posted for the removed answer-with-recommendation button starts nothing',
    );
    assert.match((await click({ type: 'questionButton', button: 'discussQuestion', mission: NU, question: 'Pane Layout', variant: 'Gemini' }, [''])) ?? '', / chain --close-when-finished -- agy -i "\/gurita:discuss-open-question/);
    assert.strictEqual(await click({ type: 'alternativeButton', mission: XI, question: 'Pane Layout', alternative: 'drop', variant: 'Sonnet' }), undefined, "another mission's page keeps its own selection");
    assert.match((await click({ type: 'questionButton', button: 'discussQuestion', mission: XI, question: 'Pane Layout', variant: 'default' }, [''])) ?? '', / chain --close-when-finished -- claude "\/gurita:discuss-open-question/, 'and runs it');
    assert.strictEqual(await click({ type: 'alternativeButton', mission: OMICRON, question: 'Pane Layout', alternative: 'keep', variant: 'Sonnet' }), undefined, "a pick on one alternative leaves the card's other buttons where they stood");
    assert.match((await click({ type: 'alternativeButton', mission: OMICRON, question: 'Pane Layout', alternative: 'drop', variant: 'Sonnet' })) ?? '', /--model "sonnet"/, 'each button runs the variant its own dropdown stands on');
    assert.strictEqual(await click({ type: 'alternativeButton', mission: PI, question: 'Pane Layout', alternative: 'drop', variant: 'Sonnet' }), undefined);
    assert.match((await click({ type: 'alternativeButton', mission: PI, question: 'Pane Layout', alternative: 'keep', variant: 'Sonnet' })) ?? '', /--model "sonnet"/);
    assert.strictEqual(await click({ type: 'missionButton', button: 'discussGoal', mission: NU, variant: 'default' }, ['A goal']), undefined, 'a page runs no mission-starting button');

    // A default picked in the settings view leaves every remembered selection standing.
    showSettings();
    await liveAfter({ type: 'pickDefault', recipe: 'discuss-open-question', variant: { name: 'default', origin: 'shipped' } });
    assert.deepStrictEqual(dropdown(NU, 'discussQuestion')[1], 'Gemini');

    // Disabling the harness of a remembered variant gives way to the default and keeps the selection for when it is enabled again.
    await liveAfter({ type: 'setHarnessEnabled', harness: 'antigravity', enabled: false }, RHO);
    assert.deepStrictEqual(dropdown(RHO, 'discussQuestion'), [['default'], 'default']);
    assert.deepStrictEqual(remembered()[RHO], { 'discuss-open-question': 'Gemini' }, 'the remembered selection is kept');
    assert.strictEqual(await click({ type: 'questionButton', button: 'discussQuestion', mission: RHO, question: 'Pane Layout', variant: 'Gemini' }, ['']), undefined, 'a variant left out for a disabled harness starts nothing');
    await liveAfter({ type: 'setHarnessEnabled', harness: 'antigravity', enabled: true }, RHO);
    assert.deepStrictEqual(dropdown(RHO, 'discussQuestion')[1], 'Gemini', 'enabled again, the remembered selection comes back');
    assert.match((await click({ type: 'taskButton', mission: RHO, variant: 'default' }, ['An issue'])) ?? '', / chain --close-when-finished -- claude "\/gurita:discuss-new-task/);

    // The remembered variants go from the own file: they are dropped and the buttons fall back to the default.
    fs.writeFileSync(path.join(files, 'recipes.md'), '');
    await liveAfter({ type: 'refresh' });
    assert.deepStrictEqual(dropdown(NU, 'discussQuestion'), [['default'], 'default']);
    assert.deepStrictEqual(workspaceState.get('gurita.variantSelections'), {}, 'the remembered variants are dropped');
    assert.deepStrictEqual(workspaceState.get('gurita.alternativeVariantSelections'), {});
    assert.deepStrictEqual(alternativeDropdown(NU, 'Pane Layout', 'drop'), [['default'], 'default']);

    // While the read fails, no click on a window's page starts anything and no pick is remembered.
    fs.writeFileSync(path.join(files, 'recipes.md'), SELECTION_OWN_TEXT);
    workspace.folders = undefined;
    const at = openWindow(NU).posts.length;
    send({ type: 'refresh' });
    await windowPosted(NU, 'liveFailure', at);
    assert.strictEqual(await click({ type: 'taskButton', mission: NU, variant: 'default' }, ['An issue']), undefined, 'a click against a failed read starts nothing');
    send({ type: 'selectButtonVariant', button: 'discussQuestion', mission: NU, variant: 'Gemini' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.deepStrictEqual(workspaceState.get('gurita.variantSelections'), {}, 'nor is a pick remembered');
    workspace.folders = [{ uri: { fsPath: root } }];
    assert.strictEqual(execFileSync('git', ['status', '--porcelain', '--ignored'], { cwd: root, encoding: 'utf8' }), '', "nothing is written into the project's tree");
  } finally {
    process.env.HOME = home;
  }
});

/** The shipped file the first-review-round test reads: one chain declaring each review round and derive tasks, one undeclared recipe. */
const STAGED_SHIPPED_TEXT = `# Snippets

## Recipes

### First run
Stage: first review round
\`\`\`
claude -p "/gurita:review-mission-requirements --mission <path>" --model "fable" --effort xhigh;
\`\`\`

### Approve all standing recommendations and review again
Stage: additional review round
\`\`\`
claude -p "/gurita:review-mission-requirements --mission <path>" --model "fable" --effort xhigh;
\`\`\`

### Mixed review
Stage: additional review round
\`\`\`
agy -p "/gurita:review-mission-requirements --mission <path>" --model "gemini-4-argon" --effort medium;
\`\`\`

### Prepare tasks
Stage: derive tasks
\`\`\`
claude -p "/gurita:derive-tasks --mission <path>" --model "fable" --effort xhigh;
\`\`\`
`;

const FRESH = 'pkg/mission_fresh/';
const REVIEWED = 'pkg/mission_reviewed/';

test("a page filling first review round lists the additional review round's recipes beside First run while a question is open, and First run alone for a fresh mission with none", async () => {
  const home = process.env.HOME;
  process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-home-'));
  try {
    const root = project(FRESH, REVIEWED);
    fs.writeFileSync(
      path.join(root, REVIEWED, 'open_questions.xml'),
      '<open-questions>\n  <open-question id="Pane Layout">\n    <question>Which layout?</question>\n  </open-question>\n</open-questions>\n',
    );
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', `Requirements-review: ${REVIEWED}`);
    const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-recipes-'));
    fs.writeFileSync(path.join(files, 'shipped_recipes.md'), STAGED_SHIPPED_TEXT);
    packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
    packaged.set('bundled/shipped_recipes.md', path.join(files, 'shipped_recipes.md'));
    workspace.folders = [{ uri: { fsPath: root } }];
    workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
    type Page = { path: string; step?: string; additionalRounds?: number; recipes: { state: string; recipes: { name: string }[] } };
    const from = [FRESH, REVIEWED].map((mission) => openWindow(mission).posts.length);
    send({ type: 'refresh' });
    const pages = new Map<string, Page>();
    for (const [index, mission] of [FRESH, REVIEWED].entries()) {
      pages.set(mission, (await windowPosted(mission, 'page', from[index])).mission as Page);
    }
    const page = (mission: string) => pages.get(mission);
    for (const mission of [FRESH, REVIEWED]) {
      assert.strictEqual(page(mission)?.step, 'first-review', `${mission} fills first review round`);
      assert.strictEqual(page(mission)?.additionalRounds, undefined, `${mission} carries no round count`);
    }
    assert.deepStrictEqual(page(FRESH)?.recipes.recipes.map((entry) => entry.name), ['First run'], 'a fresh mission with no open question lists First run alone');
    assert.deepStrictEqual(
      page(REVIEWED)?.recipes.recipes.map((entry) => entry.name),
      ['First run', 'Approve all standing recommendations and review again', 'Mixed review'],
      'an open question lists the additional review round beside First run',
    );
    const count = created.length;
    send({ type: 'runRecipe', mission: REVIEWED, recipe: 'Approve all standing recommendations and review again', variant: 'default' });
    send({ type: 'runRecipe', mission: FRESH, recipe: 'Approve all standing recommendations and review again', variant: 'default' });
    sendFrom(FRESH, { type: 'runRecipe', mission: REVIEWED, recipe: 'Approve all standing recommendations and review again', variant: 'default' });
    assert.deepStrictEqual(
      created.slice(count).map((terminal) => terminal.name),
      [`Gurita: Approve all standing recommendations and review again (${REVIEWED})`],
      'Approve all standing recommendations and review again runs from the page listing it, and from no other',
    );
  } finally {
    process.env.HOME = home;
  }
});

/** A mission whose task list and question document the watcher test changes. */
const OMEGA = 'pkg/mission_omega/';

test("the live read and its one watcher outlast every mission window, every debounced event re-read whatever is visible and shown in the next ready message's answer, which reads nothing afresh", async () => {
  const home = process.env.HOME;
  process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-home-'));
  try {
    const root = project(OMEGA);
    const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-recipes-'));
    fs.writeFileSync(path.join(files, 'shipped_recipes.md'), SHIPPED_TEXT);
    packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
    packaged.set('bundled/shipped_recipes.md', path.join(files, 'shipped_recipes.md'));
    workspace.folders = [{ uri: { fsPath: root } }];
    workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
    type Page = { path: string; tasks: { remaining?: { title: string; brief: string }[] }; questions: { questions?: { id: string }[] } };
    const titles = (page: Page): string[] | undefined => page.tasks.remaining?.map((each) => each.title);
    const omegaAfter = async (message: unknown): Promise<Page> => {
      const page = (await pageAfter(message, OMEGA)) as unknown as Page;
      assert.strictEqual(page.path, OMEGA);
      return page;
    };
    const fire = (kind: keyof StubWatcher['listeners'], file: string) => {
      for (const listener of documentWatcher().listeners[kind]) {
        listener({ fsPath: path.join(root, OMEGA, file) });
      }
    };
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const livePosted = (from: number) => posted.slice(from).filter((message) => ['page', 'liveFailure', 'notLive'].includes((message as { type?: string }).type ?? ''));

    assert.deepStrictEqual(titles(await omegaAfter({ type: 'refresh' })), []);
    const watcher = documentWatcher();
    const count = watchers.filter((each) => each.pattern === WATCHED_PATTERN).length;
    assert.strictEqual(watcher.disposed, false);

    // A change no event reports is not shown: a ready message is answered from the current read.
    fs.writeFileSync(path.join(root, OMEGA, 'TASKS_TODO.md'), '# TASKS TODO\n\n## First task\n\nA brief.\n\n---\n');
    assert.deepStrictEqual(titles(await omegaAfter({ type: 'ready', mission: OMEGA })), [], 'a ready message reads nothing afresh');

    // Every mission window is closed: the watcher stays, and its event is re-read with no window to post to.
    for (const mission of [...windowOf.keys()]) {
      closeWindow(mission);
    }
    assert.deepStrictEqual(pane.openMissionWindows(), [], 'no mission window is open');
    assert.strictEqual(watcher.disposed, false, "the watcher survives the windows' disposal");
    assert.deepStrictEqual(
      [watcher.listeners.create.length, watcher.listeners.change.length, watcher.listeners.delete.length],
      [1, 1, 1],
      'its listeners stay registered',
    );
    let from = posted.length;
    fire('change', 'TASKS_TODO.md');
    await wait(1500);
    assert.deepStrictEqual(livePosted(from), [], 'nothing is posted while no window is open');
    assert.deepStrictEqual(titles(await omegaAfter({ type: 'ready', mission: OMEGA })), ['First task'], "the reopened window's ready message is answered with the re-read the event caused");
    assert.strictEqual(watchers.filter((each) => each.pattern === WATCHED_PATTERN).length, count, 'reopening a window creates no second watcher');

    // The window is hidden: an event is re-read all the same, and shown by the ready message the page posts when shown.
    const shownPane = openWindow(OMEGA);
    shownPane.visible = false;
    fs.writeFileSync(
      path.join(root, OMEGA, 'open_questions.xml'),
      '<open-questions>\n  <open-question id="Pane Layout">\n    <question>Which layout?</question>\n  </open-question>\n</open-questions>\n',
    );
    from = posted.length;
    fire('change', 'open_questions.xml');
    await wait(1500);
    assert.deepStrictEqual(livePosted(from), [], 'nothing is posted to a hidden window');
    shownPane.visible = true;
    const shown = await omegaAfter({ type: 'ready', mission: OMEGA });
    assert.deepStrictEqual(shown.questions.questions?.map((each) => each.id), ['Pane Layout'], 'an event during a hidden pane shows in its next ready answer');
    assert.deepStrictEqual(shown.tasks.remaining, [{ title: 'First task', brief: 'A brief.' }]);
    assert.strictEqual(watcher.disposed, false);
  } finally {
    process.env.HOME = home;
  }
});

/** A mission whose review commits the git-state test makes outside the extension's runs. */
const GIT_STATE = 'pkg/mission_git_state/';

test("a commit made outside the extension's runs re-reads everything through the debounce, the git directory watched beside the mission documents for HEAD, packed-refs, and the branch refs only", async () => {
  const home = process.env.HOME;
  process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-home-'));
  try {
    const root = project(GIT_STATE);
    const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-recipes-'));
    fs.writeFileSync(path.join(files, 'shipped_recipes.md'), SHIPPED_TEXT);
    packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
    packaged.set('bundled/shipped_recipes.md', path.join(files, 'shipped_recipes.md'));
    workspace.folders = [{ uri: { fsPath: root } }];
    workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
    type Page = { path: string; step?: string; additionalRounds?: number };
    const first = (await pageAfter({ type: 'refresh' }, GIT_STATE)) as unknown as Page;
    assert.strictEqual(first.step, 'first-review', 'no review commit is held yet');

    const gitDir = path.join(root, '.git');
    const deadline = Date.now() + 5000;
    while (!watchers.some((each) => each.base === gitDir && !each.disposed) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const own = watchers.filter((each) => each.base === gitDir && !each.disposed);
    assert.deepStrictEqual(
      own.map((each) => each.pattern),
      [GIT_WATCHED_PATTERN],
      'one watcher over the git directory, covering HEAD, packed-refs, and the branch refs',
    );
    const gitWatcher = own[0];
    assert.deepStrictEqual(
      [gitWatcher.listeners.create.length, gitWatcher.listeners.change.length, gitWatcher.listeners.delete.length],
      [1, 1, 1],
      'it listens to every kind of event',
    );
    assert.strictEqual(documentWatcher().base, root, 'the mission documents stay watched beside it');

    const fire = (kind: keyof StubWatcher['listeners'], ...file: string[]) => {
      for (const listener of gitWatcher.listeners[kind]) {
        listener({ fsPath: path.join(gitDir, ...file) });
      }
    };
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const window = openWindow(GIT_STATE);
    const pagesFrom = (from: number) => window.posts.slice(from).filter((message) => message.type === 'page');

    // A review commit made by hand: no mission document changes, only git state.
    git(root, 'commit', '-q', '--allow-empty', '-m', `Requirements-review: ${GIT_STATE}`);
    let from = window.posts.length;
    fire('create', 'refs', 'heads', 'main.lock');
    fire('change', 'index');
    fire('change', 'refs', 'remotes', 'origin', 'main');
    fire('create', 'objects', 'ab', 'cdef');
    await wait(1000);
    assert.deepStrictEqual(pagesFrom(from), [], 'a lock file, the index, a remote ref, or an object re-reads nothing');

    fire('change', 'refs', 'heads', 'main');
    fire('change', 'HEAD');
    fire('change', 'packed-refs');
    const posted = await windowPosted(GIT_STATE, 'page', from);
    assert.strictEqual((posted.mission as Page).step, 'derive', 'the burst re-reads the review count, so the next step moves on');
    await wait(1000);
    assert.strictEqual(pagesFrom(from).length, 1, 'the burst is debounced into one re-read');

    // Two more by hand: the full re-read counts them as additional rounds.
    git(root, 'commit', '-q', '--allow-empty', '-m', `Requirements-review: ${GIT_STATE}`);
    git(root, 'commit', '-q', '--allow-empty', '-m', `Requirements-review: ${GIT_STATE}`);
    from = window.posts.length;
    fire('delete', 'HEAD');
    const again = await windowPosted(GIT_STATE, 'page', from);
    assert.strictEqual((again.mission as Page).additionalRounds, 2, 'the review-round count is read afresh');
  } finally {
    process.env.HOME = home;
  }
});

/** Two missions in one scope, whose notices of what would stop a run the stops test reads. */
const STOP_HOLDER = 'pkg/mission_stop_holder/';
const STOP_WAITER = 'pkg/mission_stop_waiter/';

test("a mission's page is posted what would stop a run of it, read afresh with its other facts on every re-read: its mission files' changes on a document event, the scope gate on a commit", async () => {
  const home = process.env.HOME;
  process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-home-'));
  try {
    const root = project(STOP_HOLDER, STOP_WAITER);
    const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-recipes-'));
    fs.writeFileSync(path.join(files, 'shipped_recipes.md'), SHIPPED_TEXT);
    packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
    packaged.set('bundled/shipped_recipes.md', path.join(files, 'shipped_recipes.md'));
    workspace.folders = [{ uri: { fsPath: root } }];
    workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
    type Page = { path: string; stops?: unknown };
    const first = (await pageAfter({ type: 'refresh' }, STOP_WAITER)) as unknown as Page;
    assert.deepStrictEqual(first.stops, { gate: { state: 'free' }, changes: [] }, 'nothing would stop a run of a fresh mission');

    const gitDir = path.join(root, '.git');
    const deadline = Date.now() + 5000;
    while (!watchers.some((each) => each.base === gitDir && !each.disposed) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const gitWatcher = watchers.filter((each) => each.base === gitDir && !each.disposed)[0];
    assert.ok(gitWatcher !== undefined, 'the git state is watched');
    const window = openWindow(STOP_WAITER);

    // A hand edit of the waiting mission's requirements: the document event re-reads its changes.
    fs.writeFileSync(path.join(root, STOP_WAITER, 'requirements.md'), '# A mission\n\n## Goal\n\nAn edited goal.\n');
    let from = window.posts.length;
    for (const listener of documentWatcher().listeners.change) {
      listener({ fsPath: path.join(root, STOP_WAITER, 'requirements.md') });
    }
    const dirty = (await windowPosted(STOP_WAITER, 'page', from)).mission as Page;
    assert.deepStrictEqual(dirty.stops, { gate: { state: 'free' }, changes: [` M ${STOP_WAITER}requirements.md`] }, 'the uncommitted change is read with the documents');

    // The edit committed and the sibling started by hand: the commit's full re-read reads the gate held and the files clean.
    git(root, 'add', `${STOP_WAITER}requirements.md`);
    git(root, 'commit', '-q', '-m', 'Goal-revision: by hand');
    fs.writeFileSync(path.join(root, STOP_HOLDER, 'TASKS_TODO.md'), '# TASKS TODO\n\n## A task\n\nA brief.\n\n---\n');
    git(root, 'add', `${STOP_HOLDER}TASKS_TODO.md`);
    git(root, 'commit', '-q', '-m', `Task-derivation: ${STOP_HOLDER}`);
    from = window.posts.length;
    for (const listener of gitWatcher.listeners.change) {
      listener({ fsPath: path.join(gitDir, 'HEAD') });
    }
    const held = (await windowPosted(STOP_WAITER, 'page', from)).mission as Page;
    assert.deepStrictEqual(held.stops, { gate: { state: 'held', holders: [STOP_HOLDER] }, changes: [] }, 'the started sibling holds the scope and the committed files hold no change');
    const holder = (await pageAfter({ type: 'ready', mission: STOP_HOLDER }, STOP_HOLDER)) as unknown as Page;
    assert.deepStrictEqual(holder.stops, { gate: { state: 'free' }, changes: [] }, 'the holder itself is not held by a defined sibling');
  } finally {
    process.env.HOME = home;
  }
});

/** The mission whose completed tasks the completed-tasks test reads. */
const DONE_MISSION = 'pkg/mission_done/';

/** The mission whose completed task's commit link the commit-link test clicks. */
const LINKED_MISSION = 'pkg/mission_linked/';

test("a mission's page is posted its completed tasks, each with its verified bar, as the missions tool's tasks --with-body prints them, read afresh on a commit", async () => {
  const home = process.env.HOME;
  process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-home-'));
  try {
    const root = project(DONE_MISSION);
    const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-recipes-'));
    fs.writeFileSync(path.join(files, 'shipped_recipes.md'), SHIPPED_TEXT);
    packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
    packaged.set('bundled/shipped_recipes.md', path.join(files, 'shipped_recipes.md'));
    workspace.folders = [{ uri: { fsPath: root } }];
    workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
    fs.writeFileSync(path.join(root, DONE_MISSION, 'TASKS_TODO.md'), '# TASKS TODO\n\n## A task\n\nA brief.\n\n---\n');
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', `Task-derivation: ${DONE_MISSION}`);
    type Page = { path: string; completed?: { state: string; tasks?: { hash: string; date: string; mission: string; title: string; bar: string }[] } };
    const first = (await pageAfter({ type: 'refresh' }, DONE_MISSION)) as unknown as Page;
    assert.deepStrictEqual(first.completed, { state: 'read', tasks: [] }, 'no task of a fresh mission is completed');

    const gitDir = path.join(root, '.git');
    const deadline = Date.now() + 5000;
    while (!watchers.some((each) => each.base === gitDir && !each.disposed) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const gitWatcher = watchers.filter((each) => each.base === gitDir && !each.disposed)[0];
    assert.ok(gitWatcher !== undefined, 'the git state is watched');
    const window = openWindow(DONE_MISSION);

    // The task completed and committed with its bar as the body: the commit's re-read posts it completed.
    fs.writeFileSync(path.join(root, DONE_MISSION, 'TASKS_TODO.md'), '# TASKS TODO\n');
    git(root, 'add', `${DONE_MISSION}TASKS_TODO.md`);
    git(root, 'commit', '-q', '-m', 'Task-completion: A task\n\n- The `first` criterion\n- Another criterion');
    const from = window.posts.length;
    for (const listener of gitWatcher.listeners.change) {
      listener({ fsPath: path.join(gitDir, 'HEAD') });
    }
    const done = (await windowPosted(DONE_MISSION, 'page', from)).mission as Page;
    assert.strictEqual(done.completed?.state, 'read');
    assert.deepStrictEqual(
      done.completed?.tasks?.map(({ mission, title, bar }) => ({ mission, title, bar })),
      [{ mission: DONE_MISSION, title: 'A task', bar: '- The `first` criterion\n- Another criterion' }],
    );
    assert.match(done.completed?.tasks?.[0].hash ?? '', /^[0-9a-f]{7,}$/, "the commit's hash is posted with it");
  } finally {
    process.env.HOME = home;
  }
});

test("a click on a completed task's commit link opens that commit, as the extension's commit documents serve it, with the diff language in an editor tab, while a hash the page was not posted opens nothing", async () => {
  const home = process.env.HOME;
  process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-home-'));
  try {
    const root = project(LINKED_MISSION);
    const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-recipes-'));
    fs.writeFileSync(path.join(files, 'shipped_recipes.md'), SHIPPED_TEXT);
    packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
    packaged.set('bundled/shipped_recipes.md', path.join(files, 'shipped_recipes.md'));
    workspace.folders = [{ uri: { fsPath: root } }];
    workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
    fs.writeFileSync(path.join(root, LINKED_MISSION, 'TASKS_TODO.md'), '# TASKS TODO\n\n## A task\n\nA brief.\n\n---\n');
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', `Task-derivation: ${LINKED_MISSION}`);
    fs.writeFileSync(path.join(root, LINKED_MISSION, 'TASKS_TODO.md'), '# TASKS TODO\n');
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', 'Task-completion: A task\n\n- The criterion');
    type Page = { completed?: { state: string; tasks?: { hash: string }[] } };
    const page = (await pageAfter({ type: 'refresh' }, LINKED_MISSION)) as unknown as Page;
    const hash = page.completed?.tasks?.[0]?.hash;
    assert.ok(hash !== undefined, 'the completed task is posted with its hash');

    shownDocuments.length = 0;
    sendFrom(LINKED_MISSION, { type: 'openCommit', mission: LINKED_MISSION, hash: 'abcdef0' });
    sendFrom(LINKED_MISSION, { type: 'openCommit', mission: 'pkg/mission_other/', hash });
    sendFrom(LINKED_MISSION, { type: 'openCommit', mission: LINKED_MISSION, hash: ['abc'] });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.strictEqual(shownDocuments.length, 0, 'a hash not posted, or another mission, opens nothing');

    sendFrom(LINKED_MISSION, { type: 'openCommit', mission: LINKED_MISSION, hash });
    for (let attempt = 0; attempt < 200 && shownDocuments.length === 0; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.strictEqual(shownDocuments.length, 1, 'the commit opens in one editor tab');
    const [{ document, options }] = shownDocuments;
    assert.deepStrictEqual(document, { uri: { scheme: 'gurita-commit', path: `/${hash}.diff`, query: root }, languageId: 'diff' });
    assert.deepStrictEqual(options, { preview: false });
    const commitDocuments = require('../commitDocuments') as typeof import('../commitDocuments');
    const content = await commitDocuments.commitContent(document.uri);
    assert.strictEqual(
      content,
      execFileSync('git', ['show', hash], { cwd: root, encoding: 'utf8' }),
      "the document the link opens holds the commit as git show prints it",
    );
    assert.match(content, /^-## A task$/m, 'the brief among its removed lines');
    assert.match(content, /^    - The criterion$/m, 'the verified bar as its body');
  } finally {
    process.env.HOME = home;
  }
});

/** Missions no earlier test holds a run for, each starting at most one run in the input panel test. */
const ANSWERED = 'pkg/mission_answered/';
const ISSUED = 'mission_issued/';
const NOTED = 'pkg/mission_noted/';
const BY_HAND = 'mission_by_hand/';

test('the answer text, the goal, and the issue description are asked for in one input panel, an editor tab resolving on Run and starting nothing when cancelled or closed, while the scope and the note stay in input boxes', async () => {
  const home = process.env.HOME;
  process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-home-'));
  try {
    const missions = [ANSWERED, ISSUED, NOTED, BY_HAND];
    const root = project(...missions);
    for (const mission of missions) {
      fs.writeFileSync(path.join(root, mission, 'open_questions.xml'), SELECTION_QUESTIONS);
    }
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', 'Questions');
    const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-recipes-'));
    fs.writeFileSync(path.join(files, 'shipped_recipes.md'), BUTTON_SHIPPED_TEXT);
    packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
    packaged.set('bundled/shipped_recipes.md', path.join(files, 'shipped_recipes.md'));
    packaged.set('runner.py', path.join(__dirname, '..', '..', 'runner.py'));
    workspace.folders = [{ uri: { fsPath: root } }];
    workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
    workspaceState.clear();
    for (const mission of missions) {
      openWindow(mission);
    }
    await pageAfter({ type: 'refresh' }, ANSWERED);
    pane.startingOffers(context);

    /** The input panels the extension created beyond its first `from`. */
    const inputPanelsFrom = (from: number) => panels.slice(from).filter((each) => each.viewType === INPUT_VIEW_TYPE);
    /**
     * Starts `click` with `values` queued for its panels and boxes, and returns the terminal it
     * starts, or none, and the panels and boxes it opened, the panels as the stub's editor answered them.
     */
    const ask = async (click: () => void, values: string[]) => {
      const count = created.length;
      const panelCount = panels.length;
      const answeredCount = inputPanels.length;
      const boxCount = inputBoxes.length;
      typedValues.length = 0;
      typedValues.push(...values);
      click();
      for (let attempt = 0; attempt < 40 && created.length === count; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      typedValues.length = 0;
      return {
        terminal: created.length === count ? undefined : created[created.length - 1],
        panels: inputPanelsFrom(panelCount),
        answered: inputPanels.slice(answeredCount),
        boxes: inputBoxes.slice(boxCount).map((box) => box.prompt),
      };
    };
    const answer = () => send({ type: 'questionButton', button: 'answerQuestion', mission: ANSWERED, question: 'Pane Layout', variant: 'default' });

    // The answer text: a panel cancelled, then one closed, starts nothing; one Run resolves the text, line breaks included.
    let run = await ask(answer, [CANCEL_PANEL]);
    assert.deepStrictEqual(run.answered, [{ title: 'Gurita: Answer', prompt: 'The answer, recorded as the decision' }], 'one panel asks for the answer text, its page posted the prompt');
    assert.deepStrictEqual(run.boxes, [], 'and no input box');
    assert.strictEqual(run.terminal, undefined, 'a panel cancelled starts nothing');
    assert.strictEqual(run.panels[0].dispose, undefined, 'and is closed');
    assert.match(run.panels[0].html, /<script [^>]*input\.js/, "the panel loads the input page's script");
    assert.doesNotMatch(run.panels[0].html, /page\.js|settings\.js/, 'and no other');
    run = await ask(answer, []);
    assert.strictEqual(run.panels.length, 1);
    assert.strictEqual(run.terminal, undefined, 'a panel whose tab is closed starts nothing');
    run = await ask(answer, ['Keep the layout.\n\nIt reads well.']);
    assert.ok(run.terminal !== undefined, 'Run starts the run');
    assert.strictEqual(run.panels[0].dispose, undefined, 'and closes the panel');
    assert.strictEqual(run.terminal.env?.GURITA_ANSWER_TEXT, 'Keep the layout.\n\nIt reads well.', 'the text reaches the line as typed, as its session variable');
    assert.ok(run.terminal.args.join(' ').includes('answer-open-question --mission ${GURITA_PATH} ${GURITA_SHORT_TITLE}. ${GURITA_ANSWER_TEXT}"'));

    // The issue description: cancelled, closed, and resolved.
    const issue = () => send({ type: 'taskButton', mission: ISSUED, variant: 'default' });
    run = await ask(issue, [CANCEL_PANEL]);
    assert.deepStrictEqual(run.answered, [{ title: 'Gurita: Issue', prompt: 'The issue, to be clarified into tasks for this mission' }]);
    assert.strictEqual(run.terminal, undefined);
    run = await ask(issue, []);
    assert.strictEqual(run.terminal, undefined);
    run = await ask(issue, ['The pane jumps.\nIt should not.']);
    assert.deepStrictEqual(run.boxes, []);
    assert.strictEqual(run.terminal?.env?.GURITA_ISSUE_DESCRIPTION, 'The pane jumps.\nIt should not.');

    // The goal, on New mission alone and on Define mission ahead of the scope, which stays in an input box.
    const newMission = () => void pane.runStartingRow(context, 'discussGoal');
    run = await ask(newMission, [CANCEL_PANEL]);
    assert.deepStrictEqual(run.answered, [{ title: 'Gurita: Goal', prompt: "The mission's goal" }]);
    assert.strictEqual(run.terminal, undefined);
    run = await ask(newMission, []);
    assert.strictEqual(run.terminal, undefined);
    run = await ask(newMission, ['Ship it.\nSoon.']);
    assert.strictEqual(run.terminal?.env?.GURITA_GOAL, 'Ship it.\nSoon.');
    const defineMission = () => void pane.runStartingRow(context, 'defineMission');
    run = await ask(defineMission, ['Ship more.', 'pkg']);
    assert.deepStrictEqual(run.answered.map((each) => each.title), ['Gurita: Goal']);
    assert.deepStrictEqual(run.boxes, ['The scope, the directory holding the core of the work, as a path from the project root'], 'the scope stays in an input box');
    assert.strictEqual(run.terminal?.env?.GURITA_GOAL, 'Ship more.');
    assert.strictEqual(run.terminal?.env?.GURITA_SCOPE, 'pkg');
    run = await ask(defineMission, [CANCEL_PANEL, 'pkg']);
    assert.deepStrictEqual(run.boxes, [], 'a goal panel cancelled asks for no scope');
    assert.strictEqual(run.terminal, undefined);

    // The discussion note stays in an input box, and opens no panel.
    run = await ask(() => send({ type: 'questionButton', button: 'discussQuestion', mission: NOTED, question: 'Pane Layout', variant: 'default' }), ['A note']);
    assert.deepStrictEqual(run.panels, []);
    assert.deepStrictEqual(run.boxes, ['An optional note for the discussion, carried after the Short Title; leave it empty for none']);
    assert.ok(run.terminal !== undefined);

    // Driven by hand: a Run with nothing but blanks, or with no text, resolves nothing and keeps the panel open, its ready message answered each time with the prompt.
    answerPanels = false;
    const count = created.length;
    const panelCount = panels.length;
    send({ type: 'questionButton', button: 'answerQuestion', mission: BY_HAND, question: 'Pane Layout', variant: 'default' });
    for (let attempt = 0; attempt < 200 && inputPanelsFrom(panelCount).length === 0; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const [byHand] = inputPanelsFrom(panelCount);
    assert.ok(byHand?.receive !== undefined, 'the panel listens to its page');
    byHand.receive({ type: 'ready' });
    byHand.receive({ type: 'ready' });
    assert.deepStrictEqual(
      byHand.posts,
      [{ type: 'input', prompt: 'The answer, recorded as the decision' }, { type: 'input', prompt: 'The answer, recorded as the decision' }],
      'every ready message, a page loaded again included, is answered with the prompt',
    );
    byHand.receive({ type: 'run', value: ' \n ' });
    byHand.receive({ type: 'run' });
    byHand.receive({ type: 'run', value: ['text'] });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.strictEqual(created.length, count, 'a blank, missing, or non-text value starts nothing');
    assert.ok(byHand.dispose !== undefined, 'and leaves the panel open');
    byHand.receive({ type: 'run', value: 'Drop it.' });
    for (let attempt = 0; attempt < 200 && created.length === count; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.strictEqual(created.length, count + 1);
    assert.strictEqual(created[created.length - 1].env?.GURITA_ANSWER_TEXT, 'Drop it.');
    assert.strictEqual(byHand.dispose, undefined, 'Run closes the panel');
    assert.strictEqual(execFileSync('git', ['status', '--porcelain', '--ignored'], { cwd: root, encoding: 'utf8' }), '', "nothing is written into the project's tree");
  } finally {
    answerPanels = true;
    process.env.HOME = home;
  }
});

/** Missions no earlier test holds: one live before any Define mission run, and the one such a run defines. */
const BEFORE_DEFINE = 'pkg/mission_before_define/';
const DEFINED = 'pkg/mission_defined/';

test("a Define mission run's terminal closing opens the window of the one mission the re-read lists beyond those live when the run started, and nothing when the run defined none", async () => {
  const home = process.env.HOME;
  process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-home-'));
  try {
    const root = project(BEFORE_DEFINE);
    const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-recipes-'));
    fs.writeFileSync(path.join(files, 'shipped_recipes.md'), BUTTON_SHIPPED_TEXT);
    packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
    packaged.set('bundled/shipped_recipes.md', path.join(files, 'shipped_recipes.md'));
    packaged.set('runner.py', path.join(__dirname, '..', '..', 'runner.py'));
    workspace.folders = [{ uri: { fsPath: root } }];
    workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
    workspaceState.clear();
    // The run listeners as activation registers them: a closed run's terminal re-reads the live missions.
    runs.registerRuns(context, { started: () => {}, ended: () => pane.refreshMissions(context) });
    await pageAfter({ type: 'refresh' }, BEFORE_DEFINE);
    pane.startingOffers(context);

    /** The mission windows the extension created beyond its first `from`. */
    const missionPanelsFrom = (from: number) => panels.slice(from).filter((each) => each.viewType === pane.MISSION_VIEW_TYPE);
    /** Starts a Define mission run, with a goal and a scope typed, and returns its terminal. */
    const define = async (): Promise<StubTerminal> => {
      const count = created.length;
      typedValues.length = 0;
      typedValues.push('Define one more.', 'pkg');
      void pane.runStartingRow(context, 'defineMission');
      for (let attempt = 0; attempt < 200 && created.length === count; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      typedValues.length = 0;
      assert.strictEqual(created.length, count + 1, 'the Define mission row starts one run');
      return created[created.length - 1];
    };
    /** Closes `terminal` as the editor does, and waits until the re-read it starts has posted the window of `BEFORE_DEFINE` its page. */
    const closeAndReread = async (terminal: StubTerminal): Promise<void> => {
      const from = windowOf.get(BEFORE_DEFINE)?.posts.length ?? 0;
      for (const listener of [...closeListeners]) {
        listener(terminal);
      }
      await windowPosted(BEFORE_DEFINE, 'page', from);
    };

    // A run that defines a mission: its window opens by itself once the terminal closes, and not before.
    let terminal = await define();
    fs.mkdirSync(path.join(root, DEFINED), { recursive: true });
    fs.writeFileSync(path.join(root, DEFINED, 'requirements.md'), '# Defined mission\n\n## Goal\n\nDefine one more.\n');
    fs.writeFileSync(path.join(root, DEFINED, 'open_questions.xml'), '<open-questions/>\n');
    fs.writeFileSync(path.join(root, DEFINED, 'TASKS_TODO.md'), '# TASKS TODO\n');
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', `Mission-definition: ${DEFINED}`);
    await pageAfter({ type: 'refresh' }, BEFORE_DEFINE);
    assert.ok(!pane.openMissionWindows().includes(DEFINED), 'a re-read while the run is going opens nothing');
    let panelCount = panels.length;
    await closeAndReread(terminal);
    const opened = missionPanelsFrom(panelCount);
    assert.strictEqual(opened.length, 1, 'one mission window opens');
    assert.strictEqual(opened[0].title, 'Defined mission', "titled with the new mission's title");
    assert.ok(pane.openMissionWindows().includes(DEFINED), 'and it is the window of the mission the run defined');
    assert.ok(opened[0].active, 'as the active editor');

    // A run that defines no mission opens nothing.
    terminal = await define();
    panelCount = panels.length;
    await closeAndReread(terminal);
    assert.deepStrictEqual(missionPanelsFrom(panelCount), [], 'a run that created no mission opens no window');
  } finally {
    process.env.HOME = home;
  }
});
