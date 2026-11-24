// What a file event on a mission document asks of the session's live read, and the debounce that
// gathers a burst of events into one re-read. The session's watcher covers the mission documents only, the files the
// discovery pattern's directories hold: `requirements.md`, `open_questions.xml`, and
// `TASKS_TODO.md` directly inside a `mission_*` directory. A change to a mission's requirements
// file, question document, or task list re-reads that mission's documents in process, the
// requirements file being where its page's introduction reads the title and goal, and creating or
// deleting a `requirements.md`, or changing a `TASKS_TODO.md`, also re-runs `missions.py live`,
// since those are what move the live list and its `started` or `defined`. Every event inside the debounce
// window is merged into one batch, handed on once the window passes with no further event. Beside
// it the session watches the repository's git directory, covering only the files that move `HEAD`:
// `HEAD`, `refs/heads/**`, and `packed-refs`, a linked worktree's `HEAD` in its own git directory
// and its refs in the common one, with lock files, the index, objects, and remote refs ignored, so
// a commit, a pull, or a branch switch made outside the extension's runs asks for the full re-read
// Refresh makes, through the same debounce. This module imports nothing from `vscode`.

import * as path from 'node:path';

/** The glob the watcher is created over, relative to the project root. */
export const WATCHED_PATTERN = '**/mission_*/{requirements.md,open_questions.xml,TASKS_TODO.md}';

/** How long the debounce waits after the last event of a burst, in milliseconds. */
export const DEBOUNCE_MS = 300;

/** The kind of a file event, as the watcher reports it. */
export type FileEventKind = 'created' | 'changed' | 'deleted';

/** What one event asks of the session's live read. */
export interface EventEffect {
  /** The mission's path as `missions.py live` prints it, relative to the root, with its trailing slash; empty for a git event, which names no mission. */
  mission: string;
  /** Whether the mission's documents are re-read in process. */
  documents: boolean;
  /** Whether `missions.py live` is run again. */
  live: boolean;
}

/**
 * What an event of `kind` on the file `file` asks of the live read whose project root is `root`, or
 * undefined when it asks nothing: a file outside the root or outside a `mission_*` directory, or a
 * file the watcher does not cover. A change to a `requirements.md` re-reads its mission's documents
 * only, for the title and goal its page's introduction draws, and moves nothing in the live list.
 */
export function eventEffect(root: string, file: string, kind: FileEventKind): EventEffect | undefined {
  const relative = path.relative(root, file);
  if (relative === '' || path.isAbsolute(relative)) {
    return undefined;
  }
  const parts = relative.split(path.sep);
  if (parts[0] === '..') {
    return undefined;
  }
  const name = parts.pop();
  const directory = parts[parts.length - 1];
  if (directory === undefined || !directory.startsWith('mission_')) {
    return undefined;
  }
  const mission = `${parts.join('/')}/`;
  if (name === 'requirements.md') {
    return kind === 'changed' ? { mission, documents: true, live: false } : { mission, documents: false, live: true };
  }
  if (name === 'open_questions.xml') {
    return { mission, documents: true, live: false };
  }
  if (name === 'TASKS_TODO.md') {
    return { mission, documents: true, live: true };
  }
  return undefined;
}

/** The glob covering the files that move `HEAD`, relative to a git directory that is also its common one. */
export const GIT_WATCHED_PATTERN = '{HEAD,packed-refs,refs/heads/**}';

/** The glob covering a linked worktree's own `HEAD`, relative to its git directory. */
export const GIT_HEAD_PATTERN = 'HEAD';

/** The glob covering a linked worktree's branch refs, relative to the common git directory. */
export const GIT_REFS_PATTERN = '{packed-refs,refs/heads/**}';

/** One watcher over a git directory: the directory it is created over and the glob relative to it. */
export interface GitWatch {
  base: string;
  pattern: string;
}

/**
 * The watchers over the git directory `gitDir`, as `git rev-parse --absolute-git-dir` prints it, and
 * the common directory `commonDir`, as `--git-common-dir` gives it, resolved to an absolute path:
 * one over the git directory when both are the same, and otherwise one over the git directory for its
 * `HEAD` and one over the common directory for the branch refs a linked worktree shares.
 */
export function gitWatches(gitDir: string, commonDir: string): GitWatch[] {
  if (path.resolve(gitDir) === path.resolve(commonDir)) {
    return [{ base: gitDir, pattern: GIT_WATCHED_PATTERN }];
  }
  return [
    { base: gitDir, pattern: GIT_HEAD_PATTERN },
    { base: commonDir, pattern: GIT_REFS_PATTERN },
  ];
}

/**
 * What an event on the file `file` of the git directory `base` a git watcher is created over asks of
 * the session's live read, whatever its kind, or undefined when it asks nothing: `HEAD`,
 * `packed-refs`, or a branch ref under `refs/heads/` asks for a full re-read, as Refresh makes, with
 * no mission's documents named, and a lock file, a file outside `base`, or any other file of the git
 * directory, the index, objects, and remote refs among them, asks nothing.
 */
export function gitEventEffect(base: string, file: string): EventEffect | undefined {
  const relative = path.relative(base, file);
  if (relative === '' || path.isAbsolute(relative)) {
    return undefined;
  }
  const parts = relative.split(path.sep);
  if (parts[0] === '..' || parts[parts.length - 1].endsWith('.lock')) {
    return undefined;
  }
  const covered =
    (parts.length === 1 && (parts[0] === 'HEAD' || parts[0] === 'packed-refs')) ||
    (parts.length > 2 && parts[0] === 'refs' && parts[1] === 'heads' && parts.every((part) => part !== ''));
  return covered ? { mission: '', documents: false, live: true } : undefined;
}

/** The merged effect of one burst of events. */
export interface RefreshBatch {
  /** The missions whose documents are re-read, in the order their first event came. */
  missions: string[];
  /** Whether `missions.py live` is run again. */
  live: boolean;
}

/**
 * Gathers events into one batch per burst: each added effect restarts the wait, and once `delay`
 * milliseconds pass with no further effect, `flush` is called once with the merged batch.
 */
export class RefreshQueue {
  private readonly missions = new Set<string>();
  private live = false;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly flush: (batch: RefreshBatch) => void,
    private readonly delay: number = DEBOUNCE_MS,
  ) {}

  /** Merges one event's effect into the pending batch and restarts the wait. */
  add(effect: EventEffect): void {
    if (effect.documents) {
      this.missions.add(effect.mission);
    }
    this.live = this.live || effect.live;
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => this.fire(), this.delay);
  }

  /** Drops the pending batch and its wait, flushing nothing. */
  dispose(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.missions.clear();
    this.live = false;
  }

  private fire(): void {
    this.timer = undefined;
    const batch: RefreshBatch = { missions: [...this.missions], live: this.live };
    this.missions.clear();
    this.live = false;
    this.flush(batch);
  }
}
