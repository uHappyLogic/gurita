// The parser of a mission's `open_questions.xml`, the question document, read in process. The
// format is the one the module docstring of the plugin's `open_questions.py` states: a bare
// `<open-questions>` root, self-closing when empty, holding `<open-question id="Short Title">`
// blocks, each with one `<question>`, any number of `<applied-principle>` and
// `<depends-on question="…" option="…"/>` elements, at most one `<recommendation option="…">`,
// and `<alternative id="…">` elements each holding its what-it-is text and `<advantage>` and
// `<drawback>` children. Every block is returned whole with its entities reversed and every text
// folded to one line, so which blocks lack alternatives or a recommendation and whether the
// document is empty follow from the result. A document that does not parse, merge-conflict
// markers included, is reported with a message of this module's own. This module imports nothing
// from `vscode`.

import * as fs from 'node:fs';

/** The document's file name inside a mission directory. */
export const DOCUMENT_NAME = 'open_questions.xml';

export interface Alternative {
  /** The alternative's `id` attribute. */
  id: string;
  /** The what-it-is text: every run of text directly inside the alternative, folded and joined. */
  text: string;
  /** The texts of its `<advantage>` children, in document order. */
  advantages: string[];
  /** The texts of its `<drawback>` children, in document order. */
  drawbacks: string[];
}

export interface Dependency {
  /** The Short Title of the block the dependency names. */
  question: string;
  /** The id of that block's alternative the dependency assumes. */
  option: string;
}

export interface Recommendation {
  /** The id of the picked alternative. */
  option: string;
  /** The recommendation's rationale text. */
  rationale: string;
}

export interface Question {
  /** The block's `id` attribute, its Short Title. */
  id: string;
  /** The text of its one `<question>` element. */
  question: string;
  /** The texts of its `<applied-principle>` elements, in document order. */
  principles: string[];
  /** Its `<depends-on>` elements, in document order. */
  dependsOn: Dependency[];
  /** Its `<recommendation>`, when it carries one. */
  recommendation?: Recommendation;
  /** Its `<alternative>` elements, in document order. */
  alternatives: Alternative[];
}

export interface QuestionDocument {
  /** Every block, in document order. */
  questions: Question[];
}

/** A document that does not parse; its message is the parser's own. */
export class QuestionDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuestionDocumentError';
  }
}

/** The outcome of reading a question document from disk. */
export type QuestionDocumentRead =
  | { state: 'read'; file: string; document: QuestionDocument }
  | { state: 'missing'; file: string }
  | { state: 'unparsable'; file: string; message: string };

// --- text -------------------------------------------------------------------------------

/** The text as one line: whitespace runs collapsed to one space, ends trimmed. */
function fold(text: string): string {
  return text.split(/\s+/).filter((piece) => piece !== '').join(' ');
}

/** The case-folded key two ids are compared by. */
function idKey(id: string): string {
  return id.toLowerCase();
}

// --- XML reading ------------------------------------------------------------------------

interface Element {
  kind: 'element';
  tag: string;
  /** Attribute names and their entity-reversed values, in document order. */
  attributes: [string, string][];
  children: Node[];
}

interface Text {
  kind: 'text';
  value: string;
}

type Node = Element | Text;

const CONFLICT_MARKER = /^(<<<<<<<|=======|>>>>>>>)/;
const NAME = /[A-Za-z_:À-￿][-A-Za-z0-9_:.·À-￿]*/y;
const SPACE = /[ \t\r\n]*/y;
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** A reader over the document's text that reports every failure with its line and column. */
class Reader {
  private pos = 0;

  constructor(private readonly text: string) {}

  fail(reason: string, at: number = this.pos): never {
    const before = this.text.slice(0, at);
    const line = before.split('\n').length;
    const column = at - (before.lastIndexOf('\n') + 1) + 1;
    throw new QuestionDocumentError(
      `${DOCUMENT_NAME} is not well-formed XML: ${reason} at line ${line}, column ${column}`,
    );
  }

  done(): boolean {
    return this.pos >= this.text.length;
  }

  startsWith(token: string): boolean {
    return this.text.startsWith(token, this.pos);
  }

  expect(token: string, reason: string): void {
    if (!this.startsWith(token)) {
      this.fail(reason);
    }
    this.pos += token.length;
  }

  skipSpace(): boolean {
    SPACE.lastIndex = this.pos;
    SPACE.exec(this.text);
    const moved = SPACE.lastIndex > this.pos;
    this.pos = SPACE.lastIndex;
    return moved;
  }

  name(what: string): string {
    NAME.lastIndex = this.pos;
    const match = NAME.exec(this.text);
    if (match === null) {
      this.fail(`expected ${what}`);
    }
    this.pos = NAME.lastIndex;
    return match[0];
  }

  /** Skips up to and past the closing token, refusing a document that ends before it. */
  skipPast(close: string, what: string): string {
    const start = this.pos;
    const end = this.text.indexOf(close, this.pos);
    if (end < 0) {
      this.fail(`unclosed ${what}`, start);
    }
    this.pos = end + close.length;
    return this.text.slice(start, end);
  }

  /** Skips one comment or processing instruction when one starts here. */
  skipMisc(): boolean {
    if (this.startsWith('<!--')) {
      const at = this.pos;
      this.pos += 4;
      const body = this.skipPast('-->', 'comment');
      if (body.includes('--')) {
        this.fail('a comment holds "--"', at);
      }
      return true;
    }
    if (this.startsWith('<?')) {
      this.pos += 2;
      this.skipPast('?>', 'processing instruction');
      return true;
    }
    return false;
  }

  /** The text up to the next `<` (or the given quote), with every reference reversed. */
  characters(stop: string): string {
    let value = '';
    while (!this.done()) {
      const char = this.text[this.pos];
      if (char === '<' || char === stop) {
        break;
      }
      if (char === '&') {
        value += this.reference();
      } else {
        value += char;
        this.pos += 1;
      }
    }
    return value;
  }

  private reference(): string {
    const at = this.pos;
    const end = this.text.indexOf(';', at);
    const body = end < 0 ? '' : this.text.slice(at + 1, end);
    let value: string | undefined;
    if (/^#[0-9]+$/.test(body)) {
      value = codePoint(parseInt(body.slice(1), 10));
    } else if (/^#x[0-9A-Fa-f]+$/.test(body)) {
      value = codePoint(parseInt(body.slice(2), 16));
    } else if (/^[A-Za-z][A-Za-z0-9]*$/.test(body)) {
      value = ENTITIES[body];
      if (value === undefined) {
        this.fail(`undefined entity "&${body};"`, at);
      }
    }
    if (value === undefined) {
      this.fail('a "&" that opens no entity reference', at);
    }
    this.pos = end + 1;
    return value;
  }

  attributeValue(): string {
    const quote = this.text[this.pos];
    if (quote !== '"' && quote !== "'") {
      this.fail('expected a quoted attribute value');
    }
    this.pos += 1;
    const value = this.characters(quote);
    if (this.done()) {
      this.fail('unclosed attribute value');
    }
    if (this.text[this.pos] === '<') {
      this.fail('a "<" inside an attribute value');
    }
    this.pos += 1;
    return value.replace(/[\t\r\n]/g, ' ');
  }

  element(): Element {
    const at = this.pos;
    this.expect('<', 'expected an element');
    const tag = this.name('an element name');
    const attributes: [string, string][] = [];
    for (;;) {
      const spaced = this.skipSpace();
      if (this.startsWith('/>')) {
        this.pos += 2;
        return { kind: 'element', tag, attributes, children: [] };
      }
      if (this.startsWith('>')) {
        this.pos += 1;
        break;
      }
      if (this.done()) {
        this.fail(`unclosed <${tag}> start tag`, at);
      }
      if (!spaced) {
        this.fail(`expected whitespace, ">", or "/>" in the <${tag}> start tag`);
      }
      const nameAt = this.pos;
      const name = this.name('an attribute name');
      if (attributes.some(([held]) => held === name)) {
        this.fail(`duplicate attribute "${name}"`, nameAt);
      }
      this.skipSpace();
      this.expect('=', `expected "=" after the attribute "${name}"`);
      this.skipSpace();
      attributes.push([name, this.attributeValue()]);
    }
    const children: Node[] = [];
    const addText = (value: string): void => {
      const last = children[children.length - 1];
      if (last !== undefined && last.kind === 'text') {
        last.value += value;
      } else if (value !== '') {
        children.push({ kind: 'text', value });
      }
    };
    for (;;) {
      if (this.done()) {
        this.fail(`unclosed <${tag}> element`, at);
      }
      if (this.startsWith('</')) {
        const closeAt = this.pos;
        this.pos += 2;
        const closing = this.name('an element name');
        if (closing !== tag) {
          this.fail(`mismatched tag: </${closing}> closes <${tag}>`, closeAt);
        }
        this.skipSpace();
        this.expect('>', `expected ">" to end </${closing}>`);
        return { kind: 'element', tag, attributes, children };
      }
      if (this.startsWith('<![CDATA[')) {
        this.pos += 9;
        addText(this.skipPast(']]>', 'CDATA section'));
      } else if (this.startsWith('<!')) {
        if (!this.skipMisc()) {
          this.fail('unexpected markup declaration');
        }
      } else if (this.skipMisc()) {
        continue;
      } else if (this.startsWith('<')) {
        children.push(this.element());
      } else {
        addText(this.characters('<'));
      }
    }
  }

  /** The whole document's root element, with only whitespace, comments, and processing
   * instructions allowed around it. */
  document(): Element {
    if (this.startsWith('﻿')) {
      this.pos += 1;
    }
    for (;;) {
      this.skipSpace();
      if (this.startsWith('<!DOCTYPE')) {
        this.fail('a document type declaration is not supported');
      }
      if (!this.skipMisc()) {
        break;
      }
    }
    if (this.done()) {
      this.fail('no element found');
    }
    if (!this.startsWith('<')) {
      this.fail('text before the root element');
    }
    const root = this.element();
    for (;;) {
      this.skipSpace();
      if (this.done()) {
        return root;
      }
      if (!this.skipMisc()) {
        this.fail('content after the root element');
      }
    }
  }
}

function codePoint(value: number): string | undefined {
  const allowed =
    value === 0x9 ||
    value === 0xa ||
    value === 0xd ||
    (value >= 0x20 && value <= 0xd7ff) ||
    (value >= 0xe000 && value <= 0xfffd) ||
    (value >= 0x10000 && value <= 0x10ffff);
  return allowed ? String.fromCodePoint(value) : undefined;
}

// --- the document's shape ---------------------------------------------------------------

function shapeError(message: string): never {
  throw new QuestionDocumentError(`${DOCUMENT_NAME}: ${message}`);
}

function elements(elem: Element): Element[] {
  return elem.children.filter((child): child is Element => child.kind === 'element');
}

function texts(elem: Element): string[] {
  return elem.children.filter((child): child is Text => child.kind === 'text').map((child) => child.value);
}

/** The folded values of exactly the named attributes, in that order. */
function attributes(elem: Element, names: string[], context: string): string[] {
  const unknown = elem.attributes.map(([name]) => name).filter((name) => !names.includes(name)).sort();
  if (unknown.length > 0) {
    shapeError(`${context} carries an unknown attribute "${unknown[0]}"`);
  }
  return names.map((name) => {
    const held = elem.attributes.find(([each]) => each === name);
    if (held === undefined) {
      shapeError(`${context} has no ${name} attribute`);
    }
    const value = fold(held[1]);
    if (value === '') {
      shapeError(`${context} has an empty ${name} attribute`);
    }
    return value;
  });
}

/** The folded text of an element that holds text only. */
function leafText(elem: Element, context: string): string {
  const child = elements(elem)[0];
  if (child !== undefined) {
    shapeError(`${context} carries an unexpected <${child.tag}> element`);
  }
  return fold(texts(elem).join(''));
}

function noText(elem: Element, context: string): void {
  if (texts(elem).some((value) => fold(value) !== '')) {
    shapeError(`${context} carries text outside its child elements`);
  }
}

function alternative(elem: Element, blockContext: string): Alternative {
  const [id] = attributes(elem, ['id'], `an <alternative> element of ${blockContext}`);
  const context = `<alternative id="${id}"> of ${blockContext}`;
  const advantages: string[] = [];
  const drawbacks: string[] = [];
  for (const child of elements(elem)) {
    if (child.tag === 'advantage') {
      attributes(child, [], `an <advantage> element of ${context}`);
      advantages.push(leafText(child, `an <advantage> element of ${context}`));
    } else if (child.tag === 'drawback') {
      attributes(child, [], `a <drawback> element of ${context}`);
      drawbacks.push(leafText(child, `a <drawback> element of ${context}`));
    } else {
      shapeError(`${context} carries an unexpected <${child.tag}> element`);
    }
  }
  const text = texts(elem).map(fold).filter((piece) => piece !== '').join(' ');
  return { id, text, advantages, drawbacks };
}

function question(elem: Element): Question {
  const [id] = attributes(elem, ['id'], 'an <open-question> element');
  const context = `<open-question id="${id}">`;
  noText(elem, context);
  const block: Question = { id, question: '', principles: [], dependsOn: [], alternatives: [] };
  const questionTexts: string[] = [];
  const recommendations: Recommendation[] = [];
  const alternativeIds = new Set<string>();
  for (const child of elements(elem)) {
    if (child.tag === 'question') {
      attributes(child, [], `the <question> element of ${context}`);
      questionTexts.push(leafText(child, `the <question> element of ${context}`));
    } else if (child.tag === 'alternative') {
      const each = alternative(child, context);
      if (alternativeIds.has(idKey(each.id))) {
        shapeError(`${context} carries two <alternative> elements with the id "${each.id}"`);
      }
      alternativeIds.add(idKey(each.id));
      block.alternatives.push(each);
    } else if (child.tag === 'applied-principle') {
      attributes(child, [], `an <applied-principle> element of ${context}`);
      block.principles.push(leafText(child, `an <applied-principle> element of ${context}`));
    } else if (child.tag === 'depends-on') {
      const [target, option] = attributes(child, ['question', 'option'], `a <depends-on> element of ${context}`);
      if (leafText(child, `a <depends-on> element of ${context}`) !== '') {
        shapeError(`a <depends-on> element of ${context} carries text`);
      }
      block.dependsOn.push({ question: target, option });
    } else if (child.tag === 'recommendation') {
      const [option] = attributes(child, ['option'], `the <recommendation> element of ${context}`);
      recommendations.push({ option, rationale: leafText(child, `the <recommendation> element of ${context}`) });
    } else {
      shapeError(`${context} carries an unexpected <${child.tag}> element`);
    }
  }
  if (questionTexts.length === 0) {
    shapeError(`${context} has no <question> element`);
  }
  if (questionTexts.length > 1) {
    shapeError(`${context} carries ${questionTexts.length} <question> elements`);
  }
  if (recommendations.length > 1) {
    shapeError(`${context} carries ${recommendations.length} <recommendation> elements`);
  }
  block.question = questionTexts[0];
  if (recommendations.length === 1) {
    block.recommendation = recommendations[0];
  }
  return block;
}

// --- the public reads -------------------------------------------------------------------

/**
 * Parses a question document's text into its blocks, every block whole. A document holding a
 * merge-conflict marker line, one that is not well-formed XML, or one whose shape the format
 * does not define throws a `QuestionDocumentError` carrying this module's own message.
 */
export function parseQuestionDocument(text: string): QuestionDocument {
  const lines = text.split('\n');
  const marker = lines.findIndex((line) => CONFLICT_MARKER.test(line));
  if (marker >= 0) {
    throw new QuestionDocumentError(
      `${DOCUMENT_NAME} holds a merge-conflict marker at line ${marker + 1}: ${lines[marker].replace(/\r$/, '')}`,
    );
  }
  const root = new Reader(text).document();
  if (root.tag !== 'open-questions') {
    shapeError(`the document has a <${root.tag}> root, not <open-questions>`);
  }
  attributes(root, [], 'the <open-questions> root');
  noText(root, 'the <open-questions> root');
  const questions: Question[] = [];
  const seen = new Set<string>();
  for (const child of elements(root)) {
    if (child.tag !== 'open-question') {
      shapeError(`the <open-questions> root carries an unexpected <${child.tag}> element`);
    }
    const block = question(child);
    if (seen.has(idKey(block.id))) {
      shapeError(`two <open-question> blocks carry the id "${block.id}"`);
    }
    seen.add(idKey(block.id));
    questions.push(block);
  }
  return { questions };
}

/**
 * Reads and parses the question document at the given path: `missing` when no file stands
 * there, `unparsable` with the message when it cannot be read or does not parse, `read`
 * with the document otherwise.
 */
export function readQuestionDocument(file: string): QuestionDocumentRead {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return { state: 'missing', file };
    }
    return { state: 'unparsable', file, message: `${DOCUMENT_NAME} could not be read: ${(error as Error).message}` };
  }
  try {
    return { state: 'read', file, document: parseQuestionDocument(text) };
  } catch (error) {
    if (error instanceof QuestionDocumentError) {
      return { state: 'unparsable', file, message: error.message };
    }
    throw error;
  }
}

/** The blocks carrying no `<alternative>`, in document order. */
export function withoutAlternatives(document: QuestionDocument): Question[] {
  return document.questions.filter((block) => block.alternatives.length === 0);
}

/** The blocks carrying no `<recommendation>`, in document order. */
export function withoutRecommendation(document: QuestionDocument): Question[] {
  return document.questions.filter((block) => block.recommendation === undefined);
}

/** Whether the document holds no block, the converged state. */
export function isEmptyDocument(document: QuestionDocument): boolean {
  return document.questions.length === 0;
}
