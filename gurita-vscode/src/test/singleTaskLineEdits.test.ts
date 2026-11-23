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
  duplicateLine,
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
    listed.lines.map((each) => [each.name, each.variant.name, each.variant.origin, each.group, each.isDefault, each.editor]),
    [
      [CC, 'default', 'shipped', 'shipped', true, { harness: 'claude', model: 'opus', effort: 'high' }],
      [AGY, 'default', 'shipped', 'shipped', true, null],
      [AGY, 'default', 'own', 'shipped', false, null],
      ['My own line', 'default', 'own', 'own', true, { harness: 'claude', model: 'sonnet', effort: 'medium' }],
    ],
    'the own variant joining a shipped line is listed as an own item, not the one the run takes',
  );
  assert.deepStrictEqual(
    listed.lines.map((each) => each.row),
    listed.lines.map((each) => lineRow(each.line) ?? null),
    'each line is posted with the row its text gives',
  );
  assert.deepStrictEqual(listed.lines[0].row, { skill: 'complete-task', interactive: false, harness: 'claude' });
  assert.deepStrictEqual(listed.hidden, []);
  const recipes = settingsRecipes(base(), emptyVariantStore(), '/home/x/.gurita/variants.json', []).map((recipe) => recipe.name);
  assert.ok(![CC, AGY, 'My own line'].some((name) => recipes.includes(name)), 'the variant list still leaves the named single-task lines out');
});

test('a duplicated line shows in singleTaskLines over the merged list under its own name, holding the same line', () => {
  withStore((file) => {
    duplicateLine(file, base(), CC, SHIPPED_CC, 'Single task (Sonnet)');
    assert.deepStrictEqual(readVariantStore(file).variants, [{ recipe: 'Single task (Sonnet)', name: 'Single task (Sonnet)', lines: [CC_LINE] }]);
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
    renameLine(file, base(), 'Opus line', listed.lines[0].variant, 'Opus high');
    assert.deepStrictEqual(namedLines(file)[0], ['Opus high', CC_LINE]);
    assert.strictEqual(readVariantStore(file).variants.length, 1);

    resetLine(file, CC, { name: 'default', origin: 'shipped' });
    assert.deepStrictEqual(namedLines(file)[0], [CC, CC_LINE], 'reset, the shipped line shows again under its name');
    assert.deepStrictEqual(readVariantStore(file).variants, []);
    assert.throws(() => resetLine(file, CC, { name: 'default', origin: 'shipped' }), VariantEditError, 'nothing stands for it any more');
  });
});

test("a line's model or effort change writes a stored copy under the line's name, which a rename then carries", () => {
  withStore((file) => {
    replaceLineValue(file, base(), CC, SHIPPED_CC, 0, 'model', 'sonnet');
    const changed = CC_LINE.replace('"opus"', '"sonnet"');
    assert.deepStrictEqual(namedLines(file)[0], [CC, changed]);
    const copy = settingsLines(base(), readVariantStore(file), file).lines[0];
    assert.deepStrictEqual([copy.variant.origin, copy.reset], ['stored', { recipe: CC, original: { name: 'default', origin: 'shipped' } }]);
    replaceLineValue(file, base(), CC, copy.variant, 0, 'effort', 'xhigh');
    renameLine(file, base(), CC, copy.variant, 'Sonnet xhigh');
    assert.deepStrictEqual(namedLines(file)[0], ['Sonnet xhigh', changed.replace('--effort high', '--effort xhigh')]);
    assert.deepStrictEqual(readVariantStore(file).variants.map((each) => [each.recipe, each.copies]), [
      ['Sonnet xhigh', { name: 'default', origin: 'shipped', recipe: CC }],
    ]);
    resetLine(file, CC, { name: 'default', origin: 'shipped' });
    assert.deepStrictEqual(namedLines(file)[0], [CC, CC_LINE]);
  });
});

test('a deleted line leaves singleTaskLines, a shipped or own one listed for its reset, a stored one leaving the store', () => {
  withStore((file) => {
    deleteLine(file, base(), CC, SHIPPED_CC);
    assert.deepStrictEqual(readVariantStore(file).hidden, [{ recipe: CC, name: 'default', origin: 'shipped' }]);
    assert.deepStrictEqual(namedLines(file).map((each) => each[0]), [AGY, 'My own line']);
    assert.deepStrictEqual(settingsLines(base(), readVariantStore(file), file).hidden, [{ name: CC, original: { name: 'default', origin: 'shipped' } }]);

    deleteLine(file, base(), 'My own line', { name: 'default', origin: 'own' });
    assert.deepStrictEqual(namedLines(file).map((each) => each[0]), [AGY]);
    resetLine(file, 'My own line', { name: 'default', origin: 'own' });
    resetLine(file, CC, { name: 'default', origin: 'shipped' });
    assert.deepStrictEqual(namedLines(file).map((each) => each[0]), [CC, AGY, 'My own line'], 'reset, the deleted lines show again');

    // A renamed line deleted hides the line it stood in for; a deleted duplicate leaves the store.
    renameLine(file, base(), CC, SHIPPED_CC, 'Opus line');
    const renamed = settingsLines(base(), readVariantStore(file), file).lines[0];
    deleteLine(file, base(), 'Opus line', renamed.variant);
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
