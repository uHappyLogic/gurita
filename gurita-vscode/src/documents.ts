// The read of one live mission's documents for its page: its `requirements.md` through the
// title and goal read, its `open_questions.xml` through the question parser, and its
// `TASKS_TODO.md` through the heading read, all in process, and the facts that follow from the
// last two, from which the workflow diagram's next step is chosen. A failure is confined to the
// part drawn from the file that failed: a requirements file that is missing or cannot be read
// yields a notice in place of the introduction's goal, a question document that is missing or
// does not parse a notice in place of the question view, leaving out the question facts, and a
// task list that is missing or holds a conflict marker a notice in place of the task headings,
// leaving out the tasks-remain fact, each notice naming the file's path, whether it is missing or
// unparsable, and the reader's own message. Everything this module returns is plain data the extension posts to the page as it
// stands. This module imports nothing from `vscode`.

import * as path from 'node:path';
import { DOCUMENT_NAME, Question, isEmptyDocument, readQuestionDocument, withoutAlternatives, withoutRecommendation } from './questions';
import { Introduction, REQUIREMENTS_NAME, readRequirements } from './requirements';
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

/** The introduction part of a page: the mission's title and goal from `requirements.md`, or the notice replacing the goal. */
export type IntroductionPart = ({ state: 'read' } & Introduction) | { state: 'failed'; notice: DocumentNotice };

/** The question part of a page: every block whole, or the notice replacing it. */
export type QuestionPart = { state: 'read'; questions: Question[] } | { state: 'failed'; notice: DocumentNotice };

/** The task part of a page: the remaining headings in file order, or the notice replacing it. */
export type TaskPart = { state: 'read'; headings: string[] } | { state: 'failed'; notice: DocumentNotice };

/** The documents' facts the next step is chosen from, each left out when the file it is read from did not read. */
export interface DocumentFacts {
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
  introduction: IntroductionPart;
  questions: QuestionPart;
  tasks: TaskPart;
  facts: DocumentFacts;
}

/** The documents' facts of the parts that read. */
export function documentFacts(questions: QuestionPart, tasks: TaskPart): DocumentFacts {
  const facts: DocumentFacts = {};
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

  const requirementsRead = readRequirements(path.join(root, missionPath, REQUIREMENTS_NAME));
  let introduction: IntroductionPart;
  if (requirementsRead.state === 'read') {
    introduction = { state: 'read', ...requirementsRead.introduction };
  } else if (requirementsRead.state === 'missing') {
    introduction = { state: 'failed', notice: { file: shown(REQUIREMENTS_NAME), reason: 'missing' } };
  } else {
    introduction = { state: 'failed', notice: { file: shown(REQUIREMENTS_NAME), reason: 'unparsable', message: requirementsRead.message } };
  }

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

  return { introduction, questions, tasks, facts: documentFacts(questions, tasks) };
}
