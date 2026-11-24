// The read of one completed task's commit, which the extension opens in an editor tab of its own:
// `git show <hash>` run through `execFile` from the project root, as the extension already runs
// `git log` and the missions tool, its whole print the document's content, the commit's subject,
// its body, the task's verified bar, and its whole patch, the task's brief among the removed lines
// of `TASKS_TODO.md`. A commit is named by its hash alone, which the missions tool's `tasks` print
// carries, and only a hash of hexadecimal digits is read, so nothing else reaches git's arguments. A
// read that fails gives one fixed line with git's message, or the spawn error, beneath it in place
// of the commit. The commit's document path carries the hash with a `.diff` name, so its editor tab
// shows the hash. This module imports nothing from `vscode`.

import { execFile } from 'node:child_process';

/** The line a commit's document holds in place of the commit when `git show` could not read it. */
export const COMMIT_FAILURE_LINE = 'The commit could not be read.';

/** A commit hash as the missions tool prints it: hexadecimal digits, abbreviated or whole. */
const HASH = /^[0-9a-f]{4,64}$/;

/** The path of a commit's document: the hash with a `.diff` name. */
const COMMIT_PATH = /^\/([0-9a-f]{4,64})\.diff$/;

/** A commit's document holding the failure line with `cause` beneath it, in place of the commit. */
export function commitFailure(cause: string): string {
  return `${COMMIT_FAILURE_LINE}\n\n${cause}\n`;
}

/** Whether `value` is a commit hash the extension reads: hexadecimal digits, abbreviated or whole. */
export function isCommitHash(value: unknown): value is string {
  return typeof value === 'string' && HASH.test(value);
}

/** The path of the document of the commit `hash`, its editor tab showing the hash. */
export function commitPath(hash: string): string {
  return `/${hash}.diff`;
}

/** The hash the document path `documentPath` names, or undefined when it names no commit. */
export function commitHashOf(documentPath: string): string | undefined {
  return COMMIT_PATH.exec(documentPath)?.[1];
}

/**
 * The commit `hash` in the project at `root`, as `git show <hash>` prints it, run with `git` from
 * that root: its whole print on success, and otherwise the failure line with git's message, or the
 * spawn error when git could not be started, beneath it. A hash not of hexadecimal digits reaches no
 * git call and reads as failed.
 */
export function readCommit(root: string, hash: string, git = 'git'): Promise<string> {
  if (!isCommitHash(hash)) {
    return Promise.resolve(commitFailure(`Not a commit hash: ${hash}`));
  }
  return new Promise((resolve) => {
    execFile(git, ['show', hash], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const printed = (stderr ?? '').trim();
        resolve(commitFailure(printed !== '' ? printed : error.message));
        return;
      }
      resolve(stdout);
    });
  });
}
