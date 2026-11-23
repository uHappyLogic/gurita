import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { readLine, readSkill, replaceEffort, replaceModel, rewriteHarness, variantValues } from '../lineValues';
import { Recipe, SLOT_LINE, isHeadless, parseShippedRecipes } from '../recipes';

const SHIPPED_RECIPES = path.join(__dirname, '..', '..', 'shipped_recipes.md');

function shippedRecipe(name: string): Recipe {
  const recipes = parseShippedRecipes(fs.readFileSync(SHIPPED_RECIPES, 'utf8'), SHIPPED_RECIPES);
  const found = recipes.find((recipe) => recipe.name === name);
  assert.ok(found, `no shipped recipe named ${name}`);
  return found;
}

const CLAUDE_LINE =
  'claude -p "/gurita:review-mission-requirements --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;';
const AGY_LINE =
  'agy -p "/gurita:review-mission-requirements --mission <path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;';
const CODEX_LINE = 'codex exec "/gurita:review-mission-requirements --mission <path>" -m gpt-5.5;';

test('a claude, agy, or codex line yields its harness, model, and effort', () => {
  assert.deepStrictEqual(readLine(CLAUDE_LINE), { harness: 'claude', model: 'fable', effort: 'xhigh' });
  assert.deepStrictEqual(readLine(AGY_LINE), { harness: 'agy', model: 'gemini-4-argon', effort: 'medium' });
  assert.deepStrictEqual(readLine(CODEX_LINE), { harness: 'codex', model: 'gpt-5.5' });
});

test('a Codex line takes its model from -m and reads no effort', () => {
  assert.deepStrictEqual(readLine('codex exec "/gurita:finish-mission" --model gpt-5.5 --effort high;'), { harness: 'codex' });
  assert.deepStrictEqual(readLine('codex -m "gpt-5.5" "/gurita:finish-mission"'), { harness: 'codex', model: 'gpt-5.5' });
});

test('claude and agy take no model from -m', () => {
  assert.deepStrictEqual(readLine('claude -p "/gurita:finish-mission" -m opus --effort high;'), { harness: 'claude', effort: 'high' });
});

test('a line without --model or --effort yields its harness and whichever flag it holds', () => {
  assert.deepStrictEqual(readLine('claude -p "/gurita:finish-mission --mission <path>";'), { harness: 'claude' });
  assert.deepStrictEqual(readLine('agy -p "/gurita:finish-mission" --effort high;'), { harness: 'agy', effort: 'high' });
  assert.deepStrictEqual(readLine('claude "/gurita:discuss-mission-goal" --model opus; # interactive'), { harness: 'claude', model: 'opus' });
});

test('a shell step, the slot line, and an unknown command carry no value', () => {
  assert.strictEqual(readLine('git pull --rebase;'), undefined);
  assert.strictEqual(readLine(SLOT_LINE), undefined);
  assert.strictEqual(readLine('gemini -p "/review" --model "gemini-4-argon" --effort high;'), undefined);
  assert.strictEqual(readLine('echo claude --model fable;'), undefined);
  assert.strictEqual(readLine(''), undefined);
});

test('flags inside the quoted prompt or after the closing ; are never read', () => {
  assert.deepStrictEqual(readLine('claude -p "/gurita:x --model opus --effort max" --model fable;'), { harness: 'claude', model: 'fable' });
  assert.deepStrictEqual(readLine("claude -p '--effort low' --effort high; # --model opus"), { harness: 'claude', effort: 'high' });
  assert.deepStrictEqual(readLine('claude -p "/x"; agy --model gemini-4-argon --effort medium;'), { harness: 'claude' });
});

test('the --flag=value form is read, an empty or missing value carries nothing, and the last flag wins', () => {
  assert.deepStrictEqual(readLine('claude -p "/x" --model=opus --effort="high";'), { harness: 'claude', model: 'opus', effort: 'high' });
  assert.deepStrictEqual(readLine('claude -p "/x" --model "" --effort'), { harness: 'claude' });
  assert.deepStrictEqual(readLine('claude -p "/x" --model fable --model opus;'), { harness: 'claude', model: 'opus' });
});

test('replacing a model or effort keeps the rest of the line as written and the value quoted as before', () => {
  assert.strictEqual(
    replaceModel(CLAUDE_LINE, 'opus'),
    'claude -p "/gurita:review-mission-requirements --mission <path>" --dangerously-skip-permissions --model "opus" --effort xhigh;',
  );
  assert.strictEqual(
    replaceEffort(CLAUDE_LINE, 'high'),
    'claude -p "/gurita:review-mission-requirements --mission <path>" --dangerously-skip-permissions --model "fable" --effort high;',
  );
  assert.strictEqual(
    replaceModel(AGY_LINE, 'claude-opus-5-5'),
    'agy -p "/gurita:review-mission-requirements --mission <path>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort medium;',
  );
  assert.strictEqual(replaceModel(CODEX_LINE, 'gpt-5.5-mini'), 'codex exec "/gurita:review-mission-requirements --mission <path>" -m gpt-5.5-mini;');
  assert.strictEqual(replaceModel("claude -p '/x' --model 'fable';", 'opus'), "claude -p '/x' --model 'opus';");
  assert.strictEqual(replaceEffort('claude -p "/x" --effort=high;', 'max'), 'claude -p "/x" --effort=max;');
  assert.strictEqual(replaceModel('claude -p "/x" --model fable;', 'my model'), 'claude -p "/x" --model "my model";');
  assert.strictEqual(
    replaceModel('claude "/gurita:x" --model "fable" --effort xhigh; # interactive', 'sonnet'),
    'claude "/gurita:x" --model "sonnet" --effort xhigh; # interactive',
  );
});

test('a value the line does not carry is never inserted', () => {
  assert.strictEqual(replaceModel('claude -p "/x" --effort high;', 'opus'), undefined);
  assert.strictEqual(replaceEffort('claude -p "/x" --model opus;', 'high'), undefined);
  assert.strictEqual(replaceEffort(CODEX_LINE, 'high'), undefined);
  assert.strictEqual(replaceModel('claude -p "/x --model opus";', 'fable'), undefined);
  assert.strictEqual(replaceModel(SLOT_LINE, 'opus'), undefined);
  assert.strictEqual(replaceModel('git pull --model x;', 'opus'), undefined);
});

test('an empty replacement value is refused', () => {
  assert.throws(() => replaceModel(CLAUDE_LINE, ''));
  assert.throws(() => replaceEffort(CLAUDE_LINE, ''));
});

test('the shipped First run reads claude · fable, opus · xhigh, high', () => {
  const recipe = shippedRecipe('First run');
  assert.deepStrictEqual(variantValues(recipe.variants[0].lines), {
    harnesses: ['claude'],
    models: ['fable', 'opus'],
    efforts: ['xhigh', 'high'],
  });
});

test('the mixed-agent chain reads agy, claude · gemini-4-argon, opus, fable · medium, high, xhigh', () => {
  const recipe = shippedRecipe('Mixed-agent requirements review (Gemini reviews, Claude annotates)');
  assert.deepStrictEqual(variantValues(recipe.variants[0].lines), {
    harnesses: ['agy', 'claude'],
    models: ['gemini-4-argon', 'opus', 'fable'],
    efforts: ['medium', 'high', 'xhigh'],
  });
});

test('the three lists are independent, and unreadable lines add nothing', () => {
  assert.deepStrictEqual(
    variantValues([
      'git pull;',
      'claude -p "/a" --effort high;',
      SLOT_LINE,
      'codex exec "/b" -m gpt-5.5;',
      'make test;',
      'agy -p "/c" --model gemini-4-argon;',
    ]),
    { harnesses: ['claude', 'codex', 'agy'], models: ['gpt-5.5', 'gemini-4-argon'], efforts: ['high'] },
  );
});

test('a variant none of whose lines is readable yields three empty lists', () => {
  assert.deepStrictEqual(variantValues([SLOT_LINE]), { harnesses: [], models: [], efforts: [] });
  assert.deepStrictEqual(shippedRecipe('Execute tasks one at a time').variants.map((variant) => variantValues(variant.lines)), [
    { harnesses: [], models: [], efforts: [] },
  ]);
});

test("the skill a line runs is read from its first command's arguments, a line of no known harness running none", () => {
  assert.strictEqual(readSkill('claude -p "/gurita:specify-mission-starting-state --mission <path>" --model "fable" --effort xhigh;'), 'specify-mission-starting-state');
  assert.strictEqual(readSkill('agy -i "/gurita:complete-all-tasks --mission <path>" --model "claude-opus-5-5" --effort high; # interactive'), 'complete-all-tasks');
  assert.strictEqual(readSkill("codex exec '$gurita:complete-task --mission <path> <Task Title>';"), 'complete-task');
  assert.strictEqual(readSkill('echo "/gurita:finish-mission"'), undefined, 'a shell step runs no skill');
  assert.strictEqual(readSkill('<single-task line>'), undefined);
  assert.strictEqual(readSkill('claude -p "Summarize" --model "opus";'), undefined);
  assert.strictEqual(readSkill('claude --version; echo "/gurita:finish-mission"'), undefined, 'a skill after the closing `;` is not read');
});

/** The Antigravity and Claude Code lists a harness pick rewrites with, as the shipped lines give them. */
const AGY_OFFER = { models: ['gemini-4-argon', 'claude-opus-5-5'], efforts: ['medium', 'high'] };
const CLAUDE_OFFER = { models: ['fable', 'opus', 'sonnet'], efforts: ['xhigh', 'high', 'medium'] };

test('a harness pick rewrites a shipped claude line onto agy in both forms, keeping its prompt, taking the first model, and keeping an offered effort', () => {
  const headless = shippedRecipe('First run').variants[0].lines[0];
  assert.strictEqual(headless, 'claude -p "/gurita:specify-mission-starting-state --mission <path>" --dangerously-skip-permissions --model "fable" --effort xhigh;');
  assert.strictEqual(
    rewriteHarness(headless, 'agy', AGY_OFFER),
    'agy -p "/gurita:specify-mission-starting-state --mission <path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort medium;',
    'an effort the harness does not offer becomes its first listed effort',
  );
  const interactive = shippedRecipe('Execute tasks').variants[0].lines[0];
  assert.strictEqual(interactive, 'claude "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "opus" --effort high; # interactive');
  assert.strictEqual(
    rewriteHarness(interactive, 'agy', AGY_OFFER),
    'agy -i "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "gemini-4-argon" --effort high; # interactive',
    'an interactive line gains -i and keeps an effort the harness offers',
  );
});

test('a harness pick rewrites a shipped agy line onto claude in both forms', () => {
  const headless = shippedRecipe('Single task with Opus High (Antigravity)').variants[0].lines[0];
  assert.strictEqual(headless, 'agy -p "/gurita:complete-task --mission <path> <Task Title>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort high;');
  assert.strictEqual(
    rewriteHarness(headless, 'claude', CLAUDE_OFFER),
    'claude -p "/gurita:complete-task --mission <path> <Task Title>" --dangerously-skip-permissions --model "fable" --effort high;',
  );
  const interactive = 'agy -i "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort high; # interactive';
  assert.strictEqual(
    rewriteHarness(interactive, 'claude', { models: ['opus'], efforts: ['xhigh'] }),
    'claude "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "opus" --effort xhigh; # interactive',
    'an interactive agy line loses its -i, and an effort not offered becomes the first listed',
  );
});

test('every shipped claude or agy line with both flags rewrites onto the other harness and back to itself, its form, skill, and other words kept', () => {
  const recipes = parseShippedRecipes(fs.readFileSync(SHIPPED_RECIPES, 'utf8'), SHIPPED_RECIPES);
  const lines = recipes.flatMap((recipe) => recipe.variants.flatMap((variant) => variant.lines));
  let rewritten = 0;
  for (const line of lines) {
    const read = readLine(line);
    if (read === undefined || read.harness === 'codex' || read.model === undefined || read.effort === undefined) {
      assert.strictEqual(rewriteHarness(line, 'agy', AGY_OFFER), undefined, line);
      continue;
    }
    const other = read.harness === 'claude' ? 'agy' : 'claude';
    const offer = other === 'agy' ? AGY_OFFER : CLAUDE_OFFER;
    const changed = rewriteHarness(line, other, offer);
    assert.ok(changed !== undefined, line);
    assert.deepStrictEqual(readLine(changed), {
      harness: other,
      model: offer.models[0],
      effort: offer.efforts.includes(read.effort) ? read.effort : offer.efforts[0],
    }, changed);
    assert.strictEqual(isHeadless(changed), isHeadless(line), `the form is kept: ${changed}`);
    assert.strictEqual(readSkill(changed), readSkill(line));
    assert.strictEqual(changed.endsWith('; # interactive'), line.endsWith('; # interactive'));
    assert.ok(changed.includes('--dangerously-skip-permissions'));
    assert.strictEqual(rewriteHarness(changed, read.harness, { models: [read.model], efforts: [read.effort] }), line, 'the way back gives the line as written');
    rewritten++;
  }
  assert.ok(rewritten >= 10, `only ${rewritten} shipped lines were rewritten`);
});

test('a harness pick leaves a line on the picked harness as it is, rewrites no other line, and refuses an empty offer', () => {
  assert.strictEqual(rewriteHarness(CLAUDE_LINE, 'claude', CLAUDE_OFFER), CLAUDE_LINE);
  assert.strictEqual(rewriteHarness(CODEX_LINE, 'claude', CLAUDE_OFFER), undefined, 'a Codex line keeps its harness');
  assert.strictEqual(rewriteHarness('claude -p "/gurita:finish-mission" --model opus;', 'agy', AGY_OFFER), undefined, 'a line without both flags');
  assert.strictEqual(rewriteHarness('git pull --model x --effort y;', 'agy', AGY_OFFER), undefined);
  assert.strictEqual(rewriteHarness(SLOT_LINE, 'agy', AGY_OFFER), undefined);
  assert.strictEqual(
    rewriteHarness("claude -p '/x' --model=fable --effort high;", 'agy', AGY_OFFER),
    "agy -p '/x' --model=gemini-4-argon --effort high;",
    'the value forms are kept as written',
  );
  assert.throws(() => rewriteHarness(CLAUDE_LINE, 'agy', { models: [], efforts: ['high'] }), /offers no model/);
  assert.throws(() => rewriteHarness(CLAUDE_LINE, 'agy', { models: ['gemini-4-argon'], efforts: [] }), /offers no effort/);
});
