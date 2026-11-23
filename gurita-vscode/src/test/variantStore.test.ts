import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { singleTaskLines } from '../loop';
import {
  Recipe,
  buttonRecipe,
  defaultVariant,
  mergeRecipes,
  overlayVariantStore,
  pageRecipes,
  parseOwnRecipes,
  parseShippedRecipes,
  readRecipes,
  variantOrigin,
} from '../recipes';
import {
  DEFAULT_VARIANT_STORE_FILE,
  VariantStoreError,
  emptyVariantStore,
  parseVariantStore,
  readVariantStore,
  serializeVariantStore,
  variantStoreFile,
} from '../variantStore';

const FIXTURES = path.join(__dirname, '..', '..', 'src', 'test', 'fixtures', 'recipes');
const SHIPPED = path.join(FIXTURES, 'shipped.md');
const OWN = path.join(FIXTURES, 'own.md');
const STORE = path.join(FIXTURES, 'store.json');

function merged(): Recipe[] {
  return mergeRecipes(parseShippedRecipes(fs.readFileSync(SHIPPED, 'utf8'), SHIPPED), parseOwnRecipes(fs.readFileSync(OWN, 'utf8'), OWN));
}

function byName(recipes: Recipe[], name: string): Recipe {
  const found = recipes.find((recipe) => recipe.name === name);
  assert.ok(found, `no recipe named ${name}`);
  return found;
}

/** Each recipe's group, name, and variants, each variant by its name and where it comes from. */
function outline(recipes: Recipe[]): [string, string, [string, string][]][] {
  return recipes.map((recipe) => [recipe.group, recipe.name, recipe.variants.map((variant): [string, string] => [variant.name, variantOrigin(variant)])]);
}

/** A temporary store file holding `text`, removed by the caller through the returned directory. */
function tempStore(text: string): { dir: string; file: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-variant-store-'));
  const file = path.join(dir, 'variants.json');
  fs.writeFileSync(file, text);
  return { dir, file };
}

test('the module imports nothing from vscode', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'variantStore.ts'), 'utf8');
  assert.doesNotMatch(source, /from\s+['"]vscode['"]|require\(\s*['"]vscode['"]\s*\)/);
});

test('the variant store is ~/.gurita/variants.json, beside the default own recipe file', () => {
  assert.strictEqual(DEFAULT_VARIANT_STORE_FILE, '~/.gurita/variants.json');
  assert.strictEqual(variantStoreFile('/home/someone'), '/home/someone/.gurita/variants.json');
  assert.strictEqual(variantStoreFile('/home/someone/'), '/home/someone/.gurita/variants.json');
});

test('a store file is read with JSON.parse into its records, the harness part kept as read', () => {
  const store = readVariantStore(STORE);
  assert.strictEqual(store.variants.length, 7);
  assert.deepStrictEqual(store.variants[0], {
    recipe: 'Variants',
    name: 'On Antigravity at xhigh',
    lines: ['agy -p "/gurita:complete-all-tasks --mission <path>" --model "claude-opus-5-5" --effort xhigh;'],
    copies: { name: 'On Antigravity', origin: 'shipped' },
  });
  assert.deepStrictEqual(store.variants[2], {
    recipe: 'Chain',
    name: 'Chain on Sonnet',
    lines: ['claude -p "/gurita:review-mission-requirements --mission <path>" --model "sonnet" --effort medium;'],
  });
  assert.deepStrictEqual(store.hidden[0], { recipe: 'Variants', name: 'Empty variant', origin: 'shipped' });
  assert.deepStrictEqual(store.defaults[0], { recipe: 'Chain', name: 'Chain on Sonnet', origin: 'stored' });
  assert.deepStrictEqual(store.harnesses, { kept: ['as', 'read'] });
  assert.deepStrictEqual(parseVariantStore('{}', STORE), emptyVariantStore(), 'a missing part holds nothing');
});

test('a stored variant remembers the variant it was made from, written back as read, its recipe kept only where it differs', () => {
  const text = JSON.stringify({
    variants: [
      { recipe: 'A', name: 'custom 1', lines: ['echo one'], from: { name: 'default', origin: 'shipped' } },
      { recipe: 'A', name: 'Copy', lines: ['echo two'], from: { name: 'custom 1', origin: 'stored', recipe: 'A' } },
      { recipe: 'B', name: 'B', lines: ['echo three'], from: { name: 'default', origin: 'own', recipe: 'A' } },
    ],
  });
  const store = parseVariantStore(text, STORE);
  assert.deepStrictEqual(store.variants.map((each) => each.from), [
    { name: 'default', origin: 'shipped' },
    { name: 'custom 1', origin: 'stored' },
    { name: 'default', origin: 'own', recipe: 'A' },
  ]);
  assert.deepStrictEqual(parseVariantStore(serializeVariantStore(store), STORE), store, 'the store is written back as read');
});

test('a missing store file holds nothing, and a store not in its form is refused naming the file', () => {
  const missing = path.join(os.tmpdir(), `gurita-no-such-variants-${process.pid}.json`);
  assert.deepStrictEqual(readVariantStore(missing), emptyVariantStore());
  for (const text of [
    'not json',
    '[]',
    '{"variants": {}}',
    '{"variants": [{"recipe": "A", "name": "B"}]}',
    '{"variants": [{"recipe": "A", "name": "B", "lines": [1]}]}',
    '{"variants": [{"recipe": "A", "name": "B", "lines": [], "copies": {"name": "C", "origin": "stored"}}]}',
    '{"variants": [{"recipe": "A", "name": "B", "lines": [], "from": {"name": "C", "origin": "elsewhere"}}]}',
    '{"variants": [{"recipe": "A", "name": "B", "lines": [], "from": {"origin": "shipped"}}]}',
    '{"hidden": [{"recipe": "A", "name": "B", "origin": "stored"}]}',
    '{"defaults": [{"recipe": "A", "name": "B", "origin": "elsewhere"}]}',
    '{"defaults": [{"recipe": "A", "origin": "shipped"}]}',
  ]) {
    assert.throws(
      () => parseVariantStore(text, '/home/someone/.gurita/variants.json'),
      (error: unknown) => error instanceof VariantStoreError && error.message.includes('/home/someone/.gurita/variants.json'),
      text,
    );
  }
});

test('the store is laid over the merged list: copies stand in place, hidden variants go, further stored variants follow', () => {
  const recipes = readRecipes(SHIPPED, OWN, STORE);
  assert.deepStrictEqual(outline(recipes), [
    ['shipped', 'Chain', [['default', 'shipped'], ['Chain on Sonnet', 'stored']]],
    ['shipped', 'Loop', [['default', 'shipped'], ['Copy of a variant no file holds', 'stored']]],
    ['shipped', 'Single task (Claude Code)', [['default', 'shipped']]],
    ['shipped', 'Interactive task line', [['default', 'shipped']]],
    ['shipped', 'answer-open-question', [['default', 'shipped'], ['Answer on Sonnet', 'stored']]],
    ['shipped', 'Fenced heading', [['default', 'shipped']]],
    [
      'shipped',
      'Variants',
      [['On Claude Code', 'shipped'], ['On Antigravity at xhigh', 'stored'], ['On Claude Code', 'stored'], ['Own variant', 'own']],
    ],
    ['shipped', 'Single task (Antigravity)', [['default', 'shipped'], ['default', 'own']]],
    ['shipped', 'Block before variants', [['Only variant', 'shipped']]],
    ['own', 'My first own recipe', [['default', 'own']]],
    ['own', 'My second own recipe', [['default', 'own']]],
    ['own', 'My variant recipe', [['First', 'own'], ['Second', 'own']]],
    ['own', 'Single task (Sonnet)', [['Single task (Sonnet)', 'stored']]],
  ]);
  const variants = byName(recipes, 'Variants').variants;
  assert.deepStrictEqual(variants[1].lines, ['agy -p "/gurita:complete-all-tasks --mission <path>" --model "claude-opus-5-5" --effort xhigh;']);
  assert.deepStrictEqual(variants[1].copies, { name: 'On Antigravity', origin: 'shipped' });
  assert.strictEqual(variants[1].own, true, "a stored variant counts as the person's own");
  assert.strictEqual(variants[1].file, STORE);
  assert.deepStrictEqual(variants[0].lines, ['claude -p "/gurita:complete-all-tasks --mission <path>" --model "opus" --effort high;'], 'the shipped twin stays');
  assert.deepStrictEqual(variants[2].lines, ['claude -p "/gurita:complete-all-tasks --mission <path>" --model "sonnet" --effort xhigh;']);
  assert.deepStrictEqual(
    byName(recipes, 'Chain').variants[1].lines,
    ['claude -p "/gurita:review-mission-requirements --mission <path>" --model "sonnet" --effort medium;'],
    'of a stored name repeated within one recipe the first is kept',
  );
  assert.ok(!recipes.some((recipe) => recipe.name === 'Two fences'), 'a recipe every variant of which is hidden is dropped');
  assert.ok(!recipes.some((recipe) => recipe.name === 'No such recipe'), 'a hiding record naming nothing adds nothing');
  assert.strictEqual(byName(recipes, 'Single task (Sonnet)').stage, undefined);
  assert.strictEqual(byName(recipes, 'Chain').stage, 'additional-review', 'a recipe keeps its stage');
});

test('a stored variant is classified by its lines as any variant is', () => {
  const recipes = readRecipes(SHIPPED, OWN, STORE);
  const loopCopy = byName(recipes, 'Loop').variants[1];
  assert.strictEqual(loopCopy.looped, true);
  const single = byName(recipes, 'Single task (Sonnet)').variants[0];
  assert.strictEqual(single.singleTask, true);
  assert.deepStrictEqual(single.knownPlaceholders, ['path', 'Task Title']);
});

test("a recipe's default is its picked variant, the copy standing in for a picked original, and otherwise its first", () => {
  const recipes = readRecipes(SHIPPED, OWN, STORE);
  const defaults = (name: string): [string, string] => {
    const chosen = defaultVariant(byName(recipes, name));
    return [chosen.name, variantOrigin(chosen)];
  };
  assert.deepStrictEqual(defaults('Chain'), ['Chain on Sonnet', 'stored'], "a recipe's first pick is the one read");
  assert.deepStrictEqual(defaults('Variants'), ['On Antigravity at xhigh', 'stored'], 'a pick of a copied variant is its copy');
  assert.deepStrictEqual(defaults('answer-open-question'), ['Answer on Sonnet', 'stored']);
  assert.deepStrictEqual(defaults('Fenced heading'), ['default', 'shipped'], 'a pick naming no listed variant falls back to the first');
  assert.deepStrictEqual(defaults('Block before variants'), ['Only variant', 'shipped']);
  assert.deepStrictEqual(defaults('Loop'), ['default', 'shipped'], 'with no pick the first variant in order');
  assert.deepStrictEqual(byName(recipes, 'Chain').picked, { name: 'Chain on Sonnet', origin: 'stored' });
  assert.strictEqual(byName(recipes, 'Loop').picked, undefined);
});

test('the default is worked out afresh at each read and never written', () => {
  const { dir, file } = tempStore('{"defaults": [{"recipe": "Variants", "name": "Own variant", "origin": "own"}]}');
  try {
    const before = fs.readFileSync(file, 'utf8');
    assert.strictEqual(defaultVariant(byName(readRecipes(SHIPPED, OWN, file), 'Variants')).name, 'Own variant');
    assert.strictEqual(fs.readFileSync(file, 'utf8'), before, 'reading writes nothing');
    fs.writeFileSync(file, '{"hidden": [{"recipe": "Variants", "name": "On Claude Code", "origin": "shipped"}]}');
    const after = byName(readRecipes(SHIPPED, OWN, file), 'Variants');
    assert.strictEqual(defaultVariant(after).name, 'On Antigravity', 'with the pick gone the first listed variant is the default');
    assert.strictEqual(defaultVariant(after).own, false);
    assert.strictEqual(fs.readFileSync(file, 'utf8'), '{"hidden": [{"recipe": "Variants", "name": "On Claude Code", "origin": "shipped"}]}', 'reading writes nothing');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the page's button, the fixed-name buttons, and the named single-task lines take the default", () => {
  const recipes = readRecipes(SHIPPED, OWN, STORE);
  const chain = pageRecipes(recipes, ['path']).find((entry) => entry.name === 'Chain');
  assert.ok(chain && chain.kind === 'runnable');
  assert.deepStrictEqual(chain.lines, ['claude -p "/gurita:review-mission-requirements --mission <path>" --model "sonnet" --effort medium;']);
  const button = buttonRecipe(recipes, 'answer-open-question', ['path', 'Short Title', 'answer text']);
  assert.ok(button.state === 'found');
  assert.strictEqual(button.variant.name, 'Answer on Sonnet');
  assert.deepStrictEqual(button.variant.lines, ['claude -p "/gurita:answer-open-question --mission <path> <Short Title>. <answer text>" --model "sonnet";']);
  assert.deepStrictEqual(
    singleTaskLines(recipes).map((line) => line.name),
    ['Single task (Claude Code)', 'Single task (Antigravity)', 'Single task (Sonnet)'],
  );
});

test('readRecipes with a missing or empty store reads as without one', () => {
  const missing = path.join(os.tmpdir(), `gurita-no-such-variants-${process.pid}.json`);
  assert.deepStrictEqual(readRecipes(SHIPPED, OWN, missing), merged());
  assert.deepStrictEqual(overlayVariantStore(merged(), emptyVariantStore(), STORE), merged());
  assert.deepStrictEqual(readRecipes(SHIPPED, OWN), merged());
});
