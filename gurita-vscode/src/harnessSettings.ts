// Each harness's enabled state, kept in the part of the per-user variant store file set aside for
// harness values (`harnesses` in `variantStore.ts`), one object keyed by the harness's key in the
// settings view, `claude`, `antigravity`, or `codex`, each holding `"enabled": false` once the
// person disables it. Every harness starts enabled, whatever its check reports and whatever
// recipes run on it, and stays enabled until the person disables it: a harness the part does not
// name, or names without `enabled`, is enabled, and the harness check never writes the state. A
// key the part holds that names no harness, and every other field of a harness's object, is kept
// as read. A disabled harness acts on the mission page's recipe list alone: a variant with at least
// one line on it is left out of the list the pane posts (`pageRecipes` in `recipes.ts`), while the
// buttons that run a recipe by its fixed name and the looped run's named single-task lines are
// untouched. This module imports nothing from `vscode`.

import { HARNESSES, Harness as CheckedHarness } from './harnessCheck';
import type { Harness as LineHarness } from './lineValues';
import { VariantStore, VariantStoreError, readVariantStore, writeVariantStore } from './variantStore';

/** A harness as the settings view names it. */
export type HarnessKey = CheckedHarness['key'];

/** Each harness's enabled state, by its key. */
export type HarnessStates = Record<HarnessKey, boolean>;

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

/** The commands the lines of the disabled harnesses open with, in the settings view's order. */
export function disabledCommands(states: HarnessStates): LineHarness[] {
  return HARNESSES.filter((harness) => !states[harness.key]).map((harness) => harness.cli as LineHarness);
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
