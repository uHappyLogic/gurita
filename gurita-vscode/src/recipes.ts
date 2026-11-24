// The recipe reader. A recipe is a `###` heading, its name, and one or more named variants, each a
// literal block of lines: every `####` sub-heading beneath the `###` heading names a variant, its
// lines those of the first fenced block beneath the sub-heading, and a recipe with no `####`
// sub-heading is a recipe of one variant, named `default` (`ONE_BLOCK_VARIANT`), its lines those
// of the first fenced block beneath the `###` heading, the named single-task lines included, so
// that every such recipe opens on a variant called `default` while a recipe of several `####`
// variants keeps the names written. Once a recipe holds a `####` sub-heading only the
// blocks beneath its sub-headings are read, and of a variant name repeated within one recipe the
// first is kept. The same form is read in the shipped file and in a person's own file. The shipped
// recipe file, `shipped_recipes.md`, yields only the recipes under its one recipe section, its
// `## Recipes` heading, each in the shipped group, each chain shipped once and not once per
// harness; a person's own recipe file is a flat list of `###` recipes. An own recipe carrying a
// shipped recipe's name replaces neither that recipe nor any of its variants:
// its variants join the shipped recipe, listed after the shipped variants under their own names and
// marked as the person's own, an own variant carrying a shipped variant's name kept as a second
// entry beside it; every other own recipe is listed after the shipped recipes, which keep the
// shipped file's order, in the own file's order.
// Over that merged list the per-user variant store (`variantStore.ts`) is laid wherever the
// extension reads recipes: a stored copy stands in for the shipped or own variant it copies and
// keeps its place in the recipe's order, a hidden variant is left out, and the further stored
// variants are listed after the recipe's other variants, in the store's order, of a stored
// variant repeated within one recipe, the same name standing in for the same variant or for none,
// the first kept; a stored copy of a named single-task line renamed in the settings view stands in
// for the line it copies as a recipe of its new name, directly after the recipe it copies from;
// stored variants of a recipe the files do not hold
// form a recipe of their own, listed after every other in the own group, and a recipe every
// variant of which is left out is dropped. A recipe's default is its picked variant, the store's
// pick standing for it when it names a listed variant, a pick of a copied variant meaning the copy
// standing in for it, and, while no picked default stands, its first variant in order, worked out
// afresh at each read and never written: the looped run's named single-task lines take the
// default, and the mission page's recipe buttons and the buttons that run a recipe by its fixed
// name take it while no dropdown selection is remembered for the recipe. Each variant is
// classified by its content alone: whether it is a single-task line, whether it is the looped
// recipe, and which known and unknown placeholders it holds. A recipe may also declare the one step
// of the workflow diagram it belongs to, by one `Stage: <step name>` line standing outside any fence
// between its `###` heading and its first fence or first `####` sub-heading, once for the whole
// recipe, in the shipped file and in a person's own file alike, the step named as the diagram
// labels its block (first review round, additional review round, derive tasks, execute tasks,
// follow up tasks, or finish); an own recipe that joins a shipped one keeps the shipped recipe's
// declaration. A recipe with no such line, with more than one,
// or with a name the reader does not know, `define` included, counts as undeclared. A mission page
// lists only the recipes that fit the step its diagram fills: those declaring that step, beside them
// the additional review round's when derive tasks is filled, or when first review round is while
// any question is open, and follow up tasks' when finish is, and every undeclared recipe whatever
// the step, while a page whose step could not be chosen lists every
// recipe; the page's other rules, the shipped recipes before the own group and the placeholders it
// cannot fill, hold within that list, and the buttons that run a recipe by its fixed name are untouched by
// it. In the shipped file every chain declares its one step and spans no other, each variant of an
// execution chain holding its `complete-all-tasks` line alone, while the button recipes and the
// single-task lines declare nothing. A mission page also leaves out every variant with at least
// one line on a harness the settings view disabled, a recipe so left with no variant losing its
// button and a button that runs a recipe by its fixed name so left standing with none, while the
// looped run's named single-task lines keep every variant. This module imports nothing from
// `vscode`.

import * as fs from 'node:fs';
import { Harness, readLine } from './lineValues';
import { ReadVariantRef, SourceRef, StoredVariant, VariantOrigin, VariantRef, VariantStore, readVariantStore } from './variantStore';
import type { WorkflowStep } from './workflow';

/** The one heading of the shipped recipe file whose `###` blocks are recipes. */
export const RECIPE_SECTION = 'Recipes';

/** `shipped` for a recipe of the shipped file, or `own` for an own recipe that joins no shipped one. */
export type RecipeGroup = 'shipped' | 'own';

/** The placeholders the extension knows, each written `<name>` in a line. */
export const KNOWN_PLACEHOLDERS: readonly string[] = [
  'path',
  'Task Title',
  'Short Title',
  'Alternative Id',
  'goal',
  'scope',
  'answer text',
  'issue description',
  'question',
  'note',
];

/** The name of the one variant a recipe of one block and no `####` sub-heading holds. */
export const ONE_BLOCK_VARIANT = 'default';

/** The looped recipe's slot line, standing alone as its last line. */
export const SLOT_LINE = '<single-task line>';

/** The marker opening a recipe's stage line, written at column 0 before the step's name. */
export const STAGE_MARKER = 'Stage:';

/**
 * The step names a stage line may give, each exactly as the workflow diagram labels its block,
 * with the diagram step it declares. `define` is no stage a recipe declares.
 */
export const STAGE_NAMES: ReadonlyMap<string, WorkflowStep> = new Map<string, WorkflowStep>([
  ['first review round', 'first-review'],
  ['additional review round', 'additional-review'],
  ['derive tasks', 'derive'],
  ['execute tasks', 'execute'],
  ['follow up tasks', 'follow-up'],
  ['finish', 'finish'],
]);

/** One variant of a recipe: a named, literal block of lines. */
export interface Variant {
  /** The `####` sub-heading's text, or `default` (`ONE_BLOCK_VARIANT`) for a recipe of one block. */
  name: string;
  /** Whether it comes from the person's own recipe file. */
  own: boolean;
  /** The path of the file the variant's lines came from. */
  file: string;
  /** The fenced block's non-blank lines, as written. */
  lines: string[];
  /** Exactly one line, headless, holding `<Task Title>`. */
  singleTask: boolean;
  /** Its last line is the slot line `<single-task line>`. */
  looped: boolean;
  /** The known placeholders its lines hold, by name, in order of first appearance. */
  knownPlaceholders: string[];
  /** The placeholder names its lines hold that the extension does not know, likewise. */
  unknownPlaceholders: string[];
  /** Set on a variant of the per-user variant store, which also counts as the person's own. */
  stored?: true;
  /** The shipped or own variant a stored copy stands in for. */
  copies?: ReadVariantRef;
  /** The variant a stored variant was made from, whose lines a reset returns it to. */
  from?: SourceRef;
}

export interface Recipe {
  /** The `###` heading's text, the recipe's name. */
  name: string;
  /** `shipped`, or `own` for an own recipe that carries no shipped recipe's name. */
  group: RecipeGroup;
  /**
   * Its variants, at least one: the shipped ones in the shipped file's order, then the ones an own
   * recipe of the same name adds, in the own file's order.
   */
  variants: Variant[];
  /**
   * The workflow step its one stage line declares, left out when the recipe is undeclared: it
   * chooses the mission pages that list the recipe, an undeclared one being listed on every page.
   */
  stage?: WorkflowStep;
  /** The default the variant store picks for the recipe, left out when it picks none. */
  picked?: VariantRef;
}

/** Where a variant comes from: the variant store, the person's own recipe file, or the shipped file. */
export function variantOrigin(variant: Variant): VariantOrigin {
  return variant.stored ? 'stored' : variant.own ? 'own' : 'shipped';
}

/** A block of lines read beneath a heading: undefined until its first fence opens. */
type Lines = string[] | undefined;

interface Block {
  name: string;
  /** The `##` heading the block stands under, or undefined above the first one. */
  section: string | undefined;
  /** The first fenced block's lines beneath the `###` heading itself, before any `####`. */
  lines: Lines;
  /** Its `####` sub-headings, each with the lines of the first fenced block beneath it. */
  variants: { name: string; lines: Lines }[];
  /** The names its stage lines give, read outside any fence before its first fence or `####`. */
  stages: string[];
}

const FENCE = /^\s*```/;
const PLACEHOLDER = /<([A-Za-z][A-Za-z0-9 _-]*)>/g;
const INVOCATION = /[/$]gurita:/;
const INTERACTIVE_MARK = /(?:^|\s)#\s*interactive\s*$/;

/**
 * Splits a Markdown text into its `###` blocks, reading headings outside fences only: each block
 * with the first fence beneath its heading, its `####` sub-headings each with the first fence
 * beneath it, and the stage lines standing outside any fence between the block's heading and its
 * first fence or first sub-heading.
 */
function blocks(text: string): Block[] {
  const found: Block[] = [];
  let section: string | undefined;
  let current: Block | undefined;
  /** The heading, `###` or `####`, whose first fence the next fence would be. */
  let target: { lines: Lines } | undefined;
  let inFence = false;
  /** Whether the fence open now is the first beneath `target`, its lines read. */
  let reading = false;
  let opened = false;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (FENCE.test(line)) {
      if (inFence) {
        inFence = false;
        reading = false;
      } else {
        inFence = true;
        if (current) {
          opened = true;
        }
        if (target && target.lines === undefined) {
          target.lines = [];
          reading = true;
        }
      }
      continue;
    }
    if (inFence) {
      if (reading && target?.lines && line.trim() !== '') {
        target.lines.push(line);
      }
      continue;
    }
    if (line.startsWith('### ')) {
      current = { name: line.slice(4).trim(), section, lines: undefined, variants: [], stages: [] };
      found.push(current);
      target = current;
      opened = false;
    } else if (line.startsWith('## ')) {
      section = line.slice(3).trim();
      current = undefined;
      target = undefined;
    } else if (current && line.startsWith('#### ')) {
      const variant = { name: line.slice(5).trim(), lines: undefined };
      current.variants.push(variant);
      target = variant;
      opened = true;
    } else if (current && !opened && line.startsWith(STAGE_MARKER)) {
      current.stages.push(line.slice(STAGE_MARKER.length).trim());
    }
  }
  return found;
}

/**
 * The workflow step a recipe's stage lines declare: the step its one stage line names, undefined
 * when it has none, more than one, or one naming a step the reader does not know.
 */
export function declaredStage(stages: readonly string[]): WorkflowStep | undefined {
  return stages.length === 1 ? STAGE_NAMES.get(stages[0]) : undefined;
}

/**
 * The step whose recipes a mission page lists beside those of the step its workflow diagram fills:
 * the additional review round's beside derive tasks and follow up tasks' beside finish, the two
 * optional steps a person may take there instead of moving on.
 */
export const PAIRED_STAGES: ReadonlyMap<WorkflowStep, WorkflowStep> = new Map<WorkflowStep, WorkflowStep>([
  ['derive', 'additional-review'],
  ['finish', 'follow-up'],
]);

/**
 * The step whose recipes a mission page lists beside those of the step its workflow diagram fills
 * while any question of the mission is open: the additional review round's beside first review
 * round, so a mission whose first review left questions open can run a further round from its page.
 */
export const OPEN_QUESTION_PAIRED_STAGES: ReadonlyMap<WorkflowStep, WorkflowStep> = new Map<WorkflowStep, WorkflowStep>([
  ['first-review', 'additional-review'],
]);

/**
 * The recipes a mission page whose workflow diagram fills `step` lists, in the order given: every
 * recipe declaring `step`, every recipe declaring the step `PAIRED_STAGES` pairs with it, while
 * `questionsOpen` holds every recipe declaring the step `OPEN_QUESTION_PAIRED_STAGES` pairs with
 * it, and every undeclared recipe. A page whose step could not be chosen, `step` left undefined,
 * lists every recipe.
 */
export function stageRecipes<T extends { stage?: WorkflowStep }>(
  recipes: readonly T[],
  step: WorkflowStep | undefined,
  questionsOpen = false,
): T[] {
  if (step === undefined) {
    return [...recipes];
  }
  const paired = PAIRED_STAGES.get(step) ?? (questionsOpen ? OPEN_QUESTION_PAIRED_STAGES.get(step) : undefined);
  return recipes.filter(
    (recipe) => recipe.stage === undefined || recipe.stage === step || (paired !== undefined && recipe.stage === paired),
  );
}

/** Whether a line is headless: it holds a `gurita:` invocation and carries no `# interactive` mark. */
export function isHeadless(line: string): boolean {
  return INVOCATION.test(line) && !INTERACTIVE_MARK.test(line);
}

/** Classifies one variant's lines by their content alone. */
function variant(name: string, lines: readonly string[], own: boolean, file: string): Variant {
  const looped = lines.length > 0 && lines[lines.length - 1].trim() === SLOT_LINE;
  const known: string[] = [];
  const unknown: string[] = [];
  for (const line of looped ? lines.slice(0, -1) : lines) {
    for (const match of line.matchAll(PLACEHOLDER)) {
      const placeholder = match[1];
      const into = KNOWN_PLACEHOLDERS.includes(placeholder) ? known : unknown;
      if (!into.includes(placeholder)) {
        into.push(placeholder);
      }
    }
  }
  const singleTask = lines.length === 1 && isHeadless(lines[0]) && known.includes('Task Title');
  return {
    name,
    own,
    file,
    lines: [...lines],
    singleTask,
    looped,
    knownPlaceholders: known,
    unknownPlaceholders: unknown,
  };
}

/**
 * The recipe a block reads as: one variant per `####` sub-heading, the first of a repeated name
 * kept, or, when it holds none, one variant named `default` and holding the block's own lines.
 * A heading with no fence beneath it gives a variant of no line.
 */
function classify(block: Block, group: RecipeGroup, own: boolean, file: string): Recipe {
  const variants: Variant[] = [];
  if (block.variants.length === 0) {
    variants.push(variant(ONE_BLOCK_VARIANT, block.lines ?? [], own, file));
  } else {
    for (const each of block.variants) {
      if (!variants.some((kept) => kept.name === each.name)) {
        variants.push(variant(each.name, each.lines ?? [], own, file));
      }
    }
  }
  const stage = declaredStage(block.stages);
  return {
    name: block.name,
    group,
    variants,
    ...(stage === undefined ? {} : { stage }),
  };
}

/** Reads the shipped recipe file's text: the `###` blocks under its recipe section only, the first of a repeated name kept. */
export function parseShippedRecipes(text: string, file: string): Recipe[] {
  const recipes: Recipe[] = [];
  const seen = new Set<string>();
  for (const block of blocks(text)) {
    if (block.section !== RECIPE_SECTION || seen.has(block.name)) {
      continue;
    }
    seen.add(block.name);
    recipes.push(classify(block, 'shipped', false, file));
  }
  return recipes;
}

/** Reads a person's own recipe file's text: every `###` block, flat, the first of a repeated name kept. */
export function parseOwnRecipes(text: string, file: string): Recipe[] {
  const recipes: Recipe[] = [];
  const seen = new Set<string>();
  for (const block of blocks(text)) {
    if (seen.has(block.name)) {
      continue;
    }
    seen.add(block.name);
    recipes.push(classify(block, 'own', true, file));
  }
  return recipes;
}

/**
 * Merges the two lists: the shipped recipes in the shipped file's order, an own recipe carrying a
 * shipped recipe's name joining that recipe, its variants listed after the shipped variants and
 * kept beside any shipped variant of the same name, the shipped recipe keeping its name, group,
 * and stage; every other own recipe follows the shipped recipes, in the own file's order.
 */
export function mergeRecipes(shipped: Recipe[], own: Recipe[]): Recipe[] {
  const ownByName = new Map(own.map((recipe) => [recipe.name, recipe]));
  const merged: Recipe[] = [];
  for (const recipe of shipped) {
    const joining = ownByName.get(recipe.name);
    merged.push(joining ? { ...recipe, variants: [...recipe.variants, ...joining.variants] } : recipe);
  }
  const shippedNames = new Set(shipped.map((recipe) => recipe.name));
  merged.push(...own.filter((recipe) => !shippedNames.has(recipe.name)));
  return merged;
}

/** A recipe's first variant in order, the first shipped one when it has any. */
export function firstVariant(recipe: Recipe): Variant {
  return recipe.variants[0];
}

/** The variant a stored record classifies as, from the store file `file`. */
function storedVariant(stored: StoredVariant, file: string): Variant {
  return {
    ...variant(stored.name, stored.lines, true, file),
    stored: true,
    ...(stored.copies === undefined ? {} : { copies: { ...stored.copies } }),
    ...(stored.from === undefined ? {} : { from: { ...stored.from } }),
  };
}

/** Whether two stored variants stand in for the same shipped or own variant, or both for none. */
export function sameCopies(one: ReadVariantRef | undefined, other: ReadVariantRef | undefined): boolean {
  return one === undefined || other === undefined
    ? one === other
    : one.name === other.name && one.origin === other.origin && one.recipe === other.recipe;
}

/**
 * The recipe a stored copy of a renamed single-task line copies its variant from, when it names one
 * other than its own: undefined for every other stored variant.
 */
export function copiedRecipe(stored: StoredVariant): string | undefined {
  const recipe = stored.copies?.recipe;
  return recipe === undefined || recipe === stored.recipe ? undefined : recipe;
}

/**
 * Lays the variant store `store`, read from `file`, over the merged recipe list: in each recipe a
 * stored copy stands in for the shipped or own variant it copies, in that variant's place, the
 * first copy of a variant doing so; a hidden variant not copied is left out; every other stored
 * variant of the recipe follows, in the store's order. Of stored variants of one recipe carrying
 * one name and standing in for the same variant, or for none, the first is kept, so a copy of a
 * shipped variant and a copy of an own variant of that name stand side by side as the two do.
 * A stored copy of a renamed single-task line, whose `copies` names another recipe, stands in for
 * that recipe's variant as a recipe of its own name, listed directly after the recipe it copies
 * from, with that recipe's group and stage, the copied variant left out there; such a copy under a
 * name the files hold stands in for nothing, and one whose variant the files no longer list is
 * listed as the stored variants of a recipe the list does not hold are.
 * Stored variants of a recipe the list does not hold form a recipe of that name in the own group,
 * listed after every other in the order the store first names them, and a recipe left with no
 * variant is dropped. The first pick the store holds for a recipe is carried as its `picked`.
 */
export function overlayVariantStore(recipes: readonly Recipe[], store: VariantStore, file: string): Recipe[] {
  const held = new Set(recipes.map((recipe) => recipe.name));
  const storedBy = new Map<string, StoredVariant[]>();
  const renamed: StoredVariant[] = [];
  for (const each of store.variants) {
    if (copiedRecipe(each) !== undefined) {
      if (!held.has(each.recipe) && !renamed.some((kept) => kept.recipe === each.recipe)) {
        renamed.push(each);
      }
      continue;
    }
    const list = storedBy.get(each.recipe) ?? [];
    storedBy.set(each.recipe, list);
    if (!list.some((kept) => kept.name === each.name && sameCopies(kept.copies, each.copies))) {
      list.push(each);
    }
  }
  const picks = new Map<string, VariantRef>();
  for (const pick of store.defaults) {
    if (!picks.has(pick.recipe)) {
      picks.set(pick.recipe, { name: pick.name, origin: pick.origin });
    }
  }
  const withPick = (recipe: Recipe): Recipe => {
    const pick = picks.get(recipe.name);
    return pick === undefined ? recipe : { ...recipe, picked: { ...pick } };
  };
  /** The stored variants of a recipe only the store holds, each taken once. */
  const taken = new Set<string>();
  const storedOnly = (name: string): Variant[] => {
    if (held.has(name) || taken.has(name)) {
      return [];
    }
    taken.add(name);
    return (storedBy.get(name) ?? []).map((record) => storedVariant(record, file));
  };
  const overlaid: Recipe[] = [];
  for (const recipe of recipes) {
    const stored = storedBy.get(recipe.name) ?? [];
    const placed = new Set<StoredVariant>();
    const variants: Variant[] = [];
    const lines: StoredVariant[] = [];
    for (const each of recipe.variants) {
      const origin = variantOrigin(each);
      const copy = stored.find(
        (record) => !placed.has(record) && record.copies?.name === each.name && record.copies.origin === origin,
      );
      if (copy !== undefined) {
        placed.add(copy);
        variants.push(storedVariant(copy, file));
        continue;
      }
      const line = renamed.find(
        (record) =>
          !lines.includes(record) &&
          record.copies?.recipe === recipe.name &&
          record.copies.name === each.name &&
          record.copies.origin === origin,
      );
      if (line !== undefined) {
        lines.push(line);
        continue;
      }
      if (store.hidden.some((hidden) => hidden.recipe === recipe.name && hidden.name === each.name && hidden.origin === origin)) {
        continue;
      }
      variants.push(each);
    }
    variants.push(...stored.filter((record) => !placed.has(record)).map((record) => storedVariant(record, file)));
    if (variants.length > 0) {
      overlaid.push(withPick({ ...recipe, variants }));
    }
    for (const line of lines) {
      renamed.splice(renamed.indexOf(line), 1);
      overlaid.push(
        withPick({
          name: line.recipe,
          group: recipe.group,
          variants: [storedVariant(line, file), ...storedOnly(line.recipe)],
          ...(recipe.stage === undefined ? {} : { stage: recipe.stage }),
        }),
      );
    }
  }
  for (const name of store.variants.map((each) => each.recipe)) {
    if (held.has(name) || taken.has(name)) {
      continue;
    }
    const line = renamed.find((record) => record.recipe === name);
    const variants = [...(line === undefined ? [] : [storedVariant(line, file)]), ...storedOnly(name)];
    if (variants.length > 0) {
      overlaid.push(withPick({ name, group: 'own', variants }));
    }
  }
  return overlaid;
}

/**
 * The variant a recipe's standing pick names: the listed variant its `picked` names, or the stored
 * copy standing in for the variant it names; undefined while no pick stands or the pick names no
 * listed variant.
 */
export function pickedVariant(recipe: Recipe): Variant | undefined {
  const pick = recipe.picked;
  if (pick === undefined) {
    return undefined;
  }
  return (
    recipe.variants.find((each) => each.name === pick.name && variantOrigin(each) === pick.origin) ??
    recipe.variants.find((each) => each.copies?.name === pick.name && each.copies.origin === pick.origin)
  );
}

/**
 * The variant a recipe runs, its default: the variant its standing pick names (`pickedVariant`),
 * and, while no pick stands or the pick names no listed variant, its first variant in order.
 */
export function defaultVariant(recipe: Recipe): Variant {
  return pickedVariant(recipe) ?? firstVariant(recipe);
}

/**
 * Reads the shipped recipe file and, when given and present, a person's own recipe file, merges
 * them, and lays the variant store at `storeFile`, when given, over the merged list. A missing own
 * file holds no recipe and a missing store file nothing; any other read failure throws.
 */
export function readRecipes(shippedFile: string, ownFile?: string, storeFile?: string): Recipe[] {
  const shipped = parseShippedRecipes(fs.readFileSync(shippedFile, 'utf8'), shippedFile);
  let own: Recipe[] = [];
  if (ownFile !== undefined) {
    let text: string | undefined;
    try {
      text = fs.readFileSync(ownFile, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
    if (text !== undefined) {
      own = parseOwnRecipes(text, ownFile);
    }
  }
  const merged = mergeRecipes(shipped, own);
  if (storeFile === undefined) {
    return merged;
  }
  return overlayVariantStore(merged, readVariantStore(storeFile), storeFile);
}

/** The default path of a person's own recipe file, under their home directory. */
export const DEFAULT_OWN_RECIPES_FILE = '~/.gurita/recipes.md';

/**
 * The path of a person's own recipe file: the `gurita.ownRecipesFile` setting's value when it is
 * set and not blank, otherwise the default, a leading `~` expanded to the home directory `home`
 * and no environment variable read.
 */
export function ownRecipesFile(setting: string | undefined, home: string): string {
  const chosen = setting !== undefined && setting.trim() !== '' ? setting.trim() : DEFAULT_OWN_RECIPES_FILE;
  if (chosen === '~') {
    return home;
  }
  if (chosen.startsWith('~/')) {
    return `${home.replace(/\/+$/, '')}/${chosen.slice(2)}`;
  }
  return chosen;
}

/** The heading of the page's group of own recipes that replace no shipped recipe. */
export const OWN_GROUP_HEADING = 'Your actions';

/** One variant a page recipe's dropdown offers: its name, which the dropdown and the button beside it show, and whether it is the person's own. */
export interface PageVariantChoice {
  name: string;
  /** Set for a variant of the person's own recipe file or of the variant store. */
  own: boolean;
}

/** The dropdown beside a page recipe: the variants it offers, in the recipe's order, and the one selected. */
export interface PageChoices {
  /** The recipe's variants the page can draw, at least one. */
  variants: PageVariantChoice[];
  /** The index in `variants` of the variant selected, the one the entry's other fields describe. */
  selected: number;
}

/** A recipe as one of its variants draws it on a mission page: its name and group, and that variant. */
export type PageEntry =
  | {
      kind: 'runnable';
      name: string;
      group: RecipeGroup;
      /** The variant's lines as written, placeholders included. */
      lines: string[];
    }
  | {
      kind: 'looped';
      name: string;
      group: RecipeGroup;
      /** The variant's lines as written, the slot line last. */
      lines: string[];
    }
  | {
      kind: 'unknown';
      name: string;
      group: RecipeGroup;
      lines: string[];
      /** The placeholder names the extension does not know, in order of first appearance. */
      placeholders: string[];
      /** The file the variant came from. */
      file: string;
    };

/**
 * One entry of a mission page's recipe list, in the merged list's order: the recipe as its selected
 * variant draws it, the one its button shows and runs, with the dropdown of its variants.
 */
export type PageRecipe = PageEntry & PageChoices;

/** The placeholders a looped run fills itself, from its mission and each task's heading. */
export const LOOPED_PLACEHOLDERS: readonly string[] = ['path', 'Task Title'];

/**
 * The page entry the variant `runs` of `recipe` draws, for a page holding values for `fillable`,
 * or undefined when the page leaves the variant off.
 */
function variantEntry(recipe: Recipe, runs: Variant, fillable: readonly string[]): PageEntry | undefined {
  if (runs.unknownPlaceholders.length > 0) {
    return {
      kind: 'unknown',
      name: recipe.name,
      group: recipe.group,
      lines: [...runs.lines],
      placeholders: [...runs.unknownPlaceholders],
      file: runs.file,
    };
  }
  if (runs.looped) {
    if (runs.knownPlaceholders.every((name) => LOOPED_PLACEHOLDERS.includes(name))) {
      return { kind: 'looped', name: recipe.name, group: recipe.group, lines: [...runs.lines] };
    }
    return undefined;
  }
  if (runs.lines.length === 0 || runs.knownPlaceholders.some((name) => !fillable.includes(name))) {
    return undefined;
  }
  return { kind: 'runnable', name: recipe.name, group: recipe.group, lines: [...runs.lines] };
}

/** Whether at least one of the variant's lines runs on one of the harnesses `disabled` names. */
function onDisabledHarness(variant: Variant, disabled: readonly Harness[]): boolean {
  return disabled.length > 0 && variant.lines.some((line) => {
    const harness = readLine(line)?.harness;
    return harness !== undefined && disabled.includes(harness);
  });
}

/**
 * The recipes a mission page lists out of `recipes`, for a page the part of the merged list
 * `stageRecipes` keeps for its step, given the placeholder names the page holds a value for and the
 * variant name `remembered` holds for each recipe, the dropdown selection remembered for the page's
 * mission, and the harnesses `disabled` names, those the settings view disabled. A variant with at
 * least one line on a disabled harness is left out, mixed variants included. Every other variant is
 * drawn by its content: one holding a placeholder the extension does not
 * know as a non-runnable entry naming it and its file, a looped one as its own kind, run through
 * its preview rather than as a chain, when every placeholder it holds is one a looped run fills
 * itself, and every other one as a button; a variant holding a known placeholder the page has no
 * value for, or no line, is left off silently, staying reachable by name for the button or loop
 * that fills it. A recipe every variant of which is left off is not listed, and neither is a
 * recipe one of the buttons outside the chains runs by its fixed name (`BUTTON_RECIPES`), whose
 * variants that button's own dropdown offers (`buttonRecipe`). Each entry offers the variants the page draws in its dropdown and
 * describes the one selected: the first carrying the remembered name, a remembered selection always
 * winning over the default, and otherwise the recipe's default when it is drawn, and otherwise its
 * first variant drawn, so a remembered variant left out for a disabled harness gives way without
 * being forgotten and is selected again once the harness is enabled.
 */
export function pageRecipes(
  recipes: Recipe[],
  fillable: readonly string[],
  remembered: ReadonlyMap<string, string> = new Map(),
  disabled: readonly Harness[] = [],
): PageRecipe[] {
  const fixed: readonly string[] = Object.values(BUTTON_RECIPES);
  const listed: PageRecipe[] = [];
  for (const recipe of recipes) {
    if (fixed.includes(recipe.name)) {
      continue;
    }
    const drawn: { variant: Variant; entry: PageEntry }[] = [];
    for (const variant of recipe.variants) {
      if (onDisabledHarness(variant, disabled)) {
        continue;
      }
      const entry = variantEntry(recipe, variant, fillable);
      if (entry !== undefined) {
        drawn.push({ variant, entry });
      }
    }
    if (drawn.length === 0) {
      continue;
    }
    const name = remembered.get(recipe.name);
    let selected = name === undefined ? -1 : drawn.findIndex((each) => each.variant.name === name);
    if (selected < 0) {
      const fallback = defaultVariant(recipe);
      selected = Math.max(0, drawn.findIndex((each) => each.variant === fallback));
    }
    listed.push({
      ...drawn[selected].entry,
      variants: drawn.map((each) => ({ name: each.variant.name, own: each.variant.own })),
      selected,
    });
  }
  return listed;
}

/** The variant a page entry describes, its dropdown's selected one. */
export function selectedChoice(entry: PageRecipe): PageVariantChoice {
  return entry.variants[entry.selected];
}

/**
 * The fixed names of the recipes the buttons outside the chains run, each the bare name of the
 * skill its one line invokes: two on a question's card, one on each alternative on that card,
 * the two mission-starting buttons at the tab row's end, and the new-task and ask-in-mission-context
 * buttons in a mission page's row of mission-wide actions above its pane headers.
 */
export const BUTTON_RECIPES = {
  discussQuestion: 'discuss-open-question',
  answerQuestion: 'answer-open-question',
  answerWithAlternative: 'answer-open-question-with-alternative',
  discussGoal: 'discuss-mission-goal',
  defineMission: 'define-mission-goal',
  discussTask: 'discuss-new-task',
  askMission: 'ask-in-mission-context',
} as const;

/**
 * The recipe a button runs, by its fixed name: the variants its dropdown offers and the one
 * selected, which it runs; or, when every variant it could run has a line on a disabled harness,
 * the recipe with no variant offered and the cause; or the cause it cannot be run at all.
 */
export type ButtonRecipe =
  | { state: 'found'; recipe: Recipe; variant: Variant; variants: Variant[]; selected: number }
  | { state: 'disabled'; recipe: Recipe; cause: string }
  | { state: 'refused'; cause: string };

/**
 * Why the button holding values for `fillable` cannot run `variant` of the recipe named `name`, or
 * undefined when it can: the variant holds a line, it is not the looped recipe, and every
 * placeholder it holds is one the button holds a value for.
 */
function buttonRefusal(name: string, variant: Variant, fillable: readonly string[]): string | undefined {
  const where = `The action ${name} in ${variant.file}`;
  if (variant.lines.length === 0) {
    return `${where} holds no line.`;
  }
  if (variant.looped) {
    return `${where} is a looped action.`;
  }
  const unfilled = [
    ...variant.unknownPlaceholders,
    ...variant.knownPlaceholders.filter((placeholder) => !fillable.includes(placeholder)),
  ];
  if (unfilled.length > 0) {
    const named = unfilled.map((placeholder) => `<${placeholder}>`).join(', ');
    return `${where} holds ${unfilled.length === 1 ? 'a placeholder' : 'placeholders'} this button has no value for: ${named}.`;
  }
  return undefined;
}

/**
 * The recipe of the fixed name `name` in the merged list, its shipped variants and those an own
 * recipe of the same name adds, with the variants the button's dropdown offers: every variant the
 * button can run, one holding a line, not the looped recipe, and holding only placeholders the
 * button holds a value for, `fillable` naming them, in the recipe's order, a variant with at least
 * one line on a harness `disabled` names left out. The variant selected, the one the button runs,
 * is the first offered carrying the name `remembered` gives, the dropdown selection remembered for
 * the recipe, a remembered selection always winning over the default, and otherwise the recipe's
 * default when it is offered, and otherwise the first variant offered. A recipe of which the
 * button can run some variant but every one is left out for a disabled harness is the recipe with
 * no variant offered, the button standing with none; a recipe of no such name, or one no variant
 * of which the button can run, is refused, the cause naming the recipe and what is wrong with its
 * default.
 */
export function buttonRecipe(
  recipes: Recipe[],
  name: string,
  fillable: readonly string[],
  remembered?: string,
  disabled: readonly Harness[] = [],
): ButtonRecipe {
  const recipe = recipes.find((entry) => entry.name === name);
  if (recipe === undefined) {
    return { state: 'refused', cause: `No action is named ${name}.` };
  }
  const runnable = recipe.variants.filter((variant) => buttonRefusal(name, variant, fillable) === undefined);
  if (runnable.length === 0) {
    return { state: 'refused', cause: buttonRefusal(name, defaultVariant(recipe), fillable) as string };
  }
  const variants = runnable.filter((variant) => !onDisabledHarness(variant, disabled));
  if (variants.length === 0) {
    return { state: 'disabled', recipe, cause: `Every variant of ${name} this button can run has a line on a disabled harness.` };
  }
  let selected = remembered === undefined ? -1 : variants.findIndex((variant) => variant.name === remembered);
  if (selected < 0) {
    selected = Math.max(0, variants.indexOf(defaultVariant(recipe)));
  }
  return { state: 'found', recipe, variant: variants[selected], variants, selected };
}
