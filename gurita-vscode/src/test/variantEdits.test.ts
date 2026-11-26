import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  Recipe,
  defaultVariant,
  isHeadless,
  mergeRecipes,
  overlayVariantStore,
  parseOwnRecipes,
  parseProjectRecipes,
  parseShippedRecipes,
  readRecipes,
  variantOrigin,
} from '../recipes';
import {
  VariantEditError,
  VariantTarget,
  deleteVariant,
  duplicateVariant,
  lineEditor,
  linePlace,
  lineRow,
  pickDefault,
  renameVariant,
  replaceLineHarness,
  replaceLineValue,
  resetVariant,
  resetVariantLines,
  resettableVariants,
  settingsLines,
  settingsRecipes,
  variantTarget,
} from '../variantEdits';
import { emptyVariantStore, parseVariantStore, readVariantStore } from '../variantStore';

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

test("the Settings list holds the three sources' variants, a project variant by the origin project, and its edits store that origin", () => {
  const project = '/work/project/gurita_recipes.md';
  const three = (): Recipe[] =>
    mergeRecipes(
      parseShippedRecipes('## Recipes\n\n### Chain\n```\necho shipped <path>\n```\n', SHIPPED),
      parseOwnRecipes('### Chain\n#### mine\n```\necho own <path>\n```\n', OWN),
      parseProjectRecipes('### Chain\n#### team\n```\necho project <path>\n```\n\n### Ours\n```\necho ours <path>\n```\n', project),
    );
  const listed = settingsRecipes(three(), emptyVariantStore(), STORE, []);
  assert.deepStrictEqual(
    listed.map((recipe) => [recipe.name, recipe.group, recipe.variants.map((each) => [each.name, each.origin, each.isDefault])]),
    [
      ['Chain', 'shipped', [['default', 'shipped', true], ['team', 'project', false], ['mine', 'own', false]]],
      ['Ours', 'project', [['default', 'project', true]]],
    ],
  );
  const team: VariantTarget = { name: 'team', origin: 'project' };
  withStore((file) => {
    pickDefault(file, three(), 'Chain', team);
    renameVariant(file, three(), 'Chain', team, 'Team renamed');
    deleteVariant(file, three(), 'Ours', { name: 'default', origin: 'project' });
    const store = readVariantStore(file);
    assert.deepStrictEqual(store.variants, [{ recipe: 'Chain', name: 'Team renamed', lines: ['echo project <path>'], copies: { name: 'team', origin: 'project' } }]);
    assert.deepStrictEqual(store.defaults, [{ recipe: 'Chain', name: 'team', origin: 'project' }]);
    assert.deepStrictEqual(store.hidden, [{ recipe: 'Ours', name: 'default', origin: 'project' }]);
    const after = settingsRecipes(three(), store, file, []);
    assert.deepStrictEqual(
      after.map((recipe) => [recipe.name, recipe.variants.map((each) => [each.name, each.origin, each.copies?.origin, each.isDefault]), recipe.hidden]),
      [
        ['Chain', [['default', 'shipped', undefined, false], ['Team renamed', 'stored', 'project', true], ['mine', 'own', undefined, false]], []],
        ['Ours', [], [{ name: 'default', origin: 'project' }]],
      ],
    );
    resetVariant(file, 'Ours', { name: 'default', origin: 'project' });
    assert.deepStrictEqual(readVariantStore(file).hidden, [], "a reset shows the project's variant again");
  });
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
    refused(() => replaceLineHarness(file, base(), 'Variants', OWN_VARIANT, 0, 'claude', agy), /cannot be switched onto claude/);
    refused(() => replaceLineHarness(file, base(), 'Chain', { name: 'default', origin: 'shipped' }, 0, 'agy', agy), /cannot be switched onto agy/);
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

test('a harness pick onto Codex adds a custom N holding the codex exec line, with no effort override for an empty effort list, and a pick back restores the line', () => {
  withStore((file) => {
    replaceLineHarness(file, base(), 'Variants', SHIPPED_CC, 0, 'codex', { models: ['gpt-5.5'], efforts: ['high', 'medium'] });
    replaceLineHarness(file, base(), 'Variants', SHIPPED_AGY, 0, 'codex', { models: ['gpt-5.5'], efforts: [] });
    let listed = byName(readBack(file), 'Variants').variants;
    assert.deepStrictEqual(listed[5].lines, ["codex exec '$gurita:complete-all-tasks --mission <path>' -m \"gpt-5.5\" -c model_reasoning_effort=high;"]);
    assert.deepStrictEqual(listed[6].lines, ["codex exec '$gurita:complete-all-tasks --mission <path>' -m \"gpt-5.5\";"], 'an empty effort list writes no override');
    replaceLineHarness(file, base(), 'Variants', variantTarget(listed[5]), 0, 'claude', { models: ['opus'], efforts: ['high'] });
    replaceLineHarness(file, base(), 'Variants', variantTarget(listed[6]), 0, 'agy', { models: ['claude-opus-5-5'], efforts: ['high'] });
    listed = byName(readBack(file), 'Variants').variants;
    assert.deepStrictEqual(listed[5].lines, ['claude -p "/gurita:complete-all-tasks --mission <path>" --model "opus" --effort high;'], 'the round trip gives the shipped line');
    assert.deepStrictEqual(listed[6].lines, ['agy -p "/gurita:complete-all-tasks --mission <path>" --model "claude-opus-5-5" --effort high;'], 'a line without the override takes the first listed effort');
    const before = fs.readFileSync(file, 'utf8');
    refused(() => replaceLineHarness(file, base(), 'Variants', OWN_CC, 0, 'codex', { models: [], efforts: ['high'] }), /codex model list offers no model/);
    assert.strictEqual(fs.readFileSync(file, 'utf8'), before, 'a refused pick writes nothing');
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

test('only a claude or agy line carrying both --model and --effort gets model and effort controls, a codex line with -m its model control and, with the effort override, its effort control', () => {
  const all = ['claude', 'antigravity', 'codex'];
  assert.deepStrictEqual(lineEditor('claude -p "/gurita:finish-mission --mission <path>" --model "opus" --effort high;'), {
    harness: 'claude',
    model: 'opus',
    effort: 'high',
    harnesses: all,
  });
  assert.deepStrictEqual(lineEditor('agy -p "x" --model=gemini-4-argon --effort medium;'), { harness: 'antigravity', model: 'gemini-4-argon', effort: 'medium', harnesses: all });
  assert.deepStrictEqual(
    lineEditor('claude "/gurita:complete-all-tasks --mission <path>" --model "opus" --effort high; # interactive'),
    { harness: 'claude', model: 'opus', effort: 'high', harnesses: all },
    'an interactive line is offered Codex too',
  );
  assert.deepStrictEqual(
    lineEditor("codex '$gurita:complete-all-tasks --mission <path>' -m gpt-5.5 -c model_reasoning_effort=high; # interactive"),
    { harness: 'codex', model: 'gpt-5.5', effort: 'high', harnesses: all },
    'and so is an interactive bare codex line',
  );
  assert.deepStrictEqual(lineEditor('codex exec "/gurita:finish-mission --mission <path>" -m gpt-5.5;'), { harness: 'codex', model: 'gpt-5.5', harnesses: all });
  assert.deepStrictEqual(lineEditor("codex exec '$gurita:finish-mission --mission <path>' -m gpt-5.5 -c model_reasoning_effort=high;"), {
    harness: 'codex',
    model: 'gpt-5.5',
    effort: 'high',
    harnesses: all,
  });
  assert.deepStrictEqual(lineEditor('codex exec "x" -m gpt-5.5 --effort high;'), { harness: 'codex', model: 'gpt-5.5', harnesses: all }, "a Codex line's --effort gives no effort control");
  assert.deepStrictEqual(lineEditor('codex "x" -m gpt-5.5;'), { harness: 'codex', model: 'gpt-5.5' }, 'a Codex line neither opening codex exec nor invoking its skill as $gurita: gets no harness control');
  for (const line of [
    'claude -p "x" --model "opus";',
    'agy -p "x" --effort high;',
    'claude "/gurita:discuss-mission-goal <goal>"; # interactive',
    'codex exec "x";',
    'codex exec "x" -c model_reasoning_effort=high;',
    '<single-task line>',
    'echo <path>',
    'gemini -p "x" --model "pro" --effort high;',
  ]) {
    assert.strictEqual(lineEditor(line), undefined, `${line} is read-only`);
  }
  const listed = settingsRecipes(base(), emptyVariantStore(), '/home/x/.gurita/variants.json', []);
  for (const recipe of listed) {
    for (const variant of recipe.variants) {
      const source = byName(base(), recipe.name).variants.find((each) => each.name === variant.name);
      assert.ok(source !== undefined);
      assert.deepStrictEqual(
        variant.editors,
        variant.lines.map((line, index) => lineEditor(line, false, linePlace(source, index)) ?? null),
        `${recipe.name}: one editor or null per line, each given its place`,
      );
    }
  }
});

test("under Variants the harness dropdown offers each CLI headless and interactive on a variant's last line and headless alone on every earlier line, a single-task line or a looped recipe's line picking a harness alone", () => {
  const shipped = parseShippedRecipes(fs.readFileSync(SHIPPED_RECIPES, 'utf8'), SHIPPED_RECIPES);
  const both = ['headless', 'interactive'];
  const offered: string[] = [];
  for (const recipe of settingsRecipes(shipped, emptyVariantStore(), '/home/x/.gurita/variants.json', [])) {
    for (const variant of recipe.variants) {
      variant.editors.forEach((editor, index) => {
        assert.ok(editor !== null && editor.harnesses !== undefined, `${recipe.name}/${variant.name}/${index} gets a harness dropdown`);
        assert.deepStrictEqual(editor.harnesses.slice(0, 3), ['claude', 'antigravity', 'codex']);
        assert.strictEqual(editor.form, isHeadless(variant.lines[index]) ? 'headless' : 'interactive', 'the editor carries the line\'s own form');
        assert.deepStrictEqual(editor.forms, index === variant.lines.length - 1 ? both : ['headless'], `${recipe.name}/${variant.name}/${index}`);
        offered.push(`${recipe.name}/${variant.name}/${index} ${editor.form} ${(editor.forms ?? []).join('+')}`);
      });
    }
  }
  assert.deepStrictEqual(offered, [
    'First run/default/0 headless headless',
    'First run/default/1 headless headless',
    'First run/default/2 headless headless',
    'First run/default/3 interactive headless+interactive',
    'Approve all standing recommendations and review again/default/0 headless headless',
    'Approve all standing recommendations and review again/default/1 headless headless',
    'Approve all standing recommendations and review again/default/2 headless headless',
    'Approve all standing recommendations and review again/default/3 interactive headless+interactive',
    'Prepare tasks/default/0 headless headless',
    'Prepare tasks/default/1 headless headless+interactive',
    'Prepare and Execute tasks/Normal difficulty/0 headless headless',
    'Prepare and Execute tasks/Normal difficulty/1 headless headless',
    'Prepare and Execute tasks/Normal difficulty/2 interactive headless+interactive',
    'Prepare and Execute tasks/Critical tasks/0 headless headless',
    'Prepare and Execute tasks/Critical tasks/1 headless headless',
    'Prepare and Execute tasks/Critical tasks/2 interactive headless+interactive',
    'Execute tasks/Normal difficulty/0 interactive headless+interactive',
    'Execute tasks/Critical tasks/0 interactive headless+interactive',
    'Finish mission/default/0 headless headless+interactive',
    'discuss-open-question/default/0 interactive headless+interactive',
    'discuss-mission-goal/default/0 interactive headless+interactive',
    'discuss-new-task/default/0 interactive headless+interactive',
    'ask-in-mission-context/default/0 interactive headless+interactive',
    'answer-open-question/default/0 headless headless+interactive',
    'answer-open-question-with-alternative/default/0 headless headless+interactive',
    'define-mission-goal/default/0 headless headless+interactive',
    'init-mission-base-workflow/default/0 headless headless+interactive',
    'capture-mission-principle-updates/default/0 interactive headless+interactive',
  ], 'the six entries on every last line, the one line of a one-line variant included, and the three headless ones on every earlier line');
  const lines = settingsLines(shipped, emptyVariantStore(), '/home/x/.gurita/variants.json');
  assert.strictEqual(lines.lines.length, 4);
  for (const line of lines.lines) {
    for (const variant of line.variants) {
      for (const editor of variant.editors) {
        assert.ok(editor !== null && editor.harnesses !== undefined && editor.form === undefined && editor.forms === undefined, `${line.name}: a single-task line picks a harness alone`);
      }
    }
  }
  const loopFile = '/home/x/loop.md';
  const loop = parseOwnRecipes('### Looped\n```\nclaude -p "/gurita:derive-tasks --mission <path>" --model "opus" --effort high;\n<single-task line>\n```\n', loopFile);
  const looped = settingsRecipes(loop, emptyVariantStore(), '/home/x/.gurita/variants.json', []);
  assert.deepStrictEqual(looped[0].variants[0].editors, [{ harness: 'claude', model: 'opus', effort: 'high', harnesses: ['claude', 'antigravity', 'codex'] }, null], "a looped recipe's line picks a harness alone");
  assert.deepStrictEqual(
    lineEditor('claude "/gurita:x --mission <path>" --model "opus" --effort high;', false, 'last'),
    { harness: 'claude', model: 'opus', effort: 'high', harnesses: ['claude', 'antigravity', 'codex'] },
    'a line in neither form picks a harness alone',
  );
});

test("a harness pick with a form stores the line rewritten onto that harness in that form as a custom N, and an interactive pick on a line that is not its variant's last is refused", () => {
  withStore((file) => {
    const shipped = parseShippedRecipes(fs.readFileSync(SHIPPED_RECIPES, 'utf8'), SHIPPED_RECIPES);
    const read = (): Recipe[] => overlayVariantStore(shipped, readVariantStore(file), file);
    const claude = { models: ['fable', 'opus'], efforts: ['high', 'xhigh'] };
    const agy = { models: ['claude-opus-5-5'], efforts: ['high'] };
    const codex = { models: ['gpt-6-luna'], efforts: ['high', 'xhigh'] };
    const shippedDefault = { name: 'default', origin: 'shipped' } as const;
    // Finish mission's one headless line made interactive on its own harness: the form alone changes.
    replaceLineHarness(file, shipped, 'Finish mission', shippedDefault, 0, 'claude', claude, 'interactive');
    assert.deepStrictEqual(byName(read(), 'Finish mission').variants.map((each) => [each.name, variantOrigin(each), each.lines]), [
      ['default', 'shipped', ['claude -p "/gurita:finish-mission --mission <path>" --dangerously-skip-permissions --model "opus" --effort high;']],
      ['custom 1', 'stored', ['claude "/gurita:finish-mission --mission <path>" --dangerously-skip-permissions --model "opus" --effort high; # interactive']],
    ], 'the shipped variant stays listed, the interactive line stored as custom 1');
    assert.ok(byName(read(), 'Finish mission').variants[1].singleInteractive, 'custom 1 is now one interactive line');
    // Execute tasks' interactive line made headless on Antigravity.
    replaceLineHarness(file, shipped, 'Execute tasks', { name: 'Normal difficulty', origin: 'shipped' }, 0, 'agy', agy, 'headless');
    assert.deepStrictEqual(byName(read(), 'Execute tasks').variants[2].lines, [
      'agy -p "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort high;',
    ]);
    // First run's interactive last line made headless on Codex, and its headless first line moved onto Antigravity, staying headless.
    replaceLineHarness(file, shipped, 'First run', shippedDefault, 3, 'codex', codex, 'headless');
    const firstRun = byName(read(), 'First run').variants[1];
    assert.strictEqual(firstRun.name, 'custom 1');
    assert.strictEqual(
      firstRun.lines[3],
      "codex exec '$gurita:recommend-all-open-questions --mission <path>' --dangerously-bypass-approvals-and-sandbox -m \"gpt-6-luna\" -c model_reasoning_effort=xhigh;",
    );
    replaceLineHarness(file, shipped, 'First run', variantTarget(firstRun), 0, 'agy', agy, 'headless');
    assert.strictEqual(
      byName(read(), 'First run').variants[1].lines[0],
      'agy -p "/gurita:specify-mission-starting-state --mission <path>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort high;',
      'a stored variant is changed in place',
    );
    // And back to Claude Code interactive on the last line.
    replaceLineHarness(file, shipped, 'First run', variantTarget(firstRun), 3, 'claude', { models: ['fable'], efforts: ['high', 'xhigh'] }, 'interactive');
    assert.strictEqual(byName(read(), 'First run').variants[1].lines[3], shipped[0].variants[0].lines[3], 'the round trip gives the shipped line');
    assert.deepStrictEqual(
      readVariantStore(file).variants.map((each) => [each.recipe, each.name]),
      [['Finish mission', 'custom 1'], ['Execute tasks', 'custom 1'], ['First run', 'custom 1']],
    );
    const before = fs.readFileSync(file, 'utf8');
    refused(() => replaceLineHarness(file, shipped, 'First run', shippedDefault, 0, 'claude', claude, 'interactive'), /cannot be made interactive: only a variant's last line can/);
    refused(
      () => replaceLineHarness(file, shipped, 'Prepare and Execute tasks', { name: 'Normal difficulty', origin: 'shipped' }, 1, 'codex', codex, 'interactive'),
      /cannot be made interactive: only a variant's last line can/,
    );
    refused(() => replaceLineHarness(file, shipped, 'Prepare tasks', shippedDefault, 0, 'agy', agy, 'interactive'), /only a variant's last line can/);
    refused(
      () => replaceLineHarness(file, shipped, 'Single task with Opus High (Claude Code)', shippedDefault, 0, 'claude', claude, 'interactive'),
      /keeps its form: a single-task line and a line of a looped recipe pick a harness alone/,
    );
    refused(
      () => replaceLineHarness(file, shipped, 'Execute tasks', { name: 'Normal difficulty', origin: 'shipped' }, 0, 'claude-desktop', { models: [], efforts: [] }, 'headless'),
      /Claude Desktop takes the interactive form alone/,
    );
    assert.strictEqual(fs.readFileSync(file, 'utf8'), before, 'a refused pick writes nothing');
  });
});

test('the harness dropdown offers Claude Desktop on the line of a variant holding exactly one line, an interactive one, and on no other line', () => {
  const all = ['claude', 'antigravity', 'codex'];
  const withDesktop = [...all, 'claude-desktop'];
  const interactive = 'claude "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "opus" --effort high; # interactive';
  assert.deepStrictEqual(lineEditor(interactive, true), { harness: 'claude', model: 'opus', effort: 'high', harnesses: withDesktop });
  assert.deepStrictEqual(lineEditor(interactive), { harness: 'claude', model: 'opus', effort: 'high', harnesses: all }, 'a line of a chain is not offered Claude Desktop');
  assert.deepStrictEqual(
    lineEditor("codex '$gurita:complete-all-tasks --mission <path>' -m gpt-5.5 -c model_reasoning_effort=high; # interactive", true)?.harnesses,
    withDesktop,
    'an interactive bare codex line is offered it too',
  );
  assert.deepStrictEqual(lineEditor('agy -i "/gurita:ask-in-mission-context --mission <path> <question>" --model "claude-opus-5-5" --effort high; # interactive', true)?.harnesses, withDesktop);
  for (const line of [
    'claude -p "/gurita:finish-mission --mission <path>" --model "opus" --effort high;',
    'claude -p "/gurita:finish-mission --mission <path>" --model "opus" --effort high; # interactive',
    "codex exec '$gurita:finish-mission --mission <path>' -m gpt-5.5;",
  ]) {
    assert.deepStrictEqual(lineEditor(line, true)?.harnesses, all, `${line} is not offered Claude Desktop`);
  }
  assert.strictEqual(lineEditor('claude "/gurita:discuss-mission-goal <goal>"; # interactive', true), undefined, 'a line without both flags gets no dropdown');
  const shipped = parseShippedRecipes(fs.readFileSync(SHIPPED_RECIPES, 'utf8'), SHIPPED_RECIPES);
  const offered: string[] = [];
  for (const recipe of settingsRecipes(shipped, emptyVariantStore(), '/home/x/.gurita/variants.json', [])) {
    for (const variant of recipe.variants) {
      variant.editors.forEach((editor, index) => {
        if (editor?.harnesses?.includes('claude-desktop')) {
          offered.push(`${recipe.name}/${variant.name}/${index}`);
        }
      });
    }
  }
  assert.deepStrictEqual(offered, [
    'Execute tasks/Normal difficulty/0',
    'Execute tasks/Critical tasks/0',
    'discuss-open-question/default/0',
    'discuss-mission-goal/default/0',
    'discuss-new-task/default/0',
    'ask-in-mission-context/default/0',
    'capture-mission-principle-updates/default/0',
  ], "no chain's interactive last line and no headless line is offered Claude Desktop");
  const lines = settingsLines(shipped, emptyVariantStore(), '/home/x/.gurita/variants.json');
  assert.ok(lines.lines.length > 0);
  assert.ok(
    lines.lines.every((line) => line.variants.every((variant) => variant.editors.every((editor) => editor !== null && !editor.harnesses?.includes('claude-desktop')))),
    'no single-task line is offered Claude Desktop',
  );
});

test('outside a local macOS window no line editor offers Claude Desktop, a line already on it staying listed as its text', () => {
  const shipped = parseShippedRecipes(fs.readFileSync(SHIPPED_RECIPES, 'utf8'), SHIPPED_RECIPES);
  const desktop = 'claude-desktop "/gurita:complete-all-tasks --mission <path>"; # interactive';
  const store = parseVariantStore(
    JSON.stringify({ variants: [{ recipe: 'Execute tasks', name: 'custom 1', from: { name: 'Normal difficulty', origin: 'shipped' }, lines: [desktop] }] }),
    '/home/x/.gurita/variants.json',
  );
  const offered = (desktopOffered: boolean) =>
    settingsRecipes(shipped, store, '/home/x/.gurita/variants.json', [], desktopOffered).flatMap((recipe) =>
      recipe.variants.flatMap((variant) =>
        variant.editors.flatMap((editor, index) => (editor?.harnesses?.includes('claude-desktop') ? [`${recipe.name}/${variant.name}/${index}`] : [])),
      ),
    );
  assert.strictEqual(offered(true).length, 7, 'offered, the seven one-interactive-line variants offer it');
  assert.deepStrictEqual(offered(false), [], 'not offered, no line editor offers it');
  const execute = settingsRecipes(shipped, store, '/home/x/.gurita/variants.json', [], false).find((recipe) => recipe.name === 'Execute tasks');
  assert.deepStrictEqual(
    execute?.variants.map((variant) => [variant.name, variant.editors[0]?.harnesses ?? null]),
    [
      ['Normal difficulty', ['claude', 'antigravity', 'codex']],
      ['Critical tasks', ['claude', 'antigravity', 'codex']],
      ['custom 1', null],
    ],
    'the three CLIs are still offered, and a stored Desktop line is shown as its text',
  );
});

test('a Claude Desktop pick stores the line rewritten onto claude-desktop as a custom N beside the variant, and a line of a chain or a headless line is refused', () => {
  withStore((file) => {
    const shipped = parseShippedRecipes(fs.readFileSync(SHIPPED_RECIPES, 'utf8'), SHIPPED_RECIPES);
    const none = { models: [], efforts: [] };
    const read = (): Recipe[] => overlayVariantStore(shipped, readVariantStore(file), file);
    replaceLineHarness(file, shipped, 'Execute tasks', { name: 'Normal difficulty', origin: 'shipped' }, 0, 'claude-desktop', none);
    replaceLineHarness(file, shipped, 'discuss-open-question', { name: 'default', origin: 'shipped' }, 0, 'claude-desktop', none);
    const execute = byName(read(), 'Execute tasks').variants;
    assert.deepStrictEqual(execute.map((each) => [each.name, variantOrigin(each)]), [
      ['Normal difficulty', 'shipped'],
      ['Critical tasks', 'shipped'],
      ['custom 1', 'stored'],
    ], 'the shipped variants stay listed, the pick added as custom 1');
    assert.deepStrictEqual(execute[2].lines, ['claude-desktop "/gurita:complete-all-tasks --mission <path>"; # interactive']);
    assert.deepStrictEqual(execute[2].from, { name: 'Normal difficulty', origin: 'shipped' });
    assert.ok(execute[2].singleInteractive, 'the custom variant is still one interactive line');
    assert.deepStrictEqual(byName(read(), 'discuss-open-question').variants.map((each) => [each.name, each.lines]), [
      ['default', ['claude "/gurita:discuss-open-question --mission <path> <Short Title>. <note>" --dangerously-skip-permissions --model "fable" --effort xhigh; # interactive']],
      ['custom 1', ['claude-desktop "/gurita:discuss-open-question --mission <path> <Short Title>. <note>"; # interactive']],
    ]);
    assert.deepStrictEqual(
      readVariantStore(file).variants.map((each) => [each.recipe, each.name, each.lines]),
      [
        ['Execute tasks', 'custom 1', ['claude-desktop "/gurita:complete-all-tasks --mission <path>"; # interactive']],
        ['discuss-open-question', 'custom 1', ['claude-desktop "/gurita:discuss-open-question --mission <path> <Short Title>. <note>"; # interactive']],
      ],
      'the rewritten lines are stored in the variant store',
    );
    const before = fs.readFileSync(file, 'utf8');
    refused(() => replaceLineHarness(file, shipped, 'First run', { name: 'default', origin: 'shipped' }, 3, 'claude-desktop', none), /only a variant of one interactive line can/);
    refused(
      () => replaceLineHarness(file, shipped, 'Prepare and Execute tasks', { name: 'Normal difficulty', origin: 'shipped' }, 2, 'claude-desktop', none),
      /only a variant of one interactive line can/,
    );
    refused(() => replaceLineHarness(file, shipped, 'Finish mission', { name: 'default', origin: 'shipped' }, 0, 'claude-desktop', none), /cannot be switched onto claude-desktop/);
    refused(
      () => replaceLineHarness(file, shipped, 'Single task with Opus High (Claude Code)', { name: 'default', origin: 'shipped' }, 0, 'claude-desktop', none),
      /cannot be switched onto claude-desktop/,
    );
    assert.strictEqual(fs.readFileSync(file, 'utf8'), before, 'a refused pick writes nothing');
  });
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
