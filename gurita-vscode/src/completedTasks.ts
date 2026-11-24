// The read of a mission's completed tasks: the print of the bundled missions tool's
// `tasks <path> --with-body` run with `python3` from the project root, the mission's path as
// `missions.py live` prints it. The tool prints, newest first, one line per `Task-completion:`
// commit that changed the mission's directory, four tab-separated fields at column 0, the
// abbreviated hash, the author date, the mission path, and the title last, and beneath it, each
// indented by four spaces, the lines of the commit's body, the task's verified bar, a commit with no
// body being its line alone, so the next column-0 line is always the next task. A read that fails
// carries its cause verbatim, classified by nothing: the tool's stderr when it ran and failed, the
// spawn error when it could not be started, or this module's own message for a print not in that
// form. This module imports nothing from `vscode`.

import { execFile } from 'node:child_process';

/** One completed task as `missions.py tasks --with-body` prints it. */
export interface CompletedTask {
  /** The abbreviated hash of its `Task-completion:` commit. */
  hash: string;
  /** The commit's author date. */
  date: string;
  /** The mission path the tool joined the commit to, its placeholder when it joined none. */
  mission: string;
  /** The task's title, its `##` heading as the commit's subject carries it. */
  title: string;
  /** The commit's body, the task's verified bar, its lines with their four-space indent dropped; empty when the commit has none. */
  bar: string;
}

/** The outcome of reading a mission's completed tasks. */
export type CompletedRead = { state: 'read'; tasks: CompletedTask[] } | { state: 'failed'; cause: string };

/** The indent beneath a task line marking each line of its body. */
const BODY_INDENT = '    ';

/** A print of `missions.py tasks --with-body` that is not in its stated form. */
export class TasksPrintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TasksPrintError';
  }
}

/** The completed tasks of a `missions.py tasks --with-body` print, in the order printed, newest first. */
export function parseCompletedTasks(stdout: string): CompletedTask[] {
  const tasks: CompletedTask[] = [];
  const bars: string[][] = [];
  for (const raw of stdout.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (line.startsWith(BODY_INDENT)) {
      if (bars.length === 0) {
        throw new TasksPrintError(`missions.py tasks printed a body line before any task line: ${line}`);
      }
      bars[bars.length - 1].push(line.slice(BODY_INDENT.length));
      continue;
    }
    if (line.trim() === '') {
      continue;
    }
    const fields = line.split('\t');
    if (fields.length !== 4 || fields.some((field) => field === '')) {
      throw new TasksPrintError(`missions.py tasks printed a line not in its form: ${line}`);
    }
    const [hash, date, mission, title] = fields;
    tasks.push({ hash, date, mission, title, bar: '' });
    bars.push([]);
  }
  tasks.forEach((task, index) => {
    task.bar = bars[index].join('\n');
  });
  return tasks;
}

/**
 * The completed tasks of the mission at `missionPath`, its path as `missions.py live` prints it,
 * read by running `missionsTool tasks <missionPath> --with-body` with `python` from the project
 * root `root`; or the cause they could not be read.
 */
export function readCompletedTasks(root: string, missionsTool: string, missionPath: string, python = 'python3'): Promise<CompletedRead> {
  return new Promise((resolve) => {
    execFile(python, [missionsTool, 'tasks', missionPath, '--with-body'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const printed = (stderr ?? '').trim();
        resolve({ state: 'failed', cause: printed !== '' ? printed : error.message });
        return;
      }
      try {
        resolve({ state: 'read', tasks: parseCompletedTasks(stdout) });
      } catch (failure) {
        resolve({ state: 'failed', cause: failure instanceof Error ? failure.message : String(failure) });
      }
    });
  });
}
