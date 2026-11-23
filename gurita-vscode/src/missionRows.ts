// What the side-bar view's row of one live mission shows, out of the session's live read: its
// label, the mission's title; its description, the next workflow step's name followed by the
// counts of its open questions and its remaining tasks in a compact form such as
// `Derive tasks · 3 questions · 2 tasks`; whether its run is going, which its icon shows; and its
// tooltip, the mission's title and path with all five facts spelled out in full beneath them. Each
// step or count that could not be read is replaced, on its own, by the one fixed placeholder in
// its slot, never by a zero count, the facts that did read drawn as usual, and the tooltip names
// the cause of each: the file that is missing or does not parse, with its path, or for the step a
// failed git read. This module imports nothing from `vscode`.

import { DocumentNotice, MissionDocuments } from './documents';
import { LiveMission } from './live';
import { MissionWorkflow, WorkflowStep } from './workflow';

/** The one placeholder standing in the slot of a step or count that could not be read. */
export const UNREAD = '?';

/** The separator between the description's three slots. */
export const SLOT_SEPARATOR = ' · ';

/** The name each workflow step is shown under on a row. */
export const STEP_NAMES: Readonly<Record<WorkflowStep, string>> = {
  define: 'Define',
  'first-review': 'First review round',
  'additional-review': 'Additional review round',
  derive: 'Derive tasks',
  execute: 'Execute tasks',
  'follow-up': 'Follow up tasks',
  finish: 'Finish',
};

/** The cause the tooltip names for a step left unchosen by a failed git read. */
export const GIT_READ_FAILED = 'the git read of its review commits failed';

/** One live mission's row in the side-bar view. */
export interface MissionRow {
  /** The mission's path as `missions.py live` prints it, trailing slash included. */
  path: string;
  /** The mission's title. */
  label: string;
  /** The step's name and the two counts, each slot unread shown as the placeholder. */
  description: string;
  /** The title, the path, and the five facts spelled out in full, each unread one with its cause. */
  tooltip: string;
  /** Whether the mission's run is going. */
  running: boolean;
}

/** The cause a notice names: the file with its path, and whether it is missing or does not parse. */
export function noticeCause(notice: DocumentNotice): string {
  if (notice.reason === 'missing') {
    return `${notice.file} is missing`;
  }
  return notice.message === undefined || notice.message === '' ? `${notice.file} does not parse` : `${notice.file} does not parse: ${notice.message}`;
}

/** A count with its noun, singular for one. */
function counted(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * The cause the step of a mission could not be chosen, out of its documents as read: the question
 * document when it did not read, the task list when no question is open and it did not read, and
 * otherwise the git read of the review commits, the only other read the choice needs.
 */
export function stepCause(documents: MissionDocuments): string {
  if (documents.questions.state === 'failed') {
    return noticeCause(documents.questions.notice);
  }
  if (documents.facts.questionsEmpty === true && documents.tasks.state === 'failed') {
    return noticeCause(documents.tasks.notice);
  }
  return GIT_READ_FAILED;
}

/**
 * The row of the live mission `mission`, its documents `documents` and what its workflow draws
 * `workflow` as the session's live read holds them, and `running` whether its run is going.
 */
export function missionRow(mission: LiveMission, documents: MissionDocuments, workflow: MissionWorkflow, running: boolean): MissionRow {
  const step = workflow.step === undefined ? undefined : STEP_NAMES[workflow.step];
  const questions = documents.questions.state === 'read' ? documents.questions.questions.length : undefined;
  const tasks = documents.tasks.state === 'read' ? documents.tasks.headings.length : undefined;

  const description = [
    step ?? UNREAD,
    questions === undefined ? `${UNREAD} questions` : counted(questions, 'question', 'questions'),
    tasks === undefined ? `${UNREAD} tasks` : counted(tasks, 'task', 'tasks'),
  ].join(SLOT_SEPARATOR);

  const tooltip = [
    mission.title,
    mission.path,
    `Next step: ${step ?? `not read (${stepCause(documents)})`}`,
    `Open questions: ${documents.questions.state === 'read' ? questions : `not read (${noticeCause(documents.questions.notice)})`}`,
    `Remaining tasks: ${documents.tasks.state === 'read' ? tasks : `not read (${noticeCause(documents.tasks.notice)})`}`,
    `Run: ${running ? 'going' : 'not going'}`,
  ].join('\n');

  return { path: mission.path, label: mission.title, description, tooltip, running };
}
