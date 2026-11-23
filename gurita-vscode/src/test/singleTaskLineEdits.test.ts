import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { singleTaskLines } from '../loop';
import { Recipe, mergeRecipes, overlayVariantStore, parseOwnRecipes, parseShippedRecipes } from '../recipes';
import {
  VariantEditError,
  VariantTarget,
  deleteLine,
  deleteVariant,
  duplicateLine,
  pickDefault,
  renameLine,
  replaceLineValue,
  resetLine,
  lineRow,
  settingsLines,
  settingsRecipes,
} from '../variantEdits';
import { emptyVariantStore, parseVariantStore, readVariantStore, serializeVariantStore } from '../variantStore';

const FIXTURES = path.join(__dirname, '..', '..', 'src', 'test', 'fixtures', 'recipes');
const SHIPPED = path.join(FIXTURES, 'shipped.md');
const OWN = path.join(FIXTURES, 'own.md');

/** The own file's text with one more own recipe: a named single-task line of its own. */
const OWN_LINE_TEXT = `${fs.readFileSync(OWN, 'utf8')}
### My own line
\`\`\`
claude -p "/gurita:complete-task --mission <path> <Task Title>" --model "sonnet" --effort medium;
\`\`\`
`;

const CC = 'Single task (Claude Code)';
const AGY = 'Single task (Antigravity)';
const CC_LINE = 'claude -p "/gurita:complete-task --mission <path> <Task Title>" --model "opus" --effort high;';
const AGY_LINE = 'agy -p "/gurita:complete-task --mission <path> <Task Title>" --model "claude-opus-5-5";';
const OWN_LINE = 'claude -p "/gurita:complete-task --mission <path> <Task Title>" --model "sonnet" --effort medium;';
const SHIPPED_CC: VariantTarget = { name: 'default', origin: 'shipped' };

/** The recipe list the two Markdown files yield, before any store is laid over it, the own file holding a line of its own. */
function base(): Recipe[] {
  return mergeRecipes(parseShippedRecipes(fs.readFileSync(SHIPPED, 'utf8'), SHIPPED), parseOwnRecipes(OWN_LINE_TEXT, OWN));
}

/** A store path under a fresh temporary home, its `.gurita` directory not yet made. */
function withStore(body: (file: string) => void): void {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-line-edits-'));
  try {
    body(path.join(home, '.gurita', 'variants.json'));
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}

/** The named single-task lines over the merged list with the store at `file` laid over it, as the looped run gathers them. */
function namedLines(file: string): [string, string][] {
  return singleTaskLines(overlayVariantStore(base(), readVariantStore(file), file)).map((each): [string, string] => [each.name, each.line]);
}

test('the settings view lists every named single-task line, shipped and own alike, each with its line editor', () => {
  const listed = settingsLines(base(), emptyVariantStore(), '/home/x/.gurita/variants.json');
  assert.deepStrictEqual(
    listed.lines.map((each) => [each.name, each.group, each.variants.map((variant) => [variant.name, variant.origin, variant.isDefault, variant.editors])]),
    [
      [CC, 'shipped', [['default', 'shipped', true, [{ harness: 'claude', model: 'opus', effort: 'high' }]]]],
      [AGY, 'shipped', [['default', 'shipped', true, [null]], ['default', 'own', false, [null]]]],
      ['My own line', 'own', [['default', 'own', true, [{ harness: 'claude', model: 'sonnet', effort: 'medium' }]]]],
    ],
    'each line lists its variants beneath its name, the own variant joining a shipped line as an own item, not the one the run takes',
  );
  const variants = listed.lines.flatMap((each) => each.variants);
  assert.deepStrictEqual(
    variants.map((each) => each.rows),
    variants.map((each) => each.lines.map((line) => lineRow(line) ?? null)),
    'each line is posted with the row its text gives',
  );
  assert.deepStrictEqual(listed.lines[0].variants[0].rows, [{ skill: 'complete-task', interactive: false, harness: 'claude' }]);
  assert.deepStrictEqual(listed.lines.map((each) => each.hidden), [[], [], []]);
  const recipes = settingsRecipes(base(), emptyVariantStore(), '/home/x/.gurita/variants.json', []).map((recipe) => recipe.name);
  assert.ok(![CC, AGY, 'My own line'].some((name) => recipes.includes(name)), 'the variant list still leaves the named single-task lines out');
});

test('a duplicated line shows in singleTaskLines over the merged list under its own name, holding the same line', () => {
  withStore((file) => {
    duplicateLine(file, base(), CC, SHIPPED_CC, 'Single task (Sonnet)');
    assert.deepStrictEqual(readVariantStore(file).variants, [
      { recipe: 'Single task (Sonnet)', name: 'Single task (Sonnet)', lines: [CC_LINE], from: { name: 'default', origin: 'shipped', recipe: CC } },
    ], 'a duplicated line remembers the line it was made from');
    assert.deepStrictEqual(namedLines(file), [
      [CC, CC_LINE],
      [AGY, AGY_LINE],
      ['My own line', OWN_LINE],
      ['Single task (Sonnet)', CC_LINE],
    ]);
    duplicateLine(file, base(), 'My own line', { name: 'default', origin: 'own' }, 'Second own line');
    assert.deepStrictEqual(namedLines(file).map((each) => each[0]), [CC, AGY, 'My own line', 'Single task (Sonnet)', 'Second own line']);
  });
});

test('a duplicate or a rename to an empty name or one a recipe or line already carries is refused, nothing written', () => {
  withStore((file) => {
    for (const name of ['', '  ', AGY, 'Chain', 'Interactive task line']) {
      assert.throws(() => duplicateLine(file, base(), CC, SHIPPED_CC, name), VariantEditError);
      assert.throws(() => renameLine(file, base(), CC, SHIPPED_CC, name), VariantEditError);
    }
    assert.throws(() => duplicateLine(file, base(), 'Chain', { name: 'default', origin: 'shipped' }, 'New line'), VariantEditError, 'a chain is no line');
    assert.ok(!fs.existsSync(file));
    renameLine(file, base(), CC, SHIPPED_CC, CC);
    assert.ok(!fs.existsSync(file), 'renaming a line to the name it has writes nothing');
  });
});

test('a renamed shipped line shows in singleTaskLines under its new name in its place, a reset showing it again', () => {
  withStore((file) => {
    renameLine(file, base(), CC, SHIPPED_CC, 'Opus line');
    assert.deepStrictEqual(readVariantStore(file).variants, [
      { recipe: 'Opus line', name: 'Opus line', lines: [CC_LINE], copies: { name: 'default', origin: 'shipped', recipe: CC } },
    ]);
    assert.deepStrictEqual(namedLines(file), [
      ['Opus line', CC_LINE],
      [AGY, AGY_LINE],
      ['My own line', OWN_LINE],
    ], 'the renamed line stands in for the shipped one, in its place');
    const listed = settingsLines(base(), readVariantStore(file), file);
    assert.deepStrictEqual(listed.lines[0].reset, { recipe: CC, original: { name: 'default', origin: 'shipped' } });

    // Renamed again, the stored copy is renamed in the store, still standing in for the shipped line.
    renameLine(file, base(), 'Opus line', listed.lines[0].variants[0], 'Opus high');
    assert.deepStrictEqual(namedLines(file)[0], ['Opus high', CC_LINE]);
    assert.strictEqual(readVariantStore(file).variants.length, 1);

    resetLine(file, CC, { name: 'default', origin: 'shipped' });
    assert.deepStrictEqual(namedLines(file)[0], [CC, CC_LINE], 'reset, the shipped line shows again under its name');
    assert.deepStrictEqual(readVariantStore(file).variants, []);
    assert.throws(() => resetLine(file, CC, { name: 'default', origin: 'shipped' }), VariantEditError, 'nothing stands for it any more');
  });
});

test("a line's model or effort change adds custom 1 under the line's name, which the looped run passes once it is made the default", () => {
  withStore((file) => {
    replaceLineValue(file, base(), CC, SHIPPED_CC, 0, 'model', 'sonnet');
    const changed = CC_LINE.replace('"opus"', '"sonnet"');
    assert.deepStrictEqual(readVariantStore(file).variants, [
      { recipe: CC, name: 'custom 1', lines: [changed], from: { name: 'default', origin: 'shipped' } },
    ]);
    let line = settingsLines(base(), readVariantStore(file), file).lines[0];
    assert.deepStrictEqual(
      [line.name, line.variants.map((each) => [each.name, each.origin, each.isDefault, each.lines[0]])],
      [CC, [['default', 'shipped', true, CC_LINE], ['custom 1', 'stored', false, changed]]],
      'the shipped default stays listed and the default, custom 1 beneath it',
    );
    assert.deepStrictEqual(line.variants[1].from, { name: 'default', origin: 'shipped' }, 'custom 1 can be reset to the default');
    assert.deepStrictEqual(namedLines(file)[0], [CC, CC_LINE], 'until it is made the default, the looped run passes the default');

    pickDefault(file, base(), CC, line.variants[1]);
    assert.deepStrictEqual(namedLines(file)[0], [CC, changed], 'made the default, custom 1 is the line the looped run passes under its name');
    line = settingsLines(base(), readVariantStore(file), file).lines[0];
    assert.deepStrictEqual(line.variants.map((each) => each.isDefault), [false, true]);

    // A further pick changes custom 1 in place; one on the shipped default adds custom 2.
    replaceLineValue(file, base(), CC, line.variants[1], 0, 'effort', 'xhigh');
    replaceLineValue(file, base(), CC, SHIPPED_CC, 0, 'effort', 'medium');
    line = settingsLines(base(), readVariantStore(file), file).lines[0];
    assert.deepStrictEqual(line.variants.map((each) => [each.name, each.lines[0]]), [
      ['default', CC_LINE],
      ['custom 1', changed.replace('--effort high', '--effort xhigh')],
      ['custom 2', CC_LINE.replace('--effort high', '--effort medium')],
    ]);
    assert.deepStrictEqual(namedLines(file)[0], [CC, changed.replace('--effort high', '--effort xhigh')]);

    // Deleting the picked custom 1 drops the pick, the line falling back to its first variant.
    deleteVariant(file, base(), CC, line.variants[1]);
    assert.deepStrictEqual(namedLines(file)[0], [CC, CC_LINE]);
    assert.deepStrictEqual(readVariantStore(file).defaults, []);
  });
});

test('a deleted line leaves singleTaskLines, a shipped or own one listed for its reset, a stored one leaving the store', () => {
  withStore((file) => {
    deleteLine(file, base(), CC, SHIPPED_CC);
    assert.deepStrictEqual(readVariantStore(file).hidden, [{ recipe: CC, name: 'default', origin: 'shipped' }]);
    assert.deepStrictEqual(namedLines(file).map((each) => each[0]), [AGY, 'My own line']);
    assert.deepStrictEqual(
      settingsLines(base(), readVariantStore(file), file).lines.map((each) => [each.name, each.variants.length, each.hidden]),
      [[CC, 0, [{ name: 'default', origin: 'shipped' }]], [AGY, 2, []], ['My own line', 1, []]],
      'a deleted line stays listed in its place with no variant, its hidden variant listed for its reset',
    );

    deleteLine(file, base(), 'My own line', { name: 'default', origin: 'own' });
    assert.deepStrictEqual(namedLines(file).map((each) => each[0]), [AGY]);
    resetLine(file, 'My own line', { name: 'default', origin: 'own' });
    resetLine(file, CC, { name: 'default', origin: 'shipped' });
    assert.deepStrictEqual(namedLines(file).map((each) => each[0]), [CC, AGY, 'My own line'], 'reset, the deleted lines show again');

    // A renamed line deleted hides the line it stood in for; a deleted duplicate leaves the store.
    renameLine(file, base(), CC, SHIPPED_CC, 'Opus line');
    const renamed = settingsLines(base(), readVariantStore(file), file).lines[0];
    deleteLine(file, base(), 'Opus line', renamed.variants[0]);
    assert.deepStrictEqual(readVariantStore(file).variants, []);
    assert.deepStrictEqual(readVariantStore(file).hidden, [{ recipe: CC, name: 'default', origin: 'shipped' }]);
    assert.deepStrictEqual(namedLines(file).map((each) => each[0]), [AGY, 'My own line']);
    duplicateLine(file, base(), AGY, { name: 'default', origin: 'shipped' }, 'Agy copy');
    deleteLine(file, base(), 'Agy copy', { name: 'Agy copy', origin: 'stored' });
    assert.deepStrictEqual(namedLines(file).map((each) => each[0]), [AGY, 'My own line']);
    assert.deepStrictEqual(readVariantStore(file).hidden, [{ recipe: CC, name: 'default', origin: 'shipped' }], 'a deleted duplicate hides nothing');
  });
});

test("a renamed line's copy is kept in the store's form, and one under a name the files hold stands in for nothing", () => {
  const text = serializeVariantStore({
    variants: [{ recipe: 'Opus line', name: 'Opus line', lines: [CC_LINE], copies: { name: 'default', origin: 'shipped', recipe: CC } }],
    hidden: [],
    defaults: [],
  });
  assert.deepStrictEqual(parseVariantStore(text, 'x.json').variants[0].copies, { name: 'default', origin: 'shipped', recipe: CC });
  assert.throws(() => parseVariantStore('{"variants":[{"recipe":"a","name":"a","lines":[],"copies":{"name":"b","origin":"shipped","recipe":1}}]}', 'x.json'));
  const store = emptyVariantStore();
  store.variants.push({ recipe: AGY, name: AGY, lines: [CC_LINE], copies: { name: 'default', origin: 'shipped', recipe: CC } });
  assert.deepStrictEqual(
    singleTaskLines(overlayVariantStore(base(), store, 'x.json')).map((each) => each.name),
    [CC, AGY, 'My own line'],
    'the shipped line stays, the copy under a held name standing in for nothing',
  );
});
