import * as vscode from 'vscode';
import { registerMissionTree } from './missionTree';
import { openMissionPane, postRunning, refreshMissions } from './pane';
import { registerRuns } from './runs';

export function activate(context: vscode.ExtensionContext): void {
  const tree = registerMissionTree(context);
  registerRuns(context, {
    started: () => {
      postRunning();
      tree.redraw();
    },
    ended: () => {
      postRunning();
      tree.redraw();
      refreshMissions(context);
    },
  });
  context.subscriptions.push(
    vscode.commands.registerCommand('gurita.openMissionPane', () => openMissionPane(context)),
  );
}

export function deactivate(): void {}
