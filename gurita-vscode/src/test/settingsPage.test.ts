import { test } from 'node:test';
import * as assert from 'node:assert';
import { FakeElement, Page, loadScript, stylesheetRules } from './fakePage';

// The Settings window's page script, compiled as the window loads it, run against the small
// stand-in for the DOM in `fakePage.ts`, so the drawn settings can be walked.

/** Loads the compiled script of the Settings window into a fresh page, as the window does each time it is shown. */
function loadSettings(): Page {
  return loadScript('settings.js');
}

function buttons(page: Page): FakeElement[] {
  return page.root.all().filter((each) => each.tagName === 'button');
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

/** Every text drawn on the page. */
function texts(page: Page): string[] {
  return page.root.all().map((each) => each.textContent);
}

/** The settings as the window draws them. */
function settingsView(page: Page): FakeElement | undefined {
  const drawn = page.root.all().filter((each) => each.has('settings'));
  assert.ok(drawn.length <= 1);
  return drawn[0];
}

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

/** Each harness the window lists: its key, the check that failed when one did, and its two lines of text. */
function harnessRows(page: Page): [string, string | undefined, string[]][] {
  const view = settingsView(page);
  assert.ok(view !== undefined, 'the window is drawn');
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

test('the window posts a ready message on load and shows the settings with the check running, check again disabled until a result comes', () => {
  const page = loadSettings();
  assert.deepStrictEqual(page.posted, [{ type: 'ready' }], 'every load posts one ready message, which the extension answers');
  const view = settingsView(page);
  assert.ok(view !== undefined, 'the settings are drawn');
  assert.ok(texts(page).includes('Settings'), 'under their heading');
  assert.ok(texts(page).includes('Checking the harnesses…'));
  assert.strictEqual(named(page, 'Check again').disabled, true);
  page.send({ type: 'harnessCheck', check: { state: 'running' } });
  assert.ok(texts(page).includes('Checking the harnesses…'));
  assert.strictEqual(named(page, 'Check again').disabled, true);
  page.send(CHECKED);
  assert.strictEqual(named(page, 'Check again').disabled, false, 'a result enables check again');
});

test('the window belongs to no mission and draws no close control, no tab, and no mission page, holding text, buttons, and dropdowns only', () => {
  const page = loadSettings();
  page.send(CHECKED);
  page.send(harnessSettings({ claude: true, antigravity: false, codex: true }));
  page.send(harnessListsMessage(LISTS));
  page.send(VARIANTS);
  page.send(LINES);
  assert.ok(!buttons(page).some((each) => ['Close settings', 'Settings', 'Refresh'].includes(shownName(each))), 'no close, Settings, or Refresh control');
  assert.deepStrictEqual(page.root.all().filter((each) => each.getAttribute('role') === 'tab'), [], 'no tab');
  assert.deepStrictEqual(page.root.all().filter((each) => each.has('page') || each.has('workflow')), [], 'no mission page or diagram');
  const view = settingsView(page);
  assert.ok(view !== undefined);
  assert.deepStrictEqual(
    view.all().filter((each) => ['input', 'textarea'].includes(each.tagName)),
    [],
    'nothing is typed on the window',
  );
  assert.deepStrictEqual(
    [...new Set(view.all().map((each) => each.tagName))].filter(
      (tag) => !['section', 'h3', 'h4', 'h5', 'div', 'p', 'pre', 'ul', 'li', 'span', 'code', 'button', 'select', 'option'].includes(tag),
    ),
    [],
    'the window holds text, buttons, and dropdowns only',
  );
  assert.deepStrictEqual(
    ['Harnesses', 'Models and efforts', 'Variants', 'Single-task lines'].map((heading) => texts(page).includes(heading)),
    [true, true, true, true],
    'its parts stand under their headings',
  );
});

test('the window names beside each harness the check that failed, or that every check passed', () => {
  const page = loadSettings();
  page.send(CHECKED);
  assert.deepStrictEqual(harnessRows(page), [
    ['claude', undefined, ['Claude Code', 'Every check passes: Gurita 2.0.0 is installed, the packaged version.']],
    ['antigravity', 'version', ['Antigravity', 'Installed version older than the packaged one: installed 1.9.0, packaged 2.0.0.']],
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
    ['codex', 'version', ['Codex', 'Installed version older than the packaged one: installed unknown, packaged 2.0.0.']],
  ]);
  page.send({
    type: 'harnessCheck',
    check: {
      state: 'checked',
      harnesses: [
        { key: 'claude', name: 'Claude Code', cli: 'claude', installed: '2.1.0', packaged: '2.0.0' },
        { key: 'antigravity', name: 'Antigravity', cli: 'agy', installed: '2.0.0', packaged: '2.0.0' },
        { key: 'codex', name: 'Codex', cli: 'codex', failed: 'version', installed: '1.9.0', packaged: '2.0.0' },
      ],
    },
  });
  assert.deepStrictEqual(harnessRows(page), [
    ['claude', undefined, ['Claude Code', 'Every check passes: Gurita 2.1.0 is installed, newer than the packaged 2.0.0.']],
    ['antigravity', undefined, ['Antigravity', 'Every check passes: Gurita 2.0.0 is installed, the packaged version.']],
    ['codex', 'version', ['Codex', 'Installed version older than the packaged one: installed 1.9.0, packaged 2.0.0.']],
  ]);
});

/** Each harness the window lists: its key, and the scopes line drawn for it, or undefined without one. */
function harnessScopeLines(page: Page): [string, string | undefined][] {
  const view = settingsView(page);
  assert.ok(view !== undefined, 'the window is drawn');
  return view
    .all()
    .filter((each) => each.tagName === 'li' && each.dataset.harness !== undefined)
    .map((each) => [each.dataset.harness as string, each.all().find((child) => child.has('harness-scopes'))?.textContent]);
}

test("the window names Claude Code's detected scopes, the one in effect first with the winner's version alone, and a disabled winner's scope marked disabled", () => {
  const page = loadSettings();
  const send = (claude: Record<string, unknown>) =>
    page.send({
      type: 'harnessCheck',
      check: {
        state: 'checked',
        harnesses: [
          { key: 'claude', name: 'Claude Code', cli: 'claude', packaged: '2.0.0', ...claude },
          { key: 'antigravity', name: 'Antigravity', cli: 'agy', installed: '2.0.0', packaged: '2.0.0' },
          { key: 'codex', name: 'Codex', cli: 'codex', failed: 'cli', packaged: '2.0.0' },
        ],
      },
    });
  send({ installed: '2.0.0', scopes: ['user'] });
  assert.deepStrictEqual(harnessScopeLines(page), [
    ['claude', 'In effect at user scope.'],
    ['antigravity', undefined],
    ['codex', undefined],
  ]);
  assert.deepStrictEqual(harnessRows(page)[0], ['claude', undefined, ['Claude Code', 'Every check passes: Gurita 2.0.0 is installed, the packaged version.']]);

  send({ installed: '2.1.0', scopes: ['local', 'project', 'user'] });
  assert.deepStrictEqual(harnessScopeLines(page)[0], ['claude', 'In effect at local scope; also installed at project and user scopes.']);
  const drawn = texts(page).join('\n');
  assert.ok(drawn.includes('2.1.0'), "the winner's version is shown");
  assert.strictEqual(drawn.split('2.1.0').length - 1, 1, 'one version is shown, once');
  send({ failed: 'version', installed: '1.9.0', scopes: ['project', 'user'] });
  assert.deepStrictEqual(harnessScopeLines(page)[0], ['claude', 'In effect at project scope; also installed at user scope.']);

  send({ failed: 'plugin', scopes: ['local', 'user'], disabled: true });
  assert.deepStrictEqual(harnessRows(page)[0], [
    'claude',
    'plugin',
    [
      'Claude Code',
      'Gurita plugin disabled: the copy in effect is disabled and must be enabled in Claude Code itself, through its /plugin menu or claude plugin enable.',
    ],
  ]);
  assert.deepStrictEqual(harnessScopeLines(page)[0], ['claude', 'In effect at local scope, disabled; also installed at user scope.']);
  const disabled = settingsView(page)?.all().find((each) => each.has('harness-scopes'));
  assert.ok(disabled?.has('disabled'), 'the scopes line is marked disabled');
  assert.strictEqual(disabled?.dataset.scopes, 'local user');

  send({ failed: 'plugin' });
  assert.deepStrictEqual(harnessScopeLines(page)[0], ['claude', undefined], 'no copy detected, no scope named');
  assert.deepStrictEqual(harnessRows(page)[0], ['claude', 'plugin', ['Claude Code', 'Gurita plugin not installed.']]);
});

test('the window says a disabled Antigravity or Codex copy must be enabled in the harness itself, and draws no control to enable it', () => {
  const page = loadSettings();
  const send = (antigravity: Record<string, unknown>, codex: Record<string, unknown>) =>
    page.send({
      type: 'harnessCheck',
      check: {
        state: 'checked',
        harnesses: [
          { key: 'claude', name: 'Claude Code', cli: 'claude', installed: '2.0.0', packaged: '2.0.0', scopes: ['user'] },
          { key: 'antigravity', name: 'Antigravity', cli: 'agy', packaged: '2.0.0', ...antigravity },
          { key: 'codex', name: 'Codex', cli: 'codex', packaged: '2.0.0', ...codex },
        ],
      },
    });
  const drawnButtons = () => buttons(page).map(shownName);
  send({}, {});
  const before = drawnButtons();
  send({ failed: 'plugin', disabled: true }, { failed: 'plugin', disabled: true });
  assert.deepStrictEqual(harnessRows(page).slice(1), [
    ['antigravity', 'plugin', ['Antigravity', 'Gurita plugin disabled: the copy is disabled and must be enabled in Antigravity itself, with agy plugin enable gurita.']],
    ['codex', 'plugin', ['Codex', 'Gurita plugin disabled: the copy is disabled and must be enabled in Codex itself, through its own plugin settings.']],
  ]);
  assert.deepStrictEqual(harnessScopeLines(page).slice(1), [
    ['antigravity', undefined],
    ['codex', undefined],
  ], 'no scopes line for a harness with no scopes');
  assert.deepStrictEqual(updateControls(page).map(([harness]) => harness), ['claude'], 'a disabled copy loses its Update control');
  assert.deepStrictEqual(
    drawnButtons().filter((each) => each !== 'Update'),
    before.filter((each) => each !== 'Update'),
    'no enable control of its own is added for a disabled copy',
  );

  send({ failed: 'plugin' }, { failed: 'plugin', detail: 'the listing did not finish' });
  assert.deepStrictEqual(harnessRows(page).slice(1), [
    ['antigravity', 'plugin', ['Antigravity', 'Gurita plugin not installed.']],
    ['codex', 'plugin', ['Codex', 'Gurita plugin not installed: the listing did not finish']],
  ], 'not installed stays told apart from disabled');
});

/** Each harness the window lists: its key, and the other-source line and commands drawn for it, or undefined without them. */
function harnessSources(page: Page): [string, string | undefined, string | undefined][] {
  const view = settingsView(page);
  assert.ok(view !== undefined, 'the window is drawn');
  return view
    .all()
    .filter((each) => each.tagName === 'li' && each.dataset.harness !== undefined)
    .map((each) => [
      each.dataset.harness as string,
      each.all().find((child) => child.has('harness-source-line'))?.textContent,
      each.all().find((child) => child.has('harness-source-commands'))?.textContent,
    ]);
}

test('the window states the other source a Claude Code or Codex copy comes from and the commands that switch it to the distribution repository', () => {
  const page = loadSettings();
  const send = (claude: Record<string, unknown>, codex: Record<string, unknown>) =>
    page.send({
      type: 'harnessCheck',
      check: {
        state: 'checked',
        harnesses: [
          { key: 'claude', name: 'Claude Code', cli: 'claude', installed: '2.0.0', packaged: '2.0.0', scopes: ['project', 'user'], ...claude },
          { key: 'antigravity', name: 'Antigravity', cli: 'agy', installed: '2.0.0', packaged: '2.0.0' },
          { key: 'codex', name: 'Codex', cli: 'codex', packaged: '2.0.0', ...codex },
        ],
      },
    });
  const drawnButtons = () => buttons(page).map(shownName);
  send({}, { installed: '2.0.0' });
  assert.deepStrictEqual(harnessSources(page), [
    ['claude', undefined, undefined],
    ['antigravity', undefined, undefined],
    ['codex', undefined, undefined],
  ], 'the distribution repository, or no source read, draws no source');
  const before = drawnButtons();

  send(
    {
      source: {
        found: 'the directory /work/gurita',
        repository: 'uHappyLogic/gurita-claude',
        commands: [
          'claude plugin marketplace remove gurita',
          'claude plugin marketplace add uHappyLogic/gurita-claude',
          'claude plugin install gurita@gurita --scope user',
          'claude plugin install gurita@gurita --scope project',
        ],
      },
    },
    {
      failed: 'version',
      installed: '1.9.0',
      source: {
        found: 'the local directory /work/gurita/hosts/codex',
        repository: 'uHappyLogic/gurita-codex',
        commands: ['codex plugin marketplace remove gurita', 'codex plugin marketplace add uHappyLogic/gurita-codex', 'codex plugin add gurita@gurita'],
      },
    },
  );
  assert.deepStrictEqual(harnessSources(page), [
    [
      'claude',
      'The Gurita plugin comes from another source: the directory /work/gurita, not the distribution repository uHappyLogic/gurita-claude. To switch Claude Code to its distribution repository, run:',
      'claude plugin marketplace remove gurita\nclaude plugin marketplace add uHappyLogic/gurita-claude\nclaude plugin install gurita@gurita --scope user\nclaude plugin install gurita@gurita --scope project',
    ],
    ['antigravity', undefined, undefined],
    [
      'codex',
      'The Gurita plugin comes from another source: the local directory /work/gurita/hosts/codex, not the distribution repository uHappyLogic/gurita-codex. To switch Codex to its distribution repository, run:',
      'codex plugin marketplace remove gurita\ncodex plugin marketplace add uHappyLogic/gurita-codex\ncodex plugin add gurita@gurita',
    ],
  ]);
  assert.deepStrictEqual(harnessRows(page)[0], ['claude', undefined, ['Claude Code', 'Every check passes: Gurita 2.0.0 is installed, the packaged version.']], 'the status line is unchanged');
  assert.deepStrictEqual(harnessScopeLines(page)[0], ['claude', 'In effect at project scope; also installed at user scope.'], 'the scopes line is unchanged');
  const drawn = settingsView(page)?.all().filter((each) => each.has('harness-source')) ?? [];
  assert.deepStrictEqual(drawn.map((each) => each.dataset.source), ['the directory /work/gurita', 'the local directory /work/gurita/hosts/codex']);
  assert.deepStrictEqual(
    drawnButtons().filter((each) => each !== 'Update'),
    before.filter((each) => each !== 'Update'),
    'no control is added for another source',
  );
  assert.deepStrictEqual(updateControls(page), [['antigravity', false]], 'a copy from another source gets no Update control');

  const rules = stylesheetRules();
  const source = rules.filter((rule) => rule.selectors.includes('.harness-list .harness-source'));
  assert.strictEqual(source.length, 1, 'one rule lays the source out');
  assert.strictEqual(source[0].declarations.get('flex-basis'), '100%', 'the source stands on a line of its own beneath the row');
});

/** Each Update control the window draws under Harnesses: the harness it stands beside, and whether it is drawn disabled. */
function updateControls(page: Page): [string, boolean][] {
  const view = settingsView(page);
  assert.ok(view !== undefined, 'the window is drawn');
  return view
    .all()
    .filter((each) => each.tagName === 'li' && each.dataset.harness !== undefined)
    .flatMap((row) =>
      row
        .all()
        .filter((each) => each.tagName === 'button' && each.textContent === 'Update')
        .map((each): [string, boolean] => {
          assert.strictEqual(each.dataset.harness, row.dataset.harness, 'the control names the harness of its row');
          return [row.dataset.harness as string, each.disabled];
        }),
    );
}

/** The Update control drawn beside the harness `key`. */
function updateControl(page: Page, key: string): FakeElement {
  const found = buttons(page).filter((each) => each.textContent === 'Update' && each.dataset.harness === key);
  assert.strictEqual(found.length, 1, `one Update control beside ${key}`);
  return found[0];
}

test('an Update control is drawn for every harness whose check found its CLI and an installed copy, whatever its version, and none for a missing CLI, no copy, a disabled copy, or a copy from another source', () => {
  const page = loadSettings();
  const send = (claude: Record<string, unknown>, antigravity: Record<string, unknown>, codex: Record<string, unknown>) =>
    page.send({
      type: 'harnessCheck',
      check: {
        state: 'checked',
        harnesses: [
          { key: 'claude', name: 'Claude Code', cli: 'claude', packaged: '2.0.0', ...claude },
          { key: 'antigravity', name: 'Antigravity', cli: 'agy', packaged: '2.0.0', ...antigravity },
          { key: 'codex', name: 'Codex', cli: 'codex', packaged: '2.0.0', ...codex },
        ],
      },
    });
  assert.deepStrictEqual(updateControls(page), [], 'none while no check result is posted');
  page.send({ type: 'harnessCheck', check: { state: 'running' } });
  assert.deepStrictEqual(updateControls(page), [], 'none while the check runs');

  send({ installed: '2.0.0', scopes: ['user'] }, { installed: '2.1.0' }, { failed: 'version', installed: '1.9.0' });
  assert.deepStrictEqual(
    updateControls(page),
    [
      ['claude', false],
      ['antigravity', false],
      ['codex', false],
    ],
    'the same enabled control for the packaged version, a newer one, and an older one',
  );
  assert.strictEqual(updateControl(page, 'claude').title, 'Update the Gurita plugin on Claude Code to the latest published release at user scope');
  assert.strictEqual(updateControl(page, 'antigravity').title, 'Update the Gurita plugin on Antigravity to the latest published release');
  assert.ok(updateControl(page, 'codex').has('action'), 'drawn with the shared push button look');
  assert.deepStrictEqual(
    harnessRows(page).map(([, , lines]) => lines[1]),
    [
      'Every check passes: Gurita 2.0.0 is installed, the packaged version.',
      'Every check passes: Gurita 2.1.0 is installed, newer than the packaged 2.0.0.',
      'Installed version older than the packaged one: installed 1.9.0, packaged 2.0.0.',
    ],
    'the check line still says whether the versions differ',
  );

  send({ failed: 'cli' }, { failed: 'plugin' }, { failed: 'plugin', detail: 'the listing did not finish' });
  assert.deepStrictEqual(updateControls(page), [], 'none for a CLI not found or no copy installed');

  send({ failed: 'plugin', scopes: ['local', 'user'], disabled: true }, { failed: 'plugin', disabled: true }, { failed: 'plugin', disabled: true });
  assert.deepStrictEqual(updateControls(page), [], 'none for a disabled copy, Claude Code\'s winning one included');

  const other = (repository: string) => ({ found: 'the directory /work/gurita', repository, commands: ['remove', 'add', 'install'] });
  send(
    { installed: '2.0.0', scopes: ['user'], source: other('uHappyLogic/gurita-claude') },
    { installed: '2.0.0' },
    { installed: '2.0.0', source: other('uHappyLogic/gurita-codex') },
  );
  assert.deepStrictEqual(updateControls(page), [['antigravity', false]], 'none for a copy from another source');

  page.send({ type: 'harnessCheck', check: { state: 'failed', cause: 'python3: not found' } });
  assert.deepStrictEqual(updateControls(page), [], 'none when the check could not run');
});

test('a click on Update posts the update at once, on Claude Code over every detected scope, and the control is drawn disabled while an install or update run is going', () => {
  const page = loadSettings();
  page.send({
    type: 'harnessCheck',
    check: {
      state: 'checked',
      harnesses: [
        { key: 'claude', name: 'Claude Code', cli: 'claude', installed: '2.0.0', packaged: '2.0.0', scopes: ['local', 'user', 'project'] },
        { key: 'antigravity', name: 'Antigravity', cli: 'agy', failed: 'version', installed: '1.9.0', packaged: '2.0.0' },
        { key: 'codex', name: 'Codex', cli: 'codex', installed: '2.0.0', packaged: '2.0.0' },
      ],
    },
  });
  assert.strictEqual(
    updateControl(page, 'claude').title,
    'Update the Gurita plugin on Claude Code to the latest published release at user, project and local scopes',
  );
  for (const [key, posted] of [
    ['claude', { type: 'runPlugin', harness: 'claude', action: 'update', scopes: ['user', 'project', 'local'] }],
    ['antigravity', { type: 'runPlugin', harness: 'antigravity', action: 'update' }],
    ['codex', { type: 'runPlugin', harness: 'codex', action: 'update' }],
  ] as const) {
    const count = page.posted.length;
    updateControl(page, key).click();
    assert.deepStrictEqual(page.posted.slice(count), [posted], `one click on ${key}'s Update posts the update, asking nothing first`);
  }

  page.send({ type: 'pluginRun', run: { harness: 'codex', action: 'update', scopes: [] } });
  assert.deepStrictEqual(
    updateControls(page),
    [
      ['claude', true],
      ['antigravity', true],
      ['codex', true],
    ],
    'every Update control is drawn disabled while a run is going',
  );
  page.send({ type: 'pluginRun', run: { harness: 'claude', action: 'install', scopes: ['project'] } });
  assert.ok(updateControls(page).every(([, disabled]) => disabled), 'an install going disables them too');
  page.send({ type: 'pluginRun', run: null });
  assert.ok(updateControls(page).every(([, disabled]) => !disabled), 'enabled again once no run goes');
});

/** Each Install control the window draws under Harnesses: the harness it stands beside, and whether it is drawn disabled. */
function installControls(page: Page): [string, boolean][] {
  const view = settingsView(page);
  assert.ok(view !== undefined, 'the window is drawn');
  return view
    .all()
    .filter((each) => each.tagName === 'li' && each.dataset.harness !== undefined)
    .flatMap((row) =>
      row
        .all()
        .filter((each) => each.tagName === 'button' && each.textContent === 'Install')
        .map((each): [string, boolean] => {
          assert.strictEqual(each.dataset.harness, row.dataset.harness, 'the control names the harness of its row');
          return [row.dataset.harness as string, each.disabled];
        }),
    );
}

/** The Install control drawn beside the harness `key`. */
function installControl(page: Page, key: string): FakeElement {
  const found = buttons(page).filter((each) => each.textContent === 'Install' && each.dataset.harness === key);
  assert.strictEqual(found.length, 1, `one Install control beside ${key}`);
  return found[0];
}

/** Posts a harness check of the three outcomes given, each laid over its harness's key, name, CLI, and the packaged 2.0.0. */
function sendOutcomes(page: Page, claude: Record<string, unknown>, antigravity: Record<string, unknown>, codex: Record<string, unknown>): void {
  page.send({
    type: 'harnessCheck',
    check: {
      state: 'checked',
      harnesses: [
        { key: 'claude', name: 'Claude Code', cli: 'claude', packaged: '2.0.0', ...claude },
        { key: 'antigravity', name: 'Antigravity', cli: 'agy', packaged: '2.0.0', ...antigravity },
        { key: 'codex', name: 'Codex', cli: 'codex', packaged: '2.0.0', ...codex },
      ],
    },
  });
}

/** The scopes Claude Code's Install control posts, read by clicking it. */
function postedInstallScopes(page: Page): unknown {
  const count = page.posted.length;
  installControl(page, 'claude').click();
  const posted = page.posted.slice(count) as { scopes?: unknown }[];
  assert.strictEqual(posted.length, 1);
  return posted[0].scopes;
}

test('an Install control is drawn for Antigravity or Codex holding no copy and for Claude Code while a scope holds no applying copy, and none for a missing CLI, a disabled Antigravity or Codex copy, or a copy from another source', () => {
  const page = loadSettings();
  page.send({ type: 'workspace', folderOpen: true });
  assert.deepStrictEqual(installControls(page), [], 'none while no check result is posted');
  page.send({ type: 'harnessCheck', check: { state: 'running' } });
  assert.deepStrictEqual(installControls(page), [], 'none while the check runs');

  sendOutcomes(page, { failed: 'plugin' }, { failed: 'plugin' }, { failed: 'plugin' });
  assert.deepStrictEqual(
    installControls(page),
    [
      ['claude', false],
      ['antigravity', false],
      ['codex', false],
    ],
    'every harness holding no copy is offered an install',
  );
  assert.deepStrictEqual(postedInstallScopes(page), ['user', 'project', 'local'], 'Claude Code holding no copy offers all three scopes');
  assert.strictEqual(
    installControl(page, 'claude').title,
    'Install the Gurita plugin on Claude Code from the latest published release at the scope you pick of user, project and local',
  );
  assert.strictEqual(installControl(page, 'antigravity').title, 'Install the Gurita plugin on Antigravity from the latest published release');
  assert.ok(installControl(page, 'codex').has('action'), 'drawn with the shared push button look');

  sendOutcomes(page, { installed: '2.0.0', scopes: ['project', 'user'] }, { installed: '2.0.0' }, { failed: 'version', installed: '1.9.0' });
  assert.deepStrictEqual(installControls(page), [['claude', false]], 'an installed Antigravity or Codex copy is offered no install, Claude Code still one at its free scope');
  assert.deepStrictEqual(postedInstallScopes(page), ['local'], 'a scope more specific than the copy in effect is offered');
  assert.strictEqual(installControl(page, 'claude').title, 'Install the Gurita plugin on Claude Code from the latest published release at local scope');

  sendOutcomes(page, { installed: '2.0.0', scopes: ['local'] }, { failed: 'cli' }, { failed: 'cli' });
  assert.deepStrictEqual(postedInstallScopes(page), ['user', 'project'], 'scopes less specific than the copy in effect are offered');
  assert.deepStrictEqual(installControls(page), [['claude', false]], 'none for a CLI not found');

  sendOutcomes(page, { installed: '2.0.0', scopes: ['local', 'project', 'user'] }, { failed: 'plugin', disabled: true }, { failed: 'plugin', disabled: true });
  assert.deepStrictEqual(installControls(page), [], 'none when every Claude Code scope holds a copy, nor for a disabled Antigravity or Codex copy');

  sendOutcomes(page, { failed: 'plugin', scopes: ['project'], disabled: true }, { failed: 'plugin' }, { failed: 'plugin' });
  assert.deepStrictEqual(postedInstallScopes(page), ['user', 'local'], "a disabled Claude Code copy's scope counts as held");

  const other = (repository: string) => ({ found: 'the directory /work/gurita', repository, commands: ['remove', 'add'] });
  sendOutcomes(page, { failed: 'plugin', source: other('uHappyLogic/gurita-claude') }, { failed: 'plugin' }, { failed: 'plugin', source: other('uHappyLogic/gurita-codex') });
  assert.deepStrictEqual(installControls(page), [['antigravity', false]], 'none for a copy or marketplace from another source');

  sendOutcomes(page, { failed: 'plugin', detail: 'the listing did not finish' }, { failed: 'plugin', detail: 'agy failed' }, { failed: 'plugin' });
  assert.deepStrictEqual(installControls(page), [['codex', false]], 'none for a listing that could not be read');

  page.send({ type: 'harnessCheck', check: { state: 'failed', cause: 'python3: not found' } });
  assert.deepStrictEqual(installControls(page), [], 'none when the check could not run');
  assert.ok(!buttons(page).some((each) => /uninstall|remove/i.test(each.textContent)), 'the window draws no uninstall control');
});

test('with no workspace folder open Claude Code is offered an install at user scope alone, and none while user holds a copy', () => {
  const page = loadSettings();
  page.send({ type: 'workspace', folderOpen: false });
  sendOutcomes(page, { failed: 'plugin' }, { failed: 'cli' }, { failed: 'cli' });
  assert.deepStrictEqual(postedInstallScopes(page), ['user'], 'user alone is offered');
  assert.strictEqual(installControl(page, 'claude').title, 'Install the Gurita plugin on Claude Code from the latest published release at user scope');
  assert.ok(!texts(page).some((text) => /project|local/.test(text) && text.includes('scope')), 'nothing on the page names project or local');
  sendOutcomes(page, { installed: '2.0.0', scopes: ['user'] }, { failed: 'cli' }, { failed: 'cli' });
  assert.deepStrictEqual(installControls(page), [], 'none while user holds a copy');
  page.send({ type: 'workspace', folderOpen: true });
  assert.deepStrictEqual(postedInstallScopes(page), ['project', 'local'], 'project and local are offered once a folder is open');
});

test('a click on Install posts the install at once, on Claude Code with the scopes on offer, and the control is drawn disabled while an install or update run is going', () => {
  const page = loadSettings();
  page.send({ type: 'workspace', folderOpen: true });
  sendOutcomes(page, { installed: '2.0.0', scopes: ['user'] }, { failed: 'plugin' }, { failed: 'plugin' });
  for (const [key, posted] of [
    ['claude', { type: 'installPlugin', harness: 'claude', scopes: ['project', 'local'] }],
    ['antigravity', { type: 'installPlugin', harness: 'antigravity' }],
    ['codex', { type: 'installPlugin', harness: 'codex' }],
  ] as const) {
    const count = page.posted.length;
    installControl(page, key).click();
    assert.deepStrictEqual(page.posted.slice(count), [posted], `one click on ${key}'s Install posts the install, asking nothing on the page first`);
  }

  page.send({ type: 'pluginRun', run: { harness: 'codex', action: 'update', scopes: [] } });
  assert.deepStrictEqual(
    installControls(page),
    [
      ['claude', true],
      ['antigravity', true],
      ['codex', true],
    ],
    'every Install control is drawn disabled while a run is going',
  );
  page.send({ type: 'pluginRun', run: { harness: 'claude', action: 'install', scopes: ['project'] } });
  assert.ok(installControls(page).every(([, disabled]) => disabled), 'an install going disables them too');
  page.send({ type: 'pluginRun', run: null });
  assert.ok(installControls(page).every(([, disabled]) => !disabled), 'enabled again once no run goes');
});

test("the window's check again control asks for the check afresh, and a check that could not run shows its cause", () => {
  const page = loadSettings();
  page.send({ type: 'harnessCheck', check: { state: 'failed', cause: 'python3: not found' } });
  assert.ok(texts(page).includes('The harness check could not be run.'));
  assert.ok(texts(page).includes('python3: not found'));
  const again = named(page, 'Check again');
  assert.strictEqual(again.disabled, false);
  const count = page.posted.length;
  again.click();
  assert.deepStrictEqual(page.posted.slice(count), [{ type: 'checkHarnesses' }]);
});

test('while the extension posts an install or update run as going, the window names it and draws check again disabled, until it posts that none is', () => {
  const page = loadSettings();
  page.send(CHECKED);
  assert.strictEqual(named(page, 'Check again').disabled, false);
  assert.deepStrictEqual(page.root.all().filter((each) => each.has('plugin-run')), [], 'no run is named while none goes');
  page.send({ type: 'pluginRun', run: { harness: 'claude', action: 'install', scopes: ['project'] } });
  assert.strictEqual(named(page, 'Check again').disabled, true, 'check again is disabled while the run goes');
  const going = page.root.all().filter((each) => each.has('plugin-run'));
  assert.deepStrictEqual(
    going.map((each) => [each.dataset.harness, each.textContent]),
    [['claude', 'Installing the Gurita plugin on Claude Code… Its terminal shows the run.']],
  );
  page.send({ type: 'harnessCheck', check: { state: 'running' } });
  page.send(CHECKED);
  assert.strictEqual(named(page, 'Check again').disabled, true, 'a check result posted meanwhile leaves it disabled');
  page.send({ type: 'pluginRun', run: { harness: 'codex', action: 'update', scopes: [] } });
  assert.ok(texts(page).includes('Updating the Gurita plugin on Codex… Its terminal shows the run.'));
  page.send({ type: 'pluginRun', run: null });
  assert.strictEqual(named(page, 'Check again').disabled, false, 'check again is enabled once no run goes');
  assert.deepStrictEqual(page.root.all().filter((each) => each.has('plugin-run')), []);
});

/** Each harness's enabled state as the extension posts it. */
function harnessSettings(enabled: Record<string, boolean>): unknown {
  return { type: 'harnessSettings', settings: { state: 'read', enabled } };
}

/** Each harness the window lists: its key, the state it shows, and its control's label, or undefined without one. */
function enabledRows(page: Page): [string, string | undefined, string | undefined][] {
  const view = settingsView(page);
  assert.ok(view !== undefined, 'the window is drawn');
  return view
    .all()
    .filter((each) => each.tagName === 'li' && each.dataset.harness !== undefined)
    .map((each) => [
      each.dataset.harness as string,
      each.all().find((child) => child.has('harness-state'))?.textContent,
      each
        .all()
        .find((child) => child.has('harness-enabled'))
        ?.all()
        .find((child) => child.tagName === 'button')?.textContent,
    ]);
}

/** The enable or disable control of the harness `key` in the window. */
function harnessToggle(page: Page, key: string): FakeElement {
  const found = page.root.querySelector(`[data-focus="harness-${key}"]`);
  assert.ok(found !== null, `no control for ${key}`);
  return found;
}

test('the window shows each harness enabled with its disable control, whatever its check reports or while it runs', () => {
  const page = loadSettings();
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
  const page = loadSettings();
  page.send(harnessSettings({ claude: true, antigravity: false, codex: true }));
  assert.deepStrictEqual(enabledRows(page), [
    ['claude', 'Enabled', 'Disable'],
    ['antigravity', 'Disabled', 'Enable'],
    ['codex', 'Enabled', 'Disable'],
  ]);
  assert.strictEqual(harnessToggle(page, 'codex').title, "Leave every variant with a line on Codex out of the mission pages' action lists");
  assert.strictEqual(harnessToggle(page, 'antigravity').title, 'List the variants with a line on Antigravity on the mission pages again');
  const count = page.posted.length;
  harnessToggle(page, 'codex').click();
  assert.deepStrictEqual(page.posted.slice(count), [{ type: 'setHarnessEnabled', harness: 'codex', enabled: false }]);
  assert.deepStrictEqual(enabledRows(page)[2], ['codex', 'Enabled', 'Disable'], 'nothing changes until the extension posts it');
  page.send(harnessSettings({ claude: true, antigravity: false, codex: false }));
  assert.deepStrictEqual(enabledRows(page)[2], ['codex', 'Disabled', 'Enable']);
  harnessToggle(page, 'antigravity').click();
  assert.deepStrictEqual(page.posted.slice(count + 1), [{ type: 'setHarnessEnabled', harness: 'antigravity', enabled: true }]);
});

test('harness settings that could not be read are named in the window, with no control drawn', () => {
  const page = loadSettings();
  page.send({ type: 'harnessSettings', settings: { state: 'failed', cause: 'The variant store /home/x/.gurita/variants.json is not JSON.' } });
  assert.ok(texts(page).includes('The harness settings could not be read.'));
  assert.ok(texts(page).includes('The variant store /home/x/.gurita/variants.json is not JSON.'));
  assert.deepStrictEqual(enabledRows(page), [
    ['claude', undefined, undefined],
    ['antigravity', undefined, undefined],
    ['codex', undefined, undefined],
  ]);
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

/** Each harness's lists the window draws: its key, then each list's kind and its entries, in order. */
function listRows(page: Page): [string, [string, string[]][]][] {
  const view = settingsView(page);
  assert.ok(view !== undefined, 'the window is drawn');
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

/** The control in the window whose focus key is `key`. */
function focused(page: Page, key: string): FakeElement {
  const found = page.root.querySelector(`[data-focus="${key}"]`);
  assert.ok(found !== null, `no control ${key}`);
  return found;
}

test("the window draws each harness's model list and effort list, Codex its model list alone, each entry with a remove control and each list with an add control", () => {
  const page = loadSettings();
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
  const page = loadSettings();
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
});

test('lists that could not be read are named in the window, with no list drawn', () => {
  const page = loadSettings();
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

/** Each recipe the window's Variants part draws: its name, then each variant's texts and its controls' labels. */
function variantEditRows(page: Page): [string, [string[], string[]][]][] {
  const view = settingsView(page);
  assert.ok(view !== undefined, 'the window is drawn');
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

test('the window lists every recipe the extension posts with its variants, each with its edit controls, and a deleted one with its reset alone', () => {
  const page = loadSettings();
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
    texts(page).includes('Run by a button outside the action list, which runs this default until another variant is selected beside it.'),
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
  const page = loadSettings();
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
});

test('variants that could not be read are named in the window, with no control drawn', () => {
  const page = loadSettings();
  page.send({ type: 'variants', variants: { state: 'failed', cause: 'The variant store /home/x/.gurita/variants.json is not JSON.' } });
  assert.ok(texts(page).includes('The variants could not be read.'));
  assert.ok(texts(page).includes('The variant store /home/x/.gurita/variants.json is not JSON.'));
  assert.deepStrictEqual(variantEditRows(page), []);
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

/** Each line the window's line editor draws: its texts, then each dropdown's class, its options, and the one it stands on. */
function lineRows(page: Page): [string[], [string, string[], string | undefined][]][] {
  const view = settingsView(page);
  assert.ok(view !== undefined, 'the window is drawn');
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
  const page = loadSettings();
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
  const page = loadSettings();
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
  const page = loadSettings();
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

/** The hover text of each skill row the window draws, the line as written, or null for a line drawn as its text. */
function lineHovers(page: Page): (string | null)[] {
  const view = settingsView(page);
  assert.ok(view !== undefined, 'the window is drawn');
  return view
    .all()
    .filter((each) => each.has('variant-line'))
    .map((each) => each.all().find((part) => part.has('line-label'))?.title ?? null);
}

const INTERACTIVE_LINE = 'claude "/gurita:recommend-all-open-questions --mission <path>" --model "fable" --effort xhigh; # interactive';
const AGY_INTERACTIVE_LINE = 'agy -i "/gurita:complete-all-tasks --mission <path>" --model "claude-opus-5-5" --effort high; # interactive';

test("a line running a gurita: skill is drawn as the skill's bare name, an interactive mark where it is not headless, the line in its hover text, and its harness and dropdowns on the right", () => {
  const page = loadSettings();
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

/** The window's Single-task lines part. */
function linesPart(page: Page): FakeElement {
  const view = settingsView(page);
  assert.ok(view !== undefined, 'the window is drawn');
  const part = view.all().find((each) => each.has('line-edits'));
  assert.ok(part !== undefined, 'the view holds a single-task lines part');
  return part;
}

/** Each line the window's Single-task lines part draws: its name, its own controls' labels, and its variants as `singleLineRows` reads them. */
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

/** Each variant row the window's Single-task lines part draws, across every line. */
function singleLineRows(page: Page): [string[], string[], string[]][] {
  return singleLines(page).flatMap((line) => line[2]);
}

test("the window lists every named single-task line under its name, its default and customs beneath it with a recipe variant's controls, a deleted one with its reset alone", () => {
  const page = loadSettings();
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
  const page = loadSettings();
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

test('single-task lines that could not be read are named in the window, with no control drawn', () => {
  const page = loadSettings();
  page.send({ type: 'singleTaskLines', lines: { state: 'failed', cause: 'The variant store /home/x/.gurita/variants.json is not JSON.' } });
  assert.ok(texts(page).includes('The single-task lines could not be read.'));
  assert.ok(texts(page).includes('The variant store /home/x/.gurita/variants.json is not JSON.'));
  assert.deepStrictEqual(singleLines(page), []);
});

/** The push button classes, every one drawn with the one shared look. */
const PUSH_CLASSES = ['recipe', 'action', 'control'];

test('every push button the window draws carries one class of the one shared look', () => {
  const page = loadSettings();
  page.send(CHECKED);
  page.send(harnessSettings({ claude: true, antigravity: false, codex: true }));
  page.send(harnessListsMessage(LISTS));
  page.send(VARIANTS);
  page.send(LINES);
  const seen = new Set<string>();
  for (const each of buttons(page)) {
    const name = shownName(each);
    assert.strictEqual(PUSH_CLASSES.filter((kind) => each.has(kind)).length, 1, `${name} carries exactly one push button class`);
    seen.add(name);
  }
  for (const name of ['Duplicate', 'Rename', 'Delete', 'Make default', 'Reset', 'Disable', 'Enable', 'Remove', 'Add model', 'Add effort', 'Check again', 'Install', 'Update']) {
    assert.ok(seen.has(name), `${name} is drawn as a push button`);
  }
  const rules = stylesheetRules();
  const push = PUSH_CLASSES.map((kind) => `button.${kind}`);
  const shared = rules.filter((rule) => push.every((selector) => rule.selectors.includes(selector)) && rule.declarations.has('background'));
  assert.strictEqual(shared.length, 1, 'one rule gives every push button class its look, the one the pane draws with');
  assert.ok(!rules.some((rule) => rule.selectors.some((selector) => selector.includes('aria-pressed'))), 'no control is drawn pressed');
});

test('each variant under Variants and Single-task lines, the deleted ones included, is drawn as a card of its own, indented under its heading with a line down its left edge and space between cards', () => {
  const page = loadSettings();
  page.send(VARIANTS);
  page.send(LINES);
  const view = settingsView(page);
  assert.ok(view !== undefined, 'the window is drawn');
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
