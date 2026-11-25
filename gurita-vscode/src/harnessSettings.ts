// Each harness's settings, kept in the part of the per-user variant store file set aside for
// harness values (`harnesses` in `variantStore.ts`), one object keyed by the harness's key in the
// settings view, `claude`, `antigravity`, `codex`, or `claude-desktop`.
//
// Its enabled state: the object holds `"enabled": false` once the person disables the harness.
// Every harness starts enabled, whatever its check reports and whatever recipes run on it, and
// stays enabled until the person disables it: a harness the part does not name, or names without
// `enabled`, is enabled, and the harness check never writes the state. A disabled harness acts on
// the mission page's recipe list alone: a variant with at least one line on it is left out of the
// list a mission window is posted (`pageRecipes` in `recipes.ts`), while the buttons that run a recipe by its
// fixed name and the looped run's named single-task lines are untouched. Outside a local macOS
// window, where Claude Desktop is not offered, its lines are left out wherever a disabled
// harness's are, whatever state the part holds for it (`disabledCommands`).
//
// Its model list and its one effort list for the whole harness, kept for the three CLIs alone, since
// no line on Claude Desktop carries a model or an effort: each list is derived from the
// values the lines of the shipped recipes, the own recipes, and the stored variants carry, in that
// order of first appearance, `--model` and `--effort` on a `claude` or `agy` line, and `-m` and the
// config override `-c model_reasoning_effort=<level>` on a `codex` line, as `lineValues.ts` reads
// them. The extension ships no list of its own and queries no harness. Laid over each derived
// list is the person's overlay, kept in the harness's object as `addedModels` and
// `removedModels`, and `addedEfforts` and `removedEfforts`, each an array of text: an added entry,
// one no line uses yet, follows the derived ones in the order added, and a removed entry is left
// out of the offer, derived or not. Adding a removed entry takes it out of the removed ones,
// adding it as well only when no line carries it; removing an added entry takes it out of the
// added ones, recording it as removed as well only when a line carries it. The list keeps no
// record of which model takes which effort.
//
// A key the part holds that names no harness, and every other field of a harness's object, is
// kept as read. This module imports nothing from `vscode`.

import { CLI_HARNESSES, CliHarnessKey, DESKTOP_HARNESS, HARNESSES, Harness as CheckedHarness } from './harnessCheck';
import { Harness as LineHarness, readLine } from './lineValues';
import { readRecipes } from './recipes';
import { VariantStore, VariantStoreError, readVariantStore, writeVariantStore } from './variantStore';

/** A harness as the settings view names it. */
export type HarnessKey = CheckedHarness['key'];

/** Each harness's enabled state, by its key. */
export type HarnessStates = Record<HarnessKey, boolean>;

/** Which of a harness's two lists: its models or its efforts. */
export type ListKind = 'model' | 'effort';

/** One harness's lists as the settings view offers them: its models and its efforts. */
export interface HarnessList {
  models: string[];
  efforts: string[];
}

/** Each CLI harness's lists, by its key; Claude Desktop has none. */
export type HarnessLists = Record<CliHarnessKey, HarnessList>;

/** The overlay's fields of each list in a harness's object: the entries added and the entries removed. */
const OVERLAY: Readonly<Record<ListKind, { added: string; removed: string }>> = {
  model: { added: 'addedModels', removed: 'removedModels' },
  effort: { added: 'addedEfforts', removed: 'removedEfforts' },
};

const OVERLAY_FIELDS = [OVERLAY.model.added, OVERLAY.model.removed, OVERLAY.effort.added, OVERLAY.effort.removed];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Whether `value` is the key of a harness the settings view covers. */
export function isHarnessKey(value: unknown): value is HarnessKey {
  return HARNESSES.some((harness) => harness.key === value);
}

/**
 * The harness part of `store`, read from `file`: an empty one when the store holds none, refused
 * when it is no object, when a harness's value is no object, or when its `enabled` is no boolean.
 */
function harnessPart(store: VariantStore, file: string): Record<string, unknown> {
  const part = store.harnesses;
  if (part === undefined) {
    return {};
  }
  if (!isRecord(part)) {
    throw new VariantStoreError(`The variant store ${file} holds a "harnesses" part that is not an object.`);
  }
  for (const harness of HARNESSES) {
    const entry = part[harness.key];
    if (entry === undefined) {
      continue;
    }
    if (!isRecord(entry)) {
      throw new VariantStoreError(`The variant store ${file} holds a "harnesses" value for "${harness.key}" that is not an object.`);
    }
    if (entry.enabled !== undefined && typeof entry.enabled !== 'boolean') {
      throw new VariantStoreError(`The variant store ${file} holds a "harnesses" value for "${harness.key}" whose "enabled" is not true or false.`);
    }
    for (const field of OVERLAY_FIELDS) {
      const value = entry[field];
      if (value !== undefined && (!Array.isArray(value) || value.some((each) => typeof each !== 'string'))) {
        throw new VariantStoreError(`The variant store ${file} holds a "harnesses" value for "${harness.key}" whose "${field}" is not an array of text.`);
      }
    }
  }
  return part;
}

/** Each harness's enabled state as `store`, read from `file`, holds it, a harness it does not disable enabled. */
export function harnessStates(store: VariantStore, file: string): HarnessStates {
  const part = harnessPart(store, file);
  const states = {} as HarnessStates;
  for (const harness of HARNESSES) {
    const entry = part[harness.key];
    states[harness.key] = !(isRecord(entry) && entry.enabled === false);
  }
  return states;
}

/**
 * The commands the lines the pages leave out open with, in the settings view's order: those of the
 * disabled harnesses, and Claude Desktop's `claude-desktop` whatever its state when `desktopOffered`
 * is not set, the window not being a local macOS one (`desktopOffered` in `harnessCheck.ts`).
 */
export function disabledCommands(states: HarnessStates, desktopOffered = true): LineHarness[] {
  return HARNESSES.filter((harness) => !states[harness.key] || (!desktopOffered && harness.key === DESKTOP_HARNESS.key)).map(
    (harness) => harness.cli as LineHarness,
  );
}

/** The store with the harness `key` enabled or disabled, every other value of the harness part kept as read. */
export function withHarnessEnabled(store: VariantStore, file: string, key: HarnessKey, enabled: boolean): VariantStore {
  const part = harnessPart(store, file);
  const entry = part[key];
  return { ...store, harnesses: { ...part, [key]: { ...(isRecord(entry) ? entry : {}), enabled } } };
}

/** Each harness's enabled state, read afresh from the variant store file at `file`. */
export function readHarnessStates(file: string): HarnessStates {
  return harnessStates(readVariantStore(file), file);
}

/** Enables or disables the harness `key` in the variant store file at `file`, read afresh and written whole. */
export function setHarnessEnabled(file: string, key: HarnessKey, enabled: boolean): void {
  writeVariantStore(file, withHarnessEnabled(readVariantStore(file), file, key, enabled));
}

/** Whether `value` names one of a harness's two lists. */
export function isListKind(value: unknown): value is ListKind {
  return value === 'model' || value === 'effort';
}

/** The harness key of the lines that open with the command `cli`, or undefined for a harness with no lists. */
function keyOf(cli: LineHarness): CliHarnessKey | undefined {
  return CLI_HARNESSES.find((harness) => harness.cli === cli)?.key;
}

/** Each harness's lists as `lines` carry them, each distinct and in the order of first appearance, with no overlay. */
export function derivedLists(lines: Iterable<string>): HarnessLists {
  const lists = {} as HarnessLists;
  for (const harness of CLI_HARNESSES) {
    lists[harness.key] = { models: [], efforts: [] };
  }
  for (const line of lines) {
    const read = readLine(line);
    const key = read === undefined ? undefined : keyOf(read.harness);
    if (read === undefined || key === undefined) {
      continue;
    }
    const list = lists[key];
    if (read.model !== undefined && !list.models.includes(read.model)) {
      list.models.push(read.model);
    }
    if (read.effort !== undefined && !list.efforts.includes(read.effort)) {
      list.efforts.push(read.effort);
    }
  }
  return lists;
}

/** The overlay's entries of one field of a harness's object, empty when it holds none. */
function overlayEntries(entry: unknown, field: string): string[] {
  const value = isRecord(entry) ? entry[field] : undefined;
  return Array.isArray(value) ? [...(value as string[])] : [];
}

/** The list `derived` with the overlay of `kind` in a harness's object `entry` laid over it. */
function overlaid(derived: readonly string[], entry: unknown, kind: ListKind): string[] {
  const removed = overlayEntries(entry, OVERLAY[kind].removed);
  const list: string[] = [];
  for (const value of [...derived, ...overlayEntries(entry, OVERLAY[kind].added)]) {
    if (!list.includes(value) && !removed.includes(value)) {
      list.push(value);
    }
  }
  return list;
}

/** Each harness's lists: those `lines` carry, the overlay `store`, read from `file`, holds laid over them. */
export function harnessLists(store: VariantStore, file: string, lines: Iterable<string>): HarnessLists {
  const part = harnessPart(store, file);
  const derived = derivedLists(lines);
  const lists = {} as HarnessLists;
  for (const harness of CLI_HARNESSES) {
    const entry = part[harness.key];
    const each = derived[harness.key];
    lists[harness.key] = { models: overlaid(each.models, entry, 'model'), efforts: overlaid(each.efforts, entry, 'effort') };
  }
  return lists;
}

/** Refuses an empty entry. */
function checkedEdit(kind: ListKind, value: string): void {
  if (value === '') {
    throw new Error(`An empty ${kind} cannot be added to or removed from a list.`);
  }
}

/** The store with one harness's object `entry` given the overlay fields of `kind`, an empty field left out. */
function withOverlay(store: VariantStore, part: Record<string, unknown>, key: CliHarnessKey, kind: ListKind, added: string[], removed: string[]): VariantStore {
  const entry = { ...(isRecord(part[key]) ? (part[key] as Record<string, unknown>) : {}) };
  delete entry[OVERLAY[kind].added];
  delete entry[OVERLAY[kind].removed];
  if (added.length > 0) {
    entry[OVERLAY[kind].added] = added;
  }
  if (removed.length > 0) {
    entry[OVERLAY[kind].removed] = removed;
  }
  return { ...store, harnesses: { ...part, [key]: entry } };
}

/**
 * The store with `value` added to the harness `key`'s list of `kind`, as derived from `lines`: taken
 * out of the removed entries, and added as an entry of its own only when no line carries it. Every
 * other value of the harness part is kept as read.
 */
export function withListValueAdded(store: VariantStore, file: string, lines: Iterable<string>, key: CliHarnessKey, kind: ListKind, value: string): VariantStore {
  checkedEdit(kind, value);
  const part = harnessPart(store, file);
  const derived = derivedLists(lines)[key];
  const carried = (kind === 'model' ? derived.models : derived.efforts).includes(value);
  const added = overlayEntries(part[key], OVERLAY[kind].added);
  const removed = overlayEntries(part[key], OVERLAY[kind].removed).filter((each) => each !== value);
  if (!carried && !added.includes(value)) {
    added.push(value);
  }
  return withOverlay(store, part, key, kind, added, removed);
}

/**
 * The store with `value` removed from the harness `key`'s list of `kind`, as derived from `lines`:
 * taken out of the added entries, and recorded as removed only when a line carries it. Every other
 * value of the harness part is kept as read.
 */
export function withListValueRemoved(store: VariantStore, file: string, lines: Iterable<string>, key: CliHarnessKey, kind: ListKind, value: string): VariantStore {
  checkedEdit(kind, value);
  const part = harnessPart(store, file);
  const derived = derivedLists(lines)[key];
  const carried = (kind === 'model' ? derived.models : derived.efforts).includes(value);
  const added = overlayEntries(part[key], OVERLAY[kind].added).filter((each) => each !== value);
  const removed = overlayEntries(part[key], OVERLAY[kind].removed);
  if (carried && !removed.includes(value)) {
    removed.push(value);
  }
  return withOverlay(store, part, key, kind, added, removed);
}

/**
 * Every line the lists are derived from: those of the shipped recipes in `shippedFile`, of the
 * project recipes in `projectFile` and the own recipes in `ownFile`, each when given and present,
 * and of the stored variants in `store`, in that order, whatever the store hides or stands in for.
 */
function sourceLines(shippedFile: string, ownFile: string | undefined, store: VariantStore, projectFile?: string): string[] {
  const read = readRecipes(shippedFile, ownFile, undefined, projectFile).flatMap((recipe) => recipe.variants.flatMap((variant) => variant.lines));
  return [...read, ...store.variants.flatMap((variant) => variant.lines)];
}

/** Each harness's lists, read afresh from the recipe files, the project's at `projectFile` when given, and the variant store file at `storeFile`. */
export function readHarnessLists(shippedFile: string, ownFile: string | undefined, storeFile: string, projectFile?: string): HarnessLists {
  const store = readVariantStore(storeFile);
  return harnessLists(store, storeFile, sourceLines(shippedFile, ownFile, store, projectFile));
}

/**
 * Adds `value` to, or removes it from, the harness `key`'s list of `kind` in the variant store file
 * at `storeFile`, read afresh with the recipe files, the project's at `projectFile` when given,
 * and written whole.
 */
export function editHarnessList(
  shippedFile: string,
  ownFile: string | undefined,
  storeFile: string,
  key: CliHarnessKey,
  kind: ListKind,
  edit: 'add' | 'remove',
  value: string,
  projectFile?: string,
): void {
  const store = readVariantStore(storeFile);
  const lines = sourceLines(shippedFile, ownFile, store, projectFile);
  const edited = edit === 'add' ? withListValueAdded(store, storeFile, lines, key, kind, value) : withListValueRemoved(store, storeFile, lines, key, kind, value);
  writeVariantStore(storeFile, edited);
}
