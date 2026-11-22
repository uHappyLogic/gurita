// The recipe reader. A recipe is a `###` heading, its name, and one or more named variants, each a
// literal block of lines: every `####` sub-heading beneath the `###` heading names a variant, its
// lines those of the first fenced block beneath the sub-heading, and a recipe with no `####`
// sub-heading is a recipe of one variant, named by the recipe's own name, its lines those of the
// first fenced block beneath the `###` heading. Once a recipe holds a `####` sub-heading only the
// blocks beneath its sub-headings are read, and of a variant name repeated within one recipe the
// first is kept. The same form is read in the shipped file and in a person's own file. The shipped
// snippet file yields only the recipes under its one recipe section, its `## Recipes` heading, each
// in the shipped group, a chain run on several harnesses being one recipe with one variant per
// copy; a person's own recipe file is a flat list of `###` recipes. An own
// recipe carrying a shipped recipe's name replaces neither that recipe nor any of its variants:
// its variants join the shipped recipe, listed after the shipped variants under their own names and
// marked as the person's own, an own variant carrying a shipped variant's name kept as a second
// entry beside it; every other own recipe is listed after the shipped recipes, which keep the
// shipped file's order, in the own file's order.
// Until a variant can be chosen, the mission page, the buttons that run a recipe by its fixed name,
// and the looped run's named single-task lines take a recipe's first variant. Each variant is
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
// the additional review round's when derive tasks is filled and follow up tasks' when finish is, and
// every undeclared recipe whatever the step, while a page whose step could not be chosen lists every
// recipe; the page's other rules, the shipped recipes before the own group and the placeholders it
// cannot fill, hold within that list, and the buttons that run a recipe by its fixed name are untouched by
// it. In the shipped file every chain declares its one step and spans no other, each variant of an
// execution chain holding its `complete-all-tasks` line alone, while the button recipes and the
// single-task lines declare nothing. This module imports nothing from `vscode`.

import * as fs from 'node:fs';
import { VariantValues, variantValues } from './lineValues';
import type { WorkflowStep } from './workflow';

/** The one heading of the shipped snippet file whose `###` blocks are recipes. */
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
  'note',
];

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
  /** The `####` sub-heading's text, or the recipe's own name for a recipe of one block. */
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
 * The recipes a mission page whose workflow diagram fills `step` lists, in the order given: every
 * recipe declaring `step`, every recipe declaring the step `PAIRED_STAGES` pairs with it, and every
 * undeclared recipe. A page whose step could not be chosen, `step` left undefined, lists every
 * recipe.
 */
export function stageRecipes<T extends { stage?: WorkflowStep }>(recipes: readonly T[], step: WorkflowStep | undefined): T[] {
  if (step === undefined) {
    return [...recipes];
  }
  const paired = PAIRED_STAGES.get(step);
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
 * kept, or, when it holds none, one variant named by the recipe and holding the block's own lines.
 * A heading with no fence beneath it gives a variant of no line.
 */
function classify(block: Block, group: RecipeGroup, own: boolean, file: string): Recipe {
  const variants: Variant[] = [];
  if (block.variants.length === 0) {
    variants.push(variant(block.name, block.lines ?? [], own, file));
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

/** Reads the shipped snippet file's text: the `###` blocks under its recipe section only, the first of a repeated name kept. */
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

/**
 * The variant a recipe runs until a variant can be chosen: its first, the first shipped one when
 * it has any.
 */
export function firstVariant(recipe: Recipe): Variant {
  return recipe.variants[0];
}

/**
 * Reads the shipped snippet file and, when given and present, a person's own recipe file, and
 * returns the merged recipe list. A missing own file holds no recipe; any other read failure throws.
 */
export function readRecipes(shippedFile: string, ownFile?: string): Recipe[] {
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
  return mergeRecipes(shipped, own);
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
export const OWN_GROUP_HEADING = 'Your recipes';

/** One entry of a mission page's recipe list, in the merged list's order. */
export type PageRecipe =
  | {
      kind: 'runnable';
      name: string;
      group: RecipeGroup;
      /** The recipe's lines as written, placeholders included. */
      lines: string[];
      /** The harnesses, models, and efforts its lines carry, which its button shows with its name. */
      values: VariantValues;
    }
  | {
      kind: 'looped';
      name: string;
      group: RecipeGroup;
      /** The recipe's lines as written, the slot line last. */
      lines: string[];
      /** The harnesses, models, and efforts its lines carry, which its button shows with its name. */
      values: VariantValues;
    }
  | {
      kind: 'unknown';
      name: string;
      group: RecipeGroup;
      lines: string[];
      /** The placeholder names the extension does not know, in order of first appearance. */
      placeholders: string[];
      /** The file the recipe came from. */
      file: string;
    };

/** The placeholders a looped run fills itself, from its mission and each task's heading. */
export const LOOPED_PLACEHOLDERS: readonly string[] = ['path', 'Task Title'];

/**
 * The recipes a mission page lists out of `recipes`, for a page the part of the merged list
 * `stageRecipes` keeps for its step, given the placeholder names the page holds a value for, each
 * entry drawn from the recipe's first variant, a button's entry carrying the distinct harnesses,
 * models, and efforts that variant's lines carry, as the line-value module reads them. A recipe whose variant holds a placeholder the
 * extension does not know is listed as a non-runnable entry naming it and its file. A looped
 * recipe is listed as its own kind, run through its preview rather than as a chain, when every
 * placeholder it holds is one a looped run fills itself. A recipe holding a known placeholder the
 * page has no value for is left off silently, staying reachable by name for the button or loop
 * that fills it, and so is a recipe with no line.
 */
export function pageRecipes(recipes: Recipe[], fillable: readonly string[]): PageRecipe[] {
  const listed: PageRecipe[] = [];
  for (const recipe of recipes) {
    const runs = firstVariant(recipe);
    if (runs.unknownPlaceholders.length > 0) {
      listed.push({
        kind: 'unknown',
        name: recipe.name,
        group: recipe.group,
        lines: [...runs.lines],
        placeholders: [...runs.unknownPlaceholders],
        file: runs.file,
      });
      continue;
    }
    if (runs.looped) {
      if (runs.knownPlaceholders.every((name) => LOOPED_PLACEHOLDERS.includes(name))) {
        listed.push({ kind: 'looped', name: recipe.name, group: recipe.group, lines: [...runs.lines], values: variantValues(runs.lines) });
      }
      continue;
    }
    if (runs.lines.length === 0) {
      continue;
    }
    if (runs.knownPlaceholders.some((name) => !fillable.includes(name))) {
      continue;
    }
    listed.push({ kind: 'runnable', name: recipe.name, group: recipe.group, lines: [...runs.lines], values: variantValues(runs.lines) });
  }
  return listed;
}

/**
 * The fixed names of the recipes the buttons outside the chains run, each the bare name of the
 * skill its one line invokes: three on a question's card, one on each alternative on that card,
 * the two mission-starting buttons at the tab row's end, and the new-task button inside a
 * mission's Remaining tasks pane.
 */
export const BUTTON_RECIPES = {
  discussQuestion: 'discuss-open-question',
  answerQuestion: 'answer-open-question',
  answerWithRecommendation: 'answer-open-question-with-recommendation',
  answerWithAlternative: 'answer-open-question-with-alternative',
  discussGoal: 'discuss-mission-goal',
  defineMission: 'define-mission-goal',
  discussTask: 'discuss-new-task',
} as const;

/** The recipe a button runs, by its fixed name, with the variant it runs, or the cause it cannot be run. */
export type ButtonRecipe = { state: 'found'; recipe: Recipe; variant: Variant } | { state: 'refused'; cause: string };

/**
 * The recipe of the fixed name `name` in the merged list, its shipped variants and those an own
 * recipe of the same name adds, with the variant the button runs, its first, when the button can
 * run it: that variant holds a line, it is not the looped recipe, and every placeholder it holds
 * is one the button holds a value for, `fillable` naming them. Otherwise the cause it cannot be
 * run, naming the recipe and what is wrong with it.
 */
export function buttonRecipe(recipes: Recipe[], name: string, fillable: readonly string[]): ButtonRecipe {
  const recipe = recipes.find((entry) => entry.name === name);
  if (recipe === undefined) {
    return { state: 'refused', cause: `No recipe is named ${name}.` };
  }
  const variant = firstVariant(recipe);
  const where = `The recipe ${name} in ${variant.file}`;
  if (variant.lines.length === 0) {
    return { state: 'refused', cause: `${where} holds no line.` };
  }
  if (variant.looped) {
    return { state: 'refused', cause: `${where} is a looped recipe.` };
  }
  const unfilled = [
    ...variant.unknownPlaceholders,
    ...variant.knownPlaceholders.filter((placeholder) => !fillable.includes(placeholder)),
  ];
  if (unfilled.length > 0) {
    const named = unfilled.map((placeholder) => `<${placeholder}>`).join(', ');
    return { state: 'refused', cause: `${where} holds ${unfilled.length === 1 ? 'a placeholder' : 'placeholders'} this button has no value for: ${named}.` };
  }
  return { state: 'found', recipe, variant };
}
