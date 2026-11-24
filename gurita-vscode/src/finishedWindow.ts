// The finished missions' windows: one webview panel in the editor area per finished mission, opened
// by a click on that mission's row beneath the side-bar view's Finished missions row
// (`missionTree.ts`) through a hidden command of its own, which reveals the mission's window when one
// is already open, never two for one mission. Each window's editor tab is titled with the mission's
// title as its row shows it and carries one fixed built-in codicon through a `ThemeIcon`. Its
// `webview.html` is set once, to the page shell every window shares, loading the text renderer and
// then its page script (`src/webview/finished.ts`), which posts a ready message on every load; the
// extension answers each one by reading afresh, from the project root the session's live read last
// read, the mission's summary, as the bundled missions tool's `summary <path>` prints it, and its
// completed tasks, each with its verified bar, as `tasks <path> --with-body` prints them, the read
// the mission window's Tasks pane draws, and posts both. A click on a completed task's commit link
// opens that commit as a read-only text document with the diff language in an editor tab of its own
// through the extension's commit documents (`commitDocuments.ts`), a hash the latest answer did not
// post opening nothing. The window starts no run and offers no action. No serializer is registered
// for its view type, so a window open before a restart or a window reload is not restored.

import * as vscode from 'vscode';
import { CompletedRead, readCompletedTasks } from './completedTasks';
import { openCommit } from './commitDocuments';
import { SummaryRead, readFinishedSummary } from './finishedMissions';
import { pageShell, webviewOptions } from './pane';

/** The view type of every finished mission's window. */
export const FINISHED_VIEW_TYPE = 'gurita.finishedMission';

/** The built-in codicon every finished mission's window's editor tab carries. */
export const FINISHED_WINDOW_ICON = 'archive';

/** The hidden command a click on a finished mission's row runs, opening or revealing its window. */
export const OPEN_FINISHED_COMMAND = 'gurita.openFinishedMission';

/** What a finished mission's window's page posts. */
type FinishedPageMessage = { type?: 'ready' | 'openCommit'; mission?: unknown; hash?: unknown };

/** What the extension posts to a finished mission's window's page. */
export interface FinishedMessage {
  type: 'finished';
  mission: { path: string; title: string; summary: SummaryRead; completed: CompletedRead };
}

/** One open finished mission's window: its panel, its project root, and the commit hashes its latest answer posted. */
interface FinishedWindow {
  panel: vscode.WebviewPanel;
  root: string;
  commits: Set<string>;
}

/** Every open finished mission's window, by its mission's path. */
const windows = new Map<string, FinishedWindow>();

/** The paths of the finished missions whose window is open, in the order the windows were opened. */
export function openFinishedWindows(): string[] {
  return [...windows.keys()];
}

/**
 * What the window of the finished mission at `mission`, titled `title`, is answered with: its
 * summary and its completed tasks, both read afresh with the bundled missions tool from `root`.
 */
export async function finishedAnswer(context: vscode.ExtensionContext, root: string, mission: string, title: string): Promise<FinishedMessage> {
  const tool = context.asAbsolutePath('bundled/missions.py');
  const [summary, completed] = await Promise.all([readFinishedSummary(root, tool, mission), readCompletedTasks(root, tool, mission)]);
  return { type: 'finished', mission: { path: mission, title, summary, completed } };
}

/**
 * Opens the window of the finished mission at `mission`, its path as the missions tool prints it,
 * in the project at `root`, its editor tab titled `title`, or reveals it when one is already open.
 */
export function openFinishedWindow(context: vscode.ExtensionContext, root: string, mission: string, title: string): void {
  const open = windows.get(mission);
  if (open !== undefined) {
    open.panel.reveal();
    return;
  }
  const panel = vscode.window.createWebviewPanel(FINISHED_VIEW_TYPE, title, vscode.ViewColumn.Active, webviewOptions(context));
  const win: FinishedWindow = { panel, root, commits: new Set() };
  windows.set(mission, win);
  // A codicon as a webview panel's icon is typed from VS Code 1.108 on, above the engine floor, as
  // the mission windows' is.
  (panel as { iconPath?: vscode.IconPath }).iconPath = new vscode.ThemeIcon(FINISHED_WINDOW_ICON);
  const scripts = vscode.Uri.joinPath(context.extensionUri, 'out', 'webview');
  panel.webview.html = pageShell(panel.webview, [vscode.Uri.joinPath(scripts, 'text.js'), vscode.Uri.joinPath(scripts, 'finished.js')], title);
  panel.webview.onDidReceiveMessage(
    (message: FinishedPageMessage) => {
      if (message?.type === 'ready') {
        void finishedAnswer(context, root, mission, title).then((answer) => {
          if (windows.get(mission) !== win) {
            return;
          }
          win.commits = new Set(answer.mission.completed.state === 'read' ? answer.mission.completed.tasks.map((task) => task.hash) : []);
          void panel.webview.postMessage(answer);
        });
      } else if (message?.type === 'openCommit') {
        if (message.mission === mission && typeof message.hash === 'string' && win.commits.has(message.hash)) {
          void openCommit(win.root, message.hash);
        }
      }
    },
    undefined,
    context.subscriptions,
  );
  panel.onDidDispose(
    () => {
      if (windows.get(mission) === win) {
        windows.delete(mission);
      }
    },
    undefined,
    context.subscriptions,
  );
}
