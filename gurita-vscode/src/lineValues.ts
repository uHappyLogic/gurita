// The line-value module. It reads from a recipe line's text the harness the line runs on, the
// line's model, and its effort, it replaces a model or effort value a line already carries, and
// it rewrites a line onto another harness (`rewriteHarness`) among those `harnessChoices` gives
// it; a model or effort pick inserts no text into a line. A `claude` or `agy` line carrying both
// `--model` and `--effort` is rewritten onto the other of the two and, when headless, onto Codex
// too, and a headless `codex exec` line carrying `-m` onto either of them. A harness rewrite keeps
// the line's prompt and every other word as written and its headless or interactive form: between
// `claude` and `agy` a headless line, its first command carrying `-p` or `--print`, only changes
// its command word (`claude -p "…"` to `agy -p "…"` and back), an interactive `claude` line gains
// `-i` directly after `agy` (`claude "…"` to `agy -i "…"`), and an `agy` line loses its `-i`
// going back (`agy -i "…"` to `claude "…"`). A headless line switched onto Codex becomes
// `codex exec '$gurita:<skill> …'`, its `-p` dropped, `--dangerously-skip-permissions` becoming
// `--dangerously-bypass-approvals-and-sandbox`, its model written as `-m` and its effort as
// `-c model_reasoning_effort=<level>`, and a `codex exec` line switched back becomes
// `claude -p "/gurita:<skill> …"` or `agy -p "…"` with `--model` and `--effort`. The rewritten
// line takes the picked harness's first listed model, and it keeps its effort when that harness's
// effort list offers it, taking the list's first effort otherwise; a line switched onto Codex while
// Codex's effort list is empty carries no effort override. A line's harness is its first word when that word is
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

/** The harnesses a line's harness can be picked between, each named by the command a line opens with. */
export const SWITCHABLE_HARNESSES = HARNESSES;

export type SwitchableHarness = (typeof SWITCHABLE_HARNESSES)[number];

/** The model and effort lists of the harness a line is rewritten onto, in the order they are offered. */
export interface HarnessOffer {
  models: readonly string[];
  efforts: readonly string[];
}

/** The two harnesses an interactive line's harness is picked between. */
const INTERACTIVE_CHOICES: readonly Harness[] = ['claude', 'agy'];

/** Whether a `claude` or `agy` command is headless, carrying `-p` or `--print`. */
function printForm(command: Word[]): boolean {
  return command.slice(1).some((word) => word.text === '-p' || word.text === '--print');
}

/** The `exec` word of a headless `codex exec` command, or undefined for any other command. */
function execWord(command: Word[]): Word | undefined {
  return command[1]?.text === 'exec' ? command[1] : undefined;
}

/**
 * The harnesses the harness of `line` can be picked between, its own among them, or undefined for
 * a line whose harness cannot be picked: a headless `claude` or `agy` line carrying both
 * `--model` and `--effort` and a headless `codex exec` line carrying `-m`, with or without its
 * effort override, are given all three harnesses, an interactive `claude` or `agy` line carrying
 * both flags Claude Code and Antigravity alone, and every other line (a Codex line not opening
 * `codex exec` or carrying no `-m`, a line without both flags, a shell step, a command the
 * extension does not know) none.
 */
export function harnessChoices(line: string): readonly Harness[] | undefined {
  const read = readLine(line);
  if (read === undefined || read.model === undefined) {
    return undefined;
  }
  const command = words(line);
  if (read.harness === 'codex') {
    return execWord(command) === undefined ? undefined : HARNESSES;
  }
  if (read.effort === undefined) {
    return undefined;
  }
  return printForm(command) ? HARNESSES : INTERACTIVE_CHOICES;
}

/** The line with its first command's command word, and the form flag it needs, rewritten for `claude` or `agy`. */
function switchCommand(line: string, harness: 'claude' | 'agy'): string {
  const command = words(line);
  const first = command[0];
  const rest = command.slice(1);
  if (harness === 'agy') {
    return line.slice(0, first.start) + (printForm(command) ? 'agy' : 'agy -i') + line.slice(first.end);
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

/** One replacement of a span of a line by other text. */
interface Edit {
  start: number;
  end: number;
  text: string;
}

/** The line with every edit made, the edits standing apart from one another. */
function applyEdits(line: string, edits: readonly Edit[]): string {
  let changed = line;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    changed = changed.slice(0, edit.start) + edit.text + changed.slice(edit.end);
  }
  return changed;
}

/** The edit removing the word `word` of `command` with the blanks standing before it. */
function removal(command: Word[], word: Word): Edit {
  const index = command.indexOf(word);
  return { start: command[index - 1].end, end: word.end, text: '' };
}

/** Where a flag and the value it is given stand together, and the value as it is written. */
interface FlagSpan {
  start: number;
  end: number;
  raw: string;
}

/** Every place `flag` stands in the command with a value after it or after its `=`. */
function flagSpans(line: string, command: Word[], flag: string): FlagSpan[] {
  const spans: FlagSpan[] = [];
  for (let index = 1; index < command.length; index++) {
    const word = command[index];
    const raw = line.slice(word.start, word.end);
    if (word.text === flag && command[index + 1] !== undefined) {
      const next = command[index + 1];
      spans.push({ start: word.start, end: next.end, raw: line.slice(next.start, next.end) });
      index++;
    } else if (raw.startsWith(`${flag}=`)) {
      spans.push({ start: word.start, end: word.end, raw: raw.slice(flag.length + 1) });
    }
  }
  return spans;
}

/** Every place a config override of `key` stands in the command, given as the value of one of `flags`. */
function overrideSpans(line: string, command: Word[], flags: readonly string[], key: string): FlagSpan[] {
  const named = (text: string): boolean => text.indexOf('=') >= 0 && text.slice(0, text.indexOf('=')).trim() === key;
  const spans: FlagSpan[] = [];
  for (let index = 1; index < command.length; index++) {
    const word = command[index];
    const raw = line.slice(word.start, word.end);
    if (flags.includes(word.text) && command[index + 1] !== undefined) {
      const next = command[index + 1];
      if (named(next.text)) {
        spans.push({ start: word.start, end: next.end, raw: line.slice(next.start, next.end) });
      }
      index++;
    } else {
      const flag = flags.find((each) => raw.startsWith(`${each}=`));
      if (flag !== undefined && named(word.text.slice(flag.length + 1))) {
        spans.push({ start: word.start, end: word.end, raw: raw.slice(flag.length + 1) });
      }
    }
  }
  return spans;
}

/** A skill invocation's `/gurita:` or `$gurita:` opening the text or following a blank in it. */
const INVOKED = /(^|\s)[/$]gurita:/;

/** The first word of the command's arguments invoking a `gurita:` skill, the quoted prompt being one word. */
function promptWord(command: Word[]): Word | undefined {
  return command.slice(1).find((word) => SKILL.test(word.text));
}

/** `text` as one double-quoted shell word. */
function doubleQuoted(text: string): string {
  return `"${text.replace(/[\\"$`]/g, (char) => `\\${char}`)}"`;
}

/**
 * A prompt read as the shell reads it, rewritten for `harness`: its skill invoked as `$gurita:` and
 * the prompt single-quoted, double-quoted where it holds a single quote, for `codex`, and invoked
 * as `/gurita:` and double-quoted for `claude` and `agy`.
 */
function prompt(text: string, harness: Harness): string {
  const sign = harness === 'codex' ? '$' : '/';
  const invoked = text.replace(INVOKED, (_match, before: string) => `${before}${sign}gurita:`);
  return harness === 'codex' && !invoked.includes("'") ? `'${invoked}'` : doubleQuoted(invoked);
}

/** The bypass flag of each harness's headless line. */
const BYPASS: Readonly<Record<Harness, string>> = {
  claude: '--dangerously-skip-permissions',
  agy: '--dangerously-skip-permissions',
  codex: '--dangerously-bypass-approvals-and-sandbox',
};

/** The flag and value a line's effort is written as on `harness`. */
function effortWords(harness: Harness, effort: string): string {
  return harness === 'codex' ? `-c ${quoted(`model_reasoning_effort=${effort}`, '')}` : `--effort ${quoted(effort, '')}`;
}

/**
 * The headless line `line`, on `from`, rewritten onto `to`, one of them `codex`: its command word
 * and form words (`-p` or `--print` on `claude` and `agy`, `exec` on `codex`), its prompt's skill
 * invocation and quoting, its bypass flag, every model flag, written as `to`'s flag with `model`,
 * and every effort, written as `to`'s effort with `effort`, or left out when `effort` is undefined,
 * rewritten in place; a Codex line carrying no effort override gains `effort` after its last model
 * flag. Every other word is kept as written.
 */
function rewriteAcross(line: string, from: Harness, to: Harness, model: string, effort: string | undefined): string {
  const command = words(line);
  const first = command[0];
  const edits: Edit[] = [];
  if (from === 'codex') {
    const exec = execWord(command) as Word;
    edits.push({ start: first.start, end: exec.end, text: `${to} -p` });
  } else {
    edits.push({ start: first.start, end: first.end, text: 'codex exec' });
    for (const word of command.slice(1)) {
      if (word.text === '-p' || word.text === '--print') {
        edits.push(removal(command, word));
      }
    }
  }
  const asked = promptWord(command);
  if (asked !== undefined) {
    edits.push({ start: asked.start, end: asked.end, text: prompt(asked.text, to) });
  }
  for (const word of command.slice(1)) {
    if (word.text === BYPASS[from]) {
      edits.push({ start: word.start, end: word.end, text: BYPASS[to] });
    }
  }
  const models = flagSpans(line, command, FLAGS[from].model);
  for (const span of models) {
    edits.push({ ...span, text: `${FLAGS[to].model} ${quoted(model, span.raw)}` });
  }
  const spec = FLAGS[from].effort;
  const efforts = 'flag' in spec ? flagSpans(line, command, spec.flag) : overrideSpans(line, command, spec.flags, spec.key);
  for (const span of efforts) {
    if (effort === undefined) {
      const index = command.findIndex((word) => word.start === span.start);
      edits.push({ start: command[index - 1].end, end: span.end, text: '' });
    } else {
      edits.push({ ...span, text: effortWords(to, effort) });
    }
  }
  if (efforts.length === 0 && effort !== undefined && models.length > 0) {
    const last = models[models.length - 1];
    edits.push({ start: last.end, end: last.end, text: ` ${effortWords(to, effort)}` });
  }
  return applyEdits(line, edits);
}

/**
 * The line `line` rewritten onto `harness`, one of the harnesses `harnessChoices` gives it: its
 * prompt, its other words, and its headless or interactive form kept, its model the first `offer`
 * lists, and its effort kept when `offer` lists it and otherwise the first listed. A switch between
 * `claude` and `agy` changes only the command word and the interactive `-i`. A headless line
 * switched onto Codex becomes `codex exec '$gurita:<skill> …'`, `-p` or `--print` dropped,
 * `--dangerously-skip-permissions` becoming `--dangerously-bypass-approvals-and-sandbox`, its model
 * written as `-m` and its effort as `-c model_reasoning_effort=<level>`, with no effort override at
 * all when `offer` lists no effort; a `codex exec` line switched back becomes `claude -p` or
 * `agy -p` with its prompt double-quoted and invoked as `/gurita:`, `--model`, and `--effort`, a
 * line written without the override taking the first effort listed. A line already on `harness` is
 * given back unchanged, and undefined is given for a harness `harnessChoices` does not offer the
 * line. An offer listing no model is refused, and so is one listing no effort for `claude` or `agy`.
 */
export function rewriteHarness(line: string, harness: SwitchableHarness, offer: HarnessOffer): string | undefined {
  const choices = harnessChoices(line);
  const read = readLine(line);
  if (choices === undefined || read === undefined || !choices.includes(harness)) {
    return undefined;
  }
  if (read.harness === harness) {
    return line;
  }
  const model = offer.models[0];
  if (model === undefined || model === '') {
    throw new Error(`The ${harness} model list offers no model to rewrite a line with.`);
  }
  const listed = read.effort !== undefined && offer.efforts.includes(read.effort) ? read.effort : offer.efforts[0];
  const effort = listed === '' ? undefined : listed;
  if (harness === 'codex' || read.harness === 'codex') {
    if (effort === undefined && harness !== 'codex') {
      throw new Error(`The ${harness} effort list offers no effort to rewrite a line with.`);
    }
    return rewriteAcross(line, read.harness, harness, model, effort);
  }
  if (effort === undefined) {
    throw new Error(`The ${harness} effort list offers no effort to rewrite a line with.`);
  }
  const valued = replaceEffort(replaceModel(line, model) as string, effort) as string;
  return switchCommand(valued, harness);
}
