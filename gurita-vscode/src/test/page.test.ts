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
  /** Every state the page saved with `setState`, in order. */
  saved: unknown[];
  send(message: unknown): void;
  /** Fires the window's resize event, as a change of the pane's width does. */
  resize(): void;
  /** Fires the document's keydown event for `key`, pressed with no modifier outside any input. */
  key(key: string): void;
}

/**
 * Loads the compiled page script into a fresh page, as the pane does each time it is shown, its
 * elements laid out to the widths `measure` gives.
 */
function loadPage(measure?: (element: FakeElement) => number): Page {
  const root = new FakeElement('div', measure);
  const posted: unknown[] = [];
  const saved: unknown[] = [];
  const windowListeners: ((event: { data: unknown }) => void)[] = [];
  const resizeListeners: (() => void)[] = [];
  const keyListeners: ((event: unknown) => void)[] = [];
  const context = {
    HTMLElement: FakeElement,
    acquireVsCodeApi: () => ({
      // Cloned, as a posted message is, out of the script's own realm.
      postMessage: (message: unknown) => posted.push(JSON.parse(JSON.stringify(message))),
      getState: () => undefined,
      setState: (state: unknown) => saved.push(JSON.parse(JSON.stringify(state))),
    }),
    document: {
      activeElement: null,
      getElementById: (id: string) => (id === 'root' ? root : null),
      createElement: (tag: string) => new FakeElement(tag, measure),
      createTextNode: (text: string) => new FakeText(text),
      addEventListener: (type: string, listener: (event: unknown) => void) => {
        if (type === 'keydown') {
          keyListeners.push(listener);
        }
      },
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
    saved,
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
    key: (key) => {
      for (const listener of keyListeners) {
        listener({ key, target: null, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, preventDefault: () => undefined });
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

type PaneName = 'questions' | 'tasks';

/** The page's action buttons with each pane shown: its recipe buttons, its question card's buttons, and New task. */
const ACTIONS: Record<PaneName, string[]> = {
  questions: ['review', 'complete', 'Discuss', 'Answer', 'Answer with recommendation', 'Answer with this alternative'],
  tasks: ['review', 'complete', 'New task'],
};

/** The buttons that stay enabled whatever runs, with each pane shown. */
const STAYING: Record<PaneName, string[]> = {
  questions: ['Alpha', 'Beta', 'Refresh', 'New mission', 'Define mission', 'Open questions', 'Remaining tasks', 'Next'],
  tasks: ['Alpha', 'Beta', 'Refresh', 'New mission', 'Define mission', 'Open questions', 'Remaining tasks'],
};

/** Shows the Remaining tasks pane, then the Open questions pane, running `check` with each shown. */
function eachPane(page: Page, check: (pane: PaneName) => void): void {
  named(page, 'Remaining tasks').click();
  check('tasks');
  named(page, 'Open questions').click();
  check('questions');
}

function filledBlock(page: Page): FakeElement {
  const found = page.root.all().filter((each) => each.has('block') && each.has('next'));
  assert.strictEqual(found.length, 1);
  return found[0];
}

function assertRunning(page: Page): void {
  eachPane(page, (pane) => {
    for (const text of ACTIONS[pane]) {
      assert.strictEqual(named(page, text).disabled, true, `${text} is disabled`);
    }
    for (const text of STAYING[pane]) {
      assert.strictEqual(named(page, text).disabled, false, `${text} stays enabled`);
    }
    assert.strictEqual(filledBlock(page).has('running'), true);
  });
}

function assertIdle(page: Page): void {
  eachPane(page, (pane) => {
    for (const text of [...ACTIONS[pane], ...STAYING[pane]]) {
      assert.strictEqual(named(page, text).disabled, false, `${text} is enabled`);
    }
    assert.strictEqual(filledBlock(page).has('running'), false);
  });
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

/** The pane header row drawn on the page. */
function paneHeaders(page: Page): FakeElement[] {
  const rows = page.root.all().filter((each) => each.has('pane-tabs'));
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].getAttribute('role'), 'tablist');
  return rows[0].children as FakeElement[];
}

/** The pane shown beneath the headers, read from the header marked selected and the one pane drawn. */
function shownPane(page: Page): PaneName {
  const selected = paneHeaders(page).filter((each) => each.getAttribute('aria-selected') === 'true');
  assert.strictEqual(selected.length, 1);
  const drawn = page.root.all().filter((each) => each.has('pane'));
  assert.strictEqual(drawn.length, 1, 'one pane drawn at a time');
  const pane: PaneName = drawn[0].has('tasks') ? 'tasks' : 'questions';
  assert.strictEqual(selected[0].textContent, pane === 'tasks' ? 'Remaining tasks' : 'Open questions');
  return pane;
}

/** Every text drawn on the page. */
function texts(page: Page): string[] {
  return page.root.all().map((each) => each.textContent);
}

/** A live message for Alpha and Beta, each with the default pane given, `undefined` posting none. */
function liveWith(alpha: PaneName | undefined, beta: PaneName | undefined, live: string[] = [ALPHA, BETA]): unknown {
  const each = (missionPath: string, title: string, pane: PaneName | undefined) =>
    mission(missionPath, title, { step: 'derive', ...(pane === undefined ? {} : { defaultPane: pane }) });
  const all = [each(ALPHA, 'Alpha', alpha), each(BETA, 'Beta', beta)];
  return { type: 'live', missions: all.filter((_, index) => live.includes([ALPHA, BETA][index])), recipes: RECIPES, running: [] };
}

test('a mission page draws one row of two pane headers with only the selected pane beneath it', () => {
  const page = loadPage();
  page.send(liveWith('questions', 'questions'));
  assert.deepStrictEqual(
    paneHeaders(page).map((each) => [each.tagName, each.textContent, each.getAttribute('role')]),
    [
      ['button', 'Open questions', 'tab'],
      ['button', 'Remaining tasks', 'tab'],
    ],
  );
  assert.strictEqual(shownPane(page), 'questions');
  assert.ok(texts(page).includes('1 / 2'));
  assert.ok(texts(page).includes('Discuss'));
  assert.ok(!texts(page).includes('First Task'));
  assert.ok(!texts(page).includes('New task'));
  named(page, 'Remaining tasks').click();
  assert.strictEqual(shownPane(page), 'tasks');
  assert.ok(texts(page).includes('First Task'));
  assert.ok(texts(page).includes('New task'));
  assert.ok(!texts(page).includes('1 / 2'));
  assert.ok(!texts(page).includes('Discuss'));
  const tasksPane = page.root.all().filter((each) => each.has('pane'))[0];
  assert.ok(tasksPane.all().some((each) => each.textContent === 'New task'), 'New task stands inside Remaining tasks');
  assert.strictEqual(page.root.all().filter((each) => each.tagName === 'h3' && ['Open questions', 'Remaining tasks'].includes(each.textContent)).length, 0);
});

test('a page opens on the default pane the extension posts, Open questions when none is posted', () => {
  const tasks = loadPage();
  tasks.send(liveWith('tasks', 'questions'));
  assert.strictEqual(shownPane(tasks), 'tasks');
  const questions = loadPage();
  questions.send(liveWith('questions', 'tasks'));
  assert.strictEqual(shownPane(questions), 'questions');
  const none = loadPage();
  none.send(liveWith(undefined, 'tasks'));
  assert.strictEqual(shownPane(none), 'questions');
});

test('with no pane clicked the page follows the default the extension posts with every redraw', () => {
  const page = loadPage();
  page.send(liveWith('questions', 'questions'));
  assert.strictEqual(shownPane(page), 'questions');
  page.send(liveWith('tasks', 'questions'));
  assert.strictEqual(shownPane(page), 'tasks');
});

test('a clicked pane stays selected through redraws and file-event refreshes while its mission stays shown', () => {
  const page = loadPage();
  page.send(liveWith('questions', 'questions'));
  named(page, 'Remaining tasks').click();
  assert.strictEqual(shownPane(page), 'tasks');
  page.send(liveWith('questions', 'questions'));
  assert.strictEqual(shownPane(page), 'tasks');
  page.send({ type: 'running', missions: [ALPHA] });
  assert.strictEqual(shownPane(page), 'tasks');
  page.send({ type: 'running', missions: [] });
  page.send({
    type: 'preview',
    mission: ALPHA,
    recipe: 'complete',
    lines: ['claude "/gurita:complete-task --mission <path> <Task Title>"'],
    names: ['complete-task'],
    result: { state: 'read', tasks: [] },
  });
  assert.strictEqual(shownPane(page), 'tasks');
  page.send({ type: 'loopStarted', mission: ALPHA });
  assert.strictEqual(shownPane(page), 'tasks');
  named(page, 'Alpha').click();
  assert.strictEqual(shownPane(page), 'tasks', 'clicking the tab already shown switches nothing');
  named(page, 'Open questions').click();
  page.send(liveWith('tasks', 'tasks'));
  assert.strictEqual(shownPane(page), 'questions', 'a clicked pane outlasts a changed default');
});

test('every switch of the shown mission gives way to its default', () => {
  const page = loadPage();
  page.send(liveWith('questions', 'tasks'));
  named(page, 'Remaining tasks').click();
  assert.strictEqual(shownPane(page), 'tasks');
  named(page, 'Beta').click();
  assert.strictEqual(shownPane(page), 'tasks');
  named(page, 'Open questions').click();
  assert.strictEqual(shownPane(page), 'questions');
  named(page, 'Alpha').click();
  assert.strictEqual(shownPane(page), 'questions');
  named(page, 'Remaining tasks').click();
  named(page, 'Beta').click();
  named(page, 'Alpha').click();
  assert.strictEqual(shownPane(page), 'questions', 'the click on Alpha was not kept across the visit to Beta');

  named(page, 'Remaining tasks').click();
  page.send({
    type: 'preview',
    mission: BETA,
    recipe: 'complete',
    lines: ['claude "/gurita:complete-task --mission <path> <Task Title>"'],
    names: ['complete-task'],
    result: { state: 'read', tasks: [] },
  });
  named(page, 'Alpha').click();
  assert.strictEqual(shownPane(page), 'questions', 'a preview of another mission switches the mission shown');

  named(page, 'Remaining tasks').click();
  page.send(liveWith('questions', 'tasks', [BETA]));
  assert.strictEqual(shownPane(page), 'tasks', 'the mission fallen back to opens on its own default');
  page.send(liveWith('questions', 'tasks'));
  const shownTab = page.root.all().filter((each) => each.getAttribute('role') === 'tab' && !each.has('pane-tab') && each.getAttribute('aria-selected') === 'true');
  assert.deepStrictEqual(shownTab.map((each) => each.textContent), ['Beta']);
  named(page, 'Open questions').click();
  named(page, 'Alpha').click();
  assert.strictEqual(shownPane(page), 'questions', 'a fall back to the first mission switches the mission shown');
});

test('the failure state and a fresh page give way to the default, and the pane is never saved', () => {
  const page = loadPage();
  page.send(liveWith('questions', 'questions'));
  named(page, 'Remaining tasks').click();
  page.send({ type: 'liveFailure', cause: 'Error: no git' });
  page.send(liveWith('questions', 'questions'));
  assert.strictEqual(shownPane(page), 'questions');
  named(page, 'Remaining tasks').click();
  named(page, 'Beta').click();
  named(page, 'Remaining tasks').click();
  assert.ok(page.saved.length > 0);
  for (const state of page.saved) {
    assert.deepStrictEqual(Object.keys(state as object).sort(), ['positions', 'selected']);
    assert.doesNotMatch(JSON.stringify(state), /tasks|questions/);
  }
  const reopened = loadPage();
  reopened.send(liveWith('questions', 'questions'));
  assert.strictEqual(shownPane(reopened), 'questions');
});

test('the arrow keys move the question view only while the Open questions pane is shown', () => {
  const page = loadPage();
  page.send(liveWith('questions', 'questions'));
  page.key('ArrowRight');
  assert.ok(texts(page).includes('2 / 2'));
  page.key('ArrowLeft');
  assert.ok(texts(page).includes('1 / 2'));
  named(page, 'Remaining tasks').click();
  page.key('ArrowRight');
  assert.strictEqual(shownPane(page), 'tasks');
  named(page, 'Open questions').click();
  assert.ok(texts(page).includes('1 / 2'));
});
