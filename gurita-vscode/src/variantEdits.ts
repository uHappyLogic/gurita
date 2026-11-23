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
// model control alone, every other line shown as its text, read-only. Each line is also posted
// with the row it is drawn as (`lineRow`): a line of a known harness whose first command runs a
// `gurita:` skill is drawn as the skill's name, marked interactive when the line is not headless,
// with its harness beside it, and every other line keeps its text. The named single-task lines
// are listed apart, by `settingsLines`, and edited as variants are, a line being named by its
// recipe: a duplicate is a stored line of a new name, a rename of a shipped or own line writes a
// stored copy of the new name standing in for it in its place, a delete hides it, a reset shows it
// again, and a new name may be no name a recipe or line carries, since the looped run, the rule
// file, and the override list name a line by it alone. This module imports nothing from `vscode`.

import { HARNESSES, Harness as CheckedHarness } from './harnessCheck';
import { LineValues, readLine, readSkill, replaceEffort, replaceModel } from './lineValues';
import {
  Recipe,
  Variant,
  copiedRecipe,
  defaultVariant,
  isHeadless,
  overlayVariantStore,
  pickedVariant,
  sameCopies,
  variantOrigin,
} from './recipes';
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
    if (!found.some((each) => each.name === ref.name && each.origin === ref.origin)) {
      found.push({ name: ref.name, origin: ref.origin });
    }
  };
  for (const each of store.variants) {
    if (each.recipe === recipe && each.copies !== undefined && copiedRecipe(each) === undefined) {
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

/**
 * The row one line is drawn as in the settings view when it runs a `gurita:` skill on a known
 * harness: the skill's name, whether the line is interactive rather than headless, and the key of
 * the harness it runs on.
 */
export interface LineRow {
  skill: string;
  interactive: boolean;
  harness: CheckedHarness['key'];
}

/**
 * The row `line` is drawn as: for a `claude`, `agy`, or `codex` line whose first command runs a
 * `gurita:` skill, the skill's name, whether the line is interactive, as a line carrying the
 * `# interactive` mark is, and its harness; undefined for every other line, a shell step, the slot
 * line `<single-task line>`, and a command the extension does not know included, which is drawn as
 * its text.
 */
export function lineRow(line: string): LineRow | undefined {
  const read = readLine(line);
  const skill = readSkill(line);
  if (read === undefined || skill === undefined) {
    return undefined;
  }
  const harness = HARNESSES.find((each) => each.cli === read.harness)?.key;
  if (harness === undefined) {
    return undefined;
  }
  return { skill, interactive: !isHeadless(line), harness };
}

/** One variant as the settings view lists it, with what it may be reset to. */
export interface SettingsVariant extends VariantTarget {
  /** The variant's lines as written. */
  lines: string[];
  /** The line editor each of its lines gets, in the lines' order, null for a line shown read-only. */
  editors: (LineEditor | null)[];
  /** The row each of its lines is drawn as, in the lines' order, null for a line drawn as its text. */
  rows: (LineRow | null)[];
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
      rows: variant.lines.map((line) => lineRow(line) ?? null),
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
 * variant it stood in for, in the recipe it copies from, and a shipped or own variant gets a record
 * hiding it. Deleting the
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
  const from = hide?.recipe ?? recipe.name;
  if (hide !== undefined && !store.hidden.some((each) => each.recipe === from && each.name === hide.name && each.origin === hide.origin)) {
    store.hidden.push({ recipe: from, name: hide.name, origin: hide.origin });
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
  const hidden = store.hidden.filter((each) => !(each.recipe === recipeName && each.name === original.name && each.origin === original.origin));
  if (variants.length === store.variants.length && hidden.length === store.hidden.length) {
    throw new VariantEditError(`No stored copy or hiding record stands for the ${original.origin} variant ${original.name} of the recipe ${recipeName}.`);
  }
  store.variants = variants;
  store.hidden = hidden;
  writeVariantStore(storeFile, store);
}

/**
 * One named single-task line as the settings view lists it: the line's name, its recipe's name,
 * the variant the line is, its one line with the line editor it gets, and, for a stored copy of a
 * shipped or own line, the original a reset shows again, named with the recipe it belongs to.
 */
export interface SettingsLine {
  /** The line's name, its recipe's `###` heading or the name the store gives it. */
  name: string;
  group: Recipe['group'];
  /** The variant of the recipe the line is. */
  variant: VariantTarget;
  /** The line as written. */
  line: string;
  editor: LineEditor | null;
  /** The row the line is drawn as, null when it is drawn as its text. */
  row: LineRow | null;
  /** Whether it is the variant the looped run takes for the name, its recipe's default. */
  isDefault: boolean;
  /** The shipped or own line a stored copy stands in for, which its reset shows again. */
  reset?: { recipe: string; original: ReadVariantRef };
}

/** A shipped or own single-task line a hiding record hides and no stored copy stands in for, which a reset shows again. */
export interface HiddenLine {
  /** The recipe the hidden line belongs to, its name. */
  name: string;
  original: ReadVariantRef;
}

/** The named single-task lines the settings view lists, and the shipped and own lines deleted there. */
export interface SettingsLines {
  lines: SettingsLine[];
  hidden: HiddenLine[];
}

/** The original a listed stored copy of a line stands in for, named with the recipe it belongs to. */
function lineOriginal(recipe: string, variant: Variant): { recipe: string; original: ReadVariantRef } | undefined {
  if (variant.copies === undefined) {
    return undefined;
  }
  return { recipe: variant.copies.recipe ?? recipe, original: { name: variant.copies.name, origin: variant.copies.origin } };
}

/**
 * The named single-task lines the settings view lists, out of `base`, the list the two Markdown
 * files yield, with the store `store`, read from `file`, laid over it: every recipe whose default
 * is a single-task line, in the merged order, the lines only the store holds after them, each
 * single-task variant of it listed as one line with its editor, the default marked. A shipped and an
 * own line are listed alike, an own one as an own item. The shipped and own lines a hiding record
 * hides, and no stored copy stands in for, are listed apart, for their resets.
 */
export function settingsLines(base: readonly Recipe[], store: VariantStore, file: string): SettingsLines {
  const overlaid = overlayVariantStore(base, store, file);
  const lines: SettingsLine[] = [];
  for (const recipe of overlaid) {
    const standing = defaultVariant(recipe);
    if (!standing.singleTask) {
      continue;
    }
    for (const variant of recipe.variants.filter((each) => each.singleTask)) {
      const reset = lineOriginal(recipe.name, variant);
      lines.push({
        name: recipe.name,
        group: recipe.group,
        variant: variantTarget(variant),
        line: variant.lines[0],
        editor: lineEditor(variant.lines[0]) ?? null,
        row: lineRow(variant.lines[0]) ?? null,
        isDefault: variant === standing,
        ...(reset === undefined ? {} : { reset }),
      });
    }
  }
  const hidden: HiddenLine[] = [];
  for (const recipe of base) {
    const shown = overlaid.find((each) => each.name === recipe.name) ?? recipe;
    if (!defaultVariant(shown).singleTask) {
      continue;
    }
    for (const each of store.hidden) {
      const original = recipe.variants.find((variant) => variant.name === each.name && variantOrigin(variant) === each.origin);
      if (
        each.recipe !== recipe.name ||
        original === undefined ||
        !original.singleTask ||
        hidden.some((kept) => kept.name === recipe.name && kept.original.name === each.name && kept.original.origin === each.origin) ||
        lines.some(
          (line) => line.reset?.recipe === recipe.name && line.reset.original.name === each.name && line.reset.original.origin === each.origin,
        )
      ) {
        continue;
      }
      hidden.push({ name: recipe.name, original: { name: each.name, origin: each.origin } });
    }
  }
  return { lines, hidden };
}

/** Every name a recipe or line carries, in the files or the store, which no new line may take. */
export function lineNames(base: readonly Recipe[], store: VariantStore, file: string): string[] {
  return [...base.map((recipe) => recipe.name), ...overlayVariantStore(base, store, file).map((recipe) => recipe.name)].filter(
    (name, index, all) => all.indexOf(name) === index,
  );
}

/** Refuses a new line name that is empty or that a recipe or line already carries. */
function checkLineName(base: readonly Recipe[], store: VariantStore, file: string, name: string): void {
  if (name.trim() === '') {
    throw new VariantEditError('A single-task line needs a name.');
  }
  if (lineNames(base, store, file).includes(name)) {
    throw new VariantEditError(`A recipe or line is already named ${name}.`);
  }
}

/** The line `target` names among the single-task variants of the recipe `recipe` lists, refused when it lists none. */
function findLine(recipe: Recipe, target: VariantTarget): Variant {
  const variant = find(recipe, target);
  if (!variant.singleTask || !defaultVariant(recipe).singleTask) {
    throw new VariantEditError(`The ${describe(target)} of the recipe ${recipe.name} is no named single-task line.`);
  }
  return variant;
}

/**
 * Duplicates the single-task line `target` of the line named `lineName` as a new line named
 * `name`: a stored variant of a recipe of that name, holding the same line, listed after every
 * recipe the files hold. A name a recipe or line already carries is refused.
 */
export function duplicateLine(storeFile: string, base: readonly Recipe[], lineName: string, target: VariantTarget, name: string): void {
  const { store, recipe } = load(storeFile, base, lineName);
  const source = findLine(recipe, target);
  checkLineName(base, store, storeFile, name);
  store.variants.push({ recipe: name, name, lines: [...source.lines] });
  writeVariantStore(storeFile, store);
}

/**
 * Renames the single-task line `target` of the line named `lineName` to `name`: a shipped or own
 * line gets a stored copy, a line of that name, standing in for it in its place in the list, and a
 * stored line, a stored copy included, is renamed in the store. A name a recipe or line already
 * carries is refused; renaming a line to the name it has writes nothing.
 */
export function renameLine(storeFile: string, base: readonly Recipe[], lineName: string, target: VariantTarget, name: string): void {
  const { store, recipe } = load(storeFile, base, lineName);
  const variant = findLine(recipe, target);
  if (name === lineName) {
    return;
  }
  checkLineName(base, store, storeFile, name);
  if (variant.stored) {
    const stored = record(store, recipe.name, variant);
    store.variants = store.variants.filter((each) => each === stored || !isRecordOf(each, recipe.name, variant));
    if (stored.copies !== undefined && stored.copies.recipe === undefined) {
      stored.copies = { ...stored.copies, recipe: recipe.name };
    }
    stored.recipe = name;
    stored.name = name;
    if (stored.copies?.recipe === name) {
      delete stored.copies.recipe;
    }
  } else {
    store.variants.push({
      recipe: name,
      name,
      lines: [...variant.lines],
      copies: { name: variant.name, origin: variantOrigin(variant) as 'shipped' | 'own', recipe: recipe.name },
    });
  }
  writeVariantStore(storeFile, store);
}

/**
 * Deletes the single-task line `target` of the line named `lineName`, as `deleteVariant` deletes a
 * variant: a stored line leaves the store, a stored copy also hiding the line it stood in for, and
 * a shipped or own line gets a record hiding it.
 */
export function deleteLine(storeFile: string, base: readonly Recipe[], lineName: string, target: VariantTarget): void {
  const { recipe } = load(storeFile, base, lineName);
  findLine(recipe, target);
  deleteVariant(storeFile, base, lineName, target);
}

/**
 * Resets the shipped or own single-task line `original` of the recipe `recipeName`: every stored
 * copy standing in for it, under its own name or another, and every record hiding it leaves the
 * store, and it shows again as its file holds it. A line no copy or record stands for is refused.
 */
export function resetLine(storeFile: string, recipeName: string, original: ReadVariantRef): void {
  const store = readVariantStore(storeFile);
  const standsFor = (each: StoredVariant): boolean =>
    each.copies !== undefined &&
    each.copies.name === original.name &&
    each.copies.origin === original.origin &&
    (copiedRecipe(each) ?? each.recipe) === recipeName;
  const variants = store.variants.filter((each) => !standsFor(each));
  const hidden = store.hidden.filter((each) => !(each.recipe === recipeName && each.name === original.name && each.origin === original.origin));
  if (variants.length === store.variants.length && hidden.length === store.hidden.length) {
    throw new VariantEditError(`No stored copy or hiding record stands for the ${original.origin} line ${original.name} of the recipe ${recipeName}.`);
  }
  store.variants = variants;
  store.hidden = hidden;
  writeVariantStore(storeFile, store);
}
