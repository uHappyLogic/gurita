import { test } from 'node:test';
import * as assert from 'node:assert';
import { FakeElement, FakeText, Page, loadScript, stylesheetRules } from './fakePage';

// A finished mission's window's page script, compiled as the window loads it after the text
// renderer, run against the small stand-in for the DOM in `fakePage.ts`, so the drawn page can be
// walked and its posts read.

const MISSION = 'pkg/mission_done/';

/** The answer the extension posts for the finished mission, its parts as `parts` changes them. */
function answer(parts: { summary?: unknown; completed?: unknown; capture?: unknown } = {}): unknown {
  return {
    type: 'finished',
    mission: {
      path: MISSION,
      title: 'The done mission',
      ...('capture' in parts ? (parts.capture === undefined ? {} : { capture: parts.capture }) : { capture: CAPTURE }),
      summary: parts.summary ?? {
        state: 'read',
        summary: { date: '2026-11-05', title: 'The done mission', summary: '- It was `built`.\n- Nothing else.' },
      },
      completed: parts.completed ?? {
        state: 'read',
        tasks: [
          { hash: 'abc1234', date: '2026-11-04', mission: MISSION, title: 'Second Task', bar: '- The `second` criterion\n- Another one' },
          { hash: 'def5678', date: '2026-11-03', mission: MISSION, title: 'First Task', bar: '' },
        ],
      },
    },
  };
}

/** The capture line the shipped recipe carries, and the entry the extension posts for the Capture principles button. */
const CAPTURE_LINE = 'claude "/gurita:capture-mission-principle-updates <path>" --dangerously-skip-permissions --model "fable" --effort high; # interactive';
const CAPTURE = {
  state: 'offered',
  lines: [CAPTURE_LINE],
  variants: [
    { name: 'default', own: false },
    { name: 'Opus', own: true },
  ],
  selected: 0,
};

function load(): Page {
  return loadScript('finished.js');
}

/** The elements of `page` carrying the class `name`. */
function parts(page: Page, name: string): FakeElement[] {
  return page.root.all().filter((each) => each.has(name));
}

/** The one element of `page` carrying the class `name`. */
function part(page: Page, name: string): FakeElement {
  const found = parts(page, name);
  assert.strictEqual(found.length, 1, `one ${name} is drawn`);
  return found[0];
}

/** The text an element shows, its text nodes and its children's text joined. */
function text(node: FakeElement | FakeText): string {
  return node instanceof FakeText ? node.textContent : node.children.length > 0 ? node.children.map(text).join('') : node.textContent;
}

test('the page posts ready on loading and draws one reading line until the first answer', () => {
  const page = load();
  assert.deepStrictEqual(page.posted, [{ type: 'ready' }]);
  assert.deepStrictEqual(page.root.children.map(text), ['Reading the finished mission…']);
  page.send({ type: 'other' });
  page.send({ type: 'finished', mission: null });
  assert.deepStrictEqual(page.root.children.map(text), ['Reading the finished mission…'], 'any other message is ignored');
});

test("the page draws the mission's title, its path and finish date, its summary through the text renderer, and its completed tasks as the Tasks pane draws them", () => {
  const page = load();
  page.send(answer());
  const head = part(page, 'finished-head');
  assert.strictEqual(text(head.children[0]), 'The done mission');
  assert.strictEqual((head.children[0] as FakeElement).tagName, 'h2');
  assert.strictEqual(text(part(page, 'finished-facts')), `${MISSION} · Finished on 2026-11-05`);

  const summary = part(page, 'finished-summary');
  assert.strictEqual(text(summary.children[0]), 'Summary');
  const list = part(page, 'summary-text').children[0] as FakeElement;
  assert.strictEqual(list.tagName, 'ul', "the summary's bullets are drawn as a list");
  assert.deepStrictEqual(list.children.map(text), ['It was built.', 'Nothing else.']);
  const code = (list.children[0] as FakeElement).children[1] as FakeElement;
  assert.strictEqual(code.tagName, 'code', 'a stretch between backticks is drawn as code');
  assert.strictEqual(code.textContent, 'built');

  const completed = part(page, 'completed-tasks');
  assert.strictEqual(text(completed.children[0]), 'Completed tasks');
  const items = parts(page, 'completed-task');
  assert.strictEqual(items.length, 2, 'the completed tasks are shown at once, behind no control');
  assert.ok(!page.root.all().some((each) => each.tagName === 'button' && /completed tasks/.test(each.textContent)), 'no show or hide control is drawn');
  assert.deepStrictEqual(
    items.map((item) => item.children.map((child) => (child instanceof FakeElement ? child.className : 'text'))),
    [
      ['task-title', 'task-commit', 'task-bar'],
      ['task-title', 'task-commit'],
    ],
    'each its title, beneath it its commit link, and beneath that its verified bar, a bar-less task its title and link alone',
  );
  assert.deepStrictEqual(items.map((item) => text(item.children[0])), ['Second Task', 'First Task'], 'newest first, in the order posted');
  const bar = items[0].children[2] as FakeElement;
  assert.strictEqual((bar.children[0] as FakeElement).tagName, 'ul', 'the verified bar is drawn by the text renderer');
  const links = parts(page, 'commit-link');
  assert.deepStrictEqual(links.map((link) => link.textContent), ['Open commit abc1234', 'Open commit def5678']);
  assert.strictEqual(links[0].title, "Open this task's commit, its verified bar and its whole patch, in an editor tab");
  assert.strictEqual(links[0].type, 'button');
  links[1].click();
  assert.deepStrictEqual(page.posted.slice(1), [{ type: 'openCommit', mission: MISSION, hash: 'def5678' }], "a link posts its hash with the page's mission");
  assert.deepStrictEqual(
    page.root.all().filter((each) => each.tagName === 'button' && !each.has('commit-link')).map(text),
    ['Capture principlesdefault'],
    'the one action button beside the commit links is Capture principles',
  );
});

test('the Capture principles button stands between the heading and the Summary, showing its selected variant, its lines as hover text, and the arrow-only dropdown beside it', () => {
  const page = load();
  page.send(answer());
  const finished = part(page, 'finished');
  assert.deepStrictEqual(
    finished.children.map((child) => (child as FakeElement).className),
    ['finished-head', 'controls finished-actions', 'finished-part finished-summary', 'finished-part completed-tasks'],
  );
  const capture = part(page, 'captureButton');
  assert.strictEqual(capture.tagName, 'button');
  assert.strictEqual(capture.type, 'button');
  assert.deepStrictEqual(capture.children.map(text), ['Capture principles', 'default'], 'its name, then the selected variant');
  assert.strictEqual(capture.title, CAPTURE_LINE, "the selected variant's lines as its hover text");
  assert.strictEqual(capture.disabled, false);
  const choice = part(page, 'recipe-variant');
  assert.strictEqual(choice.tagName, 'select');
  assert.strictEqual(choice.getAttribute('aria-label'), 'The variant of Capture principles');
  assert.deepStrictEqual(choice.children.map(text), ['default', 'Opus'], 'each variant by its bare name');
  capture.click();
  assert.deepStrictEqual(page.posted.slice(1), [{ type: 'capturePrinciples', mission: MISSION, variant: 'default' }], "a click posts the page's mission and the variant it stands on");
  choice.change('1');
  assert.deepStrictEqual(page.posted.slice(2), [{ type: 'selectCaptureVariant', mission: MISSION, variant: 'Opus' }], 'a pick posts the variant picked');
  page.send(answer({ capture: { ...CAPTURE, selected: 1 } }));
  assert.deepStrictEqual(part(page, 'captureButton').children.map(text), ['Capture principles', 'Opus'], 'the next answer redraws the button on the variant remembered');
});

test('the Capture principles button stands as its name alone while nothing is posted for it, and disabled with the cause while every variant is on a disabled harness', () => {
  const page = load();
  page.send(answer({ capture: undefined }));
  let capture = part(page, 'captureButton');
  assert.deepStrictEqual(capture.children.map(text), ['Capture principles']);
  assert.strictEqual(capture.title, "Open an interactive session distilling this mission's recorded decisions into the project's principle store");
  assert.strictEqual(parts(page, 'recipe-variant').length, 0, 'no dropdown is drawn');
  capture.click();
  assert.deepStrictEqual(page.posted.slice(1), [{ type: 'capturePrinciples', mission: MISSION }], 'a click posts no variant, so the extension tells why');
  page.send(answer({ capture: { state: 'disabled', cause: 'Every variant is on a disabled harness.' } }));
  capture = part(page, 'captureButton');
  assert.strictEqual(capture.disabled, true);
  assert.ok(capture.title.endsWith('\nEvery variant is on a disabled harness.'));
  assert.strictEqual(parts(page, 'recipe-variant').length, 0);
});

test('a mission with no completed task, a summary-less finish, and a part that could not be read each draw their own line', () => {
  const page = load();
  page.send(answer({ completed: { state: 'read', tasks: [] }, summary: { state: 'read', summary: { date: '2026-11-05', title: '', summary: '' } } }));
  assert.strictEqual(text(part(page, 'finished-head').children[0]), 'The done mission', "a finish commit with no title line keeps the row's title");
  assert.ok(text(part(page, 'finished-summary')).endsWith('The finish commit carries no summary.'));
  assert.ok(text(part(page, 'completed-tasks')).endsWith('No task is completed.'));

  page.send(answer({ completed: { state: 'failed', cause: 'Error: <b>no</b>' }, summary: { state: 'failed', cause: 'Error: gone' } }));
  const notices = parts(page, 'notice');
  assert.deepStrictEqual(
    notices.map((notice) => notice.children.map(text)),
    [
      ['The summary could not be read.', 'Error: gone'],
      ['The completed tasks could not be read.', 'Error: <b>no</b>'],
    ],
    'each failure line with the cause beneath it, drawn as text',
  );
  assert.strictEqual(text(part(page, 'finished-facts')), MISSION, 'no finish date is drawn while the summary cannot be read');
});

test('the stylesheet sets the finished window: its heading, its parts apart, and code in the editor font', () => {
  const rules = stylesheetRules();
  const rule = (selector: string) => rules.find((each) => each.selectors.includes(selector));
  assert.ok(rule('.finished-head h2') !== undefined);
  assert.ok(rule('.finished-part + .finished-part')?.declarations.has('margin-top'));
  assert.ok(rule('.finished-actions')?.declarations.has('margin-bottom'), 'the action row stands apart from the Summary');
  assert.strictEqual(rule('.finished code')?.declarations.get('font-family'), 'var(--vscode-editor-font-family)');
  assert.ok(rule('.task-list .task-commit') !== undefined, 'the completed tasks take the Tasks pane rules');
});
