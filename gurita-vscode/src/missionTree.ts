// The side-bar view: the one view of the extension's activity-bar container, a native tree of leaf
// rows with no child rows: first the two rows that start a mission, New mission and Define mission,
// standing above the mission rows in every state of the view, each drawn as `startingRows.ts` lays
// it out from the variant the project remembers for its recipe, a click on it running that variant
// and its inline icon action, also in its context menu, offering the recipe's variants in a
// QuickPick that changes the remembered one without starting a run; then one row per live mission,
// in the order `missions.py live` prints them. Each
// row is drawn from the session's live read as `missionRows.ts` lays it out: its label the
// mission's title, its description the next workflow step's name and the two counts, its tooltip
// the five facts spelled out in full beside the mission's path, and its icon a spinning
// `ThemeIcon` while the mission's run is going and a steady mission icon otherwise. A click on a
// mission row opens nothing. The view's first resolution, its first `getChildren` call, starts the
// session's live read when no Gurita command has started it yet, and the tree is redrawn on every
// re-read the session keeps and at every run's start and end. Until the read settles, and while it
// fails, the tree holds no mission row. Each state in which it holds no mission row is shown through the
// view's own `message`: `No mission is live.` with no mission live, and the failure line followed by
// the cause as the read gave it while the read fails; a read with missions clears it. The two
// mission-starting rows are redrawn too whenever the variant remembered for either changes. The
// view's title bar carries Refresh as an icon action running the refresh command, the one command
// of the extension's own the Command Palette offers beside the view's focus command, which re-reads
// the live missions and redraws the tree and every open window from the fresh read, the Settings
// window included, and beside it Settings, an icon action running the Settings command, hidden from
// the Command Palette, which opens the Settings window (`settingsWindow.ts`) or reveals it.

import * as vscode from 'vscode';
import { MissionRow, missionRow } from './missionRows';
import { onSessionRead, onStartingSelection, pickStartingVariant, refreshMissions, runStartingRow, sessionRead, startLiveRead, startingOffers } from './pane';
import { runningMissions } from './runs';
import { refreshSettings } from './settingsWindow';
import { STARTING_ROWS, StartingButton, StartingRow, startingRow } from './startingRows';

/** The id of the side-bar view, as the manifest's `views` entry contributes it. */
export const MISSIONS_VIEW = 'gurita.missions';

/** The icon of a mission row while the mission's run is going. */
export const RUNNING_ICON = 'loading~spin';

/** The icon of a mission row while no run of the mission is going. */
export const MISSION_ICON = 'rocket';

/**
 * The refresh command, Gurita: Refresh Missions, which the Command Palette offers and the view's
 * Refresh title-bar action runs: it re-reads the live missions, redrawing the tree and every open
 * window from the fresh read, and re-reads the Settings window while it is shown.
 */
export const REFRESH_COMMAND = 'gurita.refreshMissions';

/** The command a click on each mission-starting row runs, hidden from the Command Palette. */
export const STARTING_COMMANDS: Readonly<Record<StartingButton, string>> = {
  discussGoal: 'gurita.newMission',
  defineMission: 'gurita.defineMission',
};

/** The command of the mission-starting rows' inline icon action and context-menu entry, hidden from the Command Palette. */
export const PICK_VARIANT_COMMAND = 'gurita.pickStartingVariant';

/** The `contextValue` of a mission-starting row, which the manifest's `view/item/context` entries match. */
export const STARTING_ROW_CONTEXT = 'gurita.startingRow';

/** The icon of each mission-starting row. */
export const STARTING_ICONS: Readonly<Record<StartingButton, string>> = {
  discussGoal: 'comment-discussion',
  defineMission: 'new-folder',
};

/** A row of the side-bar view: a mission-starting row or a live mission's row. */
export type TreeRow = { kind: 'starting'; row: StartingRow } | { kind: 'mission'; row: MissionRow };

/** The view's message while the session's live read lists no mission. */
export const NO_MISSION_MESSAGE = 'No mission is live.';

/** The opening of the view's message while the session's live read fails, the cause following it. */
export const FAILURE_MESSAGE = 'The live missions could not be read.';

/**
 * The view's message for the session's live read as it stands: the no-mission line, the failure
 * line followed by the cause, or none while the read is pending or lists missions.
 */
export function viewMessage(): string | undefined {
  const read = sessionRead();
  if (read.state === 'failed') {
    return `${FAILURE_MESSAGE} ${read.cause}`;
  }
  if (read.state === 'read' && read.missions.length === 0) {
    return NO_MISSION_MESSAGE;
  }
  return undefined;
}

/** The side-bar view's tree, which `redraw` asks the editor to draw afresh. */
export interface MissionTree {
  redraw(): void;
}

/** The rows of the session's live read as it stands: one per live mission, none until it reads. */
export function missionRows(): MissionRow[] {
  const read = sessionRead();
  if (read.state !== 'read') {
    return [];
  }
  const running = new Set(runningMissions());
  return read.missions.map(({ mission, documents, workflow }) => missionRow(mission, documents, workflow, running.has(mission.path)));
}

/** The two mission-starting rows, their recipes read afresh, each on the variant the project remembers. */
export function startingRows(context: vscode.ExtensionContext): StartingRow[] {
  const offers = startingOffers(context);
  return STARTING_ROWS.map(({ button, label }) => startingRow(button, label, offers[button]));
}

/**
 * The tree item drawing the mission-starting row `row`: a leaf whose click runs the variant it
 * describes, its `contextValue` offering the inline icon action and the context-menu entry.
 */
export function startingItem(row: StartingRow): vscode.TreeItem {
  const item = new vscode.TreeItem(row.label, vscode.TreeItemCollapsibleState.None);
  item.id = `gurita.starting.${row.button}`;
  item.description = row.description;
  item.tooltip = row.tooltip;
  item.iconPath = new vscode.ThemeIcon(STARTING_ICONS[row.button]);
  item.contextValue = STARTING_ROW_CONTEXT;
  item.command = { command: STARTING_COMMANDS[row.button], title: row.label };
  return item;
}

/** The tree item drawing the row `row`: a leaf with no command, so a click on it opens nothing. */
export function rowItem(row: MissionRow): vscode.TreeItem {
  const item = new vscode.TreeItem(row.label, vscode.TreeItemCollapsibleState.None);
  item.id = row.path;
  item.description = row.description;
  item.tooltip = row.tooltip;
  item.iconPath = new vscode.ThemeIcon(row.running ? RUNNING_ICON : MISSION_ICON);
  return item;
}

/**
 * Creates the side-bar view's tree, its rows and its message redrawn on every re-read the session's live read keeps, and
 * returns it so the run listeners can redraw it at every run's start and end.
 */
export function registerMissionTree(context: vscode.ExtensionContext): MissionTree {
  const changed = new vscode.EventEmitter<void>();
  const provider: vscode.TreeDataProvider<TreeRow> = {
    onDidChangeTreeData: changed.event,
    getTreeItem: (element: TreeRow) => (element.kind === 'starting' ? startingItem(element.row) : rowItem(element.row)),
    getChildren(element?: TreeRow): TreeRow[] {
      if (element !== undefined) {
        return [];
      }
      startLiveRead(context);
      return [
        ...startingRows(context).map((row): TreeRow => ({ kind: 'starting', row })),
        ...missionRows().map((row): TreeRow => ({ kind: 'mission', row })),
      ];
    },
  };
  const view = vscode.window.createTreeView(MISSIONS_VIEW, { treeDataProvider: provider });
  const redraw = (): void => {
    view.message = viewMessage();
    changed.fire();
  };
  context.subscriptions.push(
    changed,
    view,
    onSessionRead(redraw),
    onStartingSelection(redraw),
    vscode.commands.registerCommand(REFRESH_COMMAND, () => {
      refreshMissions(context);
      void refreshSettings(context);
    }),
    ...STARTING_ROWS.map(({ button }) =>
      vscode.commands.registerCommand(STARTING_COMMANDS[button], () => {
        startLiveRead(context);
        return runStartingRow(context, button);
      }),
    ),
    vscode.commands.registerCommand(PICK_VARIANT_COMMAND, (element?: TreeRow) => {
      startLiveRead(context);
      return element?.kind === 'starting' ? pickStartingVariant(context, element.row.button) : undefined;
    }),
  );
  return { redraw };
}
