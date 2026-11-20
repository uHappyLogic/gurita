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

  /** `measure` gives the element's laid-out width, as the test's stand-in for the browser's layout. */
  constructor(
    readonly tagName: string,
    private readonly measure: (element: FakeElement) => number = () => 0,
  ) {}

  /** The class list, kept in `className` as the page script's `element` sets it. */
  get classList(): { remove(name: string): void; toggle(name: string, force: boolean): void } {
    const names = () => this.className.split(' ').filter((name) => name !== '');
    return {
      remove: (name) => {
        this.className = names().filter((each) => each !== name).join(' ');
      },
      toggle: (name, force) => {
        const kept = names().filter((each) => each !== name);
        this.className = (force ? [...kept, name] : kept).join(' ');
      },
    };
  }

  getBoundingClientRect(): { width: number } {
    return { width: this.measure(this) };
  }

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
  /** Fires the window's resize event, as a change of the pane's width does. */
  resize(): void;
}

/**
 * Loads the compiled page script into a fresh page, as the pane does each time it is shown, its
 * elements laid out to the widths `measure` gives.
 */
function loadPage(measure?: (element: FakeElement) => number): Page {
  const root = new FakeElement('div', measure);
  const posted: unknown[] = [];
  const windowListeners: ((event: { data: unknown }) => void)[] = [];
  const resizeListeners: (() => void)[] = [];
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
      createElement: (tag: string) => new FakeElement(tag, measure),
      createTextNode: (text: string) => new FakeText(text),
      addEventListener: () => undefined,
    },
    window: {
      scrollY: 0,
      scrollTo: () => undefined,
      addEventListener: (type: string, listener: (event: { data: unknown }) => void) => {
        if (type === 'message') {
          windowListeners.push(listener);
        } else if (type === 'resize') {
          resizeListeners.push(listener as () => void);
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
    resize: () => {
      for (const listener of resizeListeners) {
        listener();
      }
    },
  };
}

const ALPHA = 'lib/mission_alpha/';
const BETA = 'mission_beta/';

function mission(missionPath: string, title: string, workflow: Record<string, unknown> = { step: 'derive' }): unknown {
  return {
    path: missionPath,
    state: 'started',
    title,
    ...workflow,
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

/** The workflow diagram's blocks, in the order drawn. */
function blocks(page: Page): FakeElement[] {
  return page.root.all().filter((each) => each.has('block'));
}

/** A page drawn for one mission whose diagram draws `workflow`. */
function diagramPage(workflow: Record<string, unknown>, running: string[] = []): Page {
  const page = loadPage();
  page.send({ type: 'live', missions: [mission(ALPHA, 'Alpha', workflow)], recipes: RECIPES, running });
  return page;
}

const SEVEN = ['define', 'first review round', 'additional review round', 'derive tasks', 'execute tasks', 'follow up tasks', 'finish'];

test('the diagram is one line of seven blocks joined by arrows, with no frame, loop arrow, or handoff label', () => {
  const page = diagramPage({ step: 'derive' });
  const diagrams = page.root.all().filter((each) => each.has('workflow'));
  assert.strictEqual(diagrams.length, 1);
  const flows = diagrams[0].all().filter((each) => each.has('flow'));
  assert.strictEqual(flows.length, 1);
  const line = flows[0].children as FakeElement[];
  assert.deepStrictEqual(
    line.map((each) => (each.has('block') ? each.textContent : each.has('arrow') ? '→' : each.className)),
    SEVEN.flatMap((name, index) => (index === 0 ? [name] : ['→', name])),
  );
  for (const kind of ['frame', 'frame-heading', 'loop', 'handoff', 'arrow-label']) {
    assert.strictEqual(page.root.all().filter((each) => each.has(kind)).length, 0, `no ${kind}`);
  }
  const texts = page.root.all().map((each) => each.textContent);
  for (const gone of ['Decide upfront', 'Hand execution to agents', 'until no open questions remain', 'handoff']) {
    assert.ok(!texts.includes(gone), `no ${gone}`);
  }
});

test('the two optional blocks are dashed and the five required ones solid', () => {
  const page = diagramPage({ step: 'derive' });
  assert.deepStrictEqual(
    blocks(page).filter((each) => each.has('optional')).map((each) => each.textContent),
    ['additional review round', 'follow up tasks'],
  );
  assert.deepStrictEqual(
    blocks(page).filter((each) => !each.has('optional')).map((each) => each.textContent),
    ['define', 'first review round', 'derive tasks', 'execute tasks', 'finish'],
  );
});

test('each posted step fills exactly its own block, and no step fills none', () => {
  const steps: [string, string][] = [
    ['first-review', 'first review round'],
    ['additional-review', 'additional review round'],
    ['derive', 'derive tasks'],
    ['execute', 'execute tasks'],
    ['finish', 'finish'],
  ];
  for (const [step, name] of steps) {
    const page = diagramPage({ step });
    const filled = filledBlock(page);
    assert.strictEqual(filled.textContent, name);
    assert.strictEqual(filled.getAttribute('aria-current'), 'step');
    assert.strictEqual(filled.has('running'), false);
  }
  const none = diagramPage({});
  assert.strictEqual(blocks(none).length, 7);
  assert.strictEqual(blocks(none).filter((each) => each.has('next')).length, 0);
});

test('the filled block keeps its pulse while a run is held, an optional one keeping its dashed border', () => {
  const page = diagramPage({ step: 'additional-review', additionalRounds: 2 }, [ALPHA]);
  const filled = filledBlock(page);
  assert.strictEqual(filled.textContent, 'additional review round 2');
  assert.strictEqual(filled.has('running'), true);
  assert.strictEqual(filled.has('optional'), true);
});

test('the additional review round reads plain without a count and carries the posted count otherwise', () => {
  assert.strictEqual(blocks(diagramPage({ step: 'execute' }))[2].textContent, 'additional review round');
  for (const rounds of [1, 2, 3, 12]) {
    const drawn = blocks(diagramPage({ step: 'execute', additionalRounds: rounds })).map((each) => each.textContent);
    assert.deepStrictEqual(drawn, [...SEVEN.slice(0, 2), `additional review round ${rounds}`, ...SEVEN.slice(3)]);
  }
});

/** The width the diagram's row takes in the stand-in layout, whatever the pane's width. */
const ROW_WIDTH = 800;

/**
 * A page for one mission whose diagram draws `workflow`, laid out in a pane `pane.width` wide: the
 * diagram's section takes the pane's width and its row of blocks `ROW_WIDTH`.
 */
function laidOutPage(pane: { width: number }, workflow: Record<string, unknown>, running: string[] = []): Page {
  const page = loadPage((element) => (element.has('workflow') ? pane.width : element.has('flow') ? ROW_WIDTH : 0));
  page.send({ type: 'live', missions: [mission(ALPHA, 'Alpha', workflow)], recipes: RECIPES, running });
  return page;
}

function workflowSection(page: Page): FakeElement {
  const found = page.root.all().filter((each) => each.has('workflow'));
  assert.strictEqual(found.length, 1);
  return found[0];
}

/** The diagram's line as drawn: each block's name, and an arrow between each two. */
function diagramLine(page: Page): string[] {
  const flows = workflowSection(page).all().filter((each) => each.has('flow'));
  assert.strictEqual(flows.length, 1);
  return (flows[0].children as FakeElement[]).map((each) => (each.has('block') ? each.textContent : each.has('arrow') ? '→' : each.className));
}

test('the diagram lies in one row while the row fits the pane and stacks vertically once it would overflow', () => {
  const pane = { width: 1200 };
  const page = laidOutPage(pane, { step: 'derive' });
  const line = SEVEN.flatMap((name, index) => (index === 0 ? [name] : ['→', name]));
  assert.strictEqual(workflowSection(page).has('vertical'), false);
  assert.deepStrictEqual(diagramLine(page), line);
  for (const [width, vertical] of [
    [ROW_WIDTH, false],
    [ROW_WIDTH - 1, true],
    [400, true],
    [ROW_WIDTH, false],
    [1200, false],
    [300, true],
  ] as [number, boolean][]) {
    pane.width = width;
    page.resize();
    assert.strictEqual(workflowSection(page).has('vertical'), vertical, `vertical at ${width}`);
    assert.deepStrictEqual(diagramLine(page), line, `the same blocks and arrows at ${width}`);
    assert.strictEqual(filledBlock(page).textContent, 'derive tasks');
    assert.deepStrictEqual(
      blocks(page).filter((each) => each.has('optional')).map((each) => each.textContent),
      ['additional review round', 'follow up tasks'],
    );
  }
});

test('a redraw lays the diagram out afresh, and the stack keeps the filled block and its pulse', () => {
  const pane = { width: 500 };
  const page = laidOutPage(pane, { step: 'follow-up' }, [ALPHA]);
  assert.strictEqual(workflowSection(page).has('vertical'), true);
  const filled = filledBlock(page);
  assert.strictEqual(filled.textContent, 'follow up tasks');
  assert.strictEqual(filled.has('optional'), true);
  assert.strictEqual(filled.has('running'), true);
  pane.width = 1000;
  page.send({ type: 'running', missions: [] });
  assert.strictEqual(workflowSection(page).has('vertical'), false);
  assert.strictEqual(filledBlock(page).has('running'), false);
  pane.width = 500;
  page.send({ type: 'liveFailure', cause: 'Error: no git' });
  page.resize();
  assert.strictEqual(page.root.all().filter((each) => each.has('workflow')).length, 0);
});
