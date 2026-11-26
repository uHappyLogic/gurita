import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
// The send to Claude Desktop: which lines go to it, the prompt with its values written in, the
// `claude://code/new` link built from that prompt and the project root, and the opener's outcome,
// against a stub of `node:child_process` standing in for `open`.
import { rewriteHarness } from '../lineValues';
import { parseShippedRecipes } from '../recipes';
const Module = require('node:module') as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};

/** One call the stubbed opener received, and what it is answered with. */
interface OpenCall {
  file: string;
  args: string[];
}
const calls: OpenCall[] = [];
/** How the next call is answered: an error and standard error, or success when undefined. */
let answer: { error: Error; stderr: string } | undefined;

const childProcess = {
  execFile(file: string, args: string[], callback: (error: Error | null, stdout: string, stderr: string) => void): void {
    calls.push({ file, args: [...args] });
    const given = answer;
    setImmediate(() => (given === undefined ? callback(null, '', '') : callback(given.error, '', given.stderr)));
  },
};

const load = Module._load;
Module._load = (request, parent, isMain) => (request === 'node:child_process' ? childProcess : load(request, parent, isMain));
const desktop = require('../desktop') as typeof import('../desktop');
Module._load = load;

const SHIPPED_RECIPES = path.join(__dirname, '..', '..', 'shipped_recipes.md');

test('only a variant of one line opening with claude-desktop goes to Claude Desktop', () => {
  const line = 'claude-desktop "/gurita:complete-all-tasks --mission <path>"; # interactive';
  assert.strictEqual(desktop.desktopLine([line]), line);
  assert.strictEqual(desktop.desktopLine([line, line]), undefined, 'a chain of several lines does not');
  assert.strictEqual(desktop.desktopLine([]), undefined);
  assert.strictEqual(desktop.desktopLine(['claude "/gurita:complete-all-tasks --mission <path>" --model "opus" --effort high; # interactive']), undefined);
  assert.strictEqual(desktop.desktopLine(['claude --desktop "/gurita:complete-all-tasks --mission <path>"; # interactive']), undefined);
  assert.strictEqual(desktop.desktopLine(['claude-desktops "/gurita:x"; # interactive']), undefined, 'the word is matched by exact equality');
  assert.strictEqual(desktop.desktopLine(['echo claude-desktop']), undefined);
});

test('the prompt is the quoted /gurita: word with every typed value written in as typed, an empty note dropped', () => {
  assert.strictEqual(
    desktop.desktopPrompt('claude-desktop "/gurita:complete-all-tasks --mission <path>"; # interactive', { path: 'pkg/mission_alpha/' }),
    '/gurita:complete-all-tasks --mission pkg/mission_alpha/',
  );
  const discuss = 'claude-desktop "/gurita:discuss-open-question --mission <path> <Short Title>. <note>"; # interactive';
  assert.strictEqual(
    desktop.desktopPrompt(discuss, { path: 'mission_beta/', 'Short Title': 'Pane Layout', note: 'Keep it "short", $HOME & `ls`' }),
    '/gurita:discuss-open-question --mission mission_beta/ Pane Layout. Keep it "short", $HOME & `ls`',
    'a value is written in as typed, no shell reading it',
  );
  assert.strictEqual(
    desktop.desktopPrompt(discuss, { path: 'mission_beta/', 'Short Title': 'Pane Layout', note: '  ' }),
    '/gurita:discuss-open-question --mission mission_beta/ Pane Layout',
    'an empty note is dropped with the ". " before it',
  );
  assert.strictEqual(
    desktop.desktopPrompt("claude-desktop '/gurita:ask-in-mission-context --mission <path> <question>'; # interactive", {
      path: 'mission_beta/',
      question: 'What does <path> mean?',
    }),
    '/gurita:ask-in-mission-context --mission mission_beta/ What does <path> mean?',
    'a value holding a placeholder is not filled again',
  );
  assert.strictEqual(
    desktop.desktopPrompt('claude-desktop "/gurita:discuss-new-task --mission <path> <issue description>"; # interactive', {
      path: 'm/',
      'issue description': 'line one\nline two',
    }),
    '/gurita:discuss-new-task --mission m/ line one\nline two',
  );
  assert.strictEqual(desktop.desktopPrompt('claude-desktop; # interactive', {}), '', 'a line invoking no skill sends no prompt');
});

test("every shipped variant of one line, headless or interactive, set to go to Claude Desktop, sends its prompt with the mission's path written in", () => {
  const recipes = parseShippedRecipes(fs.readFileSync(SHIPPED_RECIPES, 'utf8'), SHIPPED_RECIPES);
  const sent: string[] = [];
  for (const variant of recipes.flatMap((recipe) => recipe.variants)) {
    if (!variant.singleLine) {
      continue;
    }
    const line = rewriteHarness(variant.lines[0], 'claude-desktop', { models: [], efforts: [] });
    assert.ok(line !== undefined, variant.lines[0]);
    assert.strictEqual(desktop.desktopLine([line]), line);
    assert.ok(/^claude-desktop "[^"]*"; # interactive$/.test(line), `the line is interactive, its flags dropped: ${line}`);
    const values = {
      path: 'pkg/mission_alpha/',
      'Short Title': 'Pane Layout',
      note: '',
      goal: 'A goal',
      'issue description': 'An issue',
      question: 'Why?',
      'answer text': 'Use tabs',
      'Alternative Id': 'B',
      scope: 'pkg',
    };
    const prompt = desktop.desktopPrompt(line, values);
    assert.ok(prompt.startsWith('/gurita:'), prompt);
    assert.ok(!/<[A-Za-z][A-Za-z ]*>/.test(prompt), `every placeholder is written in: ${prompt}`);
    assert.ok(!prompt.includes('--model') && !prompt.includes('--dangerously'), prompt);
    sent.push(prompt);
  }
  assert.deepStrictEqual(sent, [
    '/gurita:complete-all-tasks --mission pkg/mission_alpha/',
    '/gurita:complete-all-tasks --mission pkg/mission_alpha/',
    '/gurita:finish-mission --mission pkg/mission_alpha/',
    '/gurita:discuss-open-question --mission pkg/mission_alpha/ Pane Layout',
    '/gurita:discuss-mission-goal A goal',
    '/gurita:discuss-new-task --mission pkg/mission_alpha/ An issue',
    '/gurita:ask-in-mission-context --mission pkg/mission_alpha/ Why?',
    '/gurita:answer-open-question --mission pkg/mission_alpha/ Pane Layout. Use tabs',
    '/gurita:answer-open-question-with-alternative --mission pkg/mission_alpha/ Pane Layout. B',
    '/gurita:define-mission-goal --at pkg A goal',
    '/gurita:init-mission-base-workflow',
    '/gurita:capture-mission-principle-updates pkg/mission_alpha/',
  ]);
});

test('the link is claude://code/new carrying the prompt as q and the project root as folder, each written as a URI component', () => {
  const link = desktop.desktopLink('/gurita:discuss-open-question --mission m/ Pane & Layout. Why? 100% #1', '/Users/me/my project');
  assert.strictEqual(
    link,
    'claude://code/new?q=%2Fgurita%3Adiscuss-open-question%20--mission%20m%2F%20Pane%20%26%20Layout.%20Why%3F%20100%25%20%231&folder=%2FUsers%2Fme%2Fmy%20project',
  );
  const parsed = new URL(link);
  assert.strictEqual(parsed.protocol, 'claude:');
  assert.strictEqual(parsed.host, 'code');
  assert.strictEqual(parsed.pathname, '/new');
  assert.deepStrictEqual([...parsed.searchParams.keys()], ['q', 'folder']);
  assert.strictEqual(parsed.searchParams.get('q'), '/gurita:discuss-open-question --mission m/ Pane & Layout. Why? 100% #1', 'the prompt reads back whole');
  assert.strictEqual(parsed.searchParams.get('folder'), '/Users/me/my project');
  assert.strictEqual(new URL(desktop.desktopLink('line one\nline two', '/p')).searchParams.get('q'), 'line one\nline two');
  assert.strictEqual(desktop.desktopLink('', '/p'), 'claude://code/new?folder=%2Fp', 'an empty prompt is left out');
  assert.strictEqual(desktop.desktopLink('/gurita:x', undefined), 'claude://code/new?q=%2Fgurita%3Ax', 'no root, no folder');
});

test('the link is passed to open as an execFile child, its outcome success or the cause the opener reported', async () => {
  calls.length = 0;
  answer = undefined;
  assert.strictEqual(await desktop.openDesktopLink('claude://code/new?q=x'), undefined, 'a send that went out has no cause');
  assert.deepStrictEqual(calls, [{ file: 'open', args: ['claude://code/new?q=x'] }], 'one call of open, the link its one argument');

  answer = { error: new Error('Command failed: open claude://code/new?q=x'), stderr: 'No application knows how to open URL claude://code/new?q=x.\n' };
  assert.strictEqual(await desktop.openDesktopLink('claude://code/new?q=x'), 'No application knows how to open URL claude://code/new?q=x.', "the opener's standard error is the cause");
  answer = { error: new Error('spawn open ENOENT'), stderr: '' };
  assert.strictEqual(await desktop.openDesktopLink('claude://code/new?q=x'), 'spawn open ENOENT', "the call's own message where it wrote none");
  assert.strictEqual(calls.length, 3, 'nothing is checked beforehand, each send one call');
  answer = undefined;
});

test('a prompt is too long for Claude Desktop only past 14,336 characters, counted in UTF-16 code units as Desktop counts them', () => {
  assert.strictEqual(desktop.DESKTOP_PROMPT_LIMIT, 14336);
  assert.strictEqual(desktop.tooLongForDesktop('x'.repeat(14336)), false, 'a prompt at the limit is within it');
  assert.strictEqual(desktop.tooLongForDesktop('x'.repeat(14337)), true);
  assert.strictEqual(desktop.tooLongForDesktop(''), false);
  assert.strictEqual(desktop.tooLongForDesktop('😀'.repeat(7168)), false, '7,168 astral characters are 14,336 code units');
  assert.strictEqual(desktop.tooLongForDesktop(`${'😀'.repeat(7168)}x`), true);
  const values = { path: 'mission_alpha/', 'Short Title': 'Pane Layout', note: 'n'.repeat(14336) };
  const line = 'claude-desktop "/gurita:discuss-open-question --mission <path> <Short Title>. <note>"; # interactive';
  assert.strictEqual(desktop.tooLongForDesktop(desktop.desktopPrompt(line, values)), true, 'measured with its typed values written in');
  assert.strictEqual(desktop.tooLongForDesktop(desktop.desktopPrompt(line, { ...values, note: '' })), false);
});

test('the fallback line is the Desktop line opening with claude, every other word kept as stored', () => {
  assert.strictEqual(
    desktop.desktopFallbackLine('claude-desktop "/gurita:complete-all-tasks --mission <path>"; # interactive'),
    'claude "/gurita:complete-all-tasks --mission <path>"; # interactive',
    'a line holding only its prompt opens Claude Code on its own defaults',
  );
  assert.strictEqual(
    desktop.desktopFallbackLine(
      'claude-desktop "/gurita:discuss-open-question --mission <path> <Short Title>. <note>" --model "opus" --effort high --dangerously-skip-permissions; # interactive',
    ),
    'claude "/gurita:discuss-open-question --mission <path> <Short Title>. <note>" --model "opus" --effort high --dangerously-skip-permissions; # interactive',
    'a line still holding flags keeps every one of them',
  );
  assert.strictEqual(desktop.desktopFallbackLine('claude "/gurita:x"; # interactive'), undefined, 'only a Desktop line has one');
});
