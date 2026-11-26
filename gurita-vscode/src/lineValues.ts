// The line-value module. It reads from a recipe line's text the harness the line runs on, the
// line's model, and its effort, it replaces a model or effort value a line already carries, and
// it rewrites a line onto another harness (`rewriteHarness`) among those `harnessChoices` gives
// it; a model or effort pick inserts no text into a line. A `claude` or `agy` line carrying both
// `--model` and `--effort` is rewritten onto the other of the two and onto Codex, and a headless
// `codex exec` line or an interactive bare `codex '$gurita:…'` line carrying `-m` onto either of
// them. A harness rewrite keeps the line's prompt and every other word as written and its headless
// or interactive form: between
// `claude` and `agy` a headless line, its first command carrying `-p` or `--print`, only changes
// its command word (`claude -p "…"` to `agy -p "…"` and back), an interactive `claude` line gains
// `-i` directly after `agy` (`claude "…"` to `agy -i "…"`), and an `agy` line loses its `-i`
// going back (`agy -i "…"` to `claude "…"`). A headless line switched onto Codex becomes
// `codex exec '$gurita:<skill> …'`, its `-p` dropped, `--dangerously-skip-permissions` becoming
// `--dangerously-bypass-approvals-and-sandbox`, its model written as `-m` and its effort as
// `-c model_reasoning_effort=<level>`, and a `codex exec` line switched back becomes
// `claude -p "/gurita:<skill> …"` or `agy -p "…"` with `--model` and `--effort`. An interactive
// line switched onto Codex becomes a bare `codex '$gurita:<skill> …'`, with no `exec`, the same
// flags rewritten and any `-i` an `agy` line carried dropped, and switched back becomes
// `claude "/gurita:<skill> …"` or `agy -i "…"`, the trailing `# interactive` mark kept. The rewritten
// line takes the picked harness's first listed model, and it keeps its effort when that harness's
// effort list offers it, taking the list's first effort otherwise; a line switched onto Codex while
// Codex's effort list is empty carries no effort override. An interactive line whose harness can be
// picked is also rewritten onto Claude Desktop, whose line opens with the plain word
// `claude-desktop` naming no CLI: `claude-desktop "/gurita:<skill> …"`, its prompt and every other
// word kept, an `agy` line's `-i` dropped, a bare `codex` line's prompt invoked as `/gurita:` and
// double-quoted, and its trailing `# interactive` mark kept, with every model flag, every effort,
// and the bypass flag dropped, since no parameter of the `claude://code/new` link Desktop opens a
// session from names a model, an effort, or a permission mode; the stored line so shows exactly
// what the session gets. A line's harness is its first word when that word is, by exact equality,
// `claude`, `agy`, `codex`, or `claude-desktop`; a Claude Desktop line carries no model and no
// effort, whatever flags it still holds, and any other line (a shell step, the slot line
// `<single-task line>`, a command the extension does not know) has no harness and carries no value. On `claude` and
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
// word of its arguments or a part of one, the quoted prompt being one word, and the line's prompt
// (`readPrompt`) is that word as the shell reads it. A Claude Desktop line whose prompt is too long
// for Desktop runs in a terminal as the line `claudeCodeLine` gives, its opening word replaced by
// `claude` and every other word kept as stored. A line whose harness can be picked is also
// rewritten between its headless and interactive forms in both directions (`rewriteForm`, the
// form read by `readForm`): `claude -p "…"` and `claude "…"`, `agy -p "…"` and `agy -i "…"`,
// `codex exec '$gurita:…'` and the bare `codex '$gurita:…'`, the trailing `# interactive` mark
// added or dropped with the form and the prompt, model, effort, bypass flag, and every other word
// kept as written. This module imports nothing from `vscode`.

/** The harnesses a line can run on that are CLIs, each named by the command a line opens with. */
const CLI_LINE_HARNESSES = ['claude', 'agy', 'codex'] as const;

/** The harness that is an application, named by the word a line on it opens with, which names no CLI. */
const DESKTOP = 'claude-desktop';

/** The harnesses a line can run on, each named by the word a line opens with, Claude Desktop last. */
export const HARNESSES = [...CLI_LINE_HARNESSES, DESKTOP] as const;

export type Harness = (typeof HARNESSES)[number];

/** A harness a line can run on that is a CLI, the line carrying its model and effort in its own text. */
type CliLineHarness = (typeof CLI_LINE_HARNESSES)[number];

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
const FLAGS: Readonly<Record<CliLineHarness, { model: string; effort: EffortSpec }>> = {
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
function effortSpan(line: string, command: Word[], harness: CliLineHarness): WritableSpan | undefined {
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
  if (harness === DESKTOP) {
    return values;
  }
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

/**
 * The prompt of a line's first command, the first word of its arguments invoking a `gurita:` skill,
 * read as the shell reads it, its quotes removed; undefined for a line of no known harness and for
 * one whose first command invokes no skill.
 */
export function readPrompt(line: string): string | undefined {
  const command = words(line);
  if (harnessOf(command) === undefined) {
    return undefined;
  }
  return promptWord(command)?.text;
}

/**
 * The interactive Claude Code line a Claude Desktop line runs as in a terminal: the line with its
 * opening word, as written, replaced by `claude` and every other word kept as stored (its quoted
 * prompt, any `--model`, `--effort`, or bypass flag it still holds, and its trailing `# interactive`
 * mark); undefined for a line that is not a Claude Desktop line.
 */
export function claudeCodeLine(line: string): string | undefined {
  const opening = words(line)[0];
  if (opening === undefined || opening.text !== DESKTOP) {
    return undefined;
  }
  return `${line.slice(0, opening.start)}claude${line.slice(opening.end)}`;
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
  if (harness === undefined || harness === DESKTOP) {
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

/**
 * The harnesses a line can be rewritten onto, each named by the word a line opens with: the three
 * CLIs `harnessChoices` gives a line, and Claude Desktop for an interactive one.
 */
export const SWITCHABLE_HARNESSES = HARNESSES;

export type SwitchableHarness = (typeof SWITCHABLE_HARNESSES)[number];

/** The model and effort lists of the harness a line is rewritten onto, in the order they are offered. */
export interface HarnessOffer {
  models: readonly string[];
  efforts: readonly string[];
}

/** Whether a `claude` or `agy` command is headless, carrying `-p` or `--print`. */
function printForm(command: Word[]): boolean {
  return command.slice(1).some((word) => word.text === '-p' || word.text === '--print');
}

/** The `exec` word of a headless `codex exec` command, or undefined for any other command. */
function execWord(command: Word[]): Word | undefined {
  return command[1]?.text === 'exec' ? command[1] : undefined;
}

/**
 * Whether a `codex` command is the interactive bare form `codex '$gurita:<skill> …'`: no `exec`,
 * its first argument a flag or its prompt, and that prompt invoking a skill as `$gurita:`.
 */
function bareCodex(command: Word[]): boolean {
  const asked = promptWord(command);
  return (
    execWord(command) === undefined &&
    asked !== undefined &&
    /(?:^|\s)\$gurita:/.test(asked.text) &&
    (command[1] === asked || command[1].text.startsWith('-'))
  );
}

/**
 * The harnesses the harness of `line` can be picked between, its own among them, or undefined for
 * a line whose harness cannot be picked: a `claude` or `agy` line carrying both `--model` and
 * `--effort`, headless or interactive, and a `codex` line carrying `-m`, with or without its effort
 * override, that is a headless `codex exec` line or an interactive bare `codex '$gurita:…'` one,
 * are given the three harnesses that are CLIs, and every other line (any other Codex line, one
 * carrying no `-m`, a line without both flags, a Claude Desktop line, a shell step, a command the
 * extension does not know) none. Claude Desktop is not among the choices: whether a line may go to
 * it is not read from the line alone, and `rewriteHarness` rewrites onto it any interactive line
 * given choices here.
 */
export function harnessChoices(line: string): readonly Harness[] | undefined {
  const read = readLine(line);
  if (read === undefined || read.model === undefined) {
    return undefined;
  }
  const command = words(line);
  if (read.harness === 'codex') {
    return execWord(command) !== undefined || bareCodex(command) ? CLI_LINE_HARNESSES : undefined;
  }
  return read.effort === undefined ? undefined : CLI_LINE_HARNESSES;
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
function prompt(text: string, harness: CliLineHarness): string {
  const sign = harness === 'codex' ? '$' : '/';
  const invoked = text.replace(INVOKED, (_match, before: string) => `${before}${sign}gurita:`);
  return harness === 'codex' && !invoked.includes("'") ? `'${invoked}'` : doubleQuoted(invoked);
}

/** The bypass flag of each harness's headless line. */
const BYPASS: Readonly<Record<CliLineHarness, string>> = {
  claude: '--dangerously-skip-permissions',
  agy: '--dangerously-skip-permissions',
  codex: '--dangerously-bypass-approvals-and-sandbox',
};

/** The flag and value a line's effort is written as on `harness`. */
function effortWords(harness: CliLineHarness, effort: string): string {
  return harness === 'codex' ? `-c ${quoted(`model_reasoning_effort=${effort}`, '')}` : `--effort ${quoted(effort, '')}`;
}

/**
 * The line `line`, on `from`, rewritten onto `to`, one of them `codex`, its headless or interactive
 * form kept: its command word and form words (`-p` or `--print` on a headless `claude` or `agy`
 * line, `exec` on a headless `codex` one; `-i` on an interactive `agy` line, none on an interactive
 * `claude` or `codex` one), its prompt's skill
 * invocation and quoting, its bypass flag, every model flag, written as `to`'s flag with `model`,
 * and every effort, written as `to`'s effort with `effort`, or left out when `effort` is undefined,
 * rewritten in place; a Codex line carrying no effort override gains `effort` after its last model
 * flag. Every other word is kept as written.
 */
function rewriteAcross(line: string, from: CliLineHarness, to: CliLineHarness, model: string, effort: string | undefined): string {
  const command = words(line);
  const first = command[0];
  const edits: Edit[] = [];
  if (from === 'codex') {
    const exec = execWord(command);
    if (exec !== undefined) {
      edits.push({ start: first.start, end: exec.end, text: `${to} -p` });
    } else {
      edits.push({ start: first.start, end: first.end, text: to === 'agy' ? 'agy -i' : to });
    }
  } else {
    const headless = printForm(command);
    edits.push({ start: first.start, end: first.end, text: headless ? 'codex exec' : 'codex' });
    for (const word of command.slice(1)) {
      const raw = line.slice(word.start, word.end);
      if (headless ? word.text === '-p' || word.text === '--print' : from === 'agy' && raw === '-i') {
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

/** The `# interactive` mark ending an interactive line, as the recipe reader reads it. */
const INTERACTIVE_MARK = /(?:^|\s)#\s*interactive\s*$/;

/**
 * Whether `line`, on the CLI harness `harness`, is interactive: it ends in the `# interactive`
 * mark and its first command is in its harness's interactive form, a `claude` or `agy` command
 * carrying no `-p` or `--print` and a `codex` command the bare `codex '$gurita:…'` form.
 */
function interactiveForm(line: string, command: Word[], harness: CliLineHarness): boolean {
  if (!INTERACTIVE_MARK.test(line)) {
    return false;
  }
  return harness === 'codex' ? bareCodex(command) : !printForm(command);
}

/** The edit removing the span `span` of `command`, a flag and its value, with the blanks standing before it. */
function spanRemoval(command: Word[], span: FlagSpan): Edit {
  const index = command.findIndex((word) => word.start === span.start);
  return { start: command[index - 1].end, end: span.end, text: '' };
}

/**
 * The interactive line `line`, on the CLI harness `from`, rewritten onto Claude Desktop: its command
 * word written as `claude-desktop`, an `agy` line's `-i` dropped, a `codex` line's prompt invoked as
 * `/gurita:` and double-quoted, and every model flag, every effort, and the bypass flag dropped with
 * the blanks before them, since Desktop takes none of them; every other word, the prompt of a
 * `claude` or `agy` line, and the trailing `# interactive` mark are kept as written.
 */
function rewriteDesktop(line: string, from: CliLineHarness): string {
  const command = words(line);
  const first = command[0];
  const edits: Edit[] = [{ start: first.start, end: first.end, text: DESKTOP }];
  for (const word of command.slice(1)) {
    const raw = line.slice(word.start, word.end);
    if ((from === 'agy' && raw === '-i') || word.text === BYPASS[from]) {
      edits.push(removal(command, word));
    }
  }
  const asked = promptWord(command);
  if (from === 'codex' && asked !== undefined) {
    edits.push({ start: asked.start, end: asked.end, text: prompt(asked.text, 'claude') });
  }
  const spec = FLAGS[from].effort;
  const efforts = 'flag' in spec ? flagSpans(line, command, spec.flag) : overrideSpans(line, command, spec.flags, spec.key);
  for (const span of [...flagSpans(line, command, FLAGS[from].model), ...efforts]) {
    edits.push(spanRemoval(command, span));
  }
  return applyEdits(line, edits);
}

/**
 * The line `line` rewritten onto `harness`, one of the harnesses `harnessChoices` gives it: its
 * prompt, its other words, and its headless or interactive form kept, its model the first `offer`
 * lists, and its effort kept when `offer` lists it and otherwise the first listed. A switch between
 * `claude` and `agy` changes only the command word and the interactive `-i`. A headless line
 * switched onto Codex becomes `codex exec '$gurita:<skill> …'`, `-p` or `--print` dropped, and an
 * interactive one a bare `codex '$gurita:<skill> …'`, any `-i` an `agy` line carried dropped,
 * `--dangerously-skip-permissions` becoming `--dangerously-bypass-approvals-and-sandbox`, its model
 * written as `-m` and its effort as `-c model_reasoning_effort=<level>`, with no effort override at
 * all when `offer` lists no effort; a `codex exec` line switched back becomes `claude -p` or
 * `agy -p`, and a bare `codex` line `claude` or `agy -i`, with its prompt double-quoted and invoked
 * as `/gurita:`, `--model`, and `--effort`, a
 * line written without the override taking the first effort listed. A line already on `harness` is
 * given back unchanged, and undefined is given for a harness `harnessChoices` does not offer the
 * line. An offer listing no model is refused, and so is one listing no effort for `claude` or `agy`.
 * Onto Claude Desktop, `claude-desktop`, only an interactive line `harnessChoices` gives choices is
 * rewritten, one ending in the `# interactive` mark whose first command is an interactive `claude`,
 * `agy -i`, or bare `codex '$gurita:…'` one, and `offer` is not read: the line becomes
 * `claude-desktop "/gurita:<skill> …"` with its prompt, its other words, and its `# interactive`
 * mark kept and every model flag, every effort, and the bypass flag dropped. A Claude Desktop line
 * is given back unchanged onto Claude Desktop, and undefined onto any other harness, as a headless
 * line and every other line are onto Claude Desktop.
 */
export function rewriteHarness(line: string, harness: SwitchableHarness, offer: HarnessOffer): string | undefined {
  const choices = harnessChoices(line);
  const read = readLine(line);
  if (harness === DESKTOP) {
    if (read?.harness === DESKTOP) {
      return line;
    }
    if (choices === undefined || read === undefined || !interactiveForm(line, words(line), read.harness)) {
      return undefined;
    }
    return rewriteDesktop(line, read.harness);
  }
  if (choices === undefined || read === undefined || read.harness === DESKTOP || !choices.includes(harness)) {
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

/** A line's form: headless, run to its end with no session left open, or interactive, left open in its terminal. */
export type LineForm = 'headless' | 'interactive';

/**
 * The form of a line whose harness can be picked, as `harnessChoices` gives it choices, read from
 * its text: interactive when it ends in the `# interactive` mark and its first command is in its
 * harness's interactive form (`claude "…"`, `agy "…"` with no `-p` or `--print`, the bare
 * `codex '$gurita:…'`), headless when it carries no mark and its first command is in its harness's
 * headless form (`claude` or `agy` carrying `-p` or `--print`, `codex exec`), and undefined for a
 * line in neither form and for every line `harnessChoices` gives none.
 */
export function readForm(line: string): LineForm | undefined {
  const read = readLine(line);
  if (read === undefined || read.harness === DESKTOP || harnessChoices(line) === undefined) {
    return undefined;
  }
  const command = words(line);
  if (INTERACTIVE_MARK.test(line)) {
    return interactiveForm(line, command, read.harness) ? 'interactive' : undefined;
  }
  const headless = read.harness === 'codex' ? execWord(command) !== undefined : printForm(command);
  return headless ? 'headless' : undefined;
}

/**
 * The line `line` rewritten into `form`, its harness, prompt, model, effort, bypass flag, and every
 * other word kept as written, only its form words and its trailing `# interactive` mark changed:
 * a headless line made interactive loses `-p` or `--print` (`claude -p "…"` to `claude "…"`), an
 * `agy` line's `-p` becoming `-i` in its place (`agy -p "…"` to `agy -i "…"`), a `codex exec` line
 * loses its `exec` (`codex exec '$gurita:…'` to `codex '$gurita:…'`), a prompt invoking its skill as
 * `/gurita:` rewritten to the single-quoted `'$gurita:…'` the bare form needs, and the line gains
 * ` # interactive` after its last word; an interactive line made headless gains `-p` after `claude`,
 * an `agy` line's `-i` becoming `-p` in its place (or `-p` written after `agy` when it carries no
 * `-i`), a bare `codex` line gains `exec` after `codex`, and the line loses its `# interactive` mark
 * with the blanks before it. A line already in `form` is given back unchanged, and undefined is given
 * for a line `readForm` reads no form of: a line whose harness cannot be picked (a Claude Desktop
 * line, a shell step, the slot line, a line without the flags `harnessChoices` asks for) and one in
 * neither form.
 */
export function rewriteForm(line: string, form: LineForm): string | undefined {
  const current = readForm(line);
  if (current === undefined) {
    return undefined;
  }
  if (current === form) {
    return line;
  }
  const harness = (readLine(line) as LineValues).harness as CliLineHarness;
  const command = words(line);
  const first = command[0];
  const rest = command.slice(1);
  const edits: Edit[] = [];
  if (form === 'interactive') {
    const prints = rest.filter((word) => word.text === '-p' || word.text === '--print');
    const marked = rest.some((word) => line.slice(word.start, word.end) === '-i');
    if (harness === 'codex') {
      edits.push(removal(command, execWord(command) as Word));
      const asked = promptWord(command);
      if (asked !== undefined && !/(?:^|\s)\$gurita:/.test(asked.text)) {
        edits.push({ start: asked.start, end: asked.end, text: prompt(asked.text, 'codex') });
      }
    } else {
      prints.forEach((word, index) => {
        edits.push(harness === 'agy' && index === 0 && !marked ? { start: word.start, end: word.end, text: '-i' } : removal(command, word));
      });
    }
    const changed = applyEdits(line, edits).trimEnd();
    const interactive = `${changed} # interactive`;
    return readForm(interactive) === 'interactive' ? interactive : undefined;
  }
  if (harness === 'codex') {
    edits.push({ start: first.end, end: first.end, text: ' exec' });
  } else {
    const interactive = harness === 'agy' ? rest.filter((word) => line.slice(word.start, word.end) === '-i') : [];
    if (interactive.length === 0) {
      edits.push({ start: first.end, end: first.end, text: ' -p' });
    }
    interactive.forEach((word, index) => {
      edits.push(index === 0 ? { start: word.start, end: word.end, text: '-p' } : removal(command, word));
    });
  }
  const changed = applyEdits(line, edits);
  const mark = INTERACTIVE_MARK.exec(changed) as RegExpExecArray;
  const headless = changed.slice(0, mark.index).trimEnd();
  return readForm(headless) === 'headless' ? headless : undefined;
}
