import * as vscode from 'vscode';
import { registerMissionTree } from './missionTree';
import { postRunning, refreshMissions } from './pane';
import { registerRuns } from './runs';
import { registerSettingsWindow } from './settingsWindow';

export function activate(context: vscode.ExtensionContext): void {
  const tree = registerMissionTree(context);
  registerSettingsWindow(context);
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
}

export function deactivate(): void {}
