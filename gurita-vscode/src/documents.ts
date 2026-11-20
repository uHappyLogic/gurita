// The read of one live mission's documents for its page: its `open_questions.xml` through the
// question parser and its `TASKS_TODO.md` through the heading read, both in process, and the
// label's facts that follow from them. A failure is confined to the part drawn from the file that
// failed: a question document that is missing or does not parse yields a notice in place of the
// question view and the label's question facts, and a task list that is missing or holds a
// conflict marker a notice in place of the task headings and the label's tasks-remain fact, each
// notice naming the file's path, whether it is missing or unparsable, and the parser's own
// message. Everything this module returns is plain data the extension posts to the page as it
// stands. This module imports nothing from `vscode`.

import * as path from 'node:path';
import { DOCUMENT_NAME, Question, isEmptyDocument, readQuestionDocument, withoutAlternatives, withoutRecommendation } from './questions';
import { TASK_LIST_NAME, readTaskList, tasksRemain } from './tasks';

/** A file a part of the page is drawn from that did not read; the page shows it as one notice. */
export interface DocumentNotice {
  /** The file's path as the page names it: the mission path joined with the file name. */
  file: string;
  /** Whether no file stands there or the file stands but does not parse. */
  reason: 'missing' | 'unparsable';
  /** The parser's own message, for an unparsable file. */
  message?: string;
}

/** The question part of a page: every block whole, or the notice replacing it. */
export type QuestionPart = { state: 'read'; questions: Question[] } | { state: 'failed'; notice: DocumentNotice };

/** The task part of a page: the remaining headings in file order, or the notice replacing it. */
export type TaskPart = { state: 'read'; headings: string[] } | { state: 'failed'; notice: DocumentNotice };

/** The label's facts, each left out when the file it is read from did not read. */
export interface LabelFacts {
  /** Whether any question carries no alternative. */
  lacksAlternatives?: boolean;
  /** Whether any question carries no pick. */
  lacksPick?: boolean;
  /** Whether the question list is empty. */
  questionsEmpty?: boolean;
  /** Whether any task remains. */
  tasksRemain?: boolean;
}

/** One mission's documents as its page draws them. */
export interface MissionDocuments {
  questions: QuestionPart;
  tasks: TaskPart;
  facts: LabelFacts;
}

/** The label's facts of the parts that read. */
export function labelFacts(questions: QuestionPart, tasks: TaskPart): LabelFacts {
  const facts: LabelFacts = {};
  if (questions.state === 'read') {
    const document = { questions: questions.questions };
    facts.lacksAlternatives = withoutAlternatives(document).length > 0;
    facts.lacksPick = withoutRecommendation(document).length > 0;
    facts.questionsEmpty = isEmptyDocument(document);
  }
  if (tasks.state === 'read') {
    facts.tasksRemain = tasksRemain(tasks.headings);
  }
  return facts;
}

/**
 * Reads the documents of the mission at `missionPath`, the path `missions.py live` prints with
 * its trailing slash, relative to the project root `root`.
 */
export function readMissionDocuments(root: string, missionPath: string): MissionDocuments {
  const shown = (name: string): string => `${missionPath}${missionPath.endsWith('/') ? '' : '/'}${name}`;

  const questionRead = readQuestionDocument(path.join(root, missionPath, DOCUMENT_NAME));
  let questions: QuestionPart;
  if (questionRead.state === 'read') {
    questions = { state: 'read', questions: questionRead.document.questions };
  } else if (questionRead.state === 'missing') {
    questions = { state: 'failed', notice: { file: shown(DOCUMENT_NAME), reason: 'missing' } };
  } else {
    questions = { state: 'failed', notice: { file: shown(DOCUMENT_NAME), reason: 'unparsable', message: questionRead.message } };
  }

  const taskRead = readTaskList(path.join(root, missionPath, TASK_LIST_NAME));
  let tasks: TaskPart;
  if (taskRead.state === 'read') {
    tasks = { state: 'read', headings: taskRead.headings };
  } else if (taskRead.state === 'missing') {
    tasks = { state: 'failed', notice: { file: shown(TASK_LIST_NAME), reason: 'missing' } };
  } else {
    tasks = { state: 'failed', notice: { file: shown(TASK_LIST_NAME), reason: 'unparsable', message: taskRead.message } };
  }

  return { questions, tasks, facts: labelFacts(questions, tasks) };
}
