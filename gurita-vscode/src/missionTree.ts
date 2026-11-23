// The side-bar view: the one view of the extension's activity-bar container, a native tree with one
// leaf row per live mission and no child rows, in the order `missions.py live` prints them. Each
// row is drawn from the session's live read as `missionRows.ts` lays it out: its label the
// mission's title, its description the next workflow step's name and the two counts, its tooltip
// the five facts spelled out in full beside the mission's path, and its icon a spinning
// `ThemeIcon` while the mission's run is going and a steady mission icon otherwise. A click on a
// row opens nothing. The view's first resolution, its first `getChildren` call, starts the
// session's live read when no Gurita command has started it yet, and the tree is redrawn on every
// re-read the session keeps and at every run's start and end. Until the read settles, and while it
// fails, the tree holds no row.

import * as vscode from 'vscode';
import { MissionRow, missionRow } from './missionRows';
import { onSessionRead, sessionRead, startLiveRead } from './pane';
import { runningMissions } from './runs';

/** The id of the side-bar view, as the manifest's `views` entry contributes it. */
export const MISSIONS_VIEW = 'gurita.missions';

/** The icon of a mission row while the mission's run is going. */
export const RUNNING_ICON = 'loading~spin';

/** The icon of a mission row while no run of the mission is going. */
export const MISSION_ICON = 'rocket';

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
 * Creates the side-bar view's tree, redrawn on every re-read the session's live read keeps, and
 * returns it so the run listeners can redraw it at every run's start and end.
 */
export function registerMissionTree(context: vscode.ExtensionContext): MissionTree {
  const changed = new vscode.EventEmitter<void>();
  const provider: vscode.TreeDataProvider<MissionRow> = {
    onDidChangeTreeData: changed.event,
    getTreeItem: rowItem,
    getChildren(element?: MissionRow): MissionRow[] {
      if (element !== undefined) {
        return [];
      }
      startLiveRead(context);
      return missionRows();
    },
  };
  const redraw = (): void => changed.fire();
  context.subscriptions.push(changed, vscode.window.createTreeView(MISSIONS_VIEW, { treeDataProvider: provider }), onSessionRead(redraw));
  return { redraw };
}
