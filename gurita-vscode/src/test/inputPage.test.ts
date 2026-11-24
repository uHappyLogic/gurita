import { test } from 'node:test';
import * as assert from 'node:assert';
import { FakeElement, Page, loadScript, stylesheetRules } from './fakePage';

// The input panel's page script, compiled as the panel loads it, run against the small stand-in for
// the DOM in `fakePage.ts`, so the drawn panel can be walked and its posts read.

/** Loads the compiled script of the input panel into a fresh page, its saved state `state`, as the panel does each time it is shown. */
function loadInput(state?: unknown): Page {
  return loadScript('input.js', undefined, { state });
}

/** The one element of `page` carrying the class `name`. */
function part(page: Page, name: string): FakeElement {
  const found = page.root.all().filter((each) => each.has(name));
  assert.strictEqual(found.length, 1, `one ${name} is drawn`);
  return found[0];
}

/** The button of `page` showing `text`. */
function button(page: Page, text: string): FakeElement {
  const found = page.root.all().find((each) => each.tagName === 'button' && each.textContent === text);
  assert.ok(found !== undefined, `no button ${text}`);
  return found;
}

test('the input panel draws the prompt the extension posts above one focused textarea, with Run and Cancel beneath, and posts ready on loading', () => {
  const page = loadInput();
  assert.deepStrictEqual(page.posted, [{ type: 'ready' }]);
  const panel = part(page, 'input-panel');
  assert.deepStrictEqual(
    panel.children.map((child) => (child instanceof FakeElement ? [child.tagName, child.className] : ['text'])),
    [
      ['p', 'input-prompt'],
      ['textarea', 'input-value'],
      ['p', 'input-refusal'],
      ['div', 'controls'],
    ],
    'the prompt, the textarea, the refusal line, and the controls, one beneath the other',
  );
  const value = part(page, 'input-value');
  assert.strictEqual(value.value, '', 'the textarea opens empty');
  assert.ok(value.focused, 'and takes the focus');
  assert.deepStrictEqual(
    part(page, 'controls').children.map((child) => (child instanceof FakeElement ? [child.tagName, child.type, child.className, child.textContent] : [])),
    [
      ['button', 'button', 'control', 'Run'],
      ['button', 'button', 'control', 'Cancel'],
    ],
  );
  assert.strictEqual(part(page, 'input-prompt').textContent, '', 'no prompt is drawn before one is posted');
  page.send({ type: 'input', prompt: 'The <b>goal</b>' });
  assert.strictEqual(part(page, 'input-prompt').textContent, 'The <b>goal</b>', 'the prompt is drawn as text, never as markup');
  assert.strictEqual(part(page, 'input-prompt').childElementCount, 0);
  page.send({ type: 'other', prompt: 'Not this' });
  page.send({ type: 'input', prompt: 7 });
  assert.strictEqual(part(page, 'input-prompt').textContent, 'The <b>goal</b>', 'any other message is ignored');
});

test('Run posts the text typed, line breaks included, Cancel posts the cancellation, and a Run with nothing but blanks is refused on the page and posts nothing', () => {
  const page = loadInput();
  const value = part(page, 'input-value');
  const refusal = part(page, 'input-refusal');
  button(page, 'Run').click();
  value.input('  \n\t ');
  button(page, 'Run').click();
  assert.deepStrictEqual(page.posted, [{ type: 'ready' }], 'an empty or blank Run posts nothing');
  assert.strictEqual(refusal.textContent, 'Type a value, or press Cancel to start nothing.');
  value.input('First line\n\n  Second line ');
  assert.strictEqual(refusal.textContent, '', 'typing clears the refusal');
  button(page, 'Run').click();
  assert.deepStrictEqual(page.posted.slice(1), [{ type: 'run', value: 'First line\n\n  Second line ' }], 'the text is posted exactly as typed');
  button(page, 'Cancel').click();
  assert.deepStrictEqual(page.posted.slice(2), [{ type: 'cancel' }]);
});

test('the text typed is saved as it is typed and given back to the textarea when the panel is loaded again', () => {
  const page = loadInput();
  assert.deepStrictEqual(page.saved, [], 'nothing is saved before anything is typed');
  part(page, 'input-value').input('Half a goal');
  part(page, 'input-value').input('Half a goal\nand more');
  assert.deepStrictEqual(page.saved, [{ value: 'Half a goal' }, { value: 'Half a goal\nand more' }]);
  const again = loadInput(page.saved[page.saved.length - 1]);
  assert.strictEqual(part(again, 'input-value').value, 'Half a goal\nand more');
  button(again, 'Run').click();
  assert.deepStrictEqual(again.posted, [{ type: 'ready' }, { type: 'run', value: 'Half a goal\nand more' }]);
  assert.strictEqual(part(loadInput({ value: 3 }), 'input-value').value, '', 'a saved state holding no text gives none back');
});

test("the stylesheet sets the input panel's textarea as wide as the page in the editor's font and the input colours, its refusal line in the error colour", () => {
  const rules = stylesheetRules();
  const rule = (selector: string) => {
    const found = rules.find((each) => each.selectors.includes(selector));
    assert.ok(found !== undefined, `a rule for ${selector}`);
    return found.declarations;
  };
  const textarea = rule('.input-panel textarea.input-value');
  assert.strictEqual(textarea.get('width'), '100%');
  assert.strictEqual(textarea.get('box-sizing'), 'border-box');
  assert.strictEqual(textarea.get('font-family'), 'var(--vscode-editor-font-family)');
  assert.strictEqual(textarea.get('color'), 'var(--vscode-input-foreground)');
  assert.strictEqual(textarea.get('background'), 'var(--vscode-input-background)');
  assert.strictEqual(rule('.input-panel .input-refusal').get('color'), 'var(--vscode-errorForeground)');
  assert.ok(rules.some((each) => each.selectors.includes('button.control')), 'Run and Cancel take the shared push-button look');
});
