import { test } from 'node:test';
import * as assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { LivePrintError, NO_FOLDER_CAUSE, gitDirectories, parseLive, projectRoot, readLive } from '../live';

const MISSIONS_TOOL = path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py');

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { cwd, stdio: 'ignore' });
}

/** A git repository holding two committed missions, the second under a nested scope. */
function project(): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-live-')));
  git(root, 'init', '-q');
  for (const [dir, title] of [
    ['mission_alpha', 'Alpha mission'],
    ['lib/mission_beta', 'Beta mission'],
  ]) {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
    fs.writeFileSync(path.join(root, dir, 'requirements.md'), `# ${title}\n\n## Goal\n\nA goal.\n`);
    fs.writeFileSync(path.join(root, dir, 'TASKS_TODO.md'), '# TASKS TODO\n');
  }
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'Mission-definition: both');
  return root;
}

test('the module imports nothing from vscode', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'live.ts'), 'utf8');
  assert.doesNotMatch(source, /from\s+['"]vscode['"]|require\(\s*['"]vscode['"]\s*\)/);
});

test('a live print yields its missions in the order printed', () => {
  assert.deepStrictEqual(parseLive('b/mission_x/\tstarted\tX title\na/mission_y/\tdefined\t-\n'), [
    { path: 'b/mission_x/', state: 'started', title: 'X title' },
    { path: 'a/mission_y/', state: 'defined', title: '-' },
  ]);
});

test('an empty live print yields no mission', () => {
  assert.deepStrictEqual(parseLive(''), []);
});

test('a line not in the live form is refused', () => {
  assert.throws(() => parseLive('mission_x/\tfinished\tX\n'), LivePrintError);
  assert.throws(() => parseLive('mission_x/\tstarted\n'), LivePrintError);
});

test('no open folder is the read never run', async () => {
  assert.deepStrictEqual(await readLive(undefined, MISSIONS_TOOL), { state: 'failed', cause: NO_FOLDER_CAUSE });
});

test("the git directory and the common directory are one outside a linked worktree, and a linked worktree's own directory sits beside the common one", async () => {
  const root = project();
  assert.deepStrictEqual(await gitDirectories(root), { gitDir: path.join(root, '.git'), commonDir: path.join(root, '.git') });
  const linked = path.join(fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-live-worktree-'))), 'side');
  git(root, 'worktree', 'add', '-q', '-b', 'side', linked);
  const read = await gitDirectories(linked);
  assert.ok('gitDir' in read, JSON.stringify(read));
  assert.strictEqual(read.commonDir, path.join(root, '.git'), "the linked worktree's refs live in the common directory");
  assert.strictEqual(path.dirname(read.gitDir), path.join(root, '.git', 'worktrees'), 'its own HEAD lives in a directory of its own');
  assert.ok(fs.existsSync(path.join(read.gitDir, 'HEAD')));
});

test('a folder in no git work tree gives the cause the git directory could not be read', async () => {
  const outside = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-live-none-')));
  const read = await gitDirectories(outside);
  assert.ok('cause' in read && read.cause !== '', JSON.stringify(read));
});

test('the project root is the git top level of a folder inside it', async () => {
  const root = project();
  assert.deepStrictEqual(await projectRoot(path.join(root, 'lib')), { root });
});

test('the live missions are read from the top level of the first folder', async () => {
  const root = project();
  assert.deepStrictEqual(await readLive(path.join(root, 'lib', 'mission_beta'), MISSIONS_TOOL), {
    state: 'read',
    root,
    missions: [
      { path: 'lib/mission_beta/', state: 'defined', title: 'Beta mission' },
      { path: 'mission_alpha/', state: 'defined', title: 'Alpha mission' },
    ],
  });
});

test("a failing missions tool carries its stderr verbatim", async () => {
  const root = project();
  const tool = path.join(root, 'failing.py');
  fs.writeFileSync(tool, 'import sys\nsys.stderr.write("Error: not a git work tree\\n")\nsys.exit(1)\n');
  assert.deepStrictEqual(await readLive(root, tool), { state: 'failed', cause: 'Error: not a git work tree' });
});

test('a python that cannot be started carries the spawn error', async () => {
  const root = project();
  const read = await readLive(root, MISSIONS_TOOL, 'gurita-no-such-python');
  assert.strictEqual(read.state, 'failed');
  assert.match((read as { cause: string }).cause, /spawn gurita-no-such-python ENOENT/);
});

test('a folder outside any git work tree carries git\'s message', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-nogit-'));
  const read = await readLive(folder, MISSIONS_TOOL);
  assert.strictEqual(read.state, 'failed');
  assert.match((read as { cause: string }).cause, /not a git repository/);
});
