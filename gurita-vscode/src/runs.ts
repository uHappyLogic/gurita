// The runs the extension starts. Each run is the bundled runner started as a terminal's own
// process, created with `shellPath` `python3`, `shellArgs` the runner file's path and its
// arguments, and `isTransient`, at the project root, the values its lines reference set only in
// the terminal's environment as their `GURITA_*` session variables. The only state held is an
// in-memory note of which mission has a running runner, held from the run's start until its
// terminal closes. The pane draws it: it is posted to the page when a run starts, when its
// terminal closes, and with every redraw, and the page of a mission with a running runner shows
// every action button disabled and its workflow diagram's filled block pulsing. As a fallback, a
// click that still reaches the extension for that mission starts nothing and queues nothing,
// shows a notification, and reveals that run's terminal. A click on a mission's tab, whether or
// not that tab is already selected, brings forward and focuses the terminal of that mission's
// running runner when it has one, and does nothing more, with no notification, when it has none.
// A run a mission-starting button starts belongs to no mission and is refused for none, and no
// tab shows its terminal. A looped run is started the same way, its
// arguments the runner's `loop` command line, the runner filling the loop's values itself. The
// extension learns that a run ended when its terminal closes, which the runner delays until the
// person dismisses it, and then re-reads the pane.

import * as vscode from 'vscode';
import { buildLine, sessionEnvironment } from './placeholders';
import { RunningRuns } from './running';

/** The notification a click shows while a chain started for its mission is running. */
export const ALREADY_RUNNING = 'A chain is already running for this mission.';

const RUNNER_FILE = 'runner.py';
const PYTHON = 'python3';

/** The terminal of each mission's running runner and of each run a mission-starting button started. */
const running = new RunningRuns<vscode.Terminal>();

/** What the extension does when a run starts and when one's terminal closes. */
export interface RunListeners {
  /** Called once a run's terminal is created, its note already held. */
  started: () => void;
  /** Called once a run's terminal closed, its note already cleared. */
  ended: () => void;
}

let listeners: RunListeners | undefined;

/**
 * Registers the listener that clears a run's note when its terminal closes and then calls
 * `ended`; `started` is called after every run starts.
 */
export function registerRuns(context: vscode.ExtensionContext, on: RunListeners): void {
  listeners = on;
  context.subscriptions.push(
    vscode.window.onDidCloseTerminal((terminal) => {
      if (running.close(terminal)) {
        listeners?.ended();
      }
    }),
  );
}

/** The paths of the missions with a running runner, sorted. */
export function runningMissions(): string[] {
  return running.missions();
}

/**
 * Whether the mission at `mission` has a running runner. When it has, shows the notification and
 * reveals that run's terminal: the fallback for a click that reaches the extension although the
 * page draws that mission's action buttons disabled.
 */
export function refuseWhileRunning(mission: string): boolean {
  const terminal = running.terminal(mission);
  if (terminal === undefined) {
    return false;
  }
  void vscode.window.showInformationMessage(ALREADY_RUNNING);
  terminal.show();
  return true;
}

/**
 * Brings forward and focuses the terminal of the running runner of the mission at `mission`, as a
 * click on that mission's tab asks, `show()` taking the focus, and returns whether it had one. A
 * mission with no running runner shows nothing and no notification.
 */
export function showRun(mission: string): boolean {
  const terminal = running.terminal(mission);
  if (terminal === undefined) {
    return false;
  }
  terminal.show();
  return true;
}

/**
 * Starts the runner's `chain` over a recipe's lines for the mission at `mission`, unless a run for
 * that mission is running, or, `mission` undefined, for no mission, as a mission-starting button
 * does. Every optional placeholder with an empty value is dropped from the lines, every known
 * placeholder is written as a reference to its session variable, and `values`, keyed by
 * placeholder name, are set only in the terminal's environment. The run
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
  const filled = lines.map((line) => buildLine(line, values));
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
  running.hold(mission, terminal);
  terminal.show();
  listeners?.started();
}
