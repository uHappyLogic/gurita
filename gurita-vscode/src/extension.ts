import * as vscode from 'vscode';
import { registerMissionTree } from './missionTree';
import { postRunning, refreshMissions, registerMissionWindows } from './pane';
import { registerRuns } from './runs';
import { registerSettingsWindow } from './settingsWindow';

export function activate(context: vscode.ExtensionContext): void {
  const tree = registerMissionTree(context);
  registerMissionWindows(context);
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
