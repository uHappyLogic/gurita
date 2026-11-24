import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { FakeElement, Page, loadScript, stylesheetRules } from './fakePage';

// A mission window's page script, compiled as each mission window loads it, run against the small
// stand-in for the DOM in `fakePage.ts`, so the drawn page can be walked.

/**
 * Loads the compiled page script into a fresh page, as a mission window does each time it is shown,
 * its elements laid out to the widths `measure` gives.
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
    tasks: { state: 'read', remaining: [{ title: 'First Task', brief: 'Build the `first` part.' }] },
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

/** The message posting a mission window's page: its one mission `built`, with the paths of the missions with a running runner. */
function pageOf(built: unknown, running: string[] = []): unknown {
  return { type: 'page', mission: built, running };
}

/** The message posting Alpha's window its page, `running` the paths of the missions with a running runner. */
function alphaPage(running: string[]): unknown {
  return pageOf(mission(ALPHA, 'Alpha'), running);
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

/** The page's action buttons with each pane shown: its recipe buttons, its question card's buttons, New task, and Ask in mission context. */
const ACTIONS: Record<PaneName, string[]> = {
  questions: ['review', 'complete', 'New task', 'Ask in mission context', 'Discuss', 'Answer', 'Answer with this alternative'],
  tasks: ['review', 'complete', 'New task', 'Ask in mission context'],
};

/** The buttons that stay enabled whatever runs, with each pane shown. */
const STAYING: Record<PaneName, string[]> = {
  questions: ['Open questions', 'Tasks', 'Next'],
  tasks: ['Open questions', 'Tasks', 'Show completed tasks'],
};

/** Shows the Tasks pane, then the Open questions pane, running `check` with each shown. */
function eachPane(page: Page, check: (pane: PaneName) => void): void {
  named(page, 'Tasks').click();
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
  page.send(alphaPage([ALPHA]));
  assertRunning(page);
});

test('a page draws its one mission with no tab row, no refresh control, and no mission-starting button', () => {
  const page = loadPage();
  page.send(alphaPage([]));
  assert.deepStrictEqual(page.root.all().filter((each) => each.getAttribute('role') === 'tab' && !each.has('pane-tab')), [], 'no mission tab is drawn');
  assert.deepStrictEqual(page.root.all().filter((each) => each.has('tabs') || each.has('tab-list') || each.has('ends')), [], 'and no tab row');
  for (const text of ['Alpha', 'Refresh', 'New mission', 'Define mission', 'Settings']) {
    assert.ok(!buttons(page).some((each) => shownName(each) === text), `no ${text} button is drawn`);
  }
  assert.deepStrictEqual(page.root.all().filter((each) => each.has('page')).map((each) => each.getAttribute('aria-label')), ['Alpha'], "the mission's page is drawn alone");
  assert.ok(page.root.all().some((each) => each.has('workflow')) && page.root.all().some((each) => each.has('panes')));
});

test("another mission's window is unaffected by a run it does not hold", () => {
  const page = loadPage();
  page.send(pageOf(mission(BETA, 'Beta'), [ALPHA]));
  assertIdle(page);
  named(page, 'review').click();
  assert.deepStrictEqual(page.posted[page.posted.length - 1], { type: 'runRecipe', mission: BETA, recipe: 'review', variant: 'review' });
});

test('the failure state replaces the whole page with the failure line and the cause, and the next page posted draws the page again', () => {
  const page = loadPage();
  page.send(alphaPage([]));
  named(page, 'Tasks').click();
  page.send({ type: 'liveFailure', cause: 'Error: not a git repository' });
  assert.deepStrictEqual(
    page.root.children.map((each) => (each as FakeElement).className),
    ['failure'],
    'one failure section stands in place of the whole page',
  );
  assert.deepStrictEqual(
    page.root.all().filter((each) => each.tagName === 'p' || each.tagName === 'pre').map((each) => each.textContent),
    ['The live missions could not be read.', 'Error: not a git repository'],
  );
  assert.deepStrictEqual(buttons(page), [], 'no button is drawn, so nothing can be clicked against a failed read');
  assert.ok(!page.root.all().some((each) => each.has('workflow') || each.has('recipes') || each.has('panes')), 'no diagram, recipe, or pane is drawn');
  page.send({ type: 'running', missions: [ALPHA] });
  assert.deepStrictEqual(buttons(page), [], 'a running message leaves the failure state as drawn');
  page.send(alphaPage([]));
  assert.strictEqual(shownPane(page), 'questions', 'the page is drawn again, on its default pane');
  assertIdle(page);
});

test('a window whose mission is no longer live draws one fixed notice alone, and its page again once it is posted', () => {
  const page = loadPage();
  page.send(alphaPage([]));
  page.send({
    type: 'preview',
    mission: ALPHA,
    recipe: 'complete',
    lines: ['claude "/gurita:complete-task --mission <path> <Task Title>"'],
    names: ['complete-task'],
    result: { state: 'read', tasks: [] },
  });
  named(page, 'Tasks').click();
  page.send({ type: 'notLive', path: ALPHA });
  assert.deepStrictEqual(page.root.children.map((each) => (each as FakeElement).className), ['not-live']);
  assert.deepStrictEqual(texts(page).filter((text) => text !== ''), ['This mission is no longer live.'], 'the one fixed notice is all that is drawn');
  assert.deepStrictEqual(buttons(page), [], 'no action button is drawn');
  assert.ok(!page.root.all().some((each) => each.has('workflow') || each.has('recipes') || each.has('panes') || each.has('preview')), 'no diagram, recipe, pane, or preview');
  page.send({ type: 'running', missions: [ALPHA] });
  assert.deepStrictEqual(buttons(page), [], 'a running message leaves the notice as drawn');
  page.send(alphaPage([]));
  assert.strictEqual(shownPane(page), 'questions', "the mission's page is drawn again, on its default pane");
  assert.ok(!page.root.all().some((each) => each.has('preview')), 'the preview held before is gone');
  assertIdle(page);
});

test('a preview posted for another mission is not drawn on the page', () => {
  const page = loadPage();
  page.send(alphaPage([]));
  page.send({
    type: 'preview',
    mission: BETA,
    recipe: 'complete',
    lines: ['claude "/gurita:complete-task --mission <path> <Task Title>"'],
    names: ['complete-task'],
    result: { state: 'read', tasks: [] },
  });
  assert.ok(!page.root.all().some((each) => each.has('preview')));
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
  project?: true;
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

test("each mission's page draws its shipped recipes under Actions with no heading of their own, then its own under Your actions", () => {
  const derive = {
    state: 'read',
    recipes: [
      runnable('Approve all standing recommendations and review again', 'shipped', ['claude -p "/gurita:review-mission-requirements --mission <path>"']),
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
  page.send(pageOf(mission(ALPHA, 'Alpha', { step: 'derive', recipes: derive })));
  assert.deepStrictEqual(recipeNames(page), ['Approve all standing recommendations and review again', 'Prepare tasks', 'Prepare tasks (Antigravity)', 'Mine everywhere']);
  assert.deepStrictEqual(recipeGroups(page), ['Your actions']);
  const section = page.root.all().find((each) => each.has('recipes')) as FakeElement;
  assert.deepStrictEqual(
    section.children.filter((child): child is FakeElement => child instanceof FakeElement).map((child) =>
      child.has('recipe-list')
        ? child.children.map((row) => shownName(((row as FakeElement).children[0] as FakeElement).children[0] as FakeElement))
        : child.textContent,
    ),
    ['Actions', ['Approve all standing recommendations and review again', 'Prepare tasks', 'Prepare tasks (Antigravity)'], 'Your actions', ['Mine everywhere']],
    'the shipped recipes stand directly under Actions, in the order posted, and the own group below them',
  );
  assert.ok(!recipeGroups(page).includes('Claude Code') && !recipeGroups(page).includes('Antigravity'));
  named(page, 'Prepare tasks').click();
  assert.deepStrictEqual(page.posted[page.posted.length - 1], { type: 'runRecipe', mission: ALPHA, recipe: 'Prepare tasks', variant: 'default' });
  const beta = loadPage();
  beta.send(pageOf(mission(BETA, 'Beta', { step: 'finish', recipes: finish })));
  assert.deepStrictEqual(recipeNames(beta), [
    'Finish mission',
    'Odd follow up: unknown placeholder <odd> in /home/someone/.gurita/recipes.md',
  ]);
  assert.deepStrictEqual(recipeGroups(beta), ['Your actions']);
  named(beta, 'Finish mission').click();
  assert.deepStrictEqual(beta.posted[beta.posted.length - 1], { type: 'runRecipe', mission: BETA, recipe: 'Finish mission', variant: 'default' });
});

test('the project recipes stand under Project actions, directly below the shipped recipes and above Your actions, drawn only when one is posted', () => {
  const page = loadPage();
  page.send(
    pageOf(
      mission(ALPHA, 'Alpha', {
        step: 'derive',
        recipes: {
          state: 'read',
          recipes: [
            runnable('Prepare tasks', 'shipped', ['echo shipped <path>']),
            runnable('Project review', 'project', ['echo project <path>'], [{ name: 'default', own: false, project: true }]),
            runnable('Mine', 'own', ['echo own <path>']),
          ],
        },
      }),
    ),
  );
  const section = page.root.all().find((each) => each.has('recipes')) as FakeElement;
  assert.deepStrictEqual(
    section.children.filter((child): child is FakeElement => child instanceof FakeElement).map((child) =>
      child.has('recipe-list')
        ? child.children.map((row) => shownName(((row as FakeElement).children[0] as FakeElement).children[0] as FakeElement))
        : child.textContent,
    ),
    ['Actions', ['Prepare tasks'], 'Project actions', ['Project review'], 'Your actions', ['Mine']],
    'the shipped recipes, then the project group, then the own group',
  );
  named(page, 'Project review').click();
  assert.deepStrictEqual(page.posted[page.posted.length - 1], { type: 'runRecipe', mission: ALPHA, recipe: 'Project review', variant: 'default' });
  const none = loadPage();
  none.send(
    pageOf(
      mission(BETA, 'Beta', {
        step: 'derive',
        recipes: { state: 'read', recipes: [runnable('Prepare tasks', 'shipped', ['echo <path>']), runnable('Mine', 'own', ['echo <path>'])] },
      }),
    ),
  );
  assert.deepStrictEqual(recipeGroups(none), ['Your actions'], 'no project heading while no project recipe is posted');
  const only = loadPage();
  only.send(pageOf(mission(BETA, 'Beta', { step: 'derive', recipes: { state: 'read', recipes: [runnable('Project review', 'project', ['echo <path>'])] } })));
  assert.deepStrictEqual(recipeGroups(only), ['Project actions']);
  assert.deepStrictEqual(recipeNames(only), ['Project review']);
});

test("a project variant is marked as the project's on its button and in its dropdown, every other variant drawn by its bare name", () => {
  const page = loadPage();
  const variants: Choice[] = [
    { name: 'default', own: false },
    { name: 'default', own: false, project: true },
    { name: 'default', own: true },
  ];
  const send = (selected: number) =>
    page.send(
      pageOf(
        mission(ALPHA, 'Alpha', {
          step: 'derive',
          recipes: { state: 'read', recipes: [runnable('Prepare tasks', 'shipped', ['echo <path>'], variants, selected)] },
        }),
      ),
    );
  send(1);
  const shown = named(page, 'Prepare tasks');
  assert.deepStrictEqual(recipeParts(shown), ['Prepare tasks', 'default', 'project'], 'the selected project variant carries its mark beside its name');
  const dropdown = page.root.querySelector('[data-focus="variant-Prepare tasks"]') as FakeElement;
  assert.deepStrictEqual(
    dropdown.children.map((child) => (child as FakeElement).textContent),
    ['default', 'default (project)', 'default'],
    "only the project's variant is marked in the dropdown",
  );
  send(0);
  assert.deepStrictEqual(recipeParts(named(page, 'Prepare tasks')), ['Prepare tasks', 'default'], 'a shipped variant carries no mark');
  send(2);
  assert.deepStrictEqual(recipeParts(named(page, 'Prepare tasks')), ['Prepare tasks', 'default'], 'an own variant carries no project mark');
});

test("a page with no own recipe draws no Your actions heading, and one with only own recipes no shipped list", () => {
  const page = loadPage();
  page.send(pageOf(mission(ALPHA, 'Alpha', { step: 'derive', recipes: { state: 'read', recipes: [runnable('Prepare tasks', 'shipped', ['echo <path>'])] } })));
  assert.deepStrictEqual(recipeGroups(page), []);
  assert.deepStrictEqual(recipeNames(page), ['Prepare tasks']);
  const beta = loadPage();
  beta.send(pageOf(mission(BETA, 'Beta', { step: 'derive', recipes: { state: 'read', recipes: [runnable('Mine', 'own', ['echo <path>'])] } })));
  assert.deepStrictEqual(recipeGroups(beta), ['Your actions']);
  assert.deepStrictEqual(recipeNames(beta), ['Mine']);
});

test('each action is drawn on a row of its own, its one line of description to the right of its button and dropdown', () => {
  const described = (entry: unknown, description: string): unknown => ({ ...(entry as object), description });
  const page = loadPage();
  page.send(
    pageOf(
      mission(ALPHA, 'Alpha', {
        step: 'derive',
        recipes: {
          state: 'read',
          recipes: [
            described(runnable('Prepare tasks', 'shipped', ['echo <path>']), 'Derive the task list.'),
            runnable('Prepare tasks (Antigravity)', 'shipped', ['agy -p "/gurita:derive-tasks --mission <path>"']),
            described(
              {
                kind: 'unknown',
                name: 'Odd',
                group: 'own',
                lines: ['echo <odd>'],
                placeholders: ['odd'],
                file: '/home/someone/.gurita/recipes.md',
                variants: [{ name: 'default', own: true }],
                selected: 0,
              },
              'Something of my own, with `code` kept as typed.',
            ),
          ],
        },
      }),
    ),
  );
  const section = page.root.all().find((each) => each.has('recipes')) as FakeElement;
  const lists = section.children.filter((child): child is FakeElement => child instanceof FakeElement && child.has('recipe-list'));
  const rows = lists.flatMap((list) => list.children as FakeElement[]);
  assert.strictEqual(rows.length, 3, 'one row per action');
  assert.ok(rows.every((row) => row.tagName === 'div' && row.has('recipe-row')), 'every action stands on a row of its own');
  const shape = rows.map((row) =>
    (row.children as FakeElement[]).map((child) =>
      child.has('recipe-entry')
        ? [
            'entry',
            (child.children as FakeElement[]).map((part) =>
              part.has('recipe') ? `button ${shownName(part)}` : part.has('recipe-unknown') ? 'unknown' : part.has('recipe-variant') ? 'dropdown' : part.tagName,
            ),
          ]
        : [child.has('recipe-description') ? 'description' : child.tagName, child.textContent],
    ),
  );
  assert.deepStrictEqual(shape, [
    [['entry', ['button Prepare tasks', 'dropdown']], ['description', 'Derive the task list.']],
    [['entry', ['button Prepare tasks (Antigravity)', 'dropdown']]],
    [['entry', ['unknown', 'dropdown']], ['description', 'Something of my own, with `code` kept as typed.']],
  ]);
  assert.deepStrictEqual(recipeNames(page).slice(0, 2), ['Prepare tasks', 'Prepare tasks (Antigravity)'], 'the buttons keep their names');
  assert.strictEqual(named(page, 'Prepare tasks').title, 'echo <path>', "the hover text still shows the variant's lines");
  const rules = stylesheetRules();
  const rule = (selector: string): Map<string, string> => {
    const found = rules.find((each) => each.selectors.includes(selector));
    assert.ok(found !== undefined, `the stylesheet holds a rule for ${selector}`);
    return found.declarations;
  };
  assert.strictEqual(rule('.recipe-list').get('flex-direction'), 'column', 'the rows stack, one beneath the other');
  assert.ok(!rule('.recipe-list').has('flex-wrap'), 'the list no longer wraps its buttons side by side');
  assert.strictEqual(rule('.recipe-row').get('display'), 'flex', 'each row lays its description to the right of its button');
  assert.ok(rule('.recipe-description') !== undefined);
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
  page.send(
    pageOf(
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
    ),
  );
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
  page.send(
    pageOf(
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
    ),
  );
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
  const live = (selected: number) => pageOf(mission(ALPHA, 'Alpha', { step: 'execute', recipes: { state: 'read', recipes: [executeTasks(selected)] } }));
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
  page.send(alphaPage([ALPHA]));
  eachPane(page, () => {
    const selects = page.root.all().filter((each) => each.tagName === 'select');
    const section = page.root.all().find((each) => each.has('recipes')) as FakeElement;
    const inRecipes = section.all().filter((each) => each.tagName === 'select');
    assert.strictEqual(selects.length, 2, 'one dropdown per recipe entry, none elsewhere');
    assert.deepStrictEqual(inRecipes, selects, 'every dropdown stands in the recipe list');
    for (const select of selects) {
      assert.strictEqual(select.disabled, false);
    }
    for (const text of ['Discuss', 'Answer', 'Answer with this alternative', 'New task', 'Ask in mission context']) {
      if (buttons(page).some((each) => shownName(each) === text)) {
        assert.ok(!section.all().includes(named(page, text)), `${text} stands outside the recipe list`);
      }
    }
  });
});

/** Each fixed-name button's label, the button's key, and the hover text it shows while its recipe cannot be read. */
const FIXED_BUTTONS: [string, string, string][] = [
  ['New task', 'discussTask', 'Type an issue and open an interactive discussion of it into tasks for this mission'],
  ['Ask in mission context', 'askMission', 'Type a question and open an interactive session answering it in the context of this mission'],
  ['Discuss', 'discussQuestion', 'Type an optional note and open an interactive discussion of this question'],
  ['Answer', 'answerQuestion', 'Record an answer you type as the decision'],
  ['Answer with this alternative', 'answerWithAlternative', 'Record keep as the decision'],
];

/** A mission as `mission` builds it, enough of its questions to post a button per alternative. */
interface BuiltMission {
  questions: { state: string; questions?: { id: string; alternatives: { id: string }[] }[] };
}

/**
 * The message posting Alpha's window its page, built by `build`, its answer-with-alternative entry
 * of `entries` posted once for every alternative of every question, and the other buttons with the
 * mission.
 */
function liveButtons(entries: Record<string, unknown>, running: string[] = [], build: (missionPath: string, title: string) => unknown = mission): unknown {
  const onPage = Object.fromEntries(Object.entries(entries).filter(([key]) => key !== 'answerWithAlternative'));
  const built = build(ALPHA, 'Alpha') as BuiltMission;
  const entry = entries.answerWithAlternative;
  const alternativeButtons =
    entry === undefined
      ? []
      : (built.questions.questions ?? []).flatMap((question) =>
          question.alternatives.map((alternative) => ({ question: question.id, alternative: alternative.id, entry })),
        );
  return pageOf({ ...built, buttons: onPage, alternativeButtons }, running);
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

/** Each fixed-name button drawn with the Tasks pane and then the Open questions pane shown, by its label: its spans and its hover text. */
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
  assert.deepStrictEqual(fixedShown(page), expected('fable', 'xhigh'), 'all five buttons, with either pane shown');

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
      discussTask: { state: 'offered', lines: ['echo <issue description>'], ...one('Echo') },
      answerQuestion: undefined,
    }),
  );
  const shown = fixedShown(page);
  assert.deepStrictEqual(shown.Discuss, [['Discuss', 'Mixed'], mixed.join('\n')]);
  assert.deepStrictEqual(shown['New task'], [['New task', 'Echo'], 'echo <issue description>'], 'a variant of no readable line shows its name too');
  assert.deepStrictEqual(shown.Answer, [['Answer'], 'Record an answer you type as the decision'], 'a recipe that cannot be read shows the name alone');

  // Nothing posted for the buttons: every one shows its name alone.
  page.send(alphaPage([]));
  assert.deepStrictEqual(
    fixedShown(page),
    Object.fromEntries(FIXED_BUTTONS.map(([label, , hover]) => [label, [[label], hover]])),
  );

  // A click posts the variant selected with what it posted before, and a run disables the mission's fixed-name buttons.
  page.send(liveButtons(fixedButtons('fable', 'xhigh')));
  named(page, 'Discuss').click();
  assert.deepStrictEqual(page.posted.slice(-1), [
    { type: 'questionButton', button: 'discussQuestion', mission: ALPHA, question: 'Pane Layout', variant: 'default' },
  ]);
  page.send(liveButtons(fixedButtons('fable', 'xhigh'), [ALPHA]));
  assertRunning(page);
});

test("a question card's head carries exactly two buttons, Discuss and Answer, each with its dropdown, and no Answer with recommendation", () => {
  const page = loadPage();
  for (const message of [alphaPage([]), liveButtons(fixedButtons('fable', 'xhigh'))]) {
    page.send(message);
    named(page, 'Open questions').click();
    const heads = page.root.all().filter((each) => each.has('card-head'));
    assert.strictEqual(heads.length, 1, 'one card is drawn, with one head');
    const inHead = heads[0].all().filter((each) => each.tagName === 'button').map(shownName);
    assert.deepStrictEqual(inHead, ['Discuss', 'Answer'], "the card's head buttons, in order");
    assert.ok(!buttons(page).some((each) => shownName(each) === 'Answer with recommendation'), 'no Answer with recommendation button anywhere');
    assert.ok(!texts(page).some((text) => text.includes('Answer with recommendation')), 'and no text naming it');
  }
  const selects = page.root.all().find((each) => each.has('card-head'))?.all().filter((each) => each.tagName === 'select') ?? [];
  assert.deepStrictEqual(
    selects.map((each) => each.getAttribute('aria-label')),
    ['The variant of Discuss', 'The variant of Answer'],
    'one dropdown beside each head button',
  );
  named(page, 'Answer').click();
  assert.deepStrictEqual(page.posted.slice(-1), [
    { type: 'questionButton', button: 'answerQuestion', mission: ALPHA, question: 'Pane Layout', variant: 'default' },
  ]);
});

/** The children of `node` as plain shapes: a text node as its text, a `code` element as `{ code: <its text> }`. */
function inlineShape(node: FakeElement): (string | { code: string })[] {
  return node.children.map((child) => {
    if (child instanceof FakeElement) {
      assert.strictEqual(child.tagName, 'code', 'only code stands inside a card text');
      return { code: child.textContent };
    }
    return child.textContent;
  });
}

test("a card drawn from backticked text shows each backticked stretch as code, in its question, rationale, and alternative's text, advantages, and drawbacks", () => {
  const page = loadPage();
  const built = mission(ALPHA, 'Alpha') as { questions: { questions: Record<string, unknown>[] } };
  built.questions.questions[0].question = 'Should `src/pane.ts` run `git log`?\n\n- not a list';
  built.questions.questions[0].recommendation = { option: 'keep', rationale: 'It keeps `execFile`.' };
  built.questions.questions[0].alternatives = [
    { id: 'keep', text: 'Keep `npm test` as it is.', advantages: ['No `--flag` added.'], drawbacks: ['Stays **slow** and `a'] },
  ];
  page.send(pageOf(built));
  named(page, 'Open questions').click();
  const all = page.root.all();
  const question = all.find((each) => each.has('question-text'));
  assert.ok(question !== undefined);
  assert.strictEqual(question.tagName, 'p', 'the question stays one paragraph');
  assert.deepStrictEqual(inlineShape(question), ['Should ', { code: 'src/pane.ts' }, ' run ', { code: 'git log' }, '?\n\n- not a list']);
  const rationale = all.find((each) => each.has('pick'))?.children.find((child): child is FakeElement => child instanceof FakeElement && child.tagName === 'p');
  assert.ok(rationale !== undefined);
  assert.deepStrictEqual(inlineShape(rationale), ['It keeps ', { code: 'execFile' }, '.']);
  const alternative = all.find((each) => each.has('alternative'));
  const text = alternative?.children.find((child): child is FakeElement => child instanceof FakeElement && child.tagName === 'p');
  assert.ok(text !== undefined);
  assert.deepStrictEqual(inlineShape(text), ['Keep ', { code: 'npm test' }, ' as it is.']);
  const advantage = all.find((each) => each.has('advantage'));
  const drawback = all.find((each) => each.has('drawback'));
  assert.ok(advantage !== undefined && drawback !== undefined);
  assert.deepStrictEqual(inlineShape(advantage), ['Advantage: No ', { code: '--flag' }, ' added.']);
  assert.deepStrictEqual(inlineShape(drawback), ['Drawback: Stays **slow** and `a'], 'every other construct stays as written');
  const codes = all.filter((each) => each.tagName === 'code');
  assert.strictEqual(codes.length, 5);
  assert.ok(stylesheetRules().some((rule) => rule.selectors.includes('.card code')), 'the stylesheet draws code on the card');
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

test("each alternative's id stands alone on its head line, with its button and dropdown on a row of their own beneath it, above its text, the label on one line", () => {
  const page = loadPage();
  const offered = {
    state: 'offered',
    lines: ['claude -p "/gurita:answer-open-question-with-alternative" --model "opus" --effort high;'],
    variants: [
      { name: 'Fable', own: false },
      { name: 'Opus', own: true },
    ],
    selected: 1,
  };
  const built = twoAlternatives(ALPHA, 'Alpha') as { questions: { questions: { recommendation?: unknown }[] } };
  built.questions.questions[0].recommendation = { option: 'drop', rationale: 'Less to keep.' };
  page.send(liveButtons({ answerWithAlternative: offered }, [], () => built));
  const drawn = page.root.all().filter((each) => each.has('alternative'));
  assert.strictEqual(drawn.length, 2);
  for (const [index, [id, heading]] of [['keep', 'keep'], ['drop', 'drop (picked)']].entries()) {
    const entry = drawn[index];
    const parts = entry.children.filter((child): child is FakeElement => child instanceof FakeElement);
    assert.deepStrictEqual(
      parts.map((part) => (part.has('alternative-head') ? 'head' : part.has('alternative-actions') ? 'row' : part.tagName)),
      ['head', 'row', 'p'],
      'the head line, then the button row, then the text',
    );
    const [head, row, text] = parts;
    assert.deepStrictEqual(head.children.map((child) => [(child as FakeElement).tagName, child.textContent]), [['h6', heading]], `${id}'s head line holds its id alone`);
    assert.strictEqual(text.children.map((child) => child.textContent).join(''), id === 'keep' ? 'Keep it.' : 'Drop it.');
    assert.strictEqual(row.children.length, 1, 'the row holds one entry');
    const item = row.children[0] as FakeElement;
    assert.ok(item.has('recipe-entry'));
    const [node, dropdown] = item.children as FakeElement[];
    assert.strictEqual(item.children.length, 2, 'the button and its dropdown beside it');
    assert.strictEqual(node.tagName, 'button');
    assert.deepStrictEqual(recipeParts(node), ['Answer with this alternative', 'Opus'], 'the label reads the title, then the variant');
    assert.strictEqual(dropdown, alternativeDropdowns(page)[index]);
    assertArrowOnly(dropdown);
  }
  // The row's button draws the variant's name inline, on the title's line, where every other button draws it beneath.
  const rules = stylesheetRules();
  const inline = rules.find((rule) => rule.selectors.includes('.alternative-actions button.action .recipe-variant-name'));
  assert.ok(inline !== undefined, 'the stylesheet holds a rule for the row');
  assert.strictEqual(inline.declarations.get('display'), 'inline');
  const beneath = rules.findIndex((rule) => rule.selectors.includes('button.action .recipe-variant-name'));
  assert.strictEqual(rules[beneath].declarations.get('display'), 'block');
  assert.ok(rules.indexOf(inline) > beneath, "the row's rule comes after the block rule it overrides");
});

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
      if (pane === 'tasks' && ['Discuss', 'Answer', 'Answer with this alternative'].includes(label)) {
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
  named(page, 'Tasks').click();
  (dropdownBeside(page, 'New task') as FakeElement).change('0');
  (dropdownBeside(page, 'Ask in mission context') as FakeElement).change('0');
  assert.deepStrictEqual(page.posted.slice(count), [
    { type: 'selectButtonVariant', button: 'discussQuestion', mission: ALPHA, variant: 'Fable' },
    { type: 'selectAlternativeVariant', mission: ALPHA, question: 'Pane Layout', alternative: 'drop', variant: 'Fable' },
    { type: 'selectButtonVariant', button: 'discussTask', mission: ALPHA, variant: 'Fable' },
    { type: 'selectButtonVariant', button: 'askMission', mission: ALPHA, variant: 'Fable' },
  ]);

  // A click posts the variant selected.
  count = page.posted.length;
  named(page, 'New task').click();
  named(page, 'Ask in mission context').click();
  named(page, 'Open questions').click();
  named(page, 'Answer').click();
  for (const each of buttons(page).filter((node) => shownName(node) === 'Answer with this alternative')) {
    each.click();
  }
  assert.deepStrictEqual(page.posted.slice(count), [
    { type: 'taskButton', mission: ALPHA, variant: 'Opus' },
    { type: 'askButton', mission: ALPHA, variant: 'Opus' },
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
  /** Alpha's page, its first card's keep and drop buttons standing on the variants at `keep` and `drop`. */
  const send = (keep: unknown, drop: unknown) =>
    page.send(
      pageOf({
        ...(twoAlternatives(ALPHA, 'Alpha') as object),
        buttons: {},
        alternativeButtons: [
          { question: 'Pane Layout', alternative: 'keep', entry: keep },
          { question: 'Pane Layout', alternative: 'drop', entry: drop },
        ],
      }),
    );
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
  page.send(pageOf({ ...(twoAlternatives(ALPHA, 'Alpha') as object), buttons: {} }));
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
  assert.strictEqual(named(page, 'review').disabled, false, 'review stays enabled');
});

test("a mission's page draws the recipe failure posted with its mission", () => {
  const page = loadPage();
  page.send(pageOf(mission(ALPHA, 'Alpha', { step: 'derive', recipes: { state: 'failed', cause: 'EACCES: recipes.md' } })));
  const section = page.root.all().find((each) => each.has('recipes'));
  assert.ok(section !== undefined);
  assert.deepStrictEqual(
    section.all().filter((each) => each.tagName === 'p' || each.tagName === 'pre').map((each) => each.textContent),
    ['The actions could not be read.', 'EACCES: recipes.md'],
  );
  assert.deepStrictEqual(recipeNames(page), []);
});

test('a run posted as started draws the page running, and its terminal closing draws it idle again', () => {
  const page = loadPage();
  page.send(alphaPage([]));
  assertIdle(page);
  page.send({ type: 'running', missions: [ALPHA] });
  assertRunning(page);
  page.send({ type: 'running', missions: [] });
  assertIdle(page);
  page.send(alphaPage([ALPHA]));
  assertRunning(page);
  page.send(alphaPage([]));
  assertIdle(page);
});

const RUN_INDICATOR_LINE = "This mission is waiting for its run's terminal to close.";

/** The page's run indicator, of which exactly one is drawn, and its place among the page's parts. */
function runIndicator(page: Page): { indicator: FakeElement; place: number; parts: string[] } {
  const found = page.root.all().filter((each) => each.has('run-indicator'));
  assert.strictEqual(found.length, 1, 'the page draws one run indicator');
  const drawn = page.root.all().find((each) => each.has('page'));
  assert.ok(drawn !== undefined);
  const parts = drawn.children.filter((child): child is FakeElement => child instanceof FakeElement);
  return { indicator: found[0], place: parts.indexOf(found[0]), parts: parts.map((each) => each.className) };
}

test("a running mission's page shows the run indicator beneath the diagram, and an idle one keeps its place out of sight", () => {
  const page = loadPage();
  page.send(alphaPage([]));
  const idle = runIndicator(page);
  assert.strictEqual(idle.indicator.textContent, RUN_INDICATOR_LINE, 'the idle indicator keeps its line, so its space is the same');
  assert.strictEqual(idle.indicator.has('idle'), true, 'the indicator is out of sight while no run is going');
  assert.strictEqual(idle.indicator.getAttribute('aria-hidden'), 'true');
  assert.ok(idle.parts[idle.place - 1].split(' ').includes('workflow'), 'the indicator stands directly beneath the diagram');
  page.send({ type: 'running', missions: [ALPHA] });
  const shown = runIndicator(page);
  assert.strictEqual(shown.indicator.textContent, RUN_INDICATOR_LINE);
  assert.strictEqual(shown.indicator.has('idle'), false, 'the indicator shows while the run is going');
  assert.strictEqual(shown.indicator.getAttribute('aria-hidden'), 'false');
  assert.strictEqual(shown.indicator.getAttribute('role'), 'status');
  assert.strictEqual(shown.place, idle.place, 'the indicator stands at the same place in both states');
  assert.deepStrictEqual(shown.parts.map((each) => each.replace(' idle', '')), idle.parts.map((each) => each.replace(' idle', '')), 'no part of the page moves');
  page.send({ type: 'running', missions: [] });
  assert.strictEqual(runIndicator(page).indicator.has('idle'), true, 'the terminal closing hides it again');
  page.send(pageOf(mission(BETA, 'Beta'), [ALPHA]));
  assert.strictEqual(runIndicator(page).indicator.has('idle'), true, "another mission's run shows nothing on this page");
});

test("the stylesheet reserves the run indicator's space while it is out of sight", () => {
  const rules = stylesheetRules();
  const hidden = rules.filter((rule) => rule.selectors.some((selector) => selector.includes('run-indicator')));
  assert.ok(hidden.length > 0, 'the stylesheet holds rules for the indicator');
  const idle = hidden.find((rule) => rule.selectors.includes('.run-indicator.idle'));
  assert.ok(idle !== undefined, 'the stylesheet holds a rule for the idle indicator');
  assert.strictEqual(idle.declarations.get('visibility'), 'hidden', 'the idle indicator is hidden by visibility, keeping its space');
  for (const rule of hidden) {
    assert.ok(!rule.declarations.has('display'), `${rule.selectors.join(', ')} takes the indicator out of no layout`);
    assert.ok(!rule.declarations.has('height') && !rule.declarations.has('max-height'), `${rule.selectors.join(', ')} collapses no space`);
  }
});

const GATE_NOTICE_LINE = 'The scope is held by another started mission or could not be checked, so a run that derives, adds, or completes tasks would stop.';
const CHANGES_NOTICE_LINE = 'requirements.md or open_questions.xml holds an uncommitted change, so the answer sweep would stop.';

/** The message posting Alpha's window its page with `stops` as what would stop a run of it. */
function stoppedPage(stops: unknown): unknown {
  return pageOf({ ...(mission(ALPHA, 'Alpha') as Record<string, unknown>), stops });
}

/** The drawn notices of what would stop a run, by their kind, and the place of their section among the page's parts. */
function stopNotices(page: Page): { gate?: FakeElement; changes?: FakeElement; sections: number; parts: string[]; place: number } {
  const drawn = page.root.all().find((each) => each.has('page'));
  assert.ok(drawn !== undefined);
  const parts = drawn.children.filter((child): child is FakeElement => child instanceof FakeElement);
  const sections = page.root.all().filter((each) => each.has('stops'));
  return {
    gate: page.root.all().find((each) => each.has('gate-notice')),
    changes: page.root.all().find((each) => each.has('changes-notice')),
    sections: sections.length,
    parts: parts.map((each) => each.className),
    place: sections.length > 0 ? parts.indexOf(sections[0]) : -1,
  };
}

/** The texts of a notice's paragraph, list items, and preformatted lines, in order. */
function noticeTexts(notice: FakeElement): string[] {
  return notice.all().filter((each) => ['p', 'li', 'pre'].includes(each.tagName)).map((each) => each.textContent);
}

test('a page draws no notice of what would stop a run while neither condition holds, or when none is posted', () => {
  const page = loadPage();
  page.send(alphaPage([]));
  assert.strictEqual(stopNotices(page).sections, 0, 'a page posted with no stops draws none');
  page.send(stoppedPage({ gate: { state: 'free' }, changes: [] }));
  assert.strictEqual(stopNotices(page).sections, 0, 'a free gate and clean mission files draw none');
  page.send(stoppedPage({ gate: { state: 'free' } }));
  assert.strictEqual(stopNotices(page).sections, 0, 'changes git could not read draw none');
});

test('the scope notice shows while another started mission holds the scope, naming the holders, and is gone once the scope is free', () => {
  const page = loadPage();
  page.send(stoppedPage({ gate: { state: 'held', holders: ['lib/mission_holder/', 'lib/sub/mission_other/'] }, changes: [] }));
  const held = stopNotices(page);
  assert.strictEqual(held.sections, 1);
  assert.ok(held.gate !== undefined, 'the scope notice is drawn');
  assert.strictEqual(held.changes, undefined, 'the changes notice is not');
  assert.deepStrictEqual(noticeTexts(held.gate), [GATE_NOTICE_LINE, 'lib/mission_holder/', 'lib/sub/mission_other/']);
  assert.ok(held.parts[held.place - 1].split(' ').includes('run-indicator'), 'the notices stand directly beneath the run indicator');
  assert.ok(held.parts[held.place + 1].split(' ').includes('recipes'), 'and above the recipes');
  page.send(stoppedPage({ gate: { state: 'free' }, changes: [] }));
  assert.strictEqual(stopNotices(page).sections, 0, 'the notice is gone once the gate is free');
});

test("the scope notice shows the gate's error line while the gate could not be checked", () => {
  const page = loadPage();
  page.send(stoppedPage({ gate: { state: 'unchecked', cause: 'Error: shallow clone; run git fetch --unshallow' }, changes: [] }));
  const notice = stopNotices(page).gate;
  assert.ok(notice !== undefined);
  assert.deepStrictEqual(noticeTexts(notice), [GATE_NOTICE_LINE, 'Error: shallow clone; run git fetch --unshallow']);
});

test('the changes notice shows while requirements.md or open_questions.xml holds an uncommitted change, its porcelain lines beneath, and is gone once committed', () => {
  const page = loadPage();
  page.send(stoppedPage({ gate: { state: 'free' }, changes: [` M ${ALPHA}requirements.md`, `M  ${ALPHA}open_questions.xml`] }));
  const dirty = stopNotices(page);
  assert.strictEqual(dirty.gate, undefined);
  assert.ok(dirty.changes !== undefined, 'the changes notice is drawn');
  assert.deepStrictEqual(noticeTexts(dirty.changes), [CHANGES_NOTICE_LINE, ` M ${ALPHA}requirements.md\nM  ${ALPHA}open_questions.xml`]);
  page.send(stoppedPage({ gate: { state: 'held', holders: ['mission_holder/'] }, changes: [` M ${ALPHA}requirements.md`] }));
  const both = stopNotices(page);
  assert.strictEqual(both.sections, 1, 'both notices stand in one section');
  assert.ok(both.gate !== undefined && both.changes !== undefined, 'both conditions draw their notice at once');
  page.send(stoppedPage({ gate: { state: 'free' }, changes: [] }));
  assert.strictEqual(stopNotices(page).sections, 0, 'both are gone once neither holds');
});

test('the notices are drawn as text, never as markup, and stay while a run is going', () => {
  const page = loadPage();
  page.send(pageOf({ ...(mission(ALPHA, 'Alpha') as Record<string, unknown>), stops: { gate: { state: 'held', holders: ['<b>x</b>/mission_y/'] }, changes: [] } }, [ALPHA]));
  const notice = stopNotices(page).gate;
  assert.ok(notice !== undefined, 'a running page keeps its notices');
  assert.ok(noticeTexts(notice).includes('<b>x</b>/mission_y/'));
  assert.ok(notice.all().every((each) => each.tagName !== 'b'));
});

test("a held preview's start button is disabled while its mission runs, its close button not", () => {
  const page = loadPage();
  page.send(alphaPage([]));
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
  hidden.send(alphaPage([]));
  const shown = loadPage();
  shown.send(alphaPage([ALPHA]));
  assertRunning(shown);
});

/** The workflow diagram's blocks, in the order drawn. */
function blocks(page: Page): FakeElement[] {
  return page.root.all().filter((each) => each.has('block'));
}

/** A page drawn for one mission whose diagram draws `workflow`. */
function diagramPage(workflow: Record<string, unknown>, running: string[] = []): Page {
  const page = loadPage();
  page.send(pageOf(mission(ALPHA, 'Alpha', workflow), running));
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
  page.send(pageOf(mission(ALPHA, 'Alpha', workflow), running));
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
  assert.strictEqual(selected[0].textContent, pane === 'tasks' ? 'Tasks' : 'Open questions');
  return pane;
}

/** Every text drawn on the page. */
function texts(page: Page): string[] {
  return page.root.all().map((each) => each.textContent);
}

/** The message posting Alpha's window its page with the default pane given, `undefined` posting none. */
function liveWith(pane: PaneName | undefined, running: string[] = []): unknown {
  return pageOf(mission(ALPHA, 'Alpha', { step: 'derive', ...(pane === undefined ? {} : { defaultPane: pane }) }), running);
}

test('a mission page draws one row of two pane headers with only the selected pane beneath it', () => {
  const page = loadPage();
  page.send(liveWith('questions'));
  assert.deepStrictEqual(
    paneHeaders(page).map((each) => [each.tagName, each.textContent, each.getAttribute('role')]),
    [
      ['button', 'Open questions', 'tab'],
      ['button', 'Tasks', 'tab'],
    ],
  );
  assert.strictEqual(shownPane(page), 'questions');
  assert.ok(texts(page).includes('1 / 2'));
  assert.ok(texts(page).includes('Discuss'));
  assert.ok(!texts(page).includes('First Task'));
  named(page, 'Tasks').click();
  assert.strictEqual(shownPane(page), 'tasks');
  assert.ok(texts(page).includes('First Task'));
  assert.ok(!texts(page).includes('1 / 2'));
  assert.ok(!texts(page).includes('Discuss'));
  assert.strictEqual(page.root.all().filter((each) => each.tagName === 'h3' && ['Open questions', 'Tasks'].includes(each.textContent)).length, 0);
});

test("the Tasks pane draws each remaining task's heading with its brief beneath it, the brief drawn by the text renderer", () => {
  const page = loadPage();
  const tasks = {
    state: 'read',
    remaining: [
      { title: 'First Task', brief: 'Build the `first` part.\nOn one paragraph.\n\n- One point\n- Another' },
      { title: 'Bare Task', brief: '' },
      { title: 'Third Task', brief: 'Plain *emphasis* and [a link](x) stay text.' },
    ],
  };
  page.send(pageOf({ ...(mission(ALPHA, 'Alpha') as Record<string, unknown>), tasks }));
  named(page, 'Tasks').click();
  assert.strictEqual(shownPane(page), 'tasks');
  const pane = page.root.all().find((each) => each.has('pane') && each.has('tasks')) as FakeElement;
  const list = (pane.children[0] as FakeElement).children[1] as FakeElement;
  assert.strictEqual(list.tagName, 'ol');
  const items = list.children as FakeElement[];
  assert.deepStrictEqual(
    items.map((item) => (item.children as FakeElement[]).map((each) => [each.tagName, each.className])),
    [
      [['h4', 'task-title'], ['div', 'task-brief']],
      [['h4', 'task-title']],
      [['h4', 'task-title'], ['div', 'task-brief']],
    ],
    'each task is its heading, with its brief beneath it when it has one',
  );
  assert.deepStrictEqual(items.map((item) => item.children[0].textContent), ['First Task', 'Bare Task', 'Third Task']);
  const [paragraph, bullets] = (items[0].children[1] as FakeElement).children as FakeElement[];
  assert.strictEqual(paragraph.tagName, 'p');
  assert.deepStrictEqual(
    paragraph.children.map((child) => (child instanceof FakeElement ? [child.tagName, child.textContent] : ['text', child.textContent])),
    [
      ['text', 'Build the '],
      ['code', 'first'],
      ['text', ' part. On one paragraph.'],
    ],
  );
  assert.strictEqual(bullets.tagName, 'ul');
  assert.deepStrictEqual(bullets.children.map(renderedText), ['One point', 'Another']);
  const third = (items[2].children[1] as FakeElement).children as FakeElement[];
  assert.deepStrictEqual(third.map((each) => [each.tagName, renderedText(each)]), [['p', 'Plain *emphasis* and [a link](x) stay text.']]);
});

/** Two completed tasks as the extension posts them, newest first, the second with no verified bar. */
const COMPLETED = {
  state: 'read',
  tasks: [
    { hash: 'abc1234', date: '2026-11-24', mission: ALPHA, title: 'Done Task', bar: '- The `done` criterion\n- Another criterion' },
    { hash: 'def5678', date: '2026-11-23', mission: ALPHA, title: 'Bare Done Task', bar: '' },
  ],
};

/** Alpha's page with its completed tasks `completed`, left out when undefined. */
function completedPage(completed: unknown, running: string[] = []): unknown {
  return pageOf({ ...(mission(ALPHA, 'Alpha') as Record<string, unknown>), ...(completed === undefined ? {} : { completed }) }, running);
}

/** The Tasks pane drawn on the page. */
function tasksPane(page: Page): FakeElement {
  const found = page.root.all().find((each) => each.has('pane') && each.has('tasks'));
  assert.ok(found !== undefined, 'the Tasks pane is drawn');
  return found;
}

/** The completed tasks' control. */
function completedToggle(page: Page): FakeElement {
  const found = page.root.all().filter((each) => each.has('completed-toggle'));
  assert.strictEqual(found.length, 1);
  return found[0];
}

/** The completed tasks' part of the Tasks pane. */
function completedPart(page: Page): FakeElement {
  return tasksPane(page).children[1] as FakeElement;
}

test('the Tasks pane holds two parts, the remaining tasks under their heading and beneath them the completed tasks behind one control, hidden by default, and no third pane', () => {
  const page = loadPage();
  page.send(completedPage(COMPLETED));
  assert.deepStrictEqual(paneHeaders(page).map((each) => each.textContent), ['Open questions', 'Tasks'], 'the page keeps its two pane headers');
  named(page, 'Tasks').click();
  const pane = tasksPane(page);
  assert.strictEqual(pane.getAttribute('aria-label'), 'Tasks');
  const parts = pane.children as FakeElement[];
  assert.deepStrictEqual(
    parts.map((each) => each.className),
    ['task-part remaining-tasks', 'task-part completed-tasks'],
    'the remaining tasks head the pane, the completed tasks beneath them',
  );
  const remainingHeading = parts[0].children[0] as FakeElement;
  assert.deepStrictEqual([remainingHeading.tagName, remainingHeading.textContent], ['h3', 'Remaining tasks']);
  assert.ok(parts[0].all().some((each) => each.textContent === 'First Task'), 'the remaining tasks stand in their own part');
  const head = parts[1].children[0] as FakeElement;
  assert.deepStrictEqual(
    head.children.map((each) => [(each as FakeElement).tagName, each.textContent]),
    [
      ['h3', 'Completed tasks'],
      ['button', 'Show completed tasks'],
    ],
    'the completed heading with its control beside it',
  );
  assert.strictEqual(completedToggle(page).getAttribute('aria-expanded'), 'false');
  assert.strictEqual(parts[1].children.length, 1, 'collapsed by default: nothing beneath the heading');
  assert.ok(!texts(page).includes('Done Task'), 'no completed task is drawn while they are hidden');
  assert.strictEqual(page.root.all().filter((each) => each.has('pane')).length, 1, 'one pane drawn at a time');
  named(page, 'Open questions').click();
  assert.ok(!page.root.all().some((each) => each.has('completed-toggle')), 'the Open questions pane draws no completed tasks');
});

test('the control shows each completed task, newest first, its title with its verified bar drawn by the text renderer beneath it, and hides them again', () => {
  const page = loadPage();
  page.send(completedPage(COMPLETED));
  named(page, 'Tasks').click();
  completedToggle(page).click();
  assert.strictEqual(completedToggle(page).textContent, 'Hide completed tasks');
  assert.strictEqual(completedToggle(page).getAttribute('aria-expanded'), 'true');
  const list = completedPart(page).children[1] as FakeElement;
  assert.strictEqual(list.tagName, 'ol');
  assert.strictEqual(list.className, 'task-list completed-list');
  const items = list.children as FakeElement[];
  assert.deepStrictEqual(
    items.map((item) => (item.children as FakeElement[]).map((each) => [each.tagName, each.className, each.tagName === 'h4' ? each.textContent : ''])),
    [
      [
        ['h4', 'task-title', 'Done Task'],
        ['p', 'task-commit', ''],
        ['div', 'task-bar', ''],
      ],
      [
        ['h4', 'task-title', 'Bare Done Task'],
        ['p', 'task-commit', ''],
      ],
    ],
    'each completed task is its title, its commit link beneath it, and its bar beneath that when it has one, in the order posted',
  );
  const bar = (items[0].children[2] as FakeElement).children as FakeElement[];
  assert.deepStrictEqual(bar.map((each) => each.tagName), ['ul'], "the bar's bullets are one list");
  const [first, second] = bar[0].children as FakeElement[];
  assert.deepStrictEqual(
    first.children.map((child) => (child instanceof FakeElement ? [child.tagName, child.textContent] : ['text', child.textContent])),
    [
      ['text', 'The '],
      ['code', 'done'],
      ['text', ' criterion'],
    ],
  );
  assert.strictEqual(renderedText(second), 'Another criterion');
  completedToggle(page).click();
  assert.strictEqual(completedToggle(page).textContent, 'Show completed tasks');
  assert.strictEqual(completedToggle(page).getAttribute('aria-expanded'), 'false');
  assert.strictEqual(completedPart(page).children.length, 1, 'hidden again');
  assert.deepStrictEqual(page.posted, [{ type: 'ready' }], 'the control posts nothing to the extension');
});

test("each completed task's commit link names its commit's hash, posts the hash with the page's mission when clicked, and stays enabled while a chain runs", () => {
  const page = loadPage();
  page.send(completedPage(COMPLETED, [ALPHA]));
  named(page, 'Tasks').click();
  completedToggle(page).click();
  const links = page.root.all().filter((each) => each.has('commit-link'));
  assert.deepStrictEqual(
    links.map((each) => [each.tagName, each.className, each.textContent]),
    [
      ['button', 'link commit-link', 'Open commit abc1234'],
      ['button', 'link commit-link', 'Open commit def5678'],
    ],
    'one link per completed task, a bar-less one included, in the order posted',
  );
  for (const link of links) {
    assert.strictEqual(link.disabled, false, 'the link stays enabled while a chain runs');
    assert.match(link.title, /editor tab/);
  }
  links[1].click();
  links[0].click();
  assert.deepStrictEqual(page.posted.slice(1), [
    { type: 'openCommit', mission: ALPHA, hash: 'def5678' },
    { type: 'openCommit', mission: ALPHA, hash: 'abc1234' },
  ]);
});

test("the completed task's commit line carries its stylesheet rule", () => {
  const selectors = stylesheetRules().flatMap((rule) => rule.selectors);
  assert.ok(selectors.includes('.task-list .task-commit'));
  assert.ok(selectors.includes('button.link'), "the link takes the page's link looks");
});

test('shown completed tasks draw the line saying none is completed, or the failure line with the cause, and none when nothing is posted', () => {
  for (const [completed, expected] of [
    [{ state: 'read', tasks: [] }, [['p', 'No task is completed.']]],
    [undefined, [['p', 'No task is completed.']]],
  ] as [unknown, string[][]][]) {
    const page = loadPage();
    page.send(completedPage(completed));
    named(page, 'Tasks').click();
    completedToggle(page).click();
    assert.deepStrictEqual(
      (completedPart(page).children.slice(1) as FakeElement[]).map((each) => [each.tagName, each.textContent]),
      expected,
    );
  }
  const page = loadPage();
  page.send(completedPage({ state: 'failed', cause: 'Error: no such path: lib/mission_alpha/' }));
  named(page, 'Tasks').click();
  completedToggle(page).click();
  const notice = completedPart(page).children[1] as FakeElement;
  assert.ok(notice.has('notice'));
  assert.deepStrictEqual(
    (notice.children as FakeElement[]).map((each) => [each.tagName, each.textContent]),
    [
      ['p', 'The completed tasks could not be read.'],
      ['pre', 'Error: no such path: lib/mission_alpha/'],
    ],
  );
});

test('shown completed tasks stay shown through every redraw and while a chain runs, are saved nowhere, and are hidden on every load and after the failure state or the notice', () => {
  const page = loadPage();
  page.send(completedPage(COMPLETED));
  named(page, 'Tasks').click();
  completedToggle(page).click();
  page.send(completedPage({ state: 'read', tasks: [COMPLETED.tasks[1]] }));
  assert.strictEqual(completedToggle(page).textContent, 'Hide completed tasks');
  assert.deepStrictEqual(
    (completedPart(page).children[1] as FakeElement).children.map((item) => ((item as FakeElement).children[0] as FakeElement).textContent),
    ['Bare Done Task'],
    'the redrawn list is the one posted last',
  );
  page.send({ type: 'running', missions: [ALPHA] });
  assert.strictEqual(completedToggle(page).textContent, 'Hide completed tasks');
  assert.strictEqual(completedToggle(page).disabled, false, 'the control stays enabled while a chain runs');
  assert.ok(page.saved.length > 0);
  for (const state of page.saved) {
    assert.ok(!JSON.stringify(state).toLowerCase().includes('completed'), 'no shown or hidden state is saved');
  }

  const again = loadPage();
  again.send(completedPage(COMPLETED));
  named(again, 'Tasks').click();
  assert.strictEqual(completedToggle(again).textContent, 'Show completed tasks', 'a page loaded afresh opens with them hidden');
  for (const between of [{ type: 'liveFailure', cause: 'Error: no' }, { type: 'notLive', path: ALPHA }]) {
    const each = loadPage();
    each.send(completedPage(COMPLETED));
    named(each, 'Tasks').click();
    completedToggle(each).click();
    each.send(between);
    each.send(completedPage(COMPLETED));
    named(each, 'Tasks').click();
    assert.strictEqual(completedToggle(each).textContent, 'Show completed tasks', `hidden again after ${between.type}`);
  }
});

test("the Tasks pane's two part headings and the completed tasks' head line carry their stylesheet rules", () => {
  const selectors = stylesheetRules().flatMap((rule) => rule.selectors);
  for (const selector of ['.task-part + .task-part', '.task-part-heading', '.task-part-head', '.task-list .task-bar p']) {
    assert.ok(selectors.includes(selector), `the stylesheet holds ${selector}`);
  }
});

/** The buttons of the page's row of mission-wide actions, in order. */
const MISSION_ACTIONS = ['New task', 'Ask in mission context'];

/**
 * Asserts the row of mission-wide actions, New task and then Ask in mission context, each with its
 * dropdown, stands directly above the pane headers, and that neither button stands inside a pane.
 */
function assertMissionActionsAbovePanes(page: Page): void {
  const panes = page.root.all().filter((each) => each.has('panes'));
  assert.strictEqual(panes.length, 1);
  const rows = panes[0].children as FakeElement[];
  const headers = rows.findIndex((each) => each.has('pane-tabs'));
  assert.ok(headers > 0, 'a row stands above the pane headers');
  const row = rows[headers - 1];
  assert.ok(row.has('mission-actions'), 'the row directly above the headers is the row of mission-wide actions');
  assert.deepStrictEqual(
    row.all().filter((each) => each.tagName === 'button').map(shownName),
    MISSION_ACTIONS,
    'the row holds New task and Ask in mission context, in that order',
  );
  for (const label of MISSION_ACTIONS) {
    const node = named(page, label);
    assert.ok(row.all().includes(node), `${label} stands in that row`);
    for (const pane of page.root.all().filter((each) => each.has('pane'))) {
      assert.ok(!pane.all().includes(node), `${label} stands in no pane`);
      assert.ok(!pane.all().some((each) => each.textContent === label), `no pane draws ${label}`);
    }
  }
}

test('the row of mission-wide actions, New task and Ask in mission context, stands above the pane headers at every step with either pane shown, and not inside a pane', () => {
  for (const step of ['define', 'first-review', 'additional-review', 'derive', 'execute', 'follow-up', 'finish', undefined]) {
    const page = loadPage();
    page.send(pageOf(mission(ALPHA, 'Alpha', step === undefined ? {} : { step })));
    assert.strictEqual(shownPane(page), 'questions');
    assertMissionActionsAbovePanes(page);
    for (const label of MISSION_ACTIONS) {
      assert.strictEqual(named(page, label).disabled, false);
    }
    named(page, 'Tasks').click();
    assert.strictEqual(shownPane(page), 'tasks');
    assertMissionActionsAbovePanes(page);
    assert.ok(texts(page).includes('First Task'));
    named(page, 'Open questions').click();
    named(page, 'New task').click();
    assert.deepStrictEqual(page.posted.slice(-1), [{ type: 'taskButton', mission: ALPHA }]);
    named(page, 'Ask in mission context').click();
    assert.deepStrictEqual(page.posted.slice(-1), [{ type: 'askButton', mission: ALPHA }]);
  }

  // A page that opens on Open questions draws it too, and a run for the mission disables both buttons with either pane shown.
  const page = loadPage();
  page.send(liveWith('questions', [ALPHA]));
  eachPane(page, () => {
    assertMissionActionsAbovePanes(page);
    for (const label of MISSION_ACTIONS) {
      assert.strictEqual(named(page, label).disabled, true);
    }
  });
  page.send(liveWith('questions'));
  eachPane(page, () => {
    assertMissionActionsAbovePanes(page);
    for (const label of MISSION_ACTIONS) {
      assert.strictEqual(named(page, label).disabled, false);
    }
  });
});

test('a page opens on the default pane the extension posts, Open questions when none is posted', () => {
  const tasks = loadPage();
  tasks.send(liveWith('tasks'));
  assert.strictEqual(shownPane(tasks), 'tasks');
  const questions = loadPage();
  questions.send(liveWith('questions'));
  assert.strictEqual(shownPane(questions), 'questions');
  const none = loadPage();
  none.send(liveWith(undefined));
  assert.strictEqual(shownPane(none), 'questions');
});

test('with no pane clicked the page follows the default the extension posts with every redraw', () => {
  const page = loadPage();
  page.send(liveWith('questions'));
  assert.strictEqual(shownPane(page), 'questions');
  page.send(liveWith('tasks'));
  assert.strictEqual(shownPane(page), 'tasks');
});

test('a clicked pane stays selected through redraws and file-event refreshes while the page stays shown', () => {
  const page = loadPage();
  page.send(liveWith('questions'));
  named(page, 'Tasks').click();
  assert.strictEqual(shownPane(page), 'tasks');
  page.send(liveWith('questions'));
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
  named(page, 'Open questions').click();
  page.send(liveWith('tasks'));
  assert.strictEqual(shownPane(page), 'questions', 'a clicked pane outlasts a changed default');
});

test('the failure state, the no-longer-live notice, and a fresh page give way to the default, and the pane is never saved', () => {
  const page = loadPage();
  page.send(liveWith('questions'));
  named(page, 'Tasks').click();
  page.send({ type: 'liveFailure', cause: 'Error: no git' });
  page.send(liveWith('questions'));
  assert.strictEqual(shownPane(page), 'questions', 'the failure state gives way to the default');
  named(page, 'Tasks').click();
  page.send({ type: 'notLive', path: ALPHA });
  page.send(liveWith('questions'));
  assert.strictEqual(shownPane(page), 'questions', 'the no-longer-live notice gives way to the default');
  named(page, 'Tasks').click();
  page.key('ArrowRight');
  named(page, 'Open questions').click();
  page.key('ArrowRight');
  assert.ok(page.saved.length > 0);
  for (const state of page.saved) {
    assert.deepStrictEqual(Object.keys(state as object), ['positions']);
    assert.doesNotMatch(JSON.stringify(state), /tasks|questions/);
  }
  const reopened = loadPage();
  reopened.send(liveWith('questions'));
  assert.strictEqual(shownPane(reopened), 'questions');
});

test('the arrow keys move the question view only while the Open questions pane is shown', () => {
  const page = loadPage();
  page.send(liveWith('questions'));
  page.key('ArrowRight');
  assert.ok(texts(page).includes('2 / 2'));
  page.key('ArrowLeft');
  assert.ok(texts(page).includes('1 / 2'));
  named(page, 'Tasks').click();
  page.key('ArrowRight');
  assert.strictEqual(shownPane(page), 'tasks');
  named(page, 'Open questions').click();
  assert.ok(texts(page).includes('1 / 2'));
});

/** Alpha's page with three open questions, `running` the paths of the missions with a running runner. */
function threeQuestions(running: string[] = []): unknown {
  const built = mission(ALPHA, 'Alpha') as Record<string, unknown>;
  const questions = ['Pane Layout', 'Tab Order', 'Key Map'].map((id) => ({
    id,
    question: `What should ${id} be?`,
    principles: [],
    dependsOn: [],
    recommendation: { option: 'keep', rationale: 'It works.' },
    alternatives: [{ id: 'keep', text: 'Keep it.', advantages: [], drawbacks: [] }],
  }));
  return pageOf({ ...built, questions: { state: 'read', questions } }, running);
}

/** The pager's buttons and counter, in the order drawn. */
function pagerParts(page: Page): string[] {
  const pager = page.root.all().find((each) => each.has('pager'));
  assert.ok(pager !== undefined, 'the pager is drawn');
  return pager.children.filter((child): child is FakeElement => child instanceof FakeElement).map((child) => child.textContent);
}

test('the pager draws First before Previous, disabled on the first card and enabled on every other', () => {
  const page = loadPage();
  page.send(threeQuestions());
  assert.deepStrictEqual(pagerParts(page), ['First', 'Previous', '1 / 3', 'Next']);
  assert.strictEqual(named(page, 'First').disabled, true, 'First is disabled on the first card');
  assert.ok(named(page, 'First').has('control'), 'First is a push button like Previous and Next');
  named(page, 'Next').click();
  assert.strictEqual(named(page, 'First').disabled, false, 'First is enabled on the second card');
  named(page, 'Next').click();
  assert.deepStrictEqual(pagerParts(page), ['First', 'Previous', '3 / 3', 'Next']);
  assert.strictEqual(named(page, 'First').disabled, false, 'First is enabled on the last card');
});

test('First jumps straight back to the first card from any card in one click, saving the position it shows', () => {
  const page = loadPage();
  page.send(threeQuestions());
  named(page, 'Next').click();
  named(page, 'Next').click();
  assert.ok(texts(page).includes('3 / 3'));
  assert.ok(texts(page).includes('Key Map'));
  const before = page.saved.length;
  named(page, 'First').click();
  assert.ok(texts(page).includes('1 / 3'), 'one click shows the first card');
  assert.ok(texts(page).includes('Pane Layout'));
  assert.ok(!texts(page).includes('Key Map'));
  assert.strictEqual(page.saved.length, before + 1, 'the jump saves the position once, with no step through the second card');
  assert.deepStrictEqual((page.saved[page.saved.length - 1] as { positions: unknown }).positions, {
    [ALPHA]: { title: 'Pane Layout', index: 0 },
  });
  named(page, 'Next').click();
  named(page, 'First').click();
  assert.ok(texts(page).includes('1 / 3'), 'it jumps back from the second card too');
});

test('a page reopened on the position First saved shows the first card, and First stays enabled while a run is going', () => {
  const page = loadPage();
  page.send(threeQuestions());
  named(page, 'Next').click();
  named(page, 'Next').click();
  named(page, 'First').click();
  const reopened = loadScript('page.js', undefined, { dataset: { mission: ALPHA }, state: page.saved[page.saved.length - 1] });
  reopened.send(threeQuestions());
  assert.ok(texts(reopened).includes('1 / 3'), 'the saved position comes back on the first card');
  named(reopened, 'Next').click();
  reopened.send(threeQuestions([ALPHA]));
  assert.strictEqual(named(reopened, 'First').disabled, false, 'First stays enabled while a run is going');
  named(reopened, 'First').click();
  assert.ok(texts(reopened).includes('1 / 3'));
});

test('the page draws no Settings or Close settings control and no settings view, in the failure state and the notice neither', () => {
  const page = loadPage();
  page.send(alphaPage([]));
  assert.ok(!buttons(page).some((each) => ['Settings', 'Close settings'].includes(shownName(each))), 'the page draws no Settings or Close settings control');
  assert.deepStrictEqual(page.root.all().filter((each) => each.has('settings')), [], 'and no settings view');
  page.send({ type: 'liveFailure', cause: 'Error: no repository' });
  assert.ok(!buttons(page).some((each) => shownName(each) === 'Settings'));
  page.send({ type: 'notLive', path: ALPHA });
  assert.ok(!buttons(page).some((each) => shownName(each) === 'Settings'));
});

/** The mission page as drawn: every element's tag, text, class, and state, in document order. */
function pageShape(page: Page): string[] {
  return page.root.all().map((each) => `${each.tagName}|${each.textContent}|${each.className}|${each.disabled}|${each.title}`);
}

test('a harness check or settings message posted to a mission window changes nothing it draws, and every click posts as before', () => {
  const plain = loadPage();
  plain.send(alphaPage([]));
  const posted = loadPage();
  posted.send(alphaPage([]));
  const harnesses = [
    { key: 'claude', name: 'Claude Code', cli: 'claude', installed: '2.0.0', packaged: '2.0.0' },
    { key: 'codex', name: 'Codex', cli: 'codex', failed: 'cli', packaged: '2.0.0' },
  ];
  posted.send({ type: 'harnessCheck', check: { state: 'checked', harnesses } });
  posted.send({ type: 'harnessSettings', settings: { state: 'read', enabled: { claude: true, antigravity: false, codex: true } } });
  for (const page of [plain, posted]) {
    named(page, 'Tasks').click();
  }
  assert.deepStrictEqual(pageShape(posted), pageShape(plain), 'the mission page draws every recipe, button, and the looped run alike');
  assert.ok(!texts(posted).some((text) => text.includes('not found') || text.includes('Checking the harnesses')), 'nothing of the check is named on the page');
  for (const page of [plain, posted]) {
    named(page, 'Open questions').click();
  }
  assert.deepStrictEqual(pageShape(posted), pageShape(plain));
  const clicks = (page: Page): unknown[] => {
    const count = page.posted.length;
    for (const text of ['review', 'complete', 'Discuss', 'Answer', 'Answer with this alternative', 'New task', 'Ask in mission context']) {
      named(page, text).click();
    }
    return page.posted.slice(count);
  };
  assert.deepStrictEqual(clicks(posted), clicks(plain), 'every click posts as it would with nothing of the settings posted');
});

test("after a harness is disabled in the Settings window the page draws the list the extension posts: the variant gone from its dropdown and a recipe left with none gone", () => {
  const both = runnable(
    'Approve all standing recommendations and review again',
    'shipped',
    ['claude -p "/gurita:review-mission-requirements --mission <path>"'],
    [
      { name: 'Claude Code', own: false },
      { name: 'Antigravity', own: false },
    ],
  );
  const agyOnly = runnable('Gemini review', 'shipped', ['agy -p "/gurita:review-mission-requirements --mission <path>"']);
  const page = loadPage();
  page.send(pageOf(mission(ALPHA, 'Alpha', { step: 'derive', recipes: { state: 'read', recipes: [both, agyOnly] } })));
  const options = () =>
    page.root
      .all()
      .filter((each) => each.tagName === 'option')
      .map((each) => each.textContent);
  assert.deepStrictEqual(recipeNames(page), ['Approve all standing recommendations and review again', 'Gemini review']);
  assert.deepStrictEqual(options(), ['Claude Code', 'Antigravity', 'default']);
  const narrowed = runnable('Approve all standing recommendations and review again', 'shipped', (both as { lines: string[] }).lines, [{ name: 'Claude Code', own: false }]);
  page.send(pageOf(mission(ALPHA, 'Alpha', { step: 'derive', recipes: { state: 'read', recipes: [narrowed] } })));
  assert.deepStrictEqual(recipeNames(page), ['Approve all standing recommendations and review again']);
  assert.deepStrictEqual(options(), ['Claude Code'], 'the left-out variant is gone from the dropdown, and the recipe left with none with its button');
  assert.ok(texts(page).includes('Discuss'), 'the fixed-name buttons are drawn as before');
});


test("an edit the extension posts reaches the mission page's dropdown", () => {
  const page = loadPage();
  page.send(alphaPage([]));
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
  page.send(pageOf({ ...(mission(ALPHA, 'Alpha') as object), recipes: duplicated }));
  assert.deepStrictEqual(dropdown(), ['review', 'Fast']);
});

/** The push button classes, every one drawn with the one shared look. */
const PUSH_CLASSES = ['recipe', 'action', 'control'];

/** The properties that make a button's look: its fill, text colour, border, and outline. */
const LOOK = ['background', 'background-color', 'color', 'border', 'border-color', 'outline'];

test('every push button a mission window draws carries one class of the one shared look, the pane headers and dependency links keeping their own', () => {
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
  page.send(pageOf(linked));
  const seen = new Map<string, FakeElement>();
  const look = { headers: [] as string[], links: [] as string[] };
  const collect = (): void => {
    for (const each of buttons(page)) {
      const name = shownName(each);
      if (each.has('pane-tab')) {
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
  named(page, 'Tasks').click();
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
    'Start run',
    'Discuss',
    'Answer',
    'Answer with this alternative',
    'New task',
    'Ask in mission context',
    'Show completed tasks',
    'First',
    'Previous',
    'Next',
    'Close preview',
  ]) {
    assert.ok(seen.has(name), `${name} is drawn as a push button`);
  }
  assert.ok(look.headers.includes('Open questions') && look.links.includes('Tab Order'), 'the headers and links were drawn');

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
  assert.ok(!rules.some((each) => each.selectors.some((selector) => /(^|\s|\.)tabs?\b|tab-list|\.ends\b|\.starting\b/.test(selector))), 'the stylesheet holds no tab row rule');
  const headerRule = rules.find((each) => each.selectors.includes('.pane-tabs button'));
  const linkRule = rules.find((each) => each.selectors.includes('button.link'));
  for (const kept of [headerRule, linkRule]) {
    assert.ok(kept !== undefined);
    assert.strictEqual(kept.declarations.get('background'), 'none', 'the headers and links keep their unfilled look');
  }
});

const GOAL = 'Ship the `alpha` page.\n\n- First part\n- Second part';

/** Alpha's page message with `introduction` as its introduction part, `running` the paths of the missions with a running runner. */
function introductionPage(introduction: unknown, running: string[] = []): unknown {
  return pageOf({ ...(mission(ALPHA, 'Alpha') as Record<string, unknown>), introduction }, running);
}

/** The page's one introduction section. */
function introduction(page: Page): FakeElement {
  const found = page.root.all().filter((each) => each.has('introduction'));
  assert.strictEqual(found.length, 1);
  return found[0];
}

/** The introduction's goal control. */
function goalToggle(page: Page): FakeElement {
  const found = introduction(page).all().filter((each) => each.tagName === 'button');
  assert.strictEqual(found.length, 1, 'the introduction holds one control');
  return found[0];
}

/** The text a rendered node holds, its own and its children's, in order. */
function renderedText(node: FakeElement | { textContent: string }): string {
  return node instanceof FakeElement && node.children.length > 0 ? node.children.map(renderedText).join('') : node.textContent;
}

/** The introduction's goal area, while the goal is shown. */
function goalArea(page: Page): FakeElement | undefined {
  return introduction(page).all().find((each) => each.has('goal'));
}

test("the page opens on its introduction above the diagram, the mission's title alone with the goal control beside it", () => {
  const page = loadPage();
  page.send(introductionPage({ state: 'read', title: 'Alpha mission', goal: GOAL }));
  const shown = page.root.all().find((each) => each.has('page')) as FakeElement;
  assert.deepStrictEqual(
    (shown.children as FakeElement[]).slice(0, 2).map((each) => each.className),
    ['introduction', 'workflow'],
    'the introduction stands first, directly above the workflow diagram',
  );
  const head = introduction(page).children[0] as FakeElement;
  assert.ok(head.has('introduction-head'));
  assert.deepStrictEqual(
    (head.children as FakeElement[]).map((each) => [each.tagName, each.textContent]),
    [
      ['h2', 'Alpha mission'],
      ['button', 'Show goal'],
    ],
    'the title and the control stand together on the head line',
  );
  assert.strictEqual(goalToggle(page).getAttribute('aria-expanded'), 'false');
  assert.strictEqual(goalArea(page), undefined, 'the goal is hidden by default');
  assert.ok(!texts(page).some((text) => text.includes('First part')), 'no part of the goal is drawn');
});

test('the control shows the whole goal beneath the title, drawn by the text renderer, and hides it again', () => {
  const page = loadPage();
  page.send(introductionPage({ state: 'read', title: 'Alpha mission', goal: GOAL }));
  goalToggle(page).click();
  assert.strictEqual(goalToggle(page).textContent, 'Hide goal');
  assert.strictEqual(goalToggle(page).getAttribute('aria-expanded'), 'true');
  const area = goalArea(page);
  assert.ok(area !== undefined, 'the goal is shown');
  assert.strictEqual(introduction(page).children[1], area, 'the goal stands beneath the head line');
  const [paragraph, list] = area.children as FakeElement[];
  assert.strictEqual(area.children.length, 2);
  assert.strictEqual(paragraph.tagName, 'p');
  assert.deepStrictEqual(
    paragraph.children.map((child) => (child instanceof FakeElement ? [child.tagName, child.textContent] : ['text', child.textContent])),
    [
      ['text', 'Ship the '],
      ['code', 'alpha'],
      ['text', ' page.'],
    ],
  );
  assert.strictEqual(list.tagName, 'ul');
  assert.deepStrictEqual(list.children.map(renderedText), ['First part', 'Second part']);
  goalToggle(page).click();
  assert.strictEqual(goalToggle(page).textContent, 'Show goal');
  assert.strictEqual(goalToggle(page).getAttribute('aria-expanded'), 'false');
  assert.strictEqual(goalArea(page), undefined, 'the goal is hidden again');
  assert.deepStrictEqual(page.posted, [{ type: 'ready' }], 'the control posts nothing to the extension');
});

test('the control is drawn whatever the length of the goal, the whole of a long one shown with no clamp', () => {
  const long = Array.from({ length: 40 }, (_, index) => `Paragraph ${index + 1} of the goal.`).join('\n\n');
  for (const goal of ['Short.', long]) {
    const page = loadPage();
    page.send(introductionPage({ state: 'read', title: 'Alpha mission', goal }));
    assert.strictEqual(goalToggle(page).textContent, 'Show goal');
    goalToggle(page).click();
    const area = goalArea(page) as FakeElement;
    assert.strictEqual(area.children.length, goal === long ? 40 : 1, 'every paragraph of the goal is drawn');
    assert.strictEqual(area.className, 'goal', 'with no clamping class');
  }
  const rules = stylesheetRules().filter((rule) => rule.selectors.some((selector) => selector.startsWith('.introduction')));
  assert.ok(rules.length > 0);
  for (const rule of rules) {
    for (const property of ['max-height', 'height', 'overflow', 'overflow-y', '-webkit-line-clamp', 'line-clamp']) {
      assert.ok(!rule.declarations.has(property), `${rule.selectors.join(', ')} sets no ${property}`);
    }
  }
});

test('a shown goal stays shown through every redraw while the page stays shown, and is saved nowhere', () => {
  const page = loadPage();
  page.send(introductionPage({ state: 'read', title: 'Alpha mission', goal: GOAL }));
  goalToggle(page).click();
  page.send(introductionPage({ state: 'read', title: 'Alpha mission', goal: 'A revised goal.' }));
  assert.strictEqual(goalToggle(page).textContent, 'Hide goal');
  assert.deepStrictEqual(goalArea(page)?.children.map(renderedText), ['A revised goal.'], 'the redrawn goal is the one posted last');
  page.send({ type: 'running', missions: [ALPHA] });
  assert.strictEqual(goalToggle(page).textContent, 'Hide goal');
  assert.strictEqual(goalToggle(page).disabled, false, 'the control stays enabled while a chain runs');
  assert.ok(page.saved.length > 0);
  for (const state of page.saved) {
    assert.ok(!JSON.stringify(state).toLowerCase().includes('goal'), 'no shown or hidden state is saved');
  }
});

test('the goal is hidden on every load of the page and after the failure state or the notice', () => {
  const first = loadPage();
  first.send(introductionPage({ state: 'read', title: 'Alpha mission', goal: GOAL }));
  goalToggle(first).click();
  const again = loadPage();
  again.send(introductionPage({ state: 'read', title: 'Alpha mission', goal: GOAL }));
  assert.strictEqual(goalArea(again), undefined, 'a page loaded afresh opens with the goal hidden');

  for (const between of [{ type: 'liveFailure', cause: 'Error: no' }, { type: 'notLive', path: ALPHA }]) {
    const page = loadPage();
    page.send(introductionPage({ state: 'read', title: 'Alpha mission', goal: GOAL }));
    goalToggle(page).click();
    page.send(between);
    page.send(introductionPage({ state: 'read', title: 'Alpha mission', goal: GOAL }));
    assert.strictEqual(goalArea(page), undefined, `the goal is hidden again after ${between.type}`);
    assert.strictEqual(goalToggle(page).textContent, 'Show goal');
  }
});

test("the introduction falls back to the live title, and draws a missing goal's line or the requirements file's notice in the goal's place", () => {
  const page = loadPage();
  page.send(pageOf(mission(ALPHA, 'Alpha')));
  assert.strictEqual((introduction(page).all().find((each) => each.tagName === 'h2') as FakeElement).textContent, 'Alpha', 'no introduction posted: the live title');
  goalToggle(page).click();
  assert.deepStrictEqual(goalArea(page)?.children.map((child) => child.textContent), ['requirements.md holds no goal.']);

  page.send(introductionPage({ state: 'read', goal: '' }));
  assert.strictEqual((introduction(page).all().find((each) => each.tagName === 'h2') as FakeElement).textContent, 'Alpha', 'no title read: the live title');
  assert.deepStrictEqual(goalArea(page)?.children.map((child) => child.textContent), ['requirements.md holds no goal.']);

  page.send(introductionPage({ state: 'failed', notice: { file: `${ALPHA}requirements.md`, reason: 'missing' } }));
  assert.strictEqual((introduction(page).all().find((each) => each.tagName === 'h2') as FakeElement).textContent, 'Alpha');
  assert.strictEqual(goalToggle(page).textContent, 'Hide goal');
  const notice = (goalArea(page) as FakeElement).all().find((each) => each.has('notice'));
  assert.ok(notice !== undefined, "the requirements file's notice stands in the goal's place");
  assert.deepStrictEqual(notice.all().filter((each) => each.tagName === 'p').map((each) => each.textContent), [`${ALPHA}requirements.md is missing.`]);
});

test('the workflow diagram carries a heading of its own above its blocks', () => {
  const page = diagramPage({ step: 'derive' });
  const section = page.root.all().find((each) => each.has('workflow')) as FakeElement;
  const [heading, flow] = section.children as FakeElement[];
  assert.deepStrictEqual([heading.tagName, heading.textContent], ['h3', 'Workflow']);
  assert.ok(flow.has('flow'), 'the line of blocks follows the heading');
  assert.strictEqual(section.getAttribute('aria-label'), 'Workflow');
});
