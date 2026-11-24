// The side-bar view: the one view of the extension's activity-bar container, a native tree of leaf
// rows but one, the Finished missions row described below, which has child rows: first, while it
// stands, the plugin notice row described below, then the
// two rows that start a mission, New mission and Define mission,
// standing above the mission rows in every state of the view, each drawn as `startingRows.ts` lays
// it out from the variant the project remembers for its recipe, a click on it running that variant
// and its inline icon action, also in its context menu, offering the recipe's variants in a
// QuickPick that changes the remembered one without starting a run; then one row per live mission,
// in the order `missions.py live` prints them. Each
// row is drawn from the session's live read as `missionRows.ts` lays it out: its label the
// mission's title, its description the next workflow step's name and the two counts, its tooltip
// the five facts spelled out in full beside the mission's path, and its icon a spinning
// `ThemeIcon` while the mission's run is going and a steady mission icon otherwise. A click on a
// mission row does nothing beyond running the open-mission command, hidden from the Command Palette,
// which opens that mission's own window in the editor area (`pane.ts`), or reveals it when one is
// already open. The view's first resolution, its first `getChildren` call, starts the
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
//
// The view's first resolution in a session also starts the harness check in the background, through
// the code path the Settings window runs (`startHarnessCheck`), unless it has already started; its
// result is kept for the session, so no re-read and no Refresh runs it again. While the latest
// finished check counts a harness as `pluginNotice.ts` lays out, or could not be run at all, the
// tree holds the plugin notice row at its very top, above the two mission-starting rows: a leaf with
// a warning icon, labelled that the plugin is missing or outdated, its hover text naming each
// counted harness or the check's cause, and its click running the Settings command. Each finished
// check and each enabling or disabling of a harness in the Settings window redraws the tree when the
// notice changes. The notice is a row alone: the view's message and the notifications are left to
// what the live read gives.
//
// While the session's live read has read the project root and neither `CLAUDE.md` nor `AGENTS.md`
// there holds a `## Mission Workflow` heading, as `bootstrapOffer.ts` reads them afresh at each
// resolution, whatever harnesses are enabled, the tree holds the bootstrap offer row directly
// beneath the plugin notice row and above the two mission-starting rows. It is drawn and run as
// those two are (`startingRows.ts`), from the shipped button recipe named by its skill,
// `init-mission-base-workflow`, with its own hidden command and the same variant action: a click
// runs the remembered variant, which asks for no value, at the project root, the run belonging to
// no mission. Once either file holds the heading the row is gone at the next redraw, which the
// bootstrap's commit, the run's end, and Refresh each bring.
//
// While the session's live read has read the project root, the tree holds the Finished missions row
// at its bottom, beneath the mission rows, a row with no mission live included: collapsed by
// default, its expansion lists every finished mission the record holds, read afresh at each
// expansion and each redraw while it stays expanded, as the bundled missions tool's `missions .`
// prints them with no `--last`, every `finished` line kept, newest first as the tool sorts them,
// with no count, setting, or further row limiting the list (`finishedMissions.ts`). Each finished
// mission's row is a leaf labelled with the mission's title, its path when its finish commit names
// none, described by the date it was finished,
// with its title, path, and finish date as its hover text, and its click runs a hidden command of
// its own that opens that mission's window, its summary and its completed tasks
// (`finishedWindow.ts`), or reveals it when one is open. With no mission finished the row expands
// to one leaf saying so, and while the read fails to one leaf with the failure line, the cause as
// its hover text.

import * as os from 'node:os';
import * as vscode from 'vscode';
import { HARNESSES } from './harnessCheck';
import { HarnessStates, readHarnessStates } from './harnessSettings';
import { MissionRow, missionRow } from './missionRows';
import {
  OPEN_MISSION_COMMAND,
  onSessionRead,
  onStartingSelection,
  openMissionWindow,
  pickStartingVariant,
  refreshMissions,
  runStartingRow,
  sessionRead,
  sessionRoot,
  startLiveRead,
  startingOffers,
} from './pane';
import { runningMissions } from './runs';
import { PLUGIN_NOTICE_LABEL, pluginNotice } from './pluginNotice';
import { SETTINGS_COMMAND, onHarnessCheck, refreshSettings, sessionHarnessCheck, startHarnessCheck } from './settingsWindow';
import { BOOTSTRAP_ROW, STARTING_ROWS, StartingButton, StartingRow, startingRow } from './startingRows';
import { BOOTSTRAP_REASON, bootstrapOffered } from './bootstrapOffer';
import { variantStoreFile } from './variantStore';
import { FinishedMission, readFinishedMissions } from './finishedMissions';
import { OPEN_FINISHED_COMMAND, openFinishedWindow } from './finishedWindow';

/** The hidden command a click on a mission row runs, opening or revealing that mission's window. */
export { OPEN_MISSION_COMMAND };

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

/** The command a click on each mission-starting row and on the bootstrap offer row runs, hidden from the Command Palette. */
export const STARTING_COMMANDS: Readonly<Record<StartingButton, string>> = {
  bootstrap: 'gurita.bootstrapWorkflow',
  discussGoal: 'gurita.newMission',
  defineMission: 'gurita.defineMission',
};

/** The command of the mission-starting rows' inline icon action and context-menu entry, hidden from the Command Palette. */
export const PICK_VARIANT_COMMAND = 'gurita.pickStartingVariant';

/** The `contextValue` of a mission-starting row and of the bootstrap offer row, which the manifest's `view/item/context` entries match. */
export const STARTING_ROW_CONTEXT = 'gurita.startingRow';

/** The icon of each mission-starting row and of the bootstrap offer row. */
export const STARTING_ICONS: Readonly<Record<StartingButton, string>> = {
  bootstrap: 'tools',
  discussGoal: 'comment-discussion',
  defineMission: 'new-folder',
};

/** The icon of the plugin notice row. */
export const PLUGIN_NOTICE_ICON = 'warning';

/** The id of the plugin notice row's tree item. */
export const PLUGIN_NOTICE_ID = 'gurita.pluginNotice';

/** The hidden command a click on a finished mission's row runs, opening or revealing that mission's window. */
export { OPEN_FINISHED_COMMAND };

/** The label of the row whose children are the finished missions. */
export const FINISHED_LABEL = 'Finished missions';

/** The id of the Finished missions row's tree item. */
export const FINISHED_ID = 'gurita.finishedMissions';

/** The icon of the Finished missions row. */
export const FINISHED_GROUP_ICON = 'archive';

/** The icon of each finished mission's row. */
export const FINISHED_ICON = 'pass';

/** The label of the one child the Finished missions row expands to while no mission is finished. */
export const NO_FINISHED_LABEL = 'No mission is finished.';

/** The label of the one child the Finished missions row expands to while the finished missions cannot be read. */
export const FINISHED_FAILURE_LABEL = 'The finished missions could not be read.';

/**
 * A row of the side-bar view: the plugin notice row with its hover text, the bootstrap offer row or
 * a mission-starting row, a live mission's row, the Finished missions row, a finished mission's row
 * beneath it, or the one note beneath it saying none is finished or the read failed.
 */
export type TreeRow =
  | { kind: 'notice'; tooltip: string }
  | { kind: 'starting'; row: StartingRow }
  | { kind: 'mission'; row: MissionRow }
  | { kind: 'finishedGroup' }
  | { kind: 'finished'; mission: FinishedMission }
  | { kind: 'finishedNote'; label: string; tooltip?: string };

/**
 * Each harness's enabled state, read afresh from the variant store file; every harness enabled,
 * as each starts, when the file cannot be read, the Settings window telling that failure.
 */
function enabledStates(): HarnessStates {
  try {
    return readHarnessStates(variantStoreFile(os.homedir()));
  } catch {
    return Object.fromEntries(HARNESSES.map((harness) => [harness.key, true])) as HarnessStates;
  }
}

/**
 * The plugin notice row's hover text for the session's latest finished harness check and each
 * harness's enabled state read afresh, or undefined while the row does not stand.
 */
export function noticeTooltip(): string | undefined {
  return pluginNotice(sessionHarnessCheck(), enabledStates());
}

/** The tree item drawing the plugin notice row: a leaf with a warning icon whose click opens the Settings window. */
export function noticeItem(tooltip: string): vscode.TreeItem {
  const item = new vscode.TreeItem(PLUGIN_NOTICE_LABEL, vscode.TreeItemCollapsibleState.None);
  item.id = PLUGIN_NOTICE_ID;
  item.tooltip = tooltip;
  item.iconPath = new vscode.ThemeIcon(PLUGIN_NOTICE_ICON);
  item.command = { command: SETTINGS_COMMAND, title: 'Open Settings' };
  return item;
}

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

/**
 * Whether the bootstrap offer row stands: the session's live read has read the project root and
 * neither context file there, read afresh, holds the workflow heading.
 */
export function bootstrapStands(): boolean {
  const root = sessionRoot();
  return root !== undefined && bootstrapOffered(root);
}

/**
 * The two mission-starting rows, beneath the bootstrap offer row when `bootstrap` holds, their
 * recipes read afresh, each on the variant the project remembers.
 */
export function startingRows(context: vscode.ExtensionContext, bootstrap = false): StartingRow[] {
  const offers = startingOffers(context);
  const rows = STARTING_ROWS.map(({ button, label }) => startingRow(button, label, offers[button]));
  return bootstrap ? [startingRow(BOOTSTRAP_ROW.button, BOOTSTRAP_ROW.label, offers[BOOTSTRAP_ROW.button], BOOTSTRAP_REASON), ...rows] : rows;
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

/**
 * The tree item drawing the row `row`: a leaf whose click runs the open-mission command with the
 * mission's path, opening that mission's window or revealing it when it is open.
 */
export function rowItem(row: MissionRow): vscode.TreeItem {
  const item = new vscode.TreeItem(row.label, vscode.TreeItemCollapsibleState.None);
  item.id = row.path;
  item.description = row.description;
  item.tooltip = row.tooltip;
  item.iconPath = new vscode.ThemeIcon(row.running ? RUNNING_ICON : MISSION_ICON);
  item.command = { command: OPEN_MISSION_COMMAND, title: 'Open Mission', arguments: [row.path] };
  return item;
}

/** The tree item drawing the Finished missions row: collapsed by default, its children the finished missions. */
export function finishedGroupItem(): vscode.TreeItem {
  const item = new vscode.TreeItem(FINISHED_LABEL, vscode.TreeItemCollapsibleState.Collapsed);
  item.id = FINISHED_ID;
  item.iconPath = new vscode.ThemeIcon(FINISHED_GROUP_ICON);
  return item;
}

/** The label of a finished mission's row: its title, or its path when its finish commit's body names none (the tool's `-`). */
export function finishedLabel(mission: FinishedMission): string {
  return mission.title === '-' || mission.title === '' ? mission.path : mission.title;
}

/**
 * The tree item drawing the finished mission `mission`: a leaf labelled with its title, described
 * by the date it was finished, whose click opens that mission's window or reveals it.
 */
export function finishedItem(mission: FinishedMission): vscode.TreeItem {
  const label = finishedLabel(mission);
  const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
  item.id = `${FINISHED_ID}.${mission.path}`;
  item.description = mission.date;
  item.tooltip = [label, mission.path, `Finished: ${mission.date}`].join('\n');
  item.iconPath = new vscode.ThemeIcon(FINISHED_ICON);
  item.command = { command: OPEN_FINISHED_COMMAND, title: 'Open Finished Mission', arguments: [mission.path, label] };
  return item;
}

/** The tree item drawing the note beneath the Finished missions row: a leaf with no click. */
export function finishedNoteItem(label: string, tooltip?: string): vscode.TreeItem {
  const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
  item.id = `${FINISHED_ID}.note`;
  if (tooltip !== undefined) {
    item.tooltip = tooltip;
  }
  return item;
}

/**
 * The children of the Finished missions row: one row per finished mission of the project at
 * `root`, newest first, read afresh with the bundled missions tool, every one kept; else the one
 * note saying none is finished, or that the read failed with its cause.
 */
export async function finishedRows(context: vscode.ExtensionContext, root: string | undefined): Promise<TreeRow[]> {
  if (root === undefined) {
    return [];
  }
  const read = await readFinishedMissions(root, context.asAbsolutePath('bundled/missions.py'));
  if (read.state === 'failed') {
    return [{ kind: 'finishedNote', label: FINISHED_FAILURE_LABEL, tooltip: read.cause }];
  }
  if (read.missions.length === 0) {
    return [{ kind: 'finishedNote', label: NO_FINISHED_LABEL }];
  }
  return read.missions.map((mission): TreeRow => ({ kind: 'finished', mission }));
}

/** The tree item drawing the row `element`, whatever its kind. */
function treeItem(element: TreeRow): vscode.TreeItem {
  switch (element.kind) {
    case 'notice':
      return noticeItem(element.tooltip);
    case 'starting':
      return startingItem(element.row);
    case 'mission':
      return rowItem(element.row);
    case 'finishedGroup':
      return finishedGroupItem();
    case 'finished':
      return finishedItem(element.mission);
    case 'finishedNote':
      return finishedNoteItem(element.label, element.tooltip);
  }
}

/**
 * Creates the side-bar view's tree, its rows and its message redrawn on every re-read the session's live read keeps, and
 * returns it so the run listeners can redraw it at every run's start and end.
 */
export function registerMissionTree(context: vscode.ExtensionContext): MissionTree {
  const changed = new vscode.EventEmitter<void>();
  /** The plugin notice row's hover text as the tree was last resolved with, undefined with no row. */
  let drawnNotice: string | undefined;
  const provider: vscode.TreeDataProvider<TreeRow> = {
    onDidChangeTreeData: changed.event,
    getTreeItem: treeItem,
    getChildren(element?: TreeRow): TreeRow[] | Promise<TreeRow[]> {
      if (element !== undefined) {
        return element.kind === 'finishedGroup' ? finishedRows(context, sessionRoot()) : [];
      }
      startLiveRead(context);
      startHarnessCheck(context);
      drawnNotice = noticeTooltip();
      return [
        ...(drawnNotice === undefined ? [] : [{ kind: 'notice', tooltip: drawnNotice } as TreeRow]),
        ...startingRows(context, bootstrapStands()).map((row): TreeRow => ({ kind: 'starting', row })),
        ...missionRows().map((row): TreeRow => ({ kind: 'mission', row })),
        ...(sessionRoot() === undefined ? [] : [{ kind: 'finishedGroup' } as TreeRow]),
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
    onHarnessCheck(() => {
      if (noticeTooltip() !== drawnNotice) {
        redraw();
      }
    }),
    vscode.commands.registerCommand(REFRESH_COMMAND, () => {
      refreshMissions(context);
      void refreshSettings(context);
    }),
    ...[BOOTSTRAP_ROW, ...STARTING_ROWS].map(({ button }) =>
      vscode.commands.registerCommand(STARTING_COMMANDS[button], () => {
        startLiveRead(context);
        return runStartingRow(context, button);
      }),
    ),
    vscode.commands.registerCommand(OPEN_MISSION_COMMAND, (mission?: unknown) => {
      if (typeof mission === 'string') {
        openMissionWindow(context, mission);
      } else {
        startLiveRead(context);
      }
    }),
    vscode.commands.registerCommand(OPEN_FINISHED_COMMAND, (mission?: unknown, title?: unknown) => {
      const root = sessionRoot();
      if (typeof mission === 'string' && root !== undefined) {
        openFinishedWindow(context, root, mission, typeof title === 'string' && title !== '' ? title : mission);
      } else {
        startLiveRead(context);
      }
    }),
    vscode.commands.registerCommand(PICK_VARIANT_COMMAND, (element?: TreeRow) => {
      startLiveRead(context);
      return element?.kind === 'starting' ? pickStartingVariant(context, element.row.button) : undefined;
    }),
  );
  return { redraw };
}
