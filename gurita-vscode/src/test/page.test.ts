import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';

// The page script, compiled as the pane loads it, run against a small stand-in for the DOM: just
// the elements, attributes, and events the script uses, so the drawn page can be walked.

class FakeText {
  constructor(public textContent: string) {}
}

class FakeElement {
  textContent = '';
  className = '';
  type = '';
  title = '';
  value = '';
  selected = false;
  disabled = false;
  readonly dataset: Record<string, string> = {};
  readonly style: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  children: (FakeElement | FakeText)[] = [];
  private readonly listeners = new Map<string, ((event: unknown) => void)[]>();

  constructor(readonly tagName: string) {}

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | undefined {
    return this.attributes.get(name);
  }

  append(...nodes: (FakeElement | FakeText)[]): void {
    this.children.push(...nodes);
  }

  replaceChildren(...nodes: (FakeElement | FakeText)[]): void {
    this.children = [...nodes];
  }

  get childElementCount(): number {
    return this.children.filter((child) => child instanceof FakeElement).length;
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  click(): void {
    for (const listener of this.listeners.get('click') ?? []) {
      listener({});
    }
  }

  scrollIntoView(): void {}

  focus(): void {}

  querySelector(selector: string): FakeElement | null {
    const focus = /^\[data-focus="(.*)"\]$/.exec(selector);
    return this.all().find((each) => focus !== null && each.dataset.focus === focus[1]) ?? null;
  }

  /** This element and every element beneath it, in document order. */
  all(): FakeElement[] {
    return [this, ...this.children.flatMap((child) => (child instanceof FakeElement ? child.all() : []))];
  }

  /** Whether the element's class list holds `name`. */
  has(name: string): boolean {
    return this.className.split(' ').includes(name);
  }
}

interface Page {
  root: FakeElement;
  posted: unknown[];
  send(message: unknown): void;
}

/** Loads the compiled page script into a fresh page, as the pane does each time it is shown. */
function loadPage(): Page {
  const root = new FakeElement('div');
  const posted: unknown[] = [];
  const windowListeners: ((event: { data: unknown }) => void)[] = [];
  const context = {
    HTMLElement: FakeElement,
    acquireVsCodeApi: () => ({
      // Cloned, as a posted message is, out of the script's own realm.
      postMessage: (message: unknown) => posted.push(JSON.parse(JSON.stringify(message))),
      getState: () => undefined,
      setState: () => undefined,
    }),
    document: {
      activeElement: null,
      getElementById: (id: string) => (id === 'root' ? root : null),
      createElement: (tag: string) => new FakeElement(tag),
      createTextNode: (text: string) => new FakeText(text),
      addEventListener: () => undefined,
    },
    window: {
      scrollY: 0,
      scrollTo: () => undefined,
      addEventListener: (type: string, listener: (event: { data: unknown }) => void) => {
        if (type === 'message') {
          windowListeners.push(listener);
        }
      },
    },
  };
  const script = fs.readFileSync(path.join(__dirname, '..', 'webview', 'page.js'), 'utf8');
  vm.runInNewContext(script, context);
  return {
    root,
    posted,
    send: (message) => {
      for (const listener of windowListeners) {
        listener({ data: message });
      }
    },
  };
}

const ALPHA = 'lib/mission_alpha/';
const BETA = 'mission_beta/';

function mission(missionPath: string, title: string): unknown {
  return {
    path: missionPath,
    state: 'started',
    title,
    step: 'answer',
    questions: {
      state: 'read',
      questions: ['Pane Layout', 'Tab Order'].map((id) => ({
        id,
        question: `What should ${id} be?`,
        principles: [],
        dependsOn: [],
        recommendation: { option: 'keep', rationale: 'It works.' },
        alternatives: [{ id: 'keep', text: 'Keep it.', advantages: [], drawbacks: [] }],
      })),
    },
    tasks: { state: 'read', headings: ['First Task'] },
  };
}

const RECIPES = {
  state: 'read',
  recipes: [
    { kind: 'runnable', name: 'review', group: 'Claude Code', lines: ['claude "/gurita:review-mission-requirements --mission <path>"'] },
    { kind: 'looped', name: 'complete', group: 'Claude Code', lines: ['claude "/gurita:complete-task --mission <path> <Task Title>"'] },
  ],
};

function live(running: string[]): unknown {
  return { type: 'live', missions: [mission(ALPHA, 'Alpha'), mission(BETA, 'Beta')], recipes: RECIPES, running };
}

function buttons(page: Page): FakeElement[] {
  return page.root.all().filter((each) => each.tagName === 'button');
}

function named(page: Page, text: string): FakeElement {
  const found = buttons(page).find((each) => each.textContent === text);
  assert.ok(found !== undefined, `no button ${text}`);
  return found;
}

/** The page's action buttons: its recipe buttons, its question card's buttons, its preview's start button, and New task. */
const ACTIONS = ['review', 'complete', 'Discuss', 'Answer', 'Answer with recommendation', 'Answer with this alternative', 'New task'];

/** The buttons that stay enabled whatever runs. */
const STAYING = ['Alpha', 'Beta', 'Refresh', 'New mission', 'Define mission', 'Next'];

function filledBlock(page: Page): FakeElement {
  const found = page.root.all().filter((each) => each.has('block') && each.has('next'));
  assert.strictEqual(found.length, 1);
  return found[0];
}

function assertRunning(page: Page): void {
  for (const text of ACTIONS) {
    assert.strictEqual(named(page, text).disabled, true, `${text} is disabled`);
  }
  for (const text of STAYING) {
    assert.strictEqual(named(page, text).disabled, false, `${text} stays enabled`);
  }
  assert.strictEqual(filledBlock(page).has('running'), true);
}

function assertIdle(page: Page): void {
  for (const text of [...ACTIONS, ...STAYING]) {
    assert.strictEqual(named(page, text).disabled, false, `${text} is enabled`);
  }
  assert.strictEqual(filledBlock(page).has('running'), false);
}

test('the page posts a ready message on load', () => {
  const page = loadPage();
  assert.deepStrictEqual(page.posted, [{ type: 'ready' }]);
});

test("a running mission's page disables its action buttons and pulses its filled block", () => {
  const page = loadPage();
  page.send(live([ALPHA]));
  assertRunning(page);
});

test("another mission's page is unaffected by a run it does not hold", () => {
  const page = loadPage();
  page.send(live([ALPHA]));
  named(page, 'Beta').click();
  assertIdle(page);
  named(page, 'review').click();
  assert.deepStrictEqual(page.posted[page.posted.length - 1], { type: 'runRecipe', mission: BETA, recipe: 'review' });
});

test('a run posted as started draws the page running, and its terminal closing draws it idle again', () => {
  const page = loadPage();
  page.send(live([]));
  assertIdle(page);
  page.send({ type: 'running', missions: [ALPHA] });
  assertRunning(page);
  page.send({ type: 'running', missions: [] });
  assertIdle(page);
  page.send(live([ALPHA]));
  assertRunning(page);
  page.send(live([]));
  assertIdle(page);
});

test("a held preview's start button is disabled while its mission runs, its close button not", () => {
  const page = loadPage();
  page.send(live([]));
  page.send({
    type: 'preview',
    mission: ALPHA,
    recipe: 'complete',
    lines: ['claude "/gurita:complete-task --mission <path> <Task Title>"'],
    names: ['complete-task'],
    result: { state: 'read', tasks: [{ state: 'resolved', name: 'complete-task', title: 'First Task' }] },
  });
  assert.strictEqual(named(page, 'Start run').disabled, false);
  page.send({ type: 'running', missions: [ALPHA] });
  assert.strictEqual(named(page, 'Start run').disabled, true);
  assert.strictEqual(named(page, 'Close preview').disabled, false);
  page.send({ type: 'running', missions: [] });
  assert.strictEqual(named(page, 'Start run').disabled, false);
});

test('a page shown again draws a run that started while it was hidden', () => {
  const hidden = loadPage();
  hidden.send(live([]));
  const shown = loadPage();
  shown.send(live([ALPHA]));
  assertRunning(shown);
});

test('a running message leaves the failure state as drawn', () => {
  const page = loadPage();
  page.send({ type: 'liveFailure', cause: 'Error: no repository' });
  page.send({ type: 'running', missions: [ALPHA] });
  const texts = page.root.all().map((each) => each.textContent);
  assert.ok(texts.includes('The live missions could not be read.'));
  assert.strictEqual(named(page, 'New mission').disabled, false);
  assert.strictEqual(named(page, 'Define mission').disabled, false);
});
