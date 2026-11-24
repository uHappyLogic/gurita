// The line-value module. It reads from a recipe line's text the harness the line runs on, the
// line's model, and its effort, it replaces a model or effort value a line already carries, and
// it rewrites a `claude` or `agy` line carrying both `--model` and `--effort` onto the other of
// the two harnesses (`rewriteHarness`); a model or effort pick inserts no text into a line. A
// harness rewrite keeps the line's prompt and every other word as written and its headless or
// interactive form: a headless line, its first command carrying `-p` or `--print`, only changes
// its command word (`claude -p "…"` to `agy -p "…"` and back), an interactive `claude` line gains
// `-i` directly after `agy` (`claude "…"` to `agy -i "…"`), and an `agy` line loses its `-i`
// going back (`agy -i "…"` to `claude "…"`). The rewritten line takes the picked harness's first
// listed model, and it keeps its effort when that harness's effort list offers it, taking the
// list's first effort otherwise. A line's harness is its first word when that word is
// `claude`, `agy`, or `codex`; any other line (a shell step, the slot line `<single-task line>`,
// a command the extension does not know) has no harness and carries no value. On `claude` and
// `agy` the model is the value of `--model` and the effort that of `--effort`; on `codex` the
// model is the value of `-m` and the effort is the config override
// `-c model_reasoning_effort=<level>`, the `--config` spelling read as well, its level the text
// after the override's first `=`, a level written as a quoted TOML string
// (`model_reasoning_effort="high"`) read without its quotes and replaced in them, and a `-c` naming
// another key read as no effort. A flag's value is the word after it, or the text after `=` in the
// `--flag=value` form, read as the shell would read the word, quotes removed; a flag with no value,
// or an empty one, carries nothing, and of a flag (or an override of the effort's key) written
// twice the last is the one read and replaced. Only the line's first command is read: its words
// end at the first `;`, `&`, or `|`, or a `#` opening a word, standing outside quotes, so a flag written
// inside the quoted prompt or after the line's closing `;` is never read. The skill a line runs
// is read from the same first command: the name after the first `/gurita:` or `$gurita:` opening a
// word of its arguments or a part of one, the quoted prompt being one word. This module imports
// nothing from `vscode`.

/** The harnesses a line can run on, each named by the command a line opens with. */
export const HARNESSES = ['claude', 'agy', 'codex'] as const;

export type Harness = (typeof HARNESSES)[number];

/** The value a line carries: a harness, its model, and its effort, each read from the line's text. */
export interface LineValues {
  harness: Harness;
  model?: string;
  effort?: string;
}

/**
 * Where a harness's effort stands: as the value of one flag, or as the level of a config override
 * of one key, written as the value of any of `flags`.
 */
type EffortSpec = { flag: string } | { flags: readonly string[]; key: string };

/** The flag carrying each harness's model, and where each carries its effort. */
const FLAGS: Readonly<Record<Harness, { model: string; effort: EffortSpec }>> = {
  claude: { model: '--model', effort: { flag: '--effort' } },
  agy: { model: '--model', effort: { flag: '--effort' } },
  codex: { model: '-m', effort: { flags: ['-c', '--config'], key: 'model_reasoning_effort' } },
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

/**
 * A value as it stands in a line, with the text its span is rewritten with to carry another value:
 * the value alone for a flag's value, the override with the other level for a config override.
 */
interface WritableSpan extends ValueSpan {
  /** The span's shell-read text with `other` in the place of the value it carries. */
  with: (other: string) => string;
}

/** A flag's value span, rewritten whole by another value. */
function plainSpan(span: ValueSpan | undefined): WritableSpan | undefined {
  return span === undefined ? undefined : { ...span, with: (other: string) => other };
}

/** Where the last non-empty effort a config override of `key` carries stands, or undefined when none carries one. */
function overrideSpan(line: string, command: Word[], flags: readonly string[], key: string): WritableSpan | undefined {
  let found: WritableSpan | undefined;
  for (let index = 1; index < command.length; index++) {
    const word = command[index];
    const raw = line.slice(word.start, word.end);
    let value: ValueSpan | undefined;
    if (flags.includes(word.text)) {
      const next = command[index + 1];
      if (next === undefined) {
        continue;
      }
      value = { text: next.text, start: next.start, end: next.end };
      index++;
    } else {
      const flag = flags.find((each) => raw.startsWith(`${each}=`));
      if (flag === undefined) {
        continue;
      }
      value = { text: word.text.slice(flag.length + 1), start: word.start + flag.length + 1, end: word.end };
    }
    const equals = value.text.indexOf('=');
    if (equals < 0 || value.text.slice(0, equals).trim() !== key) {
      continue;
    }
    const rest = value.text.slice(equals + 1);
    const written = rest.trim();
    const before = value.text.slice(0, equals + 1) + rest.slice(0, rest.length - rest.trimStart().length);
    const after = rest.slice(rest.trimEnd().length);
    const quote = written.length >= 2 && (written[0] === '"' || written[0] === "'") && written.endsWith(written[0]) ? written[0] : '';
    const level = quote === '' ? written : written.slice(1, -1);
    found =
      level === ''
        ? undefined
        : { text: level, start: value.start, end: value.end, with: (other: string) => `${before}${quote}${other}${quote}${after}` };
  }
  return found;
}

/** Where the effort a line's command carries stands on `harness`, or undefined when it carries none. */
function effortSpan(line: string, command: Word[], harness: Harness): WritableSpan | undefined {
  const spec = FLAGS[harness].effort;
  if ('flag' in spec) {
    return plainSpan(valueSpan(line, command, spec.flag));
  }
  return overrideSpan(line, command, spec.flags, spec.key);
}

/** Reads the harness, model, and effort a line carries, or undefined for a line of no known harness. */
export function readLine(line: string): LineValues | undefined {
  const command = words(line);
  const harness = harnessOf(command);
  if (harness === undefined) {
    return undefined;
  }
  const values: LineValues = { harness };
  const model = valueSpan(line, command, FLAGS[harness].model);
  if (model !== undefined) {
    values.model = model.text;
  }
  const effort = effortSpan(line, command, harness);
  if (effort !== undefined) {
    values.effort = effort.text;
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
  const span: WritableSpan | undefined =
    kind === 'effort' ? effortSpan(line, command, harness) : plainSpan(valueSpan(line, command, FLAGS[harness].model));
  if (span === undefined) {
    return undefined;
  }
  return line.slice(0, span.start) + quoted(span.with(value), line.slice(span.start, span.end)) + line.slice(span.end);
}

/** The line with its model replaced by `model`, or undefined when the line carries no model. */
export function replaceModel(line: string, model: string): string | undefined {
  return replaceValue(line, 'model', model);
}

/** The line with its effort replaced by `effort`, or undefined when the line carries no effort. */
export function replaceEffort(line: string, effort: string): string | undefined {
  return replaceValue(line, 'effort', effort);
}

/** The two harnesses a line's harness can be picked between: a Codex line keeps its harness. */
export const SWITCHABLE_HARNESSES = ['claude', 'agy'] as const;

export type SwitchableHarness = (typeof SWITCHABLE_HARNESSES)[number];

/** The model and effort lists of the harness a line is rewritten onto, in the order they are offered. */
export interface HarnessOffer {
  models: readonly string[];
  efforts: readonly string[];
}

/** The line with its first command's command word, and the form flag it needs, rewritten for `harness`. */
function switchCommand(line: string, harness: SwitchableHarness): string {
  const command = words(line);
  const first = command[0];
  const rest = command.slice(1);
  if (harness === 'agy') {
    const headless = rest.some((word) => word.text === '-p' || word.text === '--print');
    return line.slice(0, first.start) + (headless ? 'agy' : 'agy -i') + line.slice(first.end);
  }
  const interactive = rest.find((word) => word.text === '-i' && line.slice(word.start, word.end) === '-i');
  if (interactive === undefined) {
    return line.slice(0, first.start) + 'claude' + line.slice(first.end);
  }
  let after = interactive.end;
  while (after < line.length && /[ \t]/.test(line[after])) {
    after++;
  }
  return line.slice(0, first.start) + 'claude' + line.slice(first.end, interactive.start) + line.slice(after);
}

/**
 * The `claude` or `agy` line `line`, carrying both `--model` and `--effort`, rewritten onto
 * `harness`: its prompt, its other words, and its headless or interactive form kept, its model the
 * first `offer` lists, and its effort kept when `offer` lists it and otherwise the first listed.
 * A line already on `harness` is given back unchanged, and undefined is given for every other line
 * (a Codex line, a line without both flags, a shell step, a command the extension does not know).
 * An offer listing no model or no effort is refused.
 */
export function rewriteHarness(line: string, harness: SwitchableHarness, offer: HarnessOffer): string | undefined {
  const read = readLine(line);
  if (read === undefined || read.harness === 'codex' || read.model === undefined || read.effort === undefined) {
    return undefined;
  }
  if (read.harness === harness) {
    return line;
  }
  const model = offer.models[0];
  if (model === undefined || model === '') {
    throw new Error(`The ${harness} model list offers no model to rewrite a line with.`);
  }
  const effort = offer.efforts.includes(read.effort) ? read.effort : offer.efforts[0];
  if (effort === undefined || effort === '') {
    throw new Error(`The ${harness} effort list offers no effort to rewrite a line with.`);
  }
  const valued = replaceEffort(replaceModel(line, model) as string, effort) as string;
  return switchCommand(valued, harness);
}
