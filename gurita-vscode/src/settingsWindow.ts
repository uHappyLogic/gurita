// The Settings window: one webview panel of its own in the editor area, belonging to no mission,
// opened by the Settings command, which the Command Palette hides and the side-bar view's title bar
// runs as an icon action beside Refresh, and revealed when it is already open. Its `webview.html`
// is set once, to the page shell the mission windows use with the window's own script,
// `out/webview/settings.js`, which posts a ready message on every load, the window opened or
// shown again included, and draws what the extension answers. Every ready message is answered
// with each harness's enabled state, its model and effort lists, the recipes and variants, and the
// named single-task lines, each read afresh, and with the harness check.
//
// The harness check belongs to the extension's session, not to the window: it first runs, the
// packaged `harness_check.py` through `execFile` from the project root, on the first opening of
// the window after the extension activates, and its result is kept in this module's state for the
// rest of that session, across every close and reopening of the window, every later opening
// posting the result kept without running the check again. Only the window's check-again control
// and the end of an install or update run run it afresh: no refresh, re-read, or reopening does, a restart or a window reload ends the
// session, and no timestamp or stored record is kept. Its result reaches the window alone, the
// mission pages drawn and their clicks run whatever it reports.
//
// The window also starts the install and update runs (`pluginRuns.ts`): a page's request to install
// or update the plugin on a harness starts the packaged `install_plugin.py` as a terminal's own
// process at the project root, opened and shown as a recipe run's terminal is, with a note of the
// run kept in this extension's state for the session, so that at most one goes at a time: while it
// stands a second request starts nothing, showing a notification and revealing that run's terminal,
// and check again runs no check. The note is posted to the window on every ready message and each
// time it changes, and the page draws check again disabled while it stands. When the run's terminal
// closes, its exit status read from the terminal, the window reports how the run ended in a
// notification, an information one for a success, adding the one sentence that running sessions of
// that harness must be restarted to use the new copy, and an error one for a failure, a failed
// release lookup included, and then runs the whole harness check afresh through the code path check
// again runs, its result replacing the kept one for every harness.
//
// The window enables and disables each harness: a click of a harness's enable or disable control
// writes that state to the harness part of the variant store file and posts it again. Every
// harness starts enabled and stays so until the person disables it, the check never changing it.
// The window holds each harness's model list and its one effort list for the whole harness, Codex
// a model list alone, derived afresh from the `--model` and `--effort` values, on a Codex line
// `-m`, the lines of the shipped recipes, the own recipes, and the stored variants carry, with the
// person's overlay from the harness part of the variant store file laid over them. A click of a
// list's add control asks for the entry in VS Code's own input box, whose validation refuses an
// empty entry and one the list already offers, and a click of an entry's remove control takes it
// out of the offer; either is written to the overlay and the lists posted again. The window also
// edits variants: every recipe but the named single-task lines, the chains, the seven fixed-name
// button recipes, and the recipes and variants of the own recipe file alike, each with its
// variants as the variant store lays them over the two Markdown files, its default marked, and the
// variants a hiding record hides. A click of a variant's duplicate, rename, delete, or default
// control, or of a reset control, on a stored variant returning its lines to those of the variant
// it was made from, its name and entry kept, and on a deleted variant showing it again, is carried
// out through the variant store's edits (`variantEdits.ts`); a duplicate's name and a rename are
// asked for in VS Code's own input box, a rename's box opening on the current name, and the box's
// validation refusing an empty name and one the recipe's other variants carry. Each variant is
// posted with its lines and the line editor each gets: a `claude` or `agy` line carrying both
// `--model` and `--effort` gets model and effort dropdowns and a harness dropdown offering Claude
// Code and Antigravity, a Codex line carrying `-m` its model dropdown alone, and every other line
// is shown as its text, read-only. A model or effort pick replaces the value the line carries
// through the store's edit (`replaceLineValue`), a harness pick rewrites the line onto the other
// harness (`replaceLineHarness`), a shipped or own variant left untouched and a `custom N` holding
// the changed line added beside it, a stored variant changed in place. The window also edits the
// named single-task lines, each under its name with its single-task variants beneath it, through
// the store's line edits.
//
// Every edit made in the window shows at once on every other surface: the window's lists are
// posted again, and every shown mission window is posted its page again with the recipes re-read,
// or the failure state again while it stands, and the side-bar view's two mission-starting rows are
// redrawn, their recipes read afresh (`recipesChanged`). The refresh command re-reads the window
// too, posting its lists afresh while it is shown, the harness check left as it stands.
//
// The Settings window open before a restart or a window reload comes back in the editor group and
// tab position it held, through a `WebviewPanelSerializer` for its view type: its page saves one
// fixed state naming the window, and a restored window is taken over as one opened afresh, drawn
// from fresh reads as every opening is, the session's harness check running on its first opening
// after the reload; one first shown while the Settings window is already open, or whose saved state
// is missing or cannot be read, is closed.

import * as os from 'node:os';
import * as vscode from 'vscode';
import { BUTTON_RECIPES, readRecipes } from './recipes';
import { ReadVariantRef, readVariantStore, variantStoreFile } from './variantStore';
import {
  LineEditor,
  SettingsLine,
  SettingsLines,
  SettingsRecipe,
  VariantTarget,
  deleteLine,
  deleteVariant,
  duplicateLine,
  duplicateVariant,
  lineNames,
  pickDefault,
  renameLine,
  renameVariant,
  replaceLineHarness,
  replaceLineValue,
  resetLine,
  resetVariant,
  resetVariantLines,
  settingsLines,
  settingsRecipes,
} from './variantEdits';
import {
  HarnessKey,
  HarnessLists,
  HarnessStates,
  ListKind,
  editHarnessList,
  holdsList,
  isHarnessKey,
  isListKind,
  readHarnessLists,
  readHarnessStates,
  setHarnessEnabled,
} from './harnessSettings';
import { SwitchableHarness } from './lineValues';
import { CHECK_SCRIPT, CheckResult, HARNESSES, PLUGIN_VERSION_FILE, readPackagedVersion, runHarnessCheck } from './harnessCheck';
import { pageShell, recipeFiles, recipesChanged, startLiveRead, startingRoot, webviewOptions } from './pane';
import {
  CLAUDE_SCOPES,
  PLUGIN_ACTIONS,
  PluginAction,
  PluginRun,
  pluginRunEnd,
  pluginRunGoing,
  registerPluginRuns,
  startPluginRun,
} from './pluginRuns';

/** The Settings window's webview view type. */
export const SETTINGS_VIEW_TYPE = 'gurita.settings';

/** The window a Settings window's saved webview state names, as its page saves it on every load. */
export const SAVED_WINDOW = 'settings';

/** The Settings window's editor tab title. */
export const SETTINGS_TITLE = 'Gurita Settings';

/**
 * The Settings command, hidden from the Command Palette and run by the side-bar view's Settings
 * title-bar action: it opens the Settings window, or reveals it when it is already open.
 */
export const SETTINGS_COMMAND = 'gurita.openSettings';

/** A message the Settings window's page posts to the extension. */
type SettingsPageMessage =
  | { type: 'ready' }
  | { type: 'checkHarnesses' }
  | { type: 'runPlugin'; harness: string; action: string; scopes?: string[] }
  | { type: 'setHarnessEnabled'; harness: string; enabled: boolean }
  | { type: 'addHarnessValue'; harness: string; kind: string }
  | { type: 'removeHarnessValue'; harness: string; kind: string; value: string }
  | { type: 'duplicateVariant'; recipe: string; variant: VariantTarget }
  | { type: 'renameVariant'; recipe: string; variant: VariantTarget }
  | { type: 'deleteVariant'; recipe: string; variant: VariantTarget }
  | { type: 'pickDefault'; recipe: string; variant: VariantTarget }
  | { type: 'resetVariant'; recipe: string; original: ReadVariantRef }
  | { type: 'resetVariantLines'; recipe: string; variant: VariantTarget }
  | { type: 'replaceLineValue'; recipe: string; variant: VariantTarget; line: number; kind: string; value: string }
  | { type: 'replaceLineHarness'; recipe: string; variant: VariantTarget; line: number; harness: string }
  | { type: 'duplicateLine'; line: string; variant: VariantTarget }
  | { type: 'renameLine'; line: string; variant: VariantTarget }
  | { type: 'deleteLine'; line: string; variant: VariantTarget }
  | { type: 'resetLine'; line: string; original: ReadVariantRef };

/** The harness check as the Settings window shows it: running, or what it gave. */
type HarnessCheck = { state: 'running' } | CheckResult;

/** Each harness's enabled state as the variant store file holds it, or the cause it could not be read. */
type HarnessSettings = { state: 'read'; enabled: HarnessStates } | { state: 'failed'; cause: string };

/** Each harness's model and effort lists, the overlay laid over them, or the cause they could not be read. */
type HarnessListsRead = { state: 'read'; lists: HarnessLists } | { state: 'failed'; cause: string };

/** The recipes and variants the Settings window lists for editing, or the cause they could not be read. */
type VariantsRead = { state: 'read'; recipes: SettingsRecipe[] } | { state: 'failed'; cause: string };

/** The named single-task lines the Settings window lists for editing, or the cause they could not be read. */
type LinesRead = ({ state: 'read' } & SettingsLines) | { state: 'failed'; cause: string };

/** A message the extension posts to the Settings window's page. */
type SettingsMessage =
  | { type: 'harnessCheck'; check: HarnessCheck }
  | { type: 'pluginRun'; run: PluginRun | null }
  | { type: 'harnessSettings'; settings: HarnessSettings }
  | { type: 'harnessLists'; lists: HarnessListsRead }
  | { type: 'variants'; variants: VariantsRead }
  | { type: 'singleTaskLines'; lines: LinesRead };

/** The Settings window, while it is open. */
let settingsPanel: vscode.WebviewPanel | undefined;

/**
 * The harness check kept for the rest of the extension's session, across every close and
 * reopening of the window: undefined until the window is first opened.
 */
let harnessCheck: HarnessCheck | undefined;

/** The number of harness checks started, so only the latest one started keeps its result. */
let checks = 0;

/**
 * Registers the Settings command, which the side-bar view's Settings title-bar action runs, and the
 * serializer that restores the Settings window open before a restart or a window reload, in the
 * editor group and tab position it held, as the editor hands it over when it is first shown. A
 * restored window whose saved state is missing or cannot be read, or that is first shown while the
 * Settings window is already open, is closed; any other is taken over as a window opened afresh is,
 * its restore starting the session's live read, and drawn from fresh reads on its ready message.
 */
export function registerSettingsWindow(context: vscode.ExtensionContext): void {
  registerPluginRuns(context, (run, status) => void pluginRunEnded(context, run, status));
  context.subscriptions.push(
    vscode.commands.registerCommand(SETTINGS_COMMAND, () => openSettings(context)),
    vscode.window.registerWebviewPanelSerializer(SETTINGS_VIEW_TYPE, {
      deserializeWebviewPanel: async (panel: vscode.WebviewPanel, state: unknown) => restoreSettings(context, panel, state),
    }),
  );
}

/** Whether `state`, a restored window's saved webview state, is the one the Settings window's page saves. */
function savedSettings(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as { window?: unknown }).window === SAVED_WINDOW;
}

/** Restores the Settings window `panel` from its saved webview state `state`, as `registerSettingsWindow` describes. */
function restoreSettings(context: vscode.ExtensionContext, panel: vscode.WebviewPanel, state: unknown): void {
  if (!savedSettings(state) || settingsPanel !== undefined) {
    panel.dispose();
    return;
  }
  startLiveRead(context);
  panel.webview.options = webviewOptions(context);
  hookSettings(context, panel);
}

/**
 * Opens the Settings window in the editor area, or reveals it when it is already open, starting
 * the session's live read when nothing has started it yet, as every Gurita command does.
 */
export function openSettings(context: vscode.ExtensionContext): void {
  startLiveRead(context);
  if (settingsPanel !== undefined) {
    settingsPanel.reveal();
    return;
  }
  hookSettings(context, vscode.window.createWebviewPanel(SETTINGS_VIEW_TYPE, SETTINGS_TITLE, vscode.ViewColumn.Active, webviewOptions(context)));
}

/** Takes the panel `created` over as the Settings window: its page shell and its listeners, the page's messages and its disposal. */
function hookSettings(context: vscode.ExtensionContext, created: vscode.WebviewPanel): void {
  const scripts = vscode.Uri.joinPath(context.extensionUri, 'out', 'webview');
  settingsPanel = created;
  created.webview.html = pageShell(created.webview, vscode.Uri.joinPath(scripts, 'settings.js'), SETTINGS_TITLE);
  created.webview.onDidReceiveMessage(
    (message: SettingsPageMessage) => {
      if (settingsPanel !== created) {
        return;
      }
      if (message?.type === 'ready') {
        settingsReady(context, created);
      } else if (message?.type === 'checkHarnesses') {
        void checkHarnesses(context);
      } else if (message?.type === 'runPlugin') {
        const run = pluginRunOf(message.harness, message.action, message.scopes);
        if (run !== undefined) {
          void startPluginInstallRun(context, run);
        }
      } else if (message?.type === 'setHarnessEnabled') {
        void enableHarness(context, created, message.harness, message.enabled);
      } else if (message?.type === 'addHarnessValue') {
        void addHarnessValue(context, created, message.harness, message.kind);
      } else if (message?.type === 'removeHarnessValue') {
        void removeHarnessValue(context, created, message.harness, message.kind, message.value);
      } else if (
        message?.type === 'duplicateVariant' ||
        message?.type === 'renameVariant' ||
        message?.type === 'deleteVariant' ||
        message?.type === 'pickDefault' ||
        message?.type === 'resetVariantLines'
      ) {
        void editVariant(context, created, message.type, message.recipe, message.variant);
      } else if (message?.type === 'resetVariant') {
        void resetStoredVariant(context, created, message.recipe, message.original);
      } else if (message?.type === 'replaceLineValue') {
        void editLineValue(context, created, message.recipe, message.variant, message.line, message.kind, message.value);
      } else if (message?.type === 'replaceLineHarness') {
        void editLineHarness(context, created, message.recipe, message.variant, message.line, message.harness);
      } else if (message?.type === 'duplicateLine' || message?.type === 'renameLine' || message?.type === 'deleteLine') {
        void editLine(context, created, message.type, message.line, message.variant);
      } else if (message?.type === 'resetLine') {
        void resetStoredLine(context, created, message.line, message.original);
      }
    },
    undefined,
    context.subscriptions,
  );
  created.onDidDispose(
    () => {
      if (settingsPanel === created) {
        settingsPanel = undefined;
      }
    },
    undefined,
    context.subscriptions,
  );
}

/**
 * Re-reads the Settings window while it is shown, as the refresh command does: each harness's
 * enabled state, its lists, the variants, and the single-task lines, posted afresh. The harness
 * check is left as it stands, and a hidden or closed window draws from its next ready message.
 */
export async function refreshSettings(context: vscode.ExtensionContext): Promise<void> {
  const target = settingsPanel;
  if (target === undefined || !target.visible) {
    return;
  }
  await postLists(context, target);
}

/** Each harness's enabled state, read afresh from the variant store file, or the cause it could not be read. */
function readHarnessSettings(): HarnessSettings {
  try {
    return { state: 'read', enabled: readHarnessStates(variantStoreFile(os.homedir())) };
  } catch (error) {
    return { state: 'failed', cause: error instanceof Error ? error.message : String(error) };
  }
}

/** Posts each harness's enabled state, its lists, the variants, and the single-task lines to the window, each read afresh. */
async function postLists(context: vscode.ExtensionContext, target: vscode.WebviewPanel): Promise<void> {
  await post(target, { type: 'harnessSettings', settings: readHarnessSettings() });
  await post(target, { type: 'harnessLists', lists: readListsOf(context) });
  await post(target, { type: 'variants', variants: readVariantList(context) });
  await post(target, { type: 'singleTaskLines', lines: readLineList(context) });
}

/**
 * Answers a ready message of the window's page, posted on every opening of the window and every
 * time it is shown again: the lists are posted, read afresh, and the first opening of the session
 * runs the harness check, every later one posting the check kept, running or done, without running it.
 */
function settingsReady(context: vscode.ExtensionContext, target: vscode.WebviewPanel): void {
  void postLists(context, target);
  void post(target, { type: 'pluginRun', run: pluginRunGoing() ?? null });
  if (harnessCheck === undefined) {
    void checkHarnesses(context);
    return;
  }
  void post(target, { type: 'harnessCheck', check: harnessCheck });
}

/**
 * Runs the harness check afresh, unless one is running or an install or update run is going: the
 * packaged `harness_check.py` run from the project root, else the home directory when no folder is
 * open, its installed versions compared with the packaged plugin version. The window, while open,
 * is told it runs, and then what it gave, which is kept for the rest of the session whether or not
 * the window is still open. `afterRun`, the check that follows an install or update run's end,
 * runs even while an earlier check is running, the latest started keeping its result.
 */
async function checkHarnesses(context: vscode.ExtensionContext, afterRun = false): Promise<void> {
  if (pluginRunGoing() !== undefined || (!afterRun && harnessCheck?.state === 'running')) {
    return;
  }
  const sequence = ++checks;
  harnessCheck = { state: 'running' };
  await postCheck();
  const root = (await startingRoot()) ?? os.homedir();
  const packaged = readPackagedVersion(context.asAbsolutePath(PLUGIN_VERSION_FILE));
  const result = await runHarnessCheck(context.asAbsolutePath(CHECK_SCRIPT), root, packaged);
  if (sequence !== checks) {
    return;
  }
  harnessCheck = result;
  await postCheck();
}

/**
 * The install or update run a page message names: a harness key, an action, and, on Claude Code
 * alone, the scopes it acts at, each one of user, project, and local, named once, exactly one for
 * an install and at least one for an update. Undefined for anything else.
 */
function pluginRunOf(harness: unknown, action: unknown, scopes: unknown): PluginRun | undefined {
  if (!isHarnessKey(harness) || typeof action !== 'string' || !PLUGIN_ACTIONS.includes(action as PluginAction)) {
    return undefined;
  }
  const named = scopes === undefined ? [] : scopes;
  if (!Array.isArray(named) || !named.every((scope) => typeof scope === 'string' && CLAUDE_SCOPES.includes(scope))) {
    return undefined;
  }
  if (new Set(named).size !== named.length) {
    return undefined;
  }
  if (harness === 'claude' ? named.length === 0 || (action === 'install' && named.length !== 1) : named.length !== 0) {
    return undefined;
  }
  return { harness, action: action as PluginAction, scopes: named as string[] };
}

/**
 * Starts the install or update run `run` at the project root, else the home directory when no
 * folder is open, unless one is going, which shows a notification and reveals its terminal, and
 * posts the window the run's note. Returns whether the run started.
 */
export async function startPluginInstallRun(context: vscode.ExtensionContext, run: PluginRun): Promise<boolean> {
  const root = (await startingRoot()) ?? os.homedir();
  if (!startPluginRun(context, root, run)) {
    return false;
  }
  await postPluginRun();
  return true;
}

/**
 * Reports how the install or update run `run` ended, its exit status `status`, in a notification,
 * an information one adding the restart sentence for a success and an error one for a failure,
 * posts the window that no run is going, and runs the whole harness check afresh.
 */
async function pluginRunEnded(context: vscode.ExtensionContext, run: PluginRun, status: number | undefined): Promise<void> {
  const end = pluginRunEnd(run, status);
  if (end.succeeded) {
    void vscode.window.showInformationMessage(end.message);
  } else {
    void vscode.window.showErrorMessage(end.message);
  }
  await postPluginRun();
  await checkHarnesses(context, true);
}

/** Posts the install or update run going, or that none is, to the window, while it is open. */
async function postPluginRun(): Promise<void> {
  if (settingsPanel !== undefined) {
    await post(settingsPanel, { type: 'pluginRun', run: pluginRunGoing() ?? null });
  }
}

/** Posts the harness check kept to the window, while it is open. */
async function postCheck(): Promise<void> {
  if (settingsPanel !== undefined && harnessCheck !== undefined) {
    await post(settingsPanel, { type: 'harnessCheck', check: harnessCheck });
  }
}

/**
 * Enables or disables the harness `harness` in the harness part of the variant store file, read
 * afresh and written whole, then posts each harness's state and the pages again, their recipes
 * re-read, so a variant on a disabled harness leaves its dropdown at once. A key naming no harness
 * or a state that is not true or false writes nothing; a store that cannot be read or written is
 * told in an error notification, nothing written.
 */
async function enableHarness(context: vscode.ExtensionContext, target: vscode.WebviewPanel, harness: unknown, enabled: unknown): Promise<void> {
  if (settingsPanel !== target || !isHarnessKey(harness) || typeof enabled !== 'boolean') {
    return;
  }
  try {
    setHarnessEnabled(variantStoreFile(os.homedir()), harness, enabled);
  } catch (error) {
    void vscode.window.showErrorMessage(
      `The harness could not be ${enabled ? 'enabled' : 'disabled'}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  await post(target, { type: 'harnessSettings', settings: readHarnessSettings() });
  await recipesChanged(context);
}

/** Each harness's model and effort lists, read afresh, or the cause they could not be read. */
function readListsOf(context: vscode.ExtensionContext): HarnessListsRead {
  try {
    const files = recipeFiles(context);
    return { state: 'read', lists: readHarnessLists(files.shipped, files.own, files.store) };
  } catch (error) {
    return { state: 'failed', cause: error instanceof Error ? error.message : String(error) };
  }
}

/** The name the Settings window gives the harness `key`. */
function harnessName(key: string): string {
  return HARNESSES.find((harness) => harness.key === key)?.name ?? key;
}

/**
 * Adds an entry to the harness `harness`'s list of `kind`: the entry is asked for in VS Code's own
 * input box, whose validation refuses an empty entry and one the list already offers, and written
 * to the overlay in the harness part of the variant store file, the lists then posted again. A key
 * naming no harness, a list the harness does not hold, lists that cannot be read, or a dismissed
 * box writes nothing; a store that cannot be written is told in an error notification.
 */
async function addHarnessValue(context: vscode.ExtensionContext, target: vscode.WebviewPanel, harness: unknown, kind: unknown): Promise<void> {
  if (settingsPanel !== target || !isHarnessKey(harness) || !isListKind(kind) || !holdsList(harness, kind)) {
    return;
  }
  const read = readListsOf(context);
  if (read.state === 'failed') {
    void vscode.window.showErrorMessage(`The ${kind} list could not be read: ${read.cause}`);
    return;
  }
  const offered = kind === 'model' ? read.lists[harness].models : read.lists[harness].efforts ?? [];
  const typed = await vscode.window.showInputBox({
    prompt: `The ${kind} to add to the ${harnessName(harness)} ${kind} list`,
    placeHolder: kind === 'model' ? 'a model name' : 'an effort level',
    ignoreFocusOut: true,
    validateInput: (value) =>
      value.trim() === ''
        ? `Type a ${kind}, or press Escape to add nothing.`
        : offered.includes(value.trim())
          ? `The ${kind} list already offers ${value.trim()}.`
          : undefined,
  });
  if (typed === undefined || typed.trim() === '' || offered.includes(typed.trim()) || settingsPanel !== target) {
    return;
  }
  editList(context, target, harness, kind, 'add', typed.trim());
}

/**
 * Removes the entry `value` from the offer of the harness `harness`'s list of `kind`, written to the
 * overlay in the harness part of the variant store file, the lists then posted again. A key naming
 * no harness, a list the harness does not hold, or an entry the list does not offer writes nothing.
 */
async function removeHarnessValue(context: vscode.ExtensionContext, target: vscode.WebviewPanel, harness: unknown, kind: unknown, value: unknown): Promise<void> {
  if (settingsPanel !== target || !isHarnessKey(harness) || !isListKind(kind) || !holdsList(harness, kind) || typeof value !== 'string') {
    return;
  }
  const read = readListsOf(context);
  if (read.state === 'failed' || !(kind === 'model' ? read.lists[harness].models : read.lists[harness].efforts ?? []).includes(value)) {
    return;
  }
  editList(context, target, harness, kind, 'remove', value);
}

/** Writes one edit of a harness's list to the variant store file and posts the lists again. */
function editList(
  context: vscode.ExtensionContext,
  target: vscode.WebviewPanel,
  harness: HarnessKey,
  kind: ListKind,
  edit: 'add' | 'remove',
  value: string,
): void {
  try {
    const files = recipeFiles(context);
    editHarnessList(files.shipped, files.own, files.store, harness, kind, edit, value);
  } catch (error) {
    void vscode.window.showErrorMessage(
      `The ${kind} could not be ${edit === 'add' ? 'added' : 'removed'}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  void post(target, { type: 'harnessLists', lists: readListsOf(context) });
}

/**
 * The recipes and variants the Settings window lists, read afresh: the shipped recipe file and the
 * person's own recipe file merged, the variant store laid over them, as `settingsRecipes` lists
 * them, or the cause they could not be read.
 */
function readVariantList(context: vscode.ExtensionContext): VariantsRead {
  try {
    const files = recipeFiles(context);
    const base = readRecipes(files.shipped, files.own);
    return { state: 'read', recipes: settingsRecipes(base, readVariantStore(files.store), files.store, Object.values(BUTTON_RECIPES)) };
  } catch (error) {
    return { state: 'failed', cause: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * The named single-task lines the Settings window lists, read afresh: the shipped recipe file and
 * the person's own recipe file merged, the variant store laid over them, as `settingsLines` lists
 * them, or the cause they could not be read.
 */
function readLineList(context: vscode.ExtensionContext): LinesRead {
  try {
    const files = recipeFiles(context);
    return { state: 'read', ...settingsLines(readRecipes(files.shipped, files.own), readVariantStore(files.store), files.store) };
  } catch (error) {
    return { state: 'failed', cause: error instanceof Error ? error.message : String(error) };
  }
}

function isOrigin(value: unknown, allowed: readonly string[]): boolean {
  return typeof value === 'string' && allowed.includes(value);
}

/** The variant a page message names, or undefined when it names none in the form a target takes. */
function variantTargetOf(value: unknown): VariantTarget | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { name, origin, copies } = value as Record<string, unknown>;
  if (typeof name !== 'string' || !isOrigin(origin, ['shipped', 'own', 'stored'])) {
    return undefined;
  }
  if (copies === undefined) {
    return { name, origin: origin as VariantTarget['origin'] };
  }
  const original = readVariantRefOf(copies);
  return original === undefined ? undefined : { name, origin: origin as VariantTarget['origin'], copies: original };
}

/** The shipped or own variant a page message names, or undefined when it names none. */
function readVariantRefOf(value: unknown): ReadVariantRef | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { name, origin, recipe } = value as Record<string, unknown>;
  if (typeof name !== 'string' || !isOrigin(origin, ['shipped', 'own']) || (recipe !== undefined && typeof recipe !== 'string')) {
    return undefined;
  }
  return { name, origin: origin as ReadVariantRef['origin'], ...(recipe === undefined ? {} : { recipe: recipe as string }) };
}

/** Whether a listed variant is the one `target` names. */
function isTarget(variant: VariantTarget, target: VariantTarget): boolean {
  return (
    variant.name === target.name &&
    variant.origin === target.origin &&
    (variant.copies === undefined || target.copies === undefined
      ? variant.copies === target.copies
      : variant.copies.name === target.copies.name &&
        variant.copies.origin === target.copies.origin &&
        variant.copies.recipe === target.copies.recipe)
  );
}

/**
 * Asks for a variant's name in VS Code's own input box, one box for the one value, as `askValues`
 * asks for a page's values: the box opens on `value` when given, and its validation refuses an
 * empty name and one of `taken`, the names the recipe's other variants carry. The name is returned
 * with its outer spaces trimmed, or undefined when the box is dismissed.
 */
async function askVariantName(prompt: string, taken: readonly string[], value?: string): Promise<string | undefined> {
  const typed = await vscode.window.showInputBox({
    prompt,
    ...(value === undefined ? {} : { value }),
    ignoreFocusOut: true,
    validateInput: (text) =>
      text.trim() === ''
        ? 'Type a name, or press Escape to change nothing.'
        : taken.includes(text.trim())
          ? `The recipe already has a variant named ${text.trim()}.`
          : undefined,
  });
  if (typed === undefined || typed.trim() === '' || taken.includes(typed.trim())) {
    return undefined;
  }
  return typed.trim();
}

/** The word a notification gives each variant edit. */
const EDIT_VERBS: Record<'duplicateVariant' | 'renameVariant' | 'deleteVariant' | 'pickDefault' | 'resetVariant' | 'resetVariantLines', string> = {
  duplicateVariant: 'duplicated',
  renameVariant: 'renamed',
  deleteVariant: 'deleted',
  pickDefault: 'picked as the default',
  resetVariant: 'reset',
  resetVariantLines: 'reset',
};

/**
 * Makes one edit of the Settings window on the variant `variant` of the recipe `recipe`, as the
 * variant list read afresh lists it, through the variant store's edits: a duplicate under a name
 * and a rename to one, each asked for in VS Code's own input box, a rename's box opening on the
 * current name, a delete, the pick of the variant as its recipe's default, or the reset of a stored
 * variant, returning its lines to those of the variant it was made from, its name kept. A recipe or
 * variant the list does not hold, a reset of a variant it lists with no variant it was made from,
 * or a dismissed box, writes nothing; an edit the store refuses, or a store
 * that cannot be read or written, is told in an error notification. Every edit made posts the
 * variant list, the harness lists, and the pages again, their recipes re-read.
 */
async function editVariant(
  context: vscode.ExtensionContext,
  target: vscode.WebviewPanel,
  edit: 'duplicateVariant' | 'renameVariant' | 'deleteVariant' | 'pickDefault' | 'resetVariantLines',
  recipe: unknown,
  variant: unknown,
): Promise<void> {
  const named = variantTargetOf(variant);
  if (settingsPanel !== target || typeof recipe !== 'string' || named === undefined) {
    return;
  }
  const read = readVariantList(context);
  if (read.state === 'failed') {
    void vscode.window.showErrorMessage(`The variants could not be read: ${read.cause}`);
    return;
  }
  const listed = read.recipes.find((each) => each.name === recipe) ?? listedLine(context, recipe);
  const index = listed?.variants.findIndex((each) => isTarget(each, named)) ?? -1;
  if (listed === undefined || index < 0 || (edit === 'resetVariantLines' && listed.variants[index].from === undefined)) {
    return;
  }
  const others = listed.variants.filter((_, each) => each !== index).map((each) => each.name);
  let name: string | undefined;
  if (edit === 'duplicateVariant') {
    name = await askVariantName(`The name of the duplicate of ${named.name} in ${recipe}`, listed.variants.map((each) => each.name));
  } else if (edit === 'renameVariant') {
    name = await askVariantName(`The new name of ${named.name} in ${recipe}`, others, named.name);
  }
  if ((edit === 'duplicateVariant' || edit === 'renameVariant') && name === undefined) {
    return;
  }
  if (settingsPanel !== target) {
    return;
  }
  try {
    const files = recipeFiles(context);
    const base = readRecipes(files.shipped, files.own);
    if (edit === 'duplicateVariant') {
      duplicateVariant(files.store, base, recipe, named, name as string);
    } else if (edit === 'renameVariant') {
      renameVariant(files.store, base, recipe, named, name as string);
    } else if (edit === 'deleteVariant') {
      deleteVariant(files.store, base, recipe, named);
    } else if (edit === 'resetVariantLines') {
      resetVariantLines(files.store, base, recipe, named);
    } else {
      pickDefault(files.store, base, recipe, named);
    }
  } catch (error) {
    void vscode.window.showErrorMessage(
      `The variant could not be ${EDIT_VERBS[edit]}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  await postVariantEdit(context, target);
}

/** The named single-task line of the name `name` the line list read afresh holds, its variants edited as a recipe's are. */
function listedLine(context: vscode.ExtensionContext, name: string): SettingsLine | undefined {
  const lines = readLineList(context);
  return lines.state === 'read' ? lines.lines.find((each) => each.name === name) : undefined;
}

/**
 * Resets the deleted shipped or own variant `original` of the recipe `recipe`, removing the hiding
 * record and any stored copy standing for it, so it shows again as its file holds it, then posts
 * the variant list, the harness lists, and the pages again. A variant the list read afresh does
 * not list as deleted writes nothing; a store that cannot be read or written is told in an error notification.
 */
async function resetStoredVariant(context: vscode.ExtensionContext, target: vscode.WebviewPanel, recipe: unknown, original: unknown): Promise<void> {
  const ref = readVariantRefOf(original);
  if (settingsPanel !== target || typeof recipe !== 'string' || ref === undefined) {
    return;
  }
  const read = readVariantList(context);
  if (read.state === 'failed') {
    void vscode.window.showErrorMessage(`The variants could not be read: ${read.cause}`);
    return;
  }
  const listed = read.recipes.find((each) => each.name === recipe);
  const offered = listed?.hidden ?? [];
  if (!offered.some((each) => each.name === ref.name && each.origin === ref.origin)) {
    return;
  }
  try {
    resetVariant(recipeFiles(context).store, recipe, ref);
  } catch (error) {
    void vscode.window.showErrorMessage(`The variant could not be ${EDIT_VERBS.resetVariant}: ${error instanceof Error ? error.message : String(error)}`);
  }
  await postVariantEdit(context, target);
}

/**
 * Replaces the model or the effort that line `line` of the variant `variant` of the recipe `recipe`
 * carries with `value`, picked in the line's dropdown in the Settings window, through the store's
 * edit, a shipped or own variant left as it is and a `custom N` holding the changed line added
 * beside it, a stored variant changed in place, then
 * posts the variant list, the harness lists, and the pages again. Only a line the variant list read
 * afresh gives a control of `kind` is changed, and only to a value the harness's list of `kind`
 * offers: anything else, or the value the line already carries, writes nothing. An edit the store
 * refuses, or lists or a store that cannot be read or written, is told in an error notification.
 */
async function editLineValue(
  context: vscode.ExtensionContext,
  target: vscode.WebviewPanel,
  recipe: unknown,
  variant: unknown,
  line: unknown,
  kind: unknown,
  value: unknown,
): Promise<void> {
  const named = variantTargetOf(variant);
  if (
    settingsPanel !== target ||
    typeof recipe !== 'string' ||
    named === undefined ||
    typeof line !== 'number' ||
    !Number.isInteger(line) ||
    line < 0 ||
    !isListKind(kind) ||
    typeof value !== 'string'
  ) {
    return;
  }
  const read = readVariantList(context);
  if (read.state === 'failed') {
    void vscode.window.showErrorMessage(`The variants could not be read: ${read.cause}`);
    return;
  }
  const editor = listedEditor(context, read, recipe, named, line);
  const current = editor === undefined || editor === null ? undefined : kind === 'model' ? editor.model : editor.effort;
  if (editor === undefined || editor === null || current === undefined || current === value) {
    return;
  }
  const lists = readListsOf(context);
  if (lists.state === 'failed') {
    void vscode.window.showErrorMessage(`The ${kind} list could not be read: ${lists.cause}`);
    return;
  }
  const offered = kind === 'model' ? lists.lists[editor.harness].models : lists.lists[editor.harness].efforts ?? [];
  if (!offered.includes(value) || settingsPanel !== target) {
    return;
  }
  try {
    const files = recipeFiles(context);
    replaceLineValue(files.store, readRecipes(files.shipped, files.own), recipe, named, line, kind, value);
  } catch (error) {
    void vscode.window.showErrorMessage(`The ${kind} could not be changed: ${error instanceof Error ? error.message : String(error)}`);
  }
  await postVariantEdit(context, target);
}

/**
 * The line editor the lists read afresh give line `line` of the variant `named` of `recipe`: a
 * listed variant's line, or the line of a variant of the named single-task line of that name.
 */
function listedEditor(
  context: vscode.ExtensionContext,
  read: Extract<VariantsRead, { state: 'read' }>,
  recipe: string,
  named: VariantTarget,
  line: number,
): LineEditor | null | undefined {
  const listed = read.recipes.find((each) => each.name === recipe) ?? listedLine(context, recipe);
  return listed?.variants.find((each) => isTarget(each, named))?.editors[line];
}

/** The harnesses a line's harness dropdown picks between, by key, each with the command its lines open with. */
const SWITCHABLE: readonly { key: HarnessKey; cli: SwitchableHarness }[] = [
  { key: 'claude', cli: 'claude' },
  { key: 'antigravity', cli: 'agy' },
];

/**
 * Rewrites line `line` of the variant `variant` of the recipe `recipe` onto the harness `harness`,
 * Claude Code or Antigravity, picked in the line's harness dropdown in the Settings window, through
 * the store's edit (`replaceLineHarness`): the line's prompt and its headless or interactive form
 * kept, its model the picked harness's first listed model, and its effort kept where that
 * harness's effort list offers it and otherwise the first listed, stored as a model or effort pick
 * is, a shipped or own variant getting a `custom N` beside it; then posts
 * the variant list, the harness lists, and the pages again. Only a line the variant list read
 * afresh gives model and effort controls on Claude Code or Antigravity is rewritten, and only onto
 * the other of the two: anything else writes nothing. An edit the store refuses, a picked harness
 * listing no model or no effort among them, or lists or a store that cannot be read or written, is
 * told in an error notification.
 */
async function editLineHarness(
  context: vscode.ExtensionContext,
  target: vscode.WebviewPanel,
  recipe: unknown,
  variant: unknown,
  line: unknown,
  harness: unknown,
): Promise<void> {
  const named = variantTargetOf(variant);
  const picked = SWITCHABLE.find((each) => each.key === harness);
  if (
    settingsPanel !== target ||
    typeof recipe !== 'string' ||
    named === undefined ||
    typeof line !== 'number' ||
    !Number.isInteger(line) ||
    line < 0 ||
    picked === undefined
  ) {
    return;
  }
  const read = readVariantList(context);
  if (read.state === 'failed') {
    void vscode.window.showErrorMessage(`The variants could not be read: ${read.cause}`);
    return;
  }
  const editor = listedEditor(context, read, recipe, named, line);
  if (
    editor === undefined ||
    editor === null ||
    editor.effort === undefined ||
    !SWITCHABLE.some((each) => each.key === editor.harness) ||
    editor.harness === picked.key
  ) {
    return;
  }
  const lists = readListsOf(context);
  if (lists.state === 'failed') {
    void vscode.window.showErrorMessage(`The harness lists could not be read: ${lists.cause}`);
    return;
  }
  if (settingsPanel !== target) {
    return;
  }
  const offer = { models: lists.lists[picked.key].models, efforts: lists.lists[picked.key].efforts ?? [] };
  try {
    const files = recipeFiles(context);
    replaceLineHarness(files.store, readRecipes(files.shipped, files.own), recipe, named, line, picked.cli, offer);
  } catch (error) {
    void vscode.window.showErrorMessage(`The harness could not be changed: ${error instanceof Error ? error.message : String(error)}`);
  }
  await postVariantEdit(context, target);
}

/**
 * Asks for a single-task line's name in VS Code's own input box, one box for the one value, as
 * `askValues` asks for a page's values: the box opens on `value` when given, and its validation
 * refuses an empty name and one of `taken`, the names a recipe or another line carries. The name
 * is returned with its outer spaces trimmed, or undefined when the box is dismissed.
 */
async function askLineName(prompt: string, taken: readonly string[], value?: string): Promise<string | undefined> {
  const typed = await vscode.window.showInputBox({
    prompt,
    ...(value === undefined ? {} : { value }),
    ignoreFocusOut: true,
    validateInput: (text) =>
      text.trim() === ''
        ? 'Type a name, or press Escape to change nothing.'
        : taken.includes(text.trim())
          ? `A recipe or line is already named ${text.trim()}.`
          : undefined,
  });
  if (typed === undefined || typed.trim() === '' || taken.includes(typed.trim())) {
    return undefined;
  }
  return typed.trim();
}

/** The word a notification gives each line edit. */
const LINE_EDIT_VERBS: Record<'duplicateLine' | 'renameLine' | 'deleteLine' | 'resetLine', string> = {
  duplicateLine: 'duplicated',
  renameLine: 'renamed',
  deleteLine: 'deleted',
  resetLine: 'reset',
};

/**
 * Makes one edit of the Settings window on the named single-task line `variant` of the line named
 * `line`, as the line list read afresh lists it, through the variant store's edits: a duplicate
 * under a new name and a rename to one, each asked for in VS Code's own input box, a rename's box
 * opening on the current name, or a delete. A line the list does not hold, or a dismissed box,
 * writes nothing; an edit the store refuses, or a store that cannot be read or written, is told in
 * an error notification. Every edit made posts the variant and line lists, the harness lists, and
 * the pages again, their recipes re-read.
 */
async function editLine(
  context: vscode.ExtensionContext,
  target: vscode.WebviewPanel,
  edit: 'duplicateLine' | 'renameLine' | 'deleteLine',
  line: unknown,
  variant: unknown,
): Promise<void> {
  const named = variantTargetOf(variant);
  if (settingsPanel !== target || typeof line !== 'string' || named === undefined) {
    return;
  }
  const read = readLineList(context);
  if (read.state === 'failed') {
    void vscode.window.showErrorMessage(`The single-task lines could not be read: ${read.cause}`);
    return;
  }
  if (!read.lines.some((each) => each.name === line && each.variants.some((variant) => isTarget(variant, named)))) {
    return;
  }
  let name: string | undefined;
  if (edit !== 'deleteLine') {
    let taken: string[];
    try {
      const files = recipeFiles(context);
      taken = lineNames(readRecipes(files.shipped, files.own), readVariantStore(files.store), files.store);
    } catch (error) {
      void vscode.window.showErrorMessage(`The single-task lines could not be read: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    name =
      edit === 'duplicateLine'
        ? await askLineName(`The name of the duplicate of the line ${line}`, taken)
        : await askLineName(`The new name of the line ${line}`, taken.filter((each) => each !== line), line);
    if (name === undefined) {
      return;
    }
  }
  if (settingsPanel !== target) {
    return;
  }
  try {
    const files = recipeFiles(context);
    const base = readRecipes(files.shipped, files.own);
    if (edit === 'duplicateLine') {
      duplicateLine(files.store, base, line, named, name as string);
    } else if (edit === 'renameLine') {
      renameLine(files.store, base, line, named, name as string);
    } else {
      deleteLine(files.store, base, line, named);
    }
  } catch (error) {
    void vscode.window.showErrorMessage(
      `The line could not be ${LINE_EDIT_VERBS[edit]}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  await postVariantEdit(context, target);
}

/**
 * Resets the shipped or own single-task line `original` of the recipe `line`, removing every stored
 * copy and hiding record standing for it, so it shows again as its file holds it, then posts the
 * variant and line lists, the harness lists, and the pages again. A line the list read afresh
 * offers no reset for writes nothing; a store that cannot be read or written is told in an error
 * notification.
 */
async function resetStoredLine(context: vscode.ExtensionContext, target: vscode.WebviewPanel, line: unknown, original: unknown): Promise<void> {
  const ref = readVariantRefOf(original);
  if (settingsPanel !== target || typeof line !== 'string' || ref === undefined || ref.recipe !== undefined) {
    return;
  }
  const read = readLineList(context);
  if (read.state === 'failed') {
    void vscode.window.showErrorMessage(`The single-task lines could not be read: ${read.cause}`);
    return;
  }
  const offered = read.lines.flatMap((each) => [
    ...(each.reset === undefined ? [] : [{ name: each.reset.recipe, original: each.reset.original }]),
    ...each.hidden.map((original) => ({ name: each.name, original })),
  ]);
  if (!offered.some((each) => each.name === line && each.original.name === ref.name && each.original.origin === ref.origin)) {
    return;
  }
  try {
    resetLine(recipeFiles(context).store, line, ref);
  } catch (error) {
    void vscode.window.showErrorMessage(`The line could not be ${LINE_EDIT_VERBS.resetLine}: ${error instanceof Error ? error.message : String(error)}`);
  }
  await postVariantEdit(context, target);
}

/** Posts the variant and line lists and the harness lists, read afresh, and the pages again, their recipes re-read. */
async function postVariantEdit(context: vscode.ExtensionContext, target: vscode.WebviewPanel): Promise<void> {
  if (settingsPanel !== target) {
    return;
  }
  await post(target, { type: 'variants', variants: readVariantList(context) });
  await post(target, { type: 'singleTaskLines', lines: readLineList(context) });
  await post(target, { type: 'harnessLists', lists: readListsOf(context) });
  await recipesChanged(context);
}

async function post(target: vscode.WebviewPanel, message: SettingsMessage): Promise<void> {
  try {
    await target.webview.postMessage(message);
  } catch {
    // The window was closed; there is no page left to answer.
  }
}
