import { test } from 'node:test';
import * as assert from 'node:assert';
// The run path against a stub of the `vscode` module, standing in for the editor: the terminals it
// creates, the terminal-close event, the notifications, and the `gurita` settings, and a stub of
// `node:child_process` standing in for `open`, the opener a send to Claude Desktop calls.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { rewriteHarness } from '../lineValues';
import { isHeadless, parseShippedRecipes } from '../recipes';

const SHIPPED_RECIPES = path.join(__dirname, '..', '..', 'shipped_recipes.md');
const Module = require('node:module') as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};

interface StubTerminal {
  name: string;
  shown: number;
  args?: string[];
  env?: Record<string, string>;
}

/** The `gurita` settings the stub answers with, a key absent standing for a setting left unset. */
const settings: Record<string, unknown> = {};

const created: StubTerminal[] = [];
const notifications: string[] = [];
const errors: string[] = [];

/** Every call the stubbed opener received, and the error and standard error its next call fails with, or none. */
const opened: { file: string; args: string[] }[] = [];
let failOpen: { error: Error; stderr: string } | undefined;
const childProcess = {
  execFile(file: string, args: string[], callback: (error: Error | null, stdout: string, stderr: string) => void): void {
    opened.push({ file, args: [...args] });
    const failure = failOpen;
    setImmediate(() => (failure === undefined ? callback(null, '', '') : callback(failure.error, '', failure.stderr)));
  },
};
let closeListener: ((terminal: StubTerminal) => void) | undefined;

const stub = {
  window: {
    createTerminal(options: { name: string; shellArgs?: string[]; env?: Record<string, string> }): StubTerminal {
      const terminal = { name: options.name, shown: 0, args: [...(options.shellArgs ?? [])], env: { ...(options.env ?? {}) }, show(): void {} };
      terminal.show = () => {
        terminal.shown += 1;
      };
      created.push(terminal);
      return terminal;
    },
    onDidCloseTerminal(listener: (terminal: StubTerminal) => void): { dispose(): void } {
      closeListener = listener;
      return { dispose(): void {} };
    },
    showInformationMessage(message: string): Promise<undefined> {
      notifications.push(message);
      return Promise.resolve(undefined);
    },
    showErrorMessage(message: string): Promise<undefined> {
      errors.push(message);
      return Promise.resolve(undefined);
    },
  },
  workspace: {
    getConfiguration(section: string): { get(key: string, fallback?: unknown): unknown } {
      assert.strictEqual(section, 'gurita');
      return { get: (key: string, fallback?: unknown) => (key in settings ? settings[key] : fallback) };
    },
  },
};

const load = Module._load;
Module._load = (request, parent, isMain) =>
  request === 'vscode' ? stub : request === 'node:child_process' ? childProcess : load(request, parent, isMain);
const runs = require('../runs') as typeof import('../runs');
Module._load = load;
const { FINISHED_POLL_MS } = require('../desktop') as typeof import('../desktop');

const context = {
  subscriptions: [] as unknown[],
  asAbsolutePath: (file: string) => `/extension/${file}`,
} as unknown as import('vscode').ExtensionContext;

const events: string[] = [];
runs.registerRuns(context, {
  started: () => events.push(`started ${runs.runningMissions().join(',')}`),
  ended: () => events.push(`ended ${runs.runningMissions().join(',')}`),
});

function close(terminal: StubTerminal): void {
  assert.ok(closeListener !== undefined);
  closeListener(terminal);
}

test("a mission's run is posted as held when it starts and as cleared when its terminal closes", () => {
  events.length = 0;
  runs.startChain(context, '/project', 'lib/mission_alpha/', 'review', ['echo review'], { path: 'lib/mission_alpha/' });
  const alpha = created[created.length - 1];
  assert.deepStrictEqual(events, ['started lib/mission_alpha/']);
  assert.deepStrictEqual(runs.runningMissions(), ['lib/mission_alpha/']);

  runs.startChain(context, '/project', 'mission_beta/', 'review', ['echo review'], { path: 'mission_beta/' });
  const beta = created[created.length - 1];
  assert.deepStrictEqual(runs.runningMissions(), ['lib/mission_alpha/', 'mission_beta/']);

  close(alpha);
  assert.deepStrictEqual(events, ['started lib/mission_alpha/', 'started lib/mission_alpha/,mission_beta/', 'ended mission_beta/']);
  assert.deepStrictEqual(runs.runningMissions(), ['mission_beta/']);
  close(beta);
  assert.deepStrictEqual(runs.runningMissions(), []);
});

test('a click that reaches the extension while its mission runs is refused, as the fallback', () => {
  notifications.length = 0;
  runs.startChain(context, '/project', 'lib/mission_alpha/', 'review', ['echo review'], { path: 'lib/mission_alpha/' });
  const alpha = created[created.length - 1];
  const count = created.length;
  const shown = alpha.shown;
  events.length = 0;
  runs.startChain(context, '/project', 'lib/mission_alpha/', 'review', ['echo review'], { path: 'lib/mission_alpha/' });
  assert.strictEqual(created.length, count);
  assert.deepStrictEqual(notifications, [runs.ALREADY_RUNNING]);
  assert.strictEqual(alpha.shown, shown + 1);
  assert.deepStrictEqual(events, []);
  assert.strictEqual(runs.startLoop('/project', 'lib/mission_alpha/', 'complete', ['/extension/runner.py', 'loop']), false);
  assert.strictEqual(created.length, count);
  close(alpha);
  assert.deepStrictEqual(runs.runningMissions(), []);
});

test('a mission-starting run holds no mission and is still posted', () => {
  events.length = 0;
  runs.startChain(context, '/project', undefined, 'define', ['echo define'], { goal: 'A goal', scope: '.' });
  const starting = created[created.length - 1];
  assert.deepStrictEqual(events, ['started ']);
  assert.deepStrictEqual(runs.runningMissions(), []);
  close(starting);
  assert.deepStrictEqual(events, ['started ', 'ended ']);
});

test("a closed terminal the extension never started is not the end of a run", () => {
  events.length = 0;
  close({ name: 'another', shown: 0 });
  assert.deepStrictEqual(events, []);
});

const DESKTOP_LINE = 'claude-desktop "/gurita:discuss-open-question --mission <path> <Short Title>. <note>"; # interactive';

test('an action of one claude-desktop line is sent to Claude Desktop through open, with its values written in, and no run is tracked', async () => {
  events.length = 0;
  opened.length = 0;
  errors.length = 0;
  notifications.length = 0;
  const count = created.length;
  let closedCalls = 0;
  await runs.startAction(
    context,
    '/my project',
    'lib/mission_alpha/',
    'discuss-open-question',
    [DESKTOP_LINE],
    { path: 'lib/mission_alpha/', 'Short Title': 'Pane Layout', note: 'Keep it short' },
    () => closedCalls++,
  );
  assert.deepStrictEqual(opened, [
    {
      file: 'open',
      args: ['claude://code/new?q=%2Fgurita%3Adiscuss-open-question%20--mission%20lib%2Fmission_alpha%2F%20Pane%20Layout.%20Keep%20it%20short&folder=%2Fmy%20project'],
    },
  ], 'one open child, the link carrying the prompt with its values written in and the root as folder');
  assert.strictEqual(created.length, count, 'no terminal is created, so the runner never sees the line');
  assert.deepStrictEqual(runs.runningMissions(), [], 'no run is held for the mission');
  assert.deepStrictEqual(events, [], 'no run is posted as started');
  assert.deepStrictEqual(errors, [], 'a send that went out shows nothing');
  assert.deepStrictEqual(notifications, []);
  assert.strictEqual(closedCalls, 0);

  // Nothing is held, so a second send for the same mission goes out too.
  await runs.startAction(context, '/my project', 'lib/mission_alpha/', 'discuss-open-question', [DESKTOP_LINE], { path: 'lib/mission_alpha/', 'Short Title': 'Pane Layout', note: '' });
  assert.strictEqual(opened.length, 2);
  assert.strictEqual(
    new URL(opened[1].args[0]).searchParams.get('q'),
    '/gurita:discuss-open-question --mission lib/mission_alpha/ Pane Layout',
    'an empty note is dropped from the prompt',
  );
  assert.strictEqual(created.length, count);
});

test("Finish mission's headless line, picked onto Claude Desktop, is sent to it with the finish prompt and the project root, and no run is tracked", async () => {
  events.length = 0;
  opened.length = 0;
  errors.length = 0;
  notifications.length = 0;
  const count = created.length;
  const shipped = parseShippedRecipes(fs.readFileSync(SHIPPED_RECIPES, 'utf8'), SHIPPED_RECIPES);
  const finish = shipped.find((recipe) => recipe.name === 'Finish mission')?.variants[0].lines[0] as string;
  assert.ok(isHeadless(finish), 'the shipped Finish mission line is headless');
  const line = rewriteHarness(finish, 'claude-desktop', { models: [], efforts: [] }) as string;
  assert.strictEqual(line, 'claude-desktop "/gurita:finish-mission --mission <path>"; # interactive');
  await runs.startAction(context, '/my project', 'lib/mission_alpha/', 'Finish mission', [line], { path: 'lib/mission_alpha/' });
  assert.deepStrictEqual(opened, [
    { file: 'open', args: ['claude://code/new?q=%2Fgurita%3Afinish-mission%20--mission%20lib%2Fmission_alpha%2F&folder=%2Fmy%20project'] },
  ]);
  assert.strictEqual(new URL(opened[0].args[0]).searchParams.get('q'), '/gurita:finish-mission --mission lib/mission_alpha/');
  assert.strictEqual(created.length, count, 'no terminal is created');
  assert.deepStrictEqual(runs.runningMissions(), []);
  assert.deepStrictEqual(events, []);
  assert.deepStrictEqual(errors, []);
  assert.deepStrictEqual(notifications, []);
});

test('a failed send is shown as one error notification carrying the cause the opener reported, and nothing is checked beforehand', async () => {
  opened.length = 0;
  errors.length = 0;
  const count = created.length;
  failOpen = { error: new Error('Command failed: open claude://code/new'), stderr: 'No application knows how to open URL claude://code/new?q=x.\n' };
  try {
    await runs.startAction(context, '/project', 'mission_beta/', 'Execute tasks', ['claude-desktop "/gurita:complete-all-tasks --mission <path>"; # interactive'], { path: 'mission_beta/' });
  } finally {
    failOpen = undefined;
  }
  assert.strictEqual(opened.length, 1, 'the send is the one call made');
  assert.deepStrictEqual(errors, [
    'The action "Execute tasks" could not be sent to Claude Desktop: No application knows how to open URL claude://code/new?q=x.',
  ]);
  assert.strictEqual(errors[0], runs.desktopSendFailed('Execute tasks', 'No application knows how to open URL claude://code/new?q=x.'));
  assert.strictEqual(created.length, count, 'a failed send starts no run in its place');
  assert.deepStrictEqual(runs.runningMissions(), []);
});

test('every other action starts its chain as before, a Desktop line in a chain of several lines included, and a send for a mission whose run is going is refused', async () => {
  opened.length = 0;
  notifications.length = 0;
  await runs.startAction(context, '/project', 'mission_gamma/', 'review', ['echo review'], { path: 'mission_gamma/' });
  const chain = created[created.length - 1];
  assert.deepStrictEqual(chain.args?.slice(-2), ['--', 'echo review']);
  assert.deepStrictEqual(runs.runningMissions(), ['mission_gamma/']);
  await runs.startAction(context, '/project', 'mission_gamma/', 'discuss-open-question', [DESKTOP_LINE], { path: 'mission_gamma/', 'Short Title': 'x', note: '' });
  assert.deepStrictEqual(opened, [], 'nothing is sent while the mission runs');
  assert.deepStrictEqual(notifications, [runs.ALREADY_RUNNING]);
  close(chain);
  await runs.startAction(context, '/project', 'mission_gamma/', 'two', [DESKTOP_LINE, 'echo after'], { path: 'mission_gamma/', 'Short Title': 'x', note: '' });
  assert.deepStrictEqual(opened, []);
  const two = created[created.length - 1];
  assert.strictEqual(two.args?.[two.args.length - 1], 'echo after');
  close(two);
});

/** The `discuss-open-question` values whose prompt, sent from `DESKTOP_LINE`, is exactly `length` characters long. */
function valuesOfPromptLength(length: number): Record<string, string> {
  const base = '/gurita:discuss-open-question --mission mission_delta/ Pane Layout. ';
  return { path: 'mission_delta/', 'Short Title': 'Pane Layout', note: 'n'.repeat(length - base.length) };
}

test('a prompt at the 14,336 characters Claude Desktop accepts is sent to it as usual, with no notice', async () => {
  opened.length = 0;
  notifications.length = 0;
  errors.length = 0;
  events.length = 0;
  const count = created.length;
  const values = valuesOfPromptLength(14336);
  await runs.startAction(context, '/project', 'mission_delta/', 'discuss-open-question', [DESKTOP_LINE], values);
  assert.strictEqual(opened.length, 1, 'the prompt at the limit goes to Claude Desktop');
  const sent = new URL(opened[0].args[0]).searchParams.get('q');
  assert.strictEqual(sent?.length, 14336);
  assert.strictEqual(sent, `/gurita:discuss-open-question --mission mission_delta/ Pane Layout. ${values.note}`);
  assert.strictEqual(created.length, count, 'no terminal is created');
  assert.deepStrictEqual(runs.runningMissions(), []);
  assert.deepStrictEqual(events, []);
  assert.deepStrictEqual(notifications, [], 'no notice');
  assert.deepStrictEqual(errors, []);
});

test('a prompt past the limit is not sent: the one-line claude chain starts as a tracked run with its values typed, and one notice says it was too long', async () => {
  opened.length = 0;
  notifications.length = 0;
  errors.length = 0;
  events.length = 0;
  const count = created.length;
  const values = valuesOfPromptLength(14337);
  let closedCalls = 0;
  await runs.startAction(context, '/project', 'mission_delta/', 'discuss-open-question', [DESKTOP_LINE], values, () => closedCalls++);
  assert.deepStrictEqual(opened, [], 'nothing is sent to Claude Desktop');
  assert.strictEqual(created.length, count + 1, 'one terminal is created, without asking');
  const terminal = created[created.length - 1];
  assert.deepStrictEqual(terminal.args, [
    '/extension/runner.py',
    'chain',
    '--close-when-finished',
    '--',
    'claude "/gurita:discuss-open-question --mission ${GURITA_PATH} ${GURITA_SHORT_TITLE}. ${GURITA_NOTE}"; # interactive',
  ], 'an ordinary one-line chain of the Desktop line opening with claude, built as every run line is');
  assert.deepStrictEqual(terminal.env, {
    GURITA_PATH: 'mission_delta/',
    GURITA_SHORT_TITLE: 'Pane Layout',
    GURITA_NOTE: values.note,
  }, 'the values are typed, set in the terminal environment');
  assert.strictEqual(terminal.name, 'Gurita: discuss-open-question (mission_delta/)');
  assert.deepStrictEqual(runs.runningMissions(), ['mission_delta/'], 'the run is tracked for its mission');
  assert.deepStrictEqual(events, ['started mission_delta/']);
  assert.deepStrictEqual(notifications, [runs.desktopPromptTooLong('discuss-open-question', 14337)], 'one notice');
  assert.strictEqual(
    notifications[0],
    'The prompt of the action "discuss-open-question" is too long for Claude Desktop (14,337 characters, past its limit of 14,336), so it runs in a terminal instead.',
  );
  assert.deepStrictEqual(errors, []);
  close(terminal);
  assert.strictEqual(closedCalls, 1, "the starter's close callback is called as for any run");
  assert.deepStrictEqual(runs.runningMissions(), []);
});

/** Waits until `condition` holds, failing with `message` after two seconds. */
async function until(condition: () => boolean, message: string): Promise<void> {
  const deadline = Date.now() + 2000;
  while (!condition()) {
    if (Date.now() > deadline) {
      assert.fail(message);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/** Waits a few of the finished file's poll intervals, for a check that nothing happens. */
function pollsPass(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 4 * FINISHED_POLL_MS));
}

const EARLIER = 'claude -p "/gurita:answer-all-open-questions-with-recommendation --mission <path>" --model "fable" --effort high;';
const CHAIN_LAST = 'claude-desktop "/gurita:complete-all-tasks --mission <path>"; # interactive';

/** The finished file a chain's runner was told to write, read from its terminal's arguments. */
function finishedFileOf(terminal: StubTerminal): string {
  const args = terminal.args ?? [];
  const at = args.indexOf('--finished-file');
  assert.ok(at >= 0, 'the runner is told to write a finished file');
  return args[at + 1];
}

test("a chain ending in a claude-desktop line runs its earlier lines as a tracked run and sends the last line as soon as they finished, before the terminal closes", async () => {
  opened.length = 0;
  errors.length = 0;
  notifications.length = 0;
  events.length = 0;
  let closedCalls = 0;
  const count = created.length;
  await runs.startAction(context, '/my project', 'lib/mission_alpha/', 'Prepare and Execute tasks', [EARLIER, EARLIER, CHAIN_LAST], { path: 'lib/mission_alpha/' }, () => closedCalls++);
  assert.strictEqual(created.length, count + 1, 'one terminal runs the earlier lines');
  const terminal = created[created.length - 1];
  const file = finishedFileOf(terminal);
  assert.deepStrictEqual(terminal.args, [
    '/extension/runner.py',
    'chain',
    '--close-when-finished',
    '--finished-file',
    file,
    '--',
    'claude -p "/gurita:answer-all-open-questions-with-recommendation --mission ${GURITA_PATH}" --model "fable" --effort high;',
    'claude -p "/gurita:answer-all-open-questions-with-recommendation --mission ${GURITA_PATH}" --model "fable" --effort high;',
  ], 'the earlier lines alone, built as every run line is; the runner never sees the Desktop word');
  assert.ok(!(terminal.args ?? []).some((arg) => arg.includes('claude-desktop')));
  assert.deepStrictEqual(terminal.env, { GURITA_PATH: 'lib/mission_alpha/' });
  assert.strictEqual(terminal.name, 'Gurita: Prepare and Execute tasks (lib/mission_alpha/)');
  assert.deepStrictEqual(runs.runningMissions(), ['lib/mission_alpha/'], 'an ordinary tracked run');
  assert.deepStrictEqual(events, ['started lib/mission_alpha/']);
  assert.ok(fs.existsSync(path.dirname(file)) && !fs.existsSync(file), 'the finished file is not written yet');
  await pollsPass();
  assert.deepStrictEqual(opened, [], 'nothing is sent while the earlier lines run');

  // The runner writes the file once the earlier lines all finished; the terminal stays open.
  fs.writeFileSync(file, '');
  await until(() => opened.length === 1, 'the last line is sent once the earlier lines finished');
  assert.deepStrictEqual(opened, [
    { file: 'open', args: ['claude://code/new?q=%2Fgurita%3Acomplete-all-tasks%20--mission%20lib%2Fmission_alpha%2F&folder=%2Fmy%20project'] },
  ], 'the prompt with its values written in and the project root as folder');
  assert.deepStrictEqual(runs.runningMissions(), ['lib/mission_alpha/'], 'sent without waiting for the terminal to close');
  assert.strictEqual(closedCalls, 0);
  await until(() => !fs.existsSync(path.dirname(file)), "the signal's directory is taken away once read");
  assert.deepStrictEqual(errors, [], 'a send that went out shows nothing');
  assert.deepStrictEqual(notifications, []);

  close(terminal);
  await pollsPass();
  assert.strictEqual(opened.length, 1, 'the close sends nothing more');
  assert.strictEqual(closedCalls, 1, "the starter's close callback is called as for any run");
  assert.deepStrictEqual(runs.runningMissions(), []);
  assert.deepStrictEqual(events, ['started lib/mission_alpha/', 'ended ']);
});

test('a chain whose earlier lines stopped writes no finished file and sends nothing, its terminal closing as any run does', async () => {
  opened.length = 0;
  errors.length = 0;
  let closedCalls = 0;
  await runs.startAction(context, '/project', 'mission_beta/', 'Prepare tasks', [EARLIER, CHAIN_LAST], { path: 'mission_beta/' }, () => closedCalls++);
  const terminal = created[created.length - 1];
  const file = finishedFileOf(terminal);
  assert.deepStrictEqual(terminal.args?.slice(-2), ['--', 'claude -p "/gurita:answer-all-open-questions-with-recommendation --mission ${GURITA_PATH}" --model "fable" --effort high;']);
  await pollsPass();
  close(terminal);
  await pollsPass();
  assert.deepStrictEqual(opened, [], 'nothing is sent to Claude Desktop');
  assert.deepStrictEqual(errors, []);
  assert.strictEqual(closedCalls, 1);
  assert.strictEqual(fs.existsSync(path.dirname(file)), false, "the signal's directory is taken away at the close");
  assert.deepStrictEqual(runs.runningMissions(), []);
});

test('a chain that finished and closed its terminal by itself before the file was looked for is sent once, at the close', async () => {
  opened.length = 0;
  await runs.startAction(context, '/project', 'mission_beta/', 'Prepare tasks', [EARLIER, CHAIN_LAST], { path: 'mission_beta/' });
  const terminal = created[created.length - 1];
  fs.writeFileSync(finishedFileOf(terminal), '');
  close(terminal);
  await until(() => opened.length === 1, 'the close finds the finished file and sends');
  await pollsPass();
  assert.strictEqual(opened.length, 1, 'sent exactly once');
  assert.strictEqual(new URL(opened[0].args[0]).searchParams.get('q'), '/gurita:complete-all-tasks --mission mission_beta/');
});

test("a chain's failed send is shown as the one error notification, and its run is left as it stands", async () => {
  opened.length = 0;
  errors.length = 0;
  failOpen = { error: new Error('Command failed: open'), stderr: 'No application knows how to open URL claude://code/new.\n' };
  try {
    await runs.startAction(context, '/project', 'mission_beta/', 'Prepare tasks', [EARLIER, CHAIN_LAST], { path: 'mission_beta/' });
    const terminal = created[created.length - 1];
    fs.writeFileSync(finishedFileOf(terminal), '');
    await until(() => errors.length === 1, 'the failed send is shown');
    assert.deepStrictEqual(errors, [runs.desktopSendFailed('Prepare tasks', 'No application knows how to open URL claude://code/new.')]);
    assert.strictEqual(opened.length, 1, 'the send is the one call made');
    assert.deepStrictEqual(runs.runningMissions(), ['mission_beta/'], 'the earlier lines\' run is still tracked until its terminal closes');
    close(terminal);
  } finally {
    failOpen = undefined;
  }
});

test("a chain whose last-line prompt is past the limit runs whole in the terminal, its last line as an interactive claude line, with one notice and no finished file", async () => {
  opened.length = 0;
  notifications.length = 0;
  const values = valuesOfPromptLength(14337);
  await runs.startAction(context, '/project', 'mission_delta/', 'two', ['echo first', DESKTOP_LINE], values);
  const terminal = created[created.length - 1];
  assert.deepStrictEqual(terminal.args, [
    '/extension/runner.py',
    'chain',
    '--close-when-finished',
    '--',
    'echo first',
    'claude "/gurita:discuss-open-question --mission ${GURITA_PATH} ${GURITA_SHORT_TITLE}. ${GURITA_NOTE}"; # interactive',
  ]);
  assert.deepStrictEqual(notifications, [runs.desktopPromptTooLong('two', 14337)]);
  assert.deepStrictEqual(runs.runningMissions(), ['mission_delta/']);
  close(terminal);
  await pollsPass();
  assert.deepStrictEqual(opened, [], 'nothing is sent to Claude Desktop');
});

test('a chain ending in a claude-desktop line is refused while its mission runs, as a click is', async () => {
  opened.length = 0;
  notifications.length = 0;
  runs.startChain(context, '/project', 'mission_gamma/', 'review', ['echo review'], { path: 'mission_gamma/' });
  const going = created[created.length - 1];
  const count = created.length;
  await runs.startAction(context, '/project', 'mission_gamma/', 'Prepare tasks', [EARLIER, CHAIN_LAST], { path: 'mission_gamma/' });
  assert.strictEqual(created.length, count, 'no terminal is created');
  assert.deepStrictEqual(notifications, [runs.ALREADY_RUNNING]);
  close(going);
  await pollsPass();
  assert.deepStrictEqual(opened, []);
});

const LOOP_ARGS = ['/extension/runner.py', 'loop', '--mission', 'mission_gamma/', '--', '<single-task line>'];

test('the runner is told to close a finished run by itself while the auto-close setting is unset or on, for a chain and a loop alike', () => {
  for (const value of [undefined, true]) {
    if (value === undefined) {
      delete settings[runs.AUTO_CLOSE_SETTING];
    } else {
      settings[runs.AUTO_CLOSE_SETTING] = value;
    }
    runs.startChain(context, '/project', 'mission_gamma/', 'review', ['echo review'], { path: 'mission_gamma/' });
    const chain = created[created.length - 1];
    assert.deepStrictEqual(chain.args, ['/extension/runner.py', 'chain', '--close-when-finished', '--', 'echo review']);
    close(chain);
    assert.strictEqual(runs.startLoop('/project', 'mission_gamma/', 'complete', LOOP_ARGS), true);
    const loop = created[created.length - 1];
    assert.deepStrictEqual(loop.args, [
      '/extension/runner.py',
      'loop',
      '--close-when-finished',
      '--mission',
      'mission_gamma/',
      '--',
      '<single-task line>',
    ]);
    close(loop);
  }
});

test('with the auto-close setting off the runner is started without the option, so every run waits for a keypress', () => {
  settings[runs.AUTO_CLOSE_SETTING] = false;
  try {
    runs.startChain(context, '/project', undefined, 'define', ['echo define'], { goal: 'A goal', scope: '.' });
    const chain = created[created.length - 1];
    assert.deepStrictEqual(chain.args, ['/extension/runner.py', 'chain', '--', 'echo define']);
    close(chain);
    assert.strictEqual(runs.startLoop('/project', 'mission_gamma/', 'complete', LOOP_ARGS), true);
    const loop = created[created.length - 1];
    assert.deepStrictEqual(loop.args, LOOP_ARGS);
    close(loop);
  } finally {
    delete settings[runs.AUTO_CLOSE_SETTING];
  }
});

test('the option is written directly after the runner command, the rest of the arguments unchanged', () => {
  assert.deepStrictEqual(runs.runnerArguments(['r.py', 'chain', '--', 'a'], true), ['r.py', 'chain', '--close-when-finished', '--', 'a']);
  assert.deepStrictEqual(runs.runnerArguments(['r.py', 'chain', '--', 'a'], false), ['r.py', 'chain', '--', 'a']);
});

test('the manifest contributes the auto-close setting as a boolean, shipped on', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8')) as {
    contributes: { configuration: { properties: Record<string, { type: string; default: unknown }> } };
  };
  const setting = manifest.contributes.configuration.properties[`gurita.${runs.AUTO_CLOSE_SETTING}`];
  assert.ok(setting !== undefined);
  assert.strictEqual(setting.type, 'boolean');
  assert.strictEqual(setting.default, true);
});
