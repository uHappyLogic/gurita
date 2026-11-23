import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { FakeElement, Page, loadScript, stylesheetRules } from './fakePage';

// The pane's page script, compiled as the pane loads it, run against the small stand-in for the DOM
// in `fakePage.ts`, so the drawn page can be walked.

/**
 * Loads the compiled page script into a fresh page, as the pane does each time it is shown, its
 * elements laid out to the widths `measure` gives.
 */
function loadPage(measure?: (element: FakeElement) => number): Page {
  return loadScript('page.js', measure);
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
  for (const text of ['review', 'Refresh']) {
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

/** The tab row's controls belonging to no mission, in the order drawn. */
function rowEnds(page: Page): string[] {
  const ends = page.root.all().find((each) => each.has('ends'));
  assert.ok(ends !== undefined);
  return ends.all().filter((each) => each.tagName === 'button').map(shownName);
}

test('the tab row ends in Refresh, New mission, and Define mission with no Settings control, in the failure state too', () => {
  const page = loadPage();
  page.send(live([]));
  assert.deepStrictEqual(rowEnds(page), ['Refresh', 'New mission', 'Define mission']);
  const tabs = page.root.all().find((each) => each.has('tab-list'));
  assert.ok(tabs !== undefined);
  assert.deepStrictEqual(
    tabs.all().filter((each) => each.tagName === 'button').map((each) => each.textContent),
    ['Alpha', 'Beta'],
    'the mission tabs hold missions only',
  );
  assert.ok(!buttons(page).some((each) => ['Settings', 'Close settings'].includes(shownName(each))), 'the pane draws no Settings or Close settings control');
  assert.deepStrictEqual(page.root.all().filter((each) => each.has('settings')), [], 'and no settings view');
  page.send({ type: 'liveFailure', cause: 'Error: no repository' });
  assert.deepStrictEqual(rowEnds(page), ['Refresh', 'New mission', 'Define mission']);
  assert.ok(!buttons(page).some((each) => shownName(each) === 'Settings'));
});

/** The mission page as drawn: every element's tag, text, class, and state, in document order. */
function pageShape(page: Page): string[] {
  return page.root.all().map((each) => `${each.tagName}|${each.textContent}|${each.className}|${each.disabled}|${each.title}`);
}

test('a harness check or settings message posted to the pane changes nothing it draws, and every click posts as before', () => {
  const plain = loadPage();
  plain.send(live([]));
  const posted = loadPage();
  posted.send(live([]));
  const harnesses = [
    { key: 'claude', name: 'Claude Code', cli: 'claude', installed: '2.0.0', packaged: '2.0.0' },
    { key: 'codex', name: 'Codex', cli: 'codex', failed: 'cli', packaged: '2.0.0' },
  ];
  posted.send({ type: 'harnessCheck', check: { state: 'checked', harnesses } });
  posted.send({ type: 'harnessSettings', settings: { state: 'read', enabled: { claude: true, antigravity: false, codex: true } } });
  for (const page of [plain, posted]) {
    named(page, 'Remaining tasks').click();
  }
  assert.deepStrictEqual(pageShape(posted), pageShape(plain), 'the mission page draws every recipe, button, and the looped run alike');
  assert.ok(!texts(posted).some((text) => text.includes('not found') || text.includes('Checking the harnesses')), 'nothing of the check is named on the pane');
  for (const page of [plain, posted]) {
    named(page, 'Open questions').click();
  }
  assert.deepStrictEqual(pageShape(posted), pageShape(plain));
  const clicks = (page: Page): unknown[] => {
    const count = page.posted.length;
    for (const text of ['review', 'complete', 'Discuss', 'Answer', 'Answer with recommendation', 'Answer with this alternative', 'New mission', 'Define mission']) {
      named(page, text).click();
    }
    return page.posted.slice(count);
  };
  assert.deepStrictEqual(clicks(posted), clicks(plain), 'every click posts as it would with nothing of the settings posted');
});

test("after a harness is disabled in the Settings window the page draws the list the extension posts: the variant gone from its dropdown and a recipe left with none gone", () => {
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
  const narrowed = runnable('Requirements iteration', 'shipped', (both as { lines: string[] }).lines, [{ name: 'Claude Code', own: false }]);
  page.send({ type: 'live', missions: [mission(ALPHA, 'Alpha', { step: 'derive', recipes: { state: 'read', recipes: [narrowed] } })], running: [] });
  assert.deepStrictEqual(recipeNames(page), ['Requirements iteration']);
  assert.deepStrictEqual(options(), ['Claude Code'], 'the left-out variant is gone from the dropdown, and the recipe left with none with its button');
  assert.ok(texts(page).includes('Discuss'), 'the fixed-name buttons are drawn as before');
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
    'Refresh',
    'Previous',
    'Next',
    'Close preview',
  ]) {
    assert.ok(seen.has(name), `${name} is drawn as a push button`);
  }
  assert.ok(look.tabs.includes('Alpha') && look.headers.includes('Open questions') && look.links.includes('Tab Order'), 'the tabs, headers, and links were drawn');

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

  for (const each of rules) {
    if (each === rule || each === hover[0]) {
      continue;
    }
    for (const selector of each.selectors) {
      const target = selector.split(/\s+/).pop() ?? '';
      if (push.some((button) => target.startsWith(button))) {
        for (const property of LOOK) {
          assert.ok(!each.declarations.has(property), `${selector} sets no ${property} of its own`);
        }
      }
    }
  }
  const tabRule = rules.find((each) => each.selectors.includes('.tab-list button'));
  const headerRule = rules.find((each) => each.selectors.includes('.pane-tabs button'));
  const linkRule = rules.find((each) => each.selectors.includes('button.link'));
  for (const kept of [tabRule, headerRule, linkRule]) {
    assert.ok(kept !== undefined);
    assert.strictEqual(kept.declarations.get('background'), 'none', 'the tabs, headers, and links keep their unfilled look');
  }
});
