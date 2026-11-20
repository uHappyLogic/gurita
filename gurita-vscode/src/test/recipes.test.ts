import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  BUTTON_RECIPES,
  buttonRecipe,
  declaredStage,
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

test('the shipped file yields only the blocks under the two host headings, each with its group', () => {
  const names = shipped().map((recipe) => [recipe.group, recipe.name]);
  assert.deepStrictEqual(names, [
    ['Claude Code', 'Chain'],
    ['Claude Code', 'Loop'],
    ['Claude Code', 'Single task (Claude Code)'],
    ['Claude Code', 'Interactive task line'],
    ['Claude Code', 'answer-open-question'],
    ['Claude Code', 'Fenced heading'],
    ['Antigravity', 'Single task (Antigravity)'],
    ['Antigravity', 'Two fences'],
  ]);
});

test('a recipe holds its first fenced block, as written, with prose and blank lines left out', () => {
  const recipes = shipped();
  assert.deepStrictEqual(byName(recipes, 'Chain').lines, [
    'claude -p "/gurita:review-mission-requirements --mission <path>" --model "fable";',
    'claude "/gurita:recommend-all-open-questions --mission <path>" --model "fable"; # interactive',
  ]);
  assert.deepStrictEqual(byName(recipes, 'Single task (Antigravity)').lines, [
    'agy -p "/gurita:complete-task --mission <path> <Task Title>" --model "claude-opus-5-5";',
  ]);
  assert.deepStrictEqual(byName(recipes, 'Two fences').lines, ['agy -p "/gurita:derive-tasks --mission <path>";']);
  assert.strictEqual(byName(recipes, 'Chain').file, SHIPPED);
});

test('heading lines inside a fence are lines of the recipe, not headings', () => {
  assert.deepStrictEqual(byName(shipped(), 'Fenced heading').lines, [
    '## Not a heading',
    '### Not a recipe',
    'echo <mystery thing> <path>',
  ]);
});

test('a single-task line is exactly one headless line holding <Task Title>', () => {
  const recipes = shipped();
  const single = recipes.filter((recipe) => recipe.singleTask).map((recipe) => recipe.name);
  assert.deepStrictEqual(single, ['Single task (Claude Code)', 'Single task (Antigravity)']);
  assert.strictEqual(byName(recipes, 'Interactive task line').singleTask, false);
  assert.strictEqual(byName(recipes, 'answer-open-question').singleTask, false);
  assert.strictEqual(byName(own(), 'My first own recipe').singleTask, false);
  assert.strictEqual(byName(own(), 'Single task (Antigravity)').singleTask, true);
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
    recipes.filter((recipe) => recipe.looped).map((recipe) => recipe.name),
    ['Loop'],
  );
  const loop = byName(recipes, 'Loop');
  assert.deepStrictEqual(loop.lines, ['source .env_fixture', '<single-task line>']);
  assert.deepStrictEqual(loop.knownPlaceholders, []);
  assert.deepStrictEqual(loop.unknownPlaceholders, []);
});

test('placeholders are split into known and unknown, each named once in order of appearance', () => {
  const answer = byName(shipped(), 'answer-open-question');
  assert.deepStrictEqual(answer.knownPlaceholders, ['path', 'Short Title', 'answer text']);
  assert.deepStrictEqual(answer.unknownPlaceholders, []);
  const fenced = byName(shipped(), 'Fenced heading');
  assert.deepStrictEqual(fenced.knownPlaceholders, ['path']);
  assert.deepStrictEqual(fenced.unknownPlaceholders, ['mystery thing']);
  const second = byName(own(), 'My second own recipe');
  assert.deepStrictEqual(second.knownPlaceholders, ['scope']);
  assert.deepStrictEqual(second.unknownPlaceholders, ['unknown one']);
});

test('the own file is a flat list of ### recipes, the first of a repeated name kept', () => {
  const recipes = own();
  assert.deepStrictEqual(
    recipes.map((recipe) => [recipe.group, recipe.name]),
    [
      ['own', 'Chain'],
      ['own', 'My first own recipe'],
      ['own', 'Single task (Antigravity)'],
      ['own', 'My second own recipe'],
    ],
  );
  assert.deepStrictEqual(byName(recipes, 'Chain').lines, [
    'claude-wait;',
    'claude -p "/gurita:review-mission-requirements --mission <path>" --model "opus";',
  ]);
});

test('an own recipe carrying a shipped name replaces that recipe in place, the rest following in file order', () => {
  const merged = mergeRecipes(shipped(), own());
  assert.deepStrictEqual(
    merged.map((recipe) => [recipe.group, recipe.name, recipe.file === OWN ? 'own' : 'shipped']),
    [
      ['Claude Code', 'Chain', 'own'],
      ['Claude Code', 'Loop', 'shipped'],
      ['Claude Code', 'Single task (Claude Code)', 'shipped'],
      ['Claude Code', 'Interactive task line', 'shipped'],
      ['Claude Code', 'answer-open-question', 'shipped'],
      ['Claude Code', 'Fenced heading', 'shipped'],
      ['Antigravity', 'Single task (Antigravity)', 'own'],
      ['Antigravity', 'Two fences', 'shipped'],
      ['own', 'My first own recipe', 'own'],
      ['own', 'My second own recipe', 'own'],
    ],
  );
  assert.deepStrictEqual(byName(merged, 'Single task (Antigravity)').lines, [
    "codex exec '$gurita:complete-task --mission <path> <Task Title>';",
  ]);
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
  assert.deepStrictEqual(byName(recipes, 'Loop').lines, ['source .env_fixture', '<single-task line>']);
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
  assert.deepStrictEqual(inFence.lines, ['Stage: finish', 'echo <path>']);
  assert.strictEqual(stageOf('### Recipe\n  Stage: finish\n```\necho <path>\n```\n'), undefined);
  assert.strictEqual(stageOf('Stage: finish\n### Recipe\n```\necho <path>\n```\n'), undefined);
  assert.strictEqual(stageOf('### Recipe\n```\necho <path>\n```\n## Next\nStage: finish\n'), undefined);
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

test('an own recipe declares its stage the same way, and a replacement carries its own declaration', () => {
  assert.strictEqual(byName(own(), 'My first own recipe').stage, 'execute');
  assert.strictEqual(byName(own(), 'Chain').stage, undefined);
  const merged = mergeRecipes(shipped(), own());
  assert.strictEqual(byName(merged, 'Chain').stage, undefined);
  assert.strictEqual(byName(merged, 'Loop').stage, 'execute');
  assert.strictEqual(byName(merged, 'My first own recipe').stage, 'execute');
  assert.strictEqual(byName(readRecipes(SHIPPED, OWN), 'My first own recipe').stage, 'execute');
});

/** Every `###` block of a Markdown text that stands under a host heading, with its stage lines' count. */
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
      name = section === 'Claude Code' || section === 'Antigravity' ? line.slice(4).trim() : undefined;
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
  const chains = recipes.filter((recipe) => !buttons.includes(recipe.name) && !recipe.singleTask);
  assert.deepStrictEqual(
    chains.map((recipe) => [recipe.group, recipe.name, recipe.stage]),
    [
      ['Claude Code', 'First run', 'first-review'],
      ['Claude Code', 'Requirements iteration', 'additional-review'],
      ['Claude Code', 'Prepare tasks', 'derive'],
      ['Claude Code', 'Execute tasks of normal difficulty', 'execute'],
      ['Claude Code', 'Execute tasks (critical tasks)', 'execute'],
      ['Claude Code', 'Execute tasks one at a time', 'execute'],
      ['Claude Code', 'Finish mission', 'finish'],
      ['Antigravity', 'First run (Antigravity)', 'first-review'],
      ['Antigravity', 'Requirements iteration (Antigravity)', 'additional-review'],
      ['Antigravity', 'Prepare tasks (Antigravity)', 'derive'],
      ['Antigravity', 'Execute tasks of normal difficulty (Antigravity)', 'execute'],
      ['Antigravity', 'Execute tasks (critical tasks) (Antigravity)', 'execute'],
      ['Antigravity', 'Mixed-agent requirements review (Gemini reviews, Claude annotates)', 'additional-review'],
      ['Antigravity', 'Finish mission (Antigravity)', 'finish'],
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

test('no shipped execute recipe holds a derive-tasks line, each holding its complete-all-tasks line alone or the slot line', () => {
  const recipes = parseShippedRecipes(fs.readFileSync(SNIPPETS, 'utf8'), SNIPPETS);
  const execute = recipes.filter((recipe) => recipe.stage === 'execute');
  assert.strictEqual(execute.length, 5);
  for (const recipe of execute) {
    assert.ok(!recipe.lines.some((line) => line.includes('gurita:derive-tasks')), recipe.name);
    assert.strictEqual(recipe.lines.length, 1, recipe.name);
    assert.ok(recipe.lines[0] === SLOT_LINE || recipe.lines[0].includes('/gurita:complete-all-tasks --mission <path>"'), recipe.name);
  }
  assert.deepStrictEqual(byName(recipes, 'Execute tasks of normal difficulty').lines, [
    'claude "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "opus" --effort high; # interactive',
  ]);
  assert.deepStrictEqual(byName(recipes, 'Execute tasks (critical tasks)').lines, [
    'claude "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "opus" --effort xhigh; # interactive',
  ]);
  assert.deepStrictEqual(byName(recipes, 'Execute tasks of normal difficulty (Antigravity)').lines, [
    'agy -i "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort high; # interactive',
  ]);
  assert.deepStrictEqual(byName(recipes, 'Execute tasks (critical tasks) (Antigravity)').lines, [
    'claude "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "opus" --effort xhigh; # interactive',
  ]);
  assert.deepStrictEqual(byName(recipes, 'Execute tasks one at a time').lines, [SLOT_LINE]);
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

test('the stage filter holds the host groups, the own group, and the unfillable-placeholder rule within it', () => {
  const merged = mergeRecipes(shipped(), own());
  const at = (step: WorkflowStep | undefined) =>
    pageRecipes(stageRecipes(merged, step), ['path']).map((entry) => [entry.kind, entry.group, entry.name]);
  const every = [
    ['runnable', 'Claude Code', 'Chain'],
    ['looped', 'Claude Code', 'Loop'],
    ['unknown', 'Claude Code', 'Fenced heading'],
    ['runnable', 'Antigravity', 'Two fences'],
    ['unknown', 'own', 'My second own recipe'],
  ];
  assert.deepStrictEqual(at(undefined), every);
  assert.deepStrictEqual(at('execute'), every, 'the own replacement of Chain is undeclared');
  assert.deepStrictEqual(at('finish'), every.filter(([, , name]) => name !== 'Loop'));
  const declared = (step: WorkflowStep | undefined) =>
    pageRecipes(stageRecipes(shipped(), step), ['path']).map((entry) => entry.name);
  assert.deepStrictEqual(declared('derive'), ['Chain', 'Fenced heading', 'Two fences']);
  assert.deepStrictEqual(declared('execute'), ['Loop', 'Fenced heading', 'Two fences']);
  assert.deepStrictEqual(declared('first-review'), ['Fenced heading', 'Two fences']);
});

test('each step lists exactly the shipped chains that fit it, and no step chosen lists every chain', () => {
  const recipes = parseShippedRecipes(fs.readFileSync(SNIPPETS, 'utf8'), SNIPPETS);
  const at = (step: WorkflowStep | undefined) =>
    pageRecipes(stageRecipes(recipes, step), ['path']).map((entry) => [entry.group, entry.name]);
  const review = [
    ['Claude Code', 'Requirements iteration'],
    ['Antigravity', 'Requirements iteration (Antigravity)'],
    ['Antigravity', 'Mixed-agent requirements review (Gemini reviews, Claude annotates)'],
  ];
  assert.deepStrictEqual(at('first-review'), [
    ['Claude Code', 'First run'],
    ['Antigravity', 'First run (Antigravity)'],
  ]);
  assert.deepStrictEqual(at('additional-review'), review);
  assert.deepStrictEqual(at('derive'), [
    ['Claude Code', 'Requirements iteration'],
    ['Claude Code', 'Prepare tasks'],
    ['Antigravity', 'Requirements iteration (Antigravity)'],
    ['Antigravity', 'Prepare tasks (Antigravity)'],
    ['Antigravity', 'Mixed-agent requirements review (Gemini reviews, Claude annotates)'],
  ]);
  assert.deepStrictEqual(at('execute'), [
    ['Claude Code', 'Execute tasks of normal difficulty'],
    ['Claude Code', 'Execute tasks (critical tasks)'],
    ['Claude Code', 'Execute tasks one at a time'],
    ['Antigravity', 'Execute tasks of normal difficulty (Antigravity)'],
    ['Antigravity', 'Execute tasks (critical tasks) (Antigravity)'],
  ]);
  assert.deepStrictEqual(at('finish'), [
    ['Claude Code', 'Finish mission'],
    ['Antigravity', 'Finish mission (Antigravity)'],
  ]);
  assert.deepStrictEqual(at(undefined), pageRecipes(recipes, ['path']).map((entry) => [entry.group, entry.name]));
  assert.strictEqual(at(undefined).length, 14);
});

test('a page lists the recipes it can fill, in the merged order, and names each unknown placeholder and its file', () => {
  const listed = pageRecipes(mergeRecipes(shipped(), own()), ['path']);
  assert.deepStrictEqual(
    listed.map((entry) => [entry.kind, entry.group, entry.name]),
    [
      ['runnable', 'Claude Code', 'Chain'],
      ['looped', 'Claude Code', 'Loop'],
      ['unknown', 'Claude Code', 'Fenced heading'],
      ['runnable', 'Antigravity', 'Two fences'],
      ['unknown', 'own', 'My second own recipe'],
    ],
  );
  assert.deepStrictEqual(listed[0], {
    kind: 'runnable',
    name: 'Chain',
    group: 'Claude Code',
    lines: ['claude-wait;', 'claude -p "/gurita:review-mission-requirements --mission <path>" --model "opus";'],
  });
  assert.deepStrictEqual(listed[1], {
    kind: 'looped',
    name: 'Loop',
    group: 'Claude Code',
    lines: ['source .env_fixture', '<single-task line>'],
  });
  const fenced = listed[2];
  assert.ok(fenced.kind === 'unknown');
  assert.deepStrictEqual(fenced.placeholders, ['mystery thing']);
  assert.strictEqual(fenced.file, SHIPPED);
  const second = listed[4];
  assert.ok(second.kind === 'unknown');
  assert.deepStrictEqual(second.placeholders, ['unknown one']);
  assert.strictEqual(second.file, OWN);
});

test('a recipe holding a placeholder the page cannot fill is left off, and listed once the page can fill it', () => {
  const names = (fillable: string[]) => pageRecipes(shipped(), fillable).map((entry) => entry.name);
  assert.ok(!names(['path']).includes('answer-open-question'));
  assert.ok(!names(['path']).includes('Single task (Claude Code)'));
  assert.ok(names(['path', 'Short Title', 'answer text']).includes('answer-open-question'));
  assert.ok(names(['path']).includes('Loop'));
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
    '## Claude Code\n\n### discuss-new-task\n```\nclaude "/gurita:discuss-new-task --mission <path> <issue description>" --model "fable"; # interactive\n```\n',
    SHIPPED,
  );
  const recipe = byName(recipes, BUTTON_RECIPES.discussTask);
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

test('the shipped snippet file carries every button recipe under Claude Code, discuss-new-task its one interactive line', () => {
  const file = path.join(__dirname, '..', '..', '..', 'snippets', 'GURITA_USAGE.md');
  const recipes = parseShippedRecipes(fs.readFileSync(file, 'utf8'), file);
  for (const name of Object.values(BUTTON_RECIPES)) {
    assert.strictEqual(byName(recipes, name).group, 'Claude Code');
  }
  const recipe = byName(recipes, BUTTON_RECIPES.discussTask);
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
  const recipe = byName(recipes, BUTTON_RECIPES.discussQuestion);
  assert.deepStrictEqual(recipe.lines, [
    'claude "/gurita:discuss-open-question --mission <path> <Short Title>. <note>" --dangerously-skip-permissions --model "fable" --effort xhigh; # interactive',
  ]);
  assert.deepStrictEqual(recipe.knownPlaceholders, ['path', 'Short Title', 'note']);
  assert.deepStrictEqual(recipe.unknownPlaceholders, []);
  assert.ok(buttonRecipe(recipes, BUTTON_RECIPES.discussQuestion, ['path', 'Short Title', 'note']).state === 'found');
  assert.ok(!pageRecipes(recipes, ['path']).some((entry) => entry.name === BUTTON_RECIPES.discussQuestion));
});

test('a button finds its recipe by fixed name, shipped or replaced by an own recipe of the same name', () => {
  const found = buttonRecipe(shipped(), 'answer-open-question', ['path', 'Short Title', 'answer text']);
  assert.ok(found.state === 'found');
  assert.strictEqual(found.recipe.file, SHIPPED);
  assert.deepStrictEqual(found.recipe.lines, [
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
  assert.strictEqual(replaced.recipe.file, OWN);
  assert.strictEqual(replaced.recipe.group, 'Claude Code');
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
