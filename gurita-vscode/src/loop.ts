// The looped task run's preview and its command lines. A click on the looped recipe gathers the
// named single-task lines, every recipe the Single-task line recognition test passes, in the merged
// list's order, and runs the bundled runner's `preview` as a short-lived child process with them,
// the mission, and the rule file standing at one fixed path in the project root. The preview's
// print is one `state<TAB>name<TAB>title` line per remaining task, the runner alone deciding
// `resolved` or `missing`; what it says on stderr about a missing or unreadable rule file is
// carried verbatim. Starting the run launches the runner's `loop` with every named single-task line
// as one `--line`, every override as one `--override`, and the looped recipe's lines as written
// after `--`, the slot line last, the runner itself filling `<path>` and `<Task Title>`. This
// module imports nothing from `vscode`.

import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { Recipe, defaultVariant } from './recipes';

/** The rule file's name, standing directly in the project root. */
export const RULE_FILE_NAME = 'task_line_rules.txt';

/** The cause a preview carries when no recipe is a single-task line. */
export const NO_SINGLE_TASK_LINE_CAUSE =
  'No action is a single-task line: a looped run needs at least one action of exactly one headless line holding <Task Title>.';

/** One named single-task line: its recipe's `###` heading and its one line, raw. */
export interface SingleTaskLine {
  name: string;
  line: string;
}

/** One remaining task as the preview prints it. */
export interface PreviewTask {
  /** `resolved` when the line the rules give is among the named lines, `missing` otherwise. */
  state: 'resolved' | 'missing';
  /** The line name the rules give the task, empty when they give none. */
  name: string;
  /** The task's `##` title. */
  title: string;
}

/** The outcome of a preview: its tasks and what it said about the rule file, or why it failed. */
export type PreviewRead =
  | { state: 'read'; tasks: PreviewTask[]; notice?: string }
  | { state: 'failed'; cause: string };

/** A preview print that is not in its stated form. */
export class PreviewPrintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PreviewPrintError';
  }
}

/** The rule file of the project at `root`. */
export function ruleFile(root: string): string {
  return path.join(root, RULE_FILE_NAME);
}

/**
 * The named single-task lines among the recipes, in the merged list's order: every recipe whose
 * default variant is a single-task line, named by the recipe, with that variant's one line.
 */
export function singleTaskLines(recipes: readonly Recipe[]): SingleTaskLine[] {
  const lines: SingleTaskLine[] = [];
  for (const recipe of recipes) {
    const variant = defaultVariant(recipe);
    if (variant.singleTask) {
      lines.push({ name: recipe.name, line: variant.lines[0] });
    }
  }
  return lines;
}

/** The tasks of a `runner.py preview` print, in the order printed. */
export function parsePreview(stdout: string): PreviewTask[] {
  const tasks: PreviewTask[] = [];
  for (const raw of stdout.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (line === '') {
      continue;
    }
    const fields = line.split('\t');
    if (fields.length < 3 || (fields[0] !== 'resolved' && fields[0] !== 'missing')) {
      throw new PreviewPrintError(`runner.py preview printed a line not in its form: ${line}`);
    }
    // The title is the last field and may itself hold a tab.
    tasks.push({ state: fields[0], name: fields[1], title: fields.slice(2).join('\t') });
  }
  return tasks;
}

function lineArguments(lines: readonly SingleTaskLine[]): string[] {
  return lines.flatMap((line) => ['--line', line.name, line.line]);
}

/** The runner's arguments for the preview, its file first. */
export function previewArguments(runner: string, mission: string, rules: string, lines: readonly SingleTaskLine[]): string[] {
  return [runner, 'preview', '--mission', mission, '--rules', rules, ...lineArguments(lines)];
}

/**
 * The overrides a run passes: each task title the person picked a line for, kept only when the
 * line it names is among the named single-task lines.
 */
export function runOverrides(overrides: Readonly<Record<string, string>>, lines: readonly SingleTaskLine[]): [string, string][] {
  const names = new Set(lines.map((line) => line.name));
  return Object.entries(overrides).filter(([, name]) => names.has(name));
}

/** The runner's arguments for the looped run, its file first. */
export function loopArguments(
  runner: string,
  mission: string,
  rules: string,
  lines: readonly SingleTaskLine[],
  overrides: readonly (readonly [string, string])[],
  recipeLines: readonly string[],
): string[] {
  return [
    runner,
    'loop',
    '--mission',
    mission,
    '--rules',
    rules,
    ...lineArguments(lines),
    ...overrides.flatMap(([title, name]) => ['--override', title, name]),
    '--',
    ...recipeLines,
  ];
}

/**
 * Runs the preview of the mission at `mission`, relative to the project root `root`, with `python`,
 * as a short-lived child process started at `root`. A preview that exits 0 yields its tasks and,
 * when it printed anything on stderr, that text verbatim as its notice; one that fails yields its
 * stderr, or the spawn error, as its cause.
 */
export function runPreview(
  runner: string,
  root: string,
  mission: string,
  lines: readonly SingleTaskLine[],
  python = 'python3',
): Promise<PreviewRead> {
  if (lines.length === 0) {
    return Promise.resolve({ state: 'failed', cause: NO_SINGLE_TASK_LINE_CAUSE });
  }
  const args = previewArguments(runner, mission, ruleFile(root), lines);
  return new Promise((resolve) => {
    execFile(python, args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      const printed = (stderr ?? '').replace(/\s+$/, '');
      if (error) {
        resolve({ state: 'failed', cause: printed !== '' ? printed : error.message });
        return;
      }
      try {
        const tasks = parsePreview(stdout);
        resolve(printed === '' ? { state: 'read', tasks } : { state: 'read', tasks, notice: printed });
      } catch (caught) {
        resolve({ state: 'failed', cause: caught instanceof Error ? caught.message : String(caught) });
      }
    });
  });
}
