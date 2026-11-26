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
// An action whose variant ends in a line opening with `claude-desktop` does not run that line:
// `startAction`, through which every action that starts a chain goes, sends it to Claude Desktop
// instead (`desktop.ts`), its prompt built with the typed values written in and carried in the
// `claude://code/new` link with the project root as `folder`, passed to `open`. A variant of that
// one line is sent at once and starts no run. A chain runs its earlier lines first as an ordinary
// tracked run, held and posted like any other until its terminal closes, the runner started with
// `--finished-file` naming a file of the extension's own (`finishedSignal`), which it writes only
// when the earlier lines all finished; the extension looks for that file while the run goes and
// sends the last line as soon as it stands, without waiting for the terminal to close, and looks
// once more when the terminal closes, so a run that finished and closed by itself is sent too. A
// chain that stopped or ended early writes no file and sends nothing. The send is fire-and-forget:
// no run is held for the session Desktop opens, and after a send that went out VS Code shows
// nothing, Claude Desktop coming to the front being the sign, while a send the opener reports
// failed is shown as one error notification saying the action could not be sent to Claude Desktop
// and carrying the cause the opener reported. A send for a mission whose run is going is refused as
// a click is. A last-line prompt past the 14,336 characters at which Desktop's link cuts it,
// measured with its typed values written in, is not sent: the whole variant runs in a terminal
// instead, without asking, as an ordinary tracked chain, its last line the Desktop line with its
// opening word replaced by `claude`, its values typed and set in the terminal's environment as
// every run's are, and one notice tells the person the prompt was too long for Claude Desktop. No
// line handed to the runner opens with `claude-desktop`.

import * as vscode from 'vscode';
import {
  DESKTOP_PROMPT_LIMIT,
  FINISHED_POLL_MS,
  FinishedSignal,
  desktopFallbackLine,
  desktopLine,
  desktopLink,
  desktopPrompt,
  finishedSignal,
  openDesktopLink,
  tooLongForDesktop,
} from './desktop';
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
  const terminal = launchChain(context, root, mission, recipe, lines, values);
  if (terminal !== undefined && closed !== undefined) {
    closers.set(terminal, closed);
  }
}

/**
 * Starts the runner's `chain` as `startChain` does, the runner's `--finished-file` naming
 * `finishedFile` when given, and returns its terminal, or undefined when a run for `mission` is
 * running and nothing started.
 */
function launchChain(
  context: vscode.ExtensionContext,
  root: string | undefined,
  mission: string | undefined,
  recipe: string,
  lines: readonly string[],
  values: Readonly<Record<string, string>>,
  finishedFile?: string,
): vscode.Terminal | undefined {
  if (mission !== undefined && refuseWhileRunning(mission)) {
    return undefined;
  }
  const filled = lines.map((line) => buildLine(line, values));
  const finishing = finishedFile === undefined ? [] : ['--finished-file', finishedFile];
  return launch(root, mission, recipe, [runnerFile(context), 'chain', ...finishing, '--', ...filled], sessionEnvironment(values));
}

/** The error notification a send to Claude Desktop the opener reported failed shows, for the action `recipe`. */
export function desktopSendFailed(recipe: string, cause: string): string {
  return `The action "${recipe}" could not be sent to Claude Desktop: ${cause}`;
}

/** The notice an action whose prompt is too long for Claude Desktop shows as it runs in a terminal instead. */
export function desktopPromptTooLong(recipe: string, length: number): string {
  return (
    `The prompt of the action "${recipe}" is too long for Claude Desktop ` +
    `(${length.toLocaleString('en-US')} characters, past its limit of ${DESKTOP_PROMPT_LIMIT.toLocaleString('en-US')}), ` +
    'so it runs in a terminal instead.'
  );
}

/**
 * Starts the action `recipe` of `lines` with `values`, as `startChain` takes them, unless its last
 * line opens with `claude-desktop`: that line is sent to Claude Desktop instead, unless a run for
 * `mission` is running, its prompt with `values` written in carried with `root` as `folder` in the
 * `claude://code/new` link passed to `open`. The one line of a one-line variant is sent at once, no
 * terminal created, no run held, and `closed` never called. The earlier lines of a chain are started
 * first by `startChain`'s path as an ordinary tracked run with `values` and `closed`, the runner
 * told to write a finished file once they all finished, and the last line is sent as soon as that
 * file stands or, at the latest, when the run's terminal closes, at most once; a run that stopped
 * writes no file and sends nothing. A prompt past the limit Desktop accepts is not sent: the
 * variant, its last line with the opening word replaced by `claude`, is started by `startChain` as
 * a chain with `values` and `closed`, after one notice saying the prompt was too long for Claude
 * Desktop. The promise settles once a one-line variant's send is known, a failed send shown in one
 * error notification carrying the cause the opener reported, and at once for a chain, whose later
 * send is shown the same way.
 */
export async function startAction(
  context: vscode.ExtensionContext,
  root: string | undefined,
  mission: string | undefined,
  recipe: string,
  lines: readonly string[],
  values: Readonly<Record<string, string>>,
  closed?: () => void,
): Promise<void> {
  const line = desktopLine(lines);
  if (line === undefined) {
    startChain(context, root, mission, recipe, lines, values, closed);
    return;
  }
  if (mission !== undefined && refuseWhileRunning(mission)) {
    return;
  }
  const earlier = lines.slice(0, -1);
  const prompt = desktopPrompt(line, values);
  const fallback = desktopFallbackLine(line);
  if (tooLongForDesktop(prompt) && fallback !== undefined) {
    void vscode.window.showInformationMessage(desktopPromptTooLong(recipe, prompt.length));
    startChain(context, root, mission, recipe, [...earlier, fallback], values, closed);
    return;
  }
  const send = async (): Promise<void> => {
    const cause = await openDesktopLink(desktopLink(prompt, root));
    if (cause !== undefined) {
      void vscode.window.showErrorMessage(desktopSendFailed(recipe, cause));
    }
  };
  if (earlier.length === 0) {
    await send();
    return;
  }
  let finished: FinishedSignal;
  try {
    finished = finishedSignal();
  } catch (error) {
    void vscode.window.showErrorMessage(desktopSendFailed(recipe, error instanceof Error ? error.message : String(error)));
    return;
  }
  const terminal = launchChain(context, root, mission, recipe, earlier, values, finished.file);
  if (terminal === undefined) {
    finished.remove();
    return;
  }
  let settled = false;
  // Sends the last line once the finished file stands; at the terminal's close, `closing`, the run
  // is over either way, so the signal is taken away whether or not it stands.
  const settle = (closing: boolean): void => {
    if (settled) {
      return;
    }
    const ready = finished.finished();
    if (!ready && !closing) {
      return;
    }
    settled = true;
    clearInterval(timer);
    finished.remove();
    if (ready) {
      void send();
    }
  };
  const timer = setInterval(() => settle(false), FINISHED_POLL_MS);
  timer.unref?.();
  closers.set(terminal, () => {
    settle(true);
    closed?.();
  });
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
