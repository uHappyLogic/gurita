// The step a mission's workflow diagram fills, the step to run next, chosen from the mission's
// state as `missions.py live` prints it, the facts of its documents that read, and the number of
// `Requirements-review:` commits git holds for it. The diagram shows the choices a person makes as
// seven steps in one line: define, first review round, additional review round, derive tasks,
// execute tasks, follow up tasks, and finish, the additional review round and follow up tasks
// optional. An open question outranks a remaining task: while a question lacks alternatives or a
// pick, `first review round` while git holds at most one review commit and `additional review
// round` once it holds two or more; `derive tasks` when every open question has a pick; `execute
// tasks` when no question is open and tasks remain; `finish` for a started mission with no open
// question and no task; and for a defined mission with neither, `derive tasks` once a review commit
// stands and `first review round` while none does. Define and follow up tasks are never chosen. A
// review pass that changed nothing leaves no commit and so is not counted. No step is chosen when a
// document the choice needs did not read, or when the git read the choice needs failed. The
// additional review round's block carries the count of the review commits beyond the first once
// git holds two or more, read for every mission whatever its step. The same count chooses the pane
// a mission's page opens on beneath its two pane headers: Remaining tasks when git holds at least
// one review commit for the mission and no question is open, and Open questions otherwise, a
// failed git read or a question document that did not read included. This module imports nothing
// from `vscode`.

import { execFile } from 'node:child_process';
import { DocumentFacts } from './documents';

/** The diagram's seven blocks, in the order the flow runs through them. */
export const WORKFLOW_STEPS = [
  'define',
  'first-review',
  'additional-review',
  'derive',
  'execute',
  'follow-up',
  'finish',
] as const;

/** One block of the workflow diagram. */
export type WorkflowStep = (typeof WORKFLOW_STEPS)[number];

/** The blocks of the steps a mission may skip, drawn with a dashed border. */
export const OPTIONAL_STEPS: readonly WorkflowStep[] = ['additional-review', 'follow-up'];

/** The subject marker of the commit a review pass that changed something lands. */
export const REVIEW_MARKER = 'Requirements-review:';

/**
 * The step to run next for a mission in state `state` with the document facts `facts`, each left
 * out when its file did not read, and `reviews` the number of review commits git holds for it,
 * undefined when the read failed. Undefined when no step can be chosen.
 */
export function nextStep(state: string, facts: DocumentFacts, reviews?: number): WorkflowStep | undefined {
  if (facts.questionsEmpty === undefined) {
    return undefined;
  }
  if (!facts.questionsEmpty) {
    if (facts.lacksAlternatives || facts.lacksPick) {
      if (reviews === undefined) {
        return undefined;
      }
      return reviews >= 2 ? 'additional-review' : 'first-review';
    }
    return 'derive';
  }
  if (facts.tasksRemain === undefined) {
    return undefined;
  }
  if (facts.tasksRemain) {
    return 'execute';
  }
  if (state === 'started') {
    return 'finish';
  }
  if (state !== 'defined' || reviews === undefined) {
    return undefined;
  }
  return reviews >= 1 ? 'derive' : 'first-review';
}

/**
 * The count the additional review round's block carries: the review commits beyond the first,
 * undefined while git holds at most one or when it could not be read.
 */
export function additionalRounds(reviews: number | undefined): number | undefined {
  return reviews !== undefined && reviews >= 2 ? reviews - 1 : undefined;
}

/** The number of lines of a `git log --format=%s` print that are the review subject of the mission at `missionPath`. */
export function countReviewSubjects(print: string, missionPath: string): number {
  const subject = `${REVIEW_MARKER} ${missionPath}`;
  return print.split('\n').filter((line) => line.replace(/\r$/, '').trim() === subject).length;
}

/**
 * The number of `Requirements-review: <missionPath>` commits reachable from `HEAD` in the project
 * at `root`, undefined when git could not be read.
 */
export function reviewCount(root: string, missionPath: string, git = 'git'): Promise<number | undefined> {
  const subject = `${REVIEW_MARKER} ${missionPath}`;
  return new Promise((resolve) => {
    execFile(
      git,
      ['log', '--no-merges', '--format=%s', '--fixed-strings', `--grep=${subject}`],
      { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
      (error, stdout) => {
        resolve(error ? undefined : countReviewSubjects(stdout, missionPath));
      },
    );
  });
}

/** One of the two panes beneath a mission page's pane headers: Open questions or Remaining tasks. */
export type MissionPane = 'questions' | 'tasks';

/**
 * The pane a mission's page opens on, for the document facts `facts` and `reviews` the number of
 * review commits git holds for the mission, undefined when the read failed: `tasks` (Remaining
 * tasks) when git holds at least one and the question document read with no question open, and
 * `questions` (Open questions) otherwise.
 */
export function defaultPane(facts: DocumentFacts, reviews: number | undefined): MissionPane {
  return reviews !== undefined && reviews >= 1 && facts.questionsEmpty === true ? 'tasks' : 'questions';
}

/**
 * What a mission's page draws from its state, its documents' facts, and git's review commits: the
 * diagram's filled block and the count its additional review round carries, each left out when
 * there is none, and the pane the page opens on.
 */
export interface MissionWorkflow {
  step?: WorkflowStep;
  additionalRounds?: number;
  defaultPane: MissionPane;
}

/** What the page of a mission draws from git's review commits, read once through `readReviews`. */
export async function missionWorkflow(
  state: string,
  facts: DocumentFacts,
  readReviews: () => Promise<number | undefined>,
): Promise<MissionWorkflow> {
  const reviews = await readReviews();
  const step = nextStep(state, facts, reviews);
  const rounds = additionalRounds(reviews);
  return {
    ...(step === undefined ? {} : { step }),
    ...(rounds === undefined ? {} : { additionalRounds: rounds }),
    defaultPane: defaultPane(facts, reviews),
  };
}
