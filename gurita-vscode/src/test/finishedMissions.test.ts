import { test } from 'node:test';
import * as assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { FinishedPrintError, parseFinishedMissions, parseSummary, readFinishedMissions, readFinishedSummary } from '../finishedMissions';
import { readCompletedTasks } from '../completedTasks';

// The reads of the finished missions and of one finished mission's summary, against their stated
// prints and git fixtures run through the plugin's own missions tool.

const MISSIONS_TOOL = path.join(__dirname, '..', '..', '..', 'core', 'tools', 'missions.py');

const LIVE = 'pkg/mission_live/';

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { cwd, stdio: 'ignore' });
}

/** Commits every change in `root` under `message`, at the author and committer date `date`. */
function commit(root: string, message: string, date: string): void {
  git(root, 'add', '-A');
  const env = { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date };
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-q', '-m', message], { cwd: root, stdio: 'ignore', env });
}

/** Defines the mission at `mission`, titled `title`, in a commit of its own on `date`. */
function define(root: string, mission: string, title: string, date: string): void {
  fs.mkdirSync(path.join(root, mission), { recursive: true });
  fs.writeFileSync(path.join(root, mission, 'requirements.md'), `# ${title}\n\n## Goal\n\nA goal.\n`);
  fs.writeFileSync(path.join(root, mission, 'open_questions.xml'), '<open-questions/>\n');
  fs.writeFileSync(path.join(root, mission, 'TASKS_TODO.md'), '# TASKS TODO\n');
  commit(root, `Mission-definition: ${mission}`, date);
}

/** Finishes the mission at `mission` by removing its directory in its `Mission-finish:` commit, its body `body`, on `date`. */
function finish(root: string, mission: string, body: string, date: string): void {
  git(root, 'rm', '-r', '-q', mission);
  commit(root, `Mission-finish: ${mission}\n\n${body}`, date);
}

/** A fresh empty git repository. */
function repository(): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-finished-')));
  git(root, 'init', '-q');
  fs.writeFileSync(path.join(root, 'README.md'), 'A project.\n');
  commit(root, 'Initial', '2026-11-01T10:00:00');
  return root;
}

test('the module imports nothing from vscode', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'finishedMissions.ts'), 'utf8');
  assert.doesNotMatch(source, /from\s+['"]vscode['"]|require\(\s*['"]vscode['"]\s*\)/);
});

test('a missions print is read as its finished lines alone, in the order printed, the live lines left out', () => {
  const print = [
    `live\t-\t${LIVE}\tA live mission`,
    'finished\t2026-11-24\tpkg/mission_newer/\tNewer mission',
    'finished\t2026-11-20\tmission_older/\t-',
    '',
  ].join('\n');
  assert.deepStrictEqual(parseFinishedMissions(print), [
    { date: '2026-11-24', path: 'pkg/mission_newer/', title: 'Newer mission' },
    { date: '2026-11-20', path: 'mission_older/', title: '-' },
  ]);
  assert.deepStrictEqual(parseFinishedMissions(''), [], 'an empty print is no finished mission');
  assert.deepStrictEqual(parseFinishedMissions(`live\t-\t${LIVE}\tA live mission\n`), [], 'a print of live lines alone is none');
  assert.deepStrictEqual(
    parseFinishedMissions('finished\t2026-11-24\tmission_a/\tA\r\n'),
    [{ date: '2026-11-24', path: 'mission_a/', title: 'A' }],
    'CRLF line endings are dropped',
  );
});

test('a missions print not in its stated form is refused with a message of its own', () => {
  assert.throws(() => parseFinishedMissions('finished\t2026-11-24\tmission_a/\n'), FinishedPrintError);
  assert.throws(() => parseFinishedMissions('done\t2026-11-24\tmission_a/\tA\n'), FinishedPrintError);
  assert.throws(() => parseFinishedMissions('finished\t\tmission_a/\tA\n'), FinishedPrintError);
});

test("a summary print is read as its first line's date, the body's title line, and the bullets beneath it", () => {
  assert.deepStrictEqual(parseSummary('2026-11-24\nThe mission\n\n- First `done`\n- Second done\n'), {
    date: '2026-11-24',
    title: 'The mission',
    summary: '- First `done`\n- Second done',
  });
  assert.deepStrictEqual(parseSummary('2026-11-24\n'), { date: '2026-11-24', title: '', summary: '' }, 'a body-less finish has no title and no summary');
  assert.deepStrictEqual(parseSummary('2026-11-24\nOnly a title\n'), { date: '2026-11-24', title: 'Only a title', summary: '' });
  assert.throws(() => parseSummary(''), FinishedPrintError, 'a print with no first line is refused');
});

test('every finished mission the record holds is read, newest first, with no bound, and a live one is not among them', async () => {
  const root = repository();
  define(root, LIVE, 'A live mission', '2026-11-02T10:00:00');
  const finished: string[] = [];
  for (let day = 3; day <= 16; day++) {
    const mission = `area/mission_m${day}/`;
    define(root, mission, `Mission ${day}`, `2026-11-${String(day).padStart(2, '0')}T10:00:00`);
    finish(root, mission, `Mission ${day}\n\n- Done on day ${day}.`, `2026-11-${String(day).padStart(2, '0')}T12:00:00`);
    finished.unshift(mission);
  }
  const read = await readFinishedMissions(root, MISSIONS_TOOL);
  assert.strictEqual(read.state, 'read');
  const missions = read.state === 'read' ? read.missions : [];
  assert.strictEqual(missions.length, 14, 'all fourteen finished missions are kept, more than any bound the plugin uses');
  assert.deepStrictEqual(
    missions.map((mission) => mission.path),
    finished,
    'newest first, as the tool sorts them',
  );
  assert.deepStrictEqual(missions[0], { date: '2026-11-16', path: 'area/mission_m16/', title: 'Mission 16' });
  assert.ok(!missions.some((mission) => mission.path === LIVE), 'the live mission is left out');
});

test('a project with no finished mission reads none', async () => {
  const root = repository();
  define(root, LIVE, 'A live mission', '2026-11-02T10:00:00');
  assert.deepStrictEqual(await readFinishedMissions(root, MISSIONS_TOOL), { state: 'read', missions: [] });
});

test("a finished mission's summary is read from its finish commit and its completed tasks from its Task-completion commits", async () => {
  const root = repository();
  const mission = 'pkg/mission_done/';
  define(root, mission, 'The done mission', '2026-11-02T10:00:00');
  fs.writeFileSync(path.join(root, mission, 'TASKS_TODO.md'), '# TASKS TODO\n\n## Build It\n\nBuild it.\n\n---\n');
  commit(root, `Task-derivation: ${mission}`, '2026-11-03T10:00:00');
  fs.writeFileSync(path.join(root, mission, 'TASKS_TODO.md'), '# TASKS TODO\n');
  commit(root, 'Task-completion: Build It\n\n- It is `built`', '2026-11-04T10:00:00');
  finish(root, mission, 'The done mission\n\n- It was built.\n- Nothing else.', '2026-11-05T10:00:00');

  assert.deepStrictEqual(await readFinishedSummary(root, MISSIONS_TOOL, mission), {
    state: 'read',
    summary: { date: '2026-11-05', title: 'The done mission', summary: '- It was built.\n- Nothing else.' },
  });
  const completed = await readCompletedTasks(root, MISSIONS_TOOL, mission);
  assert.strictEqual(completed.state, 'read');
  assert.deepStrictEqual(
    completed.state === 'read' ? completed.tasks.map(({ title, bar }) => ({ title, bar })) : [],
    [{ title: 'Build It', bar: '- It is `built`' }],
    'the removed mission directory still has its completed tasks read',
  );
});

test('a read that fails carries its cause: the tool refusing the path, or python not starting', async () => {
  const root = repository();
  const refused = await readFinishedSummary(root, MISSIONS_TOOL, 'pkg/mission_typo/');
  assert.strictEqual(refused.state, 'failed');
  assert.match(refused.state === 'failed' ? refused.cause : '', /^Error: /, "the tool's Error: line");
  const unstarted = await readFinishedMissions(root, MISSIONS_TOOL, path.join(root, 'no-python'));
  assert.strictEqual(unstarted.state, 'failed');
  assert.match(unstarted.state === 'failed' ? unstarted.cause : '', /ENOENT/);
  const notGit = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-finished-plain-')));
  const outside = await readFinishedMissions(notGit, MISSIONS_TOOL);
  assert.strictEqual(outside.state, 'failed', 'a project outside git fails with the cause the tool gives');
});
