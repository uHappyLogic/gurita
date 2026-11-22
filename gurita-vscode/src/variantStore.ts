// The per-user variant store: a JSON file of the extension's own, `~/.gurita/variants.json`, beside
// the default own recipe file, read with `JSON.parse` and laid over the recipes the Markdown reader
// yields wherever the extension reads recipes. The extension is its only writer and the own recipe
// file stays read-only to it. The file is one object of four parts, each optional and a missing
// one holding nothing:
//
//   `variants` — the stored variants, in order, each `{ "recipe", "name", "lines" }`, a recipe
//     name, a variant name, and the variant's literal lines as an array of strings, and, for a
//     stored copy, `"copies": { "name", "origin" }` naming the shipped or own variant it stands in
//     for, `origin` being `shipped` or `own`;
//   `hidden` — the records that hide a variant, each `{ "recipe", "name", "origin" }`, `origin`
//     being `shipped` or `own`;
//   `defaults` — each recipe's picked default, `{ "recipe", "name", "origin" }`, `origin` being
//     `shipped`, `own`, or `stored`;
//   `harnesses` — the part set aside for harness values, kept as read.
//
// A missing file holds nothing; a file that is not in this form is refused with an error naming it.
// How the records are laid over the recipe list is the recipe reader's (`overlayVariantStore` in
// `recipes.ts`); this module reads the file only. It imports nothing from `vscode`.

import * as fs from 'node:fs';

/** The default path of the variant store, under the person's home directory beside the default own recipe file. */
export const DEFAULT_VARIANT_STORE_FILE = '~/.gurita/variants.json';

/** Where a variant comes from: the shipped file, the person's own recipe file, or the variant store. */
export type VariantOrigin = 'shipped' | 'own' | 'stored';

/** A variant of one recipe, named by its variant name and where it comes from. */
export interface VariantRef {
  name: string;
  origin: VariantOrigin;
}

/** A variant read from a file, which a stored copy may stand in for and a hiding record may hide. */
export interface ReadVariantRef {
  name: string;
  origin: 'shipped' | 'own';
}

/** One stored variant: a further variant of its recipe, or, carrying `copies`, a stored copy. */
export interface StoredVariant {
  recipe: string;
  name: string;
  lines: string[];
  /** The shipped or own variant this stored copy stands in for, keeping its place. */
  copies?: ReadVariantRef;
}

/** One record hiding a shipped or own variant of a recipe. */
export interface HiddenVariant {
  recipe: string;
  name: string;
  origin: 'shipped' | 'own';
}

/** One recipe's picked default. */
export interface PickedDefault {
  recipe: string;
  name: string;
  origin: VariantOrigin;
}

/** The variant store as read. */
export interface VariantStore {
  variants: StoredVariant[];
  hidden: HiddenVariant[];
  defaults: PickedDefault[];
  /** The part set aside for harness values, kept as read, left out when the file holds none. */
  harnesses?: unknown;
}

/** A variant store file that is not in its stated form. */
export class VariantStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VariantStoreError';
  }
}

/** The store holding nothing, as a missing file reads. */
export function emptyVariantStore(): VariantStore {
  return { variants: [], hidden: [], defaults: [] };
}

/** The path of the variant store, a leading `~` of the default expanded to the home directory `home`. */
export function variantStoreFile(home: string): string {
  return `${home.replace(/\/+$/, '')}/${DEFAULT_VARIANT_STORE_FILE.slice(2)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOrigin(value: unknown, allowed: readonly string[]): boolean {
  return typeof value === 'string' && allowed.includes(value);
}

/** The array a part holds, empty when the part is missing, refused when it is no array. */
function part(store: Record<string, unknown>, key: string, file: string): unknown[] {
  const value = store[key];
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new VariantStoreError(`The variant store ${file} holds a "${key}" part that is not an array.`);
  }
  return value;
}

/** Refuses a record of `key` that is not an object whose `fields` are all strings. */
function stringFields(record: unknown, key: string, index: number, fields: readonly string[], file: string): Record<string, unknown> {
  if (!isRecord(record) || fields.some((field) => typeof record[field] !== 'string')) {
    throw new VariantStoreError(
      `The variant store ${file} holds a record ${index + 1} in "${key}" without ${fields.map((field) => `"${field}"`).join(', ')} as text.`,
    );
  }
  return record;
}

/** Reads a variant store file's text, `file` naming it in a refusal. */
export function parseVariantStore(text: string, file: string): VariantStore {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new VariantStoreError(`The variant store ${file} is not JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!isRecord(parsed)) {
    throw new VariantStoreError(`The variant store ${file} does not hold one JSON object.`);
  }
  const store = emptyVariantStore();
  part(parsed, 'variants', file).forEach((raw, index) => {
    const record = stringFields(raw, 'variants', index, ['recipe', 'name'], file);
    const lines = record.lines;
    if (!Array.isArray(lines) || lines.some((line) => typeof line !== 'string')) {
      throw new VariantStoreError(`The variant store ${file} holds a record ${index + 1} in "variants" whose "lines" is not an array of text.`);
    }
    const stored: StoredVariant = { recipe: record.recipe as string, name: record.name as string, lines: [...(lines as string[])] };
    if (record.copies !== undefined) {
      const copies = record.copies;
      if (!isRecord(copies) || typeof copies.name !== 'string' || !isOrigin(copies.origin, ['shipped', 'own'])) {
        throw new VariantStoreError(
          `The variant store ${file} holds a record ${index + 1} in "variants" whose "copies" does not name a shipped or own variant.`,
        );
      }
      stored.copies = { name: copies.name, origin: copies.origin as 'shipped' | 'own' };
    }
    store.variants.push(stored);
  });
  part(parsed, 'hidden', file).forEach((raw, index) => {
    const record = stringFields(raw, 'hidden', index, ['recipe', 'name'], file);
    if (!isOrigin(record.origin, ['shipped', 'own'])) {
      throw new VariantStoreError(`The variant store ${file} holds a record ${index + 1} in "hidden" whose "origin" is not shipped or own.`);
    }
    store.hidden.push({ recipe: record.recipe as string, name: record.name as string, origin: record.origin as 'shipped' | 'own' });
  });
  part(parsed, 'defaults', file).forEach((raw, index) => {
    const record = stringFields(raw, 'defaults', index, ['recipe', 'name'], file);
    if (!isOrigin(record.origin, ['shipped', 'own', 'stored'])) {
      throw new VariantStoreError(`The variant store ${file} holds a record ${index + 1} in "defaults" whose "origin" is not shipped, own, or stored.`);
    }
    store.defaults.push({ recipe: record.recipe as string, name: record.name as string, origin: record.origin as VariantOrigin });
  });
  if (parsed.harnesses !== undefined) {
    store.harnesses = parsed.harnesses;
  }
  return store;
}

/** Reads the variant store file at `file`. A missing file holds nothing; any other read failure throws. */
export function readVariantStore(file: string): VariantStore {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return emptyVariantStore();
    }
    throw error;
  }
  return parseVariantStore(text, file);
}
