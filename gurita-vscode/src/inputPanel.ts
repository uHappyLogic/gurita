// The input panel: a small webview panel opened as an editor tab of its own to ask for one long
// value a run needs, the answer text, the goal, or the issue description, where VS Code's input
// box would hold it on one line. Its page (`src/webview/input.ts`) draws the value's prompt above
// one textarea, with Run and Cancel beneath it, inside the page shell every window shares. The
// panel resolves the text typed when Run is pressed, and undefined when Cancel is pressed or its
// tab is closed, exactly as a dismissed input box does, and closes itself either way. A Run with
// nothing but blanks typed is refused on the page and resolves nothing, the panel staying open. The
// page keeps the text typed in its webview state, so a tab hidden and shown again holds it still.
// No serializer is registered for the panel's view type, so a panel open before a restart or a
// window reload is not restored, its value left unasked, as a box open then would be.

import * as vscode from 'vscode';
import { pageShell, webviewOptions } from './pane';

/** The view type of the input panel. */
export const INPUT_VIEW_TYPE = 'gurita.input';

/** What the input panel's page posts. */
type InputPageMessage = { type?: 'ready' | 'run' | 'cancel'; value?: unknown };

/**
 * Asks for one value in an input panel opened as an editor tab titled `title`, its page drawing
 * `prompt` above the textarea: resolves the text typed when Run is pressed with anything but blanks
 * typed, and undefined when Cancel is pressed or the tab is closed, the panel closed either way.
 */
export function askInPanel(context: vscode.ExtensionContext, title: string, prompt: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const scripts = vscode.Uri.joinPath(context.extensionUri, 'out', 'webview');
    const panel = vscode.window.createWebviewPanel(INPUT_VIEW_TYPE, title, vscode.ViewColumn.Active, webviewOptions(context));
    let settled = false;
    const settle = (value: string | undefined) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(value);
      panel.dispose();
    };
    panel.webview.html = pageShell(panel.webview, [vscode.Uri.joinPath(scripts, 'input.js')], title);
    panel.webview.onDidReceiveMessage(
      (message: InputPageMessage) => {
        if (message?.type === 'ready') {
          void panel.webview.postMessage({ type: 'input', prompt });
        } else if (message?.type === 'run') {
          if (typeof message.value === 'string' && message.value.trim() !== '') {
            settle(message.value);
          }
        } else if (message?.type === 'cancel') {
          settle(undefined);
        }
      },
      undefined,
      context.subscriptions,
    );
    panel.onDidDispose(() => settle(undefined), undefined, context.subscriptions);
  });
}
