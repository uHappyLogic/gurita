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
// listing names no source, and its outcome carries none. This module imports nothing from `vscode`.

import { execFile } from 'node:child_process';
import * as fs from 'node:fs';

/** The file the packaged plugin version is recorded in, relative to the extension's root. */
export const PLUGIN_VERSION_FILE = 'bundled/plugin_version.txt';

/** The check script, relative to the extension's root, beside the runner. */
export const CHECK_SCRIPT = 'harness_check.py';

/** The longest a check may run before it is stopped, beyond the script's own session limit. */
const CHECK_TIMEOUT_MS = 150_000;

/** One harness the check covers: its key in the script's print, its name, and its CLI. */
export interface Harness {
  key: 'claude' | 'antigravity' | 'codex';
  name: string;
  cli: string;
}

/** The three harnesses, in the order the settings view lists them. */
export const HARNESSES: readonly Harness[] = [
  { key: 'claude', name: 'Claude Code', cli: 'claude' },
  { key: 'antigravity', name: 'Antigravity', cli: 'agy' },
  { key: 'codex', name: 'Codex', cli: 'codex' },
];

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

/** The check of a harness that failed first: its CLI, its installed plugin, or that copy's version being older. */
export type FailedCheck = 'cli' | 'plugin' | 'version';

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
  return HARNESSES.map((harness) => {
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
 * Runs the check script `script` with `python` from the project root `root`, the packaged version
 * `packaged` the installed copies are compared with, and gives every harness's outcome, or the
 * cause the check could not be run: the script's stderr when it ran and failed, the spawn error
 * when it could not be started, or why its print was not in its form.
 */
export function runHarnessCheck(script: string, root: string, packaged: string | undefined, python = 'python3'): Promise<CheckResult> {
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
          resolve({ state: 'checked', harnesses: harnessOutcomes(stdout, packaged) });
        } catch (caught) {
          resolve({ state: 'failed', cause: caught instanceof Error ? caught.message : String(caught) });
        }
      },
    );
  });
}
