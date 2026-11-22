// The edits the settings view makes, each a function that reads the per-user variant store file
// afresh, applies one edit to it, and writes the whole store back (`writeVariantStore`); the
// extension is the store's only writer, and no edit reads or writes the person's own recipe file or
// the shipped one. Each edit but the reset, which reads the store alone, is given the recipe list
// the two Markdown files yield before the store is laid over it (`readRecipes` with no store
// file), lays the store over it as the reader does, and names its variant as that list shows it,
// by its name, where it comes from, and, for a stored copy, the variant it stands in for.
//
// A shipped or own variant is never changed in its file: changing one of its lines, or renaming
// it, writes a stored copy that stands in for it and keeps its place in the recipe's order, and
// deleting it writes a record hiding it; resetting it removes the copy or the record, and the
// variant shows again as its file holds it. A stored variant is changed, renamed, or removed in the
// store itself, and deleting a stored copy removes it and hides the variant it stood in for, so
// the deleted variant stays gone until it is reset. A duplicate is a further stored variant, listed
// after the recipe's others. A picked default is stored as the variant it names, a stored copy's
// pick as the variant the copy stands in for; renaming the picked default carries the pick to the
// new name, and only deleting the picked default drops the pick, the recipe then falling back to
// its first listed variant. An edit that cannot be made is refused with a `VariantEditError`,
// nothing written. The list the settings view draws its variant edits from is
// `settingsRecipes`'s: every recipe but the named single-task lines, each with its listed
// variants, its default marked, and the variants a hiding record hides, and each variant's lines
// with the line editor each one gets (`lineEditor`): only a `claude` or `agy` line carrying both
// `--model` and `--effort` gets model and effort controls, and a `codex` line carrying `-m` its
// model control alone, every other line shown as its text, read-only. This module imports nothing
// from `vscode`.

import { HARNESSES, Harness as CheckedHarness } from './harnessCheck';
import { LineValues, readLine, replaceEffort, replaceModel } from './lineValues';
import { Recipe, Variant, defaultVariant, overlayVariantStore, pickedVariant, sameCopies, variantOrigin } from './recipes';
import { ReadVariantRef, StoredVariant, VariantOrigin, VariantRef, VariantStore, readVariantStore, writeVariantStore } from './variantStore';

/** A variant as the recipe list shows it: its name, where it comes from, and, for a stored copy, the variant it stands in for. */
export interface VariantTarget {
  name: string;
  origin: VariantOrigin;
  copies?: ReadVariantRef;
}

/** An edit of the variant store that cannot be made, nothing written. */
export class VariantEditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VariantEditError';
  }
}

/** The target naming a listed variant. */
export function variantTarget(variant: Variant): VariantTarget {
  return {
    name: variant.name,
    origin: variantOrigin(variant),
    ...(variant.copies === undefined ? {} : { copies: { ...variant.copies } }),
  };
}

/**
 * The shipped and own variants of each recipe that a stored copy or a hiding record stands for in
 * `store`, each named once in the store's order: the variants a reset shows again.
 */
export function resettableVariants(store: VariantStore, recipe: string): ReadVariantRef[] {
  const found: ReadVariantRef[] = [];
  const add = (ref: ReadVariantRef): void => {
    if (!found.some((each) => sameCopies(each, ref))) {
      found.push({ name: ref.name, origin: ref.origin });
    }
  };
  for (const each of store.variants) {
    if (each.recipe === recipe && each.copies !== undefined) {
      add(each.copies);
    }
  }
  for (const each of store.hidden) {
    if (each.recipe === recipe) {
      add(each);
    }
  }
  return found;
}

/**
 * The line editor one line of a variant gets in the settings view: the key of the harness whose
 * lists its dropdowns offer, the model the line carries, and the effort it carries, left out for a
 * Codex line, which gets its model control alone.
 */
export interface LineEditor {
  harness: CheckedHarness['key'];
  model: string;
  effort?: string;
}

/**
 * The line editor `line` gets: model and effort controls for a `claude` or `agy` line carrying
 * both `--model` and `--effort`, a model control alone for a `codex` line carrying `-m`, and none,
 * the line shown as its text, read-only, for every other line, a line of a known harness without
 * both flags included.
 */
export function lineEditor(line: string): LineEditor | undefined {
  const read = readLine(line);
  if (read === undefined || read.model === undefined) {
    return undefined;
  }
  const harness = HARNESSES.find((each) => each.cli === read.harness)?.key;
  if (harness === undefined) {
    return undefined;
  }
  if (read.harness === 'codex') {
    return { harness, model: read.model };
  }
  return read.effort === undefined ? undefined : { harness, model: read.model, effort: read.effort };
}

/** One variant as the settings view lists it, with what it may be reset to. */
export interface SettingsVariant extends VariantTarget {
  /** The variant's lines as written. */
  lines: string[];
  /** The line editor each of its lines gets, in the lines' order, null for a line shown read-only. */
  editors: (LineEditor | null)[];
  /** Whether it is its recipe's default, picked or, while no pick stands, its first listed variant. */
  isDefault: boolean;
}

/** One recipe as the settings view lists it: its variants in order and the variants a hiding record hides. */
export interface SettingsRecipe {
  name: string;
  group: Recipe['group'];
  /** Whether one of the buttons outside the chains runs it by its fixed name, its default the variant the button runs. */
  fixed: boolean;
  /** Its listed variants, in the recipe's order, the store laid over them. */
  variants: SettingsVariant[];
  /** The shipped and own variants a hiding record hides and no stored copy stands in for, each a reset shows again. */
  hidden: ReadVariantRef[];
}

/**
 * The recipes the settings view lists, out of `base`, the list the two Markdown files yield, with
 * the store `store`, read from `file`, laid over it: every recipe in the merged order, the ones only
 * the store holds after them, each with its listed variants, its default marked, and the variants
 * hidden by a record. A recipe every variant of which is hidden stays listed, so its variants can
 * be reset. The named single-task lines, whose default holds one headless `<Task Title>` line, are
 * left out, and so is no recipe for its stage or for a disabled harness. `fixed` names the recipes
 * the fixed-name buttons run.
 */
export function settingsRecipes(base: readonly Recipe[], store: VariantStore, file: string, fixed: readonly string[]): SettingsRecipe[] {
  const overlaid = overlayVariantStore(base, store, file);
  const names = [...base.map((recipe) => recipe.name), ...overlaid.map((recipe) => recipe.name)].filter(
    (name, index, all) => all.indexOf(name) === index,
  );
  const listed: SettingsRecipe[] = [];
  for (const name of names) {
    const recipe = overlaid.find((each) => each.name === name);
    const original = base.find((each) => each.name === name);
    const shown = recipe ?? original;
    if (shown === undefined || defaultVariant(shown).singleTask) {
      continue;
    }
    const standing = recipe === undefined ? undefined : defaultVariant(recipe);
    const variants = (recipe?.variants ?? []).map((variant) => ({
      ...variantTarget(variant),
      lines: [...variant.lines],
      editors: variant.lines.map((line) => lineEditor(line) ?? null),
      isDefault: variant === standing,
    }));
    const hidden = resettableVariants(store, name).filter(
      (ref) => !variants.some((variant) => variant.copies !== undefined && sameCopies(variant.copies, ref)),
    );
    listed.push({ name, group: shown.group, fixed: fixed.includes(name), variants, hidden });
  }
  return listed;
}

/** The store and the recipe list it gives, read afresh, with the one recipe an edit names. */
interface Edited {
  store: VariantStore;
  recipe: Recipe;
}

function load(storeFile: string, base: readonly Recipe[], recipeName: string): Edited {
  const store = readVariantStore(storeFile);
  const recipe = overlayVariantStore(base, store, storeFile).find((each) => each.name === recipeName);
  if (recipe === undefined) {
    throw new VariantEditError(`No recipe is named ${recipeName}.`);
  }
  return { store, recipe };
}

function describe(target: VariantTarget): string {
  return `${target.origin} variant ${target.name}`;
}

/** The listed variant `target` names in the recipe, refused when it lists none. */
function find(recipe: Recipe, target: VariantTarget): Variant {
  const found = recipe.variants.find(
    (each) => each.name === target.name && variantOrigin(each) === target.origin && sameCopies(each.copies, target.copies),
  );
  if (found === undefined) {
    throw new VariantEditError(`The recipe ${recipe.name} lists no ${describe(target)}.`);
  }
  return found;
}

/** The stored record a stored variant of the recipe was read from: the first of its name standing in for the same variant. */
function record(store: VariantStore, recipe: string, variant: Variant): StoredVariant {
  const found = store.variants.find((each) => each.recipe === recipe && each.name === variant.name && sameCopies(each.copies, variant.copies));
  if (found === undefined) {
    throw new VariantEditError(`The variant store holds no stored variant ${variant.name} of the recipe ${recipe}.`);
  }
  return found;
}

/** Whether a stored record is one the variant was read from, or a repeat the reader leaves unread. */
function isRecordOf(each: StoredVariant, recipe: string, variant: Variant): boolean {
  return each.recipe === recipe && each.name === variant.name && sameCopies(each.copies, variant.copies);
}

/** The pick naming a variant: a stored copy is picked as the variant it stands in for. */
function pickRef(variant: Variant): VariantRef {
  return variant.copies !== undefined ? { ...variant.copies } : { name: variant.name, origin: variantOrigin(variant) };
}

function setPick(store: VariantStore, recipe: string, pick: VariantRef | undefined): void {
  store.defaults = store.defaults.filter((each) => each.recipe !== recipe);
  if (pick !== undefined) {
    store.defaults.push({ recipe, name: pick.name, origin: pick.origin });
  }
}

/** Refuses a new variant name that is empty or that another listed variant of the recipe carries. */
function checkName(recipe: Recipe, name: string, except?: Variant): void {
  if (name.trim() === '') {
    throw new VariantEditError(`A variant of the recipe ${recipe.name} needs a name.`);
  }
  if (recipe.variants.some((each) => each !== except && each.name === name)) {
    throw new VariantEditError(`The recipe ${recipe.name} already has a variant named ${name}.`);
  }
}

/** Duplicates the variant `target` under `name`, as a further stored variant listed after the recipe's others. */
export function duplicateVariant(storeFile: string, base: readonly Recipe[], recipeName: string, target: VariantTarget, name: string): void {
  const { store, recipe } = load(storeFile, base, recipeName);
  const source = find(recipe, target);
  checkName(recipe, name);
  store.variants.push({ recipe: recipe.name, name, lines: [...source.lines] });
  writeVariantStore(storeFile, store);
}

/**
 * Renames the variant `target` to `name`: a stored variant is renamed in the store, and a shipped
 * or own one gets a stored copy of that name standing in for it. A pick of the renamed variant
 * goes with it to the new name. Renaming a variant to the name it has writes nothing.
 */
export function renameVariant(storeFile: string, base: readonly Recipe[], recipeName: string, target: VariantTarget, name: string): void {
  const { store, recipe } = load(storeFile, base, recipeName);
  const variant = find(recipe, target);
  if (name === variant.name) {
    return;
  }
  checkName(recipe, name, variant);
  const picked = pickedVariant(recipe) === variant;
  let renamed: Variant;
  if (variant.stored) {
    const stored = record(store, recipe.name, variant);
    store.variants = store.variants.filter((each) => each === stored || !isRecordOf(each, recipe.name, variant));
    stored.name = name;
    renamed = { ...variant, name };
  } else {
    const copies: ReadVariantRef = { name: variant.name, origin: variantOrigin(variant) as 'shipped' | 'own' };
    store.variants.push({ recipe: recipe.name, name, lines: [...variant.lines], copies });
    renamed = { ...variant, name, stored: true, copies };
  }
  if (picked) {
    setPick(store, recipe.name, pickRef(renamed));
  }
  writeVariantStore(storeFile, store);
}

/**
 * Deletes the variant `target`: a stored variant leaves the store, a stored copy also hiding the
 * variant it stood in for, and a shipped or own variant gets a record hiding it. Deleting the
 * picked default drops the pick, the recipe falling back to its first listed variant.
 */
export function deleteVariant(storeFile: string, base: readonly Recipe[], recipeName: string, target: VariantTarget): void {
  const { store, recipe } = load(storeFile, base, recipeName);
  const variant = find(recipe, target);
  const picked = pickedVariant(recipe) === variant;
  if (variant.stored) {
    store.variants = store.variants.filter((each) => !isRecordOf(each, recipe.name, variant));
  }
  const hide: ReadVariantRef | undefined = variant.stored
    ? variant.copies
    : { name: variant.name, origin: variantOrigin(variant) as 'shipped' | 'own' };
  if (hide !== undefined && !store.hidden.some((each) => each.recipe === recipe.name && sameCopies(each, hide))) {
    store.hidden.push({ recipe: recipe.name, name: hide.name, origin: hide.origin });
  }
  if (picked) {
    setPick(store, recipe.name, undefined);
  }
  writeVariantStore(storeFile, store);
}

/**
 * Replaces the model or the effort that line `index` of the variant `target` carries with `value`,
 * never inserting text into a line: a stored variant's line is changed in the store, and a shipped
 * or own variant gets a stored copy of its name, holding the changed line, standing in for it.
 * A line that carries no such value, or an empty value, is refused; a value the line already
 * carries writes nothing.
 */
export function replaceLineValue(
  storeFile: string,
  base: readonly Recipe[],
  recipeName: string,
  target: VariantTarget,
  index: number,
  kind: keyof Omit<LineValues, 'harness'>,
  value: string,
): void {
  const { store, recipe } = load(storeFile, base, recipeName);
  const variant = find(recipe, target);
  const line = variant.lines[index];
  if (line === undefined) {
    throw new VariantEditError(`The ${describe(target)} of the recipe ${recipe.name} has no line ${index + 1}.`);
  }
  if (value === '') {
    throw new VariantEditError(`An empty ${kind} cannot replace a line's ${kind}.`);
  }
  const changed = kind === 'model' ? replaceModel(line, value) : replaceEffort(line, value);
  if (changed === undefined) {
    throw new VariantEditError(`Line ${index + 1} of the ${describe(target)} of the recipe ${recipe.name} carries no ${kind}.`);
  }
  if (changed === line) {
    return;
  }
  const lines = [...variant.lines];
  lines[index] = changed;
  if (variant.stored) {
    record(store, recipe.name, variant).lines = lines;
  } else {
    store.variants.push({ recipe: recipe.name, name: variant.name, lines, copies: { name: variant.name, origin: variantOrigin(variant) as 'shipped' | 'own' } });
  }
  writeVariantStore(storeFile, store);
}

/** Picks the variant `target` as its recipe's default, in place of any pick standing. */
export function pickDefault(storeFile: string, base: readonly Recipe[], recipeName: string, target: VariantTarget): void {
  const { store, recipe } = load(storeFile, base, recipeName);
  setPick(store, recipe.name, pickRef(find(recipe, target)));
  writeVariantStore(storeFile, store);
}

/**
 * Resets the shipped or own variant `original` of the recipe `recipeName`: every stored copy
 * standing in for it and every record hiding it leaves the store, and it shows again as its file
 * holds it, in a recipe every variant of which was hidden too. A variant no copy or record stands
 * for is refused.
 */
export function resetVariant(storeFile: string, recipeName: string, original: ReadVariantRef): void {
  const store = readVariantStore(storeFile);
  const variants = store.variants.filter((each) => !(each.recipe === recipeName && sameCopies(each.copies, original)));
  const hidden = store.hidden.filter((each) => !(each.recipe === recipeName && sameCopies(each, original)));
  if (variants.length === store.variants.length && hidden.length === store.hidden.length) {
    throw new VariantEditError(`No stored copy or hiding record stands for the ${original.origin} variant ${original.name} of the recipe ${recipeName}.`);
  }
  store.variants = variants;
  store.hidden = hidden;
  writeVariantStore(storeFile, store);
}
