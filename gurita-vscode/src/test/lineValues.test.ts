import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { harnessChoices, readLine, readSkill, replaceEffort, replaceModel, rewriteHarness } from '../lineValues';
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
const CODEX_EFFORT_LINE =
  "codex exec '$gurita:review-mission-requirements --mission <path>' --dangerously-bypass-approvals-and-sandbox -m gpt-5.5 -c model_reasoning_effort=high;";

test('a claude, agy, or codex line yields its harness, model, and effort', () => {
  assert.deepStrictEqual(readLine(CLAUDE_LINE), { harness: 'claude', model: 'fable', effort: 'xhigh' });
  assert.deepStrictEqual(readLine(AGY_LINE), { harness: 'agy', model: 'gemini-4-argon', effort: 'medium' });
  assert.deepStrictEqual(readLine(CODEX_LINE), { harness: 'codex', model: 'gpt-5.5' });
  assert.deepStrictEqual(readLine(CODEX_EFFORT_LINE), { harness: 'codex', model: 'gpt-5.5', effort: 'high' });
});

test('a Codex line takes its model from -m and its effort from the model_reasoning_effort override, never from --model or --effort', () => {
  assert.deepStrictEqual(readLine('codex exec "/gurita:finish-mission" --model gpt-5.5 --effort high;'), { harness: 'codex' });
  assert.deepStrictEqual(readLine('codex -m "gpt-5.5" "/gurita:finish-mission"'), { harness: 'codex', model: 'gpt-5.5' });
  assert.deepStrictEqual(readLine('codex exec "/x" -c model_reasoning_effort=low;'), { harness: 'codex', effort: 'low' });
});

test('a Codex effort is read from -c and --config in every spelling, a quoted TOML level without its quotes', () => {
  for (const [line, effort] of [
    ['codex exec "/x" -m gpt-5.5 --config model_reasoning_effort=medium;', 'medium'],
    ['codex exec "/x" -m gpt-5.5 --config=model_reasoning_effort=xhigh;', 'xhigh'],
    ['codex exec "/x" -m gpt-5.5 -c=model_reasoning_effort=low;', 'low'],
    ['codex exec "/x" -m gpt-5.5 -c \'model_reasoning_effort="high"\';', 'high'],
    ['codex exec "/x" -m gpt-5.5 -c "model_reasoning_effort=\'minimal\'";', 'minimal'],
    ['codex exec "/x" -m gpt-5.5 -c "model_reasoning_effort = high";', 'high'],
  ]) {
    assert.deepStrictEqual(readLine(line), { harness: 'codex', model: 'gpt-5.5', effort }, line);
  }
});

test('a Codex override of another key, an empty level, or one inside the prompt carries no effort, and the last override wins', () => {
  assert.deepStrictEqual(readLine('codex exec "/x" -m gpt-5.5 -c model_verbosity=high -c sandbox_mode=read-only;'), { harness: 'codex', model: 'gpt-5.5' });
  assert.deepStrictEqual(readLine('codex exec "/x" -m gpt-5.5 -c model_reasoning_effort=;'), { harness: 'codex', model: 'gpt-5.5' });
  assert.deepStrictEqual(readLine('codex exec "/x" -m gpt-5.5 -c;'), { harness: 'codex', model: 'gpt-5.5' });
  assert.deepStrictEqual(readLine('codex exec "/x -c model_reasoning_effort=high" -m gpt-5.5;'), { harness: 'codex', model: 'gpt-5.5' });
  assert.deepStrictEqual(readLine('codex exec "/x" -c model_reasoning_effort=high; codex -c model_reasoning_effort=low'), { harness: 'codex', effort: 'high' });
  assert.deepStrictEqual(
    readLine('codex exec "/x" -c model_reasoning_effort=low -c model_verbosity=high --config model_reasoning_effort=high;'),
    { harness: 'codex', effort: 'high' },
  );
  assert.deepStrictEqual(readLine('claude -p "/x" -c model_reasoning_effort=high;'), { harness: 'claude' }, 'claude and agy read no override');
});

test('replacing a Codex effort rewrites only the level, in the spelling and quoting it was written in', () => {
  assert.strictEqual(
    replaceEffort(CODEX_EFFORT_LINE, 'xhigh'),
    "codex exec '$gurita:review-mission-requirements --mission <path>' --dangerously-bypass-approvals-and-sandbox -m gpt-5.5 -c model_reasoning_effort=xhigh;",
  );
  assert.strictEqual(replaceEffort('codex exec "/x" --config=model_reasoning_effort=low;', 'medium'), 'codex exec "/x" --config=model_reasoning_effort=medium;');
  assert.strictEqual(replaceEffort('codex exec "/x" -c \'model_reasoning_effort="high"\';', 'low'), 'codex exec "/x" -c \'model_reasoning_effort="low"\';');
  assert.strictEqual(replaceEffort('codex exec "/x" -c "model_reasoning_effort = high";', 'low'), 'codex exec "/x" -c "model_reasoning_effort = low";');
  assert.strictEqual(
    replaceEffort('codex exec "/x" -c model_reasoning_effort=low -c model_verbosity=high --config model_reasoning_effort=high;', 'medium'),
    'codex exec "/x" -c model_reasoning_effort=low -c model_verbosity=high --config model_reasoning_effort=medium;',
    'of an override written twice the last is replaced',
  );
  assert.strictEqual(replaceModel(CODEX_EFFORT_LINE, 'gpt-5.5-mini'), CODEX_EFFORT_LINE.replace('-m gpt-5.5', '-m gpt-5.5-mini'), 'the model is replaced apart from the effort');
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
  assert.strictEqual(replaceEffort('codex exec "/x" -m gpt-5.5 -c model_verbosity=high;', 'high'), undefined);
  assert.strictEqual(replaceEffort('codex exec "/x" --effort high;', 'low'), undefined);
  assert.strictEqual(replaceModel('claude -p "/x --model opus";', 'fable'), undefined);
  assert.strictEqual(replaceModel(SLOT_LINE, 'opus'), undefined);
  assert.strictEqual(replaceModel('git pull --model x;', 'opus'), undefined);
});

test('an empty replacement value is refused', () => {
  assert.throws(() => replaceModel(CLAUDE_LINE, ''));
  assert.throws(() => replaceEffort(CLAUDE_LINE, ''));
  assert.throws(() => replaceEffort(CODEX_EFFORT_LINE, ''));
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
/** The Codex lists a harness pick onto Codex rewrites with. */
const CODEX_OFFER = { models: ['gpt-5.5', 'gpt-5.4'], efforts: ['high', 'medium', 'low'] };

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
    if (read?.harness === 'codex') {
      continue;
    }
    if (read === undefined || read.model === undefined || read.effort === undefined) {
      assert.strictEqual(rewriteHarness(line, 'agy', AGY_OFFER), undefined, line);
      assert.strictEqual(rewriteHarness(line, 'codex', CODEX_OFFER), undefined, line);
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
  assert.strictEqual(rewriteHarness(CODEX_EFFORT_LINE, 'codex', CODEX_OFFER), CODEX_EFFORT_LINE);
  assert.strictEqual(rewriteHarness('codex "/gurita:finish-mission" -m gpt-5.5;', 'claude', CLAUDE_OFFER), undefined, 'a Codex line not opening codex exec keeps its harness');
  assert.strictEqual(rewriteHarness("codex exec '$gurita:finish-mission' -c model_reasoning_effort=high;", 'claude', CLAUDE_OFFER), undefined, 'and so does one without -m');
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

/** An interactive Antigravity line and the bare interactive Codex line it switches to. */
const AGY_INTERACTIVE_LINE = 'agy -i "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "claude-opus-5-5" --effort high; # interactive';
const CODEX_INTERACTIVE_LINE = "codex '$gurita:complete-all-tasks --mission <path>' --dangerously-bypass-approvals-and-sandbox -m \"gpt-5.5\" -c model_reasoning_effort=high; # interactive";

test('a harness pick onto Codex is offered on headless and interactive lines, and a codex exec or bare codex line is offered every harness', () => {
  assert.deepStrictEqual(harnessChoices(CLAUDE_LINE), ['claude', 'agy', 'codex']);
  assert.deepStrictEqual(harnessChoices(AGY_LINE), ['claude', 'agy', 'codex']);
  assert.deepStrictEqual(harnessChoices(CODEX_LINE), ['claude', 'agy', 'codex'], 'a codex exec line without the effort override');
  assert.deepStrictEqual(harnessChoices(CODEX_EFFORT_LINE), ['claude', 'agy', 'codex']);
  const interactive = shippedRecipe('Execute tasks').variants[0].lines[0];
  assert.deepStrictEqual(harnessChoices(interactive), ['claude', 'agy', 'codex'], 'an interactive line is offered Codex');
  assert.deepStrictEqual(harnessChoices(AGY_INTERACTIVE_LINE), ['claude', 'agy', 'codex']);
  assert.deepStrictEqual(harnessChoices(CODEX_INTERACTIVE_LINE), ['claude', 'agy', 'codex'], 'a bare codex line');
  assert.deepStrictEqual(harnessChoices("codex '$gurita:finish-mission' -m gpt-5.5; # interactive"), ['claude', 'agy', 'codex'], 'one without the override');
  assert.strictEqual(harnessChoices('codex "/gurita:finish-mission" -m gpt-5.5;'), undefined, 'a Codex line invoking its skill as /gurita:');
  assert.strictEqual(harnessChoices("codex resume '$gurita:finish-mission' -m gpt-5.5;"), undefined, 'a Codex subcommand other than exec');
  assert.strictEqual(harnessChoices("codex '$gurita:finish-mission' -c model_reasoning_effort=high; # interactive"), undefined, 'a bare codex line without -m');
  assert.strictEqual(harnessChoices('claude -p "/gurita:finish-mission" --model opus;'), undefined, 'a line without both flags');
  assert.strictEqual(harnessChoices('git pull'), undefined);
  assert.strictEqual(harnessChoices(SLOT_LINE), undefined);
});

test('an interactive claude or agy line switched to Codex becomes a bare codex line, its -i dropped and its # interactive mark kept', () => {
  const interactive = shippedRecipe('Execute tasks').variants[0].lines[0];
  assert.strictEqual(interactive, 'claude "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "opus" --effort high; # interactive');
  const changed = rewriteHarness(interactive, 'codex', CODEX_OFFER) as string;
  assert.strictEqual(changed, CODEX_INTERACTIVE_LINE, 'no exec, the prompt single-quoted as $gurita:, the bypass flag, -m, and the override');
  assert.deepStrictEqual(readLine(changed), { harness: 'codex', model: 'gpt-5.5', effort: 'high' });
  assert.strictEqual(readSkill(changed), 'complete-all-tasks');
  assert.ok(!isHeadless(changed), 'the switched line stays interactive');
  assert.strictEqual(rewriteHarness(AGY_INTERACTIVE_LINE, 'codex', CODEX_OFFER), CODEX_INTERACTIVE_LINE, 'the -i an agy line carried is dropped');
  assert.strictEqual(
    rewriteHarness('agy -i "/gurita:discuss-new-task --mission <path> <issue>" --model=claude-opus-5-5 --effort=medium; # interactive', 'codex', CODEX_OFFER),
    "codex '$gurita:discuss-new-task --mission <path> <issue>' -m gpt-5.5 -c model_reasoning_effort=medium; # interactive",
    'a flag written with = is written as its own words, and an offered effort kept',
  );
  assert.strictEqual(
    rewriteHarness('claude "/gurita:ask-in-mission-context --mission <path> it\'s" --model opus --effort xhigh; # interactive', 'codex', CODEX_OFFER),
    'codex "\\$gurita:ask-in-mission-context --mission <path> it\'s" -m gpt-5.5 -c model_reasoning_effort=high; # interactive',
    'a prompt holding a single quote is double-quoted, its $ escaped, and an effort not offered becomes the first listed',
  );
});

test('a bare interactive codex line switched back gives claude "…" or agy -i "…", and every interactive shipped line survives the round trip from both harnesses', () => {
  assert.strictEqual(
    rewriteHarness(CODEX_INTERACTIVE_LINE, 'claude', { models: ['opus'], efforts: ['xhigh', 'high'] }),
    'claude "/gurita:complete-all-tasks --mission <path>" --dangerously-skip-permissions --model "opus" --effort high; # interactive',
  );
  assert.strictEqual(rewriteHarness(CODEX_INTERACTIVE_LINE, 'agy', { models: ['claude-opus-5-5'], efforts: ['high'] }), AGY_INTERACTIVE_LINE);
  assert.strictEqual(
    rewriteHarness("codex '$gurita:finish-mission --mission <path>' -m gpt-5.5; # interactive", 'agy', AGY_OFFER),
    'agy -i "/gurita:finish-mission --mission <path>" --model gemini-4-argon --effort medium; # interactive',
    'a bare codex line without the override takes the first listed effort',
  );
  assert.throws(() => rewriteHarness(CODEX_INTERACTIVE_LINE, 'claude', { models: ['opus'], efforts: [] }), /claude effort list offers no effort/);
  const recipes = parseShippedRecipes(fs.readFileSync(SHIPPED_RECIPES, 'utf8'), SHIPPED_RECIPES);
  const lines = recipes.flatMap((recipe) => recipe.variants.flatMap((variant) => variant.lines));
  let rewritten = 0;
  for (const line of lines) {
    const read = readLine(line);
    if (read === undefined || read.harness === 'codex' || read.model === undefined || read.effort === undefined || isHeadless(line)) {
      continue;
    }
    const other = read.harness === 'claude' ? 'agy' : 'claude';
    const otherLine = rewriteHarness(line, other, other === 'agy' ? AGY_OFFER : CLAUDE_OFFER) as string;
    const otherRead = readLine(otherLine) as { harness: 'claude' | 'agy'; model: string; effort: string };
    for (const [from, fromRead] of [[line, read], [otherLine, otherRead]] as const) {
      const codex = rewriteHarness(from, 'codex', CODEX_OFFER);
      assert.ok(codex !== undefined, from);
      assert.ok(codex.startsWith("codex '$gurita:") && !codex.startsWith('codex exec'), codex);
      assert.ok(!/ -i /.test(codex.split(';')[0]), `no -i is kept: ${codex}`);
      assert.ok(codex.includes(' --dangerously-bypass-approvals-and-sandbox ') && !codex.includes('--dangerously-skip-permissions'), codex);
      assert.ok(codex.endsWith('; # interactive'), codex);
      assert.ok(!isHeadless(codex), codex);
      assert.strictEqual(readSkill(codex), readSkill(from));
      assert.deepStrictEqual(readLine(codex), {
        harness: 'codex',
        model: CODEX_OFFER.models[0],
        effort: CODEX_OFFER.efforts.includes(fromRead.effort as string) ? fromRead.effort : CODEX_OFFER.efforts[0],
      }, codex);
      const back = rewriteHarness(codex, fromRead.harness, { models: [fromRead.model as string], efforts: [fromRead.effort as string] });
      assert.strictEqual(back, from, 'the way back gives the line as written');
      rewritten++;
    }
  }
  assert.ok(rewritten >= 4, `only ${rewritten} interactive lines were rewritten`);
});

test('a switch of an interactive line to Codex refuses an empty model list and writes no effort override for an empty effort list', () => {
  const interactive = shippedRecipe('Execute tasks').variants[0].lines[0];
  assert.throws(() => rewriteHarness(interactive, 'codex', { models: [], efforts: ['high'] }), /codex model list offers no model/);
  const bare = rewriteHarness(AGY_INTERACTIVE_LINE, 'codex', { models: ['gpt-5.5'], efforts: [] }) as string;
  assert.strictEqual(bare, "codex '$gurita:complete-all-tasks --mission <path>' --dangerously-bypass-approvals-and-sandbox -m \"gpt-5.5\"; # interactive");
  assert.deepStrictEqual(readLine(bare), { harness: 'codex', model: 'gpt-5.5' }, 'the line runs at the default effort');
  assert.strictEqual(rewriteHarness(bare, 'agy', { models: ['claude-opus-5-5'], efforts: ['high', 'medium'] }), AGY_INTERACTIVE_LINE, 'switched back, the line takes the first listed effort');
});

test('a headless claude or agy line switched to Codex becomes a codex exec line with the bypass flag, -m, and the effort override', () => {
  assert.strictEqual(
    rewriteHarness(CLAUDE_LINE, 'codex', CODEX_OFFER),
    "codex exec '$gurita:review-mission-requirements --mission <path>' --dangerously-bypass-approvals-and-sandbox -m \"gpt-5.5\" -c model_reasoning_effort=high;",
    'an effort Codex does not offer becomes its first listed effort',
  );
  assert.strictEqual(
    rewriteHarness(AGY_LINE, 'codex', CODEX_OFFER),
    "codex exec '$gurita:review-mission-requirements --mission <path>' --dangerously-bypass-approvals-and-sandbox -m \"gpt-5.5\" -c model_reasoning_effort=medium;",
    'an effort Codex offers is kept',
  );
  const single = shippedRecipe('Single task with Opus High (Antigravity)').variants[0].lines[0];
  const changed = rewriteHarness(single, 'codex', CODEX_OFFER) as string;
  assert.strictEqual(
    changed,
    "codex exec '$gurita:complete-task --mission <path> <Task Title>' --dangerously-bypass-approvals-and-sandbox -m \"gpt-5.5\" -c model_reasoning_effort=high;",
  );
  assert.deepStrictEqual(readLine(changed), { harness: 'codex', model: 'gpt-5.5', effort: 'high' });
  assert.strictEqual(readSkill(changed), 'complete-task');
  assert.ok(isHeadless(changed), 'the switched line stays headless');
  assert.strictEqual(
    rewriteHarness('claude --print "/gurita:finish-mission --mission <path>" --model=opus --effort=high;', 'codex', CODEX_OFFER),
    "codex exec '$gurita:finish-mission --mission <path>' -m gpt-5.5 -c model_reasoning_effort=high;",
    '--print is dropped too, and a flag written with = is written as its own words',
  );
  assert.strictEqual(
    rewriteHarness('claude -p "/gurita:ask-in-mission-context --mission <path> it\'s" --model opus --effort high;', 'codex', CODEX_OFFER),
    'codex exec "\\$gurita:ask-in-mission-context --mission <path> it\'s" -m gpt-5.5 -c model_reasoning_effort=high;',
    'a prompt holding a single quote is double-quoted, its $ escaped',
  );
});

test('a codex exec line switched back to Claude Code or Antigravity keeps or maps its effort, and every headless shipped line survives the round trip', () => {
  assert.strictEqual(
    rewriteHarness(CODEX_EFFORT_LINE, 'claude', CLAUDE_OFFER),
    'claude -p "/gurita:review-mission-requirements --mission <path>" --dangerously-skip-permissions --model fable --effort high;',
    'an effort Claude Code offers is kept',
  );
  assert.strictEqual(
    rewriteHarness(CODEX_EFFORT_LINE, 'agy', { models: ['gemini-4-argon'], efforts: ['medium'] }),
    'agy -p "/gurita:review-mission-requirements --mission <path>" --dangerously-skip-permissions --model gemini-4-argon --effort medium;',
    'an effort Antigravity does not offer becomes its first listed',
  );
  assert.strictEqual(
    rewriteHarness(CODEX_LINE, 'agy', AGY_OFFER),
    'agy -p "/gurita:review-mission-requirements --mission <path>" --model gemini-4-argon --effort medium;',
    'a Codex line written without the override takes the first listed effort',
  );
  assert.throws(() => rewriteHarness(CODEX_EFFORT_LINE, 'claude', { models: ['fable'], efforts: [] }), /claude effort list offers no effort/);
  assert.throws(() => rewriteHarness(CODEX_EFFORT_LINE, 'agy', { models: [], efforts: ['high'] }), /agy model list offers no model/);
  const recipes = parseShippedRecipes(fs.readFileSync(SHIPPED_RECIPES, 'utf8'), SHIPPED_RECIPES);
  const lines = recipes.flatMap((recipe) => recipe.variants.flatMap((variant) => variant.lines));
  let rewritten = 0;
  for (const line of lines) {
    const read = readLine(line);
    if (read === undefined || read.harness === 'codex' || read.model === undefined || read.effort === undefined || !isHeadless(line)) {
      continue;
    }
    const codex = rewriteHarness(line, 'codex', CODEX_OFFER);
    assert.ok(codex !== undefined, line);
    assert.ok(codex.startsWith("codex exec '$gurita:"), codex);
    assert.ok(codex.includes(' --dangerously-bypass-approvals-and-sandbox ') && !codex.includes('--dangerously-skip-permissions'), codex);
    assert.deepStrictEqual(readLine(codex), {
      harness: 'codex',
      model: CODEX_OFFER.models[0],
      effort: CODEX_OFFER.efforts.includes(read.effort) ? read.effort : CODEX_OFFER.efforts[0],
    }, codex);
    assert.strictEqual(readSkill(codex), readSkill(line));
    assert.ok(isHeadless(codex), codex);
    const back = rewriteHarness(codex, read.harness, { models: [read.model], efforts: [read.effort] });
    assert.strictEqual(back, line, 'the way back gives the line as written');
    rewritten++;
  }
  assert.ok(rewritten >= 10, `only ${rewritten} shipped lines were rewritten`);
  const shippedCodex = shippedRecipe('Single task with GPT-6-Luna High (Codex)').variants[0].lines[0];
  const claude = rewriteHarness(shippedCodex, 'claude', { models: ['opus'], efforts: ['high'] }) as string;
  assert.strictEqual(claude, 'claude -p "/gurita:complete-task --mission <path> <Task Title>" --dangerously-skip-permissions --model "opus" --effort high;');
  assert.strictEqual(
    rewriteHarness(claude, 'codex', { models: ['gpt-6-luna'], efforts: ['high'] }),
    shippedCodex,
    'the shipped Codex line switched to Claude Code and back is given back as written',
  );
});

test('a switch to Codex refuses an empty model list and writes no effort override for an empty effort list', () => {
  assert.throws(() => rewriteHarness(CLAUDE_LINE, 'codex', { models: [], efforts: ['high'] }), /codex model list offers no model/);
  const bare = rewriteHarness(CLAUDE_LINE, 'codex', { models: ['gpt-5.5'], efforts: [] }) as string;
  assert.strictEqual(
    bare,
    "codex exec '$gurita:review-mission-requirements --mission <path>' --dangerously-bypass-approvals-and-sandbox -m \"gpt-5.5\";",
  );
  assert.deepStrictEqual(readLine(bare), { harness: 'codex', model: 'gpt-5.5' }, 'the line runs at the default effort');
  assert.strictEqual(
    rewriteHarness(bare, 'claude', { models: ['fable'], efforts: ['xhigh', 'high'] }),
    CLAUDE_LINE,
    'switched back, the line takes the first listed effort',
  );
});

/** The Claude Desktop line the shipped interactive Execute tasks line rewrites onto. */
const DESKTOP_LINE = 'claude-desktop "/gurita:complete-all-tasks --mission <path>"; # interactive';

test('a line opening with claude-desktop reads as a Claude Desktop line with its quoted prompt and skill, and carries no model or effort', () => {
  assert.deepStrictEqual(readLine(DESKTOP_LINE), { harness: 'claude-desktop' });
  assert.strictEqual(readSkill(DESKTOP_LINE), 'complete-all-tasks');
  assert.ok(!isHeadless(DESKTOP_LINE), 'it stays interactive');
  assert.deepStrictEqual(
    readLine('claude-desktop "/gurita:discuss-mission-goal <goal>" --dangerously-skip-permissions --model "fable" --effort xhigh; # interactive'),
    { harness: 'claude-desktop' },
    'flags a Desktop line still holds carry no value',
  );
  assert.strictEqual(readSkill("claude-desktop '/gurita:ask-in-mission-context --mission <path> <question>'; # interactive"), 'ask-in-mission-context');
  assert.strictEqual(replaceModel('claude-desktop "/gurita:x" --model opus; # interactive', 'fable'), undefined);
  assert.strictEqual(replaceEffort('claude-desktop "/gurita:x" --effort high; # interactive', 'low'), undefined);
  assert.strictEqual(harnessChoices(DESKTOP_LINE), undefined, 'a Desktop line is given no harness choices');
});

test('claude-desktop is matched by exact equality, a word only like it naming no harness', () => {
  for (const line of [
    'claude-desktops "/gurita:complete-all-tasks"; # interactive',
    'Claude-Desktop "/gurita:complete-all-tasks"; # interactive',
    'claude-desktop=x "/gurita:complete-all-tasks"; # interactive',
    '@claude-desktop "/gurita:complete-all-tasks"; # interactive',
    'echo claude-desktop "/gurita:complete-all-tasks";',
  ]) {
    assert.strictEqual(readLine(line), undefined, line);
    assert.strictEqual(readSkill(line), undefined, line);
  }
  assert.deepStrictEqual(readLine('"claude-desktop" "/gurita:x"; # interactive'), { harness: 'claude-desktop' }, 'the word as the shell reads it');
});

test('an interactive claude line rewritten onto Claude Desktop keeps its prompt and its # interactive mark and drops --model, --effort, and the bypass flag', () => {
  const interactive = shippedRecipe('Execute tasks').variants[0].lines[0];
  const changed = rewriteHarness(interactive, 'claude-desktop', CLAUDE_OFFER) as string;
  assert.strictEqual(changed, DESKTOP_LINE);
  assert.deepStrictEqual(readLine(changed), { harness: 'claude-desktop' });
  assert.strictEqual(readSkill(changed), 'complete-all-tasks');
  assert.ok(!isHeadless(changed));
  assert.strictEqual(rewriteHarness(interactive, 'claude-desktop', { models: [], efforts: [] }), DESKTOP_LINE, 'the offer is not read');
  assert.strictEqual(
    rewriteHarness("claude '/gurita:discuss-new-task --mission <path> <issue>' --model=opus --add-dir ../x --effort=high --dangerously-skip-permissions; # interactive", 'claude-desktop', CLAUDE_OFFER),
    "claude-desktop '/gurita:discuss-new-task --mission <path> <issue>' --add-dir ../x; # interactive",
    'flags written with = are dropped, the prompt kept as written, and every other word kept',
  );
});

test('an interactive agy -i line rewritten onto Claude Desktop loses its -i and every value Desktop does not take', () => {
  assert.strictEqual(rewriteHarness(AGY_INTERACTIVE_LINE, 'claude-desktop', AGY_OFFER), DESKTOP_LINE);
  assert.strictEqual(
    rewriteHarness('agy -i "/gurita:discuss-mission-goal <goal>" --model "gemini-4-argon" --effort medium; # interactive', 'claude-desktop', AGY_OFFER),
    'claude-desktop "/gurita:discuss-mission-goal <goal>"; # interactive',
  );
});

test('a bare interactive codex line rewritten onto Claude Desktop is invoked as /gurita: and double-quoted, -m, the effort override, and the bypass flag dropped', () => {
  assert.strictEqual(rewriteHarness(CODEX_INTERACTIVE_LINE, 'claude-desktop', CODEX_OFFER), DESKTOP_LINE);
  assert.strictEqual(
    rewriteHarness("codex '$gurita:finish-mission --mission <path>' -m gpt-5.5; # interactive", 'claude-desktop', CODEX_OFFER),
    'claude-desktop "/gurita:finish-mission --mission <path>"; # interactive',
    'a line without the override',
  );
  assert.strictEqual(
    rewriteHarness('codex "\\$gurita:ask-in-mission-context --mission <path> it\'s" -m gpt-5.5 -c sandbox_mode=read-only --config=model_reasoning_effort=high; # interactive', 'claude-desktop', CODEX_OFFER),
    'claude-desktop "/gurita:ask-in-mission-context --mission <path> it\'s" -c sandbox_mode=read-only; # interactive',
    'an override of another key is kept',
  );
});

test('every shipped interactive line rewrites onto Claude Desktop from Claude Code, Antigravity, and Codex alike', () => {
  const lines = [
    ...new Set(
      parseShippedRecipes(fs.readFileSync(SHIPPED_RECIPES, 'utf8'), SHIPPED_RECIPES)
        .flatMap((recipe) => recipe.variants.flatMap((variant) => variant.lines))
        .filter((line) => line.startsWith('claude ') && !isHeadless(line)),
    ),
  ];
  assert.ok(lines.length >= 6, 'the shipped recipes hold interactive claude lines');
  for (const line of lines) {
    const desktop = rewriteHarness(line, 'claude-desktop', CLAUDE_OFFER) as string;
    const asked = /^claude ("[^"]*")/.exec(line);
    assert.ok(asked, line);
    assert.strictEqual(desktop, `claude-desktop ${asked[1]}; # interactive`, line);
    assert.strictEqual(readSkill(desktop), readSkill(line), line);
    for (const [harness, offer] of [['agy', AGY_OFFER], ['codex', CODEX_OFFER]] as const) {
      const other = rewriteHarness(line, harness, offer) as string;
      assert.strictEqual(rewriteHarness(other, 'claude-desktop', offer), desktop, `${harness}: ${other}`);
    }
  }
});

test('only an interactive line whose harness can be picked is rewritten onto Claude Desktop, and a Desktop line onto no other harness', () => {
  assert.strictEqual(rewriteHarness(CLAUDE_LINE, 'claude-desktop', CLAUDE_OFFER), undefined, 'a headless claude -p line');
  assert.strictEqual(rewriteHarness(AGY_LINE, 'claude-desktop', AGY_OFFER), undefined, 'a headless agy -p line');
  assert.strictEqual(rewriteHarness(CODEX_EFFORT_LINE, 'claude-desktop', CODEX_OFFER), undefined, 'a headless codex exec line');
  assert.strictEqual(
    rewriteHarness('claude "/gurita:complete-all-tasks --mission <path>" --model "opus" --effort high;', 'claude-desktop', CLAUDE_OFFER),
    undefined,
    'a line without the # interactive mark',
  );
  assert.strictEqual(
    rewriteHarness('claude -p "/gurita:complete-all-tasks" --model "opus" --effort high; # interactive', 'claude-desktop', CLAUDE_OFFER),
    undefined,
    'a marked line in the headless form',
  );
  assert.strictEqual(rewriteHarness('claude "/gurita:discuss-mission-goal" --model opus; # interactive', 'claude-desktop', CLAUDE_OFFER), undefined, 'a line without both flags');
  assert.strictEqual(rewriteHarness('git pull; # interactive', 'claude-desktop', CLAUDE_OFFER), undefined);
  assert.strictEqual(rewriteHarness(SLOT_LINE, 'claude-desktop', CLAUDE_OFFER), undefined);
  assert.strictEqual(rewriteHarness(DESKTOP_LINE, 'claude-desktop', CLAUDE_OFFER), DESKTOP_LINE, 'a Desktop line is given back unchanged');
  for (const [harness, offer] of [['claude', CLAUDE_OFFER], ['agy', AGY_OFFER], ['codex', CODEX_OFFER]] as const) {
    assert.strictEqual(rewriteHarness(DESKTOP_LINE, harness, offer), undefined, harness);
  }
});
