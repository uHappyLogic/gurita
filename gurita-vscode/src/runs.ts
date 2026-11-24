// The runs the extension starts. Each run is the bundled runner started as a terminal's own
// process, created with `shellPath` `python3`, `shellArgs` the runner file's path and its
// arguments, and `isTransient`, at the project root, the values its lines reference set only in
// the terminal's environment as their `GURITA_*` session variables. The only state held is an
// in-memory note of which mission has a running runner, held from the run's start until its
// terminal closes. The mission windows draw it: it is posted to every open window when a run
// starts, when its terminal closes, and with every redraw, and the page of a mission with a running
// runner shows every action button disabled and its workflow diagram's filled block pulsing. As a
// fallback, a click that still reaches the extension for that mission starts nothing and queues
// nothing, shows a notification, and reveals that run's terminal. Each time a mission's window
// becomes the active editor while that mission's run is going, that run's terminal is brought
// forward without taking the focus. A run a mission-starting row
// starts belongs to no mission and is refused for none. A looped run is started the same way, its
// arguments the runner's `loop` command line, the runner filling the loop's values itself. The
// extension learns that a run ended when its terminal closes, and then re-reads the live missions;
// a Define mission run's starter is told of that close first, so the re-read can open the window of
// the mission the run defined.
// The runner delays that close until the person dismisses it, except that while the setting
// `gurita.autoCloseFinishedRuns` is on, read when each run starts, every run is started with the
// runner's `--close-when-finished`, so a chain that ran all its lines and a loop that ends with no
// task remaining exit after their report and their terminal closes by itself; a run that stopped
// still waits for a keypress.

import * as vscode from 'vscode';
import { buildLine, sessionEnvironment } from './placeholders';
import { RunningRuns } from './running';

/** The notification a click shows while a chain started for its mission is running. */
export const ALREADY_RUNNING = 'A chain is already running for this mission.';

const RUNNER_FILE = 'runner.py';
const PYTHON = 'python3';

/** The setting, under the `gurita` section, that closes a finished run's terminal by itself; on unless set. */
export const AUTO_CLOSE_SETTING = 'autoCloseFinishedRuns';

/** The runner's option that makes a finished run exit without waiting for a keypress. */
export const CLOSE_WHEN_FINISHED = '--close-when-finished';

/**
 * The runner's argument list `args` (its file, its command, then the command's arguments) with
 * `--close-when-finished` written directly after the command when `autoClose` holds, and `args`
 * unchanged otherwise.
 */
export function runnerArguments(args: readonly string[], autoClose: boolean): string[] {
  return autoClose ? [...args.slice(0, 2), CLOSE_WHEN_FINISHED, ...args.slice(2)] : [...args];
}

/** Whether the auto-close setting is on, as it stands now; a value that is not a boolean counts as on. */
function autoCloseFinishedRuns(): boolean {
  return vscode.workspace.getConfiguration('gurita').get<unknown>(AUTO_CLOSE_SETTING, true) !== false;
}

/** The terminal of each mission's running runner and of each run a mission-starting row started. */
const running = new RunningRuns<vscode.Terminal>();

/** What each run's starter asked to be called once that run's terminal closes, by the terminal. */
const closers = new Map<vscode.Terminal, () => void>();

/** What the extension does when a run starts and when one's terminal closes. */
export interface RunListeners {
  /** Called once a run's terminal is created, its note already held. */
  started: () => void;
  /** Called once a run's terminal closed, its note already cleared. */
  ended: () => void;
}

let listeners: RunListeners | undefined;

/**
 * Registers the listener that clears a run's note when its terminal closes, then calls what that
 * run's starter asked to be called on its close, and then `ended`; `started` is called after every
 * run starts.
 */
export function registerRuns(context: vscode.ExtensionContext, on: RunListeners): void {
  listeners = on;
  context.subscriptions.push(
    vscode.window.onDidCloseTerminal((terminal) => {
      const closed = closers.get(terminal);
      closers.delete(terminal);
      if (running.close(terminal)) {
        closed?.();
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
 * Brings the terminal of the running runner of the mission at `mission` forward without taking the
 * focus, as its window becoming the active editor does, and does nothing when it has none. The
 * focus stays with the window, since a terminal that took it would deactivate the window and bring
 * the terminal forward again on the next click back into it.
 */
export function showRunTerminal(mission: string): void {
  running.terminal(mission)?.show(true);
}

/**
 * Starts the runner's `chain` over a recipe's lines for the mission at `mission`, unless a run for
 * that mission is running, or, `mission` undefined, for no mission, as a mission-starting row
 * does. Every optional placeholder with an empty value is dropped from the lines, every known
 * placeholder is written as a reference to its session variable, and `values`, keyed by
 * placeholder name, are set only in the terminal's environment. The run
 * starts at `root`, the project root, or where the terminal starts by default when undefined.
 * `closed`, when given, is called once the run's terminal closes, ahead of the `ended` listener.
 */
export function startChain(
  context: vscode.ExtensionContext,
  root: string | undefined,
  mission: string | undefined,
  recipe: string,
  lines: readonly string[],
  values: Readonly<Record<string, string>>,
  closed?: () => void,
): void {
  if (mission !== undefined && refuseWhileRunning(mission)) {
    return;
  }
  const filled = lines.map((line) => buildLine(line, values));
  const terminal = launch(root, mission, recipe, [runnerFile(context), 'chain', '--', ...filled], sessionEnvironment(values));
  if (closed !== undefined) {
    closers.set(terminal, closed);
  }
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
): vscode.Terminal {
  const terminal = vscode.window.createTerminal({
    name: mission === undefined ? `Gurita: ${recipe}` : `Gurita: ${recipe} (${mission})`,
    shellPath: PYTHON,
    shellArgs: runnerArguments(args, autoCloseFinishedRuns()),
    cwd: root,
    env,
    isTransient: true,
  });
  running.hold(mission, terminal);
  terminal.show();
  listeners?.started();
  return terminal;
}
