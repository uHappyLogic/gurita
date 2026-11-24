import { test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  GIT_HEAD_PATTERN,
  GIT_REFS_PATTERN,
  GIT_WATCHED_PATTERN,
  RefreshBatch,
  RefreshQueue,
  WATCHED_PATTERN,
  eventEffect,
  gitEventEffect,
  gitWatches,
} from '../refresh';

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

test('creating or deleting a requirements file re-reads the live list, and changing one re-reads its documents', () => {
  for (const kind of ['created', 'deleted'] as const) {
    assert.deepStrictEqual(eventEffect(ROOT, at('mission_alpha', 'requirements.md'), kind), {
      mission: 'mission_alpha/',
      documents: false,
      live: true,
    });
  }
  assert.deepStrictEqual(eventEffect(ROOT, at('mission_alpha', 'requirements.md'), 'changed'), {
    mission: 'mission_alpha/',
    documents: true,
    live: false,
  });
});

test('a file outside a mission directory or outside the root asks nothing', () => {
  assert.strictEqual(eventEffect(ROOT, at('lib', 'TASKS_TODO.md'), 'changed'), undefined);
  assert.strictEqual(eventEffect(ROOT, at('TASKS_TODO.md'), 'changed'), undefined);
  assert.strictEqual(eventEffect(ROOT, at('mission_alpha', 'notes.md'), 'changed'), undefined);
  assert.strictEqual(eventEffect(ROOT, path.join(path.sep, 'elsewhere', 'mission_x', 'TASKS_TODO.md'), 'changed'), undefined);
  assert.strictEqual(eventEffect(ROOT, ROOT, 'changed'), undefined);
});

const GIT_DIR = path.join(ROOT, '.git');

/** The full re-read a git event asks for. */
const FULL_REREAD = { mission: '', documents: false, live: true };

test('the mission documents and the files that move HEAD are the watched patterns', () => {
  assert.strictEqual(WATCHED_PATTERN, '**/mission_*/{requirements.md,open_questions.xml,TASKS_TODO.md}');
  assert.strictEqual(GIT_WATCHED_PATTERN, '{HEAD,packed-refs,refs/heads/**}');
  assert.strictEqual(GIT_HEAD_PATTERN, 'HEAD');
  assert.strictEqual(GIT_REFS_PATTERN, '{packed-refs,refs/heads/**}');
});

test('a git directory that is its own common directory is watched once, for HEAD, packed-refs, and the branch refs', () => {
  assert.deepStrictEqual(gitWatches(GIT_DIR, GIT_DIR), [{ base: GIT_DIR, pattern: GIT_WATCHED_PATTERN }]);
  assert.deepStrictEqual(gitWatches(GIT_DIR, `${GIT_DIR}${path.sep}`), [{ base: GIT_DIR, pattern: GIT_WATCHED_PATTERN }]);
});

test("a linked worktree's HEAD is watched in its git directory and its branch refs in the common one", () => {
  const linked = path.join(GIT_DIR, 'worktrees', 'side');
  assert.deepStrictEqual(gitWatches(linked, GIT_DIR), [
    { base: linked, pattern: GIT_HEAD_PATTERN },
    { base: GIT_DIR, pattern: GIT_REFS_PATTERN },
  ]);
});

test('HEAD, packed-refs, and a branch ref ask for a full re-read, whatever the event', () => {
  for (const file of [['HEAD'], ['packed-refs'], ['refs', 'heads', 'main'], ['refs', 'heads', 'feature', 'nested']]) {
    assert.deepStrictEqual(gitEventEffect(GIT_DIR, path.join(GIT_DIR, ...file)), FULL_REREAD, file.join('/'));
  }
});

test('a lock file, the index, objects, remote refs, and other git files ask nothing', () => {
  for (const file of [
    ['HEAD.lock'],
    ['packed-refs.lock'],
    ['refs', 'heads', 'main.lock'],
    ['index'],
    ['index.lock'],
    ['objects', 'ab', 'cdef0123'],
    ['refs', 'remotes', 'origin', 'main'],
    ['refs', 'tags', 'v1'],
    ['refs', 'heads'],
    ['ORIG_HEAD'],
    ['FETCH_HEAD'],
    ['logs', 'HEAD'],
    ['config'],
  ]) {
    assert.strictEqual(gitEventEffect(GIT_DIR, path.join(GIT_DIR, ...file)), undefined, file.join('/'));
  }
  assert.strictEqual(gitEventEffect(GIT_DIR, GIT_DIR), undefined);
  assert.strictEqual(gitEventEffect(GIT_DIR, path.join(ROOT, 'HEAD')), undefined, 'a file outside the git directory');
});

test("a git event's full re-read goes through the debounce, merged with a burst of document events", async () => {
  const flushed: RefreshBatch[] = [];
  const queue = new RefreshQueue((batch) => flushed.push(batch), 20);
  queue.add({ mission: 'a/mission_x/', documents: true, live: false });
  for (const file of [['refs', 'heads', 'main'], ['HEAD']]) {
    const effect = gitEventEffect(GIT_DIR, path.join(GIT_DIR, ...file));
    assert.ok(effect !== undefined);
    queue.add(effect);
  }
  assert.strictEqual(flushed.length, 0);
  await wait(60);
  assert.deepStrictEqual(flushed, [{ missions: ['a/mission_x/'], live: true }]);
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
