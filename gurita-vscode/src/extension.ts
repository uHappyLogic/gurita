import * as vscode from 'vscode';
import { openMissionPane } from './pane';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('gurita.openMissionPane', () => openMissionPane(context)),
  );
}

export function deactivate(): void {}
