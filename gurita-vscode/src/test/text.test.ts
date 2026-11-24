import { test } from 'node:test';
import * as assert from 'node:assert';
import { FakeElement, FakeText, loadRenderer } from './fakePage';

// The text renderer a mission window's texts share (`src/webview/text.ts`), compiled as the page
// shell loads it, run against the small stand-in for the DOM in `fakePage.ts`.

const renderer = loadRenderer();

/** A drawn node as a plain shape: a text node as its text, an element as its tag and what it holds. */
type Shape = string | { tag: string; text?: string; children?: Shape[] };

function shape(node: FakeElement | FakeText): Shape {
  if (node instanceof FakeText) {
    return node.textContent;
  }
  if (node.children.length === 0) {
    return { tag: node.tagName, text: node.textContent };
  }
  return { tag: node.tagName, children: node.children.map(shape) };
}

test('lines separated by a blank line become paragraphs, the lines of one joined by a space', () => {
  const drawn = renderer.renderText('The first paragraph\nruns on here.\n\n\nThe second one.\n');
  assert.deepStrictEqual(drawn.map(shape), [
    { tag: 'p', children: ['The first paragraph runs on here.'] },
    { tag: 'p', children: ['The second one.'] },
  ]);
});

test('consecutive lines opening with "- " become one bulleted list, an indented line continuing its item', () => {
  const drawn = renderer.renderText('Before the list.\n- one\n- two\n  runs on\n- three\n\nAfter it.');
  assert.deepStrictEqual(drawn.map(shape), [
    { tag: 'p', children: ['Before the list.'] },
    {
      tag: 'ul',
      children: [
        { tag: 'li', children: ['one'] },
        { tag: 'li', children: ['two runs on'] },
        { tag: 'li', children: ['three'] },
      ],
    },
    { tag: 'p', children: ['After it.'] },
  ]);
});

test('text between backticks becomes code inside a paragraph and a list item alike', () => {
  const drawn = renderer.renderText('Run `npm test` from `gurita-vscode/`.\n\n- edit `src/pane.ts` first\n- then the README');
  assert.deepStrictEqual(drawn.map(shape), [
    { tag: 'p', children: ['Run ', { tag: 'code', text: 'npm test' }, ' from ', { tag: 'code', text: 'gurita-vscode/' }, '.'] },
    {
      tag: 'ul',
      children: [
        { tag: 'li', children: ['edit ', { tag: 'code', text: 'src/pane.ts' }, ' first'] },
        { tag: 'li', children: ['then the README'] },
      ],
    },
  ]);
});

test('emphasis, links, headings, numbered lists, an unclosed backtick, and markup all stay plain text', () => {
  const drawn = renderer.renderText('# Heading\n**bold** _it_ [link](http://x) <b>tag</b>\n\n1. first\n2. second\n\nan empty `` pair and one ` alone');
  assert.deepStrictEqual(drawn.map(shape), [
    { tag: 'p', children: ['# Heading **bold** _it_ [link](http://x) <b>tag</b>'] },
    { tag: 'p', children: ['1. first 2. second'] },
    { tag: 'p', children: ['an empty `` pair and one ` alone'] },
  ]);
});

test('a text of blank lines gives no block, and the inline part draws one stretch alone with no block around it', () => {
  assert.deepStrictEqual(renderer.renderText('\n  \n'), []);
  assert.deepStrictEqual(renderer.renderInline('see `a` and\n\n- b').map(shape), ['see ', { tag: 'code', text: 'a' }, ' and\n\n- b']);
  assert.deepStrictEqual(renderer.renderInline('plain').map(shape), ['plain']);
});
