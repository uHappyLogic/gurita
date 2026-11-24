// The per-user variant store: a JSON file of the extension's own, `~/.gurita/variants.json`, beside
// the default own recipe file, read with `JSON.parse` and laid over the recipes the Markdown reader
// yields wherever the extension reads recipes. The extension is its only writer and the own recipe
// file stays read-only to it. The file is one object of four parts, each optional and a missing
// one holding nothing:
//
//   `variants` — the stored variants, in order, each `{ "recipe", "name", "lines" }`, a recipe
//     name, a variant name, and the variant's literal lines as an array of strings, and, for a
//     stored copy, `"copies": { "name", "origin" }` naming the shipped, project, or own variant it
//     stands in for, `origin` being `shipped`, `project`, or `own`, and, for a stored copy of a named single-task line
//     renamed in the settings view, `"recipe"` in it too, naming the recipe the copied variant
//     belongs to, the copy then standing in for it as a line of the copy's own recipe name, and,
//     for a stored variant made from another variant, a duplicate or a `custom N` a line edit adds,
//     `"from": { "name", "origin" }` naming the variant it was made from, `origin` being
//     `shipped`, `project`, `own`, or `stored`, with `"recipe"` in it too where that variant belongs to
//     another recipe, the variant whose lines a reset returns it to;
//   `hidden` — the records that hide a variant, each `{ "recipe", "name", "origin" }`, `origin`
//     being `shipped`, `project`, or `own`;
//   `defaults` — each recipe's picked default, `{ "recipe", "name", "origin" }`, `origin` being
//     `shipped`, `project`, `own`, or `stored`;
//   `harnesses` — the part set aside for harness values, kept as read here, each harness's
//     enabled state and the overlay on its model and effort lists read and written in it by
//     `harnessSettings.ts`.
//
// The origin `project` names a variant of the project's recipe file, `gurita_recipes.md` at the
// project root. A missing file holds nothing; a file that is not in this form is refused with an
// error naming it.
// How the records are laid over the recipe list is the recipe reader's (`overlayVariantStore` in
// `recipes.ts`), and the edits the settings view makes are `variantEdits.ts`'s; this module reads
// the file and writes it whole, the harness part written back as read. It imports nothing from
// `vscode`.

import * as fs from 'node:fs';
import * as path from 'node:path';

/** The default path of the variant store, under the person's home directory beside the default own recipe file. */
export const DEFAULT_VARIANT_STORE_FILE = '~/.gurita/variants.json';

/** Where a variant read from a file comes from: the shipped file, the project's recipe file, or the person's own recipe file. */
export type ReadOrigin = 'shipped' | 'project' | 'own';

/** The origins a variant read from a file may carry, in the order the reader merges them. */
export const READ_ORIGINS: readonly ReadOrigin[] = ['shipped', 'project', 'own'];

/** Where a variant comes from: the shipped file, the project's recipe file, the person's own recipe file, or the variant store. */
export type VariantOrigin = ReadOrigin | 'stored';

/** Every origin a variant may carry. */
const VARIANT_ORIGINS: readonly VariantOrigin[] = [...READ_ORIGINS, 'stored'];

/** A variant of one recipe, named by its variant name and where it comes from. */
export interface VariantRef {
  name: string;
  origin: VariantOrigin;
}

/** A variant read from a file, which a stored copy may stand in for and a hiding record may hide. */
export interface ReadVariantRef {
  name: string;
  origin: ReadOrigin;
  /**
   * The recipe the variant belongs to, named only where it differs from the recipe of the stored
   * copy standing in for it: a renamed single-task line, listed under its new name.
   */
  recipe?: string;
}

/** The variant a stored variant was made from, named with its recipe where that is another one. */
export interface SourceRef {
  name: string;
  origin: VariantOrigin;
  /** The recipe the variant belongs to, named only where it differs from the stored variant's own. */
  recipe?: string;
}

/** One stored variant: a further variant of its recipe, or, carrying `copies`, a stored copy. */
export interface StoredVariant {
  recipe: string;
  name: string;
  lines: string[];
  /** The shipped, project, or own variant this stored copy stands in for, keeping its place. */
  copies?: ReadVariantRef;
  /** The variant this stored variant was made from, whose lines a reset returns it to. */
  from?: SourceRef;
}

/** One record hiding a shipped, project, or own variant of a recipe. */
export interface HiddenVariant {
  recipe: string;
  name: string;
  origin: ReadOrigin;
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
      if (
        !isRecord(copies) ||
        typeof copies.name !== 'string' ||
        !isOrigin(copies.origin, READ_ORIGINS) ||
        (copies.recipe !== undefined && typeof copies.recipe !== 'string')
      ) {
        throw new VariantStoreError(
          `The variant store ${file} holds a record ${index + 1} in "variants" whose "copies" does not name a shipped, project, or own variant.`,
        );
      }
      stored.copies = {
        name: copies.name,
        origin: copies.origin as ReadOrigin,
        ...(copies.recipe === undefined || copies.recipe === stored.recipe ? {} : { recipe: copies.recipe as string }),
      };
    }
    if (record.from !== undefined) {
      const from = record.from;
      if (
        !isRecord(from) ||
        typeof from.name !== 'string' ||
        !isOrigin(from.origin, VARIANT_ORIGINS) ||
        (from.recipe !== undefined && typeof from.recipe !== 'string')
      ) {
        throw new VariantStoreError(
          `The variant store ${file} holds a record ${index + 1} in "variants" whose "from" does not name a shipped, project, own, or stored variant.`,
        );
      }
      stored.from = {
        name: from.name,
        origin: from.origin as VariantOrigin,
        ...(from.recipe === undefined || from.recipe === stored.recipe ? {} : { recipe: from.recipe as string }),
      };
    }
    store.variants.push(stored);
  });
  part(parsed, 'hidden', file).forEach((raw, index) => {
    const record = stringFields(raw, 'hidden', index, ['recipe', 'name'], file);
    if (!isOrigin(record.origin, READ_ORIGINS)) {
      throw new VariantStoreError(`The variant store ${file} holds a record ${index + 1} in "hidden" whose "origin" is not shipped, project, or own.`);
    }
    store.hidden.push({ recipe: record.recipe as string, name: record.name as string, origin: record.origin as ReadOrigin });
  });
  part(parsed, 'defaults', file).forEach((raw, index) => {
    const record = stringFields(raw, 'defaults', index, ['recipe', 'name'], file);
    if (!isOrigin(record.origin, VARIANT_ORIGINS)) {
      throw new VariantStoreError(`The variant store ${file} holds a record ${index + 1} in "defaults" whose "origin" is not shipped, project, own, or stored.`);
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

/** The store's text as written: one JSON object of its parts, the harness part only when it holds one. */
export function serializeVariantStore(store: VariantStore): string {
  const written: Record<string, unknown> = {
    variants: store.variants.map((each) => ({
      recipe: each.recipe,
      name: each.name,
      lines: [...each.lines],
      ...(each.copies === undefined
        ? {}
        : {
            copies: {
              name: each.copies.name,
              origin: each.copies.origin,
              ...(each.copies.recipe === undefined || each.copies.recipe === each.recipe ? {} : { recipe: each.copies.recipe }),
            },
          }),
      ...(each.from === undefined
        ? {}
        : {
            from: {
              name: each.from.name,
              origin: each.from.origin,
              ...(each.from.recipe === undefined || each.from.recipe === each.recipe ? {} : { recipe: each.from.recipe }),
            },
          }),
    })),
    hidden: store.hidden.map((each) => ({ recipe: each.recipe, name: each.name, origin: each.origin })),
    defaults: store.defaults.map((each) => ({ recipe: each.recipe, name: each.name, origin: each.origin })),
  };
  if (store.harnesses !== undefined) {
    written.harnesses = store.harnesses;
  }
  return `${JSON.stringify(written, null, 2)}\n`;
}

/**
 * Writes the whole store to `file`, creating its directory when missing: the text goes to a
 * temporary file beside it, renamed into place, so a reader never sees a half-written store.
 */
export function writeVariantStore(file: string, store: VariantStore): void {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const temporary = path.join(dir, `.${path.basename(file)}.${process.pid}.tmp`);
  try {
    fs.writeFileSync(temporary, serializeVariantStore(store));
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}
