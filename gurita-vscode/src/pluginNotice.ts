// The plugin notice of the side-bar view: whether its row stands, and the text it shows, read from
// the session's harness check and each harness's enabled state. The row stands while at least one
// harness that is enabled and whose CLI is found fails its install or version check, the Gurita
// plugin not installed, its listing unreadable, its copy installed but disabled, or that copy older
// than the packaged version, and while the check could not be run at all. A harness that is
// disabled, or whose CLI is not found, never counts, nor does Claude Desktop, whose one check, the
// application's presence, makes no plugin or version check and whose failure is drawn on its row
// in the Settings window alone; a check not yet finished stands no row. This module imports
// nothing from `vscode`.

import { CheckResult, HarnessOutcome } from './harnessCheck';
import { HarnessStates } from './harnessSettings';

/** The plugin notice row's label. */
export const PLUGIN_NOTICE_LABEL = 'Gurita plugin missing or outdated';

/** The last line of the plugin notice row's hover text, saying what its click does. */
export const PLUGIN_NOTICE_CLICK = 'Click to open the Settings window, where the plugin is installed or updated.';

/** The opening of the hover text's line while the harness check could not be run, the cause following it. */
export const CHECK_NOT_RUN = 'The harness check could not be run:';

/** The harnesses that count toward the notice in the check `check`, given each harness's enabled state `states`. */
export function noticeHarnesses(check: Extract<CheckResult, { state: 'checked' }>, states: HarnessStates): HarnessOutcome[] {
  return check.harnesses.filter((outcome) => states[outcome.key] && (outcome.failed === 'plugin' || outcome.failed === 'version'));
}

/** The line of the hover text naming why the harness `outcome` counts toward the notice. */
function outcomeLine(outcome: HarnessOutcome): string {
  if (outcome.failed === 'version') {
    return `${outcome.name}: installed version ${outcome.installed ?? 'unknown'} is older than the packaged ${outcome.packaged ?? 'version'}`;
  }
  if (outcome.disabled === true) {
    return `${outcome.name}: the Gurita plugin is installed but disabled`;
  }
  if (outcome.detail !== undefined) {
    return `${outcome.name}: the plugin listing could not be read (${outcome.detail})`;
  }
  return `${outcome.name}: the Gurita plugin is not installed`;
}

/**
 * The hover text of the plugin notice row for the finished check `check`, given each harness's
 * enabled state `states`, or undefined when the row does not stand: the label, one line per
 * counted harness or the line saying the check could not be run with its cause, and the click's line.
 */
export function pluginNotice(check: CheckResult | undefined, states: HarnessStates): string | undefined {
  if (check === undefined) {
    return undefined;
  }
  let lines: string[];
  if (check.state === 'failed') {
    lines = [`${CHECK_NOT_RUN} ${check.cause}`];
  } else {
    const counted = noticeHarnesses(check, states);
    if (counted.length === 0) {
      return undefined;
    }
    lines = counted.map(outcomeLine);
  }
  return [PLUGIN_NOTICE_LABEL, ...lines, PLUGIN_NOTICE_CLICK].join('\n');
}
