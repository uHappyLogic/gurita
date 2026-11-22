import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  BUTTON_RECIPES,
  buttonRecipe,
  declaredStage,
  firstVariant,
  isHeadless,
  mergeRecipes,
  ownRecipesFile,
  PAIRED_STAGES,
  pageRecipes,
  parseOwnRecipes,
  parseShippedRecipes,
  readRecipes,
  Recipe,
  SLOT_LINE,
  STAGE_NAMES,
  stageRecipes,
  Variant,
} from '../recipes';
import { WORKFLOW_STEPS, WorkflowStep } from '../workflow';

const FIXTURES = path.join(__dirname, '..', '..', 'src', 'test', 'fixtures', 'recipes');
const SHIPPED = path.join(FIXTURES, 'shipped.md');
const OWN = path.join(FIXTURES, 'own.md');
const SNIPPETS = path.join(__dirname, '..', '..', '..', 'snippets', 'GURITA_USAGE.md');

function shipped(): Recipe[] {
  return parseShippedRecipes(fs.readFileSync(SHIPPED, 'utf8'), SHIPPED);
}

function own(): Recipe[] {
  return parseOwnRecipes(fs.readFileSync(OWN, 'utf8'), OWN);
}

function byName(recipes: Recipe[], name: string): Recipe {
  const found = recipes.find((recipe) => recipe.name === name);
  assert.ok(found, `no recipe named ${name}`);
  return found;
}

/** The first variant of the recipe named `name`, the one a recipe runs until a variant can be chosen. */
function runs(recipes: Recipe[], name: string): Variant {
  return firstVariant(byName(recipes, name));
}

/** Each recipe's group, name, and variants, each variant by its name and whether it is the person's own. */
function outline(recipes: Recipe[]): [string, string, [string, boolean][]][] {
  return recipes.map((recipe) => [recipe.group, recipe.name, recipe.variants.map((variant): [string, boolean] => [variant.name, variant.own])]);
}

test('the shipped file yields only the blocks under its recipe section, each in the shipped group', () => {
  const names = shipped().map((recipe) => [recipe.group, recipe.name]);
  assert.deepStrictEqual(names, [
    ['shipped', 'Chain'],
    ['shipped', 'Loop'],
    ['shipped', 'Single task (Claude Code)'],
    ['shipped', 'Interactive task line'],
    ['shipped', 'answer-open-question'],
    ['shipped', 'Fenced heading'],
    ['shipped', 'Variants'],
    ['shipped', 'Single task (Antigravity)'],
    ['shipped', 'Two fences'],
    ['shipped', 'Block before variants'],
  ]);
  assert.ok(!shipped().some((recipe) => recipe.name === 'Under a retired host heading'), 'a retired host heading is not read');
});

test('a recipe of one block and no #### holds its first fenced block, as written, as its one variant', () => {
  const recipes = shipped();
  assert.deepStrictEqual(outline([byName(recipes, 'Chain')]), [['shipped', 'Chain', [['Chain', false]]]]);
  assert.deepStrictEqual(runs(recipes, 'Chain').lines, [
    'claude -p "/gurita:review-mission-requirements --mission <path>" --model "fable";',
    'claude "/gurita:recommend-all-open-questions --mission <path>" --model "fable"; # interactive',
  ]);
  assert.deepStrictEqual(runs(recipes, 'Single task (Antigravity)').lines, [
    'agy -p "/gurita:complete-task --mission <path> <Task Title>" --model "claude-opus-5-5";',
  ]);
  assert.deepStrictEqual(byName(recipes, 'Two fences').variants.length, 1);
  assert.deepStrictEqual(runs(recipes, 'Two fences').lines, ['agy -p "/gurita:derive-tasks --mission <path>";']);
  assert.strictEqual(runs(recipes, 'Chain').file, SHIPPED);
  assert.strictEqual(runs(recipes, 'Chain').own, false);
});

test('a recipe holds one variant per #### sub-heading, each its first fenced block, the first of a repeated name kept', () => {
  const recipe = byName(shipped(), 'Variants');
  assert.deepStrictEqual(outline([recipe]), [
    ['shipped', 'Variants', [['On Claude Code', false], ['On Antigravity', false], ['Empty variant', false]]],
  ]);
  assert.deepStrictEqual(
    recipe.variants.map((variant) => variant.lines),
    [
      ['claude -p "/gurita:complete-all-tasks --mission <path>" --model "opus" --effort high;'],
      ['agy -p "/gurita:complete-all-tasks --mission <path>" --model "claude-opus-5-5" --effort high;'],
      [],
    ],
  );
  for (const variant of recipe.variants) {
    assert.strictEqual(variant.file, SHIPPED);
    assert.deepStrictEqual(variant.unknownPlaceholders, []);
  }
  assert.deepStrictEqual(recipe.variants[0].knownPlaceholders, ['path']);
  assert.deepStrictEqual(recipe.variants[2].knownPlaceholders, []);
  assert.strictEqual(recipe.stage, 'execute', 'the stage line stands once for the whole recipe, and one under a variant is not read');
});

test('once a recipe holds a #### sub-heading, a block above its first sub-heading is not read', () => {
  const recipe = byName(shipped(), 'Block before variants');
  assert.deepStrictEqual(outline([recipe]), [['shipped', 'Block before variants', [['Only variant', false]]]]);
  assert.deepStrictEqual(firstVariant(recipe).lines, ['agy -p "/gurita:finish-mission --mission <path>";']);
});

test('a #### sub-heading outside any recipe is not read, and a heading with no fence beneath it holds no line', () => {
  const recipes = parseOwnRecipes(
    '#### Above every recipe\n```\necho above\n```\n### Recipe\n#### Bare\n## Section\n#### Under a section\n```\necho under\n```\n### No fence\n',
    OWN,
  );
  assert.deepStrictEqual(outline(recipes), [
    ['own', 'Recipe', [['Bare', true]]],
    ['own', 'No fence', [['No fence', true]]],
  ]);
  assert.deepStrictEqual(firstVariant(recipes[0]).lines, []);
  assert.deepStrictEqual(firstVariant(recipes[1]).lines, []);
});

test('heading lines inside a fence are lines of the recipe, not headings', () => {
  assert.deepStrictEqual(runs(shipped(), 'Fenced heading').lines, [
    '## Not a heading',
    '### Not a recipe',
    '#### Not a variant',
    'echo <mystery thing> <path>',
  ]);
});

test('a single-task line is exactly one headless line holding <Task Title>', () => {
  const recipes = shipped();
  const single = recipes.filter((recipe) => firstVariant(recipe).singleTask).map((recipe) => recipe.name);
  assert.deepStrictEqual(single, ['Single task (Claude Code)', 'Single task (Antigravity)']);
  assert.strictEqual(runs(recipes, 'Interactive task line').singleTask, false);
  assert.strictEqual(runs(recipes, 'answer-open-question').singleTask, false);
  assert.strictEqual(runs(own(), 'My first own recipe').singleTask, false);
  assert.strictEqual(runs(own(), 'Single task (Antigravity)').singleTask, true);
});

test('a line is headless when it holds a gurita: invocation and no # interactive mark', () => {
  assert.strictEqual(isHeadless('claude -p "/gurita:derive-tasks --mission <path>";'), true);
  assert.strictEqual(isHeadless("codex exec '$gurita:derive-tasks --mission <path>';"), true);
  assert.strictEqual(isHeadless('claude "/gurita:derive-tasks --mission <path>"; # interactive'), false);
  assert.strictEqual(isHeadless('claude-wait;'), false);
});

test('the looped recipe is the one whose last line is the slot line', () => {
  const recipes = shipped();
  assert.deepStrictEqual(
    recipes.filter((recipe) => firstVariant(recipe).looped).map((recipe) => recipe.name),
    ['Loop'],
  );
  const loop = runs(recipes, 'Loop');
  assert.deepStrictEqual(loop.lines, ['source .env_fixture', '<single-task line>']);
  assert.deepStrictEqual(loop.knownPlaceholders, []);
  assert.deepStrictEqual(loop.unknownPlaceholders, []);
});

test('placeholders are split into known and unknown, each named once in order of appearance', () => {
  const answer = runs(shipped(), 'answer-open-question');
  assert.deepStrictEqual(answer.knownPlaceholders, ['path', 'Short Title', 'answer text']);
  assert.deepStrictEqual(answer.unknownPlaceholders, []);
  const fenced = runs(shipped(), 'Fenced heading');
  assert.deepStrictEqual(fenced.knownPlaceholders, ['path']);
  assert.deepStrictEqual(fenced.unknownPlaceholders, ['mystery thing']);
  const second = runs(own(), 'My second own recipe');
  assert.deepStrictEqual(second.knownPlaceholders, ['scope']);
  assert.deepStrictEqual(second.unknownPlaceholders, ['unknown one']);
});

test('the own file is a flat list of ### recipes in the same variant form, the first of a repeated name kept', () => {
  const recipes = own();
  assert.deepStrictEqual(outline(recipes), [
    ['own', 'Chain', [['Chain', true]]],
    ['own', 'My first own recipe', [['My first own recipe', true]]],
    ['own', 'Single task (Antigravity)', [['Single task (Antigravity)', true]]],
    ['own', 'My second own recipe', [['My second own recipe', true]]],
    ['own', 'Variants', [['On Claude Code', true], ['Own variant', true]]],
    ['own', 'My variant recipe', [['First', true], ['Second', true]]],
  ]);
  assert.deepStrictEqual(runs(recipes, 'Chain').lines, [
    'claude-wait;',
    'claude -p "/gurita:review-mission-requirements --mission <path>" --model "opus";',
  ]);
  const variants = byName(recipes, 'My variant recipe');
  assert.deepStrictEqual(variants.variants.map((variant) => variant.lines), [['echo first <path>'], ['echo second <Task Title>']]);
  assert.deepStrictEqual(variants.variants.map((variant) => variant.knownPlaceholders), [['path'], ['Task Title']]);
  assert.ok(variants.variants.every((variant) => variant.file === OWN));
  assert.strictEqual(variants.stage, 'finish');
});

test('an own recipe carrying a shipped name joins it as further variants, the rest following in file order', () => {
  const merged = mergeRecipes(shipped(), own());
  assert.deepStrictEqual(outline(merged), [
    ['shipped', 'Chain', [['Chain', false], ['Chain', true]]],
    ['shipped', 'Loop', [['Loop', false]]],
    ['shipped', 'Single task (Claude Code)', [['Single task (Claude Code)', false]]],
    ['shipped', 'Interactive task line', [['Interactive task line', false]]],
    ['shipped', 'answer-open-question', [['answer-open-question', false]]],
    ['shipped', 'Fenced heading', [['Fenced heading', false]]],
    [
      'shipped',
      'Variants',
      [['On Claude Code', false], ['On Antigravity', false], ['Empty variant', false], ['On Claude Code', true], ['Own variant', true]],
    ],
    ['shipped', 'Single task (Antigravity)', [['Single task (Antigravity)', false], ['Single task (Antigravity)', true]]],
    ['shipped', 'Two fences', [['Two fences', false]]],
    ['shipped', 'Block before variants', [['Only variant', false]]],
    ['own', 'My first own recipe', [['My first own recipe', true]]],
    ['own', 'My second own recipe', [['My second own recipe', true]]],
    ['own', 'My variant recipe', [['First', true], ['Second', true]]],
  ]);
  assert.deepStrictEqual(
    byName(merged, 'Single task (Antigravity)').variants.map((variant) => [variant.file, variant.lines]),
    [
      [SHIPPED, ['agy -p "/gurita:complete-task --mission <path> <Task Title>" --model "claude-opus-5-5";']],
      [OWN, ["codex exec '$gurita:complete-task --mission <path> <Task Title>';"]],
    ],
  );
  const twins = byName(merged, 'Variants').variants.filter((variant) => variant.name === 'On Claude Code');
  assert.deepStrictEqual(
    twins.map((variant) => [variant.own, variant.lines]),
    [
      [false, ['claude -p "/gurita:complete-all-tasks --mission <path>" --model "opus" --effort high;']],
      [true, ['claude -p "/gurita:complete-all-tasks --mission <path>" --model "fable" --effort xhigh;']],
    ],
    'an own variant carrying a shipped variant\'s name is kept beside it',
  );
  assert.deepStrictEqual(runs(merged, 'Chain'), runs(shipped(), 'Chain'), 'the first variant stays the shipped one');
});

test("the merged list keeps the shipped file's order, and no recipe under any other heading is read", () => {
  const text =
    '## Recipes\n\n### B\n```\necho b\n```\n\n## Claude Code\n\n### A\n```\necho a\n```\n\n## Recipes\n\n### C\n```\necho c\n```\n\n## Antigravity\n\n### D\n```\necho d\n```\n';
  const merged = mergeRecipes(parseShippedRecipes(text, SHIPPED), parseOwnRecipes('### Mine\n```\necho mine\n```\n', OWN));
  assert.deepStrictEqual(
    merged.map((recipe) => [recipe.group, recipe.name]),
    [
      ['shipped', 'B'],
      ['shipped', 'C'],
      ['own', 'Mine'],
    ],
  );
});

test('readRecipes reads both files and treats a missing own file as holding no recipe', () => {
  assert.deepStrictEqual(readRecipes(SHIPPED, OWN), mergeRecipes(shipped(), own()));
  assert.deepStrictEqual(readRecipes(SHIPPED), shipped());
  const missing = path.join(os.tmpdir(), `gurita-no-such-recipes-${process.pid}.md`);
  assert.deepStrictEqual(readRecipes(SHIPPED, missing), shipped());
});

test('CRLF line ends are read like LF ones', () => {
  const text = fs.readFileSync(SHIPPED, 'utf8').replace(/\n/g, '\r\n');
  assert.deepStrictEqual(parseShippedRecipes(text, SHIPPED), shipped());
});

/** The stage the one recipe of an own-file text declares, or undefined when it is undeclared. */
function stageOf(text: string): string | undefined {
  const recipes = parseOwnRecipes(text, OWN);
  assert.strictEqual(recipes.length, 1);
  return recipes[0].stage;
}

test('the stage names are the diagram labels of every step but define, each declaring its step', () => {
  assert.deepStrictEqual([...STAGE_NAMES], [
    ['first review round', 'first-review'],
    ['additional review round', 'additional-review'],
    ['derive tasks', 'derive'],
    ['execute tasks', 'execute'],
    ['follow up tasks', 'follow-up'],
    ['finish', 'finish'],
  ]);
  assert.deepStrictEqual([...STAGE_NAMES.values()], WORKFLOW_STEPS.filter((step) => step !== 'define'));
  for (const [name, step] of STAGE_NAMES) {
    assert.strictEqual(stageOf(`### Recipe\nStage: ${name}\n\`\`\`\necho <path>\n\`\`\`\n`), step);
  }
});

test('a recipe declares its step by one Stage line between its heading and its first fence', () => {
  const recipes = shipped();
  assert.strictEqual(byName(recipes, 'Chain').stage, 'additional-review');
  assert.strictEqual(byName(recipes, 'Loop').stage, 'execute');
  assert.deepStrictEqual(runs(recipes, 'Loop').lines, ['source .env_fixture', '<single-task line>']);
  assert.strictEqual(stageOf('### Recipe\n\nProse first.\nStage:   finish  \n\n```\necho <path>\n```\n'), 'finish');
  assert.strictEqual(stageOf('### Recipe\nStage:derive tasks\n```\necho <path>\n```\n'), 'derive');
});

test('a recipe with no stage line before its first fence is undeclared', () => {
  const recipes = shipped();
  const single = byName(recipes, 'Single task (Claude Code)');
  assert.strictEqual(single.stage, undefined);
  assert.ok(!('stage' in single));
  assert.strictEqual(byName(recipes, 'Two fences').stage, undefined, 'a stage line after the first fence is not read');
  const inFence = parseOwnRecipes('### Recipe\n```\nStage: finish\necho <path>\n```\n', OWN)[0];
  assert.strictEqual(inFence.stage, undefined);
  assert.deepStrictEqual(firstVariant(inFence).lines, ['Stage: finish', 'echo <path>']);
  assert.strictEqual(stageOf('### Recipe\n  Stage: finish\n```\necho <path>\n```\n'), undefined);
  assert.strictEqual(stageOf('Stage: finish\n### Recipe\n```\necho <path>\n```\n'), undefined);
  assert.strictEqual(stageOf('### Recipe\n```\necho <path>\n```\n## Next\nStage: finish\n'), undefined);
  assert.strictEqual(stageOf('### Recipe\n#### Variant\nStage: finish\n```\necho <path>\n```\n'), undefined);
  assert.strictEqual(stageOf('### Recipe\nStage: finish\n#### Variant\n```\necho <path>\n```\n'), 'finish');
});

test('a stage line naming a step the reader does not know, or more than one stage line, counts as undeclared', () => {
  assert.strictEqual(byName(shipped(), 'Single task (Antigravity)').stage, undefined);
  assert.strictEqual(byName(own(), 'My second own recipe').stage, undefined);
  for (const name of ['define', 'Execute Tasks', 'execute', 'execute  tasks', 'deploy', '']) {
    assert.strictEqual(stageOf(`### Recipe\nStage: ${name}\n\`\`\`\necho <path>\n\`\`\`\n`), undefined, name);
  }
  assert.strictEqual(stageOf('### Recipe\nStage: finish\nStage: finish\n```\necho <path>\n```\n'), undefined);
  assert.strictEqual(stageOf('### Recipe\nStage: finish\nStage: derive tasks\n```\necho <path>\n```\n'), undefined);
  assert.strictEqual(declaredStage(['execute tasks']), 'execute');
  assert.strictEqual(declaredStage([]), undefined);
  assert.strictEqual(declaredStage(['constructor']), undefined);
});

test('an own recipe declares its stage the same way, and one joining a shipped recipe keeps the shipped declaration', () => {
  assert.strictEqual(byName(own(), 'My first own recipe').stage, 'execute');
  assert.strictEqual(byName(own(), 'Chain').stage, undefined);
  assert.strictEqual(byName(own(), 'Variants').stage, 'finish');
  const merged = mergeRecipes(shipped(), own());
  assert.strictEqual(byName(merged, 'Chain').stage, 'additional-review');
  assert.strictEqual(byName(merged, 'Variants').stage, 'execute');
  assert.strictEqual(byName(merged, 'Loop').stage, 'execute');
  assert.strictEqual(byName(merged, 'My first own recipe').stage, 'execute');
  assert.strictEqual(byName(readRecipes(SHIPPED, OWN), 'My first own recipe').stage, 'execute');
});

/** Every `###` block of a Markdown text that stands under its recipe section, with its stage lines' count. */
function stageLineCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  let section: string | undefined;
  let name: string | undefined;
  let inFence = false;
  let fenceRead = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('```')) {
      inFence = !inFence;
      fenceRead = fenceRead || !inFence;
    } else if (inFence) {
      continue;
    } else if (line.startsWith('### ')) {
      name = section === 'Recipes' ? line.slice(4).trim() : undefined;
      fenceRead = false;
      if (name !== undefined) {
        counts.set(name, 0);
      }
    } else if (line.startsWith('## ')) {
      section = line.slice(3).trim();
      name = undefined;
    } else if (name !== undefined && /^\s*Stage\s*:/i.test(line)) {
      assert.ok(!fenceRead, `${name} holds a stage line after its fence`);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return counts;
}

test('every shipped chain declares exactly one step, and no shipped recipe declares follow up tasks', () => {
  const recipes = parseShippedRecipes(fs.readFileSync(SNIPPETS, 'utf8'), SNIPPETS);
  const buttons: readonly string[] = Object.values(BUTTON_RECIPES);
  const chains = recipes.filter((recipe) => !buttons.includes(recipe.name) && !firstVariant(recipe).singleTask);
  assert.deepStrictEqual(
    chains.map((recipe) => [recipe.group, recipe.name, recipe.stage]),
    [
      ['shipped', 'First run', 'first-review'],
      ['shipped', 'Requirements iteration', 'additional-review'],
      ['shipped', 'Mixed-agent requirements review (Gemini reviews, Claude annotates)', 'additional-review'],
      ['shipped', 'Prepare tasks', 'derive'],
      ['shipped', 'Execute tasks', 'execute'],
      ['shipped', 'Execute tasks one at a time', 'execute'],
      ['shipped', 'Finish mission', 'finish'],
    ],
  );
  const counts = stageLineCounts(fs.readFileSync(SNIPPETS, 'utf8'));
  assert.deepStrictEqual([...counts.keys()], recipes.map((recipe) => recipe.name));
  for (const recipe of recipes) {
    const declares = chains.includes(recipe);
    assert.strictEqual(counts.get(recipe.name), declares ? 1 : 0, recipe.name);
    if (!declares) {
      assert.strictEqual(recipe.stage, undefined, recipe.name);
    }
  }
  assert.ok(!recipes.some((recipe) => recipe.stage === 'follow-up'));
  assert.ok(!recipes.some((recipe) => /extra requirement surface stretch/i.test(recipe.name)));
});

test('no shipped execute variant holds a derive-tasks line, each holding its complete-all-tasks line alone or the slot line', () => {
  const recipes = parseShippedRecipes(fs.readFileSync(SNIPPETS, 'utf8'), SNIPPETS);
  const execute = recipes.filter((recipe) => recipe.stage === 'execute');
  assert.deepStrictEqual(execute.map((recipe) => recipe.name), ['Execute tasks', 'Execute tasks one at a time']);
  for (const recipe of execute) {
    for (const variant of recipe.variants) {
      const lines = variant.lines;
      assert.ok(!lines.some((line) => line.includes('gurita:derive-tasks')), `${recipe.name} / ${variant.name}`);
      assert.strictEqual(lines.length, 1, `${recipe.name} / ${variant.name}`);
      assert.ok(lines[0] === SLOT_LINE || lines[0].includes('/gurita:complete-all-tasks --mission <path>"'), `${recipe.name} / ${variant.name}`);
    }
  }
  assert.deepStrictEqual(
    byName(recipes, 'Execute tasks').variants.map((variant) => [variant.name, variant.lines]),
    [
      ['Claude Code', ['claude "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "opus" --effort high; # interactive']],
      ['Antigravity', ['agy -i "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort high; # interactive']],
      [
        'Claude Code (critical tasks)',
        ['claude "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "opus" --effort xhigh; # interactive'],
      ],
    ],
    'one execution recipe, its variants Claude Code at high, Antigravity at high, and Claude Code at xhigh',
  );
  for (const retired of ['Execute tasks of normal difficulty', 'Execute tasks (critical tasks)']) {
    assert.ok(!recipes.some((recipe) => recipe.name.startsWith(retired)), retired);
  }
  assert.deepStrictEqual(byName(recipes, 'Execute tasks one at a time').variants.map((variant) => [variant.name, variant.lines]), [
    ['Execute tasks one at a time', [SLOT_LINE]],
  ]);
});

test('each shipped chain run on two harnesses is one recipe with a Claude Code and an Antigravity variant, no chain heading naming a harness', () => {
  const recipes = parseShippedRecipes(fs.readFileSync(SNIPPETS, 'utf8'), SNIPPETS);
  const variants = (name: string) =>
    byName(recipes, name).variants.map((variant) => [variant.name, variant.lines.map((line) => line.split(' ')[0])]);
  assert.deepStrictEqual(variants('First run'), [
    ['Claude Code', ['claude', 'claude', 'claude', 'claude']],
    ['Antigravity', ['agy', 'agy', 'agy', 'agy']],
  ]);
  assert.deepStrictEqual(variants('Requirements iteration'), [
    ['Claude Code', ['claude', 'claude', 'claude', 'claude']],
    ['Antigravity', ['agy', 'agy', 'agy', 'agy']],
  ]);
  assert.deepStrictEqual(variants('Prepare tasks'), [
    ['Claude Code', ['claude', 'claude']],
    ['Antigravity', ['agy', 'agy']],
  ]);
  assert.deepStrictEqual(variants('Finish mission'), [
    ['Claude Code', ['claude']],
    ['Antigravity', ['agy']],
  ]);
  assert.deepStrictEqual(variants('Mixed-agent requirements review (Gemini reviews, Claude annotates)'), [
    ['Mixed-agent requirements review (Gemini reviews, Claude annotates)', ['agy', 'claude', 'claude', 'claude']],
  ]);
  const single = recipes.filter((recipe) => firstVariant(recipe).singleTask);
  assert.deepStrictEqual(
    single.map((recipe) => [recipe.name, recipe.variants.length]),
    [
      ['Single task with Opus xHigh (Claude Code)', 1],
      ['Single task with Opus High (Claude Code)', 1],
      ['Single task with Opus High (Antigravity)', 1],
    ],
  );
  const named = recipes.filter((recipe) => /\((Claude Code|Antigravity)\)$/.test(recipe.name)).map((recipe) => recipe.name);
  assert.deepStrictEqual(named, single.map((recipe) => recipe.name), 'only the single-task lines name their harness in the heading');
  for (const name of Object.values(BUTTON_RECIPES)) {
    assert.deepStrictEqual(byName(recipes, name).variants.map((variant) => variant.name), [name], name);
  }
});

test("every single-task line this repository's rule file names is a shipped single-task heading", () => {
  const recipes = parseShippedRecipes(fs.readFileSync(SNIPPETS, 'utf8'), SNIPPETS);
  const rules = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'task_line_rules.txt'), 'utf8');
  const named = new Set(
    rules
      .split('\n')
      .filter((line) => line.trim() !== '' && !line.startsWith('#') && line.includes(' -> '))
      .map((line) => line.slice(line.lastIndexOf(' -> ') + 4).trim()),
  );
  assert.deepStrictEqual([...named], ['Single task with Opus xHigh (Claude Code)', 'Single task with Opus High (Claude Code)']);
  for (const name of named) {
    assert.strictEqual(firstVariant(byName(recipes, name)).singleTask, true, name);
  }
});

/**
 * An own-file list of one undeclared recipe, then one recipe declaring each step a stage line can
 * name, in the diagram's order, each named by the stage it declares, then one whose stage line
 * names a step the reader does not know.
 */
function staged(): Recipe[] {
  const declared = [...STAGE_NAMES.keys()].map((name) => `### ${name}\nStage: ${name}\n\`\`\`\necho ${name} <path>\n\`\`\`\n`);
  const text = ['### Undeclared\n```\necho <path>\n```\n', ...declared, '### Unknown stage\nStage: deploy\n```\necho <path>\n```\n'].join('\n');
  return parseOwnRecipes(text, OWN);
}

/** The names of the recipes of `staged` a page whose diagram fills `step` lists. */
function listedAt(step: WorkflowStep | undefined): string[] {
  return stageRecipes(staged(), step).map((recipe) => recipe.name);
}

test('a page whose diagram fills a step lists the recipes declaring it and every undeclared recipe', () => {
  assert.deepStrictEqual(
    staged().map((recipe) => [recipe.name, recipe.stage]),
    [
      ['Undeclared', undefined],
      ['first review round', 'first-review'],
      ['additional review round', 'additional-review'],
      ['derive tasks', 'derive'],
      ['execute tasks', 'execute'],
      ['follow up tasks', 'follow-up'],
      ['finish', 'finish'],
      ['Unknown stage', undefined],
    ],
  );
  assert.deepStrictEqual(listedAt('first-review'), ['Undeclared', 'first review round', 'Unknown stage']);
  assert.deepStrictEqual(listedAt('additional-review'), ['Undeclared', 'additional review round', 'Unknown stage']);
  assert.deepStrictEqual(listedAt('execute'), ['Undeclared', 'execute tasks', 'Unknown stage']);
  assert.deepStrictEqual(listedAt('follow-up'), ['Undeclared', 'follow up tasks', 'Unknown stage']);
  assert.deepStrictEqual(listedAt('define'), ['Undeclared', 'Unknown stage']);
});

test("derive tasks lists the additional review round's recipes beside its own, and finish follow up tasks'", () => {
  assert.deepStrictEqual([...PAIRED_STAGES], [
    ['derive', 'additional-review'],
    ['finish', 'follow-up'],
  ]);
  assert.deepStrictEqual(listedAt('derive'), ['Undeclared', 'additional review round', 'derive tasks', 'Unknown stage']);
  assert.deepStrictEqual(listedAt('finish'), ['Undeclared', 'follow up tasks', 'finish', 'Unknown stage']);
  assert.ok(!listedAt('additional-review').includes('derive tasks'), 'the pair lists the optional step beside the filled one only');
  assert.ok(!listedAt('follow-up').includes('finish'), 'the pair lists the optional step beside the filled one only');
});

test('an undeclared recipe is listed whatever the step, and a page with no step chosen lists every recipe in order', () => {
  for (const step of [...WORKFLOW_STEPS, undefined]) {
    assert.ok(listedAt(step).includes('Undeclared'), String(step));
    assert.ok(listedAt(step).includes('Unknown stage'), String(step));
  }
  const recipes = staged();
  const every = stageRecipes(recipes, undefined);
  assert.deepStrictEqual(every, recipes);
  assert.notStrictEqual(every, recipes, 'a fresh list');
  assert.deepStrictEqual(stageRecipes([], 'execute'), []);
});

test('the stage filter holds the shipped recipes, the own group, and the unfillable-placeholder rule within it', () => {
  const merged = mergeRecipes(shipped(), own());
  const at = (step: WorkflowStep | undefined) =>
    pageRecipes(stageRecipes(merged, step), ['path']).map((entry) => [entry.kind, entry.group, entry.name]);
  const every = [
    ['runnable', 'shipped', 'Chain'],
    ['looped', 'shipped', 'Loop'],
    ['unknown', 'shipped', 'Fenced heading'],
    ['runnable', 'shipped', 'Variants'],
    ['runnable', 'shipped', 'Two fences'],
    ['runnable', 'shipped', 'Block before variants'],
    ['unknown', 'own', 'My second own recipe'],
    ['runnable', 'own', 'My variant recipe'],
  ];
  const without = (...names: string[]) => every.filter(([, , name]) => !names.includes(name));
  assert.deepStrictEqual(at(undefined), every);
  assert.deepStrictEqual(at('execute'), without('Chain', 'My variant recipe'), 'Chain keeps its shipped stage beside its own variant');
  assert.deepStrictEqual(at('finish'), without('Chain', 'Loop', 'Variants'), 'Variants keeps its shipped stage, not the own one');
  const declared = (step: WorkflowStep | undefined) =>
    pageRecipes(stageRecipes(shipped(), step), ['path']).map((entry) => entry.name);
  assert.deepStrictEqual(declared('derive'), ['Chain', 'Fenced heading', 'Two fences', 'Block before variants']);
  assert.deepStrictEqual(declared('execute'), ['Loop', 'Fenced heading', 'Variants', 'Two fences', 'Block before variants']);
  assert.deepStrictEqual(declared('first-review'), ['Fenced heading', 'Two fences', 'Block before variants']);
});

test('each step lists exactly the shipped chains that fit it, and no step chosen lists every chain', () => {
  const recipes = parseShippedRecipes(fs.readFileSync(SNIPPETS, 'utf8'), SNIPPETS);
  const at = (step: WorkflowStep | undefined) =>
    pageRecipes(stageRecipes(recipes, step), ['path']).map((entry) => [entry.group, entry.name]);
  const review = [
    ['shipped', 'Requirements iteration'],
    ['shipped', 'Mixed-agent requirements review (Gemini reviews, Claude annotates)'],
  ];
  assert.deepStrictEqual(at('first-review'), [['shipped', 'First run']]);
  assert.deepStrictEqual(at('additional-review'), review, 'the additional review round lists Requirements iteration and the mixed-agent recipe');
  assert.deepStrictEqual(at('derive'), [
    ['shipped', 'Requirements iteration'],
    ['shipped', 'Mixed-agent requirements review (Gemini reviews, Claude annotates)'],
    ['shipped', 'Prepare tasks'],
  ]);
  assert.deepStrictEqual(at('execute'), [
    ['shipped', 'Execute tasks'],
    ['shipped', 'Execute tasks one at a time'],
  ]);
  assert.deepStrictEqual(at('finish'), [['shipped', 'Finish mission']]);
  assert.deepStrictEqual(at(undefined), pageRecipes(recipes, ['path']).map((entry) => [entry.group, entry.name]));
  assert.strictEqual(at(undefined).length, 7);
});

test('a page lists the recipes it can fill, in the merged order, each by its default variant with the values its lines carry and the variants its dropdown offers, and names each unknown placeholder and its file', () => {
  const listed = pageRecipes(mergeRecipes(shipped(), own()), ['path']);
  assert.deepStrictEqual(
    listed.map((entry) => [entry.kind, entry.group, entry.name]),
    [
      ['runnable', 'shipped', 'Chain'],
      ['looped', 'shipped', 'Loop'],
      ['unknown', 'shipped', 'Fenced heading'],
      ['runnable', 'shipped', 'Variants'],
      ['runnable', 'shipped', 'Two fences'],
      ['runnable', 'shipped', 'Block before variants'],
      ['unknown', 'own', 'My second own recipe'],
      ['runnable', 'own', 'My variant recipe'],
    ],
  );
  assert.deepStrictEqual(listed[0], {
    kind: 'runnable',
    name: 'Chain',
    group: 'shipped',
    lines: [
      'claude -p "/gurita:review-mission-requirements --mission <path>" --model "fable";',
      'claude "/gurita:recommend-all-open-questions --mission <path>" --model "fable"; # interactive',
    ],
    values: { harnesses: ['claude'], models: ['fable'], efforts: [] },
    variants: [
      { name: 'Chain', own: false },
      { name: 'Chain', own: true },
    ],
    selected: 0,
  });
  assert.deepStrictEqual(listed[3], {
    kind: 'runnable',
    name: 'Variants',
    group: 'shipped',
    lines: ['claude -p "/gurita:complete-all-tasks --mission <path>" --model "opus" --effort high;'],
    values: { harnesses: ['claude'], models: ['opus'], efforts: ['high'] },
    variants: [
      { name: 'On Claude Code', own: false },
      { name: 'On Antigravity', own: false },
      { name: 'On Claude Code', own: true },
      { name: 'Own variant', own: true },
    ],
    selected: 0,
  });
  assert.deepStrictEqual(listed[7], {
    kind: 'runnable',
    name: 'My variant recipe',
    group: 'own',
    lines: ['echo first <path>'],
    values: { harnesses: [], models: [], efforts: [] },
    variants: [{ name: 'First', own: true }],
    selected: 0,
  });
  assert.deepStrictEqual(listed[1], {
    kind: 'looped',
    name: 'Loop',
    group: 'shipped',
    lines: ['source .env_fixture', '<single-task line>'],
    values: { harnesses: [], models: [], efforts: [] },
    variants: [{ name: 'Loop', own: false }],
    selected: 0,
  });
  const fenced = listed[2];
  assert.ok(fenced.kind === 'unknown');
  assert.deepStrictEqual(fenced.placeholders, ['mystery thing']);
  assert.strictEqual(fenced.file, SHIPPED);
  const second = listed[6];
  assert.ok(second.kind === 'unknown');
  assert.deepStrictEqual(second.placeholders, ['unknown one']);
  assert.strictEqual(second.file, OWN);
});

test('a recipe holding a placeholder the page cannot fill is left off, and listed once the page can fill it', () => {
  const names = (fillable: string[]) => pageRecipes(shipped(), fillable).map((entry) => entry.name);
  assert.ok(!names(['path']).includes('answer-open-question'));
  assert.ok(!names(['path']).includes('Single task (Claude Code)'));
  assert.ok(names(['path', 'Task Title']).includes('Single task (Claude Code)'));
  assert.ok(names(['path']).includes('Loop'));
});

test("no recipe a button outside the chains runs by its fixed name is listed, whatever placeholders the page fills", () => {
  const names = (recipes: Recipe[], fillable: string[]) => pageRecipes(recipes, fillable).map((entry) => entry.name);
  assert.ok(!names(shipped(), ['path', 'Short Title', 'answer text']).includes('answer-open-question'));
  const own = parseOwnRecipes('### answer-open-question\n```\necho <path>\n```\n', OWN);
  const merged = mergeRecipes(shipped(), own);
  assert.deepStrictEqual(byName(merged, 'answer-open-question').variants.length, 2, 'the own block joins the button recipe');
  assert.ok(!names(merged, ['path']).includes('answer-open-question'), 'a variant the page could fill draws no dropdown for a button recipe');
  assert.deepStrictEqual(names(own, ['path']), []);
});

test("a page entry's dropdown offers the variants the page can draw and stands on the remembered one, else the default, else the first drawn", () => {
  const merged = mergeRecipes(shipped(), own());
  const entry = (remembered: [string, string][], recipes: Recipe[] = merged) => {
    const found = pageRecipes(recipes, ['path'], new Map(remembered)).find((each) => each.name === 'Variants');
    assert.ok(found !== undefined && found.kind === 'runnable');
    return { variant: found.variants[found.selected], lines: found.lines, values: found.values };
  };
  const antigravity = { name: 'On Antigravity', own: false };
  assert.deepStrictEqual(entry([]).variant, { name: 'On Claude Code', own: false }, 'nothing remembered and no pick: the first variant');
  assert.deepStrictEqual(entry([['Variants', 'Own variant']]), {
    variant: { name: 'Own variant', own: true },
    lines: ["codex exec '$gurita:complete-all-tasks --mission <path>';"],
    values: { harnesses: ['codex'], models: [], efforts: [] },
  });
  assert.deepStrictEqual(entry([['Chain', 'Own variant']]).variant.name, 'On Claude Code', "another recipe's selection is not read");
  const picked = merged.map((recipe) => (recipe.name === 'Variants' ? { ...recipe, picked: { name: 'On Antigravity', origin: 'shipped' as const } } : recipe));
  assert.deepStrictEqual(entry([], picked).variant, antigravity, 'nothing remembered: the picked default');
  assert.deepStrictEqual(entry([['Variants', 'Own variant']], picked).variant.name, 'Own variant', 'a remembered selection wins over the default');
  assert.deepStrictEqual(entry([['Variants', 'Gone']], picked).variant, antigravity, 'a remembered variant the recipe lacks: the default');
  assert.deepStrictEqual(entry([['Variants', 'Empty variant']], picked).variant, antigravity, 'a remembered variant the page cannot draw: the default');
  const unfillable = merged.map((recipe) =>
    recipe.name === 'My variant recipe' ? { ...recipe, picked: { name: 'Second', origin: 'own' as const } } : recipe,
  );
  const mine = pageRecipes(unfillable, ['path']).find((each) => each.name === 'My variant recipe');
  assert.ok(mine !== undefined);
  assert.deepStrictEqual(mine.variants, [{ name: 'First', own: true }], 'a variant the page cannot fill is left out of the dropdown');
  assert.deepStrictEqual(mine.variants[mine.selected].name, 'First', 'a default the page cannot draw gives way to the first drawn');
});

test('a looped recipe is listed as its own kind only when a looped run fills every placeholder it holds', () => {
  const looped = (text: string) =>
    pageRecipes(parseOwnRecipes(text, OWN), ['path']).map((entry) => [entry.kind, entry.name]);
  assert.deepStrictEqual(looped('### Loop\n```\necho <path> <Task Title>\n<single-task line>\n```\n'), [['looped', 'Loop']]);
  assert.deepStrictEqual(looped('### Loop\n```\necho <goal>\n<single-task line>\n```\n'), []);
  assert.deepStrictEqual(looped('### Loop\n```\necho <odd one>\n<single-task line>\n```\n'), [['unknown', 'Loop']]);
});

test('the own recipe file defaults to ~/.gurita/recipes.md and honours the setting, expanding a leading ~', () => {
  assert.strictEqual(ownRecipesFile(undefined, '/home/someone'), '/home/someone/.gurita/recipes.md');
  assert.strictEqual(ownRecipesFile('  ', '/home/someone'), '/home/someone/.gurita/recipes.md');
  assert.strictEqual(ownRecipesFile('~/notes/recipes.md', '/home/someone/'), '/home/someone/notes/recipes.md');
  assert.strictEqual(ownRecipesFile('/srv/recipes.md', '/home/someone'), '/srv/recipes.md');
  assert.strictEqual(ownRecipesFile('$HOME/recipes.md', '/home/someone'), '$HOME/recipes.md');
});

test('the button recipes carry the seven fixed names, each the bare name of its skill', () => {
  assert.deepStrictEqual(Object.values(BUTTON_RECIPES), [
    'discuss-open-question',
    'answer-open-question',
    'answer-open-question-with-recommendation',
    'answer-open-question-with-alternative',
    'discuss-mission-goal',
    'define-mission-goal',
    'discuss-new-task',
  ]);
});

test('a discuss-new-task recipe holds the issue description as a known placeholder and runs from the new-task button only', () => {
  const recipes = parseShippedRecipes(
    '## Recipes\n\n### discuss-new-task\n```\nclaude "/gurita:discuss-new-task --mission <path> <issue description>" --model "fable"; # interactive\n```\n',
    SHIPPED,
  );
  const recipe = runs(recipes, BUTTON_RECIPES.discussTask);
  assert.deepStrictEqual(recipe.knownPlaceholders, ['path', 'issue description']);
  assert.deepStrictEqual(recipe.unknownPlaceholders, []);
  assert.strictEqual(recipe.singleTask, false);
  assert.deepStrictEqual(pageRecipes(recipes, ['path']), []);
  const found = buttonRecipe(recipes, BUTTON_RECIPES.discussTask, ['path', 'issue description']);
  assert.ok(found.state === 'found');
  const short = buttonRecipe(recipes, BUTTON_RECIPES.discussTask, ['path']);
  assert.ok(short.state === 'refused');
  assert.match(short.cause, /has no value for: <issue description>\./);
});

test('the shipped snippet file carries every button recipe as one Claude Code block, discuss-new-task its one interactive line', () => {
  const file = path.join(__dirname, '..', '..', '..', 'snippets', 'GURITA_USAGE.md');
  const recipes = parseShippedRecipes(fs.readFileSync(file, 'utf8'), file);
  for (const name of Object.values(BUTTON_RECIPES)) {
    assert.strictEqual(byName(recipes, name).group, 'shipped');
    assert.strictEqual(byName(recipes, name).variants.length, 1, name);
    assert.ok(runs(recipes, name).lines.every((line) => line.startsWith('claude ')), name);
  }
  const recipe = runs(recipes, BUTTON_RECIPES.discussTask);
  assert.deepStrictEqual(recipe.lines, [
    'claude "/gurita:discuss-new-task --mission <path> <issue description>" --dangerously-skip-permissions --model "fable" --effort xhigh; # interactive',
  ]);
  assert.strictEqual(isHeadless(recipe.lines[0]), false);
  const found = buttonRecipe(recipes, BUTTON_RECIPES.discussTask, ['path', 'issue description']);
  assert.ok(found.state === 'found');
  assert.ok(!pageRecipes(recipes, ['path']).some((entry) => entry.name === BUTTON_RECIPES.discussTask));
});

test('the shipped discuss-open-question recipe carries the optional note directly after the Short Title', () => {
  const file = path.join(__dirname, '..', '..', '..', 'snippets', 'GURITA_USAGE.md');
  const recipes = parseShippedRecipes(fs.readFileSync(file, 'utf8'), file);
  const recipe = runs(recipes, BUTTON_RECIPES.discussQuestion);
  assert.deepStrictEqual(recipe.lines, [
    'claude "/gurita:discuss-open-question --mission <path> <Short Title>. <note>" --dangerously-skip-permissions --model "fable" --effort xhigh; # interactive',
  ]);
  assert.deepStrictEqual(recipe.knownPlaceholders, ['path', 'Short Title', 'note']);
  assert.deepStrictEqual(recipe.unknownPlaceholders, []);
  assert.ok(buttonRecipe(recipes, BUTTON_RECIPES.discussQuestion, ['path', 'Short Title', 'note']).state === 'found');
  assert.ok(!pageRecipes(recipes, ['path']).some((entry) => entry.name === BUTTON_RECIPES.discussQuestion));
});

test('a button finds its recipe by fixed name and runs its first variant, an own recipe of the same name adding variants after it', () => {
  const found = buttonRecipe(shipped(), 'answer-open-question', ['path', 'Short Title', 'answer text']);
  assert.ok(found.state === 'found');
  assert.strictEqual(found.variant.file, SHIPPED);
  assert.deepStrictEqual(found.variant.lines, [
    'claude -p "/gurita:answer-open-question --mission <path> <Short Title>. <answer text>";',
  ]);
  const replacement = parseOwnRecipes(
    '### answer-open-question\n```\nclaude -p "/gurita:answer-open-question --mission <path> <Short Title>. <answer text>" --model "opus";\n```\n',
    OWN,
  );
  const replaced = buttonRecipe(mergeRecipes(shipped(), replacement), 'answer-open-question', [
    'path',
    'Short Title',
    'answer text',
  ]);
  assert.ok(replaced.state === 'found');
  assert.strictEqual(replaced.variant.file, SHIPPED, 'the shipped variant stays first');
  assert.strictEqual(replaced.recipe.group, 'shipped');
  assert.deepStrictEqual(replaced.recipe.variants.map((variant) => [variant.name, variant.own]), [
    ['answer-open-question', false],
    ['answer-open-question', true],
  ]);
  const ownOnly = buttonRecipe(mergeRecipes(shipped(), parseOwnRecipes('### discuss-mission-goal\n#### Mine\n```\necho <goal>\n```\n', OWN)), 'discuss-mission-goal', ['goal']);
  assert.ok(ownOnly.state === 'found');
  assert.strictEqual(ownOnly.recipe.group, 'own');
  assert.deepStrictEqual([ownOnly.variant.name, ownOnly.variant.own, ownOnly.variant.lines], ['Mine', true, ['echo <goal>']]);
});

test('a button refuses a recipe it cannot run, naming the recipe and the cause', () => {
  const recipes = mergeRecipes(shipped(), own());
  assert.deepStrictEqual(buttonRecipe(recipes, 'discuss-mission-goal', ['goal']), {
    state: 'refused',
    cause: 'No recipe is named discuss-mission-goal.',
  });
  const short = buttonRecipe(recipes, 'answer-open-question', ['path', 'Short Title']);
  assert.ok(short.state === 'refused');
  assert.match(short.cause, /answer-open-question in .*shipped\.md holds a placeholder this button has no value for: <answer text>\./);
  const unknown = buttonRecipe(recipes, 'Fenced heading', ['path']);
  assert.ok(unknown.state === 'refused');
  assert.match(unknown.cause, /<mystery thing>/);
  const loop = buttonRecipe(recipes, 'Loop', ['path']);
  assert.ok(loop.state === 'refused');
  assert.match(loop.cause, /is a looped recipe\./);
});
