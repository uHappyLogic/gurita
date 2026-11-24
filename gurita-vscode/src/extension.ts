import * as vscode from 'vscode';
import { registerCommitDocuments } from './commitDocuments';
import { registerMissionTree } from './missionTree';
import { postRunning, refreshMissions, registerMissionWindows } from './pane';
import { registerRuns } from './runs';
import { registerSettingsWindow } from './settingsWindow';

/** The one message activation shows on native Windows, where the extension leaves everything inert. */
export const NATIVE_WINDOWS_MESSAGE =
  'Gurita for VS Code runs only on macOS, Linux, or through Remote-WSL, so it does nothing in this native Windows window.';

/**
 * Whether the extension host runs on native Windows: the platform is `win32` and the window is not
 * a remote one. In a Remote-WSL window the extension runs on the Linux side, so this never holds there.
 */
function onNativeWindows(): boolean {
  return process.platform === 'win32' && !vscode.env.remoteName;
}

export function activate(context: vscode.ExtensionContext): void {
  if (onNativeWindows()) {
    void vscode.window.showErrorMessage(NATIVE_WINDOWS_MESSAGE);
    return;
  }
  const tree = registerMissionTree(context);
  registerMissionWindows(context);
  registerCommitDocuments(context);
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
