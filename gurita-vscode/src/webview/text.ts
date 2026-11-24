// The hand-written text renderer a mission window's texts share, loaded by the page shell before
// the page script, so its two functions stand in the page's global scope. It reads only the block
// shapes those texts hold: lines separated by a blank line are paragraphs, consecutive lines opening
// with `- ` are one bulleted list, a list item running on over the indented lines beneath it, and
// text between two backticks is code inside either. Emphasis, links, headings, numbered lists, and
// every other construct stay plain text, as written. Everything is built through DOM calls, never
// as markup, since every text comes from the workspace.

/**
 * The inline content of one stretch of text, `text`: its plain runs as text nodes and each stretch
 * between two backticks as a `code` element holding that stretch as text. A backtick with no closing
 * one after it, and a pair holding nothing, stay in the text as written.
 */
function renderInline(text: string): (HTMLElement | Text)[] {
  const nodes: (HTMLElement | Text)[] = [];
  let plain = '';
  let at = 0;
  while (at < text.length) {
    const open = text.indexOf('`', at);
    const close = open === -1 ? -1 : text.indexOf('`', open + 1);
    if (open === -1 || close === -1) {
      plain += text.slice(at);
      break;
    }
    if (close === open + 1) {
      plain += text.slice(at, close + 1);
      at = close + 1;
      continue;
    }
    plain += text.slice(at, open);
    if (plain !== '') {
      nodes.push(document.createTextNode(plain));
      plain = '';
    }
    const code = document.createElement('code');
    code.textContent = text.slice(open + 1, close);
    nodes.push(code);
    at = close + 1;
  }
  if (plain !== '') {
    nodes.push(document.createTextNode(plain));
  }
  return nodes;
}

/**
 * The blocks of the text `text`, in order: each run of lines between blank lines, or between a
 * blank line and a list, a `p` holding the run's lines joined by single spaces, and each run of
 * consecutive lines opening with `- ` a `ul` with one `li` per such line, an indented line directly
 * beneath an item continuing it. Every block's text is drawn by `renderInline`, so backticks give
 * code inside a paragraph and a list item alike. A text holding nothing but blank lines gives no
 * block.
 */
function renderText(text: string): HTMLElement[] {
  const blocks: HTMLElement[] = [];
  let paragraph: string[] = [];
  let items: string[] = [];

  function endParagraph(): void {
    if (paragraph.length > 0) {
      const node = document.createElement('p');
      node.append(...renderInline(paragraph.join(' ')));
      blocks.push(node);
      paragraph = [];
    }
  }

  function endList(): void {
    if (items.length > 0) {
      const list = document.createElement('ul');
      for (const item of items) {
        const node = document.createElement('li');
        node.append(...renderInline(item));
        list.append(node);
      }
      blocks.push(list);
      items = [];
    }
  }

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '') {
      endParagraph();
      endList();
    } else if (line.startsWith('- ')) {
      endParagraph();
      items.push(line.slice(2).trim());
    } else if (items.length > 0 && /^\s/.test(raw)) {
      items[items.length - 1] = `${items[items.length - 1]} ${line}`;
    } else {
      endList();
      paragraph.push(line);
    }
  }
  endParagraph();
  endList();
  return blocks;
}
