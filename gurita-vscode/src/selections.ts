// The variant selected in each recipe's dropdown on a mission page, remembered per recipe name on
// one mission, keyed by the mission's path as the pane lists it. The selections are kept in the
// project's `ExtensionContext.workspaceState` under one key, as a map from mission path and recipe
// name to variant name, and nothing is written into the project's tree. A remembered selection
// always wins over the recipe's default; a remembered variant the recipe no longer holds, deleted
// or renamed, is dropped, and the button falls back to the current default. Of several variants of
// one recipe carrying the remembered name, the first is the one selected. The buttons that run a
// recipe by its fixed name are remembered the same way: those on a mission's page per recipe on
// that mission in the same map, and the two mission-starting buttons, which belong to no mission,
// once per project, under a second key as a map from recipe name to variant name. Each answer-
// with-alternative button on a question's card has a dropdown of its own, its selection
// remembered per mission, question, and alternative under a third key, as a map from mission path,
// Short Title, and Alternative Id to the variant name of that button's recipe, so a pick on one
// alternative leaves every other button where it stood. This module imports nothing from
// `vscode`: the pane hands it the stored value and stores what it returns.

import type { Recipe } from './recipes';

/** The `workspaceState` key the selections are kept under. */
export const SELECTIONS_KEY = 'gurita.variantSelections';

/** The `workspaceState` key the selections of the buttons that belong to no mission are kept under, once per project. */
export const PROJECT_SELECTIONS_KEY = 'gurita.projectVariantSelections';

/** The `workspaceState` key the selections of the answer-with-alternative buttons are kept under, per mission, question, and alternative. */
export const ALTERNATIVE_SELECTIONS_KEY = 'gurita.alternativeVariantSelections';

/** The selections: by mission path, each recipe's selected variant name, by recipe name. */
export type Selections = Record<string, Record<string, string>>;

/** The selections remembered once per project: each recipe's selected variant name, by recipe name. */
export type ProjectSelections = Record<string, string>;

/**
 * The selections of the answer-with-alternative buttons: by mission path, by the question's Short
 * Title, the variant name selected for each alternative's button, by its Alternative Id.
 */
export type AlternativeSelections = Record<string, Record<string, Record<string, string>>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The selections a stored value holds: every mission path mapping to an object, and within it
 * every recipe name mapping to a variant name as text; anything else in the value is not read.
 */
export function readSelections(value: unknown): Selections {
  const selections: Selections = {};
  if (!isRecord(value)) {
    return selections;
  }
  for (const [mission, recipes] of Object.entries(value)) {
    if (!isRecord(recipes)) {
      continue;
    }
    const kept: Record<string, string> = {};
    for (const [recipe, variant] of Object.entries(recipes)) {
      if (typeof variant === 'string') {
        kept[recipe] = variant;
      }
    }
    if (Object.keys(kept).length > 0) {
      selections[mission] = kept;
    }
  }
  return selections;
}

/** The project's selections a stored value holds: every recipe name mapping to a variant name as text; anything else is not read. */
export function readProjectSelections(value: unknown): ProjectSelections {
  const kept: ProjectSelections = {};
  if (isRecord(value)) {
    for (const [recipe, variant] of Object.entries(value)) {
      if (typeof variant === 'string') {
        kept[recipe] = variant;
      }
    }
  }
  return kept;
}

/**
 * The project's selections with every remembered variant dropped that its recipe, as `recipes`
 * holds it, no longer carries, or undefined when none is dropped. A recipe `recipes` does not hold
 * keeps its remembered variant.
 */
export function dropStaleProjectSelections(selections: ProjectSelections, recipes: readonly Recipe[]): ProjectSelections | undefined {
  return dropStale(selections, recipes);
}

/** `remembered` with every variant its recipe in `recipes` no longer carries dropped, or undefined when none is. */
function dropStale(remembered: Record<string, string>, recipes: readonly Recipe[]): Record<string, string> | undefined {
  const kept: Record<string, string> = {};
  let dropped = false;
  for (const [name, variant] of Object.entries(remembered)) {
    const recipe = recipes.find((each) => each.name === name);
    if (recipe !== undefined && !recipe.variants.some((each) => each.name === variant)) {
      dropped = true;
    } else {
      kept[name] = variant;
    }
  }
  return dropped ? kept : undefined;
}

/** The variant names remembered for the mission at `mission`, by recipe name. */
export function missionSelections(selections: Selections, mission: string): Map<string, string> {
  return new Map(Object.entries(selections[mission] ?? {}));
}

/** The selections with `variant` remembered for the recipe `recipe` on the mission at `mission`. */
export function rememberSelection(selections: Selections, mission: string, recipe: string, variant: string): Selections {
  return { ...selections, [mission]: { ...(selections[mission] ?? {}), [recipe]: variant } };
}

/**
 * The selections with every remembered variant of the mission at `mission` dropped that its recipe,
 * as `recipes` holds it, no longer carries, or undefined when none is dropped. A recipe `recipes`
 * does not hold keeps its remembered variant, so a recipe list that holds a recipe again finds it.
 */
export function dropStaleSelections(selections: Selections, mission: string, recipes: readonly Recipe[]): Selections | undefined {
  const remembered = selections[mission];
  if (remembered === undefined) {
    return undefined;
  }
  const kept = dropStale(remembered, recipes);
  if (kept === undefined) {
    return undefined;
  }
  const next: Selections = { ...selections };
  if (Object.keys(kept).length > 0) {
    next[mission] = kept;
  } else {
    delete next[mission];
  }
  return next;
}

/** Sets `key` on `record` as an own property, whatever text the key holds, a Short Title such as `__proto__` included. */
function put<T>(record: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(record, key, { value, enumerable: true, writable: true, configurable: true });
}

/**
 * The answer-with-alternative selections a stored value holds: every mission path mapping to an
 * object of Short Titles, each mapping to an object of Alternative Ids, each mapping to a variant
 * name as text; anything else in the value is not read.
 */
export function readAlternativeSelections(value: unknown): AlternativeSelections {
  const selections: AlternativeSelections = {};
  if (!isRecord(value)) {
    return selections;
  }
  for (const [mission, questions] of Object.entries(value)) {
    if (!isRecord(questions)) {
      continue;
    }
    const keptQuestions: Record<string, Record<string, string>> = {};
    for (const [question, alternatives] of Object.entries(questions)) {
      const kept = readProjectSelections(alternatives);
      if (isRecord(alternatives) && Object.keys(kept).length > 0) {
        put(keptQuestions, question, kept);
      }
    }
    if (Object.keys(keptQuestions).length > 0) {
      put(selections, mission, keptQuestions);
    }
  }
  return selections;
}

/** The variant name remembered for the button of the alternative `alternative` of the question `question` on the mission at `mission`, if any. */
export function alternativeSelection(selections: AlternativeSelections, mission: string, question: string, alternative: string): string | undefined {
  const questions = Object.prototype.hasOwnProperty.call(selections, mission) ? selections[mission] : undefined;
  const alternatives = questions !== undefined && Object.prototype.hasOwnProperty.call(questions, question) ? questions[question] : undefined;
  return alternatives !== undefined && Object.prototype.hasOwnProperty.call(alternatives, alternative) ? alternatives[alternative] : undefined;
}

/** The selections with `variant` remembered for the button of the alternative `alternative` of the question `question` on the mission at `mission`. */
export function rememberAlternativeSelection(
  selections: AlternativeSelections,
  mission: string,
  question: string,
  alternative: string,
  variant: string,
): AlternativeSelections {
  const questions = selections[mission] ?? {};
  return { ...selections, [mission]: { ...questions, [question]: { ...(questions[question] ?? {}), [alternative]: variant } } };
}

/**
 * The answer-with-alternative selections with every remembered variant dropped that `recipe`, the
 * recipe those buttons run as the merged list holds it, no longer carries, or undefined when none
 * is dropped or the list holds no such recipe, so a recipe list that holds it again finds them.
 */
export function dropStaleAlternativeSelections(selections: AlternativeSelections, recipe: Recipe | undefined): AlternativeSelections | undefined {
  if (recipe === undefined) {
    return undefined;
  }
  const carried = new Set(recipe.variants.map((variant) => variant.name));
  const next: AlternativeSelections = {};
  let dropped = false;
  for (const [mission, questions] of Object.entries(selections)) {
    const keptQuestions: Record<string, Record<string, string>> = {};
    for (const [question, alternatives] of Object.entries(questions)) {
      const kept: Record<string, string> = {};
      for (const [alternative, variant] of Object.entries(alternatives)) {
        if (carried.has(variant)) {
          put(kept, alternative, variant);
        } else {
          dropped = true;
        }
      }
      if (Object.keys(kept).length > 0) {
        put(keptQuestions, question, kept);
      }
    }
    if (Object.keys(keptQuestions).length > 0) {
      put(next, mission, keptQuestions);
    }
  }
  return dropped ? next : undefined;
}
