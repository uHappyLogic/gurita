// The read of a mission's `TASKS_TODO.md`, its task list. The file is a `# TASKS TODO` heading
// followed by one section per remaining task, each opening on a column-0 `## <Task Title>` line;
// this read returns each section's title and brief in file order, read as the plugin's task-list
// tool reads them: every column-0 `## ` line is a heading, with no code-fence exemption, its text
// the rest of the line with its outer whitespace trimmed, and a section ends at its `---`
// separator, a `---` line whose next non-blank line is a heading or the end of the file, or else
// at the next heading, its brief the lines between with their outer blank lines trimmed; every
// other `---` line is body text. A file holding a merge-conflict marker line
// (`<<<<<<<`, `=======`, or `>>>>>>>` at column 0) is reported as unreadable with a message of
// this module's own. This module imports nothing from `vscode`.

import * as fs from 'node:fs';

/** The task list's file name inside a mission directory. */
export const TASK_LIST_NAME = 'TASKS_TODO.md';

/** A task list that cannot be read as one; its message is this module's own. */
export class TaskListError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaskListError';
  }
}

/** One remaining task of a task list: its `##` heading's text and its section's brief. */
export interface RemainingTask {
  title: string;
  brief: string;
}

/** The outcome of reading a task list from disk. */
export type TaskListRead =
  | { state: 'read'; file: string; tasks: RemainingTask[] }
  | { state: 'missing'; file: string }
  | { state: 'unreadable'; file: string; message: string };

const HEADING_PREFIX = '## ';
const SEPARATOR = '---';
const CONFLICT_MARKER = /^(<<<<<<<|=======|>>>>>>>)/;

function isHeading(line: string): boolean {
  return line.startsWith(HEADING_PREFIX);
}

/** Whether `lines[index]` is a section's separator: a `---` line whose next non-blank line is a heading or the end. */
function isSeparator(lines: readonly string[], index: number): boolean {
  if (lines[index].trimEnd() !== SEPARATOR) {
    return false;
  }
  let following = index + 1;
  while (following < lines.length && lines[following].trim() === '') {
    following += 1;
  }
  return following === lines.length || isHeading(lines[following]);
}

/** The lines joined by newlines, their leading and trailing blank lines dropped. */
function trimmed(lines: readonly string[]): string {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === '') {
    start += 1;
  }
  while (end > start && lines[end - 1].trim() === '') {
    end -= 1;
  }
  return lines.slice(start, end).join('\n');
}

/**
 * The remaining tasks of a task list's text, each its `##` heading's text and its brief, in file
 * order. A text holding a merge-conflict marker line throws a `TaskListError`.
 */
export function parseTasks(text: string): RemainingTask[] {
  const lines = text.split('\n').map((line) => line.replace(/\r$/, ''));
  const marker = lines.findIndex((line) => CONFLICT_MARKER.test(line));
  if (marker >= 0) {
    throw new TaskListError(`${TASK_LIST_NAME} holds a merge-conflict marker at line ${marker + 1}: ${lines[marker]}`);
  }
  const tasks: RemainingTask[] = [];
  let index = lines.findIndex(isHeading);
  if (index < 0) {
    return tasks;
  }
  while (index < lines.length) {
    const title = lines[index].slice(HEADING_PREFIX.length).trim();
    index += 1;
    const body: string[] = [];
    while (index < lines.length && !isHeading(lines[index])) {
      if (isSeparator(lines, index)) {
        index += 1;
        while (index < lines.length && !isHeading(lines[index])) {
          index += 1;
        }
        break;
      }
      body.push(lines[index]);
      index += 1;
    }
    tasks.push({ title, brief: trimmed(body) });
  }
  return tasks;
}

/** Whether any task remains in the list. */
export function tasksRemain(tasks: readonly RemainingTask[]): boolean {
  return tasks.length > 0;
}

/**
 * Reads the task list at `file`: its remaining tasks when it reads, `missing` when no file stands
 * there, and `unreadable` with this module's message when it holds a conflict marker or the
 * read itself fails.
 */
export function readTaskList(file: string): TaskListRead {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return { state: 'missing', file };
    }
    return { state: 'unreadable', file, message: `${TASK_LIST_NAME} could not be read: ${(error as Error).message}` };
  }
  try {
    return { state: 'read', file, tasks: parseTasks(text) };
  } catch (error) {
    if (error instanceof TaskListError) {
      return { state: 'unreadable', file, message: error.message };
    }
    throw error;
  }
}
