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

  /** Picks the option of `value` in a select, firing its change event as the browser does. */
  change(value: string): void {
    this.value = value;
    for (const listener of this.listeners.get('change') ?? []) {
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

/** A live mission as the extension posts it, with `RECIPES` as its page's recipe list unless `workflow` gives another. */
function mission(missionPath: string, title: string, workflow: Record<string, unknown> = { step: 'derive' }): unknown {
  return {
    path: missionPath,
    state: 'started',
    title,
    recipes: RECIPES,
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
    {
      kind: 'runnable',
      name: 'review',
      group: 'shipped',
      lines: ['claude "/gurita:review-mission-requirements --mission <path>"'],
      variants: [{ name: 'review', own: false }],
      selected: 0,
    },
    {
      kind: 'looped',
      name: 'complete',
      group: 'shipped',
      lines: ['claude "/gurita:complete-task --mission <path> <Task Title>"'],
      variants: [{ name: 'complete', own: false }],
      selected: 0,
    },
  ],
};

function live(running: string[]): unknown {
  return { type: 'live', missions: [mission(ALPHA, 'Alpha'), mission(BETA, 'Beta')], running };
}

function buttons(page: Page): FakeElement[] {
  return page.root.all().filter((each) => each.tagName === 'button');
}

/** The spans a recipe button draws, its name and, when it runs a variant, that variant's name, in order. */
function recipeParts(each: FakeElement): string[] {
  return each.children.filter((child): child is FakeElement => child instanceof FakeElement).map((child) => child.textContent);
}

/** The name a button shows: its own text, or a recipe button's name span. */
function shownName(each: FakeElement): string {
  const name = each.children.find((child): child is FakeElement => child instanceof FakeElement && child.has('recipe-name'));
  return name?.textContent ?? each.textContent;
}

function named(page: Page, text: string): FakeElement {
  const found = buttons(page).find((each) => shownName(each) === text);
  assert.ok(found !== undefined, `no button ${text}`);
  return found;
}

type PaneName = 'questions' | 'tasks';

/** The page's action buttons with each pane shown: its recipe buttons, its question card's buttons, and New task. */
const ACTIONS: Record<PaneName, string[]> = {
  questions: ['review', 'complete', 'New task', 'Discuss', 'Answer', 'Answer with recommendation', 'Answer with this alternative'],
  tasks: ['review', 'complete', 'New task'],
};

/** The buttons that stay enabled whatever runs, with each pane shown. */
const STAYING: Record<PaneName, string[]> = {
  questions: ['Alpha', 'Beta', 'Refresh', 'New mission', 'Define mission', 'Settings', 'Open questions', 'Remaining tasks', 'Next'],
  tasks: ['Alpha', 'Beta', 'Refresh', 'New mission', 'Define mission', 'Settings', 'Open questions', 'Remaining tasks'],
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

test("every tab click posts its mission's path, the tab already selected included", () => {
  const page = loadPage();
  page.send(live([]));
  let count = page.posted.length;
  named(page, 'Alpha').click();
  assert.deepStrictEqual(page.posted.slice(count), [{ type: 'missionTab', mission: ALPHA }], 'the selected tab posts its path');
  count = page.posted.length;
  named(page, 'Beta').click();
  assert.deepStrictEqual(page.posted.slice(count), [{ type: 'missionTab', mission: BETA }], 'an unselected tab posts its path');
  const shownTab = page.root.all().filter((each) => each.getAttribute('role') === 'tab' && !each.has('pane-tab') && each.getAttribute('aria-selected') === 'true');
  assert.deepStrictEqual(shownTab.map((each) => each.textContent), ['Beta'], 'the unselected tab clicked is shown');
  count = page.posted.length;
  named(page, 'Beta').click();
  assert.deepStrictEqual(page.posted.slice(count), [{ type: 'missionTab', mission: BETA }], 'a second click on it posts again');
});

test("a running mission's tab stays enabled and posts its path, selected or not", () => {
  const page = loadPage();
  page.send(live([ALPHA, BETA]));
  for (const [tab, missionPath] of [
    ['Alpha', ALPHA],
    ['Beta', BETA],
    ['Beta', BETA],
    ['Alpha', ALPHA],
  ]) {
    assert.strictEqual(named(page, tab).disabled, false, `${tab} stays enabled`);
    const count = page.posted.length;
    named(page, tab).click();
    assert.deepStrictEqual(page.posted.slice(count), [{ type: 'missionTab', mission: missionPath }]);
  }
});

test("another mission's page is unaffected by a run it does not hold", () => {
  const page = loadPage();
  page.send(live([ALPHA]));
  named(page, 'Beta').click();
  assertIdle(page);
  named(page, 'review').click();
  assert.deepStrictEqual(page.posted[page.posted.length - 1], { type: 'runRecipe', mission: BETA, recipe: 'review', variant: 'review' });
});

/** The names of the recipe entries drawn on the page shown, buttons and non-runnable entries alike, in the order drawn. */
function recipeNames(page: Page): string[] {
  const section = page.root.all().find((each) => each.has('recipes'));
  assert.ok(section !== undefined, 'no recipe section');
  return section.all().filter((each) => each.has('recipe') || each.has('recipe-unknown')).map(shownName);
}

/** The group headings drawn above the recipes on the page shown, in the order drawn. */
function recipeGroups(page: Page): string[] {
  const section = page.root.all().find((each) => each.has('recipes'));
  assert.ok(section !== undefined, 'no recipe section');
  return section.all().filter((each) => each.tagName === 'h4').map((each) => each.textContent);
}

/** One variant a recipe's dropdown offers, as the extension posts it. */
interface Choice {
  name: string;
  own: boolean;
}

/**
 * A runnable page recipe as the extension posts it, its dropdown offering `variants`, one variant
 * named `default` unless given, and standing on `selected`.
 */
function runnable(
  name: string,
  group: string,
  lines: string[],
  variants: Choice[] = [{ name: 'default', own: group === 'own' }],
  selected = 0,
): unknown {
  return { kind: 'runnable', name, group, lines, variants, selected };
}

/** The pane's stylesheet rule for the variant dropdowns, read from the page shell in `src/pane.ts`. */
function variantDropdownRule(): string {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'pane.ts'), 'utf8');
  const rule = /^\s*select\.recipe-variant \{([^}]*)\}/m.exec(source);
  assert.ok(rule !== null, 'the stylesheet holds a rule for the variant dropdowns');
  return rule[1];
}

/**
 * Asserts `dropdown` is drawn as its arrow alone: a variant dropdown, holding no text but its
 * options', its own look replaced by the stylesheet's arrow, its selected name kept out of sight,
 * and its options drawn in the dropdown's colours.
 */
function assertArrowOnly(dropdown: FakeElement): void {
  assert.ok(dropdown.has('recipe-variant'), 'a variant dropdown');
  assert.ok(dropdown.children.every((child) => child instanceof FakeElement && child.tagName === 'option'), 'it holds its options alone');
  const rule = variantDropdownRule();
  for (const declaration of ['appearance: none', 'color: transparent', 'width: 1.8em', 'background-image: linear-gradient(']) {
    assert.ok(rule.includes(declaration), `the dropdown's rule holds ${declaration}`);
  }
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'pane.ts'), 'utf8');
  assert.match(source, /select\.recipe-variant option \{ color: var\(--vscode-dropdown-foreground\);/, 'the opened list shows its options');
}

test("each mission's page draws its shipped recipes under no heading, then its own under Your recipes", () => {
  const derive = {
    state: 'read',
    recipes: [
      runnable('Requirements iteration', 'shipped', ['claude -p "/gurita:review-mission-requirements --mission <path>"']),
      runnable('Prepare tasks', 'shipped', ['claude -p "/gurita:derive-tasks --mission <path>"']),
      runnable('Prepare tasks (Antigravity)', 'shipped', ['agy -p "/gurita:derive-tasks --mission <path>"']),
      runnable('Mine everywhere', 'own', ['echo <path>']),
    ],
  };
  const finish = {
    state: 'read',
    recipes: [
      runnable('Finish mission', 'shipped', ['claude -p "/gurita:finish-mission --mission <path>"']),
      {
        kind: 'unknown',
        name: 'Odd follow up',
        group: 'own',
        lines: ['echo <odd>'],
        placeholders: ['odd'],
        file: '/home/someone/.gurita/recipes.md',
        variants: [{ name: 'default', own: true }],
        selected: 0,
      },
    ],
  };
  const page = loadPage();
  page.send({
    type: 'live',
    missions: [mission(ALPHA, 'Alpha', { step: 'derive', recipes: derive }), mission(BETA, 'Beta', { step: 'finish', recipes: finish })],
    running: [],
  });
  assert.deepStrictEqual(recipeNames(page), ['Requirements iteration', 'Prepare tasks', 'Prepare tasks (Antigravity)', 'Mine everywhere']);
  assert.deepStrictEqual(recipeGroups(page), ['Your recipes']);
  const section = page.root.all().find((each) => each.has('recipes')) as FakeElement;
  assert.deepStrictEqual(
    section.children.filter((child): child is FakeElement => child instanceof FakeElement).map((child) =>
      child.has('recipe-list') ? child.children.map((entry) => shownName((entry as FakeElement).children[0] as FakeElement)) : child.textContent,
    ),
    ['Recipes', ['Requirements iteration', 'Prepare tasks', 'Prepare tasks (Antigravity)'], 'Your recipes', ['Mine everywhere']],
    'the shipped recipes stand directly under Recipes, in the order posted, and the own group below them',
  );
  assert.ok(!recipeGroups(page).includes('Claude Code') && !recipeGroups(page).includes('Antigravity'));
  named(page, 'Prepare tasks').click();
  assert.deepStrictEqual(page.posted[page.posted.length - 1], { type: 'runRecipe', mission: ALPHA, recipe: 'Prepare tasks', variant: 'default' });
  named(page, 'Beta').click();
  assert.deepStrictEqual(recipeNames(page), [
    'Finish mission',
    'Odd follow up: unknown placeholder <odd> in /home/someone/.gurita/recipes.md',
  ]);
  assert.deepStrictEqual(recipeGroups(page), ['Your recipes']);
  named(page, 'Finish mission').click();
  assert.deepStrictEqual(page.posted[page.posted.length - 1], { type: 'runRecipe', mission: BETA, recipe: 'Finish mission', variant: 'default' });
});

test("a page with no own recipe draws no Your recipes heading, and one with only own recipes no shipped list", () => {
  const page = loadPage();
  page.send({
    type: 'live',
    missions: [
      mission(ALPHA, 'Alpha', { step: 'derive', recipes: { state: 'read', recipes: [runnable('Prepare tasks', 'shipped', ['echo <path>'])] } }),
      mission(BETA, 'Beta', { step: 'derive', recipes: { state: 'read', recipes: [runnable('Mine', 'own', ['echo <path>'])] } }),
    ],
    running: [],
  });
  assert.deepStrictEqual(recipeGroups(page), []);
  assert.deepStrictEqual(recipeNames(page), ['Prepare tasks']);
  named(page, 'Beta').click();
  assert.deepStrictEqual(recipeGroups(page), ['Your recipes']);
  assert.deepStrictEqual(recipeNames(page), ['Mine']);
});

test("each recipe button shows its name with the selected variant's name beneath it, exactly as named and never the values its lines carry, and its lines in its hover text", () => {
  const firstRun = [
    'claude -p "/gurita:review-mission-requirements --mission <path>" --model "fable" --effort xhigh;',
    'claude -p "/gurita:provide-alternatives-to-all-open-questions --mission <path>" --model "opus" --effort high;',
    'claude -p "/gurita:recommend-all-open-questions --mission <path>" --model "fable" --effort xhigh;',
  ];
  const mixed = [
    'agy -p "/gurita:review-mission-requirements --mission <path>" --model "gemini-4-argon" --effort medium;',
    'claude -p "/gurita:provide-alternatives-to-all-open-questions --mission <path>" --model "opus" --effort high;',
    'claude -p "/gurita:recommend-all-open-questions --mission <path>" --model "fable" --effort xhigh;',
  ];
  const loop = ['<single-task line>'];
  const page = loadPage();
  page.send({
    type: 'live',
    missions: [
      mission(ALPHA, 'Alpha', {
        step: 'first-review',
        recipes: {
          state: 'read',
          recipes: [
            runnable('First run', 'shipped', firstRun, [{ name: 'Claude Code', own: false }]),
            runnable('Mixed', 'shipped', mixed),
            runnable('Partly read', 'own', ['agy -p "/gurita:finish-mission --mission <path>" --effort low;'], [{ name: 'Mine at low effort', own: true }]),
            {
              kind: 'looped',
              name: 'Execute tasks one at a time',
              group: 'shipped',
              lines: loop,
              variants: [{ name: 'default', own: false }],
              selected: 0,
            },
          ],
        },
      }),
    ],
    running: [],
  });
  assert.deepStrictEqual(recipeParts(named(page, 'First run')), ['First run', 'Claude Code']);
  assert.deepStrictEqual(recipeParts(named(page, 'Mixed')), ['Mixed', 'default']);
  assert.deepStrictEqual(recipeParts(named(page, 'Partly read')), ['Partly read', 'Mine at low effort'], 'the name exactly as the variant is named, with no own mark');
  assert.deepStrictEqual(recipeParts(named(page, 'Execute tasks one at a time')), ['Execute tasks one at a time', 'default'], 'a variant of no readable line shows its name too');
  for (const name of ['First run', 'Mixed', 'Partly read', 'Execute tasks one at a time']) {
    const shown = named(page, name);
    assert.ok(!shown.all().some((each) => each.has('recipe-values')), `${name} draws no values line`);
    assert.ok(!recipeParts(shown).some((part) => part.includes(' · ')), `${name} lists no harnesses, models, or efforts`);
    assert.ok(shown.children.some((child) => child instanceof FakeElement && child.has('recipe-variant-name')), `${name} draws the variant's name`);
  }
  assert.strictEqual(named(page, 'First run').title, firstRun.join('\n'));
  assert.strictEqual(named(page, 'Mixed').title, mixed.join('\n'));
  assert.strictEqual(named(page, 'Execute tasks one at a time').title, loop.join('\n'));
  named(page, 'Execute tasks one at a time').click();
  assert.deepStrictEqual(page.posted[page.posted.length - 1], { type: 'previewLoop', mission: ALPHA, recipe: 'Execute tasks one at a time', variant: 'default' });
});

/** The recipe entries drawn on the page shown, each the entry's button or non-runnable entry with the dropdown beside it. */
function recipeEntries(page: Page): { shown: FakeElement; dropdown: FakeElement | undefined }[] {
  const section = page.root.all().find((each) => each.has('recipes'));
  assert.ok(section !== undefined, 'no recipe section');
  return section
    .all()
    .filter((each) => each.has('recipe-entry'))
    .map((entry) => {
      const children = entry.children.filter((child): child is FakeElement => child instanceof FakeElement);
      return { shown: children[0], dropdown: children.find((child) => child.tagName === 'select') };
    });
}

/** A dropdown's options, each as its text, value, and whether it is the one selected. */
function options(dropdown: FakeElement): [string, string, boolean][] {
  return dropdown.children
    .filter((child): child is FakeElement => child instanceof FakeElement)
    .map((option) => [option.textContent, option.value, option.selected]);
}

/** The Execute tasks recipe as the extension posts it, its dropdown standing on the variant at `selected`. */
function executeTasks(selected: number): unknown {
  const lines = [
    ['claude -p "/gurita:complete-all-tasks --mission <path>" --model "opus" --effort high;'],
    ['agy -p "/gurita:complete-all-tasks --mission <path>" --model "claude-opus-5-5" --effort high;'],
    ['claude -p "/gurita:complete-all-tasks --mission <path>" --model "sonnet" --effort medium;'],
  ][selected];
  const variants = [
    { name: 'Claude Code', own: false },
    { name: 'Antigravity', own: false },
    { name: 'Mine', own: true },
  ];
  return runnable('Execute tasks', 'shipped', lines, variants, selected);
}

test('every recipe entry has an arrow-only dropdown beside it offering its variants in order by their bare names, on the one selected', () => {
  const page = loadPage();
  page.send({
    type: 'live',
    missions: [
      mission(ALPHA, 'Alpha', {
        step: 'execute',
        recipes: {
          state: 'read',
          recipes: [
            executeTasks(1),
            {
              kind: 'looped',
              name: 'Execute tasks one at a time',
              group: 'shipped',
              lines: ['<single-task line>'],
              variants: [{ name: 'default', own: false }],
              selected: 0,
            },
            {
              kind: 'unknown',
              name: 'Odd',
              group: 'own',
              lines: ['echo <odd>'],
              placeholders: ['odd'],
              file: '/home/someone/.gurita/recipes.md',
              variants: [
                { name: 'Plain', own: true },
                { name: 'Odd one', own: true },
              ],
              selected: 1,
            },
          ],
        },
      }),
    ],
    running: [],
  });
  const entries = recipeEntries(page);
  assert.deepStrictEqual(entries.map((entry) => shownName(entry.shown)), [
    'Execute tasks',
    'Execute tasks one at a time',
    'Odd: unknown placeholder <odd> in /home/someone/.gurita/recipes.md',
  ]);
  for (const entry of entries) {
    assert.ok(entry.dropdown !== undefined, `a dropdown beside ${shownName(entry.shown)}`);
    assertArrowOnly(entry.dropdown);
  }
  assert.deepStrictEqual(options(entries[0].dropdown as FakeElement), [
    ['Claude Code', '0', false],
    ['Antigravity', '1', true],
    ['Mine', '2', false],
  ]);
  assert.deepStrictEqual(options(entries[1].dropdown as FakeElement), [['default', '0', true]]);
  assert.deepStrictEqual(options(entries[2].dropdown as FakeElement), [
    ['Plain', '0', false],
    ['Odd one', '1', true],
  ]);
  assert.ok(
    entries.every((entry) => options(entry.dropdown as FakeElement).every(([text]) => !text.includes('(yours)'))),
    'no option carries an own mark',
  );
  assert.strictEqual((entries[0].dropdown as FakeElement).getAttribute('aria-label'), 'The variant of Execute tasks');
  assert.strictEqual((entries[0].dropdown as FakeElement).title, 'The variant of Execute tasks');
});

test("the button's label and hover text follow the selected variant, and a click runs that variant", () => {
  const page = loadPage();
  const live = (selected: number) => ({
    type: 'live',
    missions: [mission(ALPHA, 'Alpha', { step: 'execute', recipes: { state: 'read', recipes: [executeTasks(selected)] } })],
    running: [],
  });
  page.send(live(0));
  assert.deepStrictEqual(recipeParts(named(page, 'Execute tasks')), ['Execute tasks', 'Claude Code']);
  assert.strictEqual(named(page, 'Execute tasks').title, 'claude -p "/gurita:complete-all-tasks --mission <path>" --model "opus" --effort high;');
  const before = page.posted.length;
  (recipeEntries(page)[0].dropdown as FakeElement).change('2');
  assert.deepStrictEqual(
    page.posted.slice(before),
    [{ type: 'selectVariant', mission: ALPHA, recipe: 'Execute tasks', variant: 'Mine' }],
    'picking a variant posts its name for the recipe on this mission, and nothing runs',
  );
  page.send(live(2));
  assert.deepStrictEqual(recipeParts(named(page, 'Execute tasks')), ['Execute tasks', 'Mine']);
  assert.strictEqual(named(page, 'Execute tasks').title, 'claude -p "/gurita:complete-all-tasks --mission <path>" --model "sonnet" --effort medium;');
  assert.deepStrictEqual(options(recipeEntries(page)[0].dropdown as FakeElement).map(([, , picked]) => picked), [false, false, true]);
  named(page, 'Execute tasks').click();
  assert.deepStrictEqual(page.posted[page.posted.length - 1], { type: 'runRecipe', mission: ALPHA, recipe: 'Execute tasks', variant: 'Mine' });
  page.send(live(1));
  assert.deepStrictEqual(recipeParts(named(page, 'Execute tasks')), ['Execute tasks', 'Antigravity']);
  named(page, 'Execute tasks').click();
  assert.deepStrictEqual(page.posted[page.posted.length - 1], { type: 'runRecipe', mission: ALPHA, recipe: 'Execute tasks', variant: 'Antigravity' });
});

test('no dropdown stands beside a fixed-name button posted with nothing, and the recipe dropdowns stay enabled while a run goes', () => {
  const page = loadPage();
  page.send(live([ALPHA]));
  eachPane(page, () => {
    const selects = page.root.all().filter((each) => each.tagName === 'select');
    const section = page.root.all().find((each) => each.has('recipes')) as FakeElement;
    const inRecipes = section.all().filter((each) => each.tagName === 'select');
    assert.strictEqual(selects.length, 2, 'one dropdown per recipe entry, none elsewhere');
    assert.deepStrictEqual(inRecipes, selects, 'every dropdown stands in the recipe list');
    for (const select of selects) {
      assert.strictEqual(select.disabled, false);
    }
    for (const text of ['Discuss', 'Answer', 'Answer with recommendation', 'Answer with this alternative', 'New task', 'New mission', 'Define mission']) {
      if (buttons(page).some((each) => shownName(each) === text)) {
        assert.ok(!section.all().includes(named(page, text)), `${text} stands outside the recipe list`);
      }
    }
  });
});

/** Each fixed-name button's label, the button's key, and the hover text it shows while its recipe cannot be read. */
const FIXED_BUTTONS: [string, string, string][] = [
  ['New mission', 'discussGoal', 'Type a goal and open an interactive discussion of it'],
  ['Define mission', 'defineMission', 'Type a goal and its scope and define the mission'],
  ['New task', 'discussTask', 'Type an issue and open an interactive discussion of it into tasks for this mission'],
  ['Discuss', 'discussQuestion', 'Type an optional note and open an interactive discussion of this question'],
  ['Answer', 'answerQuestion', 'Record an answer you type as the decision'],
  ['Answer with recommendation', 'answerWithRecommendation', "Record this question's recommendation as the decision"],
  ['Answer with this alternative', 'answerWithAlternative', 'Record keep as the decision'],
];

/** The two mission-starting buttons, posted with the pages and the failure state rather than with a mission. */
const STARTING_KEYS = ['discussGoal', 'defineMission'];

/** A mission as `mission` builds it, enough of its questions to post a button per alternative. */
interface BuiltMission {
  questions: { state: string; questions?: { id: string; alternatives: { id: string }[] }[] };
}

/**
 * A live message for Alpha and Beta, the two mission-starting buttons of `entries` posted with the pages,
 * its answer-with-alternative entry posted once for every alternative of every question of each mission,
 * and the other four with each mission, every mission built by `build`.
 */
function liveButtons(entries: Record<string, unknown>, running: string[] = [], build: (missionPath: string, title: string) => unknown = mission): unknown {
  const starting = Object.fromEntries(Object.entries(entries).filter(([key]) => STARTING_KEYS.includes(key)));
  const onPage = Object.fromEntries(Object.entries(entries).filter(([key]) => !STARTING_KEYS.includes(key) && key !== 'answerWithAlternative'));
  const withButtons = (missionPath: string, title: string) => {
    const built = build(missionPath, title) as BuiltMission;
    const entry = entries.answerWithAlternative;
    const alternativeButtons =
      entry === undefined
        ? []
        : (built.questions.questions ?? []).flatMap((question) =>
            question.alternatives.map((alternative) => ({ question: question.id, alternative: alternative.id, entry })),
          );
    return { ...built, buttons: onPage, alternativeButtons };
  };
  return {
    type: 'live',
    missions: [withButtons(ALPHA, 'Alpha'), withButtons(BETA, 'Beta')],
    running,
    buttons: starting,
  };
}

/** What each fixed-name button runs, as the extension posts it, every button on one line of `model` at `effort`, offering its one variant, `default`. */
function fixedButtons(model: string, effort: string): Record<string, unknown> {
  return Object.fromEntries(
    FIXED_BUTTONS.map(([, key]) => [
      key,
      {
        state: 'offered',
        lines: [`claude -p "/gurita:${key} --mission <path>" --model "${model}" --effort ${effort};`],
        variants: [{ name: 'default', own: false }],
        selected: 0,
      },
    ]),
  );
}

/** Each fixed-name button drawn with the Remaining tasks pane and then the Open questions pane shown, by its label: its spans and its hover text. */
function fixedShown(page: Page): Record<string, [string[], string]> {
  const shown: Record<string, [string[], string]> = {};
  eachPane(page, () => {
    for (const [label] of FIXED_BUTTONS) {
      if (buttons(page).some((each) => shownName(each) === label)) {
        const drawn = named(page, label);
        shown[label] = [recipeParts(drawn), drawn.title];
      }
    }
  });
  return shown;
}

test("every fixed-name button shows its name with its selected variant's name beneath it, never the values its lines carry, and its lines in its hover text, following what is posted", () => {
  const page = loadPage();
  page.send(liveButtons(fixedButtons('fable', 'xhigh')));
  const expected = (model: string, effort: string) =>
    Object.fromEntries(
      FIXED_BUTTONS.map(([label, key]) => [
        label,
        [[label, 'default'], `claude -p "/gurita:${key} --mission <path>" --model "${model}" --effort ${effort};`],
      ]),
    );
  assert.deepStrictEqual(fixedShown(page), expected('fable', 'xhigh'), 'all seven buttons, with either pane shown');

  // A default picked in the settings view reaches every button with the pages posted again.
  page.send(liveButtons(fixedButtons('opus', 'high')));
  assert.deepStrictEqual(fixedShown(page), expected('opus', 'high'));

  // A variant of several lines shows its name alone beneath the button's, and its lines as written.
  const mixed = [
    'agy -i "/gurita:discuss-open-question --mission <path> <Short Title>. <note>" --model "gemini-4-argon" --effort medium; # interactive',
    'claude -p "/gurita:recommend-all-open-questions --mission <path>" --model "opus" --effort high;',
  ];
  const one = (name: string) => ({ variants: [{ name, own: false }], selected: 0 });
  page.send(
    liveButtons({
      ...fixedButtons('opus', 'high'),
      discussQuestion: { state: 'offered', lines: mixed, ...one('Mixed') },
      defineMission: { state: 'offered', lines: ['echo <goal> <scope>'], ...one('Echo') },
      answerQuestion: undefined,
      discussTask: undefined,
    }),
  );
  const shown = fixedShown(page);
  assert.deepStrictEqual(shown.Discuss, [['Discuss', 'Mixed'], mixed.join('\n')]);
  assert.deepStrictEqual(shown['Define mission'], [['Define mission', 'Echo'], 'echo <goal> <scope>'], 'a variant of no readable line shows its name too');
  assert.deepStrictEqual(shown.Answer, [['Answer'], 'Record an answer you type as the decision'], 'a recipe that cannot be read shows the name alone');
  assert.deepStrictEqual(shown['New task'], [['New task'], 'Type an issue and open an interactive discussion of it into tasks for this mission']);

  // Nothing posted for the buttons: every one shows its name alone.
  page.send(live([]));
  assert.deepStrictEqual(
    fixedShown(page),
    Object.fromEntries(FIXED_BUTTONS.map(([label, , hover]) => [label, [[label], hover]])),
  );

  // The failure state's two mission-starting buttons follow what it is posted with.
  page.send({ type: 'liveFailure', cause: 'boom', buttons: { discussGoal: fixedButtons('sonnet', 'medium').discussGoal, defineMission: fixedButtons('sonnet', 'medium').defineMission } });
  assert.deepStrictEqual(recipeParts(named(page, 'New mission')), ['New mission', 'default']);
  assert.strictEqual(named(page, 'Define mission').title, 'claude -p "/gurita:defineMission --mission <path>" --model "sonnet" --effort medium;');

  // A click posts the variant selected with what it posted before, and a run disables the mission's fixed-name buttons alone.
  page.send(liveButtons(fixedButtons('fable', 'xhigh')));
  named(page, 'Discuss').click();
  named(page, 'New mission').click();
  assert.deepStrictEqual(page.posted.slice(-2), [
    { type: 'questionButton', button: 'discussQuestion', mission: ALPHA, question: 'Pane Layout', variant: 'default' },
    { type: 'missionButton', button: 'discussGoal', variant: 'default' },
  ]);
  page.send(liveButtons(fixedButtons('fable', 'xhigh'), [ALPHA]));
  assertRunning(page);
});

/** A live mission whose question view's first card carries two alternatives, keep and drop. */
function twoAlternatives(missionPath: string, title: string): unknown {
  const built = mission(missionPath, title) as { questions: { questions: { alternatives: unknown[] }[] } };
  built.questions.questions[0].alternatives = [
    { id: 'keep', text: 'Keep it.', advantages: [], drawbacks: [] },
    { id: 'drop', text: 'Drop it.', advantages: [], drawbacks: [] },
  ];
  return built;
}

/** The entry holding the button `drawn`. */
function entryOf(page: Page, drawn: FakeElement): FakeElement {
  const entry = page.root.all().find((each) => each.has('recipe-entry') && each.children.includes(drawn));
  assert.ok(entry !== undefined, 'the button stands in an entry');
  return entry;
}

/** The dropdown drawn beside the button labelled `label`, in the entry holding it, or undefined when none stands there. */
function dropdownBeside(page: Page, label: string): FakeElement | undefined {
  return entryOf(page, named(page, label)).children.find((child): child is FakeElement => child instanceof FakeElement && child.tagName === 'select');
}

/** The dropdowns drawn beside the answer-with-alternative buttons, in the card's order. */
function alternativeDropdowns(page: Page): FakeElement[] {
  return page.root.all().filter((each) => each.tagName === 'select' && each.getAttribute('aria-label') === 'The variant of Answer with this alternative');
}

test('a dropdown beside each fixed-name button offers its variants and stands on the one selected, its pick, the label, and a click following it', () => {
  const page = loadPage();
  const models = ['fable', 'opus'];
  /** Each button offering a shipped Fable and an own Opus variant, standing on the one at `selected`. */
  const offered = (selected: number) =>
    Object.fromEntries(
      FIXED_BUTTONS.map(([, key]) => [
        key,
        {
          state: 'offered',
          lines: [`claude -p "/gurita:${key}" --model "${models[selected]}" --effort high;`],
          variants: [
            { name: 'Fable', own: false },
            { name: 'Opus', own: true },
          ],
          selected,
        },
      ]),
    );
  page.send(liveButtons(offered(1), [], twoAlternatives));
  const besides: Record<string, [string, string, boolean][]> = {};
  eachPane(page, (pane) => {
    for (const [label] of FIXED_BUTTONS) {
      if (pane === 'tasks' && ['Discuss', 'Answer', 'Answer with recommendation', 'Answer with this alternative'].includes(label)) {
        continue;
      }
      const dropdown = dropdownBeside(page, label);
      assert.ok(dropdown !== undefined, `a dropdown stands beside ${label}`);
      assert.strictEqual(dropdown.getAttribute('aria-label'), `The variant of ${label}`);
      assertArrowOnly(dropdown);
      besides[label] = options(dropdown);
      assert.deepStrictEqual(recipeParts(named(page, label)), [label, 'Opus'], `${label} shows the variant selected by its bare name`);
    }
  });
  const selectedOpus: [string, string, boolean][] = [
    ['Fable', '0', false],
    ['Opus', '1', true],
  ];
  assert.deepStrictEqual(besides, Object.fromEntries(FIXED_BUTTONS.map(([label]) => [label, selectedOpus])));

  // Each answer-with-alternative button has a dropdown of its own beside it, and none is shared beside the Alternatives heading.
  const alternatives = buttons(page).filter((each) => shownName(each) === 'Answer with this alternative');
  assert.strictEqual(alternatives.length, 2);
  const own = alternativeDropdowns(page);
  assert.strictEqual(own.length, 2, 'one dropdown per alternative');
  assert.ok(!page.root.all().some((each) => each.has('alternatives-head')), 'no dropdown stands beside the Alternatives heading');
  for (const [index, each] of alternatives.entries()) {
    assert.ok(entryOf(page, each).children.includes(own[index]), 'each dropdown stands beside its own button');
    assertArrowOnly(own[index]);
    assert.deepStrictEqual(options(own[index]), selectedOpus);
    assert.deepStrictEqual(recipeParts(each), ['Answer with this alternative', 'Opus']);
    assert.strictEqual(each.title, 'claude -p "/gurita:answerWithAlternative" --model "opus" --effort high;');
  }

  // A pick posts the variant with the button, and the mission for a button on a mission's page.
  let count = page.posted.length;
  (dropdownBeside(page, 'Discuss') as FakeElement).change('0');
  own[1].change('0');
  (dropdownBeside(page, 'New mission') as FakeElement).change('0');
  (dropdownBeside(page, 'Define mission') as FakeElement).change('1');
  named(page, 'Remaining tasks').click();
  (dropdownBeside(page, 'New task') as FakeElement).change('0');
  assert.deepStrictEqual(page.posted.slice(count), [
    { type: 'selectButtonVariant', button: 'discussQuestion', mission: ALPHA, variant: 'Fable' },
    { type: 'selectAlternativeVariant', mission: ALPHA, question: 'Pane Layout', alternative: 'drop', variant: 'Fable' },
    { type: 'selectButtonVariant', button: 'discussGoal', variant: 'Fable' },
    { type: 'selectButtonVariant', button: 'defineMission', variant: 'Opus' },
    { type: 'selectButtonVariant', button: 'discussTask', mission: ALPHA, variant: 'Fable' },
  ]);

  // A click posts the variant selected.
  count = page.posted.length;
  named(page, 'New task').click();
  named(page, 'Define mission').click();
  named(page, 'Open questions').click();
  named(page, 'Answer').click();
  for (const each of buttons(page).filter((node) => shownName(node) === 'Answer with this alternative')) {
    each.click();
  }
  assert.deepStrictEqual(page.posted.slice(count), [
    { type: 'taskButton', mission: ALPHA, variant: 'Opus' },
    { type: 'missionButton', button: 'defineMission', variant: 'Opus' },
    { type: 'questionButton', button: 'answerQuestion', mission: ALPHA, question: 'Pane Layout', variant: 'Opus' },
    { type: 'alternativeButton', mission: ALPHA, question: 'Pane Layout', alternative: 'keep', variant: 'Opus' },
    { type: 'alternativeButton', mission: ALPHA, question: 'Pane Layout', alternative: 'drop', variant: 'Opus' },
  ]);

  // The pages posted again with another variant selected: the dropdowns, the labels, and a click follow it.
  page.send(liveButtons(offered(0), [], twoAlternatives));
  assert.deepStrictEqual(options(dropdownBeside(page, 'Discuss') as FakeElement).map(([, , picked]) => picked), [true, false]);
  assert.deepStrictEqual(recipeParts(named(page, 'Discuss')), ['Discuss', 'Fable']);
  assert.strictEqual(named(page, 'Discuss').title, 'claude -p "/gurita:discussQuestion" --model "fable" --effort high;');
  count = page.posted.length;
  named(page, 'Discuss').click();
  assert.deepStrictEqual(page.posted.slice(count), [{ type: 'questionButton', button: 'discussQuestion', mission: ALPHA, question: 'Pane Layout', variant: 'Fable' }]);

  // While a run goes the buttons are disabled and every dropdown stays enabled.
  page.send(liveButtons(offered(1), [ALPHA], twoAlternatives));
  assertRunning(page);
  eachPane(page, () => {
    for (const select of page.root.all().filter((each) => each.tagName === 'select')) {
      assert.strictEqual(select.disabled, false);
    }
  });
});

test("each answer-with-alternative button draws, picks, and runs the variant its own dropdown stands on, whatever another alternative's stands on", () => {
  const page = loadPage();
  /** The entry of one alternative's button, offering a shipped Fable and an own Opus variant, standing on the one at `selected`. */
  const entry = (selected: number) => ({
    state: 'offered',
    lines: [`claude -p "/gurita:answer-open-question-with-alternative" --model "${['fable', 'opus'][selected]}" --effort high;`],
    variants: [
      { name: 'Fable', own: false },
      { name: 'Opus', own: true },
    ],
    selected,
  });
  /** A live message for Alpha alone, its first card's keep and drop buttons standing on the variants at `keep` and `drop`. */
  const send = (keep: unknown, drop: unknown) =>
    page.send({
      type: 'live',
      missions: [
        {
          ...(twoAlternatives(ALPHA, 'Alpha') as object),
          buttons: {},
          alternativeButtons: [
            { question: 'Pane Layout', alternative: 'keep', entry: keep },
            { question: 'Pane Layout', alternative: 'drop', entry: drop },
          ],
        },
      ],
      running: [],
      buttons: {},
    });
  const shown = () => {
    const drawn = buttons(page).filter((each) => shownName(each) === 'Answer with this alternative');
    return drawn.map((each) => [recipeParts(each), each.title, options(entryOf(page, each).children.find((child): child is FakeElement => child instanceof FakeElement && child.tagName === 'select') as FakeElement).map(([, , picked]) => picked)]);
  };

  send(entry(0), entry(1));
  assert.deepStrictEqual(shown(), [
    [['Answer with this alternative', 'Fable'], 'claude -p "/gurita:answer-open-question-with-alternative" --model "fable" --effort high;', [true, false]],
    [['Answer with this alternative', 'Opus'], 'claude -p "/gurita:answer-open-question-with-alternative" --model "opus" --effort high;', [false, true]],
  ], 'each button and its dropdown stand on the variant posted for its own alternative');

  // A pick on one alternative posts that alternative alone, and nothing runs.
  let count = page.posted.length;
  alternativeDropdowns(page)[0].change('1');
  assert.deepStrictEqual(page.posted.slice(count), [{ type: 'selectAlternativeVariant', mission: ALPHA, question: 'Pane Layout', alternative: 'keep', variant: 'Opus' }]);

  // Each click posts the variant its own button stands on.
  count = page.posted.length;
  for (const each of buttons(page).filter((node) => shownName(node) === 'Answer with this alternative')) {
    each.click();
  }
  assert.deepStrictEqual(page.posted.slice(count), [
    { type: 'alternativeButton', mission: ALPHA, question: 'Pane Layout', alternative: 'keep', variant: 'Fable' },
    { type: 'alternativeButton', mission: ALPHA, question: 'Pane Layout', alternative: 'drop', variant: 'Opus' },
  ]);

  // Posted again with keep on Opus, keep follows and drop stays where it stood.
  send(entry(1), entry(1));
  assert.deepStrictEqual(shown().map(([parts, , picked]) => [parts, picked]), [
    [['Answer with this alternative', 'Opus'], [false, true]],
    [['Answer with this alternative', 'Opus'], [false, true]],
  ]);

  // A button posted with no variant is drawn disabled with no dropdown; one posted with nothing shows its name alone, with none.
  send({ state: 'disabled', cause: 'Every variant has a line on a disabled harness.' }, entry(0));
  const [keep, drop] = buttons(page).filter((each) => shownName(each) === 'Answer with this alternative');
  assert.strictEqual(keep.disabled, true);
  assert.strictEqual(alternativeDropdowns(page).length, 1);
  assert.ok(entryOf(page, drop).children.includes(alternativeDropdowns(page)[0]), 'the other alternative keeps its own dropdown');
  page.send({ type: 'live', missions: [{ ...(twoAlternatives(ALPHA, 'Alpha') as object), buttons: {} }], running: [], buttons: {} });
  assert.strictEqual(alternativeDropdowns(page).length, 0);
  assert.deepStrictEqual(recipeParts(buttons(page).filter((each) => shownName(each) === 'Answer with this alternative')[1]), ['Answer with this alternative']);
  assert.strictEqual(buttons(page).filter((each) => shownName(each) === 'Answer with this alternative')[1].title, 'Record drop as the decision');
});

test('a fixed-name button posted with no variant, every one left out for a disabled harness, stays drawn but disabled, with no dropdown', () => {
  const page = loadPage();
  const cause = 'Every variant of the recipe this button can run has a line on a disabled harness.';
  const none = Object.fromEntries(FIXED_BUTTONS.map(([, key]) => [key, { state: 'disabled', cause }]));
  page.send(liveButtons(none));
  eachPane(page, () => {
    for (const [label, , hover] of FIXED_BUTTONS) {
      if (buttons(page).some((each) => shownName(each) === label)) {
        const drawn = named(page, label);
        assert.strictEqual(drawn.disabled, true, `${label} is disabled`);
        assert.deepStrictEqual(recipeParts(drawn), [label], `${label} shows its name alone`);
        assert.strictEqual(drawn.title, `${hover}\n${cause}`);
        assert.strictEqual(dropdownBeside(page, label), undefined, `no dropdown stands beside ${label}`);
      }
    }
    const section = page.root.all().find((each) => each.has('recipes')) as FakeElement;
    assert.deepStrictEqual(
      page.root.all().filter((each) => each.tagName === 'select'),
      section.all().filter((each) => each.tagName === 'select'),
      'only the recipe list holds dropdowns',
    );
  });
  for (const text of ['review', 'Refresh', 'Settings']) {
    assert.strictEqual(named(page, text).disabled, false, `${text} stays enabled`);
  }

  // The failure state draws its two mission-starting buttons the same way.
  page.send({ type: 'liveFailure', cause: 'boom', buttons: { discussGoal: { state: 'disabled', cause }, defineMission: fixedButtons('sonnet', 'medium').defineMission } });
  assert.strictEqual(named(page, 'New mission').disabled, true);
  assert.strictEqual(dropdownBeside(page, 'New mission'), undefined);
  assert.strictEqual(named(page, 'Define mission').disabled, false);
  assert.ok(dropdownBeside(page, 'Define mission') !== undefined);
});

test("a mission's page draws the recipe failure posted with its mission", () => {
  const page = loadPage();
  page.send({
    type: 'live',
    missions: [mission(ALPHA, 'Alpha', { step: 'derive', recipes: { state: 'failed', cause: 'EACCES: recipes.md' } })],
    running: [],
  });
  const section = page.root.all().find((each) => each.has('recipes'));
  assert.ok(section !== undefined);
  assert.deepStrictEqual(
    section.all().filter((each) => each.tagName === 'p' || each.tagName === 'pre').map((each) => each.textContent),
    ['The recipes could not be read.', 'EACCES: recipes.md'],
  );
  assert.deepStrictEqual(recipeNames(page), []);
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
  page.send({ type: 'live', missions: [mission(ALPHA, 'Alpha', workflow)], running });
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
  page.send({ type: 'live', missions: [mission(ALPHA, 'Alpha', workflow)], running });
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
  return { type: 'live', missions: all.filter((_, index) => live.includes([ALPHA, BETA][index])), running: [] };
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
  named(page, 'Remaining tasks').click();
  assert.strictEqual(shownPane(page), 'tasks');
  assert.ok(texts(page).includes('First Task'));
  assert.ok(!texts(page).includes('1 / 2'));
  assert.ok(!texts(page).includes('Discuss'));
  assert.strictEqual(page.root.all().filter((each) => each.tagName === 'h3' && ['Open questions', 'Remaining tasks'].includes(each.textContent)).length, 0);
});

/** Asserts the New task button stands in a row of its own directly above the pane headers, and nowhere inside a pane. */
function assertNewTaskAbovePanes(page: Page): void {
  const newTask = named(page, 'New task');
  const panes = page.root.all().filter((each) => each.has('panes'));
  assert.strictEqual(panes.length, 1);
  const rows = panes[0].children as FakeElement[];
  const headers = rows.findIndex((each) => each.has('pane-tabs'));
  assert.ok(headers > 0, 'a row stands above the pane headers');
  const row = rows[headers - 1];
  assert.ok(row.has('new-task'), 'the row directly above the headers is the New task row');
  assert.ok(row.all().includes(newTask), 'New task stands in that row');
  assert.deepStrictEqual(
    row.all().filter((each) => each.tagName === 'button').map(shownName),
    ['New task'],
    'the row holds New task alone',
  );
  for (const pane of page.root.all().filter((each) => each.has('pane'))) {
    assert.ok(!pane.all().includes(newTask), 'New task stands in no pane');
    assert.ok(!pane.all().some((each) => each.textContent === 'New task'), 'no pane draws New task');
  }
}

test('the New task button stands above the pane headers with either pane shown, and not inside Remaining tasks', () => {
  for (const step of ['define', 'first-review', 'additional-review', 'derive', 'execute', 'follow-up', 'finish', undefined]) {
    const page = loadPage();
    page.send({
      type: 'live',
      missions: [mission(ALPHA, 'Alpha', step === undefined ? {} : { step }), mission(BETA, 'Beta')],
      running: [],
    });
    assert.strictEqual(shownPane(page), 'questions');
    assertNewTaskAbovePanes(page);
    assert.strictEqual(named(page, 'New task').disabled, false);
    named(page, 'Remaining tasks').click();
    assert.strictEqual(shownPane(page), 'tasks');
    assertNewTaskAbovePanes(page);
    assert.ok(texts(page).includes('First Task'));
    named(page, 'Open questions').click();
    named(page, 'New task').click();
    assert.deepStrictEqual(page.posted.slice(-1), [{ type: 'taskButton', mission: ALPHA }]);
  }

  // A page that opens on Open questions draws it too, and a run for the mission disables it with either pane shown.
  const page = loadPage();
  page.send({ ...(liveWith('questions', 'tasks') as object), running: [ALPHA] });
  eachPane(page, () => {
    assertNewTaskAbovePanes(page);
    assert.strictEqual(named(page, 'New task').disabled, true);
  });
  page.send(liveWith('questions', 'tasks'));
  eachPane(page, () => {
    assertNewTaskAbovePanes(page);
    assert.strictEqual(named(page, 'New task').disabled, false);
  });
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

/** The settings view drawn beneath the tab row, when one is. */
function settingsView(page: Page): FakeElement | undefined {
  const drawn = page.root.all().filter((each) => each.has('settings'));
  assert.ok(drawn.length <= 1);
  return drawn[0];
}

/** The tab row's controls belonging to no mission, in the order drawn. */
function rowEnds(page: Page): string[] {
  const ends = page.root.all().find((each) => each.has('ends'));
  assert.ok(ends !== undefined);
  return ends.all().filter((each) => each.tagName === 'button').map(shownName);
}

/** The titles of the mission tabs that read selected. */
function selectedTabs(page: Page): string[] {
  return page.root
    .all()
    .filter((each) => each.getAttribute('role') === 'tab' && each.getAttribute('aria-selected') === 'true' && !each.has('pane-tab'))
    .map((each) => each.textContent);
}

test('the settings control stands at the end of the tab row, after Refresh, New mission, and Define mission, in the failure state too', () => {
  const page = loadPage();
  page.send(live([]));
  assert.deepStrictEqual(rowEnds(page), ['Refresh', 'New mission', 'Define mission', 'Settings']);
  const tabs = page.root.all().find((each) => each.has('tab-list'));
  assert.ok(tabs !== undefined);
  assert.deepStrictEqual(
    tabs.all().filter((each) => each.tagName === 'button').map((each) => each.textContent),
    ['Alpha', 'Beta'],
    'the mission tabs hold missions only',
  );
  page.send({ type: 'liveFailure', cause: 'Error: no repository' });
  assert.deepStrictEqual(rowEnds(page), ['Refresh', 'New mission', 'Define mission', 'Settings']);
});

test('the settings control swaps the mission page for the settings view, and its close control swaps back to the page shown before', () => {
  const page = loadPage();
  page.send(liveWith('questions', 'questions'));
  named(page, 'Beta').click();
  named(page, 'Remaining tasks').click();
  const count = page.posted.length;
  named(page, 'Settings').click();
  const view = settingsView(page);
  assert.ok(view !== undefined, 'the settings view is drawn');
  assert.strictEqual(page.root.all().filter((each) => each.has('page')).length, 0, 'no mission page beneath the row');
  assert.strictEqual(blocks(page).length, 0, 'no workflow diagram');
  assert.deepStrictEqual(selectedTabs(page), [], 'no tab reads selected');
  assert.strictEqual(named(page, 'Settings').getAttribute('aria-pressed'), 'true');
  assert.deepStrictEqual(rowEnds(page), ['Refresh', 'New mission', 'Define mission', 'Settings']);
  assert.deepStrictEqual(
    view.all().filter((each) => ['input', 'textarea'].includes(each.tagName)),
    [],
    'nothing is typed on the settings view',
  );
  assert.deepStrictEqual(
    [...new Set(view.all().map((each) => each.tagName))].filter(
      (tag) => !['section', 'h3', 'h4', 'div', 'p', 'pre', 'ul', 'li', 'span', 'button', 'select', 'option'].includes(tag),
    ),
    [],
    'the settings view holds text, buttons, and dropdowns only',
  );
  named(page, 'Close settings').click();
  assert.strictEqual(settingsView(page), undefined);
  assert.deepStrictEqual(selectedTabs(page), ['Beta'], 'back on the mission shown before');
  assert.strictEqual(shownPane(page), 'tasks', 'with the pane it showed');
  assert.strictEqual(named(page, 'Settings').getAttribute('aria-pressed'), 'false');
  assert.deepStrictEqual(page.posted.slice(count), [{ type: 'settingsOpened' }], 'the opening is posted, the swap back posts nothing');
});

test("a click on any mission tab swaps the settings view back to that mission's page", () => {
  const page = loadPage();
  page.send(live([]));
  named(page, 'Settings').click();
  const count = page.posted.length;
  named(page, 'Beta').click();
  assert.strictEqual(settingsView(page), undefined);
  assert.deepStrictEqual(selectedTabs(page), ['Beta']);
  assert.strictEqual(page.root.all().filter((each) => each.has('page')).length, 1);
  assert.deepStrictEqual(page.posted.slice(count), [{ type: 'missionTab', mission: BETA }]);
  named(page, 'Settings').click();
  named(page, 'Beta').click();
  assert.strictEqual(settingsView(page), undefined, 'the tab of the mission shown before swaps back too');
  assert.deepStrictEqual(selectedTabs(page), ['Beta']);
});

test('the settings view stays shown through every answer the extension posts until it is swapped back', () => {
  const page = loadPage();
  page.send(live([]));
  named(page, 'Settings').click();
  page.send(live([ALPHA]));
  assert.ok(settingsView(page) !== undefined);
  page.send({ type: 'running', missions: [] });
  assert.ok(settingsView(page) !== undefined);
  assert.strictEqual(named(page, 'Settings').disabled, false);
  page.key('ArrowRight');
  assert.ok(settingsView(page) !== undefined, 'the arrow keys move no question view');
  page.send({ type: 'liveFailure', cause: 'Error: no repository' });
  assert.ok(settingsView(page) !== undefined);
  assert.ok(!texts(page).includes('The live missions could not be read.'));
  named(page, 'Close settings').click();
  assert.ok(texts(page).includes('The live missions could not be read.'), 'back on the failure state shown before');
});

test('in the failure state the settings control swaps the failure for the settings view, and its close control swaps back', () => {
  const page = loadPage();
  page.send({ type: 'liveFailure', cause: 'Error: no repository' });
  named(page, 'Settings').click();
  assert.ok(settingsView(page) !== undefined);
  assert.ok(!texts(page).includes('The live missions could not be read.'));
  assert.ok(!texts(page).includes('Error: no repository'));
  assert.deepStrictEqual(rowEnds(page), ['Refresh', 'New mission', 'Define mission', 'Settings']);
  named(page, 'Close settings').click();
  assert.strictEqual(settingsView(page), undefined);
  assert.ok(texts(page).includes('The live missions could not be read.'));
  assert.ok(texts(page).includes('Error: no repository'));
  page.send(live([]));
  assert.strictEqual(settingsView(page), undefined, 'a later answer draws the mission pages');
  assert.deepStrictEqual(selectedTabs(page), ['Alpha']);
});

test('the extension contributes no command for the settings view', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8')) as {
    contributes: { commands: { command: string }[] };
  };
  assert.deepStrictEqual(
    manifest.contributes.commands.map((each) => each.command),
    ['gurita.openMissionPane', 'gurita.refreshMissions', 'gurita.newMission', 'gurita.defineMission', 'gurita.pickStartingVariant'],
  );
});

/** A harness check as the extension posts it: Claude Code passing, Antigravity on another version, Codex not found. */
const CHECKED = {
  type: 'harnessCheck',
  check: {
    state: 'checked',
    harnesses: [
      { key: 'claude', name: 'Claude Code', cli: 'claude', installed: '2.0.0', packaged: '2.0.0' },
      { key: 'antigravity', name: 'Antigravity', cli: 'agy', failed: 'version', installed: '1.9.0', packaged: '2.0.0' },
      { key: 'codex', name: 'Codex', cli: 'codex', failed: 'cli', packaged: '2.0.0' },
    ],
  },
};

/** Each harness the settings view lists: its key, the check that failed when one did, and its two lines of text. */
function harnessRows(page: Page): [string, string | undefined, string[]][] {
  const view = settingsView(page);
  assert.ok(view !== undefined, 'the settings view is drawn');
  return view
    .all()
    .filter((each) => each.tagName === 'li' && each.dataset.harness !== undefined)
    .map((each) => [
      each.dataset.harness,
      each.dataset.failed,
      each
        .all()
        .filter((child) => child.has('harness-name') || child.has('harness-status'))
        .map((child) => child.textContent),
    ]);
}

test('every opening of the settings view is posted, and the view shows the check running with check again disabled until a result comes', () => {
  const page = loadPage();
  page.send(live([]));
  const count = page.posted.length;
  named(page, 'Settings').click();
  named(page, 'Settings').click();
  assert.deepStrictEqual(page.posted.slice(count), [{ type: 'settingsOpened' }], 'a click while the view is open opens nothing');
  assert.ok(texts(page).includes('Checking the harnesses…'));
  assert.strictEqual(named(page, 'Check again').disabled, true);
  named(page, 'Close settings').click();
  named(page, 'Settings').click();
  assert.deepStrictEqual(page.posted.slice(count), [{ type: 'settingsOpened' }, { type: 'settingsOpened' }], 'each opening is posted');
  page.send({ type: 'harnessCheck', check: { state: 'running' } });
  assert.ok(texts(page).includes('Checking the harnesses…'));
  assert.strictEqual(named(page, 'Check again').disabled, true);
});

test('the settings view names beside each harness the check that failed, or that every check passed', () => {
  const page = loadPage();
  page.send(live([]));
  named(page, 'Settings').click();
  page.send(CHECKED);
  assert.deepStrictEqual(harnessRows(page), [
    ['claude', undefined, ['Claude Code', 'Every check passes: Gurita 2.0.0 is installed, the packaged version.']],
    ['antigravity', 'version', ['Antigravity', 'Installed version differs from the packaged one: installed 1.9.0, packaged 2.0.0.']],
    ['codex', 'cli', ['Codex', "CLI not found: the runner's shell finds no codex command."]],
  ]);
  page.send({
    type: 'harnessCheck',
    check: {
      state: 'checked',
      harnesses: [
        { key: 'claude', name: 'Claude Code', cli: 'claude', failed: 'plugin', packaged: '2.0.0' },
        { key: 'antigravity', name: 'Antigravity', cli: 'agy', failed: 'plugin', packaged: '2.0.0', detail: 'the listing exited with status 1: boom' },
        { key: 'codex', name: 'Codex', cli: 'codex', failed: 'version', packaged: '2.0.0' },
      ],
    },
  });
  assert.deepStrictEqual(harnessRows(page), [
    ['claude', 'plugin', ['Claude Code', 'Gurita plugin not installed.']],
    ['antigravity', 'plugin', ['Antigravity', 'Gurita plugin not installed: the listing exited with status 1: boom']],
    ['codex', 'version', ['Codex', 'Installed version differs from the packaged one: installed unknown, packaged 2.0.0.']],
  ]);
});

test("the settings view's check again control asks for the check afresh, and a check that could not run shows its cause", () => {
  const page = loadPage();
  page.send({ type: 'liveFailure', cause: 'Error: no repository' });
  named(page, 'Settings').click();
  page.send({ type: 'harnessCheck', check: { state: 'failed', cause: 'python3: not found' } });
  assert.ok(texts(page).includes('The harness check could not be run.'));
  assert.ok(texts(page).includes('python3: not found'));
  const again = named(page, 'Check again');
  assert.strictEqual(again.disabled, false);
  const count = page.posted.length;
  again.click();
  assert.deepStrictEqual(page.posted.slice(count), [{ type: 'checkHarnesses' }]);
  page.send({ type: 'live', missions: [mission(ALPHA, 'Alpha')], running: [ALPHA] });
  assert.strictEqual(named(page, 'Check again').disabled, false, 'a running chain leaves check again enabled');
});

/** The mission page as drawn: every element's tag, text, class, and state, in document order. */
function pageShape(page: Page): string[] {
  return page.root.all().map((each) => `${each.tagName}|${each.textContent}|${each.className}|${each.disabled}|${each.title}`);
}

test('a failed check is shown in the settings view alone, every mission page drawn and its clicks posted as with every check passing', () => {
  const passing = loadPage();
  passing.send(live([]));
  passing.send({
    type: 'harnessCheck',
    check: {
      state: 'checked',
      harnesses: CHECKED.check.harnesses.map(({ key, name, cli }) => ({ key, name, cli, installed: '2.0.0', packaged: '2.0.0' })),
    },
  });
  const failing = loadPage();
  failing.send(live([]));
  failing.send(CHECKED);
  for (const page of [passing, failing]) {
    named(page, 'Settings').click();
    named(page, 'Close settings').click();
    named(page, 'Remaining tasks').click();
  }
  assert.deepStrictEqual(pageShape(failing), pageShape(passing), 'the mission page draws every recipe, button, and the looped run alike');
  assert.ok(!texts(failing).some((text) => text.includes('not found') || text.includes('differs')), 'no failure is named on the mission page');
  for (const page of [passing, failing]) {
    named(page, 'Open questions').click();
  }
  assert.deepStrictEqual(pageShape(failing), pageShape(passing));
  const clicks = (page: Page): unknown[] => {
    const count = page.posted.length;
    for (const text of ['review', 'complete', 'Discuss', 'Answer', 'Answer with recommendation', 'Answer with this alternative', 'New mission', 'Define mission']) {
      named(page, text).click();
    }
    return page.posted.slice(count);
  };
  assert.deepStrictEqual(clicks(failing), clicks(passing), 'every click posts as it would with every check passing');
});

/** Each harness's enabled state as the extension posts it. */
function harnessSettings(enabled: Record<string, boolean>): unknown {
  return { type: 'harnessSettings', settings: { state: 'read', enabled } };
}

/** Each harness the settings view lists: its key, the state it shows, and its control's label, or undefined without one. */
function enabledRows(page: Page): [string, string | undefined, string | undefined][] {
  const view = settingsView(page);
  assert.ok(view !== undefined, 'the settings view is drawn');
  return view
    .all()
    .filter((each) => each.tagName === 'li' && each.dataset.harness !== undefined)
    .map((each) => [
      each.dataset.harness as string,
      each.all().find((child) => child.has('harness-state'))?.textContent,
      each.all().find((child) => child.tagName === 'button')?.textContent,
    ]);
}

/** The enable or disable control of the harness `key` in the settings view. */
function harnessToggle(page: Page, key: string): FakeElement {
  const found = page.root.querySelector(`[data-focus="harness-${key}"]`);
  assert.ok(found !== null, `no control for ${key}`);
  return found;
}

test('the settings view shows each harness enabled with its disable control, whatever its check reports or while it runs', () => {
  const page = loadPage();
  page.send(live([]));
  named(page, 'Settings').click();
  page.send(harnessSettings({ claude: true, antigravity: true, codex: true }));
  assert.ok(texts(page).includes('Checking the harnesses…'));
  const all: [string, string, string][] = [
    ['claude', 'Enabled', 'Disable'],
    ['antigravity', 'Enabled', 'Disable'],
    ['codex', 'Enabled', 'Disable'],
  ];
  assert.deepStrictEqual(enabledRows(page), all, 'drawn while the check runs');
  page.send(CHECKED);
  assert.deepStrictEqual(enabledRows(page), all, 'a failed check changes no state');
  assert.deepStrictEqual(harnessRows(page)[2], ['codex', 'cli', ['Codex', "CLI not found: the runner's shell finds no codex command."]]);
  page.send({ type: 'harnessCheck', check: { state: 'failed', cause: 'python3: not found' } });
  assert.deepStrictEqual(enabledRows(page), all, 'drawn when the check could not run');
});

test("a harness's control posts the state it asks for and the view shows only the state the extension posts back", () => {
  const page = loadPage();
  page.send({ type: 'liveFailure', cause: 'Error: no repository' });
  named(page, 'Settings').click();
  page.send(harnessSettings({ claude: true, antigravity: false, codex: true }));
  assert.deepStrictEqual(enabledRows(page), [
    ['claude', 'Enabled', 'Disable'],
    ['antigravity', 'Disabled', 'Enable'],
    ['codex', 'Enabled', 'Disable'],
  ]);
  const count = page.posted.length;
  harnessToggle(page, 'codex').click();
  assert.deepStrictEqual(page.posted.slice(count), [{ type: 'setHarnessEnabled', harness: 'codex', enabled: false }]);
  assert.deepStrictEqual(enabledRows(page)[2], ['codex', 'Enabled', 'Disable'], 'nothing changes until the extension posts it');
  page.send(harnessSettings({ claude: true, antigravity: false, codex: false }));
  assert.deepStrictEqual(enabledRows(page)[2], ['codex', 'Disabled', 'Enable']);
  harnessToggle(page, 'antigravity').click();
  assert.deepStrictEqual(page.posted.slice(count + 1), [{ type: 'setHarnessEnabled', harness: 'antigravity', enabled: true }]);
  page.send({ type: 'live', missions: [mission(ALPHA, 'Alpha')], running: [ALPHA] });
  assert.strictEqual(harnessToggle(page, 'claude').disabled, false, 'a running chain leaves the controls enabled');
});

test('harness settings that could not be read are named in the settings view, with no control drawn', () => {
  const page = loadPage();
  page.send(live([]));
  named(page, 'Settings').click();
  page.send({ type: 'harnessSettings', settings: { state: 'failed', cause: 'The variant store /home/x/.gurita/variants.json is not JSON.' } });
  assert.ok(texts(page).includes('The harness settings could not be read.'));
  assert.ok(texts(page).includes('The variant store /home/x/.gurita/variants.json is not JSON.'));
  assert.deepStrictEqual(enabledRows(page), [
    ['claude', undefined, undefined],
    ['antigravity', undefined, undefined],
    ['codex', undefined, undefined],
  ]);
});

test("after a harness is disabled the page draws the list the extension posts: the variant gone from its dropdown and a recipe left with none gone", () => {
  const both = runnable(
    'Requirements iteration',
    'shipped',
    ['claude -p "/gurita:review-mission-requirements --mission <path>"'],
    [
      { name: 'Claude Code', own: false },
      { name: 'Antigravity', own: false },
    ],
  );
  const agyOnly = runnable('Gemini review', 'shipped', ['agy -p "/gurita:review-mission-requirements --mission <path>"']);
  const page = loadPage();
  page.send({ type: 'live', missions: [mission(ALPHA, 'Alpha', { step: 'derive', recipes: { state: 'read', recipes: [both, agyOnly] } })], running: [] });
  const options = () =>
    page.root
      .all()
      .filter((each) => each.tagName === 'option')
      .map((each) => each.textContent);
  assert.deepStrictEqual(recipeNames(page), ['Requirements iteration', 'Gemini review']);
  assert.deepStrictEqual(options(), ['Claude Code', 'Antigravity', 'default']);
  named(page, 'Settings').click();
  page.send(harnessSettings({ claude: true, antigravity: false, codex: true }));
  const narrowed = runnable('Requirements iteration', 'shipped', (both as { lines: string[] }).lines, [{ name: 'Claude Code', own: false }]);
  page.send({ type: 'live', missions: [mission(ALPHA, 'Alpha', { step: 'derive', recipes: { state: 'read', recipes: [narrowed] } })], running: [] });
  named(page, 'Close settings').click();
  assert.deepStrictEqual(recipeNames(page), ['Requirements iteration']);
  assert.deepStrictEqual(options(), ['Claude Code'], 'the left-out variant is gone from the dropdown, and the recipe left with none with its button');
  assert.ok(texts(page).includes('Discuss'), 'the fixed-name buttons are drawn as before');
});

/** Each harness's lists as the extension posts them. */
function harnessListsMessage(lists: Record<string, { models: string[]; efforts?: string[] }>): unknown {
  return { type: 'harnessLists', lists: { state: 'read', lists } };
}

const LISTS = {
  claude: { models: ['fable', 'opus'], efforts: ['xhigh', 'high'] },
  antigravity: { models: ['gemini-4-argon'], efforts: [] },
  codex: { models: ['gpt-5.5'] },
};

/** Each harness's lists the settings view draws: its key, then each list's kind and its entries, in order. */
function listRows(page: Page): [string, [string, string[]][]][] {
  const view = settingsView(page);
  assert.ok(view !== undefined, 'the settings view is drawn');
  return view
    .all()
    .filter((each) => each.has('harness-lists'))
    .map((each) => [
      each.dataset.harness as string,
      each
        .all()
        .filter((row) => row.has('value-list'))
        .map((row): [string, string[]] => [row.dataset.kind as string, row.all().filter((item) => item.has('value')).map((item) => item.dataset.value as string)]),
    ]);
}

/** The control in the settings view whose focus key is `key`. */
function focused(page: Page, key: string): FakeElement {
  const found = page.root.querySelector(`[data-focus="${key}"]`);
  assert.ok(found !== null, `no control ${key}`);
  return found;
}

test("the settings view draws each harness's model list and effort list, Codex its model list alone, each entry with a remove control and each list with an add control", () => {
  const page = loadPage();
  page.send(live([]));
  named(page, 'Settings').click();
  assert.ok(texts(page).includes('Models and efforts'));
  assert.deepStrictEqual(listRows(page), [], 'nothing is drawn before the extension posts the lists');
  page.send(harnessListsMessage(LISTS));
  assert.deepStrictEqual(listRows(page), [
    ['claude', [['model', ['fable', 'opus']], ['effort', ['xhigh', 'high']]]],
    ['antigravity', [['model', ['gemini-4-argon']], ['effort', []]]],
    ['codex', [['model', ['gpt-5.5']]]],
  ]);
  assert.ok(texts(page).includes('No entry'), 'an empty list says so');
  for (const key of ['add-model-claude', 'add-effort-claude', 'add-model-antigravity', 'add-effort-antigravity', 'add-model-codex', 'remove-effort-claude-high']) {
    focused(page, key);
  }
  assert.strictEqual(page.root.querySelector('[data-focus="add-effort-codex"]'), null, 'Codex has no effort list to add to');
  const view = settingsView(page);
  assert.ok(view !== undefined);
  assert.deepStrictEqual(
    view.all().filter((each) => ['input', 'textarea'].includes(each.tagName)),
    [],
    'nothing is typed on the page',
  );
});

test('an add or remove control posts its edit and the lists change only when the extension posts them again', () => {
  const page = loadPage();
  page.send({ type: 'liveFailure', cause: 'Error: no repository' });
  named(page, 'Settings').click();
  page.send(harnessListsMessage(LISTS));
  const count = page.posted.length;
  focused(page, 'add-model-codex').click();
  focused(page, 'add-effort-antigravity').click();
  focused(page, 'remove-model-claude-opus').click();
  assert.deepStrictEqual(page.posted.slice(count), [
    { type: 'addHarnessValue', harness: 'codex', kind: 'model' },
    { type: 'addHarnessValue', harness: 'antigravity', kind: 'effort' },
    { type: 'removeHarnessValue', harness: 'claude', kind: 'model', value: 'opus' },
  ]);
  assert.deepStrictEqual(listRows(page)[0], ['claude', [['model', ['fable', 'opus']], ['effort', ['xhigh', 'high']]]], 'nothing changes until the extension posts it');
  page.send(harnessListsMessage({ ...LISTS, claude: { models: ['fable', 'haiku'], efforts: ['xhigh', 'high'] } }));
  assert.deepStrictEqual(listRows(page)[0], ['claude', [['model', ['fable', 'haiku']], ['effort', ['xhigh', 'high']]]]);
  page.send({ type: 'live', missions: [mission(ALPHA, 'Alpha')], running: [ALPHA] });
  assert.strictEqual(focused(page, 'remove-model-claude-haiku').disabled, false, 'a running chain leaves the controls enabled');
});

test('lists that could not be read are named in the settings view, with no list drawn', () => {
  const page = loadPage();
  page.send(live([]));
  named(page, 'Settings').click();
  page.send({ type: 'harnessLists', lists: { state: 'failed', cause: 'The variant store /home/x/.gurita/variants.json is not JSON.' } });
  assert.ok(texts(page).includes('The model and effort lists could not be read.'));
  assert.ok(texts(page).includes('The variant store /home/x/.gurita/variants.json is not JSON.'));
  assert.deepStrictEqual(listRows(page), []);
});

const CLAUDE_LINE = 'claude -p "/gurita:review-mission-requirements --mission <path>" --model "fable" --effort xhigh;';
const AGY_LINE = 'agy -p "/gurita:review-mission-requirements --mission <path>" --model "gemini-4-argon" --effort medium;';

/** A variant list as the extension posts it: a chain with a stored copy, a duplicate, and a deleted variant, a button recipe, and an own recipe. */
const VARIANTS = {
  type: 'variants',
  variants: {
    state: 'read',
    recipes: [
      {
        name: 'First run',
        group: 'shipped',
        fixed: false,
        variants: [
          {
            name: 'Gemini',
            origin: 'stored',
            copies: { name: 'Antigravity', origin: 'shipped' },
            lines: [AGY_LINE],
            isDefault: true,
            from: { name: 'Antigravity', origin: 'shipped' },
          },
          { name: 'default', origin: 'own', lines: [CLAUDE_LINE], isDefault: false },
          { name: 'Fast', origin: 'stored', lines: [CLAUDE_LINE, CLAUDE_LINE], isDefault: false },
          { name: 'custom 1', origin: 'stored', lines: [CLAUDE_LINE], isDefault: false, from: { name: 'default', origin: 'own' } },
        ],
        hidden: [{ name: 'Claude Code', origin: 'shipped' }],
      },
      {
        name: 'discuss-mission-goal',
        group: 'shipped',
        fixed: true,
        variants: [{ name: 'default', origin: 'shipped', lines: ['claude "/gurita:discuss-mission-goal <goal>"; # interactive'], isDefault: true }],
        hidden: [],
      },
      { name: 'Mine everywhere', group: 'own', fixed: false, variants: [{ name: 'default', origin: 'own', lines: ['echo <path>'], isDefault: true }], hidden: [] },
    ],
  },
};

/** Each recipe the settings view's Variants part draws: its name, then each variant's texts and its controls' labels. */
function variantEditRows(page: Page): [string, [string[], string[]][]][] {
  const view = settingsView(page);
  assert.ok(view !== undefined, 'the settings view is drawn');
  return view
    .all()
    .filter((each) => each.has('variant-recipe'))
    .map((each) => [
      each.dataset.recipe as string,
      each
        .all()
        .filter((item) => item.has('variant'))
        .map((item): [string[], string[]] => [
          item.all().filter((part) => ['variant-name', 'variant-origin', 'variant-default', 'variant-deleted'].some((name) => part.has(name))).map((part) => part.textContent),
          item.all().filter((part) => part.tagName === 'button').map((part) => part.textContent),
        ]),
    ]);
}

test('the settings view lists every recipe the extension posts with its variants, each with its edit controls, and a deleted one with its reset alone', () => {
  const page = loadPage();
  page.send(live([]));
  named(page, 'Settings').click();
  assert.ok(texts(page).includes('Variants'));
  assert.deepStrictEqual(variantEditRows(page), [], 'nothing is drawn before the extension posts the variants');
  page.send(VARIANTS);
  const edits = ['Duplicate', 'Rename', 'Delete'];
  assert.deepStrictEqual(variantEditRows(page), [
    [
      'First run',
      [
        [['Gemini', 'stored copy of the shipped variant Antigravity', 'Default'], [...edits, 'Reset']],
        [['default', 'yours'], [...edits, 'Make default']],
        [['Fast', 'stored'], [...edits, 'Make default']],
        [['custom 1', 'stored'], [...edits, 'Make default', 'Reset']],
        [['Claude Code', 'shipped', 'Deleted'], ['Reset']],
      ],
    ],
    ['discuss-mission-goal', [[['default', 'shipped', 'Default'], edits]]],
    ['Mine everywhere', [[['default', 'yours', 'Default'], edits]]],
  ]);
  assert.ok(
    texts(page).includes('Run by a button outside the recipe list, which runs this default until another variant is selected beside it.'),
    'a fixed-name button recipe says its default is what its button runs while no other variant is selected',
  );
  const fast = page.root.all().find((each) => each.has('variant-name') && each.textContent === 'Fast');
  assert.strictEqual(fast?.title, `${CLAUDE_LINE}\n${CLAUDE_LINE}`, "a variant's name carries its lines in its hover text");
  const view = settingsView(page);
  assert.ok(view !== undefined);
  assert.deepStrictEqual(
    view.all().filter((each) => ['input', 'textarea'].includes(each.tagName)),
    [],
    'nothing is typed on the page',
  );
});

test('each variant control posts its edit, naming the variant as listed, and the list changes only when the extension posts it again', () => {
  const page = loadPage();
  page.send({ type: 'liveFailure', cause: 'Error: no repository' });
  named(page, 'Settings').click();
  page.send(VARIANTS);
  const count = page.posted.length;
  for (const key of ['duplicate-0-0', 'rename-0-0', 'delete-0-0', 'reset-0-0', 'default-0-1', 'rename-0-2', 'reset-0-2', 'reset-0-3', 'reset-0-hidden-0', 'default-2-0']) {
    const found = page.root.querySelector(`[data-focus="variant-${key}"]`);
    if (key === 'default-2-0') {
      assert.strictEqual(found, null, 'the default carries no Make default control');
      continue;
    }
    if (key === 'reset-0-2') {
      assert.strictEqual(found, null, 'a stored variant posted with no variant it was made from carries no Reset control');
      continue;
    }
    assert.ok(found !== null, `no control ${key}`);
    found.click();
  }
  const copy = { name: 'Gemini', origin: 'stored', copies: { name: 'Antigravity', origin: 'shipped' } };
  assert.deepStrictEqual(page.posted.slice(count), [
    { type: 'duplicateVariant', recipe: 'First run', variant: copy },
    { type: 'renameVariant', recipe: 'First run', variant: copy },
    { type: 'deleteVariant', recipe: 'First run', variant: copy },
    { type: 'resetVariantLines', recipe: 'First run', variant: copy },
    { type: 'pickDefault', recipe: 'First run', variant: { name: 'default', origin: 'own' } },
    { type: 'renameVariant', recipe: 'First run', variant: { name: 'Fast', origin: 'stored' } },
    { type: 'resetVariantLines', recipe: 'First run', variant: { name: 'custom 1', origin: 'stored' } },
    { type: 'resetVariant', recipe: 'First run', original: { name: 'Claude Code', origin: 'shipped' } },
  ]);
  assert.strictEqual(variantEditRows(page)[0][1].length, 5, 'nothing changes until the extension posts it');
  page.send({
    type: 'variants',
    variants: { state: 'read', recipes: [{ ...VARIANTS.variants.recipes[0], variants: VARIANTS.variants.recipes[0].variants.slice(1), hidden: [] }] },
  });
  assert.deepStrictEqual(variantEditRows(page).map(([name, rows]) => [name, rows.map((row) => row[0][0])]), [['First run', ['default', 'Fast', 'custom 1']]]);
  page.send({ type: 'live', missions: [mission(ALPHA, 'Alpha')], running: [ALPHA] });
  assert.strictEqual(page.root.querySelector('[data-focus="variant-delete-0-0"]')?.disabled, false, 'a running chain leaves the controls enabled');
});

test('variants that could not be read are named in the settings view, with no control drawn', () => {
  const page = loadPage();
  page.send(live([]));
  named(page, 'Settings').click();
  page.send({ type: 'variants', variants: { state: 'failed', cause: 'The variant store /home/x/.gurita/variants.json is not JSON.' } });
  assert.ok(texts(page).includes('The variants could not be read.'));
  assert.ok(texts(page).includes('The variant store /home/x/.gurita/variants.json is not JSON.'));
  assert.deepStrictEqual(variantEditRows(page), []);
});

test("an edit the extension posts reaches the mission page's dropdown", () => {
  const page = loadPage();
  page.send(live([]));
  const dropdown = () =>
    page.root
      .all()
      .find((each) => each.tagName === 'select' && each.has('recipe-variant'))
      ?.children.filter((child): child is FakeElement => child instanceof FakeElement)
      .map((option) => option.textContent);
  assert.deepStrictEqual(dropdown(), ['review']);
  const duplicated = {
    ...RECIPES,
    recipes: [{ ...RECIPES.recipes[0], variants: [{ name: 'review', own: false }, { name: 'Fast', own: true }] }, RECIPES.recipes[1]],
  };
  page.send({ type: 'live', missions: [{ ...(mission(ALPHA, 'Alpha') as object), recipes: duplicated }, mission(BETA, 'Beta')], running: [] });
  assert.deepStrictEqual(dropdown(), ['review', 'Fast']);
});

const MODEL_ONLY_LINE = 'claude -p "/gurita:provide-alternatives-to-all-open-questions --mission <path>" --model "opus";';
const CODEX_LINE = 'codex exec "/gurita:finish-mission --mission <path>" -m gpt-5.5;';

/** A variant list whose variants carry their line editors, as the extension posts them. */
const EDITED_VARIANTS = {
  type: 'variants',
  variants: {
    state: 'read',
    recipes: [
      {
        name: 'First run',
        group: 'shipped',
        fixed: false,
        variants: [
          {
            name: 'Claude Code',
            origin: 'shipped',
            lines: [CLAUDE_LINE, MODEL_ONLY_LINE, 'echo <path>', '<single-task line>'],
            editors: [{ harness: 'claude', model: 'fable', effort: 'xhigh' }, null, null, null],
            rows: [
              { skill: 'review-mission-requirements', interactive: false, harness: 'claude' },
              { skill: 'provide-alternatives-to-all-open-questions', interactive: false, harness: 'claude' },
              null,
              null,
            ],
            isDefault: true,
          },
          {
            name: 'Antigravity',
            origin: 'shipped',
            lines: [AGY_LINE],
            editors: [{ harness: 'antigravity', model: 'gemini-4-argon', effort: 'medium' }],
            rows: [{ skill: 'review-mission-requirements', interactive: false, harness: 'antigravity' }],
            isDefault: false,
          },
          {
            name: 'Codex',
            origin: 'own',
            lines: [CODEX_LINE],
            editors: [{ harness: 'codex', model: 'gpt-5.5' }],
            rows: [{ skill: 'finish-mission', interactive: false, harness: 'codex' }],
            isDefault: false,
          },
        ],
        hidden: [],
      },
    ],
  },
};

/** The parts a line row draws as text: the line's text, or its skill's name, its interactive mark, and its harness where it is no dropdown. */
const ROW_PARTS = ['line-text', 'line-skill', 'line-interactive', 'line-harness'];

/** Whether `part` is one of the texts a line row draws, a dropdown never being one. */
function rowText(part: FakeElement): boolean {
  return part.tagName !== 'select' && ROW_PARTS.some((name) => part.has(name));
}

/** Each line the settings view's line editor draws: its texts, then each dropdown's class, its options, and the one it stands on. */
function lineRows(page: Page): [string[], [string, string[], string | undefined][]][] {
  const view = settingsView(page);
  assert.ok(view !== undefined, 'the settings view is drawn');
  return view
    .all()
    .filter((each) => each.has('variant-line'))
    .map((each) => [
      each.all().filter(rowText).map((part) => part.textContent),
      each
        .all()
        .filter((part) => part.tagName === 'select')
        .map((select): [string, string[], string | undefined] => {
          const choices = select.children.filter((child): child is FakeElement => child instanceof FakeElement);
          return [select.className, choices.map((option) => option.textContent), choices.find((option) => option.selected)?.textContent];
        }),
    ]);
}

/** The harness dropdown of a line posted with model and effort dropdowns, standing on Claude Code or on Antigravity. */
const CC_HARNESS: [string, string[], string] = ['line-harness', ['Claude Code', 'Antigravity'], 'Claude Code'];
const AGY_HARNESS: [string, string[], string] = ['line-harness', ['Claude Code', 'Antigravity'], 'Antigravity'];

test("the line editor draws each line as its row, and only a line with both --model and --effort gets the harness's model and whole effort lists, a Codex line its model alone", () => {
  const page = loadPage();
  page.send(live([]));
  named(page, 'Settings').click();
  page.send(harnessListsMessage(LISTS));
  page.send(EDITED_VARIANTS);
  assert.deepStrictEqual(lineRows(page), [
    [['review-mission-requirements'], [CC_HARNESS, ['line-model', ['fable', 'opus'], 'fable'], ['line-effort', ['xhigh', 'high'], 'xhigh']]],
    [['provide-alternatives-to-all-open-questions', 'Claude Code'], []],
    [['echo <path>'], []],
    [['<single-task line>'], []],
    [['review-mission-requirements'], [AGY_HARNESS, ['line-model', ['gemini-4-argon'], 'gemini-4-argon'], ['line-effort', ['medium'], 'medium']]],
    [['finish-mission', 'Codex'], [['line-model', ['gpt-5.5'], 'gpt-5.5']]],
  ], 'a line without both flags, a shell step, and the slot line draw no control; a value the list lacks is offered as the line carries it; a Codex line keeps its harness as text');
  page.send(harnessListsMessage({ ...LISTS, antigravity: { models: ['gemini-4-argon', 'claude-opus-5-5'], efforts: ['low', 'medium', 'high'] } }));
  assert.deepStrictEqual(lineRows(page)[4][1], [
    AGY_HARNESS,
    ['line-model', ['gemini-4-argon', 'claude-opus-5-5'], 'gemini-4-argon'],
    ['line-effort', ['low', 'medium', 'high'], 'medium'],
  ], 'the dropdowns follow the lists the extension posts');
  const view = settingsView(page);
  assert.ok(view !== undefined);
  assert.deepStrictEqual(view.all().filter((each) => ['input', 'textarea'].includes(each.tagName)), [], 'nothing is typed on the page');
  assert.deepStrictEqual(variantEditRows(page)[0][1].map((row) => row[1]), [
    ['Duplicate', 'Rename', 'Delete'],
    ['Duplicate', 'Rename', 'Delete', 'Make default'],
    ['Duplicate', 'Rename', 'Delete', 'Make default'],
  ], "the line editor adds no button to a variant's controls");
});

test("a pick in a line's dropdown posts the line, the kind, and the value, and the line changes only when the extension posts it again", () => {
  const page = loadPage();
  page.send({ type: 'liveFailure', cause: 'Error: no repository' });
  named(page, 'Settings').click();
  page.send(harnessListsMessage(LISTS));
  page.send(EDITED_VARIANTS);
  const count = page.posted.length;
  focused(page, 'line-model-0-0-0').change('opus');
  focused(page, 'line-effort-0-0-0').change('high');
  focused(page, 'line-model-0-2-0').change('gpt-5.5');
  focused(page, 'line-model-0-2-0').change('gpt-5.5');
  assert.strictEqual(page.root.querySelector('[data-focus="line-effort-0-2-0"]'), null, 'a Codex line has no effort dropdown');
  assert.strictEqual(page.root.querySelector('[data-focus="line-model-0-0-1"]'), null, 'a line with --model alone has no model dropdown');
  assert.deepStrictEqual(page.posted.slice(count), [
    { type: 'replaceLineValue', recipe: 'First run', variant: { name: 'Claude Code', origin: 'shipped' }, line: 0, kind: 'model', value: 'opus' },
    { type: 'replaceLineValue', recipe: 'First run', variant: { name: 'Claude Code', origin: 'shipped' }, line: 0, kind: 'effort', value: 'high' },
  ], 'a pick of the value the line carries posts nothing');
  assert.strictEqual(lineRows(page)[0][1][1][2], 'fable', 'nothing changes until the extension posts it');
  const copied = { ...EDITED_VARIANTS.variants.recipes[0].variants[0], name: 'Claude Code', origin: 'stored', copies: { name: 'Claude Code', origin: 'shipped' } };
  const opusLine = CLAUDE_LINE.replace('"fable"', '"opus"');
  page.send({
    type: 'variants',
    variants: {
      state: 'read',
      recipes: [
        {
          ...EDITED_VARIANTS.variants.recipes[0],
          variants: [{ ...copied, lines: [opusLine, ...copied.lines.slice(1)], editors: [{ harness: 'claude', model: 'opus', effort: 'xhigh' }, null, null, null] }, ...EDITED_VARIANTS.variants.recipes[0].variants.slice(1)],
        },
      ],
    },
  });
  assert.deepStrictEqual(lineRows(page)[0], [['review-mission-requirements'], [CC_HARNESS, ['line-model', ['fable', 'opus'], 'opus'], ['line-effort', ['xhigh', 'high'], 'xhigh']]]);
  assert.strictEqual(lineHovers(page)[0], opusLine, 'the hover text shows the changed line as written');
  focused(page, 'line-effort-0-0-0').change('high');
  assert.deepStrictEqual(page.posted[page.posted.length - 1], {
    type: 'replaceLineValue',
    recipe: 'First run',
    variant: { name: 'Claude Code', origin: 'stored', copies: { name: 'Claude Code', origin: 'shipped' } },
    line: 0,
    kind: 'effort',
    value: 'high',
  }, 'a stored copy is named as listed');
});

test("a pick in a line's harness dropdown posts the line and the harness, a Codex line and a line without both flags getting none, and the row is redrawn only from what the extension posts", () => {
  const page = loadPage();
  page.send(live([]));
  named(page, 'Settings').click();
  page.send(harnessListsMessage(LISTS));
  const summarize = 'claude -p "Summarize <path>" --model "opus" --effort high;';
  page.send({
    type: 'variants',
    variants: {
      state: 'read',
      recipes: [
        {
          ...EDITED_VARIANTS.variants.recipes[0],
          variants: [
            ...EDITED_VARIANTS.variants.recipes[0].variants,
            {
              name: 'Plain',
              origin: 'own',
              lines: [summarize],
              editors: [{ harness: 'claude', model: 'opus', effort: 'high' }],
              rows: [null],
              isDefault: false,
            },
          ],
        },
      ],
    },
  });
  assert.deepStrictEqual(lineRows(page)[6], [[summarize], [CC_HARNESS, ['line-model', ['fable', 'opus'], 'opus'], ['line-effort', ['xhigh', 'high'], 'high']]], 'a line drawn as its text gets its harness dropdown before the model dropdown');
  assert.strictEqual(page.root.querySelector('[data-focus="line-harness-0-0-1"]'), null, 'a line with --model alone has no harness dropdown');
  assert.strictEqual(page.root.querySelector('[data-focus="line-harness-0-2-0"]'), null, 'a Codex line has no harness dropdown');
  const count = page.posted.length;
  focused(page, 'line-harness-0-0-0').change('antigravity');
  focused(page, 'line-harness-0-1-0').change('antigravity');
  focused(page, 'line-harness-0-1-0').change('claude');
  focused(page, 'line-harness-0-1-0').change('codex');
  assert.deepStrictEqual(page.posted.slice(count), [
    { type: 'replaceLineHarness', recipe: 'First run', variant: { name: 'Claude Code', origin: 'shipped' }, line: 0, harness: 'antigravity' },
    { type: 'replaceLineHarness', recipe: 'First run', variant: { name: 'Antigravity', origin: 'shipped' }, line: 0, harness: 'claude' },
  ], 'a pick of the harness the line runs on, or of one not offered, posts nothing');
  assert.deepStrictEqual(lineRows(page)[0][1][0], CC_HARNESS, 'nothing changes until the extension posts it');
  const rewritten = 'agy -p "/gurita:review-mission-requirements --mission <path>" --model "gemini-4-argon" --effort xhigh;';
  const first = EDITED_VARIANTS.variants.recipes[0].variants[0];
  page.send({
    type: 'variants',
    variants: {
      state: 'read',
      recipes: [
        {
          ...EDITED_VARIANTS.variants.recipes[0],
          variants: [
            {
              ...first,
              origin: 'stored',
              copies: { name: 'Claude Code', origin: 'shipped' },
              lines: [rewritten, ...first.lines.slice(1)],
              editors: [{ harness: 'antigravity', model: 'gemini-4-argon', effort: 'xhigh' }, null, null, null],
              rows: [{ skill: 'review-mission-requirements', interactive: false, harness: 'antigravity' }, ...first.rows.slice(1)],
            },
            ...EDITED_VARIANTS.variants.recipes[0].variants.slice(1),
          ],
        },
      ],
    },
  });
  assert.deepStrictEqual(lineRows(page)[0], [['review-mission-requirements'], [AGY_HARNESS, ['line-model', ['gemini-4-argon'], 'gemini-4-argon'], ['line-effort', ['xhigh'], 'xhigh']]], "the row stands on the posted harness and offers that harness's lists");
  assert.strictEqual(lineHovers(page)[0], rewritten, 'the hover text shows the rewritten line as written');
  focused(page, 'line-harness-0-0-0').change('claude');
  assert.deepStrictEqual(page.posted[page.posted.length - 1], {
    type: 'replaceLineHarness',
    recipe: 'First run',
    variant: { name: 'Claude Code', origin: 'stored', copies: { name: 'Claude Code', origin: 'shipped' } },
    line: 0,
    harness: 'claude',
  }, 'a stored copy is named as listed');
});

/** The hover text of each skill row the settings view draws, the line as written, or null for a line drawn as its text. */
function lineHovers(page: Page): (string | null)[] {
  const view = settingsView(page);
  assert.ok(view !== undefined, 'the settings view is drawn');
  return view
    .all()
    .filter((each) => each.has('variant-line'))
    .map((each) => each.all().find((part) => part.has('line-label'))?.title ?? null);
}

const INTERACTIVE_LINE = 'claude "/gurita:recommend-all-open-questions --mission <path>" --model "fable" --effort xhigh; # interactive';
const AGY_INTERACTIVE_LINE = 'agy -i "/gurita:complete-all-tasks --mission <path>" --model "claude-opus-5-5" --effort high; # interactive';

test("a line running a gurita: skill is drawn as the skill's bare name, an interactive mark where it is not headless, the line in its hover text, and its harness and dropdowns on the right", () => {
  const page = loadPage();
  page.send(live([]));
  named(page, 'Settings').click();
  page.send(harnessListsMessage({ ...LISTS, antigravity: { models: ['claude-opus-5-5'], efforts: ['high'] } }));
  page.send({
    type: 'variants',
    variants: {
      state: 'read',
      recipes: [
        {
          name: 'Mixed',
          group: 'shipped',
          fixed: false,
          variants: [
            {
              name: 'One',
              origin: 'shipped',
              lines: [CLAUDE_LINE, INTERACTIVE_LINE, AGY_INTERACTIVE_LINE, 'echo <path>', 'gemini -p "/gurita:finish-mission" --model "pro";'],
              editors: [
                { harness: 'claude', model: 'fable', effort: 'xhigh' },
                { harness: 'claude', model: 'fable', effort: 'xhigh' },
                { harness: 'antigravity', model: 'claude-opus-5-5', effort: 'high' },
                null,
                null,
              ],
              rows: [
                { skill: 'review-mission-requirements', interactive: false, harness: 'claude' },
                { skill: 'recommend-all-open-questions', interactive: true, harness: 'claude' },
                { skill: 'complete-all-tasks', interactive: true, harness: 'antigravity' },
                null,
                null,
              ],
              isDefault: true,
            },
          ],
          hidden: [],
        },
      ],
    },
  });
  const both = (harness: [string, string[], string], model: string, models: string[], effort: string, efforts: string[]): [string, string[], string][] => [
    harness,
    ['line-model', models, model],
    ['line-effort', efforts, effort],
  ];
  assert.deepStrictEqual(lineRows(page), [
    [['review-mission-requirements'], both(CC_HARNESS, 'fable', ['fable', 'opus'], 'xhigh', ['xhigh', 'high'])],
    [['recommend-all-open-questions', 'interactive'], both(CC_HARNESS, 'fable', ['fable', 'opus'], 'xhigh', ['xhigh', 'high'])],
    [['complete-all-tasks', 'interactive'], both(AGY_HARNESS, 'claude-opus-5-5', ['claude-opus-5-5'], 'high', ['high'])],
    [['echo <path>'], []],
    [['gemini -p "/gurita:finish-mission" --model "pro";'], []],
  ], 'a shell step and a command the extension does not know keep their text and draw no control');
  assert.deepStrictEqual(lineHovers(page), [CLAUDE_LINE, INTERACTIVE_LINE, AGY_INTERACTIVE_LINE, null, null], 'each skill row carries its line as written in its hover text');
  const view = settingsView(page);
  assert.ok(view !== undefined);
  const rows = view.all().filter((each) => each.has('variant-line'));
  assert.ok(rows.slice(0, 3).every((row) => row.has('skill-line')) && rows.slice(3).every((row) => !row.has('skill-line')));
  const order = (row: FakeElement) =>
    row.children
      .filter((child): child is FakeElement => child instanceof FakeElement)
      .map((child) => (child.tagName === 'select' ? child.className : child.className.split(' ')[0]));
  assert.deepStrictEqual(order(rows[1]), ['line-label', 'line-harness', 'line-model', 'line-effort'], 'the harness and the dropdowns follow the skill on the right');
  assert.deepStrictEqual(order(rows[3]), ['line-text'], 'a line drawn as its text keeps it alone');
  assert.strictEqual(texts(page).some((text) => text.includes('claude -p')), false, 'no skill row shows its whole command line');
});

const TASK_LINE = 'claude -p "/gurita:complete-task --mission <path> <Task Title>" --model "opus" --effort high;';
const AGY_TASK_LINE = 'agy -p "/gurita:complete-task --mission <path> <Task Title>" --model "claude-opus-5-5" --effort high;';
const CODEX_TASK_LINE = "codex exec '$gurita:complete-task --mission <path> <Task Title>';";
const TASK_ROW = { skill: 'complete-task', interactive: false, harness: 'claude' };

/** One variant of a line as the extension posts it, holding the one line `line` with its editor and row. */
function lineVariant(
  name: string,
  origin: string,
  line: string,
  editor: { harness: string; model: string; effort?: string } | null,
  row: { skill: string; interactive: boolean; harness: string } | null,
  isDefault: boolean,
  more: Record<string, unknown> = {},
): Record<string, unknown> {
  return { name, origin, lines: [line], editors: [editor], rows: [row], isDefault, ...more };
}

const CUSTOM_TASK_LINE = TASK_LINE.replace('"opus"', '"fable"');
const RENAMED_COPY = { name: 'default', origin: 'shipped', recipe: 'Single task (Antigravity)' };

/**
 * A line list as the extension posts it: a shipped line with its default and a custom 1 picked as
 * the default, a renamed one, an own one, a duplicate, and a line whose one variant was deleted.
 */
const LINES = {
  type: 'singleTaskLines',
  lines: {
    state: 'read',
    lines: [
      {
        name: 'Single task (Claude Code)',
        group: 'shipped',
        variants: [
          lineVariant('default', 'shipped', TASK_LINE, { harness: 'claude', model: 'opus', effort: 'high' }, TASK_ROW, false),
          lineVariant('custom 1', 'stored', CUSTOM_TASK_LINE, { harness: 'claude', model: 'fable', effort: 'high' }, TASK_ROW, true, {
            from: { name: 'default', origin: 'shipped' },
          }),
        ],
        hidden: [],
      },
      {
        name: 'Agy line',
        group: 'shipped',
        variants: [
          lineVariant('Agy line', 'stored', AGY_TASK_LINE, { harness: 'antigravity', model: 'claude-opus-5-5', effort: 'high' }, { skill: 'complete-task', interactive: false, harness: 'antigravity' }, true, {
            copies: RENAMED_COPY,
            from: RENAMED_COPY,
          }),
        ],
        hidden: [],
        reset: { recipe: 'Single task (Antigravity)', original: { name: 'default', origin: 'shipped' } },
      },
      {
        name: 'My own line',
        group: 'own',
        variants: [lineVariant('default', 'own', CODEX_TASK_LINE, null, { skill: 'complete-task', interactive: false, harness: 'codex' }, true)],
        hidden: [],
      },
      {
        name: 'Single task (Sonnet)',
        group: 'own',
        variants: [lineVariant('Single task (Sonnet)', 'stored', TASK_LINE, { harness: 'claude', model: 'opus', effort: 'high' }, TASK_ROW, true)],
        hidden: [],
      },
      { name: 'Single task (Old)', group: 'shipped', variants: [], hidden: [{ name: 'default', origin: 'shipped' }] },
    ],
  },
};

/** The settings view's Single-task lines part. */
function linesPart(page: Page): FakeElement {
  const view = settingsView(page);
  assert.ok(view !== undefined, 'the settings view is drawn');
  const part = view.all().find((each) => each.has('line-edits'));
  assert.ok(part !== undefined, 'the view holds a single-task lines part');
  return part;
}

/** Each line the settings view's Single-task lines part draws: its name, its own controls' labels, and its variants as `singleLineRows` reads them. */
function singleLines(page: Page): [string, string[], [string[], string[], string[]][]][] {
  return linesPart(page)
    .all()
    .filter((block) => block.has('single-task-line'))
    .map((block): [string, string[], [string[], string[], string[]][]] => {
      const heading = block.all().find((each) => each.has('line-heading'));
      assert.ok(heading !== undefined);
      return [
        heading.all().find((each) => each.has('line-name'))?.textContent ?? '',
        heading.all().filter((each) => each.tagName === 'button').map((each) => each.textContent),
        block
          .all()
          .filter((item) => item.has('variant'))
          .map((item): [string[], string[], string[]] => [
            item.all().filter((each) => each.tagName !== 'select' && ['variant-name', 'variant-origin', 'variant-default', 'variant-deleted', ...ROW_PARTS].some((name) => each.has(name))).map((each) => each.textContent),
            item.all().filter((each) => each.tagName === 'button').map((each) => each.textContent),
            item.all().filter((each) => each.tagName === 'select').map((each) => each.className),
          ]),
      ];
    });
}

/** Each variant row the settings view's Single-task lines part draws, across every line. */
function singleLineRows(page: Page): [string[], string[], string[]][] {
  return singleLines(page).flatMap((line) => line[2]);
}

test("the settings view lists every named single-task line under its name, its default and customs beneath it with a recipe variant's controls, a deleted one with its reset alone", () => {
  const page = loadPage();
  page.send(live([]));
  named(page, 'Settings').click();
  assert.ok(texts(page).includes('Single-task lines'));
  assert.deepStrictEqual(singleLines(page), [], 'nothing is drawn before the extension posts the lines');
  page.send(harnessListsMessage(LISTS));
  page.send(LINES);
  const lineEdits = ['Duplicate', 'Rename', 'Delete'];
  const variantEdits = ['Duplicate', 'Rename', 'Delete'];
  const both = ['line-harness', 'line-model', 'line-effort'];
  assert.deepStrictEqual(singleLines(page), [
    ['Single task (Claude Code)', lineEdits, [
      [['default', 'shipped', 'complete-task'], [...variantEdits, 'Make default'], both],
      [['custom 1', 'stored', 'Default', 'complete-task'], [...variantEdits, 'Reset'], both],
    ]],
    ['Agy line', [...lineEdits, 'Reset'], [
      [['Agy line', 'stored copy of the shipped variant default', 'Default', 'complete-task'], [...variantEdits, 'Reset'], both],
    ]],
    ['My own line', lineEdits, [[['default', 'yours', 'Default', 'complete-task', 'Codex'], variantEdits, []]]],
    ['Single task (Sonnet)', lineEdits, [[['Single task (Sonnet)', 'stored', 'Default', 'complete-task'], variantEdits, both]]],
    ['Single task (Old)', [], [[['default', 'shipped', 'Deleted'], ['Reset'], []]]],
  ], "each line's heading keeps its own Duplicate, Rename, and Delete, and every variant beneath it gets a recipe variant's controls and line editor");
  const view = settingsView(page);
  assert.ok(view !== undefined);
  assert.deepStrictEqual(view.all().filter((each) => ['input', 'textarea'].includes(each.tagName)), [], 'nothing is typed on the page');
});

test("each line and line-variant control posts its edit, the line's own controls naming its default, and the list changes only when the extension posts it again", () => {
  const page = loadPage();
  page.send({ type: 'liveFailure', cause: 'Error: no repository' });
  named(page, 'Settings').click();
  page.send(harnessListsMessage({ ...LISTS, antigravity: { models: ['claude-opus-5-5'], efforts: ['medium', 'high'] } }));
  page.send(LINES);
  const count = page.posted.length;
  for (const key of [
    'line-duplicate-0',
    'line-rename-1',
    'line-delete-1',
    'line-reset-1',
    'line-delete-3',
    'line-reset-4-hidden-0',
    'line-variant-default-0-0',
    'line-variant-rename-0-1',
    'line-variant-reset-0-1',
    'line-variant-duplicate-2-0',
    'line-variant-delete-0-1',
  ]) {
    const found = page.root.querySelector(`[data-focus="${key}"]`);
    assert.ok(found !== null, `no control ${key}`);
    found.click();
  }
  focused(page, 'line-model-single-0-0-0').change('fable');
  focused(page, 'line-effort-single-1-0-0').change('medium');
  focused(page, 'line-harness-single-1-0-0').change('claude');
  focused(page, 'line-model-single-0-1-0').change('opus');
  assert.strictEqual(page.root.querySelector('[data-focus="line-harness-single-2-0-0"]'), null, 'a Codex line has no harness dropdown');
  assert.strictEqual(page.root.querySelector('[data-focus="line-variant-default-0-1"]'), null, 'the default carries no Make default control');
  const custom = { name: 'custom 1', origin: 'stored' };
  const renamed = { name: 'Agy line', origin: 'stored', copies: RENAMED_COPY };
  assert.deepStrictEqual(page.posted.slice(count), [
    { type: 'duplicateLine', line: 'Single task (Claude Code)', variant: custom },
    { type: 'renameLine', line: 'Agy line', variant: renamed },
    { type: 'deleteLine', line: 'Agy line', variant: renamed },
    { type: 'resetLine', line: 'Single task (Antigravity)', original: { name: 'default', origin: 'shipped' } },
    { type: 'deleteLine', line: 'Single task (Sonnet)', variant: { name: 'Single task (Sonnet)', origin: 'stored' } },
    { type: 'resetLine', line: 'Single task (Old)', original: { name: 'default', origin: 'shipped' } },
    { type: 'pickDefault', recipe: 'Single task (Claude Code)', variant: { name: 'default', origin: 'shipped' } },
    { type: 'renameVariant', recipe: 'Single task (Claude Code)', variant: custom },
    { type: 'resetVariantLines', recipe: 'Single task (Claude Code)', variant: custom },
    { type: 'duplicateVariant', recipe: 'My own line', variant: { name: 'default', origin: 'own' } },
    { type: 'deleteVariant', recipe: 'Single task (Claude Code)', variant: custom },
    { type: 'replaceLineValue', recipe: 'Single task (Claude Code)', variant: { name: 'default', origin: 'shipped' }, line: 0, kind: 'model', value: 'fable' },
    { type: 'replaceLineValue', recipe: 'Agy line', variant: renamed, line: 0, kind: 'effort', value: 'medium' },
    { type: 'replaceLineHarness', recipe: 'Agy line', variant: renamed, line: 0, harness: 'claude' },
    { type: 'replaceLineValue', recipe: 'Single task (Claude Code)', variant: custom, line: 0, kind: 'model', value: 'opus' },
  ]);
  assert.strictEqual(singleLineRows(page).length, 6, 'nothing changes until the extension posts it');
  page.send({ ...LINES, lines: { ...LINES.lines, lines: LINES.lines.lines.slice(0, 1) } });
  assert.deepStrictEqual(singleLines(page).map((line) => line[0]), ['Single task (Claude Code)']);
});

test('single-task lines that could not be read are named in the settings view, with no control drawn', () => {
  const page = loadPage();
  page.send(live([]));
  named(page, 'Settings').click();
  page.send({ type: 'singleTaskLines', lines: { state: 'failed', cause: 'The variant store /home/x/.gurita/variants.json is not JSON.' } });
  assert.ok(texts(page).includes('The single-task lines could not be read.'));
  assert.ok(texts(page).includes('The variant store /home/x/.gurita/variants.json is not JSON.'));
  assert.deepStrictEqual(singleLines(page), []);
});

/** The pane's stylesheet as the page shell in `src/pane.ts` sets it, as its rules: each selector list split at its commas, with its declarations by property. */
function stylesheetRules(): { selectors: string[]; declarations: Map<string, string> }[] {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'pane.ts'), 'utf8');
  const sheet = /<style nonce="\$\{token\}">([\s\S]*?)<\/style>/.exec(source);
  assert.ok(sheet !== null, 'the page shell holds the stylesheet');
  return [...sheet[1].matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((rule) => ({
    selectors: rule[1].split(',').map((selector) => selector.trim()),
    declarations: new Map(
      rule[2]
        .split(';')
        .map((declaration) => declaration.trim())
        .filter((declaration) => declaration !== '')
        .map((declaration): [string, string] => {
          const colon = declaration.indexOf(':');
          return [declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()];
        }),
    ),
  }));
}

/** The push button classes, every one drawn with the one shared look. */
const PUSH_CLASSES = ['recipe', 'action', 'control'];

/** The properties that make a button's look: its fill, text colour, border, and outline. */
const LOOK = ['background', 'background-color', 'color', 'border', 'border-color', 'outline'];

test('every push button the pane draws carries one class of the one shared look, the mission tabs, pane headers, and dependency links keeping their own', () => {
  const page = loadPage();
  const linked = {
    ...(mission(ALPHA, 'Alpha') as Record<string, unknown>),
    questions: {
      state: 'read',
      questions: ['Pane Layout', 'Tab Order'].map((id, index) => ({
        id,
        question: `What should ${id} be?`,
        principles: [],
        dependsOn: index === 0 ? [{ question: 'Tab Order', option: 'keep' }] : [],
        recommendation: { option: 'keep', rationale: 'It works.' },
        alternatives: [{ id: 'keep', text: 'Keep it.', advantages: [], drawbacks: [] }],
      })),
    },
  };
  page.send({ type: 'live', missions: [linked, mission(BETA, 'Beta')], running: [] });
  const seen = new Map<string, FakeElement>();
  const look = { tabs: [] as string[], headers: [] as string[], links: [] as string[] };
  const collect = (): void => {
    const tabs = page.root.all().find((each) => each.has('tab-list'));
    assert.ok(tabs !== undefined);
    const tabButtons = new Set(tabs.all().filter((each) => each.tagName === 'button'));
    for (const each of buttons(page)) {
      const name = shownName(each);
      if (tabButtons.has(each)) {
        look.tabs.push(name);
      } else if (each.has('pane-tab')) {
        look.headers.push(name);
      } else if (each.has('link')) {
        look.links.push(name);
      } else {
        assert.strictEqual(PUSH_CLASSES.filter((name) => each.has(name)).length, 1, `${name} carries exactly one push button class`);
        seen.set(name, each);
      }
    }
  };
  named(page, 'Open questions').click();
  collect();
  named(page, 'Next').click();
  collect();
  named(page, 'Remaining tasks').click();
  page.send({
    type: 'preview',
    mission: ALPHA,
    recipe: 'complete',
    lines: ['claude "/gurita:complete-task --mission <path> <Task Title>"'],
    names: ['complete-task'],
    result: { state: 'read', tasks: [{ state: 'resolved', name: 'complete-task', title: 'First Task' }] },
  });
  collect();
  named(page, 'Settings').click();
  page.send(CHECKED);
  page.send(harnessSettings({ claude: true, antigravity: false, codex: true }));
  page.send(harnessListsMessage(LISTS));
  page.send(VARIANTS);
  page.send(LINES);
  collect();
  for (const name of [
    'review',
    'complete',
    'New mission',
    'Define mission',
    'Start run',
    'Discuss',
    'Answer',
    'Answer with recommendation',
    'Answer with this alternative',
    'New task',
    'Duplicate',
    'Rename',
    'Delete',
    'Make default',
    'Reset',
    'Disable',
    'Enable',
    'Remove',
    'Add model',
    'Add effort',
    'Refresh',
    'Settings',
    'Close settings',
    'Check again',
    'Previous',
    'Next',
    'Close preview',
  ]) {
    assert.ok(seen.has(name), `${name} is drawn as a push button`);
  }
  assert.ok(look.tabs.includes('Alpha') && look.headers.includes('Open questions') && look.links.includes('Tab Order'), 'the tabs, headers, and links were drawn');
  assert.strictEqual(named(page, 'Settings').getAttribute('aria-pressed'), 'true');

  const rules = stylesheetRules();
  const push = PUSH_CLASSES.map((name) => `button.${name}`);
  const shared = rules.filter((rule) => push.every((selector) => rule.selectors.includes(selector)) && rule.declarations.has('background'));
  assert.strictEqual(shared.length, 1, 'one rule gives every push button class its look');
  const [rule] = shared;
  assert.deepStrictEqual(rule.selectors, push, 'the shared rule selects the push button classes and nothing else');
  assert.strictEqual(rule.declarations.get('background'), 'var(--vscode-button-background)', "the theme's primary button colour");
  assert.strictEqual(rule.declarations.get('color'), 'var(--vscode-button-foreground)');
  const border = rule.declarations.get('border') ?? '';
  assert.match(border, /^1px solid var\(--vscode-/, 'a solid outline drawn in a theme colour');
  assert.ok(!/none|transparent|var\(--vscode-button-background\)|var\(--vscode-focusBorder\)/.test(border), 'the outline is not hidden or drawn in the fill colour');
  const hover = rules.filter((each) => push.every((selector) => each.selectors.includes(`${selector}:hover:not(:disabled)`)));
  assert.strictEqual(hover.length, 1, 'one hover rule for every push button class');
  assert.strictEqual(hover[0].declarations.get('background'), 'var(--vscode-button-hoverBackground)');
  assert.ok(
    rules.some((each) => push.every((selector) => each.selectors.includes(`${selector}:disabled`))),
    'one disabled rule for every push button class',
  );

  const pressed = '.tabs button.control[aria-pressed="true"]';
  for (const each of rules) {
    if (each === rule || each === hover[0]) {
      continue;
    }
    for (const selector of each.selectors) {
      const target = selector.split(/\s+/).pop() ?? '';
      if (push.some((button) => target.startsWith(button)) && selector !== pressed) {
        for (const property of LOOK) {
          assert.ok(!each.declarations.has(property), `${selector} sets no ${property} of its own`);
        }
      }
    }
  }
  const pressedRule = rules.find((each) => each.selectors.includes(pressed));
  assert.ok(pressedRule !== undefined, 'the Settings control has a rule for while its view is shown');
  assert.notStrictEqual(pressedRule.declarations.get('background'), rule.declarations.get('background'), 'pressed, it is filled differently');
  assert.ok(pressedRule.declarations.has('outline'), 'pressed, it carries a ring of its own');
  const tabRule = rules.find((each) => each.selectors.includes('.tab-list button'));
  const headerRule = rules.find((each) => each.selectors.includes('.pane-tabs button'));
  const linkRule = rules.find((each) => each.selectors.includes('button.link'));
  for (const kept of [tabRule, headerRule, linkRule]) {
    assert.ok(kept !== undefined);
    assert.strictEqual(kept.declarations.get('background'), 'none', 'the tabs, headers, and links keep their unfilled look');
  }
});

test('each variant under Variants and Single-task lines, the deleted ones included, is drawn as a card of its own, indented under its heading with a line down its left edge and space between cards', () => {
  const page = loadPage();
  page.send(live([]));
  named(page, 'Settings').click();
  page.send(VARIANTS);
  page.send(LINES);
  const view = settingsView(page);
  assert.ok(view !== undefined, 'the settings view is drawn');
  const parts = view.all().filter((each) => each.has('variant-edits') || each.has('line-edits'));
  assert.strictEqual(parts.length, 2, 'the Variants and Single-task lines parts are drawn');
  const cards = { listed: 0, deleted: 0 };
  for (const part of parts) {
    const blocks = part.all().filter((each) => each.has('variant-recipe'));
    assert.ok(blocks.length > 0);
    for (const block of blocks) {
      const children = block.children.filter((child): child is FakeElement => child instanceof FakeElement);
      const heading = children.findIndex((child) => child.tagName === 'h5');
      const list = children.findIndex((child) => child.has('variant-list'));
      assert.ok(heading >= 0 && list > heading, 'the variant list stands beneath its recipe or line heading');
      const items = children[list].children.filter((child): child is FakeElement => child instanceof FakeElement);
      for (const item of items) {
        assert.strictEqual(item.tagName, 'li');
        assert.ok(item.has('variant') && item.has('variant-card'), `${item.dataset.variant} is drawn as a card`);
        if (item.has('deleted')) {
          cards.deleted += 1;
        } else {
          cards.listed += 1;
        }
      }
    }
  }
  assert.ok(cards.listed > 0 && cards.deleted === 2, 'listed and deleted variants alike are cards, under both headings');
  const cardItems = view.all().filter((each) => each.has('variant-card'));
  assert.ok(cardItems.every((each) => each.has('variant')), 'nothing but a variant is a card');

  const rules = stylesheetRules();
  const ruleOf = (selector: string): Map<string, string> => {
    const found = rules.filter((rule) => rule.selectors.includes(selector));
    assert.strictEqual(found.length, 1, `one rule selects ${selector}`);
    return found[0].declarations;
  };
  const card = ruleOf('.variant-list li.variant-card');
  assert.match(card.get('border-left') ?? '', /^[1-9]\d*px solid var\(--vscode-[a-zA-Z]+\)$/, 'a solid line in a theme colour down the left edge');
  const padding = (card.get('padding') ?? '').split(/\s+/);
  assert.strictEqual(padding.length, 4);
  assert.notStrictEqual(Number.parseFloat(padding[3]), 0, 'the card keeps its content off the line');
  const list = ruleOf('.variant-list');
  const margin = (list.get('margin') ?? '').split(/\s+/);
  assert.strictEqual(margin.length, 4);
  assert.ok(Number.parseFloat(margin[3]) > 0, 'the cards are indented under the heading');
  assert.strictEqual(list.get('display'), 'flex');
  assert.strictEqual(list.get('flex-direction'), 'column');
  assert.ok(Number.parseFloat(list.get('gap') ?? '0') > 0, 'space between one card and the next');
  for (const rule of rules) {
    if (rule.selectors.some((selector) => selector.includes('variant-card'))) {
      assert.deepStrictEqual(rule.selectors, ['.variant-list li.variant-card'], 'the card has one rule of its own');
    }
  }
});
