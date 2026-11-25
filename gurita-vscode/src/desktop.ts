// Sending an action to Claude Desktop. An action whose variant is one line opening with the word
// `claude-desktop` (`desktopLine`) is not run in a terminal: its prompt, the line's quoted
// `/gurita:` word as the shell reads it, is built with the typed values written in (`desktopPrompt`),
// an empty optional placeholder dropped as a run's line drops it, and carried with the project's
// root as `folder` in the `claude://code/new` link (`desktopLink`), Claude Desktop's own way of
// opening a session from outside, whose handler takes the prompt from `q`. The link is passed to
// `open`, the macOS opener, as an `execFile` child (`openDesktopLink`), the way the extension runs
// its git and Python reads; neither the `claude` CLI nor its `--desktop` option is used, so the
// bundled runner never sees the Desktop word. The send is fire-and-forget: its one outcome is the
// opener's, success or the cause it reported, read from that call alone with no check made
// beforehand. This module imports nothing from `vscode`.

import { execFile } from 'node:child_process';
import { readLine, readPrompt } from './lineValues';
import { dropEmptyOptional, writeValues } from './placeholders';

/** The link Claude Desktop opens a new Code session from. */
export const DESKTOP_LINK = 'claude://code/new';

/** The macOS opener the link is passed to. */
export const OPENER = 'open';

/** The line an action's `lines` send to Claude Desktop: its one line, when that line opens with `claude-desktop`, and undefined otherwise. */
export function desktopLine(lines: readonly string[]): string | undefined {
  return lines.length === 1 && readLine(lines[0])?.harness === 'claude-desktop' ? lines[0] : undefined;
}

/**
 * The prompt a Claude Desktop line sends: its quoted `/gurita:` word as the shell reads it, every
 * optional placeholder with an empty value dropped and every other placeholder `values` gives
 * replaced by its value as typed; empty for a line whose first command invokes no skill.
 */
export function desktopPrompt(line: string, values: Readonly<Record<string, string>>): string {
  return writeValues(readPrompt(dropEmptyOptional(line, values)) ?? '', values);
}

/**
 * The `claude://code/new` link carrying `prompt` as `q` and `root` as `folder`, each written as a
 * URI component; an empty prompt and an undefined root are left out.
 */
export function desktopLink(prompt: string, root: string | undefined): string {
  const parameters: string[] = [];
  if (prompt !== '') {
    parameters.push(`q=${encodeURIComponent(prompt)}`);
  }
  if (root !== undefined) {
    parameters.push(`folder=${encodeURIComponent(root)}`);
  }
  return parameters.length === 0 ? DESKTOP_LINK : `${DESKTOP_LINK}?${parameters.join('&')}`;
}

/**
 * Passes `link` to `open` as an `execFile` child, resolving to undefined once the opener exits
 * successfully and to the cause it reported otherwise: its standard error, trimmed, or the failed
 * call's own message where it wrote none.
 */
export function openDesktopLink(link: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile(OPENER, [link], (error, _stdout, stderr) => {
      if (error === null) {
        resolve(undefined);
        return;
      }
      const reported = String(stderr ?? '').trim();
      resolve(reported !== '' ? reported : error.message);
    });
  });
}
