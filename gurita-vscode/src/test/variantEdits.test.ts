import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Recipe, defaultVariant, mergeRecipes, overlayVariantStore, parseOwnRecipes, parseShippedRecipes, readRecipes, variantOrigin } from '../recipes';
import {
  VariantEditError,
  VariantTarget,
  deleteVariant,
  duplicateVariant,
  lineEditor,
  lineRow,
  pickDefault,
  renameVariant,
  replaceLineHarness,
  replaceLineValue,
  resetVariant,
  resetVariantLines,
  resettableVariants,
  settingsRecipes,
  variantTarget,
} from '../variantEdits';
import { emptyVariantStore, readVariantStore } from '../variantStore';

const FIXTURES = path.join(__dirname, '..', '..', 'src', 'test', 'fixtures', 'recipes');
const SHIPPED = path.join(FIXTURES, 'shipped.md');
const OWN = path.join(FIXTURES, 'own.md');
const STORE = path.join(FIXTURES, 'store.json');
const SHIPPED_RECIPES = path.join(__dirname, '..', '..', 'shipped_recipes.md');

/** The recipe list the two Markdown files yield, before any store is laid over it. */
function base(): Recipe[] {
  return mergeRecipes(parseShippedRecipes(fs.readFileSync(SHIPPED, 'utf8'), SHIPPED), parseOwnRecipes(fs.readFileSync(OWN, 'utf8'), OWN));
}

/** A store path under a fresh temporary home, its `.gurita` directory not yet made. */
function withStore(body: (file: string) => void, text?: string): void {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-variant-edits-'));
  const file = path.join(home, '.gurita', 'variants.json');
  if (text !== undefined) {
    fs.mkdirSync(path.dirname(file));
    fs.writeFileSync(file, text);
  }
  try {
    body(file);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}

/** The merged recipe list read back from the files and the store. */
function readBack(file: string): Recipe[] {
  return readRecipes(SHIPPED, OWN, file);
}

function byName(recipes: Recipe[], name: string): Recipe {
  const found = recipes.find((recipe) => recipe.name === name);
  assert.ok(found, `no recipe named ${name}`);
  return found;
}

/** A recipe's variants by name and where each comes from. */
function variants(file: string, name: string): [string, string][] {
  return byName(readBack(file), name).variants.map((variant): [string, string] => [variant.name, variantOrigin(variant)]);
}

function defaultOf(file: string, name: string): [string, string] {
  const chosen = defaultVariant(byName(readBack(file), name));
  return [chosen.name, variantOrigin(chosen)];
}

const SHIPPED_CC: VariantTarget = { name: 'On Claude Code', origin: 'shipped' };
const SHIPPED_AGY: VariantTarget = { name: 'On Antigravity', origin: 'shipped' };
const OWN_CC: VariantTarget = { name: 'On Claude Code', origin: 'own' };
const OWN_VARIANT: VariantTarget = { name: 'Own variant', origin: 'own' };
const SHIPPED_VARIANTS: [string, string][] = [
  ['On Claude Code', 'shipped'],
  ['On Antigravity', 'shipped'],
  ['Empty variant', 'shipped'],
  ['On Claude Code', 'own'],
  ['Own variant', 'own'],
];

function refused(edit: () => void, pattern: RegExp): void {
  assert.throws(edit, (error: unknown) => error instanceof VariantEditError && pattern.test(error.message));
}

test('the module imports nothing from vscode', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'variantEdits.ts'), 'utf8');
  assert.doesNotMatch(source, /from\s+['"]vscode['"]|require\(\s*['"]vscode['"]\s*\)/);
});

test('a duplicate is a further stored variant holding the same lines, listed after the others, the store file made where missing', () => {
  withStore((file) => {
    assert.deepStrictEqual(variants(file, 'Variants'), SHIPPED_VARIANTS);
    duplicateVariant(file, base(), 'Variants', SHIPPED_AGY, 'On Antigravity again');
    assert.deepStrictEqual(variants(file, 'Variants'), [...SHIPPED_VARIANTS, ['On Antigravity again', 'stored']]);
    const copy = byName(readBack(file), 'Variants').variants[5];
    assert.deepStrictEqual(copy.lines, ['agy -p "/gurita:complete-all-tasks --mission <path>" --model "claude-opus-5-5" --effort high;']);
    assert.strictEqual(copy.copies, undefined, 'a duplicate stands in for nothing');
    duplicateVariant(file, base(), 'Variants', { name: 'On Antigravity again', origin: 'stored' }, 'Third');
    assert.deepStrictEqual(variants(file, 'Variants').slice(5), [['On Antigravity again', 'stored'], ['Third', 'stored']]);
  });
});

test('a duplicate or a rename to an empty name or one the recipe already uses is refused, nothing written', () => {
  withStore((file) => {
    refused(() => duplicateVariant(file, base(), 'Variants', SHIPPED_AGY, ''), /needs a name/);
    refused(() => duplicateVariant(file, base(), 'Variants', SHIPPED_AGY, '  '), /needs a name/);
    refused(() => duplicateVariant(file, base(), 'Variants', SHIPPED_AGY, 'Own variant'), /^The action recipe Variants already has a variant named Own variant\.$/);
    refused(() => renameVariant(file, base(), 'Variants', SHIPPED_AGY, 'On Claude Code'), /already has a variant named On Claude Code/);
    refused(() => renameVariant(file, base(), 'Variants', SHIPPED_AGY, ''), /needs a name/);
    refused(() => duplicateVariant(file, base(), 'Variants', { name: 'Own variant', origin: 'shipped' }, 'New'), /lists no shipped variant Own variant/);
    refused(() => duplicateVariant(file, base(), 'No such recipe', SHIPPED_AGY, 'New'), /^No action recipe is named No such recipe\.$/);
    assert.ok(!fs.existsSync(file), 'a refused edit writes nothing');
    renameVariant(file, base(), 'Variants', SHIPPED_AGY, 'On Antigravity');
    assert.ok(!fs.existsSync(file), 'a rename to the name a variant has writes nothing');
  });
});

test('renaming a shipped or own variant writes a stored copy standing in for it in its place, a reset showing it again', () => {
  withStore((file) => {
    renameVariant(file, base(), 'Variants', SHIPPED_AGY, 'Antigravity');
    renameVariant(file, base(), 'Variants', OWN_CC, 'Mine on Claude Code');
    assert.deepStrictEqual(variants(file, 'Variants'), [
      ['On Claude Code', 'shipped'],
      ['Antigravity', 'stored'],
      ['Empty variant', 'shipped'],
      ['Mine on Claude Code', 'stored'],
      ['Own variant', 'own'],
    ]);
    const renamed = byName(readBack(file), 'Variants').variants[1];
    assert.deepStrictEqual(renamed.copies, { name: 'On Antigravity', origin: 'shipped' });
    assert.deepStrictEqual(renamed.lines, ['agy -p "/gurita:complete-all-tasks --mission <path>" --model "claude-opus-5-5" --effort high;']);
    renameVariant(file, base(), 'Variants', variantTarget(renamed), 'Antigravity at high');
    assert.deepStrictEqual(variants(file, 'Variants')[1], ['Antigravity at high', 'stored'], 'a stored copy is renamed in the store');
    assert.strictEqual(readVariantStore(file).variants.length, 2, 'renaming a stored copy writes no second copy');
    resetVariant(file, 'Variants', { name: 'On Antigravity', origin: 'shipped' });
    resetVariant(file, 'Variants', { name: 'On Claude Code', origin: 'own' });
    assert.deepStrictEqual(variants(file, 'Variants'), SHIPPED_VARIANTS);
  });
});

test("changing a line of a shipped or own variant leaves it listed and adds a custom N holding the changed line, a stored variant's line changed in place", () => {
  withStore((file) => {
    replaceLineValue(file, base(), 'Variants', SHIPPED_CC, 0, 'model', 'sonnet');
    replaceLineValue(file, base(), 'Variants', OWN_CC, 0, 'effort', 'medium');
    assert.deepStrictEqual(variants(file, 'Variants'), [
      ...SHIPPED_VARIANTS,
      ['custom 1', 'stored'],
      ['custom 2', 'stored'],
    ], 'the edited variants stay listed, each custom added after the others under the lowest free number');
    const listed = byName(readBack(file), 'Variants').variants;
    assert.deepStrictEqual(listed[0].lines, ['claude -p "/gurita:complete-all-tasks --mission <path>" --model "opus" --effort high;'], 'the shipped variant is untouched');
    assert.deepStrictEqual(listed[5].lines, ['claude -p "/gurita:complete-all-tasks --mission <path>" --model "sonnet" --effort high;']);
    assert.strictEqual(listed[5].copies, undefined, 'a custom stands in for nothing');
    assert.deepStrictEqual(listed[5].from, { name: 'On Claude Code', origin: 'shipped' }, 'a custom remembers the variant it was made from');
    assert.deepStrictEqual(listed[6].lines, ['claude -p "/gurita:complete-all-tasks --mission <path>" --model "fable" --effort medium;']);
    assert.deepStrictEqual(listed[6].from, { name: 'On Claude Code', origin: 'own' });
    assert.deepStrictEqual(defaultOf(file, 'Variants'), ['On Claude Code', 'shipped'], 'no custom is made the default');
    assert.deepStrictEqual(readVariantStore(file).defaults, [], 'no pick is written');
    replaceLineValue(file, base(), 'Variants', variantTarget(listed[5]), 0, 'effort', 'xhigh');
    assert.deepStrictEqual(variants(file, 'Variants').slice(5), [['custom 1', 'stored'], ['custom 2', 'stored']], 'a second edit of custom 1 keeps its name');
    assert.deepStrictEqual(byName(readBack(file), 'Variants').variants[5].lines, [
      'claude -p "/gurita:complete-all-tasks --mission <path>" --model "sonnet" --effort xhigh;',
    ]);
    assert.strictEqual(readVariantStore(file).variants.length, 2, "a stored variant's line is changed in the store");
    const before = fs.readFileSync(file, 'utf8');
    replaceLineValue(file, base(), 'Variants', variantTarget(listed[6]), 0, 'model', 'fable');
    assert.strictEqual(fs.readFileSync(file, 'utf8'), before, 'a value the line already carries writes nothing');
    refused(() => replaceLineValue(file, base(), 'Single task (Antigravity)', { name: 'default', origin: 'shipped' }, 0, 'effort', 'high'), /carries no effort/);
    refused(() => replaceLineValue(file, base(), 'Variants', OWN_VARIANT, 0, 'model', 'o3'), /carries no model/);
    refused(() => replaceLineValue(file, base(), 'Variants', SHIPPED_AGY, 1, 'model', 'x'), /has no line 2/);
    refused(() => replaceLineValue(file, base(), 'Variants', SHIPPED_AGY, 0, 'model', ''), /An empty model/);
    assert.strictEqual(fs.readFileSync(file, 'utf8'), before, 'a refused change writes nothing');
    deleteVariant(file, base(), 'Variants', variantTarget(listed[5]));
    replaceLineValue(file, base(), 'Variants', SHIPPED_AGY, 0, 'model', 'gemini-4-argon');
    assert.deepStrictEqual(variants(file, 'Variants').slice(5), [['custom 2', 'stored'], ['custom 1', 'stored']], 'a freed number is taken again');
  });
});

/** A shipped recipe file holding one recipe of one block, its variant named `default`. */
const ONE_BLOCK = `## Recipes

### First run
\`\`\`
claude -p "/gurita:review-mission-requirements --mission <path>" --model "fable" --effort xhigh;
claude -p "/gurita:recommend-all-open-questions --mission <path>" --model "opus" --effort high;
\`\`\`
`;

function oneBlock(): Recipe[] {
  return parseShippedRecipes(ONE_BLOCK, 'one-block.md');
}

test("an edit of a default leaves it unchanged beside its custom 1, a second edit keeps the name, and a reset returns the lines under the same name", () => {
  withStore((file) => {
    const read = (): Recipe => byName(overlayVariantStore(oneBlock(), readVariantStore(file), file), 'First run');
    const shipped = oneBlock()[0].variants[0].lines;
    replaceLineValue(file, oneBlock(), 'First run', { name: 'default', origin: 'shipped' }, 0, 'model', 'sonnet');
    let recipe = read();
    assert.deepStrictEqual(recipe.variants.map((each) => [each.name, variantOrigin(each)]), [['default', 'shipped'], ['custom 1', 'stored']]);
    assert.deepStrictEqual(recipe.variants[0].lines, shipped, 'the default is unchanged');
    assert.strictEqual(defaultVariant(recipe).name, 'default', 'the default stays the default');
    const custom = variantTarget(recipe.variants[1]);
    assert.deepStrictEqual(custom, { name: 'custom 1', origin: 'stored' });
    replaceLineValue(file, oneBlock(), 'First run', custom, 1, 'effort', 'medium');
    replaceLineHarness(file, oneBlock(), 'First run', custom, 0, 'agy', { models: ['gemini-4-argon'], efforts: ['medium', 'high'] });
    recipe = read();
    assert.deepStrictEqual(recipe.variants.map((each) => each.name), ['default', 'custom 1'], 'every further edit of custom 1 keeps its name');
    assert.deepStrictEqual(recipe.variants[1].lines, [
      'agy -p "/gurita:review-mission-requirements --mission <path>" --model "gemini-4-argon" --effort medium;',
      'claude -p "/gurita:recommend-all-open-questions --mission <path>" --model "opus" --effort medium;',
    ]);
    const listed = settingsRecipes(oneBlock(), readVariantStore(file), file, [])[0].variants;
    assert.deepStrictEqual(listed.map((each) => [each.name, each.from]), [['default', undefined], ['custom 1', { name: 'default', origin: 'shipped' }]], 'a stored variant is listed with the variant its reset returns it to');
    resetVariantLines(file, oneBlock(), 'First run', custom);
    recipe = read();
    assert.deepStrictEqual(recipe.variants.map((each) => [each.name, variantOrigin(each)]), [['default', 'shipped'], ['custom 1', 'stored']], 'the reset keeps the name and the entry');
    assert.deepStrictEqual(recipe.variants[1].lines, shipped, "the reset returns the lines to the default's");
    assert.strictEqual(readVariantStore(file).variants.length, 1);
    const before = fs.readFileSync(file, 'utf8');
    resetVariantLines(file, oneBlock(), 'First run', custom);
    assert.strictEqual(fs.readFileSync(file, 'utf8'), before, 'a reset of lines already its source\'s writes nothing');
    refused(() => resetVariantLines(file, oneBlock(), 'First run', { name: 'default', origin: 'shipped' }), /is no stored variant/);
    renameVariant(file, oneBlock(), 'First run', { name: 'default', origin: 'shipped' }, 'Claude');
    assert.deepStrictEqual(read().variants.map((each) => [each.name, variantOrigin(each)]), [['Claude', 'stored'], ['custom 1', 'stored']], 'a rename of a default stays a stored copy in its place');
  });
});

test('a duplicate remembers the variant it was made from, its reset following a renamed stored source, and a source no longer held offers no reset', () => {
  withStore((file) => {
    duplicateVariant(file, base(), 'Variants', SHIPPED_AGY, 'Mine');
    duplicateVariant(file, base(), 'Variants', { name: 'Mine', origin: 'stored' }, 'Mine again');
    const stored = readVariantStore(file).variants;
    assert.deepStrictEqual(stored.map((each) => [each.name, each.from]), [
      ['Mine', { name: 'On Antigravity', origin: 'shipped' }],
      ['Mine again', { name: 'Mine', origin: 'stored' }],
    ]);
    replaceLineValue(file, base(), 'Variants', { name: 'Mine', origin: 'stored' }, 0, 'effort', 'medium');
    replaceLineValue(file, base(), 'Variants', { name: 'Mine again', origin: 'stored' }, 0, 'model', 'gemini-4-argon');
    renameVariant(file, base(), 'Variants', { name: 'Mine', origin: 'stored' }, 'Medium');
    assert.deepStrictEqual(readVariantStore(file).variants[1].from, { name: 'Medium', origin: 'stored' }, 'a rename of the source carries the reference');
    resetVariantLines(file, base(), 'Variants', { name: 'Mine again', origin: 'stored' });
    assert.deepStrictEqual(byName(readBack(file), 'Variants').variants.slice(5).map((each) => [each.name, each.lines]), [
      ['Medium', ['agy -p "/gurita:complete-all-tasks --mission <path>" --model "claude-opus-5-5" --effort medium;']],
      ['Mine again', ['agy -p "/gurita:complete-all-tasks --mission <path>" --model "claude-opus-5-5" --effort medium;']],
    ], "a reset takes its source's lines as they now stand");
    resetVariantLines(file, base(), 'Variants', { name: 'Medium', origin: 'stored' });
    assert.deepStrictEqual(byName(readBack(file), 'Variants').variants[5].lines, ['agy -p "/gurita:complete-all-tasks --mission <path>" --model "claude-opus-5-5" --effort high;']);
    deleteVariant(file, base(), 'Variants', { name: 'Medium', origin: 'stored' });
    const listed = settingsRecipes(base(), readVariantStore(file), file, []).find((each) => each.name === 'Variants')?.variants ?? [];
    assert.strictEqual(listed.find((each) => each.name === 'Mine again')?.from, undefined, 'a source no longer held offers no reset');
    refused(() => resetVariantLines(file, base(), 'Variants', { name: 'Mine again', origin: 'stored' }), /no longer listed/);
  });
});

test('a harness pick on a shipped or own variant adds a custom N holding the line rewritten onto the picked harness, as a model or effort pick does', () => {
  withStore((file) => {
    const agy = { models: ['claude-opus-5-5', 'gemini-4-argon'], efforts: ['medium', 'high'] };
    replaceLineHarness(file, base(), 'Variants', SHIPPED_CC, 0, 'agy', agy);
    replaceLineHarness(file, base(), 'Variants', SHIPPED_AGY, 0, 'claude', { models: ['fable', 'opus'], efforts: ['xhigh'] });
    assert.deepStrictEqual(variants(file, 'Variants'), [...SHIPPED_VARIANTS, ['custom 1', 'stored'], ['custom 2', 'stored']], 'each shipped variant stays listed');
    let listed = byName(readBack(file), 'Variants').variants;
    assert.deepStrictEqual(listed[5].lines, ['agy -p "/gurita:complete-all-tasks --mission <path>" --model "claude-opus-5-5" --effort high;'], 'an offered effort is kept');
    assert.deepStrictEqual(listed[5].from, { name: 'On Claude Code', origin: 'shipped' });
    assert.deepStrictEqual(listed[6].lines, ['claude -p "/gurita:complete-all-tasks --mission <path>" --model "fable" --effort xhigh;'], 'an effort not offered becomes the first listed');
    replaceLineHarness(file, base(), 'Variants', variantTarget(listed[5]), 0, 'claude', { models: ['opus'], efforts: ['high'] });
    listed = byName(readBack(file), 'Variants').variants;
    assert.deepStrictEqual(listed[5].name, 'custom 1', 'a stored variant keeps its name');
    assert.deepStrictEqual(listed[5].lines, ['claude -p "/gurita:complete-all-tasks --mission <path>" --model "opus" --effort high;'], 'the way back gives the shipped line');
    assert.strictEqual(readVariantStore(file).variants.length, 2, "a stored variant's line is changed in the store");
    const before = fs.readFileSync(file, 'utf8');
    replaceLineHarness(file, base(), 'Variants', variantTarget(listed[5]), 0, 'claude', { models: ['fable'], efforts: ['xhigh'] });
    assert.strictEqual(fs.readFileSync(file, 'utf8'), before, 'a line already on the picked harness writes nothing');
    refused(() => replaceLineHarness(file, base(), 'Variants', OWN_VARIANT, 0, 'claude', agy), /no claude or agy line carrying both/);
    refused(() => replaceLineHarness(file, base(), 'Chain', { name: 'default', origin: 'shipped' }, 0, 'agy', agy), /no claude or agy line carrying both/);
    refused(() => replaceLineHarness(file, base(), 'Variants', OWN_CC, 1, 'agy', agy), /has no line 2/);
    refused(() => replaceLineHarness(file, base(), 'Variants', OWN_CC, 0, 'agy', { models: [], efforts: ['high'] }), /offers no model/);
    refused(() => replaceLineHarness(file, base(), 'Variants', OWN_CC, 0, 'agy', { models: ['x'], efforts: [] }), /offers no effort/);
    assert.strictEqual(fs.readFileSync(file, 'utf8'), before, 'a refused pick writes nothing');
    replaceLineHarness(file, base(), 'Single task (Claude Code)', { name: 'default', origin: 'shipped' }, 0, 'agy', agy);
    const taskVariants = byName(readBack(file), 'Single task (Claude Code)').variants;
    assert.deepStrictEqual(taskVariants.map((each) => each.name), ['default', 'custom 1'], "a single-task line's pick adds custom 1 under the line's name");
    const line = taskVariants[1];
    assert.deepStrictEqual(line.lines, ['agy -p "/gurita:complete-task --mission <path> <Task Title>" --model "claude-opus-5-5" --effort high;']);
    assert.ok(line.singleTask, 'a rewritten single-task line stays a single-task variant');
  });
});

test('deleting a shipped or own variant writes a hiding record, a stored one leaves the store, and a reset shows a hidden one again', () => {
  withStore((file) => {
    deleteVariant(file, base(), 'Variants', SHIPPED_AGY);
    deleteVariant(file, base(), 'Variants', OWN_VARIANT);
    assert.deepStrictEqual(variants(file, 'Variants'), [['On Claude Code', 'shipped'], ['Empty variant', 'shipped'], ['On Claude Code', 'own']]);
    assert.deepStrictEqual(readVariantStore(file).hidden, [
      { recipe: 'Variants', name: 'On Antigravity', origin: 'shipped' },
      { recipe: 'Variants', name: 'Own variant', origin: 'own' },
    ]);
    duplicateVariant(file, base(), 'Variants', SHIPPED_CC, 'Spare');
    deleteVariant(file, base(), 'Variants', { name: 'Spare', origin: 'stored' });
    assert.deepStrictEqual(readVariantStore(file).variants, [], 'a deleted stored variant leaves the store');
    renameVariant(file, base(), 'Variants', SHIPPED_CC, 'Renamed');
    const copy = byName(readBack(file), 'Variants').variants[0];
    assert.deepStrictEqual(variantTarget(copy), { name: 'Renamed', origin: 'stored', copies: { name: 'On Claude Code', origin: 'shipped' } });
    deleteVariant(file, base(), 'Variants', variantTarget(copy));
    assert.deepStrictEqual(variants(file, 'Variants'), [['Empty variant', 'shipped'], ['On Claude Code', 'own']], 'a deleted copy hides what it stood in for');
    assert.deepStrictEqual(
      resettableVariants(readVariantStore(file), 'Variants'),
      [{ name: 'On Antigravity', origin: 'shipped' }, { name: 'Own variant', origin: 'own' }, { name: 'On Claude Code', origin: 'shipped' }],
    );
    resetVariant(file, 'Variants', { name: 'On Antigravity', origin: 'shipped' });
    resetVariant(file, 'Variants', { name: 'Own variant', origin: 'own' });
    resetVariant(file, 'Variants', { name: 'On Claude Code', origin: 'shipped' });
    assert.deepStrictEqual(variants(file, 'Variants'), SHIPPED_VARIANTS);
    assert.deepStrictEqual(byName(readBack(file), 'Variants').variants[0].lines, [
      'claude -p "/gurita:complete-all-tasks --mission <path>" --model "opus" --effort high;',
    ]);
    refused(() => resetVariant(file, 'Variants', { name: 'On Antigravity', origin: 'shipped' }), /No stored copy or hiding record stands/);
  });
});

test('a recipe every variant of which is deleted drops out, and a reset brings it back', () => {
  withStore((file) => {
    const name = 'Single task (Claude Code)';
    deleteVariant(file, base(), name, { name: 'default', origin: 'shipped' });
    assert.ok(!readBack(file).some((recipe) => recipe.name === name));
    refused(() => deleteVariant(file, base(), name, { name: 'default', origin: 'shipped' }), /No action recipe is named/);
    resetVariant(file, name, { name: 'default', origin: 'shipped' });
    assert.deepStrictEqual(variants(file, name), [['default', 'shipped']]);
  });
});

test('a picked default is stored, replacing the pick standing, a stored copy picked as the variant it stands in for', () => {
  withStore((file) => {
    assert.deepStrictEqual(defaultOf(file, 'Variants'), ['On Claude Code', 'shipped'], 'with no pick the first listed variant');
    pickDefault(file, base(), 'Variants', OWN_VARIANT);
    assert.deepStrictEqual(defaultOf(file, 'Variants'), ['Own variant', 'own']);
    pickDefault(file, base(), 'Variants', SHIPPED_AGY);
    assert.deepStrictEqual(defaultOf(file, 'Variants'), ['On Antigravity', 'shipped']);
    assert.deepStrictEqual(readVariantStore(file).defaults, [{ recipe: 'Variants', name: 'On Antigravity', origin: 'shipped' }]);
    replaceLineValue(file, base(), 'Variants', SHIPPED_AGY, 0, 'effort', 'medium');
    assert.deepStrictEqual(defaultOf(file, 'Variants'), ['On Antigravity', 'shipped'], 'a line edit leaves the pick on the edited variant, its custom not picked');
    renameVariant(file, base(), 'Variants', SHIPPED_AGY, 'Antigravity');
    assert.deepStrictEqual(defaultOf(file, 'Variants'), ['Antigravity', 'stored'], 'the copy standing in for the pick is the default');
    pickDefault(file, base(), 'Variants', SHIPPED_CC);
    pickDefault(file, base(), 'Variants', variantTarget(byName(readBack(file), 'Variants').variants[1]));
    assert.deepStrictEqual(readVariantStore(file).defaults, [{ recipe: 'Variants', name: 'On Antigravity', origin: 'shipped' }]);
    resetVariant(file, 'Variants', { name: 'On Antigravity', origin: 'shipped' });
    assert.deepStrictEqual(defaultOf(file, 'Variants'), ['On Antigravity', 'shipped'], 'a reset keeps the pick on the variant shown again');
  });
});

test('renaming the picked default carries the pick to the new name', () => {
  withStore((file) => {
    pickDefault(file, base(), 'Variants', SHIPPED_AGY);
    renameVariant(file, base(), 'Variants', SHIPPED_AGY, 'Antigravity');
    assert.deepStrictEqual(defaultOf(file, 'Variants'), ['Antigravity', 'stored']);
    renameVariant(file, base(), 'Variants', { name: 'Antigravity', origin: 'stored', copies: { name: 'On Antigravity', origin: 'shipped' } }, 'Gemini');
    assert.deepStrictEqual(defaultOf(file, 'Variants'), ['Gemini', 'stored']);
    duplicateVariant(file, base(), 'Chain', { name: 'default', origin: 'shipped' }, 'Chain copy');
    pickDefault(file, base(), 'Chain', { name: 'Chain copy', origin: 'stored' });
    renameVariant(file, base(), 'Chain', { name: 'Chain copy', origin: 'stored' }, 'Chain renamed');
    assert.deepStrictEqual(defaultOf(file, 'Chain'), ['Chain renamed', 'stored']);
    renameVariant(file, base(), 'Chain', { name: 'default', origin: 'own' }, 'Own chain');
    assert.deepStrictEqual(defaultOf(file, 'Chain'), ['Chain renamed', 'stored'], 'renaming another variant leaves the pick');
  });
});

test('only deleting the picked default drops the pick, the recipe falling back to its first listed variant', () => {
  withStore((file) => {
    pickDefault(file, base(), 'Variants', OWN_VARIANT);
    deleteVariant(file, base(), 'Variants', SHIPPED_AGY);
    assert.deepStrictEqual(defaultOf(file, 'Variants'), ['Own variant', 'own'], 'deleting another variant leaves the pick');
    deleteVariant(file, base(), 'Variants', SHIPPED_CC);
    assert.deepStrictEqual(defaultOf(file, 'Variants'), ['Own variant', 'own']);
    deleteVariant(file, base(), 'Variants', OWN_VARIANT);
    assert.deepStrictEqual(readVariantStore(file).defaults, [], 'the pick is dropped');
    assert.deepStrictEqual(defaultOf(file, 'Variants'), ['Empty variant', 'shipped'], 'the first listed variant is the default');
    resetVariant(file, 'Variants', { name: 'Own variant', origin: 'own' });
    assert.deepStrictEqual(defaultOf(file, 'Variants'), ['Empty variant', 'shipped'], 'a reset brings no dropped pick back');
  });
});

test('an edit keeps the rest of the store as written, its harness part included, and never touches the recipe files', () => {
  const shippedBefore = fs.readFileSync(SHIPPED, 'utf8');
  const ownBefore = fs.readFileSync(OWN, 'utf8');
  withStore((file) => {
    const before = readVariantStore(file);
    duplicateVariant(file, base(), 'Loop', { name: 'default', origin: 'shipped' }, 'Loop again');
    const after = readVariantStore(file);
    assert.deepStrictEqual(after.harnesses, { kept: ['as', 'read'] });
    assert.deepStrictEqual(after.hidden, before.hidden);
    assert.deepStrictEqual(after.defaults, before.defaults);
    assert.deepStrictEqual(after.variants, [
      ...before.variants,
      { recipe: 'Loop', name: 'Loop again', lines: ['source .env_fixture', '<single-task line>'], from: { name: 'default', origin: 'shipped' } },
    ]);
    renameVariant(file, base(), 'Chain', { name: 'Chain on Sonnet', origin: 'stored' }, 'Chain on Sonnet 2');
    assert.ok(
      !readVariantStore(file).variants.some((each) => each.recipe === 'Chain' && each.name === 'Chain on Sonnet'),
      'a renamed stored variant leaves no unread repeat of its old name to surface',
    );
    assert.deepStrictEqual(defaultOf(file, 'Chain'), ['Chain on Sonnet 2', 'stored']);
  }, fs.readFileSync(STORE, 'utf8'));
  assert.strictEqual(fs.readFileSync(SHIPPED, 'utf8'), shippedBefore);
  assert.strictEqual(fs.readFileSync(OWN, 'utf8'), ownBefore);
});

test('the settings list holds every recipe but the single-task lines, a recipe whose every variant is hidden kept for its resets', () => {
  const store = emptyVariantStore();
  store.hidden.push({ recipe: 'Chain', name: 'default', origin: 'shipped' }, { recipe: 'Chain', name: 'default', origin: 'own' });
  store.variants.push({ recipe: 'Variants', name: 'Faster', lines: ['echo faster'], copies: { name: 'On Antigravity', origin: 'shipped' } });
  store.variants.push({ recipe: 'Stored only', name: 'Mine', lines: ['echo mine'] });
  store.defaults.push({ recipe: 'Variants', name: 'On Antigravity', origin: 'shipped' });
  const listed = settingsRecipes(base(), store, '/home/x/.gurita/variants.json', ['answer-open-question']);
  const names = listed.map((recipe) => recipe.name);
  assert.ok(!names.some((name) => name.startsWith('Single task')), 'the named single-task lines are left out');
  assert.ok(names.includes('Interactive task line'), 'a task line that is no headless single-task line stays');
  assert.strictEqual(names[names.length - 1], 'Stored only', 'a recipe only the store holds comes last');
  const chain = listed.find((recipe) => recipe.name === 'Chain');
  assert.deepStrictEqual(chain && [chain.variants, chain.hidden], [[], [{ name: 'default', origin: 'shipped' }, { name: 'default', origin: 'own' }]]);
  const variants = listed.find((recipe) => recipe.name === 'Variants');
  assert.ok(variants !== undefined);
  assert.deepStrictEqual(
    variants.variants.map((each) => [each.name, each.origin, each.copies?.name, each.isDefault]),
    [
      ['On Claude Code', 'shipped', undefined, false],
      ['Faster', 'stored', 'On Antigravity', true],
      ['Empty variant', 'shipped', undefined, false],
      ['On Claude Code', 'own', undefined, false],
      ['Own variant', 'own', undefined, false],
    ],
    'the stored copy in its place and marked the default, the pick standing for the variant it copies',
  );
  assert.deepStrictEqual(variants.hidden, [], "a stored copy's reset stands on the copy, not among the hidden");
  assert.deepStrictEqual(listed.filter((recipe) => recipe.fixed).map((recipe) => recipe.name), ['answer-open-question']);
});

test('only a claude or agy line carrying both --model and --effort gets model and effort controls, a codex line with -m its model control alone', () => {
  assert.deepStrictEqual(lineEditor('claude -p "/gurita:finish-mission --mission <path>" --model "opus" --effort high;'), {
    harness: 'claude',
    model: 'opus',
    effort: 'high',
  });
  assert.deepStrictEqual(lineEditor('agy -p "x" --model=gemini-4-argon --effort medium;'), { harness: 'antigravity', model: 'gemini-4-argon', effort: 'medium' });
  assert.deepStrictEqual(lineEditor('codex exec "/gurita:finish-mission --mission <path>" -m gpt-5.5;'), { harness: 'codex', model: 'gpt-5.5' });
  for (const line of [
    'claude -p "x" --model "opus";',
    'agy -p "x" --effort high;',
    'claude "/gurita:discuss-mission-goal <goal>"; # interactive',
    'codex exec "x";',
    '<single-task line>',
    'echo <path>',
    'gemini -p "x" --model "pro" --effort high;',
  ]) {
    assert.strictEqual(lineEditor(line), undefined, `${line} is read-only`);
  }
  const listed = settingsRecipes(base(), emptyVariantStore(), '/home/x/.gurita/variants.json', []);
  for (const recipe of listed) {
    for (const variant of recipe.variants) {
      assert.deepStrictEqual(variant.editors, variant.lines.map((line) => lineEditor(line) ?? null), `${recipe.name}: one editor or null per line`);
    }
  }
});

test("a line running a gurita: skill on a known harness is drawn as the skill's name, marked interactive when not headless, with its harness", () => {
  assert.deepStrictEqual(
    lineRow('claude -p "/gurita:specify-mission-starting-state --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;'),
    { skill: 'specify-mission-starting-state', interactive: false, harness: 'claude' },
  );
  assert.deepStrictEqual(
    lineRow('agy -i "/gurita:recommend-all-open-questions --mission <path>" --model "gemini-4-argon" --effort medium; # interactive'),
    { skill: 'recommend-all-open-questions', interactive: true, harness: 'antigravity' },
  );
  assert.deepStrictEqual(lineRow("codex exec '$gurita:complete-task --mission <path> <Task Title>';"), {
    skill: 'complete-task',
    interactive: false,
    harness: 'codex',
  });
  assert.deepStrictEqual(lineRow('claude -p "/gurita:finish-mission --mission <path>";'), { skill: 'finish-mission', interactive: false, harness: 'claude' }, 'a line without model or effort still gets its row');
  for (const line of [
    '<single-task line>',
    'echo <path>',
    'echo "/gurita:finish-mission"',
    'gemini -p "/gurita:finish-mission --mission <path>" --model "pro" --effort high;',
    'claude -p "Summarize the mission" --model "opus" --effort high;',
    'claude --version; echo "/gurita:finish-mission"',
  ]) {
    assert.strictEqual(lineRow(line), undefined, `${line} keeps its text`);
  }
});

test('every line of every shipped recipe gets the row its text gives', () => {
  const shipped = parseShippedRecipes(fs.readFileSync(SHIPPED_RECIPES, 'utf8'), SHIPPED_RECIPES);
  const listed = settingsRecipes(shipped, emptyVariantStore(), '/home/x/.gurita/variants.json', []);
  for (const recipe of listed) {
    for (const variant of recipe.variants) {
      assert.deepStrictEqual(variant.rows, variant.lines.map((line) => lineRow(line) ?? null), `${recipe.name}: one row or null per line`);
    }
  }
  const firstRun = listed.find((recipe) => recipe.name === 'First run');
  assert.ok(firstRun !== undefined);
  assert.deepStrictEqual(firstRun.variants[0].rows, [
    { skill: 'specify-mission-starting-state', interactive: false, harness: 'claude' },
    { skill: 'review-mission-requirements', interactive: false, harness: 'claude' },
    { skill: 'provide-alternatives-to-all-open-questions', interactive: false, harness: 'claude' },
    { skill: 'recommend-all-open-questions', interactive: true, harness: 'claude' },
  ]);
  assert.ok(!listed.some((recipe) => recipe.variants.some((variant) => variant.lines.includes('<single-task line>'))), 'no shipped variant holds the slot line');
});
