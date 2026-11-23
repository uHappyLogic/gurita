// The line-value module. It reads from a recipe line's text the harness the line runs on, the
// line's model, and its effort, and it replaces a model or effort value a line already carries;
// it never inserts text into a line. A line's harness is its first word when that word is
// `claude`, `agy`, or `codex`; any other line (a shell step, the slot line `<single-task line>`,
// a command the extension does not know) has no harness and carries no value. On `claude` and
// `agy` the model is the value of `--model` and the effort that of `--effort`; on `codex` the
// model is the value of `-m` and no effort is read. A flag's value is the word after it, or the
// text after `=` in the `--flag=value` form, read as the shell would read the word, quotes
// removed; a flag with no value, or an empty one, carries nothing, and of a flag written twice the
// last is the one read and replaced. Only the line's first command is read: its words end at the
// first `;`, `&`, or `|`, or a `#` opening a word, standing outside quotes, so a flag written
// inside the quoted prompt or after the line's closing `;` is never read. The skill a line runs
// is read from the same first command: the name after the first `/gurita:` or `$gurita:` opening a
// word of its arguments or a part of one, the quoted prompt being one word. From a variant's lines
// the module gives the three lists a recipe button shows: the distinct harnesses, the distinct
// models, and the distinct efforts, each in the order of first appearance and independent of the
// other two. This module imports nothing from `vscode`.

/** The harnesses a line can run on, each named by the command a line opens with. */
export const HARNESSES = ['claude', 'agy', 'codex'] as const;

export type Harness = (typeof HARNESSES)[number];

/** The value a line carries: a harness, its model, and its effort, each read from the line's text. */
export interface LineValues {
  harness: Harness;
  model?: string;
  effort?: string;
}

/** A variant's values as its recipe button shows them, each list distinct and in first-appearance order. */
export interface VariantValues {
  harnesses: Harness[];
  models: string[];
  efforts: string[];
}

/** The flag carrying each harness's model, and its effort where the harness takes one. */
const FLAGS: Readonly<Record<Harness, { model: string; effort?: string }>> = {
  claude: { model: '--model', effort: '--effort' },
  agy: { model: '--model', effort: '--effort' },
  codex: { model: '-m' },
};

/** One shell word of a line: its text as the shell reads it and where it stands in the line. */
interface Word {
  text: string;
  start: number;
  end: number;
}

/** Where a flag's value stands in a line, and the value as the shell reads it. */
interface ValueSpan {
  text: string;
  start: number;
  end: number;
}

/** The words of a line's first command, read as the shell splits and unquotes them. */
function words(line: string): Word[] {
  const found: Word[] = [];
  let index = 0;
  while (index < line.length) {
    while (index < line.length && /\s/.test(line[index])) {
      index++;
    }
    if (index >= line.length || ';&|'.includes(line[index]) || line[index] === '#') {
      break;
    }
    const start = index;
    let text = '';
    let ended = false;
    while (index < line.length && !/\s/.test(line[index]) && !';&|'.includes(line[index])) {
      const char = line[index];
      if (char === "'") {
        const close = line.indexOf("'", index + 1);
        if (close < 0) {
          text += line.slice(index + 1);
          index = line.length;
          ended = true;
          break;
        }
        text += line.slice(index + 1, close);
        index = close + 1;
      } else if (char === '"') {
        index++;
        while (index < line.length && line[index] !== '"') {
          if (line[index] === '\\' && index + 1 < line.length && '\\"$`'.includes(line[index + 1])) {
            index++;
          }
          text += line[index];
          index++;
        }
        if (index >= line.length) {
          ended = true;
          break;
        }
        index++;
      } else if (char === '\\' && index + 1 < line.length) {
        text += line[index + 1];
        index += 2;
      } else {
        text += char;
        index++;
      }
    }
    found.push({ text, start, end: index });
    if (ended) {
      break;
    }
  }
  return found;
}

/** The harness a line runs on, or undefined when its first word names none. */
function harnessOf(command: Word[]): Harness | undefined {
  const first = command[0]?.text;
  return (HARNESSES as readonly string[]).includes(first) ? (first as Harness) : undefined;
}

/** Where the last non-empty value of `flag` stands in the command, or undefined when it carries none. */
function valueSpan(line: string, command: Word[], flag: string): ValueSpan | undefined {
  let span: ValueSpan | undefined;
  for (let index = 1; index < command.length; index++) {
    const word = command[index];
    const raw = line.slice(word.start, word.end);
    if (word.text === flag) {
      const next = command[index + 1];
      if (next !== undefined) {
        span = next.text === '' ? undefined : { text: next.text, start: next.start, end: next.end };
        index++;
      } else {
        span = undefined;
      }
    } else if (raw.startsWith(`${flag}=`)) {
      const text = word.text.slice(flag.length + 1);
      span = text === '' ? undefined : { text, start: word.start + flag.length + 1, end: word.end };
    }
  }
  return span;
}

/** Reads the harness, model, and effort a line carries, or undefined for a line of no known harness. */
export function readLine(line: string): LineValues | undefined {
  const command = words(line);
  const harness = harnessOf(command);
  if (harness === undefined) {
    return undefined;
  }
  const values: LineValues = { harness };
  const flags = FLAGS[harness];
  const model = valueSpan(line, command, flags.model);
  if (model !== undefined) {
    values.model = model.text;
  }
  if (flags.effort !== undefined) {
    const effort = valueSpan(line, command, flags.effort);
    if (effort !== undefined) {
      values.effort = effort.text;
    }
  }
  return values;
}

/** A `gurita:` skill invocation at the start of a word or after a space within it, and the skill's name. */
const SKILL = /(?:^|\s)[/$]gurita:([A-Za-z0-9][A-Za-z0-9_.-]*)/;

/**
 * The name of the `gurita:` skill a line's first command runs, or undefined for a line of no known
 * harness and for one whose first command invokes no skill.
 */
export function readSkill(line: string): string | undefined {
  const command = words(line);
  if (harnessOf(command) === undefined) {
    return undefined;
  }
  for (const word of command.slice(1)) {
    const found = SKILL.exec(word.text);
    if (found !== null) {
      return found[1];
    }
  }
  return undefined;
}

/** Writes `value` as a shell word in the quoting the replaced word used, quoting it where it needs it. */
function quoted(value: string, raw: string): string {
  const doubled = `"${value.replace(/[\\"$`]/g, (char) => `\\${char}`)}"`;
  if (raw.length >= 2 && raw.startsWith("'") && raw.endsWith("'") && !value.includes("'")) {
    return `'${value}'`;
  }
  if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
    return doubled;
  }
  return /^[A-Za-z0-9._\-/:+@,%=]+$/.test(value) ? value : doubled;
}

/** Replaces the value of one of a line's flags, or gives undefined when the line carries none to replace. */
function replaceValue(line: string, kind: 'model' | 'effort', value: string): string | undefined {
  if (value === '') {
    throw new Error(`An empty ${kind} cannot replace a line's ${kind}.`);
  }
  const command = words(line);
  const harness = harnessOf(command);
  if (harness === undefined) {
    return undefined;
  }
  const flag = FLAGS[harness][kind];
  if (flag === undefined) {
    return undefined;
  }
  const span = valueSpan(line, command, flag);
  if (span === undefined) {
    return undefined;
  }
  return line.slice(0, span.start) + quoted(value, line.slice(span.start, span.end)) + line.slice(span.end);
}

/** The line with its model replaced by `model`, or undefined when the line carries no model. */
export function replaceModel(line: string, model: string): string | undefined {
  return replaceValue(line, 'model', model);
}

/** The line with its effort replaced by `effort`, or undefined when the line carries no effort. */
export function replaceEffort(line: string, effort: string): string | undefined {
  return replaceValue(line, 'effort', effort);
}

/** The distinct harnesses, models, and efforts a variant's lines carry, each in first-appearance order. */
export function variantValues(lines: readonly string[]): VariantValues {
  const values: VariantValues = { harnesses: [], models: [], efforts: [] };
  for (const line of lines) {
    const read = readLine(line);
    if (read === undefined) {
      continue;
    }
    if (!values.harnesses.includes(read.harness)) {
      values.harnesses.push(read.harness);
    }
    if (read.model !== undefined && !values.models.includes(read.model)) {
      values.models.push(read.model);
    }
    if (read.effort !== undefined && !values.efforts.includes(read.effort)) {
      values.efforts.push(read.effort);
    }
  }
  return values;
}
