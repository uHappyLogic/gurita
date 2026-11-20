// The recipe reader. A recipe is a `###` heading, its name, and the lines of the first fenced
// block beneath it. The shipped snippet file yields only the recipes under its `## Claude Code`
// and `## Antigravity` headings, each in that host's group; a person's own recipe file is a flat
// list of `###` recipes, one carrying a shipped recipe's name replacing that recipe in place and
// every other listed after the host groups, in the file's order. Each recipe is classified by
// its content alone: whether it is a single-task line, whether it is the looped recipe, and which
// known and unknown placeholders it holds. This module imports nothing from `vscode`.

import * as fs from 'node:fs';

/** The two host headings of the shipped snippet file whose `###` blocks are recipes. */
export const HOST_GROUPS = ['Claude Code', 'Antigravity'] as const;

/** A shipped host group, or `own` for an own recipe that replaces no shipped one. */
export type RecipeGroup = (typeof HOST_GROUPS)[number] | 'own';

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

export interface Recipe {
  /** The `###` heading's text, the recipe's name. */
  name: string;
  /** The host group the recipe is listed under, or `own`. */
  group: RecipeGroup;
  /** The path of the file the recipe's lines came from. */
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

interface Block {
  name: string;
  /** The `##` heading the block stands under, or undefined above the first one. */
  section: string | undefined;
  lines: string[];
}

const FENCE = /^\s*```/;
const PLACEHOLDER = /<([A-Za-z][A-Za-z0-9 _-]*)>/g;
const INVOCATION = /[/$]gurita:/;
const INTERACTIVE_MARK = /(?:^|\s)#\s*interactive\s*$/;

/** Splits a Markdown text into its `###` blocks, reading headings outside fences only. */
function blocks(text: string): Block[] {
  const found: Block[] = [];
  let section: string | undefined;
  let current: Block | undefined;
  let inFence = false;
  let fenceRead = false;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (FENCE.test(line)) {
      if (inFence) {
        inFence = false;
        fenceRead = true;
      } else {
        inFence = true;
      }
      continue;
    }
    if (inFence) {
      if (current && !fenceRead && line.trim() !== '') {
        current.lines.push(line);
      }
      continue;
    }
    if (line.startsWith('### ')) {
      current = { name: line.slice(4).trim(), section, lines: [] };
      found.push(current);
      fenceRead = false;
    } else if (line.startsWith('## ')) {
      section = line.slice(3).trim();
      current = undefined;
    }
  }
  return found;
}

/** Whether a line is headless: it holds a `gurita:` invocation and carries no `# interactive` mark. */
export function isHeadless(line: string): boolean {
  return INVOCATION.test(line) && !INTERACTIVE_MARK.test(line);
}

function classify(block: Block, group: RecipeGroup, file: string): Recipe {
  const lines = block.lines;
  const looped = lines.length > 0 && lines[lines.length - 1].trim() === SLOT_LINE;
  const known: string[] = [];
  const unknown: string[] = [];
  for (const line of looped ? lines.slice(0, -1) : lines) {
    for (const match of line.matchAll(PLACEHOLDER)) {
      const name = match[1];
      const into = KNOWN_PLACEHOLDERS.includes(name) ? known : unknown;
      if (!into.includes(name)) {
        into.push(name);
      }
    }
  }
  const singleTask = lines.length === 1 && isHeadless(lines[0]) && known.includes('Task Title');
  return {
    name: block.name,
    group,
    file,
    lines: [...lines],
    singleTask,
    looped,
    knownPlaceholders: known,
    unknownPlaceholders: unknown,
  };
}

/** Reads the shipped snippet file's text: the `###` blocks under the two host headings only. */
export function parseShippedRecipes(text: string, file: string): Recipe[] {
  const recipes: Recipe[] = [];
  const seen = new Set<string>();
  for (const block of blocks(text)) {
    const group = HOST_GROUPS.find((host) => host === block.section);
    if (group === undefined || seen.has(block.name)) {
      continue;
    }
    seen.add(block.name);
    recipes.push(classify(block, group, file));
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
    recipes.push(classify(block, 'own', file));
  }
  return recipes;
}

/**
 * Merges the two lists: an own recipe carrying a shipped recipe's name takes that recipe's place
 * in its host group, and every other own recipe follows the host groups, in the own file's order.
 */
export function mergeRecipes(shipped: Recipe[], own: Recipe[]): Recipe[] {
  const ownByName = new Map(own.map((recipe) => [recipe.name, recipe]));
  const merged: Recipe[] = [];
  for (const host of HOST_GROUPS) {
    for (const recipe of shipped.filter((each) => each.group === host)) {
      const replacement = ownByName.get(recipe.name);
      merged.push(replacement ? { ...replacement, group: host } : recipe);
    }
  }
  const shippedNames = new Set(shipped.map((recipe) => recipe.name));
  merged.push(...own.filter((recipe) => !shippedNames.has(recipe.name)));
  return merged;
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
    }
  | {
      kind: 'looped';
      name: string;
      group: RecipeGroup;
      /** The recipe's lines as written, the slot line last. */
      lines: string[];
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
 * The recipes a mission page lists, given the placeholder names the page holds a value for. A
 * recipe holding a placeholder the extension does not know is listed as a non-runnable entry
 * naming it and its file. A looped recipe is listed as its own kind, run through its preview
 * rather than as a chain, when every placeholder it holds is one a looped run fills itself. A
 * recipe holding a known placeholder the page has no value for is left off silently, staying
 * reachable by name for the button or loop that fills it, and so is a recipe with no line.
 */
export function pageRecipes(recipes: Recipe[], fillable: readonly string[]): PageRecipe[] {
  const listed: PageRecipe[] = [];
  for (const recipe of recipes) {
    if (recipe.unknownPlaceholders.length > 0) {
      listed.push({
        kind: 'unknown',
        name: recipe.name,
        group: recipe.group,
        lines: [...recipe.lines],
        placeholders: [...recipe.unknownPlaceholders],
        file: recipe.file,
      });
      continue;
    }
    if (recipe.looped) {
      if (recipe.knownPlaceholders.every((name) => LOOPED_PLACEHOLDERS.includes(name))) {
        listed.push({ kind: 'looped', name: recipe.name, group: recipe.group, lines: [...recipe.lines] });
      }
      continue;
    }
    if (recipe.lines.length === 0) {
      continue;
    }
    if (recipe.knownPlaceholders.some((name) => !fillable.includes(name))) {
      continue;
    }
    listed.push({ kind: 'runnable', name: recipe.name, group: recipe.group, lines: [...recipe.lines] });
  }
  return listed;
}

/**
 * The fixed names of the recipes the buttons outside the chains run, each the bare name of the
 * skill its one line invokes: three on a question's card, one on each alternative on that card,
 * the two mission-starting buttons at the tab row's end, and the new-task button beside a
 * mission's remaining-task headings.
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

/** The recipe a button runs, by its fixed name, or the cause it cannot be run. */
export type ButtonRecipe = { state: 'found'; recipe: Recipe } | { state: 'refused'; cause: string };

/**
 * The recipe of the fixed name `name` in the merged list, shipped or replaced by an own recipe of
 * the same name, when the button can run it: it holds a line, it is not the looped recipe, and
 * every placeholder it holds is one the button holds a value for, `fillable` naming them.
 * Otherwise the cause it cannot be run, naming the recipe and what is wrong with it.
 */
export function buttonRecipe(recipes: Recipe[], name: string, fillable: readonly string[]): ButtonRecipe {
  const recipe = recipes.find((entry) => entry.name === name);
  if (recipe === undefined) {
    return { state: 'refused', cause: `No recipe is named ${name}.` };
  }
  const where = `The recipe ${name} in ${recipe.file}`;
  if (recipe.lines.length === 0) {
    return { state: 'refused', cause: `${where} holds no line.` };
  }
  if (recipe.looped) {
    return { state: 'refused', cause: `${where} is a looped recipe.` };
  }
  const unfilled = [
    ...recipe.unknownPlaceholders,
    ...recipe.knownPlaceholders.filter((placeholder) => !fillable.includes(placeholder)),
  ];
  if (unfilled.length > 0) {
    const named = unfilled.map((placeholder) => `<${placeholder}>`).join(', ');
    return { state: 'refused', cause: `${where} holds ${unfilled.length === 1 ? 'a placeholder' : 'placeholders'} this button has no value for: ${named}.` };
  }
  return { state: 'found', recipe };
}
