// The harness check the settings view shows. The packaged `harness_check.py`, beside the runner,
// is run with `python3` through `execFile` from the project root, given that root as its
// `--project`; it looks up each harness's CLI in the runner's session shell and reads which Gurita
// copy each has installed, and prints one JSON object keyed `claude`, `antigravity`, and `codex`.
// Each harness's outcome is the first of its three checks that failed, in order: its CLI not
// found, the Gurita plugin not installed, or the installed copy's version differing from the
// packaged one, the version `scripts/bundle.js` recorded in `bundled/plugin_version.txt`; or every
// check passing. A check that could not be run at all carries its cause verbatim, classified by
// nothing. This module imports nothing from `vscode`.

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

/** The check of a harness that failed first: its CLI, its installed plugin, or that copy's version. */
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
}

/** What a check gave: every harness's outcome, or the cause it could not be run. */
export type CheckResult = { state: 'checked'; harnesses: HarnessOutcome[] } | { state: 'failed'; cause: string };

/** One harness's result as the script prints it. */
interface PrintedHarness {
  found: boolean;
  installed: boolean;
  version: string | null;
  error?: string;
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

function printedHarness(value: unknown, key: string): PrintedHarness {
  const entry = value as Record<string, unknown> | null | undefined;
  if (
    typeof entry !== 'object' ||
    entry === null ||
    typeof entry.found !== 'boolean' ||
    typeof entry.installed !== 'boolean' ||
    !(entry.version === null || typeof entry.version === 'string') ||
    !(entry.error === undefined || typeof entry.error === 'string')
  ) {
    throw new Error(`the harness check printed no result of its form for ${key}`);
  }
  return entry as unknown as PrintedHarness;
}

/**
 * Every harness's outcome from the script's print `stdout`, the installed versions compared with
 * the packaged version `packaged`, undefined when it could not be read, which no installed copy
 * then matches. A print not in the script's form throws.
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
    if (!printed.found) {
      outcome.failed = 'cli';
    } else if (!printed.installed) {
      outcome.failed = 'plugin';
    } else if (packaged === undefined || printed.version !== packaged) {
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
