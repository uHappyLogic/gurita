import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  disabledCommands,
  harnessLists,
  harnessStates,
  isHarnessKey,
  readHarnessStates,
  setHarnessEnabled,
  withHarnessEnabled,
} from '../harnessSettings';
import { singleTaskLines } from '../loop';
import { BUTTON_RECIPES, Recipe, buttonRecipe, pageRecipes, parseShippedRecipes } from '../recipes';
import { VariantStoreError, emptyVariantStore, parseVariantStore, readVariantStore } from '../variantStore';

const FILE = '/home/someone/.gurita/variants.json';

test('the module imports nothing from vscode', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'harnessSettings.ts'), 'utf8');
  assert.doesNotMatch(source, /from\s+['"]vscode['"]|require\(\s*['"]vscode['"]\s*\)/);
});

test('every harness starts enabled: a store with no harness part, or naming a harness without a state, disables none', () => {
  assert.deepStrictEqual(harnessStates(emptyVariantStore(), FILE), { claude: true, antigravity: true, codex: true, 'claude-desktop': true });
  const store = parseVariantStore(JSON.stringify({ harnesses: { claude: {}, kept: ['as', 'read'] } }), FILE);
  assert.deepStrictEqual(harnessStates(store, FILE), { claude: true, antigravity: true, codex: true, 'claude-desktop': true });
  assert.deepStrictEqual(disabledCommands(harnessStates(store, FILE)), []);
});

test('a harness disabled in the harness part reads disabled, and its lines are named by the command they open with', () => {
  const store = parseVariantStore(JSON.stringify({ harnesses: { antigravity: { enabled: false }, codex: { enabled: true } } }), FILE);
  const states = harnessStates(store, FILE);
  assert.deepStrictEqual(states, { claude: true, antigravity: false, codex: true, 'claude-desktop': true });
  assert.deepStrictEqual(disabledCommands(states), ['agy']);
  assert.deepStrictEqual(disabledCommands({ claude: false, antigravity: false, codex: false, 'claude-desktop': false }), ['claude', 'agy', 'codex', 'claude-desktop']);
  assert.ok(isHarnessKey('antigravity') && isHarnessKey('codex') && !isHarnessKey('agy') && !isHarnessKey(undefined));
});

test('Claude Desktop keeps an enabled state of its own under its key, claude-desktop, and has no model or effort lists', () => {
  assert.ok(isHarnessKey('claude-desktop') && !isHarnessKey('desktop'));
  const disabled = withHarnessEnabled(emptyVariantStore(), FILE, 'claude-desktop', false);
  assert.deepStrictEqual(disabled.harnesses, { 'claude-desktop': { enabled: false } });
  assert.deepStrictEqual(harnessStates(disabled, FILE), { claude: true, antigravity: true, codex: true, 'claude-desktop': false });
  assert.deepStrictEqual(disabledCommands(harnessStates(disabled, FILE)), ['claude-desktop']);
  assert.deepStrictEqual(harnessStates(withHarnessEnabled(disabled, FILE, 'claude-desktop', true), FILE)['claude-desktop'], true);
  assert.deepStrictEqual(Object.keys(harnessLists(emptyVariantStore(), FILE, ['claude --model opus --effort high "/gurita:x"'])), ['claude', 'antigravity', 'codex']);
});

test('a harness part not in its form is refused, naming the file', () => {
  for (const harnesses of [[], 'off', { claude: false }, { codex: { enabled: 'no' } }]) {
    const store = parseVariantStore(JSON.stringify({ harnesses }), FILE);
    assert.throws(() => harnessStates(store, FILE), (error: unknown) => error instanceof VariantStoreError && error.message.includes(FILE));
    assert.throws(() => withHarnessEnabled(store, FILE, 'claude', false), VariantStoreError);
  }
});

test('enabling or disabling a harness keeps every other value of the harness part and of the store as read', () => {
  const store = parseVariantStore(
    JSON.stringify({
      variants: [{ recipe: 'First run', name: 'Copy', lines: ['echo one'] }],
      defaults: [{ recipe: 'First run', name: 'Copy', origin: 'stored' }],
      harnesses: { claude: { models: ['opus'] }, kept: ['as', 'read'] },
    }),
    FILE,
  );
  const disabled = withHarnessEnabled(store, FILE, 'claude', false);
  assert.deepStrictEqual(disabled.harnesses, { claude: { models: ['opus'], enabled: false }, kept: ['as', 'read'] });
  assert.deepStrictEqual(disabled.variants, store.variants);
  assert.deepStrictEqual(disabled.defaults, store.defaults);
  assert.deepStrictEqual(store.harnesses, { claude: { models: ['opus'] }, kept: ['as', 'read'] }, 'the store given is not changed');
  const again = withHarnessEnabled(disabled, FILE, 'claude', true);
  assert.deepStrictEqual(harnessStates(again, FILE), { claude: true, antigravity: true, codex: true, 'claude-desktop': true });
});

test('the state is written to the variant store file, created when missing, and read back from it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-harness-settings-'));
  const file = path.join(dir, '.gurita', 'variants.json');
  assert.deepStrictEqual(readHarnessStates(file), { claude: true, antigravity: true, codex: true, 'claude-desktop': true }, 'a missing file disables nothing');
  setHarnessEnabled(file, 'codex', false);
  assert.deepStrictEqual(readHarnessStates(file), { claude: true, antigravity: true, codex: false, 'claude-desktop': true });
  assert.deepStrictEqual(readVariantStore(file).harnesses, { codex: { enabled: false } });
  setHarnessEnabled(file, 'claude', false);
  setHarnessEnabled(file, 'codex', true);
  assert.deepStrictEqual(readHarnessStates(file), { claude: false, antigravity: true, codex: true, 'claude-desktop': true });
  assert.deepStrictEqual(fs.readdirSync(path.join(dir, '.gurita')), ['variants.json'], 'no temporary file is left');
});

/** A shipped file of recipes on each harness, a mixed one, a fixed-name button recipe, and two single-task lines. */
const SHIPPED_TEXT = `## Recipes

### Review

#### Claude Code
\`\`\`
claude -p "/gurita:review-mission-requirements --mission <path>" --model "fable" --effort xhigh;
\`\`\`

#### Antigravity
\`\`\`
agy -p "/gurita:review-mission-requirements --mission <path>" --model "gemini-4-argon" --effort medium;
\`\`\`

#### Mixed
\`\`\`
agy -p "/gurita:review-mission-requirements --mission <path>" --model "gemini-4-argon" --effort medium;
echo between;
claude -p "/gurita:recommend-all-open-questions --mission <path>" --model "fable" --effort xhigh;
\`\`\`

### Antigravity only
\`\`\`
agy -p "/gurita:finish-mission --mission <path>" --model "gemini-4-argon" --effort medium;
\`\`\`

### Shell only
\`\`\`
echo <path>
\`\`\`

### ${BUTTON_RECIPES.answerQuestion}
\`\`\`
agy -p "/gurita:answer-open-question --mission <path> <Short Title>. <answer text>" --model "gemini-4-argon";
\`\`\`

### Single task (Claude Code)
\`\`\`
claude -p "/gurita:complete-task --mission <path> <Task Title>" --model "opus" --effort high;
\`\`\`

### Single task (Antigravity)
\`\`\`
agy -p "/gurita:complete-task --mission <path> <Task Title>" --model "claude-opus-5-5" --effort high;
\`\`\`
`;

function recipes(): Recipe[] {
  return parseShippedRecipes(SHIPPED_TEXT, '/shipped.md');
}

/** Each listed recipe's name with the variants its dropdown offers and the one it stands on. */
function listed(disabled: ('claude' | 'agy' | 'codex')[], remembered: [string, string][] = [], from: Recipe[] = recipes()): [string, string[], string][] {
  return pageRecipes(from, ['path'], new Map(remembered), disabled).map((entry) => [
    entry.name,
    entry.variants.map((each) => each.name),
    entry.variants[entry.selected].name,
  ]);
}

test('with every harness enabled the page lists every variant, as it does with no disabled harness given', () => {
  assert.deepStrictEqual(listed([]), [
    ['Review', ['Claude Code', 'Antigravity', 'Mixed'], 'Claude Code'],
    ['Antigravity only', ['default'], 'default'],
    ['Shell only', ['default'], 'default'],
  ]);
  assert.deepStrictEqual(pageRecipes(recipes(), ['path']), pageRecipes(recipes(), ['path'], new Map(), []));
});

test('a variant with at least one line on a disabled harness is left out, mixed variants included, and a recipe so left with none loses its button', () => {
  assert.deepStrictEqual(listed(['agy']), [
    ['Review', ['Claude Code'], 'Claude Code'],
    ['Shell only', ['default'], 'default'],
  ]);
  assert.deepStrictEqual(listed(['claude']), [
    ['Review', ['Antigravity'], 'Antigravity'],
    ['Antigravity only', ['default'], 'default'],
    ['Shell only', ['default'], 'default'],
  ]);
  assert.deepStrictEqual(listed(['claude', 'agy', 'codex']), [['Shell only', ['default'], 'default']], 'a line of no harness is never left out');
});

test('a left-out remembered variant or default gives way to the default when still listed, else to the first listed variant', () => {
  const picked = (name: string) => recipes().map((recipe) => (recipe.name === 'Review' ? { ...recipe, picked: { name, origin: 'shipped' as const } } : recipe));
  assert.deepStrictEqual(listed(['claude'], [['Review', 'Mixed']], picked('Antigravity'))[0], ['Review', ['Antigravity'], 'Antigravity'], 'the default, still listed');
  assert.deepStrictEqual(listed(['agy'], [['Review', 'Mixed']], picked('Antigravity'))[0], ['Review', ['Claude Code'], 'Claude Code'], 'the first listed');
  assert.deepStrictEqual(listed(['agy'], [], picked('Mixed'))[0], ['Review', ['Claude Code'], 'Claude Code'], 'a left-out default: the first listed');
  assert.deepStrictEqual(listed([], [['Review', 'Mixed']], picked('Antigravity'))[0], ['Review', ['Claude Code', 'Antigravity', 'Mixed'], 'Mixed'], 'enabled again, the remembered selection comes back');
});

test("disabling leaves a fixed-name button's variants on that harness out of its dropdown, a button so left with none standing with no variant, and the named single-task lines as they are", () => {
  const button = buttonRecipe(recipes(), BUTTON_RECIPES.answerQuestion, ['path', 'Short Title', 'answer text']);
  assert.ok(button.state === 'found');
  assert.match(button.variant.lines[0], /^agy /, 'with every harness enabled the button offers its Antigravity line');
  assert.deepStrictEqual(buttonRecipe(recipes(), BUTTON_RECIPES.answerQuestion, ['path', 'Short Title', 'answer text'], undefined, ['claude']).state, 'found');
  const left = buttonRecipe(recipes(), BUTTON_RECIPES.answerQuestion, ['path', 'Short Title', 'answer text'], undefined, ['agy']);
  assert.ok(left.state === 'disabled', 'its one variant on a disabled harness leaves the button with none');
  assert.strictEqual(left.recipe.name, BUTTON_RECIPES.answerQuestion);
  assert.match(left.cause, /disabled harness/);
  assert.deepStrictEqual(
    singleTaskLines(recipes()).map((line) => line.name),
    ['Single task (Claude Code)', 'Single task (Antigravity)'],
  );
});

test("a fixed-name button's dropdown stands on the remembered variant, else the default, else the first offered, and offers only the variants it can run", () => {
  const text = `## Recipes

### ${BUTTON_RECIPES.discussQuestion}
#### Claude Code
\`\`\`
claude "/gurita:discuss-open-question --mission <path> <Short Title>. <note>" --model "fable"; # interactive
\`\`\`

#### Antigravity
\`\`\`
agy -i "/gurita:discuss-open-question --mission <path> <Short Title>. <note>" --model "gemini-4-argon"; # interactive
\`\`\`

#### Unfillable
\`\`\`
claude "/gurita:discuss-open-question --mission <path> <Task Title>"; # interactive
\`\`\`

#### Mixed
\`\`\`
agy -p "/gurita:review-mission-requirements --mission <path>";
claude "/gurita:discuss-open-question --mission <path> <Short Title>"; # interactive
\`\`\`
`;
  const from = parseShippedRecipes(text, '/shipped.md');
  const picked = (name: string) => from.map((recipe) => ({ ...recipe, picked: { name, origin: 'shipped' as const } }));
  const offered = (list: Recipe[], remembered?: string, disabled: ('claude' | 'agy' | 'codex')[] = []): [string[], string] => {
    const found = buttonRecipe(list, BUTTON_RECIPES.discussQuestion, ['path', 'Short Title', 'note'], remembered, disabled);
    assert.ok(found.state === 'found');
    assert.strictEqual(found.variant, found.variants[found.selected]);
    return [found.variants.map((each) => each.name), found.variant.name];
  };
  const all = ['Claude Code', 'Antigravity', 'Mixed'];
  assert.deepStrictEqual(offered(from), [all, 'Claude Code'], 'a variant the button cannot fill is not offered; nothing remembered, the first');
  assert.deepStrictEqual(offered(picked('Antigravity')), [all, 'Antigravity'], 'the default picked');
  assert.deepStrictEqual(offered(picked('Antigravity'), 'Mixed'), [all, 'Mixed'], 'a remembered selection wins over the default');
  assert.deepStrictEqual(offered(picked('Antigravity'), 'Gone'), [all, 'Antigravity'], 'a remembered variant the recipe lacks gives way to the default');
  assert.deepStrictEqual(offered(picked('Antigravity'), 'Mixed', ['agy']), [['Claude Code'], 'Claude Code'], 'on a disabled harness the remembered one and the default give way to the first offered');
  assert.deepStrictEqual(offered(picked('Antigravity'), 'Claude Code', ['claude']), [['Antigravity'], 'Antigravity']);
  assert.deepStrictEqual(offered(picked('Unfillable')), [all, 'Claude Code'], 'a default the button cannot run gives way to the first offered');
  assert.strictEqual(buttonRecipe(from, BUTTON_RECIPES.discussQuestion, ['path', 'Short Title', 'note'], undefined, ['claude', 'agy']).state, 'disabled');
});
