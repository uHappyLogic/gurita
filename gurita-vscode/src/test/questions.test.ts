import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  isEmptyDocument,
  parseQuestionDocument,
  QuestionDocument,
  QuestionDocumentError,
  Question,
  readQuestionDocument,
  withoutAlternatives,
  withoutRecommendation,
} from '../questions';

const REPOSITORY_FIXTURES = path.join(__dirname, '..', '..', '..', 'tests', 'fixtures');
const OWN_FIXTURES = path.join(__dirname, '..', '..', 'src', 'test', 'fixtures', 'questions');

function repositoryDocument(...parts: string[]): QuestionDocument {
  return parseQuestionDocument(fs.readFileSync(path.join(REPOSITORY_FIXTURES, ...parts, 'open_questions.xml'), 'utf8'));
}

function ownDocument(name: string): QuestionDocument {
  return parseQuestionDocument(fs.readFileSync(path.join(OWN_FIXTURES, name), 'utf8'));
}

function ids(questions: Question[]): string[] {
  return questions.map((block) => block.id);
}

function block(document: QuestionDocument, id: string): Question {
  const found = document.questions.find((each) => each.id === id);
  assert.ok(found, `no block named ${id}`);
  return found;
}

function refusal(text: string): string {
  try {
    parseQuestionDocument(text);
  } catch (error) {
    assert.ok(error instanceof QuestionDocumentError, `not a QuestionDocumentError: ${error}`);
    return error.message;
  }
  assert.fail('the document parsed');
}

test('the module imports nothing from vscode', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'questions.ts'), 'utf8');
  assert.doesNotMatch(source, /from\s+['"]vscode['"]|require\(\s*['"]vscode['"]\s*\)/);
});

test('the empty document holds no block', () => {
  const document = repositoryDocument('empty');
  assert.deepStrictEqual(document.questions, []);
  assert.strictEqual(isEmptyDocument(document), true);
  assert.deepStrictEqual(withoutAlternatives(document), []);
  assert.deepStrictEqual(withoutRecommendation(document), []);
});

test('a bare document lacks alternatives and recommendations on every block', () => {
  const document = repositoryDocument('bare');
  assert.deepStrictEqual(document.questions, [
    { id: 'First bare question', question: 'What is the first thing to decide?', principles: [], dependsOn: [], alternatives: [] },
    { id: 'Second bare question', question: 'What follows from the first decision?', principles: [], dependsOn: [], alternatives: [] },
  ]);
  assert.strictEqual(isEmptyDocument(document), false);
  assert.deepStrictEqual(ids(withoutAlternatives(document)), ['First bare question', 'Second bare question']);
  assert.deepStrictEqual(ids(withoutRecommendation(document)), ['First bare question', 'Second bare question']);
});

test('the host fixture project question document parses to its three bare blocks', () => {
  const document = repositoryDocument('host_project', 'fixture.mission_pocket-ledger-foundations');
  assert.deepStrictEqual(ids(document.questions), ['Data file format', 'Date input form', 'Summary period selection']);
  assert.deepStrictEqual(ids(withoutAlternatives(document)), ids(document.questions));
});

test('the annotated document returns every block whole, entities reversed', () => {
  const document = repositoryDocument('annotated');
  assert.deepStrictEqual(ids(document.questions), [
    'Escape hatch under sole writer',
    'Root element form',
    'Fixture bare block',
  ]);
  const hatch = block(document, 'Escape hatch under sole writer');
  assert.match(hatch.question, /^With the tool as the file's only writer, how does a user/);
  assert.strictEqual(hatch.recommendation?.option, 'Strip subcommand');
  assert.match(hatch.recommendation?.rationale ?? '', /^The goal gives the tool every deterministic edit/);
  assert.deepStrictEqual(
    hatch.alternatives.map((each) => each.id),
    ['Strip subcommand', 'Documented hand-edit exception', 'Strip behind a skill'],
  );
  assert.match(hatch.alternatives[0].text, /between its `<question>` element and its `<\/open-question>` line/);
  assert.strictEqual(hatch.alternatives[0].advantages.length, 1);
  assert.strictEqual(hatch.alternatives[0].drawbacks.length, 1);
  assert.match(hatch.alternatives[1].text, /the reading of "sole writer" the plugin already gives/);

  const root = block(document, 'Root element form');
  assert.deepStrictEqual(root, {
    id: 'Root element form',
    question: 'Is the empty document a self-closing root or an open and close tag pair?',
    principles: ['One rule over two', "Prefer the writer's invariant"],
    dependsOn: [{ question: 'Escape hatch under sole writer', option: 'Strip subcommand' }],
    recommendation: {
      option: 'Self-closing root',
      rationale:
        'The serializer already writes every empty element self-closing, and the root is an element like any other; a second rule for one tag buys a slightly prettier first diff at the cost of a special case in the one place the format is defined.',
    },
    alternatives: [
      {
        id: 'Self-closing root',
        text: 'The one rule for an element that holds nothing & needs no body: write it as `<open-questions/>`.',
        advantages: ['One serializer rule covers the root, `<depends-on/>`, and every other empty element alike.'],
        drawbacks: ['The first `add` rewrites the root line instead of inserting between two existing lines.'],
      },
      {
        id: 'Open and close pair',
        text: 'A two-line `<open-questions>` … `</open-questions>` document with nothing between the tags.',
        advantages: ['Adding or removing the last block is a pure insertion or deletion in the diff.'],
        drawbacks: ['The root becomes the one element the self-closing rule does not cover.'],
      },
    ],
  });
  assert.deepStrictEqual(ids(withoutAlternatives(document)), ['Fixture bare block']);
  assert.deepStrictEqual(ids(withoutRecommendation(document)), ['Fixture bare block']);
});

test('the compact view document tells the blocks lacking alternatives from those lacking a pick', () => {
  const document = repositoryDocument('compact_view');
  assert.deepStrictEqual(ids(document.questions), [
    'Log format',
    'Log level default',
    'Rotation trigger',
    'Log shipping',
    'Log sampling',
  ]);
  assert.deepStrictEqual(ids(withoutAlternatives(document)), ['Log sampling']);
  assert.deepStrictEqual(ids(withoutRecommendation(document)), ['Log shipping', 'Log sampling']);
  const rotation = block(document, 'Rotation trigger');
  assert.strictEqual(
    rotation.question,
    `What triggers a log file's rotation: its size & age, or a "nightly" <cron> schedule?`,
  );
  assert.deepStrictEqual(rotation.dependsOn, [{ question: 'Log format', option: 'JSON lines' }]);
  assert.strictEqual(rotation.recommendation?.option, 'Size & age');
  assert.deepStrictEqual(
    rotation.alternatives.map((each) => each.id),
    ['Size & age', 'Nightly schedule'],
  );
  assert.deepStrictEqual(block(document, 'Log shipping').alternatives[0].advantages, [
    "Every host's logs are searchable in one place.",
  ]);
});

test('the entities document reverses all five entities in ids, attributes, and text', () => {
  const document = repositoryDocument('entities');
  assert.deepStrictEqual(document.questions, [
    {
      id: `Ampersand & angle <brackets>, "quotes", 'apostrophes'`,
      question: `Does text with &, <tag>, "double" and 'single' quotes survive a round trip?`,
      principles: ['Five entities & one rule'],
      dependsOn: [{ question: 'Some "other" question & more', option: "It's <this> one" }],
      recommendation: { option: 'A & B', rationale: `One rule for text & attributes: <, >, ", '.` },
      alternatives: [
        {
          id: 'A & B',
          text: `What <it> is & isn't, "quoted".`,
          advantages: [`Keeps &, <, >, ", and ' escaped in text.`],
          drawbacks: ["Every apostrophe is stored as '."],
        },
      ],
    },
  ]);
});

test('the sweep document parses every block, the conflict question among them', () => {
  const document = repositoryDocument('sweep');
  assert.deepStrictEqual(ids(document.questions), [
    'Storage backend',
    'Retry limit',
    'Entry cap',
    'Cache eviction',
    'Cache warmup',
  ]);
  assert.match(block(document, 'Entry cap').question, /^Which conflicting decision stands: "Cache size" or "Memory budget"\?/);
  assert.deepStrictEqual(block(document, 'Cache eviction').dependsOn, [
    { question: 'Storage backend', option: 'Flat JSON file' },
  ]);
  assert.deepStrictEqual(ids(withoutAlternatives(document)), ['Cache warmup']);
  assert.deepStrictEqual(ids(withoutRecommendation(document)), ['Cache warmup']);
});

test('a hand-written block is read whole: folded text, every reference, comments, and CDATA', () => {
  const document = ownDocument('whole_block.xml');
  assert.deepStrictEqual(document.questions, [
    {
      id: 'Cache size',
      question: 'How large is the cache?',
      principles: ['Smallest & simplest', 'Measure first'],
      dependsOn: [
        { question: 'Storage backend', option: 'SQLite file' },
        { question: 'Retry limit', option: 'Three retries' },
      ],
      recommendation: { option: 'Hundred entries', rationale: 'A <small> cap keeps a scan & a warmup short.' },
      alternatives: [
        {
          id: 'Hundred entries',
          text: 'Cap the cache at 100 entries. Entries past the cap are evicted.',
          advantages: ['A scan stays short.', 'Warmup is quick.'],
          drawbacks: ['More reads miss.'],
        },
        {
          id: 'No cap',
          text: 'Let the cache grow <unbounded> & unchecked.',
          advantages: ['No read misses for size.'],
          drawbacks: [],
        },
      ],
    },
    {
      id: 'Cache warmup',
      question: 'Is the cache warmed before its first read?',
      principles: [],
      dependsOn: [],
      alternatives: [],
    },
  ]);
  assert.deepStrictEqual(ids(withoutAlternatives(document)), ['Cache warmup']);
  assert.deepStrictEqual(ids(withoutRecommendation(document)), ['Cache warmup']);
});

test('a document holding merge-conflict markers is refused with the marker line named', () => {
  const message = refusal(fs.readFileSync(path.join(OWN_FIXTURES, 'conflict.xml'), 'utf8'));
  assert.strictEqual(message, 'open_questions.xml holds a merge-conflict marker at line 2: <<<<<<< HEAD');
  assert.match(refusal('<open-questions>\n=======\n</open-questions>\n'), /merge-conflict marker at line 2: =======/);
  assert.match(refusal('<open-questions/>\n>>>>>>> theirs\n'), /merge-conflict marker at line 2/);
});

test('a document that is not well-formed is refused with its line and column', () => {
  assert.strictEqual(
    refusal(fs.readFileSync(path.join(OWN_FIXTURES, 'malformed.xml'), 'utf8')),
    'open_questions.xml is not well-formed XML: mismatched tag: </open-questions> closes <open-question> at line 4, column 3',
  );
  assert.match(refusal(''), /not well-formed XML: no element found at line 1, column 1/);
  assert.match(refusal('<open-questions>\n'), /unclosed <open-questions> element at line 1, column 1/);
  assert.match(refusal('<open-questions><x a="1></open-questions>'), /a "<" inside an attribute value/);
  assert.match(refusal('<open-questions>&nbsp;</open-questions>'), /undefined entity "&nbsp;" at line 1, column 17/);
  assert.match(refusal('<open-questions>a & b</open-questions>'), /a "&" that opens no entity reference/);
  assert.match(refusal('<open-questions/><open-questions/>'), /content after the root element/);
  assert.match(refusal('<open-questions a="1" a="2"/>'), /duplicate attribute "a"/);
});

test('a well-formed document of a shape the format does not define is refused', () => {
  const cases: [string, RegExp][] = [
    ['<questions/>', /a <questions> root, not <open-questions>/],
    ['<open-questions>stray</open-questions>', /root carries text outside its child elements/],
    ['<open-questions><note/></open-questions>', /root carries an unexpected <note> element/],
    ['<open-questions><open-question><question>Q</question></open-question></open-questions>', /has no id attribute/],
    ['<open-questions><open-question id=" "><question>Q</question></open-question></open-questions>', /has an empty id attribute/],
    ['<open-questions><open-question id="A"/></open-questions>', /<open-question id="A"> has no <question> element/],
    [
      '<open-questions><open-question id="A"><question>Q</question><question>R</question></open-question></open-questions>',
      /carries 2 <question> elements/,
    ],
    [
      '<open-questions><open-question id="A"><question>Q</question><recommendation option="x">r</recommendation><recommendation option="y">s</recommendation></open-question></open-questions>',
      /carries 2 <recommendation> elements/,
    ],
    [
      '<open-questions><open-question id="A"><question>Q</question></open-question><open-question id="a"><question>R</question></open-question></open-questions>',
      /two <open-question> blocks carry the id "a"/,
    ],
    [
      '<open-questions><open-question id="A"><question>Q</question><alternative id="X">x</alternative><alternative id="x">y</alternative></open-question></open-questions>',
      /carries two <alternative> elements with the id "x"/,
    ],
    [
      '<open-questions><open-question id="A"><question>Q</question><alternative id="X">x<note/></alternative></open-question></open-questions>',
      /<alternative id="X"> of <open-question id="A"> carries an unexpected <note> element/,
    ],
    [
      '<open-questions><open-question id="A"><question>Q<b>bold</b></question></open-question></open-questions>',
      /the <question> element of <open-question id="A"> carries an unexpected <b> element/,
    ],
    [
      '<open-questions><open-question id="A"><question>Q</question><depends-on question="B"/></open-question></open-questions>',
      /a <depends-on> element of <open-question id="A"> has no option attribute/,
    ],
    [
      '<open-questions><open-question id="A"><question>Q</question><depends-on question="B" option="x">t</depends-on></open-question></open-questions>',
      /a <depends-on> element of <open-question id="A"> carries text/,
    ],
    [
      '<open-questions><open-question id="A" kind="x"><question>Q</question></open-question></open-questions>',
      /carries an unknown attribute "kind"/,
    ],
  ];
  for (const [text, expected] of cases) {
    const message = refusal(text);
    assert.match(message, /^open_questions\.xml: /);
    assert.match(message, expected);
  }
});

test('reading from disk reports a missing file, an unparsable one, and a read one', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-questions-'));
  try {
    const file = path.join(directory, 'open_questions.xml');
    assert.deepStrictEqual(readQuestionDocument(file), { state: 'missing', file });

    fs.copyFileSync(path.join(OWN_FIXTURES, 'conflict.xml'), file);
    assert.deepStrictEqual(readQuestionDocument(file), {
      state: 'unparsable',
      file,
      message: 'open_questions.xml holds a merge-conflict marker at line 2: <<<<<<< HEAD',
    });

    fs.copyFileSync(path.join(REPOSITORY_FIXTURES, 'bare', 'open_questions.xml'), file);
    const read = readQuestionDocument(file);
    assert.strictEqual(read.state, 'read');
    assert.deepStrictEqual(read.state === 'read' && ids(read.document.questions), [
      'First bare question',
      'Second bare question',
    ]);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
