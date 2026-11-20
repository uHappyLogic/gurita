import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { RefreshBatch, RefreshQueue, eventEffect } from '../refresh';

const ROOT = path.join(path.sep, 'project');

function at(...parts: string[]): string {
  return path.join(ROOT, ...parts);
}

test('the module imports nothing from vscode', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'refresh.ts'), 'utf8');
  assert.doesNotMatch(source, /from\s+['"]vscode['"]|require\(\s*['"]vscode['"]\s*\)/);
});

test('a change to a question document re-reads its mission in process only', () => {
  for (const kind of ['created', 'changed', 'deleted'] as const) {
    assert.deepStrictEqual(eventEffect(ROOT, at('lib', 'mission_beta', 'open_questions.xml'), kind), {
      mission: 'lib/mission_beta/',
      documents: true,
      live: false,
    });
  }
});

test('a change to a task list re-reads its mission and the live list', () => {
  for (const kind of ['created', 'changed', 'deleted'] as const) {
    assert.deepStrictEqual(eventEffect(ROOT, at('mission_alpha', 'TASKS_TODO.md'), kind), {
      mission: 'mission_alpha/',
      documents: true,
      live: true,
    });
  }
});

test('creating or deleting a requirements file re-reads the live list, and changing one asks nothing', () => {
  for (const kind of ['created', 'deleted'] as const) {
    assert.deepStrictEqual(eventEffect(ROOT, at('mission_alpha', 'requirements.md'), kind), {
      mission: 'mission_alpha/',
      documents: false,
      live: true,
    });
  }
  assert.strictEqual(eventEffect(ROOT, at('mission_alpha', 'requirements.md'), 'changed'), undefined);
});

test('a file outside a mission directory or outside the root asks nothing', () => {
  assert.strictEqual(eventEffect(ROOT, at('lib', 'TASKS_TODO.md'), 'changed'), undefined);
  assert.strictEqual(eventEffect(ROOT, at('TASKS_TODO.md'), 'changed'), undefined);
  assert.strictEqual(eventEffect(ROOT, at('mission_alpha', 'notes.md'), 'changed'), undefined);
  assert.strictEqual(eventEffect(ROOT, path.join(path.sep, 'elsewhere', 'mission_x', 'TASKS_TODO.md'), 'changed'), undefined);
  assert.strictEqual(eventEffect(ROOT, ROOT, 'changed'), undefined);
});

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('a burst of events is flushed once, merged', async () => {
  const flushed: RefreshBatch[] = [];
  const queue = new RefreshQueue((batch) => flushed.push(batch), 30);
  queue.add({ mission: 'a/mission_x/', documents: true, live: false });
  await wait(10);
  queue.add({ mission: 'b/mission_y/', documents: true, live: false });
  queue.add({ mission: 'a/mission_x/', documents: true, live: false });
  await wait(10);
  queue.add({ mission: 'c/mission_z/', documents: false, live: true });
  assert.strictEqual(flushed.length, 0);
  await wait(60);
  assert.deepStrictEqual(flushed, [{ missions: ['a/mission_x/', 'b/mission_y/'], live: true }]);
});

test('a burst after a flush starts a batch of its own', async () => {
  const flushed: RefreshBatch[] = [];
  const queue = new RefreshQueue((batch) => flushed.push(batch), 20);
  queue.add({ mission: 'a/mission_x/', documents: true, live: true });
  await wait(50);
  queue.add({ mission: 'b/mission_y/', documents: true, live: false });
  await wait(50);
  assert.deepStrictEqual(flushed, [
    { missions: ['a/mission_x/'], live: true },
    { missions: ['b/mission_y/'], live: false },
  ]);
});

test('a disposed queue flushes nothing', async () => {
  const flushed: RefreshBatch[] = [];
  const queue = new RefreshQueue((batch) => flushed.push(batch), 20);
  queue.add({ mission: 'a/mission_x/', documents: true, live: true });
  queue.dispose();
  await wait(50);
  assert.deepStrictEqual(flushed, []);
});
