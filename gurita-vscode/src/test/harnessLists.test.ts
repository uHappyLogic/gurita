import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  derivedLists,
  editHarnessList,
  harnessLists,
  harnessStates,
  isListKind,
  readHarnessLists,
  withHarnessEnabled,
  withListValueAdded,
  withListValueRemoved,
} from '../harnessSettings';
import { VariantStoreError, emptyVariantStore, parseVariantStore, readVariantStore } from '../variantStore';

const FILE = '/home/someone/.gurita/variants.json';
const SHIPPED_RECIPES = path.join(__dirname, '..', '..', 'shipped_recipes.md');

/** Lines on each harness, a shell step, the slot line, and a command the extension does not know. */
const LINES = [
  'claude -p "/gurita:review-mission-requirements --mission <path>" --model "fable" --effort xhigh;',
  'echo between;',
  'agy -p "/gurita:review-mission-requirements --mission <path>" --model "gemini-4-argon" --effort medium;',
  'claude -p "/gurita:derive-tasks --mission <path>" --model "opus" --effort high;',
  '<single-task line>',
  "codex exec '$gurita:complete-task --mission <path>' -m gpt-5.5 -c model_reasoning_effort=xhigh;",
  'codex exec "/gurita:finish-mission --mission <path>" -m gpt-5.5-mini --effort max;',
  "codex exec '$gurita:derive-tasks --mission <path>' --config model_reasoning_effort=medium;",
  'claude -p "/gurita:finish-mission --mission <path>" --model "fable" --effort medium;',
  'claude -p "/gurita:discuss-mission-goal" --model sonnet;',
  'claude -p "/gurita:ask-in-mission-context" --effort max;',
  'mytool --model hidden --effort low',
];

test('each harness has a model list and one effort list read from the lines, Codex its efforts from the model_reasoning_effort override', () => {
  assert.deepStrictEqual(derivedLists(LINES), {
    claude: { models: ['fable', 'opus', 'sonnet'], efforts: ['xhigh', 'high', 'medium', 'max'] },
    antigravity: { models: ['gemini-4-argon'], efforts: ['medium'] },
    codex: { models: ['gpt-5.5', 'gpt-5.5-mini'], efforts: ['xhigh', 'medium'] },
  }, "a Codex line's --effort is no Codex effort");
  assert.deepStrictEqual(derivedLists([]), {
    claude: { models: [], efforts: [] },
    antigravity: { models: [], efforts: [] },
    codex: { models: [], efforts: [] },
  }, 'the extension ships no list of its own');
  assert.ok(isListKind('model') && isListKind('effort') && !isListKind('models') && !isListKind(undefined));
});

test("the shipped recipe file's lines give the lists their models and efforts, Codex's from its single-task line alone", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-harness-lists-'));
  const lists = readHarnessLists(SHIPPED_RECIPES, path.join(dir, 'recipes.md'), path.join(dir, 'variants.json'));
  for (const model of ['fable', 'opus', 'sonnet']) {
    assert.ok(lists.claude.models.includes(model), model);
  }
  for (const effort of ['medium', 'high', 'xhigh']) {
    assert.ok(lists.claude.efforts.includes(effort), effort);
  }
  assert.deepStrictEqual(
    lists.antigravity,
    { models: ['claude-opus-5-5'], efforts: ['high'] },
    "Antigravity's lists come from the Antigravity single-task line alone, no shipped chain holding an agy line",
  );
  assert.deepStrictEqual(
    lists.codex,
    { models: ['gpt-6-luna'], efforts: ['high'] },
    "Codex's lists come from the Codex single-task line alone, no shipped chain or button recipe holding a codex line",
  );
});

test('an added entry follows the derived ones and a removed one leaves the offer, the overlay kept beside the enabled state', () => {
  let store = withHarnessEnabled(emptyVariantStore(), FILE, 'claude', false);
  store = withListValueAdded(store, FILE, LINES, 'claude', 'model', 'claude-sonnet-5');
  store = withListValueRemoved(store, FILE, LINES, 'claude', 'model', 'sonnet');
  store = withListValueAdded(store, FILE, LINES, 'claude', 'effort', 'low');
  store = withListValueRemoved(store, FILE, LINES, 'claude', 'effort', 'max');
  store = withListValueAdded(store, FILE, LINES, 'codex', 'model', 'gpt-5.5-codex');
  store = withListValueAdded(store, FILE, LINES, 'codex', 'effort', 'low');
  store = withListValueRemoved(store, FILE, LINES, 'codex', 'effort', 'medium');
  assert.deepStrictEqual(store.harnesses, {
    claude: { enabled: false, addedModels: ['claude-sonnet-5'], removedModels: ['sonnet'], addedEfforts: ['low'], removedEfforts: ['max'] },
    codex: { addedModels: ['gpt-5.5-codex'], addedEfforts: ['low'], removedEfforts: ['medium'] },
  });
  assert.deepStrictEqual(harnessLists(store, FILE, LINES), {
    claude: { models: ['fable', 'opus', 'claude-sonnet-5'], efforts: ['xhigh', 'high', 'medium', 'low'] },
    antigravity: { models: ['gemini-4-argon'], efforts: ['medium'] },
    codex: { models: ['gpt-5.5', 'gpt-5.5-mini', 'gpt-5.5-codex'], efforts: ['xhigh', 'low'] },
  });
  assert.deepStrictEqual(harnessStates(store, FILE), { claude: false, antigravity: true, codex: true, 'claude-desktop': true }, 'the enabled state is kept');
});

test('adding a removed derived entry takes it out of the removed ones, and removing an added entry takes it out of the added ones', () => {
  let store = withListValueRemoved(emptyVariantStore(), FILE, LINES, 'antigravity', 'model', 'gemini-4-argon');
  assert.deepStrictEqual(harnessLists(store, FILE, LINES).antigravity.models, []);
  store = withListValueAdded(store, FILE, LINES, 'antigravity', 'model', 'gemini-4-argon');
  assert.deepStrictEqual(store.harnesses, { antigravity: {} }, 'a derived entry added back needs no entry of its own');
  assert.deepStrictEqual(harnessLists(store, FILE, LINES).antigravity.models, ['gemini-4-argon']);
  store = withListValueAdded(store, FILE, LINES, 'antigravity', 'model', 'gemini-4-neon');
  store = withListValueRemoved(store, FILE, LINES, 'antigravity', 'model', 'gemini-4-neon');
  assert.deepStrictEqual(store.harnesses, { antigravity: {} }, 'an added entry removed leaves no removal behind');
  const kept = parseVariantStore(JSON.stringify({ harnesses: { claude: { models: ['opus'], enabled: true }, kept: ['as', 'read'] } }), FILE);
  const edited = withListValueAdded(kept, FILE, LINES, 'claude', 'effort', 'low');
  assert.deepStrictEqual(edited.harnesses, { claude: { models: ['opus'], enabled: true, addedEfforts: ['low'] }, kept: ['as', 'read'] });
  assert.deepStrictEqual(kept.harnesses, { claude: { models: ['opus'], enabled: true }, kept: ['as', 'read'] }, 'the store given is not changed');
});

test('a removed entry stays out of the offer when a line carries it again, and an added one carried by a line is listed once', () => {
  const store = parseVariantStore(JSON.stringify({ harnesses: { claude: { addedModels: ['opus', 'haiku'], removedModels: ['fable'] } } }), FILE);
  assert.deepStrictEqual(harnessLists(store, FILE, LINES).claude.models, ['opus', 'sonnet', 'haiku']);
});

test("an empty entry is refused, and Codex's effort overlay is laid over its derived efforts", () => {
  assert.throws(() => withListValueAdded(emptyVariantStore(), FILE, LINES, 'claude', 'model', ''), /empty model/);
  assert.throws(() => withListValueRemoved(emptyVariantStore(), FILE, LINES, 'codex', 'effort', ''), /empty effort/);
  const store = parseVariantStore(JSON.stringify({ harnesses: { codex: { addedEfforts: ['high', 'xhigh'], removedEfforts: ['medium'] } } }), FILE);
  assert.deepStrictEqual(harnessLists(store, FILE, LINES).codex, { models: ['gpt-5.5', 'gpt-5.5-mini'], efforts: ['xhigh', 'high'] });
  assert.deepStrictEqual(
    withListValueAdded(emptyVariantStore(), FILE, LINES, 'codex', 'effort', 'xhigh').harnesses,
    { codex: {} },
    'an effort a Codex line carries needs no entry of its own',
  );
});

test('an overlay field not an array of text is refused, naming the file', () => {
  for (const claude of [{ addedModels: 'opus' }, { removedEfforts: [1] }, { addedEfforts: {} }]) {
    const store = parseVariantStore(JSON.stringify({ harnesses: { claude } }), FILE);
    assert.throws(() => harnessLists(store, FILE, LINES), (error: unknown) => error instanceof VariantStoreError && error.message.includes(FILE));
    assert.throws(() => harnessStates(store, FILE), VariantStoreError);
  }
});

test('the lists are read from the shipped, own, and stored lines, and an edit is written to the variant store file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-harness-lists-'));
  const shipped = path.join(dir, 'shipped_recipes.md');
  const own = path.join(dir, 'recipes.md');
  const storeFile = path.join(dir, '.gurita', 'variants.json');
  fs.writeFileSync(
    shipped,
    '## Recipes\n\n### Review\n```\nclaude -p "/gurita:review-mission-requirements --mission <path>" --model "fable" --effort xhigh;\n```\n',
  );
  fs.writeFileSync(own, '### Mine\n```\ncodex exec "/gurita:finish-mission --mission <path>" -m gpt-5.5 -c model_reasoning_effort=high;\n```\n');
  fs.mkdirSync(path.dirname(storeFile));
  fs.writeFileSync(
    storeFile,
    JSON.stringify({
      variants: [{ recipe: 'Review', name: 'Agy', lines: ['agy -p "/gurita:review-mission-requirements --mission <path>" --model "gemini-4-neon" --effort xhigh;'] }],
      hidden: [{ recipe: 'Review', name: 'Review', origin: 'shipped' }],
    }),
  );
  assert.deepStrictEqual(readHarnessLists(shipped, own, storeFile), {
    claude: { models: ['fable'], efforts: ['xhigh'] },
    antigravity: { models: ['gemini-4-neon'], efforts: ['xhigh'] },
    codex: { models: ['gpt-5.5'], efforts: ['high'] },
  }, 'a hidden shipped variant still carries its values');
  assert.deepStrictEqual(readHarnessLists(shipped, path.join(dir, 'missing.md'), storeFile).codex, { models: [], efforts: [] }, 'a missing own file holds no line');
  editHarnessList(shipped, own, storeFile, 'antigravity', 'effort', 'add', 'low');
  editHarnessList(shipped, own, storeFile, 'claude', 'model', 'remove', 'fable');
  assert.deepStrictEqual(readHarnessLists(shipped, own, storeFile), {
    claude: { models: [], efforts: ['xhigh'] },
    antigravity: { models: ['gemini-4-neon'], efforts: ['xhigh', 'low'] },
    codex: { models: ['gpt-5.5'], efforts: ['high'] },
  });
  const written = readVariantStore(storeFile);
  assert.deepStrictEqual(written.harnesses, { antigravity: { addedEfforts: ['low'] }, claude: { removedModels: ['fable'] } });
  assert.strictEqual(written.variants.length, 1, 'the stored variants are kept');
  assert.deepStrictEqual(
    fs.readFileSync(own, 'utf8'),
    '### Mine\n```\ncodex exec "/gurita:finish-mission --mission <path>" -m gpt-5.5 -c model_reasoning_effort=high;\n```\n',
    'the own recipe file is not written',
  );
});
