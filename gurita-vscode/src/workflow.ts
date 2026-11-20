// The step a mission's workflow diagram fills, the step to run next, chosen from the mission's
// state as `missions.py live` prints it, the facts of its documents that read, and, for a defined
// mission with no open question and no task only, whether git holds a `Requirements-review:`
// commit for it. An open question outranks a remaining task: `provide alternatives` while a
// question lacks alternatives, `recommend` while every question has alternatives and one lacks a
// pick, `answer` when every question has a pick, `complete` when no question is open and tasks
// remain, `finish` for a started mission with no open question and no task, and for a defined
// mission with neither `derive` when the review commit stands and `review` when it does not. A
// review pass that changed nothing leaves no commit and so is not seen. No step is chosen when a
// document the choice needs did not read, or when the git read the choice needs failed. This
// module imports nothing from `vscode`.

import { execFile } from 'node:child_process';
import { DocumentFacts } from './documents';

/** The diagram's eight blocks, in the order the flow runs through them. */
export const WORKFLOW_STEPS = ['define', 'review', 'alternatives', 'recommend', 'answer', 'derive', 'complete', 'finish'] as const;

/** One block of the workflow diagram. */
export type WorkflowStep = (typeof WORKFLOW_STEPS)[number];

/** The subject marker of the commit a review pass that changed something lands. */
export const REVIEW_MARKER = 'Requirements-review:';

/**
 * Whether the choice for a mission in state `state` with the document facts `facts` needs the
 * review read: only a defined mission whose documents both read and hold no open question and no
 * task.
 */
export function needsReviewRead(state: string, facts: DocumentFacts): boolean {
  return state === 'defined' && facts.questionsEmpty === true && facts.tasksRemain === false;
}

/**
 * The step to run next for a mission in state `state` with the document facts `facts`, each left
 * out when its file did not read, and `reviewed` whether git holds a review commit for it,
 * undefined when it was not read or the read failed. Undefined when no step can be chosen.
 */
export function nextStep(state: string, facts: DocumentFacts, reviewed?: boolean): WorkflowStep | undefined {
  if (facts.questionsEmpty === undefined) {
    return undefined;
  }
  if (!facts.questionsEmpty) {
    if (facts.lacksAlternatives) {
      return 'alternatives';
    }
    return facts.lacksPick ? 'recommend' : 'answer';
  }
  if (facts.tasksRemain === undefined) {
    return undefined;
  }
  if (facts.tasksRemain) {
    return 'complete';
  }
  if (state === 'started') {
    return 'finish';
  }
  if (state !== 'defined' || reviewed === undefined) {
    return undefined;
  }
  return reviewed ? 'derive' : 'review';
}

/** Whether a `git log --format=%s` print holds the review subject of the mission at `missionPath`. */
export function holdsReviewSubject(print: string, missionPath: string): boolean {
  const subject = `${REVIEW_MARKER} ${missionPath}`;
  return print.split('\n').some((line) => line.replace(/\r$/, '').trim() === subject);
}

/**
 * Whether git holds a `Requirements-review: <missionPath>` commit reachable from `HEAD` in the
 * project at `root`, undefined when git could not be read.
 */
export function reviewCommitted(root: string, missionPath: string, git = 'git'): Promise<boolean | undefined> {
  const subject = `${REVIEW_MARKER} ${missionPath}`;
  return new Promise((resolve) => {
    execFile(
      git,
      ['log', '--no-merges', '--format=%s', '--fixed-strings', `--grep=${subject}`],
      { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
      (error, stdout) => {
        resolve(error ? undefined : holdsReviewSubject(stdout, missionPath));
      },
    );
  });
}

/**
 * The step to run next for a mission, reading git through `readReview` only when the choice needs
 * the review commit.
 */
export async function missionStep(
  state: string,
  facts: DocumentFacts,
  readReview: () => Promise<boolean | undefined>,
): Promise<WorkflowStep | undefined> {
  return nextStep(state, facts, needsReviewRead(state, facts) ? await readReview() : undefined);
}
