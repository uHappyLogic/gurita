// The session variables a recipe line's placeholders are filled through. Each placeholder is
// written into its line as a reference to its `GURITA_*` variable, in the form the line's quoting
// at that point needs, and the value itself is set only in the run terminal's environment, so no
// value ever enters a line's text. The variable is named by one fixed rule: the prefix `GURITA_`,
// then the placeholder's text upper-cased with every space turned into an underscore. An optional
// placeholder, the discussion note, may be given an empty value: a line is then built with it
// dropped, together with the `. ` written directly before it, so the line reads exactly as it
// would had the placeholder never been written. This module imports nothing from `vscode`.

import { KNOWN_PLACEHOLDERS } from './recipes';

/** The known placeholders whose value may be empty, each dropped from a line when it is. */
export const OPTIONAL_PLACEHOLDERS: readonly string[] = ['note'];

/** The session variable a placeholder, given by name without its angle brackets, is filled through. */
export function sessionVariable(placeholder: string): string {
  return `GURITA_${placeholder.toUpperCase().replace(/ /g, '_')}`;
}

/**
 * The line with every `<name>` of the given placeholder names written as a reference to its
 * session variable: `${NAME}` inside double quotes, `'"${NAME}"'` inside single quotes, closing
 * and reopening them, and `"${NAME}"` outside any quote. A backslash outside single quotes keeps
 * the character after it from opening or closing a quote.
 */
export function fillPlaceholders(line: string, names: readonly string[]): string {
  const written = names.map((name) => `<${name}>`);
  let filled = '';
  let quote = '';
  let index = 0;
  while (index < line.length) {
    const found = written.find((placeholder) => line.startsWith(placeholder, index));
    if (found !== undefined) {
      const reference = '${' + sessionVariable(found.slice(1, -1)) + '}';
      if (quote === '"') {
        filled += reference;
      } else if (quote === "'") {
        filled += `'"${reference}"'`;
      } else {
        filled += `"${reference}"`;
      }
      index += found.length;
      continue;
    }
    const char = line[index];
    filled += char;
    index += 1;
    if (char === '\\' && quote !== "'" && index < line.length) {
      filled += line[index];
      index += 1;
    } else if (quote === '' && (char === "'" || char === '"')) {
      quote = char;
    } else if (char === quote) {
      quote = '';
    }
  }
  return filled;
}

/** The session environment of a run: each placeholder's session variable set to its value. */
export function sessionEnvironment(values: Readonly<Record<string, string>>): Record<string, string> {
  const environment: Record<string, string> = {};
  for (const [name, value] of Object.entries(values)) {
    environment[sessionVariable(name)] = value;
  }
  return environment;
}

/**
 * The line with every optional placeholder whose value in `values` is empty, blank, or not given
 * dropped: each `. <name>` removed whole, then any `<name>` left.
 */
export function dropEmptyOptional(line: string, values: Readonly<Record<string, string>>): string {
  let dropped = line;
  for (const name of OPTIONAL_PLACEHOLDERS) {
    if ((values[name] ?? '').trim() === '') {
      dropped = dropped.split(`. <${name}>`).join('').split(`<${name}>`).join('');
    }
  }
  return dropped;
}

/**
 * The line a run carries for a recipe's line: every empty optional placeholder dropped, then every
 * known placeholder written as a reference to its session variable.
 */
export function buildLine(line: string, values: Readonly<Record<string, string>>): string {
  return fillPlaceholders(dropEmptyOptional(line, values), KNOWN_PLACEHOLDERS);
}
