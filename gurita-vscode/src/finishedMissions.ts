// The reads of the finished missions the record holds, for the side-bar view's Finished missions
// row and a finished mission's window. The list is the print of the bundled missions tool's
// `missions .` run with `python3` from the project root, with no `--last`: one line per mission,
// live or finished, four tab-separated fields, `live` or `finished`, the finish commit's author date
// (`-` for a live mission), the mission path with its trailing slash, and the title, every live line
// above every finished one and the finished lines newest first, of which every `finished` line is
// kept, in the order printed, with no count or bound of the extension's own. A finished mission's
// summary is the print of `summary <path>`: its first line the finish commit's author date, then the
// finish commit's body, the mission's title on its first line, a blank line, and its bullets. A read
// that fails carries its cause verbatim, classified by nothing: the tool's stderr when it ran and
// failed, the spawn error when it could not be started, or this module's own message for a print
// not in its form. This module imports nothing from `vscode`.

import { execFile } from 'node:child_process';

/** One finished mission as `missions.py missions .` prints it. */
export interface FinishedMission {
  /** The finish commit's author date, as YYYY-MM-DD. */
  date: string;
  /** The mission path, with its trailing slash. */
  path: string;
  /** The title the finish commit's body opens with, `-` when it holds none. */
  title: string;
}

/** The outcome of reading the finished missions. */
export type FinishedRead = { state: 'read'; missions: FinishedMission[] } | { state: 'failed'; cause: string };

/** One finished mission's summary as `missions.py summary <path>` prints it. */
export interface FinishedSummary {
  /** The first line of the print: the finish commit's author date, or `live` for a mission live again. */
  date: string;
  /** The body's first line, the mission's title; empty when the body holds none. */
  title: string;
  /** The rest of the body beneath the title, its bullets, its outer blank lines dropped. */
  summary: string;
}

/** The outcome of reading a finished mission's summary. */
export type SummaryRead = { state: 'read'; summary: FinishedSummary } | { state: 'failed'; cause: string };

/** A print of the missions tool that is not in its stated form. */
export class FinishedPrintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FinishedPrintError';
  }
}

/** Every finished mission of a `missions.py missions` print, in the order printed, newest first; the live lines are left out. */
export function parseFinishedMissions(stdout: string): FinishedMission[] {
  const missions: FinishedMission[] = [];
  for (const raw of stdout.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (line === '') {
      continue;
    }
    const fields = line.split('\t');
    const [state, date, path, title] = fields;
    if (fields.length !== 4 || (state !== 'live' && state !== 'finished') || date === '' || path === '') {
      throw new FinishedPrintError(`missions.py missions printed a line not in its form: ${line}`);
    }
    if (state === 'finished') {
      missions.push({ date, path, title });
    }
  }
  return missions;
}

/** The summary of a `missions.py summary` print: its first line, then the body's title line, then the rest beneath it. */
export function parseSummary(stdout: string): FinishedSummary {
  const lines = stdout.split('\n').map((line) => line.replace(/\r$/, ''));
  const date = (lines.shift() ?? '').trim();
  if (date === '') {
    throw new FinishedPrintError('missions.py summary printed no first line');
  }
  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift();
  }
  const title = (lines.shift() ?? '').trim();
  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift();
  }
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }
  return { date, title, summary: lines.join('\n') };
}

interface Run {
  ok: boolean;
  stdout: string;
  cause: string;
}

function run(python: string, args: string[], cwd: string): Promise<Run> {
  return new Promise((resolve) => {
    execFile(python, args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (!error) {
        resolve({ ok: true, stdout, cause: '' });
        return;
      }
      const printed = (stderr ?? '').trim();
      resolve({ ok: false, stdout, cause: printed !== '' ? printed : error.message });
    });
  });
}

/**
 * Every finished mission of the project at `root`, newest first, read by running
 * `missionsTool missions .` with `python` from that root, with no `--last`; or the cause they could
 * not be read.
 */
export async function readFinishedMissions(root: string, missionsTool: string, python = 'python3'): Promise<FinishedRead> {
  const result = await run(python, [missionsTool, 'missions', '.'], root);
  if (!result.ok) {
    return { state: 'failed', cause: result.cause };
  }
  try {
    return { state: 'read', missions: parseFinishedMissions(result.stdout) };
  } catch (failure) {
    return { state: 'failed', cause: failure instanceof Error ? failure.message : String(failure) };
  }
}

/**
 * The summary of the mission at `missionPath`, its path as `missions.py missions` prints it, read by
 * running `missionsTool summary <missionPath>` with `python` from the project root `root`; or the
 * cause it could not be read.
 */
export async function readFinishedSummary(root: string, missionsTool: string, missionPath: string, python = 'python3'): Promise<SummaryRead> {
  const result = await run(python, [missionsTool, 'summary', missionPath], root);
  if (!result.ok) {
    return { state: 'failed', cause: result.cause };
  }
  try {
    return { state: 'read', summary: parseSummary(result.stdout) };
  } catch (failure) {
    return { state: 'failed', cause: failure instanceof Error ? failure.message : String(failure) };
  }
}
