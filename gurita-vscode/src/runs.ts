// The runs the extension starts. Each run is the bundled runner started as a terminal's own
// process, created with `shellPath` `python3`, `shellArgs` the runner file's path and its
// arguments, and `isTransient`, at the project root, the values its lines reference set only in
// the terminal's environment as their `GURITA_*` session variables. The only state held is an
// in-memory note of which mission has a running runner: a click on a mission's page while one is
// running starts nothing and queues nothing, shows a notification, and reveals that run's
// terminal. A run a mission-starting button starts belongs to no mission and is refused for none.
// A looped run is started the same way, its arguments the runner's `loop` command line, the runner
// filling the loop's values itself. The extension learns that a run ended when its terminal
// closes, which the runner delays until the person dismisses it, and then re-reads the pane.

import * as vscode from 'vscode';
import { fillPlaceholders, sessionEnvironment } from './placeholders';
import { KNOWN_PLACEHOLDERS } from './recipes';

/** The notification a click shows while a chain started for its mission is running. */
export const ALREADY_RUNNING = 'A chain is already running for this mission.';

const RUNNER_FILE = 'runner.py';
const PYTHON = 'python3';

/** The terminal of each mission's running runner, keyed by the mission's path. */
const running = new Map<string, vscode.Terminal>();

/** The terminals of the running runners a mission-starting button started. */
const starting = new Set<vscode.Terminal>();

let ended: (() => void) | undefined;

/**
 * Registers the listener that clears a mission's running note when its run's terminal closes and
 * then calls `onEnded`, the pane's re-read.
 */
export function registerRuns(context: vscode.ExtensionContext, onEnded: () => void): void {
  ended = onEnded;
  context.subscriptions.push(
    vscode.window.onDidCloseTerminal((terminal) => {
      let cleared = starting.delete(terminal);
      for (const [mission, held] of running) {
        if (held === terminal) {
          running.delete(mission);
          cleared = true;
        }
      }
      if (cleared) {
        ended?.();
      }
    }),
  );
}

/**
 * Whether the mission at `mission` has a running runner. When it has, shows the notification and
 * reveals that run's terminal.
 */
export function refuseWhileRunning(mission: string): boolean {
  const terminal = running.get(mission);
  if (terminal === undefined) {
    return false;
  }
  void vscode.window.showInformationMessage(ALREADY_RUNNING);
  terminal.show();
  return true;
}

/**
 * Starts the runner's `chain` over a recipe's lines for the mission at `mission`, unless a run for
 * that mission is running, or, `mission` undefined, for no mission, as a mission-starting button
 * does. Every known placeholder in the lines is written as a reference to its session variable,
 * and `values`, keyed by placeholder name, are set only in the terminal's environment. The run
 * starts at `root`, the project root, or where the terminal starts by default when undefined.
 */
export function startChain(
  context: vscode.ExtensionContext,
  root: string | undefined,
  mission: string | undefined,
  recipe: string,
  lines: readonly string[],
  values: Readonly<Record<string, string>>,
): void {
  if (mission !== undefined && refuseWhileRunning(mission)) {
    return;
  }
  const filled = lines.map((line) => fillPlaceholders(line, KNOWN_PLACEHOLDERS));
  launch(root, mission, recipe, [runnerFile(context), 'chain', '--', ...filled], sessionEnvironment(values));
}

/** The bundled runner's path. */
export function runnerFile(context: vscode.ExtensionContext): string {
  return context.asAbsolutePath(RUNNER_FILE);
}

/**
 * Starts the runner's `loop` for the mission at `mission`, unless a run for that mission is
 * running, `args` the runner's whole argument list, its file first. The loop fills `<path>` and
 * `<Task Title>` itself, so the terminal's environment carries no session variable of the
 * extension's. Returns whether the run started.
 */
export function startLoop(root: string, mission: string, recipe: string, args: readonly string[]): boolean {
  if (refuseWhileRunning(mission)) {
    return false;
  }
  launch(root, mission, recipe, [...args], {});
  return true;
}

function launch(
  root: string | undefined,
  mission: string | undefined,
  recipe: string,
  args: string[],
  env: Record<string, string>,
): void {
  const terminal = vscode.window.createTerminal({
    name: mission === undefined ? `Gurita: ${recipe}` : `Gurita: ${recipe} (${mission})`,
    shellPath: PYTHON,
    shellArgs: args,
    cwd: root,
    env,
    isTransient: true,
  });
  if (mission === undefined) {
    starting.add(terminal);
  } else {
    running.set(mission, terminal);
  }
  terminal.show();
}
