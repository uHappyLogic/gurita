// What the side-bar view's two rows that start a mission show, standing above the mission rows in
// every state of the view: **New mission**, which runs the `discuss-mission-goal` recipe, and
// **Define mission**, which runs the `define-mission-goal` recipe. Each row is labelled with its
// control's name, and its description shows the harness, model, and effort of the variant
// remembered for its recipe once per project, read from that variant's lines one line at a time
// (`readLine`), each value named once in the order the lines first carry it. Its tooltip names the
// recipe, as `Action: <name>`, and the variant, with the variant's lines as written beneath them. A row whose every
// variant is left out for a disabled harness, or whose recipe cannot be read or run, says so in its
// description, with the cause in its tooltip. The bootstrap offer row, **Bootstrap the workflow**,
// which runs the `init-mission-base-workflow` recipe while the project's context files hold no
// workflow section (`bootstrapOffer.ts`), is laid out the same way, its tooltip also saying why it
// stands. This module imports nothing from `vscode`.

import { HARNESSES } from './harnessCheck';
import { readLine } from './lineValues';

/** A mission-starting control or the bootstrap offer, by the key its fixed-name recipe is listed under. */
export type StartingButton = 'bootstrap' | 'discussGoal' | 'defineMission';

/** The two mission-starting rows, in the order the view draws them, each with its control's name. */
export const STARTING_ROWS: readonly { button: StartingButton; label: string }[] = [
  { button: 'discussGoal', label: 'New mission' },
  { button: 'defineMission', label: 'Define mission' },
];

/** The bootstrap offer row, drawn above the two mission-starting rows while it stands, with its control's name. */
export const BOOTSTRAP_ROW: { button: StartingButton; label: string } = { button: 'bootstrap', label: 'Bootstrap the workflow' };

/** The separator between the description's harness, model, and effort, as the mission rows' slots use it. */
export const VALUE_SEPARATOR = ' · ';

/** The description of a row whose every variant it could run is left out for a disabled harness. */
export const DISABLED_DESCRIPTION = 'no variant enabled';

/** The description of a row whose recipe cannot be read or run. */
export const REFUSED_DESCRIPTION = 'cannot run';

/** A variant a mission-starting row can run: its name and its lines as written. */
export interface StartingVariant {
  name: string;
  lines: string[];
}

/**
 * What a mission-starting row runs: the variants its recipe offers, in the recipe's order, and the
 * index of the one selected, the variant remembered for the recipe, else its default, else the
 * first offered; or no variant, every one left out for a disabled harness; or the cause its recipe
 * cannot be read or run.
 */
export type StartingOffer =
  | { state: 'offered'; recipe: string; variants: StartingVariant[]; selected: number }
  | { state: 'disabled'; recipe: string; cause: string }
  | { state: 'refused'; cause: string };

/** One mission-starting row as the side-bar view draws it. */
export interface StartingRow {
  button: StartingButton;
  label: string;
  description: string;
  tooltip: string;
}

/** The name the settings view gives the harness a line opens with. */
function harnessName(command: string): string {
  return HARNESSES.find((harness) => harness.cli === command)?.name ?? command;
}

/** `values` with each one kept once, in the order of its first appearance. */
function distinct(values: (string | undefined)[]): string[] {
  const kept: string[] = [];
  for (const value of values) {
    if (value !== undefined && !kept.includes(value)) {
      kept.push(value);
    }
  }
  return kept;
}

/**
 * The harness, model, and effort the lines `lines` carry, each read from one line at a time: the
 * harness by the name the settings view gives it, every slot naming each value once in the order
 * the lines first carry it, its values joined by a comma, and a slot no line carries a value for
 * left out. Undefined when no line carries any of the three.
 */
export function variantValues(lines: readonly string[]): string | undefined {
  const read = lines.map(readLine);
  const slots = [
    distinct(read.map((values) => (values === undefined ? undefined : harnessName(values.harness)))),
    distinct(read.map((values) => values?.model)),
    distinct(read.map((values) => values?.effort)),
  ]
    .filter((slot) => slot.length > 0)
    .map((slot) => slot.join(', '));
  return slots.length === 0 ? undefined : slots.join(VALUE_SEPARATOR);
}

/**
 * The row of the mission-starting control `button`, labelled `label`, for what it runs, `offer`:
 * described by the selected variant's harness, model, and effort, or by the variant's name when its
 * lines carry none of the three, and with the recipe, the variant, and its lines in its tooltip,
 * the line `note`, when given, standing directly beneath the label.
 */
export function startingRow(button: StartingButton, label: string, offer: StartingOffer, note?: string): StartingRow {
  const head = note === undefined ? [label] : [label, note];
  if (offer.state === 'offered') {
    const variant = offer.variants[offer.selected];
    return {
      button,
      label,
      description: variantValues(variant.lines) ?? variant.name,
      tooltip: [...head, `Action: ${offer.recipe}`, `Variant: ${variant.name}`, ...variant.lines].join('\n'),
    };
  }
  return {
    button,
    label,
    description: offer.state === 'disabled' ? DISABLED_DESCRIPTION : REFUSED_DESCRIPTION,
    tooltip: [...head, offer.cause].join('\n'),
  };
}
