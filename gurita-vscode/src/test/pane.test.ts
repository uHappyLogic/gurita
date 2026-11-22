import { test } from 'node:test';
import * as assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
// The pane's answer to a tab click, against a stub of the `vscode` module standing in for the
// editor: the webview panel and the messages its page posts, the terminals the run path creates,
// and the notifications.
const Module = require('node:module') as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};

interface StubTerminal {
  name: string;
  /** The `preserveFocus` argument of every `show` call, in order. */
  shows: (boolean | undefined)[];
}

const created: StubTerminal[] = [];
const notifications: string[] = [];
/** Every message the extension posted to the page. */
const posted: unknown[] = [];
let receive: ((message: unknown) => void) | undefined;

function notify(message: string): Promise<undefined> {
  notifications.push(message);
  return Promise.resolve(undefined);
}

const disposable = { dispose(): void {} };

/** The workspace the stub's editor holds open: its folders and the `gurita` settings it answers with. */
const workspace = {
  folders: undefined as { uri: { fsPath: string } }[] | undefined,
  settings: {} as Record<string, unknown>,
};

/** The files the stub's extension package holds, by the relative path `asAbsolutePath` is given. */
const packaged = new Map<string, string>();

const stub = {
  Uri: {
    joinPath: (...parts: unknown[]) => ({ parts }),
    file: (fsPath: string) => ({ fsPath }),
  },
  ViewColumn: { Active: -1 },
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
    getConfiguration: () => ({ get: (key: string) => workspace.settings[key] }),
    createFileSystemWatcher: () => ({
      onDidCreate: () => disposable,
      onDidChange: () => disposable,
      onDidDelete: () => disposable,
      dispose(): void {},
    }),
  },
  window: {
    createWebviewPanel(): unknown {
      return {
        visible: true,
        reveal(): void {},
        webview: {
          html: '',
          cspSource: 'stub-csp',
          asWebviewUri: (uri: unknown) => ({ toString: () => `webview:${JSON.stringify(uri)}` }),
          onDidReceiveMessage(listener: (message: unknown) => void) {
            receive = listener;
            return disposable;
          },
          postMessage(message: unknown): Promise<boolean> {
            posted.push(message);
            return Promise.resolve(true);
          },
        },
        onDidChangeViewState: () => disposable,
        onDidDispose: () => disposable,
      };
    },
    createTerminal(options: { name: string }): StubTerminal & { show(preserveFocus?: boolean): void } {
      const terminal = {
        name: options.name,
        shows: [] as (boolean | undefined)[],
        show(preserveFocus?: boolean): void {
          terminal.shows.push(preserveFocus);
        },
      };
      created.push(terminal);
      return terminal;
    },
    onDidCloseTerminal: () => disposable,
    showInformationMessage: notify,
    showWarningMessage: notify,
    showErrorMessage: notify,
  },
};

const load = Module._load;
Module._load = (request, parent, isMain) => (request === 'vscode' ? stub : load(request, parent, isMain));
const pane = require('../pane') as typeof import('../pane');
const runs = require('../runs') as typeof import('../runs');
Module._load = load;

const context = {
  subscriptions: [] as unknown[],
  extensionUri: { fsPath: '/extension' },
  asAbsolutePath: (file: string) => packaged.get(file) ?? `/extension/${file}`,
} as unknown as import('vscode').ExtensionContext;

const ALPHA = 'lib/mission_alpha/';
const BETA = 'mission_beta/';

pane.openMissionPane(context);

/** Delivers a message to the extension as the page posts it. */
function send(message: unknown): void {
  assert.ok(receive !== undefined, 'the pane listens to its page');
  receive(message);
}

/** Starts a held run for `mission` through the run path and returns its terminal. */
function startRun(mission: string): StubTerminal {
  runs.startChain(context, '/project', mission, 'review', ['echo review'], { path: mission });
  return created[created.length - 1];
}

test("a tab click's message brings forward and focuses the terminal of its mission's held run, with no notification", () => {
  const alpha = startRun(ALPHA);
  const beta = startRun(BETA);
  const [alphaShows, betaShows] = [alpha.shows.length, beta.shows.length];
  const count = created.length;
  notifications.length = 0;
  posted.length = 0;
  send({ type: 'missionTab', mission: ALPHA });
  assert.deepStrictEqual(alpha.shows.slice(alphaShows), [undefined], 'shown once, taking the focus');
  assert.strictEqual(beta.shows.length, betaShows, "the other mission's terminal is not shown");
  send({ type: 'missionTab', mission: ALPHA });
  assert.deepStrictEqual(alpha.shows.slice(alphaShows), [undefined, undefined], 'every click shows it again');
  assert.deepStrictEqual(notifications, []);
  assert.strictEqual(created.length, count, 'no terminal is created');
  assert.deepStrictEqual(posted, [], 'nothing is posted to the page');
});

test("a tab click's message for a mission with no held run shows nothing and no notification", () => {
  const shows = created.map((terminal) => terminal.shows.length);
  const count = created.length;
  notifications.length = 0;
  posted.length = 0;
  send({ type: 'missionTab', mission: 'other/mission_gamma/' });
  send({ type: 'missionTab' });
  assert.deepStrictEqual(
    created.map((terminal) => terminal.shows.length),
    shows,
    'no terminal is shown',
  );
  assert.deepStrictEqual(notifications, []);
  assert.strictEqual(created.length, count, 'no terminal is created');
  assert.deepStrictEqual(posted, [], 'nothing is posted to the page');
});

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { cwd, stdio: 'ignore' });
}

const GAMMA = 'pkg/mission_gamma/';

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

test("the pane posts each page's recipes in the shipped file's order, then its own, each with the values its first variant's lines carry", async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-')));
  git(root, 'init', '-q');
  fs.mkdirSync(path.join(root, GAMMA), { recursive: true });
  fs.writeFileSync(path.join(root, GAMMA, 'requirements.md'), '# Gamma mission\n\n## Goal\n\nA goal.\n');
  fs.writeFileSync(path.join(root, GAMMA, 'open_questions.xml'), '<open-questions/>\n');
  fs.writeFileSync(path.join(root, GAMMA, 'TASKS_TODO.md'), '# TASKS TODO\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', `Mission-definition: ${GAMMA}`);
  const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-recipes-'));
  fs.writeFileSync(path.join(files, 'GURITA_USAGE.md'), SHIPPED_TEXT);
  fs.writeFileSync(path.join(files, 'recipes.md'), OWN_TEXT);
  packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
  packaged.set('bundled/GURITA_USAGE.md', path.join(files, 'GURITA_USAGE.md'));
  workspace.folders = [{ uri: { fsPath: root } }];
  workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
  const from = posted.length;
  send({ type: 'ready' });
  const live = (await postedOf('live', from)) as { missions: { path: string; recipes: { state: string; recipes: unknown[] } }[] };
  assert.deepStrictEqual(live.missions.map((each) => each.path), [GAMMA]);
  const recipes = live.missions[0].recipes;
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
      values: { harnesses: ['claude'], models: ['fable', 'opus'], efforts: ['xhigh', 'high'] },
    },
    {
      kind: 'looped',
      name: 'Execute tasks one at a time',
      group: 'shipped',
      lines: ['<single-task line>'],
      values: { harnesses: [], models: [], efforts: [] },
    },
    {
      kind: 'runnable',
      name: 'Mixed review',
      group: 'shipped',
      lines: ['agy -p "/gurita:review-mission-requirements --mission <path>" --model "gemini-4-argon" --effort medium;'],
      values: { harnesses: ['agy'], models: ['gemini-4-argon'], efforts: ['medium'] },
    },
    { kind: 'runnable', name: 'Mine everywhere', group: 'own', lines: ['echo <path>'], values: { harnesses: [], models: [], efforts: [] } },
  ]);
  const count = created.length;
  send({ type: 'runRecipe', mission: GAMMA, recipe: 'First run' });
  assert.deepStrictEqual(created.slice(count).map((terminal) => terminal.name), [`Gurita: First run (${GAMMA})`], 'a click runs the listed variant');
});
