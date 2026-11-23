import * as vscode from 'vscode';
import { registerMissionTree } from './missionTree';
import { openMissionPane, postRunning, refreshMissionPane } from './pane';
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
      refreshMissionPane(context);
    },
  });
  context.subscriptions.push(
    vscode.commands.registerCommand('gurita.openMissionPane', () => openMissionPane(context)),
    vscode.commands.registerCommand('gurita.refreshMissionPane', () => refreshMissionPane(context)),
  );
}

export function deactivate(): void {}
