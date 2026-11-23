// The install and update runs the Settings window starts. Each is the packaged `install_plugin.py`,
// beside the runner, started as a terminal's own process the way a recipe run's terminal is
// started: created with `shellPath` `python3`, `shellArgs` the script's path and its arguments, and
// `isTransient`, at the project root, and shown. The script is given the harness, the action, the
// project root as its `--project`, each Claude Code scope as a `--scope`, and `--wait`, so that it
// waits for a keypress before exiting, as the runner does, and the run's output and any prompt
// stay visible and answerable in the terminal. The only state held is an in-memory note of the one
// run going, kept for the extension's session from the run's start until its terminal closes:
// while it stands no second run starts, a start that still reaches the extension showing a
// notification and revealing that run's terminal, so at most one install or update goes at a time.
// When the terminal closes, which the script delays until the person dismisses it, the note is
// cleared and the run's exit status is read from the terminal's `exitStatus` and handed to the
// listener: 0 is a success, any other status, or none, a failure, a failed release lookup included,
// since the script exits non-zero before any install or update command runs when it cannot read
// the latest release. The Settings window reports the end and runs the harness check afresh.
// A Claude Code install runs at the one scope the person picks in VS Code's own quick pick, which
// lists the scopes on offer, each with where an install there is recorded: user settings, the
// project's shared `.claude/settings.json`, or the project's local settings, user alone when no
// workspace folder is open.

import * as vscode from 'vscode';
import { HARNESSES } from './harnessCheck';
import { HarnessKey } from './harnessSettings';

/** The install script, relative to the extension's root, beside the runner. */
export const INSTALL_SCRIPT = 'install_plugin.py';

const PYTHON = 'python3';

/** What a run does: install the plugin or update the copy installed. */
export type PluginAction = 'install' | 'update';

/** The actions a run takes. */
export const PLUGIN_ACTIONS: readonly PluginAction[] = ['install', 'update'];

/** Claude Code's scopes, in the order an update takes them. */
export const CLAUDE_SCOPES: readonly string[] = ['user', 'project', 'local'];

/** Where an install at each Claude Code scope is recorded, as the scope pick says it, by the scope. */
export const CLAUDE_SCOPE_RECORDS: Readonly<Record<string, string>> = {
  user: 'Recorded in your user settings',
  project: "Recorded in the project's shared .claude/settings.json",
  local: "Recorded in the project's local settings",
};

/** One entry of the Claude Code scope pick: the scope as its label, and where an install there is recorded. */
export interface ScopePick {
  label: string;
  description: string;
  scope: string;
}

/**
 * The entries of the Claude Code scope pick, one per scope of `scopes` on offer, in the order
 * user, project, local: with no workspace folder open (`folderOpen` false) user alone is offered,
 * project and local not being named at all.
 */
export function claudeScopePicks(scopes: readonly string[], folderOpen: boolean): ScopePick[] {
  return CLAUDE_SCOPES.filter((scope) => scopes.includes(scope) && (folderOpen || scope === 'user')).map((scope) => ({
    label: scope,
    description: CLAUDE_SCOPE_RECORDS[scope],
    scope,
  }));
}

/** One install or update run: the harness, the action, and, on Claude Code, the scopes it acts at. */
export interface PluginRun {
  harness: HarnessKey;
  action: PluginAction;
  /** The Claude Code scopes the run acts at, empty on Antigravity and Codex. */
  scopes: string[];
}

/** The notification a start shows while an install or update run is going. */
export const RUN_GOING = 'An install or update of the Gurita plugin is already running.';

/** The sentence every successful run's report adds, the same on every harness. */
export const RESTART_SENTENCE = 'Running sessions of that harness must be restarted to use the new copy.';

/** How a run ended, as the Settings window reports it. */
export interface PluginRunEnd {
  succeeded: boolean;
  message: string;
}

/** The run going and its terminal, or undefined when none is. */
let going: { run: PluginRun; terminal: vscode.Terminal } | undefined;

/** The run going, or undefined when none is. */
export function pluginRunGoing(): PluginRun | undefined {
  return going === undefined ? undefined : { ...going.run, scopes: [...going.run.scopes] };
}

/**
 * Registers the listener that clears the run's note when its terminal closes and then calls
 * `ended` with the run and the exit status its terminal read, undefined when it read none.
 */
export function registerPluginRuns(context: vscode.ExtensionContext, ended: (run: PluginRun, status: number | undefined) => void): void {
  context.subscriptions.push(
    vscode.window.onDidCloseTerminal((terminal) => {
      if (going === undefined || going.terminal !== terminal) {
        return;
      }
      const run = going.run;
      going = undefined;
      ended(run, terminal.exitStatus?.code);
    }),
  );
}

/** The name the Settings window gives the harness `key`. */
function harnessName(key: HarnessKey): string {
  return HARNESSES.find((harness) => harness.key === key)?.name ?? key;
}

/** The install script's arguments for `run` at the project root `root`, the script's path `script` first. */
export function pluginRunArguments(script: string, run: PluginRun, root: string): string[] {
  return [script, run.harness, run.action, '--project', root, ...run.scopes.flatMap((scope) => ['--scope', scope]), '--wait'];
}

/** The name of `run`'s terminal. */
export function pluginRunName(run: PluginRun): string {
  const scopes = run.scopes.length === 0 ? '' : ` (${run.scopes.join(', ')})`;
  return `Gurita: ${run.action} on ${harnessName(run.harness)}${scopes}`;
}

/**
 * Whether a run is going, which then shows the notification and reveals that run's terminal, as
 * every start refused while it goes does.
 */
export function refusedWhileGoing(): boolean {
  if (going === undefined) {
    return false;
  }
  void vscode.window.showInformationMessage(RUN_GOING);
  going.terminal.show();
  return true;
}

/**
 * Starts `run` at the project root `root`, unless a run is going: then shows the notification,
 * reveals that run's terminal, and starts nothing. Returns whether the run started.
 */
export function startPluginRun(context: vscode.ExtensionContext, root: string, run: PluginRun): boolean {
  if (refusedWhileGoing()) {
    return false;
  }
  const held: PluginRun = { ...run, scopes: [...run.scopes] };
  const terminal = vscode.window.createTerminal({
    name: pluginRunName(held),
    shellPath: PYTHON,
    shellArgs: pluginRunArguments(context.asAbsolutePath(INSTALL_SCRIPT), held, root),
    cwd: root,
    isTransient: true,
  });
  going = { run: held, terminal };
  terminal.show();
  return true;
}

/**
 * How `run` ended, its exit status `status`: a success at 0, the restart sentence added, and a
 * failure at any other status or none.
 */
export function pluginRunEnd(run: PluginRun, status: number | undefined): PluginRunEnd {
  const name = harnessName(run.harness);
  const done = run.action === 'install' ? 'installed' : 'updated';
  if (status === 0) {
    return { succeeded: true, message: `The Gurita plugin was ${done} on ${name}. ${RESTART_SENTENCE}` };
  }
  const why =
    status === undefined ? "its terminal closed before the run ended" : `the run ended with exit status ${status}, its terminal having shown the cause`;
  return { succeeded: false, message: `The Gurita plugin could not be ${done} on ${name}: ${why}.` };
}
