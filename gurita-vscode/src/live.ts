// The read of the live missions. The project root is the top level of the git work tree holding
// the first workspace folder, read by `git rev-parse --show-toplevel` run in that folder, and the
// live missions are the print of the bundled `missions.py live` run with `python3` from that top
// level: one line per live mission in path order, three tab-separated fields, the path with its
// trailing slash, `started` or `defined`, and the title. A read that fails carries its cause
// verbatim, classified by nothing: the tool's stderr when it ran and failed, the spawn error when
// a command could not be started, or that no folder is open. The git directory and the common
// directory a linked worktree's branch refs live in are read from the same top level, for the
// session's watch of git state. This module imports nothing from `vscode`.

import { execFile } from 'node:child_process';
import * as nodePath from 'node:path';

/** One live mission as `missions.py live` prints it. */
export interface LiveMission {
  path: string;
  state: 'started' | 'defined';
  title: string;
}

/** The outcome of reading the live missions. */
export type LiveRead =
  | { state: 'read'; root: string; missions: LiveMission[] }
  | { state: 'failed'; cause: string };

/** The cause the read carries when the extension never ran the query. */
export const NO_FOLDER_CAUSE = 'No folder is open in this window.';

/** A print of `missions.py live` that is not in its stated form. */
export class LivePrintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LivePrintError';
  }
}

/** The live missions of a `missions.py live` print, in the order printed. */
export function parseLive(stdout: string): LiveMission[] {
  const missions: LiveMission[] = [];
  for (const raw of stdout.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (line === '') {
      continue;
    }
    const fields = line.split('\t');
    const [path, state, title] = fields;
    if (fields.length !== 3 || path === '' || (state !== 'started' && state !== 'defined')) {
      throw new LivePrintError(`missions.py live printed a line not in its form: ${line}`);
    }
    missions.push({ path, state, title });
  }
  return missions;
}

interface Run {
  ok: boolean;
  stdout: string;
  cause: string;
}

function run(command: string, args: string[], cwd: string): Promise<Run> {
  return new Promise((resolve) => {
    execFile(command, args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (!error) {
        resolve({ ok: true, stdout, cause: '' });
        return;
      }
      // A command that ran and failed is told by what it printed on stderr; one that could not
      // be started, or printed nothing there, by the error itself.
      const printed = (stderr ?? '').trim();
      resolve({ ok: false, stdout, cause: printed !== '' ? printed : error.message });
    });
  });
}

/** The top level of the git work tree holding `folder`, or the cause it could not be read. */
export async function projectRoot(folder: string, git = 'git'): Promise<{ root: string } | { cause: string }> {
  const result = await run(git, ['rev-parse', '--show-toplevel'], folder);
  if (!result.ok) {
    return { cause: result.cause };
  }
  return { root: result.stdout.trim() };
}

/**
 * The git directory of the work tree whose top level is `root` and the common directory its branch
 * refs live in, both absolute, read by `git rev-parse --absolute-git-dir --git-common-dir` run from
 * `root`, the common directory resolved against `root` when git prints it relative; the two are the
 * same outside a linked worktree. Or the cause they could not be read.
 */
export async function gitDirectories(root: string, git = 'git'): Promise<{ gitDir: string; commonDir: string } | { cause: string }> {
  const result = await run(git, ['rev-parse', '--absolute-git-dir', '--git-common-dir'], root);
  if (!result.ok) {
    return { cause: result.cause };
  }
  const [gitDir, commonDir] = result.stdout.split('\n').map((line) => line.replace(/\r$/, ''));
  if (gitDir === undefined || gitDir === '' || commonDir === undefined || commonDir === '') {
    return { cause: `git rev-parse printed no git directory: ${result.stdout.trim()}` };
  }
  return { gitDir, commonDir: nodePath.resolve(root, commonDir) };
}

/**
 * The live missions of the project holding the first workspace folder, `folder` undefined when
 * no folder is open, read by running `missionsTool` with `python` from the project root.
 */
export async function readLive(folder: string | undefined, missionsTool: string, python = 'python3', git = 'git'): Promise<LiveRead> {
  if (folder === undefined) {
    return { state: 'failed', cause: NO_FOLDER_CAUSE };
  }
  const top = await projectRoot(folder, git);
  if ('cause' in top) {
    return { state: 'failed', cause: top.cause };
  }
  const result = await run(python, [missionsTool, 'live'], top.root);
  if (!result.ok) {
    return { state: 'failed', cause: result.cause };
  }
  try {
    return { state: 'read', root: top.root, missions: parseLive(result.stdout) };
  } catch (error) {
    return { state: 'failed', cause: error instanceof Error ? error.message : String(error) };
  }
}
