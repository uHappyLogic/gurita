import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  isHeadless,
  mergeRecipes,
  parseOwnRecipes,
  parseShippedRecipes,
  readRecipes,
  Recipe,
} from '../recipes';

const FIXTURES = path.join(__dirname, '..', '..', 'src', 'test', 'fixtures', 'recipes');
const SHIPPED = path.join(FIXTURES, 'shipped.md');
const OWN = path.join(FIXTURES, 'own.md');

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
