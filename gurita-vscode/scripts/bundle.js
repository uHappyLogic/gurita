// The extension's own build step, run from the `vscode:prepublish` script so that every
// `vsce package` runs it. It copies the plugin's missions tool and the extension's own shipped
// recipe file, `shipped_recipes.md`, verbatim into `bundled/`, and writes beside them
// `fixed_lines.tsv`: one line per row of the plugin's fixed console line file,
// tests/fixed_console_lines.tsv, its kind field, a tab, and its line field, selected by column,
// and `plugin_version.txt`: the repository's `VERSION`, the plugin version the package is
// built from, as one line. It empties `bundled/` first, so the package carries no file an earlier
// build wrote. Nothing it writes is tracked.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const EXTENSION_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(EXTENSION_ROOT, '..');
const BUNDLED = path.join(EXTENSION_ROOT, 'bundled');

const COPIES = [
  [path.join(REPO_ROOT, 'core', 'tools', 'missions.py'), 'missions.py'],
  [path.join(EXTENSION_ROOT, 'shipped_recipes.md'), 'shipped_recipes.md'],
];
const LINES_FILE = path.join(REPO_ROOT, 'tests', 'fixed_console_lines.tsv');
const HEADER = 'source\tkind\tline';
const KINDS = new Set(['success', 'no-op', 'stop', 'verdict']);
const FIXED_LINES = 'fixed_lines.tsv';
const VERSION_FILE = path.join(REPO_ROOT, 'VERSION');
const PLUGIN_VERSION = 'plugin_version.txt';

function fail(message) {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}

function fixedLineRows() {
  const lines = fs.readFileSync(LINES_FILE, 'utf8').split('\n');
  if (lines.pop() !== '') {
    fail(`${LINES_FILE} does not end in a newline`);
  }
  if (lines.shift() !== HEADER) {
    fail(`${LINES_FILE} does not open with the header ${JSON.stringify(HEADER)}`);
  }
  const rows = [];
  for (const text of lines) {
    const fields = text.split('\t');
    if (fields.length !== 3) {
      fail(`a row of ${fields.length} fields, not three: ${JSON.stringify(text)}`);
    }
    const [, kind, line] = fields;
    if (!KINDS.has(kind)) {
      fail(`a row of unknown kind ${JSON.stringify(kind)}: ${JSON.stringify(text)}`);
    }
    if (line === '') {
      fail(`a row with an empty line field: ${JSON.stringify(text)}`);
    }
    rows.push(`${kind}\t${line}`);
  }
  if (rows.length === 0) {
    fail(`${LINES_FILE} lists no fixed console line`);
  }
  return rows;
}

function pluginVersion() {
  const text = fs.readFileSync(VERSION_FILE, 'utf8').trim();
  if (!/^\d+\.\d+\.\d+$/.test(text)) {
    fail(`${VERSION_FILE} reads ${JSON.stringify(text)}, not MAJOR.MINOR.PATCH`);
  }
  return text;
}

const rows = fixedLineRows();
const version = pluginVersion();
fs.rmSync(BUNDLED, { recursive: true, force: true });
fs.mkdirSync(BUNDLED, { recursive: true });
for (const [source, name] of COPIES) {
  fs.copyFileSync(source, path.join(BUNDLED, name));
}
fs.writeFileSync(path.join(BUNDLED, FIXED_LINES), rows.map((row) => `${row}\n`).join(''), 'utf8');
fs.writeFileSync(path.join(BUNDLED, PLUGIN_VERSION), `${version}\n`, 'utf8');
