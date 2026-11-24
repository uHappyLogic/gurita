// The read of a mission's `requirements.md` for its page's introduction: the mission's title and
// its goal, read as the bundled missions tool reads them. The title is the text of the first
// column-0 `# ` heading with its whitespace runs folded to single spaces, none when the file holds
// no such heading or the heading holds nothing else; the goal is the body of the `## Goal`
// section, from the line after its heading to the next `# ` or `## ` heading or the end of the
// file, verbatim, with its leading and trailing blank lines dropped, empty when the file holds no
// such section. This module imports nothing from `vscode`.

import * as fs from 'node:fs';

/** The requirements file's name inside a mission directory. */
export const REQUIREMENTS_NAME = 'requirements.md';

/** What a mission page's introduction draws from `requirements.md`. */
export interface Introduction {
  /** The mission's title; absent when the file holds no `# ` heading with text. */
  title?: string;
  /** The `## Goal` section's body as written, its outer blank lines dropped; empty when the file holds none. */
  goal: string;
}

/** The outcome of reading a requirements file from disk. */
export type RequirementsRead =
  | { state: 'read'; file: string; introduction: Introduction }
  | { state: 'missing'; file: string }
  | { state: 'unreadable'; file: string; message: string };

const TITLE_HEADING = /^# (.*)$/;
const GOAL_HEADING = '## Goal';
const SECTION_HEADING = /^##? /;

/** The title and goal of a requirements file's text. */
export function parseIntroduction(text: string): Introduction {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const introduction: Introduction = { goal: '' };

  for (const line of lines) {
    const heading = TITLE_HEADING.exec(line);
    if (heading !== null) {
      const title = heading[1].split(/\s+/).filter((word) => word !== '').join(' ');
      if (title !== '') {
        introduction.title = title;
      }
      break;
    }
  }

  const start = lines.findIndex((line) => line.trimEnd() === GOAL_HEADING);
  if (start >= 0) {
    const body: string[] = [];
    for (const line of lines.slice(start + 1)) {
      if (SECTION_HEADING.test(line)) {
        break;
      }
      body.push(line);
    }
    while (body.length > 0 && body[0].trim() === '') {
      body.shift();
    }
    while (body.length > 0 && body[body.length - 1].trim() === '') {
      body.pop();
    }
    introduction.goal = body.join('\n');
  }
  return introduction;
}

/**
 * Reads the requirements file at `file`: its title and goal when it reads, `missing` when no file
 * stands there, and `unreadable` with this module's message when the read itself fails.
 */
export function readRequirements(file: string): RequirementsRead {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return { state: 'missing', file };
    }
    return { state: 'unreadable', file, message: `${REQUIREMENTS_NAME} could not be read: ${(error as Error).message}` };
  }
  return { state: 'read', file, introduction: parseIntroduction(text) };
}
