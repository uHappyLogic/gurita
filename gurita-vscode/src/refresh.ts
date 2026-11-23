// What a file event on a mission document asks of the session's live read, and the debounce that
// gathers a burst of events into one re-read. The session's watcher covers the mission documents only, the files the
// discovery pattern's directories hold: `requirements.md`, `open_questions.xml`, and
// `TASKS_TODO.md` directly inside a `mission_*` directory. A change to a mission's question
// document or task list re-reads that mission's documents in process, and creating or deleting a
// `requirements.md`, or changing a `TASKS_TODO.md`, also re-runs `missions.py live`, since those
// are what move the live list and its `started` or `defined`. Every event inside the debounce
// window is merged into one batch, handed on once the window passes with no further event. This
// module imports nothing from `vscode`.

import * as path from 'node:path';

/** The glob the watcher is created over, relative to the project root. */
export const WATCHED_PATTERN = '**/mission_*/{requirements.md,open_questions.xml,TASKS_TODO.md}';

/** How long the debounce waits after the last event of a burst, in milliseconds. */
export const DEBOUNCE_MS = 300;

/** The kind of a file event, as the watcher reports it. */
export type FileEventKind = 'created' | 'changed' | 'deleted';

/** What one event asks of the session's live read. */
export interface EventEffect {
  /** The mission's path as `missions.py live` prints it, relative to the root, with its trailing slash. */
  mission: string;
  /** Whether the mission's documents are re-read in process. */
  documents: boolean;
  /** Whether `missions.py live` is run again. */
  live: boolean;
}

/**
 * What an event of `kind` on the file `file` asks of the live read whose project root is `root`, or
 * undefined when it asks nothing: a file outside the root or outside a `mission_*` directory, a
 * file the watcher does not cover, or a change to a `requirements.md`, which moves nothing the
 * mission window or the side-bar view draws from the documents or the live list.
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
    return kind === 'changed' ? undefined : { mission, documents: false, live: true };
  }
  if (name === 'open_questions.xml') {
    return { mission, documents: true, live: false };
  }
  if (name === 'TASKS_TODO.md') {
    return { mission, documents: true, live: true };
  }
  return undefined;
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
