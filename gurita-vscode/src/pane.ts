// The mission pane: the one webview panel in the editor area the extension holds. Its
// `webview.html` is set once, to a page shell whose script, loaded from the output directory
// through `asWebviewUri` under a content security policy, posts a ready message on every load
// and draws what the extension answers. The extension answers every ready message with the live
// missions, read afresh, each carrying its documents as the in-process readers parse them, or
// with the one failure state the live read gives; the page redraws its rows in place from every
// such message.

import * as vscode from 'vscode';
import { MissionDocuments, readMissionDocuments } from './documents';
import { LiveRead, readLive } from './live';

const VIEW_TYPE = 'gurita.missionPane';
const PANEL_TITLE = 'Gurita Missions';

/** A message the page posts to the extension. */
type PageMessage = { type: 'ready' };

/** A message the extension posts to the page. */
type PaneMessage =
  | { type: 'live'; missions: ({ path: string; state: string; title: string } & MissionDocuments)[] }
  | { type: 'liveFailure'; cause: string };

let panel: vscode.WebviewPanel | undefined;

/** Creates the one mission pane, or reveals the one the extension already holds. */
export function openMissionPane(context: vscode.ExtensionContext): void {
  if (panel !== undefined) {
    panel.reveal();
    return;
  }
  const scripts = vscode.Uri.joinPath(context.extensionUri, 'out', 'webview');
  const created = vscode.window.createWebviewPanel(VIEW_TYPE, PANEL_TITLE, vscode.ViewColumn.Active, {
    enableScripts: true,
    localResourceRoots: [scripts],
  });
  panel = created;
  created.webview.html = pageShell(created.webview, vscode.Uri.joinPath(scripts, 'page.js'));
  created.webview.onDidReceiveMessage(
    (message: PageMessage) => {
      if (message?.type === 'ready') {
        void answer(context, created);
      }
    },
    undefined,
    context.subscriptions,
  );
  created.onDidDispose(
    () => {
      if (panel === created) {
        panel = undefined;
      }
    },
    undefined,
    context.subscriptions,
  );
}

async function answer(context: vscode.ExtensionContext, target: vscode.WebviewPanel): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const read: LiveRead = await readLive(folder, context.asAbsolutePath('bundled/missions.py'));
  const message: PaneMessage =
    read.state === 'read'
      ? {
          type: 'live',
          missions: read.missions.map((mission) => ({ ...mission, ...readMissionDocuments(read.root, mission.path) })),
        }
      : { type: 'liveFailure', cause: read.cause };
  try {
    await target.webview.postMessage(message);
  } catch {
    // The panel was closed while the read ran; there is no page left to answer.
  }
}

function nonce(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';
  for (let index = 0; index < 32; index += 1) {
    value += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return value;
}

function pageShell(webview: vscode.Webview, script: vscode.Uri): string {
  const token = nonce();
  const policy = [
    "default-src 'none'",
    `style-src 'nonce-${token}'`,
    `script-src 'nonce-${token}' ${webview.cspSource}`,
  ].join('; ');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${policy}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${PANEL_TITLE}</title>
<style nonce="${token}">
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 0 1em; }
  .tabs { display: flex; flex-wrap: wrap; gap: 0.25em; border-bottom: 1px solid var(--vscode-panel-border); padding: 0.5em 0; }
  .tabs button { background: none; color: var(--vscode-foreground); border: 1px solid transparent; padding: 0.3em 0.8em; cursor: pointer; font: inherit; }
  .tabs button[aria-selected="true"] { border-color: var(--vscode-focusBorder); background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
  .facts { display: grid; grid-template-columns: max-content auto; gap: 0.25em 1em; margin: 1em 0; }
  .facts dt { opacity: 0.7; }
  .facts dd { margin: 0; }
  .failure pre, .notice pre { white-space: pre-wrap; font-family: var(--vscode-editor-font-family); }
  .label { display: flex; flex-wrap: wrap; gap: 0.4em; list-style: none; padding: 0; margin: 0 0 1em; }
  .label li { border: 1px solid var(--vscode-panel-border); border-radius: 1em; padding: 0.1em 0.7em; }
  .notice { border-left: 3px solid var(--vscode-inputValidation-warningBorder); padding: 0.2em 0.8em; }
  .controls { display: flex; gap: 0.5em; margin-bottom: 0.5em; }
  button.control { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; padding: 0.25em 0.8em; cursor: pointer; font: inherit; }
  .row { border-bottom: 1px solid var(--vscode-panel-border); }
  button.row-head { display: flex; gap: 0.6em; width: 100%; text-align: left; background: none; color: var(--vscode-foreground); border: none; padding: 0.4em 0; cursor: pointer; font: inherit; }
  .row-head .pick-id { margin-left: auto; opacity: 0.75; }
  .row .body { padding: 0 0 0.8em 1.4em; }
  .alternative { margin: 0.4em 0; padding-left: 0.6em; border-left: 2px solid var(--vscode-panel-border); }
  .alternative.picked { border-left-color: var(--vscode-focusBorder); }
  .body h4, .body h5 { margin: 0.6em 0 0.2em; }
  button.link { background: none; border: none; padding: 0; color: var(--vscode-textLink-foreground); cursor: pointer; font: inherit; text-decoration: underline; }
</style>
</head>
<body>
<div id="root"></div>
<script nonce="${token}" src="${webview.asWebviewUri(script).toString()}"></script>
</body>
</html>`;
}
