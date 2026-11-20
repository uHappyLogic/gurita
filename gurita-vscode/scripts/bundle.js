// The extension's own build step, run from the `vscode:prepublish` script so that every
// `vsce package` runs it. It copies the plugin's missions tool and the shipped snippet file
// verbatim into `bundled/`, and writes beside them `fixed_lines.tsv`: one line per row of the
// `## Fixed console lines` table of docs/skill-reference.md, its kind, a tab, and its line.
// Nothing it writes is tracked.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const EXTENSION_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(EXTENSION_ROOT, '..');
const BUNDLED = path.join(EXTENSION_ROOT, 'bundled');

const COPIES = [
  [path.join(REPO_ROOT, 'core', 'tools', 'missions.py'), 'missions.py'],
  [path.join(REPO_ROOT, 'snippets', 'GURITA_USAGE.md'), 'GURITA_USAGE.md'],
];
const REFERENCE = path.join(REPO_ROOT, 'docs', 'skill-reference.md');
const SECTION = '## Fixed console lines';
const KINDS = new Set(['success', 'no-op', 'stop', 'verdict']);
const FIXED_LINES = 'fixed_lines.tsv';

function fail(message) {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}

function fixedLineRows() {
  const lines = fs.readFileSync(REFERENCE, 'utf8').split(/\r?\n/);
  const headings = lines.filter((line) => line === SECTION).length;
  if (headings !== 1) {
    fail(`${REFERENCE} holds ${headings} ${JSON.stringify(SECTION)} headings, not one`);
  }
  const start = lines.indexOf(SECTION) + 1;
  let end = lines.findIndex((line, index) => index >= start && line.startsWith('## '));
  if (end === -1) {
    end = lines.length;
  }
  const rows = [];
  for (const text of lines.slice(start, end)) {
    if (!text.startsWith('|')) {
      continue;
    }
    const cells = text.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
    if (cells.join('|') === 'Source|Kind|Line' || cells.every((cell) => /^[-:]*$/.test(cell))) {
      continue;
    }
    if (cells.length !== 3) {
      fail(`a table row of ${cells.length} cells, not three: ${text}`);
    }
    const [, kind, lineCell] = cells;
    if (!KINDS.has(kind)) {
      fail(`a table row of unknown kind ${JSON.stringify(kind)}: ${text}`);
    }
    const line = /^`([^`]+)`$/.exec(lineCell);
    if (!line) {
      fail(`a Line cell that is not one code span: ${lineCell}`);
    }
    if (line[1].includes('\t')) {
      fail(`a line holding a tab: ${line[1]}`);
    }
    rows.push(`${kind}\t${line[1]}`);
  }
  if (rows.length === 0) {
    fail(`${REFERENCE} lists no fixed console line`);
  }
  return rows;
}

const rows = fixedLineRows();
fs.mkdirSync(BUNDLED, { recursive: true });
for (const [source, name] of COPIES) {
  fs.copyFileSync(source, path.join(BUNDLED, name));
}
fs.writeFileSync(path.join(BUNDLED, FIXED_LINES), rows.map((row) => `${row}\n`).join(''), 'utf8');
