import * as vscode from 'vscode';
import { openMissionPane, refreshMissionPane } from './pane';
import { registerRuns } from './runs';

export function activate(context: vscode.ExtensionContext): void {
  registerRuns(context, () => refreshMissionPane(context));
  context.subscriptions.push(
    vscode.commands.registerCommand('gurita.openMissionPane', () => openMissionPane(context)),
    vscode.commands.registerCommand('gurita.refreshMissionPane', () => refreshMissionPane(context)),
  );
}

export function deactivate(): void {}
