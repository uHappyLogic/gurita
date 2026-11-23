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
  /** The runner's arguments the terminal was created with. */
  args: string[];
  /** The `preserveFocus` argument of every `show` call, in order. */
  shows: (boolean | undefined)[];
}

const created: StubTerminal[] = [];
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
/** Every message the extension posted to the page. */
const posted: unknown[] = [];
let receive: ((message: unknown) => void) | undefined;
/** Closes the panel the extension created last, as the editor does when the person closes it. */
let dispose: (() => void) | undefined;

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
        onDidDispose(listener: () => void) {
          dispose = listener;
          return disposable;
        },
      };
    },
    createTerminal(options: { name: string; shellArgs?: string[] }): StubTerminal & { show(preserveFocus?: boolean): void } {
      const terminal = {
        name: options.name,
        args: [...(options.shellArgs ?? [])],
        shows: [] as (boolean | undefined)[],
        show(preserveFocus?: boolean): void {
          terminal.shows.push(preserveFocus);
        },
      };
      created.push(terminal);
      return terminal;
    },
    onDidCloseTerminal: () => disposable,
    showInputBox: (options: InputBoxOptions) => {
      inputBoxes.push(options);
      return Promise.resolve(typedValues.shift());
    },
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
        variants: [
          { name: 'Claude Code', own: false },
          { name: 'Antigravity', own: false },
          { name: 'First run', own: true },
        ],
        selected: 0,
      },
      {
        kind: 'looped',
        name: 'Execute tasks one at a time',
        group: 'shipped',
        lines: ['<single-task line>'],
        values: { harnesses: [], models: [], efforts: [] },
        variants: [{ name: 'Execute tasks one at a time', own: false }],
        selected: 0,
      },
      {
        kind: 'runnable',
        name: 'Mixed review',
        group: 'shipped',
        lines: ['agy -p "/gurita:review-mission-requirements --mission <path>" --model "gemini-4-argon" --effort medium;'],
        values: { harnesses: ['agy'], models: ['gemini-4-argon'], efforts: ['medium'] },
        variants: [{ name: 'Mixed review', own: false }],
        selected: 0,
      },
      {
        kind: 'runnable',
        name: 'Mine everywhere',
        group: 'own',
        lines: ['echo <path>'],
        values: { harnesses: [], models: [], efforts: [] },
        variants: [{ name: 'Mine everywhere', own: true }],
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

/** Sends `message` and returns the entry of the recipe `recipe` on the page of `mission` in the next live message posted. */
async function entryAfter(message: unknown, mission: string, recipe: string): Promise<PostedEntry> {
  const from = posted.length;
  send(message);
  const live = (await postedOf('live', from)) as { missions: { path: string; recipes: { recipes: PostedEntry[] } }[] };
  const found = live.missions.find((each) => each.path === mission)?.recipes.recipes.find((each) => each.name === recipe);
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
    fs.writeFileSync(path.join(files, 'GURITA_USAGE.md'), SHIPPED_TEXT);
    fs.writeFileSync(path.join(files, 'recipes.md'), OWN_TEXT);
    fs.mkdirSync(path.join(fakeHome, '.gurita'));
    // The settings view's pick of a default: Antigravity, the second shipped variant.
    fs.writeFileSync(
      path.join(fakeHome, '.gurita', 'variants.json'),
      JSON.stringify({ defaults: [{ recipe: 'First run', name: 'Antigravity', origin: 'shipped' }] }),
    );
    packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
    packaged.set('bundled/GURITA_USAGE.md', path.join(files, 'GURITA_USAGE.md'));
    workspace.folders = [{ uri: { fsPath: root } }];
    workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
    workspaceState.clear();

    let entry = await entryAfter({ type: 'ready' }, DELTA, 'First run');
    assert.strictEqual(selectedName(entry), 'Antigravity', 'with nothing remembered the dropdown stands on the default');
    assert.deepStrictEqual(entry.variants, [
      { name: 'Claude Code', own: false },
      { name: 'Antigravity', own: false },
      { name: 'First run', own: true },
    ]);

    entry = await entryAfter({ type: 'selectVariant', mission: DELTA, recipe: 'First run', variant: 'First run' }, DELTA, 'First run');
    assert.deepStrictEqual(workspaceState.get('gurita.variantSelections'), { [DELTA]: { 'First run': 'First run' } });
    assert.strictEqual(selectedName(entry), 'First run', 'a remembered selection wins over the default');
    assert.deepStrictEqual(entry.lines, ['claude -p "/gurita:review-mission-requirements --mission <path>" --model "sonnet";']);

    entry = await entryAfter({ type: 'refresh' }, DELTA, 'First run');
    assert.strictEqual(selectedName(entry), 'First run', 'the selection is remembered through a re-read');
    entry = await entryAfter({ type: 'refresh' }, EPSILON, 'First run');
    assert.strictEqual(selectedName(entry), 'Antigravity', "another mission's page keeps its own selection, here the default");

    const count = created.length;
    send({ type: 'runRecipe', mission: DELTA, recipe: 'First run', variant: 'Antigravity' });
    send({ type: 'runRecipe', mission: DELTA, recipe: 'First run', variant: 'No such variant' });
    send({ type: 'selectVariant', mission: DELTA, recipe: 'First run', variant: 'No such variant' });
    send({ type: 'selectVariant', mission: 'other/mission_zeta/', recipe: 'First run', variant: 'Claude Code' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.strictEqual(created.length, count, 'a variant the last posted list does not show selected starts nothing');
    assert.deepStrictEqual(workspaceState.get('gurita.variantSelections'), { [DELTA]: { 'First run': 'First run' } }, 'nor is remembered');
    send({ type: 'runRecipe', mission: DELTA, recipe: 'First run', variant: 'First run' });
    assert.deepStrictEqual(created.slice(count).map((terminal) => terminal.name), [`Gurita: First run (${DELTA})`], 'the selected variant runs');

    // A default picked afresh leaves the remembered selection standing.
    fs.writeFileSync(
      path.join(fakeHome, '.gurita', 'variants.json'),
      JSON.stringify({ defaults: [{ recipe: 'First run', name: 'Claude Code', origin: 'shipped' }] }),
    );
    entry = await entryAfter({ type: 'refresh' }, DELTA, 'First run');
    assert.strictEqual(selectedName(entry), 'First run');

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

test('the first opening of the settings view runs the check once, every later opening and re-read posting the result kept without running it', async () => {
  const root = project(ETA);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-check-'));
  const stubbed = stubCheckScript(dir);
  fs.writeFileSync(stubbed.print, JSON.stringify(CHECK_PRINT) + '\n');
  fs.writeFileSync(path.join(dir, 'plugin_version.txt'), '2.0.0\n');
  const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-recipes-'));
  fs.writeFileSync(path.join(files, 'GURITA_USAGE.md'), SHIPPED_TEXT);
  fs.writeFileSync(path.join(files, 'recipes.md'), OWN_TEXT);
  packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
  packaged.set('bundled/GURITA_USAGE.md', path.join(files, 'GURITA_USAGE.md'));
  packaged.set('harness_check.py', stubbed.script);
  packaged.set('bundled/plugin_version.txt', path.join(dir, 'plugin_version.txt'));
  workspace.folders = [{ uri: { fsPath: root } }];
  workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
  workspaceState.clear();

  const before = (await entryAfter({ type: 'ready' }, ETA, 'First run')) as unknown;
  assert.deepStrictEqual(checkRuns(stubbed.log), [], 'no answer of the pane runs the check');

  let from = posted.length;
  send({ type: 'settingsOpened' });
  await checkPosted('running', from);
  const checked = await checkPosted('checked', from);
  assert.deepStrictEqual(checkRuns(stubbed.log), [{ argv: ['--project', root], cwd: root }], 'run once, from the project root');
  assert.deepStrictEqual(checked, {
    state: 'checked',
    harnesses: [
      { key: 'claude', name: 'Claude Code', cli: 'claude', packaged: '2.0.0', installed: '2.0.0' },
      { key: 'antigravity', name: 'Antigravity', cli: 'agy', packaged: '2.0.0', installed: '1.9.0', failed: 'version' },
      { key: 'codex', name: 'Codex', cli: 'codex', packaged: '2.0.0', failed: 'cli' },
    ],
  });

  from = posted.length;
  send({ type: 'settingsOpened' });
  assert.deepStrictEqual(await checkPosted('checked', from), checked, 'a later opening posts the result kept');
  const after = (await entryAfter({ type: 'refresh' }, ETA, 'First run')) as unknown;
  await entryAfter({ type: 'ready' }, ETA, 'First run');
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
    again.harnesses.map((each) => [each.key, each.failed]),
    [
      ['claude', undefined],
      ['antigravity', 'plugin'],
      ['codex', 'cli'],
    ],
  );
  from = posted.length;
  send({ type: 'settingsOpened' });
  assert.deepStrictEqual(await checkPosted('checked', from), again, 'the fresh result is the one kept');

  fs.writeFileSync(stubbed.print, 'not json\n');
  from = posted.length;
  send({ type: 'checkHarnesses' });
  const failed = await checkPosted('failed', from);
  assert.match(String(failed.cause), /the harness check printed no JSON/);

  // A panel created afresh runs the check again at its first opening.
  fs.writeFileSync(stubbed.print, JSON.stringify(CHECK_PRINT) + '\n');
  assert.ok(dispose !== undefined);
  dispose();
  pane.openMissionPane(context);
  await entryAfter({ type: 'ready' }, ETA, 'First run');
  from = posted.length;
  send({ type: 'settingsOpened' });
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
    fs.writeFileSync(path.join(files, 'GURITA_USAGE.md'), HARNESS_SHIPPED_TEXT);
    packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
    packaged.set('bundled/GURITA_USAGE.md', path.join(files, 'GURITA_USAGE.md'));
    packaged.set('runner.py', path.join(__dirname, '..', '..', 'runner.py'));
    workspace.folders = [{ uri: { fsPath: root } }];
    workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
    workspaceState.clear();
    const store = path.join(fakeHome, '.gurita', 'variants.json');
    const page = async (message: unknown) => {
      const from = posted.length;
      send(message);
      const live = (await postedOf('live', from)) as { missions: { path: string; recipes: { recipes: PostedEntry[] } }[] };
      return live.missions.find((each) => each.path === THETA)?.recipes.recipes ?? [];
    };
    const shown = (entries: PostedEntry[]) => entries.map((entry) => [entry.name, entry.variants.map((each) => each.name), selectedName(entry)]);

    let from = posted.length;
    const initial = await page({ type: 'ready' });
    assert.deepStrictEqual(shown(initial), [
      ['First run', ['Claude Code', 'Antigravity'], 'Claude Code'],
      ['Execute tasks one at a time', ['Execute tasks one at a time'], 'Execute tasks one at a time'],
      ['Mixed review', ['Mixed review'], 'Mixed review'],
    ]);
    await page({ type: 'selectVariant', mission: THETA, recipe: 'First run', variant: 'Antigravity' });

    from = posted.length;
    send({ type: 'settingsOpened' });
    assert.deepStrictEqual(await postedOf('harnessSettings', from), {
      type: 'harnessSettings',
      settings: { state: 'read', enabled: { claude: true, antigravity: true, codex: true } },
    }, 'every harness starts enabled, whatever its check reports');
    assert.ok(!fs.existsSync(store), 'nothing is written until a harness is disabled');

    from = posted.length;
    send({ type: 'setHarnessEnabled', harness: 'antigravity', enabled: false });
    assert.deepStrictEqual(await postedOf('harnessSettings', from), {
      type: 'harnessSettings',
      settings: { state: 'read', enabled: { claude: true, antigravity: false, codex: true } },
    });
    const live = (await postedOf('live', from)) as { missions: { path: string; recipes: { recipes: PostedEntry[] } }[]; buttons: Record<string, unknown> };
    const narrowed = live.missions.find((each) => each.path === THETA)?.recipes.recipes ?? [];
    assert.deepStrictEqual(
      live.buttons.discussGoal,
      { state: 'disabled', cause: 'Every variant of discuss-mission-goal this button can run has a line on a disabled harness.' },
      'the fixed-name button whose only variant runs on Antigravity is posted with no variant, drawn disabled',
    );
    assert.deepStrictEqual(shown(narrowed), [
      ['First run', ['Claude Code'], 'Claude Code'],
      ['Execute tasks one at a time', ['Execute tasks one at a time'], 'Execute tasks one at a time'],
    ], 'the Antigravity variant leaves the dropdown, the recipe left with none its button, the remembered one giving way to the first listed');
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(store, 'utf8')).harnesses, { antigravity: { enabled: false } });
    assert.deepStrictEqual(workspaceState.get('gurita.variantSelections'), { [THETA]: { 'First run': 'Antigravity' } }, 'the remembered selection is kept');

    let count = created.length;
    send({ type: 'runRecipe', mission: THETA, recipe: 'First run', variant: 'Antigravity' });
    send({ type: 'runRecipe', mission: THETA, recipe: 'Mixed review', variant: 'Mixed review' });
    await page({ type: 'refresh' });
    assert.strictEqual(created.length, count, 'a click on a left-out variant or recipe is refused');
    assert.deepStrictEqual(shown(await page({ type: 'refresh' })), shown(narrowed), 'a re-read keeps the harness disabled');

    // The fixed-name button left with no variant starts nothing.
    const boxes = inputBoxes.length;
    send({ type: 'missionButton', button: 'discussGoal', variant: 'discuss-mission-goal' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.strictEqual(created.length, count, 'a click on a fixed-name button left with no variant starts nothing');
    assert.strictEqual(inputBoxes.length, boxes, 'nor asks for its values');

    // The looped run's preview and run keep every named single-task line.
    from = posted.length;
    send({ type: 'previewLoop', mission: THETA, recipe: 'Execute tasks one at a time', variant: 'Execute tasks one at a time' });
    const preview = await postedOf('preview', from);
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

    from = posted.length;
    send({ type: 'setHarnessEnabled', harness: 'antigravity', enabled: true });
    const again = (await postedOf('live', from)) as { missions: { path: string; recipes: { recipes: PostedEntry[] } }[]; buttons: Record<string, { state: string }> };
    assert.deepStrictEqual(
      shown(again.missions.find((each) => each.path === THETA)?.recipes.recipes ?? [])[0],
      ['First run', ['Claude Code', 'Antigravity'], 'Antigravity'],
      'enabled again, the remembered selection comes back',
    );
    assert.strictEqual(again.buttons.discussGoal.state, 'offered', 'enabled again, the fixed-name button offers its variant');
    count = created.length;
    typedValues.push('A goal');
    send({ type: 'missionButton', button: 'discussGoal', variant: 'discuss-mission-goal' });
    for (let attempt = 0; attempt < 200 && created.length === count; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.deepStrictEqual(created.slice(count).map((terminal) => terminal.name), ['Gurita: discuss-mission-goal']);
    assert.match(created[created.length - 1].args.join(' '), /^\S+ chain -- agy /);

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
async function postedLists(from: number): Promise<Record<string, { models: string[]; efforts?: string[] }>> {
  const message = (await postedOf('harnessLists', from)) as { lists: { state: string; lists?: Record<string, { models: string[]; efforts?: string[] }> } };
  assert.strictEqual(message.lists.state, 'read', JSON.stringify(message.lists));
  return message.lists.lists as Record<string, { models: string[]; efforts?: string[] }>;
}

test("the settings view's model and effort lists are derived from the recipe lines, and an added or removed entry is stored as an overlay in the harness part", async () => {
  const home = process.env.HOME;
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-home-'));
  process.env.HOME = fakeHome;
  try {
    const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-recipes-'));
    fs.writeFileSync(path.join(files, 'GURITA_USAGE.md'), HARNESS_SHIPPED_TEXT);
    fs.writeFileSync(path.join(files, 'recipes.md'), `${OWN_TEXT}
### Codex finish
\`\`\`
codex exec "/gurita:finish-mission --mission <path>" -m gpt-5.5;
\`\`\`
`);
    packaged.set('bundled/GURITA_USAGE.md', path.join(files, 'GURITA_USAGE.md'));
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
    send({ type: 'settingsOpened' });
    assert.deepStrictEqual(await postedLists(from), {
      claude: { models: ['fable', 'opus', 'sonnet'], efforts: ['xhigh', 'high'] },
      antigravity: { models: ['gemini-4-argon', 'claude-opus-5-5', 'gemini-4-neon'], efforts: ['medium', 'high', 'xhigh'] },
      codex: { models: ['gpt-5.5'] },
    }, "the shipped, own, and stored lines' values, Codex with no effort list");

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
    assert.deepStrictEqual(await postedLists(from).then((lists) => lists.codex), { models: ['gpt-5.5', 'gpt-5.5-codex'] });

    const written = JSON.parse(fs.readFileSync(store, 'utf8'));
    assert.deepStrictEqual(written.harnesses, {
      antigravity: { enabled: false, removedModels: ['claude-opus-5-5'], addedEfforts: ['low'] },
      claude: {},
      codex: { addedModels: ['gpt-5.5-codex'] },
    }, 'the overlay is kept in the harness part beside the enabled state');
    assert.strictEqual(written.variants.length, 1, 'the stored variant is kept');
    assert.ok(!fs.readFileSync(path.join(files, 'recipes.md'), 'utf8').includes('gpt-5.5-codex'), 'the own recipe file is not written');

    const before = fs.readFileSync(store, 'utf8');
    const boxes = inputBoxes.length;
    from = posted.length;
    send({ type: 'addHarnessValue', harness: 'codex', kind: 'effort' });
    send({ type: 'addHarnessValue', harness: 'agy', kind: 'model' });
    send({ type: 'addHarnessValue', harness: 'claude', kind: 'models' });
    send({ type: 'removeHarnessValue', harness: 'claude', kind: 'model', value: 'not-offered' });
    send({ type: 'removeHarnessValue', harness: 'codex', kind: 'effort', value: 'high' });
    send({ type: 'addHarnessValue', harness: 'claude', kind: 'effort' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.strictEqual(inputBoxes.length, boxes + 1, 'only the effort of a harness holding an effort list is asked for');
    assert.deepStrictEqual(posted.slice(from), [], 'no list the harness holds, no entry offered, or a dismissed box writes and posts nothing');
    assert.strictEqual(fs.readFileSync(store, 'utf8'), before);
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
    fs.writeFileSync(path.join(files, 'GURITA_USAGE.md'), HARNESS_SHIPPED_TEXT);
    fs.writeFileSync(path.join(files, 'recipes.md'), VARIANT_OWN_TEXT);
    packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
    packaged.set('bundled/GURITA_USAGE.md', path.join(files, 'GURITA_USAGE.md'));
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
      send(message);
      const recipes = await postedVariants(from);
      const live = (await postedOf('live', from)) as { missions: { path: string; recipes: { recipes: PostedEntry[] } }[] };
      const firstRun = live.missions.find((each) => each.path === IOTA)?.recipes.recipes.find((each) => each.name === 'First run');
      assert.ok(firstRun !== undefined);
      return { recipes, dropdown: firstRun.variants.map((each) => each.name), selected: selectedName(firstRun) };
    };
    /** Runs the discuss-mission-goal button, its dropdown on the variant of that name, with a typed goal and returns the runner's arguments. */
    const discussGoal = async () => {
      const count = created.length;
      typedValues.push('A goal');
      send({ type: 'missionButton', button: 'discussGoal', variant: 'discuss-mission-goal' });
      for (let attempt = 0; attempt < 200 && created.length === count; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.strictEqual(created.length, count + 1);
      return created[created.length - 1].args.join(' ');
    };

    await entryAfter({ type: 'ready' }, IOTA, 'First run');
    let from = posted.length;
    send({ type: 'settingsOpened' });
    let recipes = await postedVariants(from);
    assert.deepStrictEqual(variantRows(recipes), [
      ['First run', false, ['Claude Code (shipped) *', 'Antigravity (shipped)', 'First run (own)'], []],
      ['Execute tasks one at a time', false, ['Execute tasks one at a time (shipped) *'], []],
      ['Mixed review', false, ['Mixed review (shipped) *'], []],
      ['discuss-mission-goal', true, ['discuss-mission-goal (shipped) *', 'discuss-mission-goal (own)'], []],
      ['Mine everywhere', false, ['Mine everywhere (own) *'], []],
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
    assert.ok(box.validateInput('Antigravity') !== undefined && box.validateInput(' First run') !== undefined, 'a name the recipe uses is refused');
    assert.strictEqual(box.validateInput('Fast'), undefined);
    assert.deepStrictEqual(stored().variants, [{ recipe: 'First run', name: 'Fast', lines: recipes[0].variants[0].lines }]);
    assert.deepStrictEqual(variantRows(shown.recipes)[0], ['First run', false, ['Claude Code (shipped) *', 'Antigravity (shipped)', 'First run (own)', 'Fast (stored)'], []]);
    assert.deepStrictEqual(shown.dropdown, ['Claude Code', 'Antigravity', 'First run', 'Fast'], "the duplicate reaches the mission page's dropdown");

    // Rename: the box opens on the current name; a shipped variant gets a stored copy in its place.
    typedValues.push('Gemini');
    shown = await edit({ type: 'renameVariant', recipe: 'First run', variant: { name: 'Antigravity', origin: 'shipped' } });
    box = inputBoxes[1];
    assert.strictEqual(box.value, 'Antigravity', 'a rename opens with the current name filled in');
    assert.ok(box.validateInput !== undefined);
    assert.ok(box.validateInput('') !== undefined, 'an empty name is refused');
    assert.ok(box.validateInput('Claude Code') !== undefined && box.validateInput('Fast') !== undefined, 'a name the recipe uses is refused');
    assert.strictEqual(box.validateInput('Antigravity'), undefined, 'the current name is no other variant');
    assert.deepStrictEqual(variantRows(shown.recipes)[0][2], ['Claude Code (shipped) *', 'Gemini (stored of Antigravity)', 'First run (own)', 'Fast (stored)']);
    assert.deepStrictEqual(shown.dropdown, ['Claude Code', 'Gemini', 'First run', 'Fast'], 'the renamed variant keeps its place');

    // Default: a pick on the stored copy; with nothing remembered the page's dropdown stands on it.
    shown = await edit({ type: 'pickDefault', recipe: 'First run', variant: { name: 'Gemini', origin: 'stored', copies: { name: 'Antigravity', origin: 'shipped' } } });
    assert.deepStrictEqual(stored().defaults, [{ recipe: 'First run', name: 'Antigravity', origin: 'shipped' }]);
    assert.deepStrictEqual(variantRows(shown.recipes)[0][2], ['Claude Code (shipped)', 'Gemini (stored of Antigravity) *', 'First run (own)', 'Fast (stored)']);
    assert.strictEqual(shown.selected, 'Gemini');

    // Reset: the stored copy goes and the shipped variant shows again, the pick still on it.
    shown = await edit({ type: 'resetVariant', recipe: 'First run', original: { name: 'Antigravity', origin: 'shipped' } });
    assert.deepStrictEqual(variantRows(shown.recipes)[0][2], ['Claude Code (shipped)', 'Antigravity (shipped) *', 'First run (own)', 'Fast (stored)']);
    assert.deepStrictEqual(shown.dropdown, ['Claude Code', 'Antigravity', 'First run', 'Fast']);

    // Delete: a shipped variant gets a hiding record, listed with its reset; the page's dropdown loses it.
    shown = await edit({ type: 'deleteVariant', recipe: 'First run', variant: { name: 'Claude Code', origin: 'shipped' } });
    assert.deepStrictEqual(variantRows(shown.recipes)[0], ['First run', false, ['Antigravity (shipped) *', 'First run (own)', 'Fast (stored)'], ['Claude Code (shipped)']]);
    assert.deepStrictEqual(shown.dropdown, ['Antigravity', 'First run', 'Fast']);
    shown = await edit({ type: 'resetVariant', recipe: 'First run', original: { name: 'Claude Code', origin: 'shipped' } });
    assert.deepStrictEqual(shown.dropdown, ['Claude Code', 'Antigravity', 'First run', 'Fast'], 'reset, the deleted variant shows again');
    shown = await edit({ type: 'deleteVariant', recipe: 'First run', variant: { name: 'Fast', origin: 'stored' } });
    assert.deepStrictEqual(shown.dropdown, ['Claude Code', 'Antigravity', 'First run'], 'a deleted duplicate leaves the store');

    // The fixed-name button runs the default picked in the settings view, its pages posted again with every edit.
    assert.match(await discussGoal(), / chain -- agy /, 'the shipped variant runs first');
    recipes = (await edit({ type: 'pickDefault', recipe: 'discuss-mission-goal', variant: { name: 'discuss-mission-goal', origin: 'own' } })).recipes;
    assert.deepStrictEqual(variantRows(recipes)[3][2], ['discuss-mission-goal (shipped)', 'discuss-mission-goal (own) *']);
    assert.match(await discussGoal(), / chain -- claude /, 'the picked own variant runs');
    recipes = (await edit({ type: 'deleteVariant', recipe: 'discuss-mission-goal', variant: { name: 'discuss-mission-goal', origin: 'own' } })).recipes;
    assert.deepStrictEqual(variantRows(recipes)[3], ['discuss-mission-goal', true, ['discuss-mission-goal (shipped) *'], ['discuss-mission-goal (own)']]);
    assert.deepStrictEqual(stored().defaults, [{ recipe: 'First run', name: 'Antigravity', origin: 'shipped' }], 'deleting the picked default drops its pick');
    assert.match(await discussGoal(), / chain -- agy /, 'the button falls back to the first listed variant');

    // A dismissed box, a message naming no listed variant, or no variant in form writes and posts nothing.
    const before = fs.readFileSync(store, 'utf8');
    const boxes = inputBoxes.length;
    from = posted.length;
    send({ type: 'renameVariant', recipe: 'First run', variant: { name: 'Claude Code', origin: 'shipped' } });
    send({ type: 'duplicateVariant', recipe: 'First run', variant: { name: 'No such variant', origin: 'shipped' } });
    send({ type: 'deleteVariant', recipe: 'No such recipe', variant: { name: 'Claude Code', origin: 'shipped' } });
    send({ type: 'pickDefault', recipe: 'First run', variant: { name: 'Claude Code', origin: 'elsewhere' } });
    send({ type: 'resetVariant', recipe: 'First run', original: { name: 'Antigravity', origin: 'shipped' } });
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
  editors: ({ harness: string; model: string; effort?: string } | null)[];
  rows: PostedRow[];
}

test("a pick in a line's dropdown replaces the value the line carries through the store's edit, a shipped variant getting a stored copy in its place", async () => {
  const home = process.env.HOME;
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-home-'));
  process.env.HOME = fakeHome;
  try {
    const root = project(KAPPA);
    const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-recipes-'));
    fs.writeFileSync(path.join(files, 'GURITA_USAGE.md'), HARNESS_SHIPPED_TEXT);
    fs.writeFileSync(path.join(files, 'recipes.md'), OWN_TEXT);
    packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
    packaged.set('bundled/GURITA_USAGE.md', path.join(files, 'GURITA_USAGE.md'));
    packaged.set('runner.py', path.join(__dirname, '..', '..', 'runner.py'));
    workspace.folders = [{ uri: { fsPath: root } }];
    workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
    workspaceState.clear();
    inputBoxes.length = 0;
    const store = path.join(fakeHome, '.gurita', 'variants.json');
    const stored = () => JSON.parse(fs.readFileSync(store, 'utf8'));
    /** Sends `message` and returns the First run variants listed and the First run entry on KAPPA's page posted after it. */
    const pick = async (message: unknown) => {
      const from = posted.length;
      send(message);
      const recipes = await postedVariants(from);
      const live = (await postedOf('live', from)) as { missions: { path: string; recipes: { recipes: PostedEntry[] } }[] };
      const entry = live.missions.find((each) => each.path === KAPPA)?.recipes.recipes.find((each) => each.name === 'First run');
      assert.ok(entry !== undefined);
      return { variants: recipes[0].variants as EditedVariant[], entry };
    };

    await entryAfter({ type: 'ready' }, KAPPA, 'First run');
    const from = posted.length;
    send({ type: 'settingsOpened' });
    const listed = (await postedVariants(from))[0].variants as EditedVariant[];
    const shippedLines = listed[0].lines;
    assert.deepStrictEqual(listed.map((each) => [each.name, each.origin, each.editors]), [
      ['Claude Code', 'shipped', [
        { harness: 'claude', model: 'fable', effort: 'xhigh' },
        { harness: 'claude', model: 'opus', effort: 'high' },
        { harness: 'claude', model: 'fable', effort: 'xhigh' },
      ]],
      ['Antigravity', 'shipped', [{ harness: 'antigravity', model: 'gemini-4-argon', effort: 'medium' }]],
      ['First run', 'own', [null]],
    ], 'each line with both flags gets its editor, the own line carrying --model alone none');
    assert.deepStrictEqual(listed.map((each) => [each.name, each.rows]), [
      ['Claude Code', [
        { skill: 'review-mission-requirements', interactive: false, harness: 'claude' },
        { skill: 'provide-alternatives-to-all-open-questions', interactive: false, harness: 'claude' },
        { skill: 'recommend-all-open-questions', interactive: false, harness: 'claude' },
      ]],
      ['Antigravity', [{ skill: 'review-mission-requirements', interactive: false, harness: 'antigravity' }]],
      ['First run', [{ skill: 'review-mission-requirements', interactive: false, harness: 'claude' }]],
    ], 'each line running a gurita: skill is posted with its row, the own line without an editor included');

    // A model pick on a shipped variant's line: a stored copy holding the changed line, in that variant's place.
    let shown = await pick({ type: 'replaceLineValue', recipe: 'First run', variant: { name: 'Claude Code', origin: 'shipped' }, line: 1, kind: 'model', value: 'fable' });
    const changed = shippedLines[1].replace('--model "opus"', '--model "fable"');
    assert.deepStrictEqual(stored().variants, [
      { recipe: 'First run', name: 'Claude Code', lines: [shippedLines[0], changed, shippedLines[2]], copies: { name: 'Claude Code', origin: 'shipped' } },
    ]);
    assert.deepStrictEqual(shown.variants.map((each) => [each.name, each.origin, each.copies?.name]), [
      ['Claude Code', 'stored', 'Claude Code'],
      ['Antigravity', 'shipped', undefined],
      ['First run', 'own', undefined],
    ], 'the stored copy stands in the shipped variant\'s place');
    assert.deepStrictEqual(shown.variants[0].lines, [shippedLines[0], changed, shippedLines[2]]);
    assert.deepStrictEqual(shown.variants[0].editors[1], { harness: 'claude', model: 'fable', effort: 'high' });
    assert.deepStrictEqual(shown.entry.variants.map((each) => each.name), ['Claude Code', 'Antigravity', 'First run'], "the mission page's dropdown keeps its order");
    assert.deepStrictEqual(shown.entry.lines, [shippedLines[0], changed, shippedLines[2]], "the page's button runs the changed line");

    // An effort pick, from the harness's whole effort list, on the stored copy changes it in the store.
    shown = await pick({
      type: 'replaceLineValue',
      recipe: 'First run',
      variant: { name: 'Claude Code', origin: 'stored', copies: { name: 'Claude Code', origin: 'shipped' } },
      line: 1,
      kind: 'effort',
      value: 'xhigh',
    });
    assert.strictEqual(stored().variants.length, 1, 'the stored copy is changed in place');
    assert.strictEqual(stored().variants[0].lines[1], changed.replace('--effort high', '--effort xhigh'));

    // An Antigravity line takes its own harness's effort list.
    shown = await pick({ type: 'replaceLineValue', recipe: 'First run', variant: { name: 'Antigravity', origin: 'shipped' }, line: 0, kind: 'effort', value: 'high' });
    assert.match(shown.variants[1].lines[0], /--model "gemini-4-argon" --effort high;$/);
    assert.deepStrictEqual(shown.variants.map((each) => [each.name, each.origin]), [['Claude Code', 'stored'], ['Antigravity', 'stored'], ['First run', 'own']]);

    // A value the list does not offer, the value the line carries, a line without a control, or a message not in form writes and posts nothing.
    const before = fs.readFileSync(store, 'utf8');
    const quiet = posted.length;
    const copy = { name: 'Claude Code', origin: 'stored', copies: { name: 'Claude Code', origin: 'shipped' } };
    send({ type: 'replaceLineValue', recipe: 'First run', variant: copy, line: 0, kind: 'effort', value: 'max' });
    send({ type: 'replaceLineValue', recipe: 'First run', variant: copy, line: 0, kind: 'model', value: 'gemini-4-argon' });
    send({ type: 'replaceLineValue', recipe: 'First run', variant: copy, line: 0, kind: 'model', value: 'fable' });
    send({ type: 'replaceLineValue', recipe: 'First run', variant: { name: 'First run', origin: 'own' }, line: 0, kind: 'model', value: 'opus' });
    send({ type: 'replaceLineValue', recipe: 'First run', variant: { name: 'First run', origin: 'own' }, line: 0, kind: 'effort', value: 'high' });
    send({ type: 'replaceLineValue', recipe: 'First run', variant: copy, line: 3, kind: 'model', value: 'opus' });
    send({ type: 'replaceLineValue', recipe: 'First run', variant: copy, line: '0', kind: 'model', value: 'opus' });
    send({ type: 'replaceLineValue', recipe: 'First run', variant: copy, line: 0, kind: 'models', value: 'opus' });
    send({ type: 'replaceLineValue', recipe: 'Execute tasks one at a time', variant: { name: 'Execute tasks one at a time', origin: 'shipped' }, line: 0, kind: 'model', value: 'opus' });
    send({ type: 'replaceLineValue', recipe: 'First run', variant: { name: 'Claude Code', origin: 'shipped' }, line: 0, kind: 'model', value: 'opus' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.deepStrictEqual(posted.slice(quiet), []);
    assert.strictEqual(fs.readFileSync(store, 'utf8'), before);
    assert.strictEqual(inputBoxes.length, 0, 'a pick asks for nothing in an input box');

    assert.strictEqual(fs.readFileSync(path.join(files, 'recipes.md'), 'utf8'), OWN_TEXT, 'the own recipe file is never written');
    assert.strictEqual(fs.readFileSync(path.join(files, 'GURITA_USAGE.md'), 'utf8'), HARNESS_SHIPPED_TEXT, 'the shipped file is never written');
    assert.strictEqual(execFileSync('git', ['status', '--porcelain', '--ignored'], { cwd: root, encoding: 'utf8' }), '', "nothing is written into the project's tree");
  } finally {
    process.env.HOME = home;
  }
});

/** A mission no earlier test holds a run for. */
const LAMBDA = 'pkg/mission_lambda/';

/** The own file of the line-edit test: a named single-task line of its own beside the recipes of the recipe-list test. */
const LINE_OWN_TEXT = `${OWN_TEXT}
### My own line
\`\`\`
claude -p "/gurita:complete-task --mission <path> <Task Title>" --model "sonnet" --effort medium;
\`\`\`
`;

interface ListedLine {
  name: string;
  variant: { name: string; origin: string; copies?: { name: string; origin: string; recipe?: string } };
  line: string;
  editor: { harness: string; model: string; effort?: string } | null;
  row: PostedRow;
  reset?: { recipe: string; original: { name: string; origin: string } };
}

/** Waits until the extension has posted the single-task lines beyond the first `from`, and returns them as read. */
async function postedLines(from: number): Promise<{ lines: ListedLine[]; hidden: { name: string; original: { name: string; origin: string } }[] }> {
  const message = (await postedOf('singleTaskLines', from)) as { lines: { state: string; lines?: ListedLine[]; hidden?: [] } };
  assert.strictEqual(message.lines.state, 'read', JSON.stringify(message.lines));
  return { lines: message.lines.lines as ListedLine[], hidden: message.lines.hidden ?? [] };
}

test("the settings view lists the named single-task lines and carries out each line edit through the store, the looped run's names following", async () => {
  const home = process.env.HOME;
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-home-'));
  process.env.HOME = fakeHome;
  try {
    const root = project(LAMBDA);
    const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-recipes-'));
    fs.writeFileSync(path.join(files, 'GURITA_USAGE.md'), HARNESS_SHIPPED_TEXT);
    fs.writeFileSync(path.join(files, 'recipes.md'), LINE_OWN_TEXT);
    packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
    packaged.set('bundled/GURITA_USAGE.md', path.join(files, 'GURITA_USAGE.md'));
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
    /** Each listed line by its name, its origin, and the line it holds. */
    const rows = (listed: { lines: ListedLine[] }) => listed.lines.map((each) => [each.name, each.variant.origin, each.line]);
    /** Sends `message` and returns the line list posted after it, checking the variant list and the pages are posted again too. */
    const edit = async (message: unknown) => {
      const from = posted.length;
      send(message);
      const listed = await postedLines(from);
      await postedVariants(from);
      await postedOf('live', from);
      return listed;
    };
    /** The looped run's preview on LAMBDA's page: the names its override list offers. */
    const previewNames = async () => {
      const from = posted.length;
      send({ type: 'previewLoop', mission: LAMBDA, recipe: 'Execute tasks one at a time', variant: 'Execute tasks one at a time' });
      const preview = await postedOf('preview', from);
      assert.strictEqual((preview.result as { state: string }).state, 'read');
      return preview.names;
    };

    await entryAfter({ type: 'ready' }, LAMBDA, 'First run');
    let from = posted.length;
    send({ type: 'settingsOpened' });
    let listed = await postedLines(from);
    assert.deepStrictEqual(rows(listed), [
      [CC, 'shipped', ccLine],
      [AGY, 'shipped', agyLine],
      ['My own line', 'own', 'claude -p "/gurita:complete-task --mission <path> <Task Title>" --model "sonnet" --effort medium;'],
    ], 'the shipped lines and the own one, each with its line');
    assert.deepStrictEqual(listed.lines.map((each) => each.editor), [
      { harness: 'claude', model: 'opus', effort: 'high' },
      { harness: 'antigravity', model: 'claude-opus-5-5', effort: 'high' },
      { harness: 'claude', model: 'sonnet', effort: 'medium' },
    ]);
    assert.deepStrictEqual(listed.lines.map((each) => each.row), [
      { skill: 'complete-task', interactive: false, harness: 'claude' },
      { skill: 'complete-task', interactive: false, harness: 'antigravity' },
      { skill: 'complete-task', interactive: false, harness: 'claude' },
    ], 'each line is posted with its row');
    assert.ok(!fs.existsSync(store), 'opening the view writes nothing');

    // Duplicate: the name is asked for in one input box, which refuses an empty name and one a recipe or line carries.
    typedValues.push(' Single task (Sonnet) ');
    listed = await edit({ type: 'duplicateLine', line: CC, variant: { name: CC, origin: 'shipped' } });
    let box = inputBoxes[0];
    assert.strictEqual(inputBoxes.length, 1);
    assert.strictEqual(box.value, undefined, "a duplicate's box opens empty");
    assert.ok(box.validateInput !== undefined);
    assert.ok(box.validateInput(' ') !== undefined && box.validateInput(AGY) !== undefined && box.validateInput('First run') !== undefined);
    assert.strictEqual(box.validateInput('Single task (Sonnet)'), undefined);
    assert.deepStrictEqual(stored().variants, [{ recipe: 'Single task (Sonnet)', name: 'Single task (Sonnet)', lines: [ccLine] }]);
    assert.deepStrictEqual(rows(listed).map((each) => each[0]), [CC, AGY, 'My own line', 'Single task (Sonnet)']);
    assert.deepStrictEqual(await previewNames(), [CC, AGY, 'My own line', 'Single task (Sonnet)'], "the duplicate reaches the override list under its name");

    // Rename: the box opens on the current name; the shipped line gets a stored copy of the new name in its place.
    typedValues.push('Agy line');
    listed = await edit({ type: 'renameLine', line: AGY, variant: { name: AGY, origin: 'shipped' } });
    box = inputBoxes[1];
    assert.strictEqual(box.value, AGY, 'a rename opens with the current name filled in');
    assert.ok(box.validateInput !== undefined);
    assert.strictEqual(box.validateInput(AGY), undefined, 'the current name is no other line');
    assert.ok(box.validateInput(CC) !== undefined && box.validateInput('') !== undefined);
    assert.deepStrictEqual(rows(listed), [
      [CC, 'shipped', ccLine],
      ['Agy line', 'stored', agyLine],
      ['My own line', 'own', listed.lines[2].line],
      ['Single task (Sonnet)', 'stored', ccLine],
    ]);
    const renamed = listed.lines[1];
    assert.deepStrictEqual(renamed.reset, { recipe: AGY, original: { name: AGY, origin: 'shipped' } });
    assert.deepStrictEqual(await previewNames(), [CC, 'Agy line', 'My own line', 'Single task (Sonnet)'], 'the renamed line keeps its place');

    // A model or effort pick on the renamed line changes the stored copy in place.
    listed = await edit({ type: 'replaceLineValue', recipe: 'Agy line', variant: renamed.variant, line: 0, kind: 'effort', value: 'medium' });
    assert.strictEqual(listed.lines[1].line, agyLine.replace('--effort high', '--effort medium'));
    assert.strictEqual(stored().variants.length, 2);
    listed = await edit({ type: 'replaceLineValue', recipe: CC, variant: { name: CC, origin: 'shipped' }, line: 0, kind: 'model', value: 'fable' });
    assert.deepStrictEqual(rows(listed)[0], [CC, 'stored', ccLine.replace('"opus"', '"fable"')], 'a shipped line gets a stored copy under its name');

    // Delete: a stored copy of a shipped line leaves the store and hides it, listed with its reset.
    listed = await edit({ type: 'deleteLine', line: CC, variant: listed.lines[0].variant });
    assert.deepStrictEqual(rows(listed).map((each) => each[0]), ['Agy line', 'My own line', 'Single task (Sonnet)']);
    assert.deepStrictEqual(listed.hidden, [{ name: CC, original: { name: CC, origin: 'shipped' } }]);
    assert.deepStrictEqual(await previewNames(), ['Agy line', 'My own line', 'Single task (Sonnet)']);
    listed = await edit({ type: 'deleteLine', line: 'My own line', variant: { name: 'My own line', origin: 'own' } });
    assert.deepStrictEqual(stored().hidden, [{ recipe: CC, name: CC, origin: 'shipped' }, { recipe: 'My own line', name: 'My own line', origin: 'own' }]);

    // Reset: the deleted and renamed lines show again as their files hold them.
    await edit({ type: 'resetLine', line: CC, original: { name: CC, origin: 'shipped' } });
    await edit({ type: 'resetLine', line: 'My own line', original: { name: 'My own line', origin: 'own' } });
    listed = await edit({ type: 'resetLine', line: AGY, original: { name: AGY, origin: 'shipped' } });
    assert.deepStrictEqual(rows(listed).map((each) => [each[0], each[1]]), [
      [CC, 'shipped'],
      [AGY, 'shipped'],
      ['My own line', 'own'],
      ['Single task (Sonnet)', 'stored'],
    ]);
    assert.deepStrictEqual(listed.hidden, []);

    // The looped run passes every named line, the stored one included, as one --line.
    assert.deepStrictEqual(await previewNames(), [CC, AGY, 'My own line', 'Single task (Sonnet)']);
    const count = created.length;
    send({ type: 'startLoop', mission: LAMBDA, recipe: 'Execute tasks one at a time', overrides: {} });
    assert.strictEqual(created.length, count + 1);
    const args = created[created.length - 1].args;
    assert.deepStrictEqual(
      args.flatMap((arg, index) => (arg === '--line' ? [`${args[index + 1]}=${args[index + 2]}`] : [])),
      [`${CC}=${ccLine}`, `${AGY}=${agyLine}`, `My own line=${listed.lines[2].line}`, `Single task (Sonnet)=${ccLine}`],
    );

    // A dismissed box, a line the list does not hold, a chain named as a line, or a message not in form writes and posts nothing.
    const before = fs.readFileSync(store, 'utf8');
    const boxes = inputBoxes.length;
    from = posted.length;
    send({ type: 'renameLine', line: CC, variant: { name: CC, origin: 'shipped' } });
    send({ type: 'duplicateLine', line: 'No such line', variant: { name: 'No such line', origin: 'shipped' } });
    send({ type: 'deleteLine', line: 'First run', variant: { name: 'Claude Code', origin: 'shipped' } });
    send({ type: 'deleteLine', line: CC });
    send({ type: 'resetLine', line: CC, original: { name: CC, origin: 'shipped' } });
    send({ type: 'resetLine', line: CC, original: { name: CC, origin: 'elsewhere' } });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.strictEqual(inputBoxes.length, boxes + 1, 'only the rename of a listed line asks for a name');
    assert.deepStrictEqual(posted.slice(from), []);
    assert.strictEqual(fs.readFileSync(store, 'utf8'), before);

    assert.strictEqual(fs.readFileSync(path.join(files, 'recipes.md'), 'utf8'), LINE_OWN_TEXT, 'the own recipe file is never written');
    assert.strictEqual(fs.readFileSync(path.join(files, 'GURITA_USAGE.md'), 'utf8'), HARNESS_SHIPPED_TEXT, 'the shipped file is never written');
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
  answerWithRecommendation: 'claude -p "/gurita:answer-open-question-with-recommendation --mission <path> <Short Title>" --model "opus" --effort high;',
  answerWithAlternative: 'claude -p "/gurita:answer-open-question-with-alternative --mission <path> <Short Title>. <Alternative Id>" --model "fable" --effort medium;',
  discussGoal: 'claude "/gurita:discuss-mission-goal <goal>" --model "fable" --effort xhigh; # interactive',
  defineMission: 'claude -p "/gurita:define-mission-goal --at <scope> <goal>" --model "sonnet" --effort medium;',
  discussTask: 'claude "/gurita:discuss-new-task --mission <path> <issue description>" --model "opus" --effort xhigh; # interactive',
};

/** The fixed name of the recipe each button runs. */
const BUTTON_NAMES: Record<string, string> = {
  discussQuestion: 'discuss-open-question',
  answerQuestion: 'answer-open-question',
  answerWithRecommendation: 'answer-open-question-with-recommendation',
  answerWithAlternative: 'answer-open-question-with-alternative',
  discussGoal: 'discuss-mission-goal',
  defineMission: 'define-mission-goal',
  discussTask: 'discuss-new-task',
};

/** The shipped file of the fixed-button test: the recipe-list test's recipes and the seven button recipes. */
const BUTTON_SHIPPED_TEXT = `${SHIPPED_TEXT}${Object.keys(BUTTON_LINES)
  .map((key) => `\n### ${BUTTON_NAMES[key]}\n\`\`\`\n${BUTTON_LINES[key]}\n\`\`\`\n`)
  .join('')}`;

/** The own file of the fixed-button test: one more variant for three of the button recipes. */
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
`;

/** What a fixed-name button is posted as running: the variants its dropdown offers, the one selected, and that variant's lines and the values they carry. */
type PostedButton =
  | {
      state: 'offered';
      lines: string[];
      values: { harnesses: string[]; models: string[]; efforts: string[] };
      variants: { name: string; own: boolean }[];
      selected: number;
    }
  | { state: 'disabled'; cause: string };

/** The live message's fixed-name buttons: the two mission-starting ones posted with the pages, the others with each mission. */
interface ButtonsLive {
  missions: { path: string; buttons: Record<string, PostedButton> }[];
  buttons: Record<string, PostedButton>;
}

/** The fixed-name buttons a live message posts for the page of `mission`, the two mission-starting ones beside them; a failure message's two alone. */
function postedButtons(message: Record<string, unknown>, mission: string): Record<string, PostedButton> {
  const live = message as unknown as ButtonsLive;
  if (message.type !== 'live') {
    return { ...live.buttons };
  }
  const page = live.missions.find((each) => each.path === mission);
  assert.ok(page !== undefined, `no page of ${mission}`);
  return { ...live.buttons, ...page.buttons };
}

test("every fixed-name button is posted with the variants it can run and the lines and values of the one selected, following a default picked in the settings view, in the failure state too", async () => {
  const home = process.env.HOME;
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-home-'));
  process.env.HOME = fakeHome;
  try {
    const root = project(MU);
    const files = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-pane-recipes-'));
    fs.writeFileSync(path.join(files, 'GURITA_USAGE.md'), BUTTON_SHIPPED_TEXT);
    fs.writeFileSync(path.join(files, 'recipes.md'), BUTTON_OWN_TEXT);
    packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
    packaged.set('bundled/GURITA_USAGE.md', path.join(files, 'GURITA_USAGE.md'));
    packaged.set('runner.py', path.join(__dirname, '..', '..', 'runner.py'));
    workspace.folders = [{ uri: { fsPath: root } }];
    workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
    workspaceState.clear();
    /** Sends `message` and returns the buttons of the next message of `type` posted after it. */
    const buttonsAfter = async (message: unknown, type = 'live') => {
      const from = posted.length;
      send(message);
      return postedButtons(await postedOf(type, from), MU);
    };
    const shipped = (key: string, harnesses: string[], models: string[], efforts: string[], own = false): PostedButton => ({
      state: 'offered',
      lines: [BUTTON_LINES[key]],
      values: { harnesses, models, efforts },
      variants: own ? [{ name: BUTTON_NAMES[key], own: false }, { name: BUTTON_NAMES[key], own: true }] : [{ name: BUTTON_NAMES[key], own: false }],
      selected: 0,
    });
    const initial: Record<string, PostedButton> = {
      discussGoal: shipped('discussGoal', ['claude'], ['fable'], ['xhigh']),
      defineMission: shipped('defineMission', ['claude'], ['sonnet'], ['medium'], true),
      discussQuestion: shipped('discussQuestion', ['claude'], ['fable'], ['xhigh'], true),
      answerQuestion: shipped('answerQuestion', ['claude'], ['fable'], ['high']),
      answerWithRecommendation: shipped('answerWithRecommendation', ['claude'], ['opus'], ['high']),
      answerWithAlternative: shipped('answerWithAlternative', ['claude'], ['fable'], ['medium']),
      discussTask: shipped('discussTask', ['claude'], ['opus'], ['xhigh']),
    };

    assert.deepStrictEqual(
      await buttonsAfter({ type: 'ready' }),
      initial,
      'with no pick each button stands on its first listed variant, the shipped one, an own variant the button cannot run left out of its dropdown',
    );
    send({ type: 'settingsOpened' });

    // A pick of a two-line own variant: the button stands on it, carrying both lines and their distinct values.
    let buttons = await buttonsAfter({ type: 'pickDefault', recipe: 'discuss-open-question', variant: { name: 'discuss-open-question', origin: 'own' } });
    assert.deepStrictEqual(buttons.discussQuestion, {
      ...(initial.discussQuestion as object),
      lines: BUTTON_OWN_TEXT.split('\n').slice(2, 4),
      values: { harnesses: ['agy', 'claude'], models: ['gemini-4-argon', 'opus'], efforts: ['medium', 'high'] },
      selected: 1,
    });
    assert.deepStrictEqual({ ...buttons, discussQuestion: undefined }, { ...initial, discussQuestion: undefined }, 'the other buttons stay as they were');

    // A pick of a variant of no readable line: its lines with no value, so the button shows its name alone.
    buttons = await buttonsAfter({ type: 'pickDefault', recipe: 'define-mission-goal', variant: { name: 'define-mission-goal', origin: 'own' } });
    assert.deepStrictEqual(buttons.defineMission, { ...(initial.defineMission as object), lines: ['echo <goal> <scope>'], values: { harnesses: [], models: [], efforts: [] }, selected: 1 });

    // A pick of a variant the button cannot run: it stays out of the dropdown, which stands on the first variant offered.
    buttons = await buttonsAfter({ type: 'pickDefault', recipe: 'discuss-new-task', variant: { name: 'discuss-new-task', origin: 'own' } });
    assert.deepStrictEqual(buttons.discussTask, initial.discussTask);
    assert.deepStrictEqual(buttons.discussQuestion.state === 'offered' && buttons.discussQuestion.selected, 1, 'every earlier pick still stands');

    // Disabling a harness leaves its variants out of the buttons' dropdowns, the default giving way to the first offered.
    buttons = await buttonsAfter({ type: 'setHarnessEnabled', harness: 'antigravity', enabled: false });
    assert.deepStrictEqual(buttons.discussQuestion, shipped('discussQuestion', ['claude'], ['fable'], ['xhigh']));
    buttons = await buttonsAfter({ type: 'setHarnessEnabled', harness: 'antigravity', enabled: true });
    assert.deepStrictEqual(buttons.discussQuestion.state === 'offered' && buttons.discussQuestion.selected, 1, 'enabled again, the default comes back');

    // The failure state carries the two mission-starting buttons, and an edit made while it stands posts it again with them.
    workspace.folders = undefined;
    buttons = await buttonsAfter({ type: 'refresh' }, 'liveFailure');
    assert.deepStrictEqual(Object.keys(buttons), ['discussGoal', 'defineMission']);
    assert.deepStrictEqual(buttons.defineMission, { ...(initial.defineMission as object), lines: ['echo <goal> <scope>'], values: { harnesses: [], models: [], efforts: [] }, selected: 1 });
    buttons = await buttonsAfter({ type: 'pickDefault', recipe: 'define-mission-goal', variant: { name: 'define-mission-goal', origin: 'shipped' } }, 'liveFailure');
    assert.deepStrictEqual(buttons.defineMission, initial.defineMission, 'the failure state follows the default picked');
    workspace.folders = [{ uri: { fsPath: root } }];
    buttons = await buttonsAfter({ type: 'refresh' });
    assert.deepStrictEqual(buttons.defineMission, initial.defineMission);
    assert.deepStrictEqual(buttons.discussTask, initial.discussTask);

    // A click runs the variant the label shows.
    const count = created.length;
    typedValues.push('A goal');
    send({ type: 'missionButton', button: 'discussGoal', variant: 'discuss-mission-goal' });
    for (let attempt = 0; attempt < 200 && created.length === count; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.strictEqual(created.length, count + 1);
    assert.match(created[created.length - 1].args.join(' '), / chain -- claude "\/gurita:discuss-mission-goal/);
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

test("a fixed-name button's dropdown selection is remembered in workspaceState, per recipe on its mission and once per project for the mission-starting buttons, wins over the default, and is dropped once gone", async () => {
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
    fs.writeFileSync(path.join(files, 'GURITA_USAGE.md'), BUTTON_SHIPPED_TEXT);
    fs.writeFileSync(path.join(files, 'recipes.md'), SELECTION_OWN_TEXT);
    packaged.set('bundled/missions.py', path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py'));
    packaged.set('bundled/GURITA_USAGE.md', path.join(files, 'GURITA_USAGE.md'));
    packaged.set('runner.py', path.join(__dirname, '..', '..', 'runner.py'));
    workspace.folders = [{ uri: { fsPath: root } }];
    workspace.settings = { ownRecipesFile: path.join(files, 'recipes.md') };
    workspaceState.clear();
    /** Sends `message` and returns the next live message posted after it. */
    const liveAfter = async (message: unknown) => {
      const from = posted.length;
      send(message);
      return postedOf('live', from);
    };
    /** The names a button's dropdown offers and the one it stands on, as `message` posts it for `mission`. */
    const dropdown = (message: Record<string, unknown>, mission: string, key: string): [string[], string] => {
      const entry = postedButtons(message, mission)[key];
      assert.ok(entry.state === 'offered', `${key} offers variants`);
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

    let live = await liveAfter({ type: 'ready' });
    assert.deepStrictEqual(dropdown(live, NU, 'discussQuestion'), [['discuss-open-question', 'Gemini'], 'discuss-open-question'], 'with nothing remembered the dropdown stands on the default');
    assert.deepStrictEqual(dropdown(live, NU, 'answerWithAlternative'), [['answer-open-question-with-alternative', 'Sonnet'], 'answer-open-question-with-alternative']);
    assert.deepStrictEqual(dropdown(live, NU, 'discussGoal'), [['discuss-mission-goal', 'Opus'], 'discuss-mission-goal']);
    assert.deepStrictEqual(dropdown(live, NU, 'discussTask'), [['discuss-new-task'], 'discuss-new-task'], 'a looped variant the button cannot run is not offered');

    // A selection on a mission's page is remembered per recipe on that mission.
    live = await liveAfter({ type: 'selectButtonVariant', button: 'discussQuestion', mission: NU, variant: 'Gemini' });
    assert.deepStrictEqual(workspaceState.get('gurita.variantSelections'), { [NU]: { 'discuss-open-question': 'Gemini' } });
    assert.deepStrictEqual(dropdown(live, NU, 'discussQuestion'), [['discuss-open-question', 'Gemini'], 'Gemini'], 'a remembered selection wins over the default');
    assert.deepStrictEqual(dropdown(live, XI, 'discussQuestion')[1], 'discuss-open-question', "another mission's page keeps its own selection");
    const entry = postedButtons(live, NU).discussQuestion;
    assert.ok(entry.state === 'offered');
    assert.deepStrictEqual(entry.lines, [SELECTION_OWN_TEXT.split('\n')[3]], 'the label and hover text follow the selection');
    assert.deepStrictEqual(entry.values, { harnesses: ['agy'], models: ['gemini-4-argon'], efforts: ['medium'] });
    live = await liveAfter({ type: 'selectButtonVariant', button: 'answerWithAlternative', mission: NU, variant: 'Sonnet' });
    assert.deepStrictEqual(workspaceState.get('gurita.variantSelections'), { [NU]: { 'discuss-open-question': 'Gemini', 'answer-open-question-with-alternative': 'Sonnet' } });
    assert.deepStrictEqual(dropdown(live, NU, 'answerWithAlternative')[1], 'Sonnet', "the card's one dropdown for its alternatives stands on it");
    for (const mission of [OMICRON, PI]) {
      await liveAfter({ type: 'selectButtonVariant', button: 'answerWithAlternative', mission, variant: 'Sonnet' });
    }
    live = await liveAfter({ type: 'selectButtonVariant', button: 'discussQuestion', mission: RHO, variant: 'Gemini' });
    const remembered = () => workspaceState.get('gurita.variantSelections') as Record<string, Record<string, string>>;
    assert.deepStrictEqual(remembered()[RHO], { 'discuss-open-question': 'Gemini' });

    // A mission-starting button's selection is remembered once per project.
    live = await liveAfter({ type: 'selectButtonVariant', button: 'discussGoal', variant: 'Opus' });
    assert.deepStrictEqual(workspaceState.get('gurita.projectVariantSelections'), { 'discuss-mission-goal': 'Opus' });
    assert.deepStrictEqual(dropdown(live, NU, 'discussGoal')[1], 'Opus');
    live = await liveAfter({ type: 'refresh' });
    assert.deepStrictEqual(dropdown(live, XI, 'discussGoal')[1], 'Opus', 'the selection is remembered through a re-read');
    assert.deepStrictEqual(dropdown(live, NU, 'discussQuestion')[1], 'Gemini');

    // A pick the latest answer did not post is remembered nowhere.
    const before = JSON.stringify([workspaceState.get('gurita.variantSelections'), workspaceState.get('gurita.projectVariantSelections')]);
    const from = posted.length;
    send({ type: 'selectButtonVariant', button: 'discussQuestion', mission: NU, variant: 'No such variant' });
    send({ type: 'selectButtonVariant', button: 'discussTask', mission: NU, variant: 'Looped' });
    send({ type: 'selectButtonVariant', button: 'discussQuestion', mission: 'other/mission_zeta/', variant: 'Gemini' });
    send({ type: 'selectButtonVariant', button: 'noSuchButton', mission: NU, variant: 'Gemini' });
    send({ type: 'selectButtonVariant', button: 'defineMission', variant: 'Opus' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.strictEqual(JSON.stringify([workspaceState.get('gurita.variantSelections'), workspaceState.get('gurita.projectVariantSelections')]), before);
    assert.deepStrictEqual(posted.slice(from), [], 'nor posts the pages again');

    // A click runs the variant selected, and only when the latest answer posted the button standing on it.
    assert.strictEqual(await click({ type: 'questionButton', button: 'discussQuestion', mission: NU, question: 'Pane Layout', variant: 'discuss-open-question' }, ['']), undefined, 'a variant the button was not posted standing on starts nothing');
    assert.strictEqual(await click({ type: 'questionButton', button: 'discussQuestion', mission: NU, question: 'Pane Layout' }, ['']), undefined, 'nor does a click naming none');
    assert.strictEqual(await click({ type: 'taskButton', mission: NU, variant: 'Looped' }, ['An issue']), undefined, 'nor one naming a variant the button does not offer');
    assert.match((await click({ type: 'questionButton', button: 'discussQuestion', mission: NU, question: 'Pane Layout', variant: 'Gemini' }, [''])) ?? '', / chain -- agy -i "\/gurita:discuss-open-question/);
    assert.strictEqual(await click({ type: 'alternativeButton', mission: XI, question: 'Pane Layout', alternative: 'drop', variant: 'Sonnet' }), undefined, "another mission's page keeps its own selection");
    assert.match((await click({ type: 'questionButton', button: 'discussQuestion', mission: XI, question: 'Pane Layout', variant: 'discuss-open-question' }, [''])) ?? '', / chain -- claude "\/gurita:discuss-open-question/, 'and runs it');
    assert.match((await click({ type: 'alternativeButton', mission: OMICRON, question: 'Pane Layout', alternative: 'drop', variant: 'Sonnet' })) ?? '', /--model "sonnet"/, "the card's alternatives share one selection");
    assert.match((await click({ type: 'alternativeButton', mission: PI, question: 'Pane Layout', alternative: 'keep', variant: 'Sonnet' })) ?? '', /--model "sonnet"/);
    assert.strictEqual(await click({ type: 'missionButton', button: 'discussGoal', variant: 'discuss-mission-goal' }, ['A goal']), undefined);
    assert.match((await click({ type: 'missionButton', button: 'discussGoal', variant: 'Opus' }, ['A goal'])) ?? '', / chain -- claude "\/gurita:discuss-mission-goal \${GURITA_GOAL}" --model "opus"/);

    // A default picked in the settings view leaves every remembered selection standing.
    send({ type: 'settingsOpened' });
    live = await liveAfter({ type: 'pickDefault', recipe: 'discuss-mission-goal', variant: { name: 'discuss-mission-goal', origin: 'shipped' } });
    assert.deepStrictEqual(dropdown(live, NU, 'discussGoal')[1], 'Opus');

    // Disabling the harness of a remembered variant gives way to the default and keeps the selection for when it is enabled again.
    live = await liveAfter({ type: 'setHarnessEnabled', harness: 'antigravity', enabled: false });
    assert.deepStrictEqual(dropdown(live, RHO, 'discussQuestion'), [['discuss-open-question'], 'discuss-open-question']);
    assert.deepStrictEqual(remembered()[RHO], { 'discuss-open-question': 'Gemini' }, 'the remembered selection is kept');
    assert.strictEqual(await click({ type: 'questionButton', button: 'discussQuestion', mission: RHO, question: 'Pane Layout', variant: 'Gemini' }, ['']), undefined, 'a variant left out for a disabled harness starts nothing');
    live = await liveAfter({ type: 'setHarnessEnabled', harness: 'antigravity', enabled: true });
    assert.deepStrictEqual(dropdown(live, RHO, 'discussQuestion')[1], 'Gemini', 'enabled again, the remembered selection comes back');
    assert.match((await click({ type: 'taskButton', mission: RHO, variant: 'discuss-new-task' }, ['An issue'])) ?? '', / chain -- claude "\/gurita:discuss-new-task/);

    // The remembered variants go from the own file: they are dropped and the buttons fall back to the default.
    fs.writeFileSync(path.join(files, 'recipes.md'), '');
    live = await liveAfter({ type: 'refresh' });
    assert.deepStrictEqual(dropdown(live, NU, 'discussQuestion'), [['discuss-open-question'], 'discuss-open-question']);
    assert.deepStrictEqual(dropdown(live, NU, 'discussGoal'), [['discuss-mission-goal'], 'discuss-mission-goal']);
    assert.deepStrictEqual(workspaceState.get('gurita.variantSelections'), {}, 'the remembered variants are dropped');
    assert.deepStrictEqual(workspaceState.get('gurita.projectVariantSelections'), {});

    // A mission-starting button's selection reaches the failure state too.
    fs.writeFileSync(path.join(files, 'recipes.md'), SELECTION_OWN_TEXT);
    workspace.folders = undefined;
    let failure = await (async () => {
      const at = posted.length;
      send({ type: 'refresh' });
      return postedOf('liveFailure', at);
    })();
    assert.deepStrictEqual(dropdown(failure, NU, 'discussGoal'), [['discuss-mission-goal', 'Opus'], 'discuss-mission-goal']);
    const at = posted.length;
    send({ type: 'selectButtonVariant', button: 'discussGoal', variant: 'Opus' });
    failure = await postedOf('liveFailure', at);
    assert.deepStrictEqual(dropdown(failure, NU, 'discussGoal')[1], 'Opus', 'a selection made in the failure state is posted with it again');
    assert.deepStrictEqual(workspaceState.get('gurita.projectVariantSelections'), { 'discuss-mission-goal': 'Opus' });
    assert.match((await click({ type: 'missionButton', button: 'discussGoal', variant: 'Opus' }, ['A goal'])) ?? '', /--model "opus"/);
    workspace.folders = [{ uri: { fsPath: root } }];
    assert.strictEqual(execFileSync('git', ['status', '--porcelain', '--ignored'], { cwd: root, encoding: 'utf8' }), '', "nothing is written into the project's tree");
  } finally {
    process.env.HOME = home;
  }
});
