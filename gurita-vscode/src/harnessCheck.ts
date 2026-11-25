// The harness check the settings view shows. The packaged `harness_check.py`, beside the runner,
// is run with `python3` through `execFile` from the project root, given that root as its
// `--project`; it looks up each harness's CLI in the runner's session shell and reads which Gurita
// copy each has installed, and prints one JSON object keyed `claude`, `antigravity`, and `codex`.
// Each harness's outcome is the first of its three checks that failed, in order: its CLI not
// found, the Gurita plugin not installed, or the installed copy's version older than the packaged
// one, the version `scripts/bundle.js` recorded in `bundled/plugin_version.txt`, a copy equal to or
// newer than it passing, the versions ordered as bare MAJOR.MINOR.PATCH; or every check passing.
// The packaged version is the only one compared with, so the check reads nothing over the network. A check that could not be run at all carries its cause verbatim, classified by
// nothing. A copy the harness holds installed but disabled, Claude Code's winning copy or
// Antigravity's or Codex's one copy, is a state of its own, marked disabled, and fails the plugin
// check. For Claude Code the outcome also names every scope at which a Gurita copy applying to the
// project root was detected, the winning scope, the one in effect, first and the others after it.
// For Claude Code and Codex, when the Gurita copy or the marketplace named `gurita` comes from a
// source other than the harness's distribution repository, the outcome names the source the script
// found and the CLI commands that would switch the harness to that repository; Antigravity's
// listing names no source, and its outcome carries none.
//
// Claude Desktop, the fourth harness, is an application rather than a CLI: the script covers it not
// at all, and its one check, made beside the script's in place of the CLI check, is whether Claude
// Desktop is installed, read from its application bundle at `/Applications/Claude.app` through the
// file system, never through a command in the shell, the bundle's version read from its
// `Contents/Info.plist` as information only, compared with nothing. Its outcome makes no plugin or
// version check of a Gurita copy, and a failed presence check fails as `application`, which the
// side-bar view's plugin notice does not count. This module imports nothing from `vscode`.

import { execFile } from 'node:child_process';
import * as fs from 'node:fs';

/** The file the packaged plugin version is recorded in, relative to the extension's root. */
export const PLUGIN_VERSION_FILE = 'bundled/plugin_version.txt';

/** The check script, relative to the extension's root, beside the runner. */
export const CHECK_SCRIPT = 'harness_check.py';

/** The longest a check may run before it is stopped, beyond the script's own session limit. */
const CHECK_TIMEOUT_MS = 150_000;

/** The key of a harness that is a CLI, the check script covers, and the Gurita plugin is installed on. */
export type CliHarnessKey = 'claude' | 'antigravity' | 'codex';

/**
 * One harness the settings view lists: its key, in the script's print for a CLI, its name, and the
 * command word a line on it opens with, its CLI for a CLI and for Claude Desktop a word naming no CLI.
 */
export interface Harness {
  key: CliHarnessKey | 'claude-desktop';
  name: string;
  cli: string;
}

/** The three harnesses that are CLIs, in the order the settings view lists them. */
export const CLI_HARNESSES: readonly (Harness & { key: CliHarnessKey })[] = [
  { key: 'claude', name: 'Claude Code', cli: 'claude' },
  { key: 'antigravity', name: 'Antigravity', cli: 'agy' },
  { key: 'codex', name: 'Codex', cli: 'codex' },
];

// Hands-on check of Claude Desktop, 2026-11-25, on Claude Desktop 6.28899.6
// (`com.anthropic.claudefordesktop`, `/Applications/Claude.app`, its bundle updated that evening
// from the 5.11492.5 first read), which registers the URL scheme `claude`.
// What was passed: nothing; the 6.28899.6 bundle was read statically, with no link opened. Its
// handler of `claude://code/new` takes the prompt from `q`, or from `prompt` when `q` is
// absent, cut at 14,336 characters, takes each `folder`, and forwards beyond those only
// `environment` and `runner_pool`, or, where no `folder` is given, an SSH target named by
// `ssh_host`, `ssh_port`, and `ssh_folder`, so no parameter of that link names a model, an effort,
// or a permission mode; the application's own Finder service opens
// `claude://code/new?folder=<folder>&source=services`. The `claude` CLI on the machine, 2.1.332,
// lists the option `--desktop`, `Open in the Claude Desktop app instead of the terminal (with
// --continue or --resume <id> to pick the session)`.
// What arrived: not observed. Whether a prompt passed either way arrives prefilled or already
// sent, and in which folder the session opens, has not been observed.
// A later re-check updates this block in place.
/** Claude Desktop, the harness that is an application, its lines opening with `claude-desktop`. */
export const DESKTOP_HARNESS: Harness = { key: 'claude-desktop', name: 'Claude Desktop', cli: 'claude-desktop' };

/** The four harnesses, in the order the settings view lists them, Claude Desktop last. */
export const HARNESSES: readonly Harness[] = [...CLI_HARNESSES, DESKTOP_HARNESS];

/**
 * Whether Claude Desktop is offered in a window whose extension host runs on `platform`, as
 * `process.platform` reads it, and whose remote name is `remoteName`, as `vscode.env.remoteName`
 * reads it: only on macOS in a local window, `darwin` with no remote name. The rule is fixed and
 * read from the window alone, with no probe of the application. In a local Linux window and in
 * every remote window, Remote-WSL and SSH among them, Claude Desktop is not offered: it is no row
 * under Harnesses and no choice in the harness dropdown, and no variant whose line opens with
 * `claude-desktop` is selectable for an action.
 */
export function desktopOffered(platform: string, remoteName: string | undefined): boolean {
  return platform === 'darwin' && !remoteName;
}

/** The application bundle Claude Desktop's presence is read from. */
export const DESKTOP_BUNDLE = '/Applications/Claude.app';

/** Whether `value` is the key of a harness that is a CLI, the script checks and the plugin is installed on. */
export function isCliHarnessKey(value: unknown): value is CliHarnessKey {
  return CLI_HARNESSES.some((harness) => harness.key === value);
}

/** The distribution repository of each harness whose source the check reads, by its key. */
export const DISTRIBUTION_REPOSITORIES: Readonly<Partial<Record<Harness['key'], string>>> = {
  claude: 'uHappyLogic/gurita-claude',
  codex: 'uHappyLogic/gurita-codex',
};

/** Claude Code's scopes in the order its switching commands install at them. */
const CLAUDE_SCOPE_ORDER = ['user', 'project', 'local'];

/**
 * A harness's Gurita copy or `gurita` marketplace from a source other than its distribution
 * repository: the source found, that repository, and the CLI commands, in order, that would switch
 * the harness to it.
 */
export interface OtherSource {
  found: string;
  repository: string;
  commands: string[];
}

/**
 * The check of a harness that failed first: for a CLI, the CLI, its installed plugin, or that
 * copy's version being older; for Claude Desktop, its one check, the application being installed.
 */
export type FailedCheck = 'cli' | 'plugin' | 'version' | 'application';

/** Claude Desktop's presence as its bundle reads: whether it is installed, and the bundle's version when it reads one. */
export interface DesktopPresence {
  installed: boolean;
  version?: string;
}

/** One harness's outcome as the settings view draws it. */
export interface HarnessOutcome {
  key: Harness['key'];
  name: string;
  cli: string;
  /** The check that failed first; absent when every check passed. */
  failed?: FailedCheck;
  /** The version the installed copy reads, when one is installed and reads one. */
  installed?: string;
  /** The packaged plugin version, when it could be read. */
  packaged?: string;
  /** Why the listing could not be read, as the script printed it, when it could not. */
  detail?: string;
  /**
   * Every scope a Gurita copy applying to the project root was detected at, the winning one, in
   * effect, first and the others after it as also installed; Claude Code's alone, when any.
   */
  scopes?: string[];
  /**
   * Set when the harness's copy is installed but disabled: Claude Code's winning copy, at the first
   * of `scopes`, or Antigravity's or Codex's one copy. The plugin check then fails.
   */
  disabled?: true;
  /** Set when the copy or the `gurita` marketplace comes from another source; Claude Code's and Codex's alone. */
  source?: OtherSource;
  /**
   * Claude Desktop's alone, marking the harness that is an application: the bundle its presence was
   * read from and, when the bundle reads one, its version, shown as information only.
   */
  application?: { bundle: string; version?: string };
}

/** What a check gave: every harness's outcome, or the cause it could not be run. */
export type CheckResult = { state: 'checked'; harnesses: HarnessOutcome[] } | { state: 'failed'; cause: string };

/** One harness's result as the script prints it. */
interface PrintedHarness {
  found: boolean;
  installed: boolean;
  version: string | null;
  error?: string;
  /** Claude Code's: every scope holding an applying copy, the winning one first. */
  scopes?: string[];
  /** Claude Code's: the winning scope, null when none applies. */
  scope?: string | null;
  /** Whether the copy the harness holds, Claude Code's winning one, is installed but disabled. */
  disabled?: boolean;
  /** Claude Code's and Codex's: the other source found, null when there is none. */
  source?: string | null;
}

/** The packaged plugin version recorded in `file`, or undefined when it cannot be read. */
export function readPackagedVersion(file: string): string | undefined {
  try {
    const text = fs.readFileSync(file, 'utf8').trim();
    return text === '' ? undefined : text;
  } catch {
    return undefined;
  }
}

/** The numeric parts of a bare MAJOR.MINOR.PATCH version, or undefined for any other text. */
export function versionParts(version: string): [number, number, number] | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  return match === null ? undefined : [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Whether the installed version `installed` is at least the packaged version `packaged`, both
 * ordered as bare MAJOR.MINOR.PATCH; a version missing or not in that form is never at least it.
 */
export function versionAtLeast(installed: string | null | undefined, packaged: string | undefined): boolean {
  if (installed === null || installed === undefined || packaged === undefined) {
    return false;
  }
  const have = versionParts(installed);
  const want = versionParts(packaged);
  if (have === undefined || want === undefined) {
    return false;
  }
  for (let index = 0; index < 3; index += 1) {
    if (have[index] !== want[index]) {
      return have[index] > want[index];
    }
  }
  return true;
}

function printedHarness(value: unknown, key: string): PrintedHarness {
  const entry = value as Record<string, unknown> | null | undefined;
  if (
    typeof entry !== 'object' ||
    entry === null ||
    typeof entry.found !== 'boolean' ||
    typeof entry.installed !== 'boolean' ||
    !(entry.version === null || typeof entry.version === 'string') ||
    !(entry.error === undefined || typeof entry.error === 'string') ||
    !(entry.scopes === undefined || (Array.isArray(entry.scopes) && entry.scopes.every((each) => typeof each === 'string'))) ||
    !(entry.scope === undefined || entry.scope === null || typeof entry.scope === 'string') ||
    !(entry.disabled === undefined || typeof entry.disabled === 'boolean') ||
    !(entry.source === undefined || entry.source === null || typeof entry.source === 'string')
  ) {
    throw new Error(`the harness check printed no result of its form for ${key}`);
  }
  return entry as unknown as PrintedHarness;
}

/** The scopes a harness's print names, the winning scope first and the others after it in their printed order. */
function detectedScopes(printed: PrintedHarness): string[] {
  const scopes = printed.scopes ?? [];
  const winner = printed.scope;
  if (winner === undefined || winner === null || !scopes.includes(winner)) {
    return [...scopes];
  }
  return [winner, ...scopes.filter((each) => each !== winner)];
}

/**
 * The CLI commands that would switch the harness `key` from another source to its distribution
 * repository `repository`: the `gurita` marketplace removed and added again from that repository,
 * then the copy installed again from it, on Claude Code at each of the detected `scopes`, whose
 * copies the marketplace's removal uninstalls, and on Codex when `held`, a copy being installed or
 * installed but disabled. Undefined for a harness whose source the check does not read.
 */
export function switchCommands(key: Harness['key'], scopes: readonly string[], held: boolean): string[] | undefined {
  const repository = DISTRIBUTION_REPOSITORIES[key];
  if (repository === undefined) {
    return undefined;
  }
  if (key === 'claude') {
    return [
      'claude plugin marketplace remove gurita',
      `claude plugin marketplace add ${repository}`,
      ...CLAUDE_SCOPE_ORDER.filter((scope) => scopes.includes(scope)).map((scope) => `claude plugin install gurita@gurita --scope ${scope}`),
    ];
  }
  return [
    'codex plugin marketplace remove gurita',
    `codex plugin marketplace add ${repository}`,
    ...(held ? ['codex plugin add gurita@gurita'] : []),
  ];
}

/**
 * Every harness's outcome from the script's print `stdout`, each installed version compared with
 * the packaged version `packaged` as a minimum, undefined when it could not be read, which no
 * installed copy then meets. A print not in the script's form throws.
 */
export function harnessOutcomes(stdout: string, packaged: string | undefined): HarnessOutcome[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(`the harness check printed no JSON: ${stdout.trim()}`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`the harness check printed no JSON object: ${stdout.trim()}`);
  }
  return CLI_HARNESSES.map((harness) => {
    const printed = printedHarness((parsed as Record<string, unknown>)[harness.key], harness.key);
    const outcome: HarnessOutcome = { key: harness.key, name: harness.name, cli: harness.cli };
    if (packaged !== undefined) {
      outcome.packaged = packaged;
    }
    if (printed.installed && printed.version !== null) {
      outcome.installed = printed.version;
    }
    if (printed.error !== undefined) {
      outcome.detail = printed.error;
    }
    const scopes = detectedScopes(printed);
    if (scopes.length > 0) {
      outcome.scopes = scopes;
    }
    if (printed.disabled === true) {
      outcome.disabled = true;
    }
    const repository = DISTRIBUTION_REPOSITORIES[harness.key];
    const commands = switchCommands(harness.key, scopes, printed.installed || printed.disabled === true);
    if (typeof printed.source === 'string' && repository !== undefined && commands !== undefined) {
      outcome.source = { found: printed.source, repository, commands };
    }
    if (!printed.found) {
      outcome.failed = 'cli';
    } else if (!printed.installed) {
      outcome.failed = 'plugin';
    } else if (!versionAtLeast(printed.version, packaged)) {
      outcome.failed = 'version';
    }
    return outcome;
  });
}

/**
 * Claude Desktop's presence, read from its application bundle `bundle` through the file system
 * alone: installed when the bundle is a directory, its version the `CFBundleShortVersionString`
 * of its `Contents/Info.plist`, left out when that file cannot be read or holds none.
 */
export function readDesktopPresence(bundle: string = DESKTOP_BUNDLE): DesktopPresence {
  let installed = false;
  try {
    installed = fs.statSync(bundle).isDirectory();
  } catch {
    installed = false;
  }
  if (!installed) {
    return { installed };
  }
  let plist: string;
  try {
    plist = fs.readFileSync(`${bundle}/Contents/Info.plist`, 'utf8');
  } catch {
    return { installed };
  }
  const match = plist.match(/<key>\s*CFBundleShortVersionString\s*<\/key>\s*<string>\s*([^<]*?)\s*<\/string>/);
  return match === null || match[1] === '' ? { installed } : { installed, version: match[1] };
}

/**
 * Claude Desktop's outcome from its presence `presence`, read from the bundle `bundle`: its one
 * check failing as `application` when it is not installed, and no plugin or version check made.
 */
export function desktopOutcome(presence: DesktopPresence, bundle: string = DESKTOP_BUNDLE): HarnessOutcome {
  const application: { bundle: string; version?: string } = { bundle };
  if (presence.installed && presence.version !== undefined) {
    application.version = presence.version;
  }
  const outcome: HarnessOutcome = { key: DESKTOP_HARNESS.key, name: DESKTOP_HARNESS.name, cli: DESKTOP_HARNESS.cli, application };
  if (!presence.installed) {
    outcome.failed = 'application';
  }
  return outcome;
}

/**
 * Runs the check script `script` with `python` from the project root `root`, the packaged version
 * `packaged` the installed copies are compared with, and gives every harness's outcome, Claude
 * Desktop's read from its bundle `bundle` beside the script's three, or the cause the check could
 * not be run: the script's stderr when it ran and failed, the spawn error when it could not be
 * started, or why its print was not in its form.
 */
export function runHarnessCheck(
  script: string,
  root: string,
  packaged: string | undefined,
  python = 'python3',
  bundle: string = DESKTOP_BUNDLE,
): Promise<CheckResult> {
  return new Promise((resolve) => {
    execFile(
      python,
      [script, '--project', root],
      { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: CHECK_TIMEOUT_MS },
      (error, stdout, stderr) => {
        if (error) {
          const printed = (stderr ?? '').trim();
          resolve({ state: 'failed', cause: printed !== '' ? printed : error.message });
          return;
        }
        try {
          resolve({ state: 'checked', harnesses: [...harnessOutcomes(stdout, packaged), desktopOutcome(readDesktopPresence(bundle), bundle)] });
        } catch (caught) {
          resolve({ state: 'failed', cause: caught instanceof Error ? caught.message : String(caught) });
        }
      },
    );
  });
}
