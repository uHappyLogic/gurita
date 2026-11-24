// The bootstrap offer of the side-bar view: whether its row stands, read from the project's two
// context files. The row stands while neither `CLAUDE.md` nor `AGENTS.md` at the project root holds
// a `## Mission Workflow` heading, the section `init-mission-base-workflow` writes, whatever
// harnesses are enabled: a file that is absent or cannot be read holds no heading, and once either
// file holds one the offer is gone. A heading is a line reading exactly `## Mission Workflow`,
// trailing whitespace aside, whatever the section beneath it says. This module imports nothing from
// `vscode`.

import * as fs from 'node:fs';
import * as path from 'node:path';

/** The heading of the section the bootstrap writes, whose presence in either context file ends the offer. */
export const WORKFLOW_HEADING = '## Mission Workflow';

/** The context files read at the project root, the one each harness reads. */
export const CONTEXT_FILES: readonly string[] = ['CLAUDE.md', 'AGENTS.md'];

/** The hover line of the bootstrap offer row saying why it stands. */
export const BOOTSTRAP_REASON = 'Neither CLAUDE.md nor AGENTS.md at the project root holds the ## Mission Workflow section.';

/** Whether the text `text` holds a line that is the workflow heading. */
export function holdsWorkflowHeading(text: string): boolean {
  return text.split(/\r?\n/).some((line) => line.trimEnd() === WORKFLOW_HEADING);
}

/** Whether the bootstrap offer row stands for the project at `root`: neither context file there holds the workflow heading. */
export function bootstrapOffered(root: string): boolean {
  return !CONTEXT_FILES.some((file) => {
    try {
      return holdsWorkflowHeading(fs.readFileSync(path.join(root, file), 'utf8'));
    } catch {
      return false;
    }
  });
}
