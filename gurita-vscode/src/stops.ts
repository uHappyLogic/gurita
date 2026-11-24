// The reads of what would stop a run of a mission before it is started, made with the mission's
// other facts on every re-read, from which its page draws one notice per condition while it holds.
// The scope gate: the bundled missions tool's `gate <path>` run with `python3` from the project
// root, the plugin's own check before every run that derives, adds, or completes tasks, the scope
// counting as closed whenever the call prints anything on either stream or exits non-zero, a
// started mission holding it or the check itself failing, exactly as the plugin's runners stop on
// it. The mission files' uncommitted changes: `git status --porcelain` over the mission's
// `open_questions.xml` and `requirements.md` run from the project root, the answer sweep's own
// guard, which stops the sweep before any write while it prints a line; a git read that fails
// reads as unknown and draws nothing, since it says nothing of what the sweep would find. This
// module imports nothing from `vscode`.

import { execFile } from 'node:child_process';

/** What the scope gate gives for a mission: free, held by the missions it printed, or not checked, with what it printed instead. */
export type GateRead =
  | { state: 'free' }
  | { state: 'held'; holders: string[] }
  | { state: 'unchecked'; cause: string };

/** What would stop a run of a mission, as read with its other facts. */
export interface MissionStops {
  /** The scope gate's answer, which stops every run that derives, adds, or completes tasks unless it is free. */
  gate: GateRead;
  /**
   * The `git status --porcelain` lines of the mission's `open_questions.xml` and `requirements.md`,
   * which stop the answer sweep while any stands; empty when neither holds a change, left out when
   * git could not be read.
   */
  changes?: string[];
}

interface Run {
  error: Error | null;
  stdout: string;
  stderr: string;
}

function run(command: string, args: string[], cwd: string): Promise<Run> {
  return new Promise((resolve) => {
    execFile(command, args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ error, stdout: stdout ?? '', stderr: stderr ?? '' });
    });
  });
}

/** The non-empty lines of a print, their line endings dropped. */
function printedLines(print: string): string[] {
  return print
    .split('\n')
    .map((line) => line.replace(/\r$/, ''))
    .filter((line) => line.trim() !== '');
}

/**
 * The scope gate of the mission at `missionPath`, its path as `missions.py live` prints it, read by
 * running `missionsTool gate <missionPath>` with `python` from the project root `root`: free only
 * when the call exits 0 and prints nothing on either stream; held, by the paths it printed, when it
 * exits 0 printing them; and otherwise not checked, carrying what it printed on stderr, or the spawn
 * error when it could not be started.
 */
export async function readGate(root: string, missionsTool: string, missionPath: string, python = 'python3'): Promise<GateRead> {
  const result = await run(python, [missionsTool, 'gate', missionPath], root);
  const holders = printedLines(result.stdout);
  const printed = result.stderr.trim();
  if (result.error === null && printed === '') {
    return holders.length === 0 ? { state: 'free' } : { state: 'held', holders };
  }
  if (printed !== '') {
    return { state: 'unchecked', cause: printed };
  }
  return { state: 'unchecked', cause: result.error?.message ?? '' };
}

/**
 * The `git status --porcelain` lines of the mission at `missionPath`'s `open_questions.xml` and
 * `requirements.md`, run from the project root `root`, staged, unstaged, and untracked changes
 * alike; empty when neither holds a change, undefined when git could not be read.
 */
export async function readMissionFileChanges(root: string, missionPath: string, git = 'git'): Promise<string[] | undefined> {
  const result = await run(git, ['status', '--porcelain', '--', `${missionPath}open_questions.xml`, `${missionPath}requirements.md`], root);
  return result.error === null ? printedLines(result.stdout) : undefined;
}

/** What would stop a run of the mission at `missionPath`, both conditions read at once. */
export async function readMissionStops(root: string, missionsTool: string, missionPath: string, python = 'python3', git = 'git'): Promise<MissionStops> {
  const [gate, changes] = await Promise.all([readGate(root, missionsTool, missionPath, python), readMissionFileChanges(root, missionPath, git)]);
  return changes === undefined ? { gate } : { gate, changes };
}
