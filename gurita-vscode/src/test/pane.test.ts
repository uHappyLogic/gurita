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
/** The options of a box the stub's editor showed: its prompt and its validation. */
interface InputBoxOptions {
  prompt?: string;
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
    const live = (await postedOf('live', from)) as { missions: { path: string; recipes: { recipes: PostedEntry[] } }[] };
    const narrowed = live.missions.find((each) => each.path === THETA)?.recipes.recipes ?? [];
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

    // The fixed-name button runs its recipe's Antigravity line as before.
    typedValues.push('A goal');
    send({ type: 'missionButton', button: 'discussGoal' });
    for (let attempt = 0; attempt < 200 && created.length === count; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.deepStrictEqual(created.slice(count).map((terminal) => terminal.name), ['Gurita: discuss-mission-goal']);
    assert.match(created[created.length - 1].args.join(' '), /^\S+ chain -- agy /);

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
    const again = (await postedOf('live', from)) as { missions: { path: string; recipes: { recipes: PostedEntry[] } }[] };
    assert.deepStrictEqual(
      shown(again.missions.find((each) => each.path === THETA)?.recipes.recipes ?? [])[0],
      ['First run', ['Claude Code', 'Antigravity'], 'Antigravity'],
      'enabled again, the remembered selection comes back',
    );

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
