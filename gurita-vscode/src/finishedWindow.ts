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
// post opening nothing. The window offers one action, Capture principles, which runs the shipped
// button recipe named by its skill, `capture-mission-principle-updates`, its variants those an own
// recipe of the same name adds beside the shipped one, the variant store laid over them, picked as
// the mission-starting rows' are (`captureButton` in `pane.ts`): each answer posts what the button
// runs, read afresh, offering in an arrow-only dropdown beside it the variants it can run, a variant
// with a line on a disabled harness left out, and standing on the variant remembered once per
// project, else the recipe's default. A pick in the dropdown is remembered once per project and
// every open finished mission's window answered again, as it is after every edit in the Settings
// window. A click runs the variant the latest answer posted the button standing on, with the
// mission's path filling `<path>`, the one value its line holds, passed as the skill's positional
// argument with no `--mission`, so nothing is typed; the shipped line is an interactive one, since
// the skill asks for one confirmation before it commits. The run starts at the project root and is
// held under the finished mission's path, so a second click while it is going starts nothing and
// reveals its terminal. A button whose recipe cannot be read or run is posted with no entry and its
// click tells why in an error notification. No serializer is registered for its view type, so a
// window open before a restart or a window reload is not restored.

import * as vscode from 'vscode';
import { CompletedRead, readCompletedTasks } from './completedTasks';
import { openCommit } from './commitDocuments';
import { SummaryRead, readFinishedSummary } from './finishedMissions';
import { ButtonPost, FixedButtonEntry, captureButton, onStartingSelection, pageShell, postedRun, rememberProjectVariant, webviewOptions } from './pane';
import { startChain } from './runs';

/** The view type of every finished mission's window. */
export const FINISHED_VIEW_TYPE = 'gurita.finishedMission';

/** The built-in codicon every finished mission's window's editor tab carries. */
export const FINISHED_WINDOW_ICON = 'archive';

/** The hidden command a click on a finished mission's row runs, opening or revealing its window. */
export const OPEN_FINISHED_COMMAND = 'gurita.openFinishedMission';

/** The label of the window's one action button, which runs `capture-mission-principle-updates`. */
export const CAPTURE_LABEL = 'Capture principles';

/** What a finished mission's window's page posts. */
type FinishedPageMessage = {
  type?: 'ready' | 'openCommit' | 'capturePrinciples' | 'selectCaptureVariant';
  mission?: unknown;
  hash?: unknown;
  variant?: unknown;
};

/** What the extension posts to a finished mission's window's page. */
export interface FinishedMessage {
  type: 'finished';
  mission: { path: string; title: string; summary: SummaryRead; completed: CompletedRead; capture?: FixedButtonEntry };
}

/**
 * One open finished mission's window: its panel, its project root, its title, the commit hashes its
 * latest answer posted, and what that answer posted for its Capture principles button.
 */
interface FinishedWindow {
  panel: vscode.WebviewPanel;
  root: string;
  title: string;
  commits: Set<string>;
  capture?: ButtonPost;
}

/** Every open finished mission's window, by its mission's path. */
const windows = new Map<string, FinishedWindow>();

/** Whether the listener answering every open window again after a change to the remembered variants is registered. */
let listening = false;

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
 * Answers the open window `win` of the finished mission at `mission`: its summary and completed
 * tasks read afresh, and what its Capture principles button runs, its recipe read afresh, noting
 * the commit hashes and the button posted as what the latest answer posted. An answer reaching a
 * window closed or replaced meanwhile is dropped.
 */
async function answerWindow(context: vscode.ExtensionContext, mission: string, win: FinishedWindow): Promise<void> {
  const answer = await finishedAnswer(context, win.root, mission, win.title);
  if (windows.get(mission) !== win) {
    return;
  }
  const { entry, post } = captureButton(context);
  win.commits = new Set(answer.mission.completed.state === 'read' ? answer.mission.completed.tasks.map((task) => task.hash) : []);
  win.capture = post;
  const message: FinishedMessage = entry === undefined ? answer : { ...answer, mission: { ...answer.mission, capture: entry } };
  void win.panel.webview.postMessage(message);
}

/**
 * Runs the Capture principles button of the window `win` of the finished mission at `mission` on
 * the variant named `variant`, only when the latest answer posted the button standing on it: its
 * lines with the mission's path as `<path>`, started at the project root and held under the
 * mission's path. A button posted as refused tells why in an error notification.
 */
function runCapture(context: vscode.ExtensionContext, mission: string, win: FinishedWindow, variant: unknown): void {
  const run = postedRun(win.capture, variant);
  if (run === undefined) {
    return;
  }
  startChain(context, win.root, mission, run.name, run.lines, { path: mission });
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
  if (!listening) {
    listening = true;
    context.subscriptions.push(
      onStartingSelection(() => {
        for (const [path, each] of windows) {
          void answerWindow(context, path, each);
        }
      }),
    );
  }
  const panel = vscode.window.createWebviewPanel(FINISHED_VIEW_TYPE, title, vscode.ViewColumn.Active, webviewOptions(context));
  const win: FinishedWindow = { panel, root, title, commits: new Set() };
  windows.set(mission, win);
  // A codicon as a webview panel's icon is typed from VS Code 1.108 on, above the engine floor, as
  // the mission windows' is.
  (panel as { iconPath?: vscode.IconPath }).iconPath = new vscode.ThemeIcon(FINISHED_WINDOW_ICON);
  const scripts = vscode.Uri.joinPath(context.extensionUri, 'out', 'webview');
  panel.webview.html = pageShell(panel.webview, [vscode.Uri.joinPath(scripts, 'text.js'), vscode.Uri.joinPath(scripts, 'finished.js')], title);
  panel.webview.onDidReceiveMessage(
    (message: FinishedPageMessage) => {
      if (message?.type === 'ready') {
        void answerWindow(context, mission, win);
      } else if (message?.type === 'openCommit') {
        if (message.mission === mission && typeof message.hash === 'string' && win.commits.has(message.hash)) {
          void openCommit(win.root, message.hash);
        }
      } else if (message?.type === 'capturePrinciples') {
        if (message.mission === mission) {
          runCapture(context, mission, win, message.variant);
        }
      } else if (message?.type === 'selectCaptureVariant') {
        if (message.mission === mission) {
          void rememberProjectVariant(context, win.capture, message.variant);
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
