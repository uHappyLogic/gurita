// The runs the extension starts. Each run is the bundled runner started as a terminal's own
// process, created with `shellPath` `python3`, `shellArgs` the runner file's path and its
// arguments, and `isTransient`, at the project root, the values its lines reference set only in
// the terminal's environment as their `GURITA_*` session variables. The only state held is an
// in-memory note of which mission has a running runner: a click on a mission's page while one is
// running starts nothing and queues nothing, shows a notification, and reveals that run's
// terminal. The extension learns that a run ended when its terminal closes, which the runner
// delays until the person dismisses it, and then re-reads the pane.

import * as vscode from 'vscode';
import { fillPlaceholders, sessionEnvironment } from './placeholders';
import { KNOWN_PLACEHOLDERS } from './recipes';

/** The notification a click shows while a chain started for its mission is running. */
export const ALREADY_RUNNING = 'A chain is already running for this mission.';

const RUNNER_FILE = 'runner.py';
const PYTHON = 'python3';

/** The terminal of each mission's running runner, keyed by the mission's path. */
const running = new Map<string, vscode.Terminal>();

let ended: (() => void) | undefined;

/**
 * Registers the listener that clears a mission's running note when its run's terminal closes and
 * then calls `onEnded`, the pane's re-read.
 */
export function registerRuns(context: vscode.ExtensionContext, onEnded: () => void): void {
  ended = onEnded;
  context.subscriptions.push(
    vscode.window.onDidCloseTerminal((terminal) => {
      let cleared = false;
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
 * that mission is running. Every known placeholder in the lines is written as a reference to its
 * session variable, and `values`, keyed by placeholder name, are set only in the terminal's
 * environment.
 */
export function startChain(
  context: vscode.ExtensionContext,
  root: string,
  mission: string,
  recipe: string,
  lines: readonly string[],
  values: Readonly<Record<string, string>>,
): void {
  if (refuseWhileRunning(mission)) {
    return;
  }
  const filled = lines.map((line) => fillPlaceholders(line, KNOWN_PLACEHOLDERS));
  const terminal = vscode.window.createTerminal({
    name: `Gurita: ${recipe} (${mission})`,
    shellPath: PYTHON,
    shellArgs: [context.asAbsolutePath(RUNNER_FILE), 'chain', '--', ...filled],
    cwd: root,
    env: sessionEnvironment(values),
    isTransient: true,
  });
  running.set(mission, terminal);
  terminal.show();
}
