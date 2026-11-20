import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';

test('the compiler emits one file per source file', () => {
  const out = path.join(__dirname, '..');
  assert.ok(fs.existsSync(path.join(out, 'extension.js')));
  assert.ok(fs.existsSync(path.join(out, 'webview', 'page.js')));
});
