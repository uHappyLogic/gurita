// The read of a mission's `TASKS_TODO.md`, its task list. The file is a `# TASKS TODO` heading
// followed by one section per remaining task, each opening on a column-0 `## <Task Title>` line;
// this read returns those headings' text in file order, read as the plugin's task-list tool
// reads them: every column-0 `## ` line is a heading, with no code-fence exemption, its text the
// rest of the line with its outer whitespace trimmed. A file holding a merge-conflict marker line
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

/** The outcome of reading a task list from disk. */
export type TaskListRead =
  | { state: 'read'; file: string; headings: string[] }
  | { state: 'missing'; file: string }
  | { state: 'unreadable'; file: string; message: string };

const HEADING_PREFIX = '## ';
const CONFLICT_MARKER = /^(<<<<<<<|=======|>>>>>>>)/;

/**
 * The remaining tasks' `##` headings of a task list's text, in file order. A text holding a
 * merge-conflict marker line throws a `TaskListError`.
 */
export function parseTaskHeadings(text: string): string[] {
  const lines = text.split('\n').map((line) => line.replace(/\r$/, ''));
  const marker = lines.findIndex((line) => CONFLICT_MARKER.test(line));
  if (marker >= 0) {
    throw new TaskListError(`${TASK_LIST_NAME} holds a merge-conflict marker at line ${marker + 1}: ${lines[marker]}`);
  }
  return lines.filter((line) => line.startsWith(HEADING_PREFIX)).map((line) => line.slice(HEADING_PREFIX.length).trim());
}

/** Whether any task remains in the list. */
export function tasksRemain(headings: readonly string[]): boolean {
  return headings.length > 0;
}

/**
 * Reads the task list at `file`: its headings when it reads, `missing` when no file stands
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
    return { state: 'read', file, headings: parseTaskHeadings(text) };
  } catch (error) {
    if (error instanceof TaskListError) {
      return { state: 'unreadable', file, message: error.message };
    }
    throw error;
  }
}
