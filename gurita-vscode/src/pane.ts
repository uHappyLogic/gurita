// The mission pane: the one webview panel in the editor area the extension holds. Its
// `webview.html` is set once, to a page shell whose script, loaded from the output directory
// through `asWebviewUri` under a content security policy, posts a ready message on every load
// and draws what the extension answers. The extension answers every ready message from the
// session's live read, described below, its recipes read afresh: the live missions, each carrying its documents as the in-process readers parse them and what
// its seven-block workflow diagram draws: the block filled, the step to run next, chosen from the
// mission's state, its documents' facts, and the number of `Requirements-review:` commits git
// holds for it, and the count of those beyond the first, which the additional review round
// carries once git holds two or more; the pane its page opens on beneath its two pane headers,
// Open questions and Remaining tasks, chosen from the same count: Remaining tasks when git holds
// at least one review commit for the mission and no question is open, and Open questions
// otherwise, a failed git read included; and the recipe list its page shows, out of the recipes
// read afresh from the shipped recipe file and the person's own recipe file: only those whose
// declared stage is the step its diagram fills, beside them the additional review round's when
// derive tasks is filled, or when first review round is while any question of the mission is open,
// and follow up tasks' when finish is, and every undeclared recipe, or every
// recipe when no step is chosen, laid out within that by the page's other rules, the shipped
// recipes in the shipped file's order followed by its own group, and the leaving off of a recipe
// holding a placeholder the page cannot fill; or with the one failure state the live read gives.
// The recipes are read with the per-user variant store laid over them. Each entry offers the
// recipe's variants for the dropdown beside its button, by their names, and describes the one
// selected, whose name its button shows beneath its own: the variant remembered for the recipe on
// that mission, a remembered selection always winning over the default, and otherwise the
// recipe's default. A selection the page posts is remembered per recipe name on one mission, keyed by the
// mission's path as the pane lists it, in the project's `workspaceState` as a map from mission
// path and recipe name to variant name, nothing written into the project's tree, and the pages are
// posted again with it; a remembered variant its recipe no longer carries is dropped there at the
// next answer, the button falling back to the current default. The page redraws its question card in place from
// every such message, keeping the pane the person clicked while the mission stays shown.
// A click on a recipe button starts the selected variant's chain for the page's mission at once,
// and a recipe or variant the latest answer did not list, selected, on that mission's page starts
// nothing. The
// buttons outside the chains, untouched by the step, each run a variant of the recipe of its fixed
// name, its shipped variants and those an own recipe of the same name adds, the variant store laid
// over them, picked as the recipe list's are: each is posted with the pages, and the two
// mission-starting buttons with the failure state too, offering in the dropdown beside it the
// variants it can run, a variant with a line on a disabled harness left out, and describing the
// one selected, its name and its lines, which the button's label and hover text show: the
// variant remembered for the recipe, a remembered selection always winning over the default,
// where the default or the remembered one is left out the default when still offered and
// otherwise the first offered. The selection is remembered as
// the recipe list's is, per recipe on the mission for the buttons on a mission's page, and once
// per project, in `workspaceState` under a key of its own, for the two mission-starting buttons,
// and a remembered variant its recipe no longer carries is dropped at the next answer. The
// answer-with-alternative button is posted once per alternative of each question the mission's
// question view shows, each with a dropdown and a selection of its own, remembered in
// `workspaceState` under a third key per mission, question, and alternative, so a pick on one
// alternative leaves every other button where it stood and a click runs the variant its own
// button stands on. A button
// whose every variant it could run is left out for a disabled harness is posted with none and
// drawn disabled, and one whose recipe cannot be read or run is left out, showing its name alone,
// its click telling why in an error notification. A click runs the variant selected only when the
// latest answer posted the button so, standing on that variant, and runs the lines it posted; they
// run
// through the same run path: on a question's card the discuss, answer, and answer-with-
// recommendation buttons, on an alternative on that card the answer-with-alternative button,
// and on the pane at the tab row's end, in its failure state too, the two mission-starting
// buttons, and on a mission's page, in its row above the pane headers, the new-task button. The
// Short Title and the Alternative Id come from the card clicked, every typed value from
// VS Code's own input box, one line per value, and each value reaches its line only as its
// `GURITA_*` session variable. The discuss button always asks for an optional discussion note,
// the one value a box accepts empty: a note typed is carried after the Short Title as
// `<Short Title>. <note>`, an empty one leaves the line as if it held no note, and Escape starts
// nothing. While a chain started for a mission is running, from its start until its terminal
// closes, that mission's page draws every action button on it disabled, its recipe buttons, its
// question card's buttons, its preview's start button, and its New task button, and pulses its
// workflow diagram's filled block, while the tabs, the two pane headers, the refresh control, the
// other missions' pages, and the two mission-starting buttons stay enabled. The settings live in
// the Settings window of their own (`settingsWindow.ts`), not on the pane: the pane draws no
// Settings control, and a variant with at least one line on a harness the window disabled is left
// out of the list the pane posts, so out of its recipe's dropdown and refused on a click as any
// variant the list lacks is, a recipe whose every variant is left out loses its button, and where
// the remembered variant or the default is left out the button stands on the default when it is
// still listed and otherwise on the first listed variant, the remembered selection kept for when
// the harness is enabled again. The fixed-name buttons' dropdowns leave such a variant out in the
// same way, and the looped run's preview, overrides, and lines keep every named single-task line.
// Every edit the window makes re-reads the recipes and posts the pages again while the pane is
// shown, or the failure state again while it stands, so the mission pages' dropdowns and the
// fixed-name buttons' dropdowns and labels show it at once.
// The
// extension posts the
// paths of the missions with a running runner to the page when a run starts and when its terminal closes, and
// with every redraw, so a hidden pane shown again draws them too; a click that still reaches the
// extension for such a mission is refused as before. The page posts the clicked mission's path on
// every click of a mission's tab, the tab already selected included, and the extension answers by
// calling `show()` on the terminal the run note keeps for that mission, bringing it forward and
// focusing it, and does nothing more, with no notification, when the mission has no running
// runner. When a run's terminal closes the pane is
// re-read and the fresh parse posted to the page. A click on a looped recipe's button shows that recipe's preview on the
// page before anything runs: the extension gathers the named single-task lines from the recipes,
// read afresh, runs the runner's `preview` with them, the mission, and the rule file at the
// project root as a short-lived child process, and posts what it printed. The person may override
// any task's line by picking another named single-task line, and starting the run launches the
// runner's `loop` in the run terminal with every named line and every override, whether or not a
// task is still unresolved.
//
// The live read belongs to the extension's session, not to the panel: the extension reads no
// mission and watches no file until the side-bar view is first resolved or a Gurita command first
// runs, and whichever comes first starts the session's live read, which, with the one file system watcher over the mission documents under
// the project root, created with the first live read that succeeds, lasts until the extension
// deactivates, released neither when the panel is hidden nor when it is closed. The watcher's
// events are debounced so that a burst of writes causes one re-read, made whatever is visible. A
// change to a mission's question document or task list re-reads that mission's documents in
// process against the live list last read, choosing its next step, and with it the recipes its
// page lists, and its default pane and counting its review commits afresh, and creating or deleting
// a `requirements.md`, or changing a `TASKS_TODO.md`, also re-runs `missions.py live`. A re-read
// posts to the panel only while it is shown; a hidden or closed panel's page is drawn from the
// current read by the ready message it posts when shown or opened, so no stale flag is kept. The
// refresh control on the page and the refresh command each re-read everything, as a fallback. Git
// state is not watched. Every re-read the session keeps, a full one or a burst's, is told to the
// side-bar view's tree (`missionTree.ts`), which redraws its rows from it.
// The page stays on the mission it shows unless that mission is no longer live, when it falls back
// to the first.

import * as os from 'node:os';
import * as vscode from 'vscode';
import { MissionDocuments, readMissionDocuments } from './documents';
import { LiveMission, LiveRead, projectRoot, readLive } from './live';
import { PreviewRead, SingleTaskLine, loopArguments, ruleFile, runOverrides, runPreview, singleTaskLines } from './loop';
import {
  BUTTON_RECIPES,
  PageRecipe,
  PageVariantChoice,
  Recipe,
  buttonRecipe,
  ownRecipesFile,
  pageRecipes,
  readRecipes,
  selectedChoice,
  stageRecipes,
} from './recipes';
import {
  ALTERNATIVE_SELECTIONS_KEY,
  AlternativeSelections,
  PROJECT_SELECTIONS_KEY,
  ProjectSelections,
  SELECTIONS_KEY,
  Selections,
  alternativeSelection,
  dropStaleAlternativeSelections,
  dropStaleProjectSelections,
  dropStaleSelections,
  missionSelections,
  readAlternativeSelections,
  readProjectSelections,
  readSelections,
  rememberAlternativeSelection,
  rememberSelection,
} from './selections';
import { variantStoreFile } from './variantStore';
import { disabledCommands, readHarnessStates } from './harnessSettings';
import { Harness } from './lineValues';
import { FileEventKind, RefreshBatch, RefreshQueue, WATCHED_PATTERN, eventEffect } from './refresh';
import { OPTIONAL_PLACEHOLDERS } from './placeholders';
import { refuseWhileRunning, runnerFile, runningMissions, showRun, startChain, startLoop } from './runs';
import { MissionWorkflow, WorkflowStep, missionWorkflow, reviewCount } from './workflow';
import { StartingButton, StartingOffer, variantValues } from './startingRows';

const VIEW_TYPE = 'gurita.missionPane';
const PANEL_TITLE = 'Gurita Missions';

/** The placeholders a mission page holds a value for: the mission's own path. */
const PAGE_PLACEHOLDERS = ['path'];

/** A button on a question's card. */
type QuestionButton = 'discussQuestion' | 'answerQuestion' | 'answerWithRecommendation';

/** A mission-starting button at the tab row's end, and a mission-starting row of the side-bar view. */
type MissionButton = StartingButton;

/** A message the page posts to the extension. */
type PageMessage =
  | { type: 'ready' }
  | { type: 'refresh' }
  | { type: 'missionTab'; mission: string }
  | { type: 'runRecipe'; mission: string; recipe: string; variant: string }
  | { type: 'selectVariant'; mission: string; recipe: string; variant: string }
  | { type: 'questionButton'; button: QuestionButton; mission: string; question: string; variant: string }
  | { type: 'alternativeButton'; mission: string; question: string; alternative: string; variant: string }
  | { type: 'missionButton'; button: MissionButton; variant: string }
  | { type: 'taskButton'; mission: string; variant: string }
  | { type: 'selectButtonVariant'; button: FixedButton; mission?: string; variant: string }
  | { type: 'selectAlternativeVariant'; mission: string; question: string; alternative: string; variant: string }
  | { type: 'previewLoop'; mission: string; recipe: string; variant: string }
  | { type: 'startLoop'; mission: string; recipe: string; overrides: Record<string, string> };

/**
 * The merged recipe list as read from the two recipe files, with the commands of the harnesses the
 * Settings window disabled, or the cause they could not be read.
 */
type RecipeRead = { state: 'read'; recipes: Recipe[]; disabled: Harness[] } | { state: 'failed'; cause: string };

/** The recipe list one mission's page shows, or the cause the recipes could not be read. */
type RecipePart = { state: 'read'; recipes: PageRecipe[] } | { state: 'failed'; cause: string };

/** One of the seven buttons outside the recipe list, each running the recipe of its fixed name. */
type FixedButton = keyof typeof BUTTON_RECIPES;

/**
 * A fixed-name button on a mission's page, its dropdown's selection remembered per recipe on that
 * mission; the answer-with-alternative buttons, one per alternative, each with a dropdown and a
 * selection of its own, are posted apart.
 */
type PageButton = Exclude<FixedButton, MissionButton | 'answerWithAlternative'>;

/** The fixed-name buttons on a mission's page posted once with each mission, by the button. */
const PAGE_BUTTONS: readonly PageButton[] = ['discussQuestion', 'answerQuestion', 'answerWithRecommendation', 'discussTask'];

/** The two mission-starting buttons, belonging to no mission, their dropdowns' selections remembered once per project. */
const STARTING_BUTTONS: readonly MissionButton[] = ['discussGoal', 'defineMission'];

/**
 * What a fixed-name button runs, as its dropdown, label, and hover text show it: the variants it
 * offers and the one selected, with that variant's lines; or no variant at all,
 * every one it could run having a line on a disabled harness, the button drawn disabled.
 */
type FixedButtonEntry =
  | {
      state: 'offered';
      /** The selected variant's lines as written, placeholders included. */
      lines: string[];
      /** The variants the button's dropdown offers, at least one, in the recipe's order. */
      variants: PageVariantChoice[];
      /** The index in `variants` of the variant selected, the one the button runs. */
      selected: number;
    }
  | { state: 'disabled'; cause: string };

/** What each fixed-name button runs, by the button; a button whose recipe cannot be read or run is left out. */
type FixedButtons = Partial<Record<FixedButton, FixedButtonEntry>>;

/** What the latest answer posted for a fixed-name button, which its click and its dropdown's selection are checked against. */
type ButtonPost =
  | { state: 'offered'; recipe: string; lines: string[]; variants: string[]; selected: number }
  | { state: 'disabled' }
  | { state: 'refused'; cause: string };

/** What the latest answer posted for each fixed-name button of one scope, by the button. */
type ButtonPosts = Partial<Record<FixedButton, ButtonPost>>;

/**
 * What the answer-with-alternative button of one alternative on a question's card runs, as its own
 * dropdown, label, and hover text show it: the question's Short Title, the Alternative Id, and the
 * button's entry, the variant selected the one remembered for that alternative, else the default.
 */
interface AlternativeButtonEntry {
  question: string;
  alternative: string;
  entry: FixedButtonEntry;
}

/** A message the extension posts to the page. */
type PaneMessage =
  | {
      type: 'live';
      /**
       * Each live mission with its documents, the step its diagram fills, left out when none is
       * chosen, the count its additional review round carries, left out while there is none, the
       * pane its page opens on, and the recipe list its page shows, the recipes that fit that step.
       */
      missions: ({ path: string; state: string; title: string } & MissionDocuments &
        MissionWorkflow & { recipes: RecipePart; buttons: FixedButtons; alternativeButtons: AlternativeButtonEntry[] })[];
      /** The paths of the missions with a running runner, whose pages are drawn as running. */
      running: string[];
      /** What the two mission-starting buttons run, which their dropdowns, labels, and hover text show. */
      buttons: FixedButtons;
    }
  | {
      type: 'liveFailure';
      cause: string;
      /** What the two mission-starting buttons run, drawn in the failure state too. */
      buttons: FixedButtons;
    }
  | {
      type: 'running';
      /** The paths of the missions with a running runner, whose pages are drawn as running. */
      missions: string[];
    }
  | {
      type: 'preview';
      mission: string;
      recipe: string;
      /** The looped recipe's lines as written, the slot line last. */
      lines: string[];
      /** The named single-task lines' names, the choices an override picks from. */
      names: string[];
      result: PreviewRead;
    }
  | { type: 'loopStarted'; mission: string };

/** What a mission's latest preview ran with, which starting its run passes on unchanged. */
interface HeldPreview {
  root: string;
  recipe: string;
  recipeLines: string[];
  lines: SingleTaskLine[];
}

/**
 * What the latest answer posted: the project root, the live missions' paths, the recipes each
 * mission's page listed, the fixed-name buttons each mission's page drew, the Short Titles each
 * mission's question view showed, each with its alternatives' ids, and the answer-with-alternative
 * button each of those alternatives drew, by mission, Short Title, and Alternative Id.
 */
interface Posted {
  root: string;
  missions: Set<string>;
  recipes: Map<string, PageRecipe[]>;
  buttons: Map<string, ButtonPosts>;
  questions: Map<string, Map<string, Set<string>>>;
  alternatives: Map<string, Map<string, Map<string, ButtonPost>>>;
}

/**
 * What the latest successful live read gave and the pane last drew: the project root, the live
 * missions in the order printed, each one's documents as last read and what its diagram draws, and
 * the merged recipes, out of which each page's list is chosen for its step.
 */
interface Current {
  root: string;
  live: LiveMission[];
  documents: Map<string, MissionDocuments>;
  workflows: Map<string, MissionWorkflow>;
  recipes: RecipeRead;
}

let panel: vscode.WebviewPanel | undefined;
let posted: Posted | undefined;
let current: Current | undefined;

/** The cause of the failure state the latest answer posted, kept while it stands so an edit can post it again. */
let failure: string | undefined;

/** What the latest answer, the pages or the failure state, posted for the two mission-starting buttons. */
let startingPosts: ButtonPosts | undefined;

/** The watcher over the mission documents, and the project root it was created over. */
let watcher: { root: string; disposables: vscode.Disposable[] } | undefined;

/**
 * The debounce gathering the watcher's events into one re-read, created when the session's live
 * read starts and kept until the extension deactivates: undefined until the side-bar view is first
 * resolved or a Gurita command first runs.
 */
let queue: RefreshQueue | undefined;

/** The number of full re-reads started, so only the latest one started posts its answer. */
let reads = 0;

/** The number of the latest full re-read that settled, so a ready message knows whether one is still under way. */
let settled = 0;

/** Each mission's latest preview, by the mission's path. */
const previews = new Map<string, HeldPreview>();

/** What is called after every re-read the session's live read keeps, a full one or a burst's. */
const readListeners: (() => void)[] = [];

/** What is called after every change to the variants remembered for the two mission-starting controls. */
const startingListeners: (() => void)[] = [];

/** What the side-bar view's two mission-starting rows last drew, which a row's click runs. */
let drawnOffers: Record<MissionButton, StartingOffer> | undefined;

/** One live mission as the session's live read holds it: its documents and what its workflow draws. */
export interface SessionMission {
  mission: LiveMission;
  documents: MissionDocuments;
  workflow: MissionWorkflow;
}

/** The session's live read: not yet settled, the live missions in the order printed, or the failure's cause. */
export type SessionRead = { state: 'pending' } | { state: 'read'; missions: SessionMission[] } | { state: 'failed'; cause: string };

/** The session's live read as it stands. */
export function sessionRead(): SessionRead {
  if (current !== undefined) {
    const shown = current;
    return {
      state: 'read',
      missions: shown.live.map((mission) => ({
        mission,
        documents: shown.documents.get(mission.path) as MissionDocuments,
        workflow: shown.workflows.get(mission.path) as MissionWorkflow,
      })),
    };
  }
  return failure !== undefined ? { state: 'failed', cause: failure } : { state: 'pending' };
}

/** Calls `listener` after every re-read the session's live read keeps, until the returned disposable is disposed. */
export function onSessionRead(listener: () => void): vscode.Disposable {
  readListeners.push(listener);
  return {
    dispose(): void {
      const index = readListeners.indexOf(listener);
      if (index >= 0) {
        readListeners.splice(index, 1);
      }
    },
  };
}

/**
 * Calls `listener` after every change to the variant remembered for either mission-starting control,
 * made from the side-bar view's QuickPick or the pane's dropdown, and after every edit in the
 * Settings window, which may change what either control runs, until the returned disposable is
 * disposed.
 */
export function onStartingSelection(listener: () => void): vscode.Disposable {
  startingListeners.push(listener);
  return {
    dispose(): void {
      const index = startingListeners.indexOf(listener);
      if (index >= 0) {
        startingListeners.splice(index, 1);
      }
    },
  };
}

/** Tells every listener that what a mission-starting control runs may have changed. */
function startingChanged(): void {
  for (const listener of [...startingListeners]) {
    listener();
  }
}

/** Tells every listener that the session's live read kept a re-read. */
function readKept(): void {
  for (const listener of [...readListeners]) {
    listener();
  }
}

/**
 * Starts the session's live read when nothing has started it yet, as the side-bar view's first
 * resolution does; a read already started is left as it stands.
 */
export function startLiveRead(context: vscode.ExtensionContext): void {
  startSession(context);
}

/**
 * Re-reads everything the session's live read holds, starting the session when no command has
 * started it yet: the live missions, every mission's documents, and the recipes, the side-bar tree
 * redrawn from the fresh parse as every kept re-read redraws it, and the fresh parse posted to the
 * pane while it is shown. A hidden or closed pane draws it from its next ready message. The refresh
 * command and the side-bar view's Refresh title-bar action both run it.
 */
export function refreshMissions(context: vscode.ExtensionContext): void {
  if (startSession(context)) {
    return;
  }
  void answer(context);
}

/**
 * Starts the session's live read when no Gurita command has started it yet, and tells whether it
 * did: the debounce the watcher's events go through and the first full read, both kept until the
 * extension deactivates, when the read and the watcher are released.
 */
function startSession(context: vscode.ExtensionContext): boolean {
  if (queue !== undefined) {
    return false;
  }
  queue = new RefreshQueue((batch) => void flushEvents(context, batch));
  context.subscriptions.push({ dispose: endSession });
  void answer(context);
  return true;
}

/** Releases the session's live read and its watcher, as the extension deactivates. */
function endSession(): void {
  queue?.dispose();
  queue = undefined;
  unwatch();
  current = undefined;
  failure = undefined;
  posted = undefined;
}

/**
 * Posts the paths of the missions with a running runner to the page, when the extension holds a
 * pane, so their pages are drawn as running. A hidden pane holds no page, and the next redraw,
 * answering the ready message its page posts when shown again, carries them instead.
 */
export function postRunning(): void {
  if (panel !== undefined) {
    void post(panel, { type: 'running', missions: runningMissions() });
  }
}

/**
 * Creates the one mission pane, or reveals the one the extension already holds, starting the
 * session's live read when no command has started it yet.
 */
export function openMissionPane(context: vscode.ExtensionContext): void {
  startSession(context);
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
  created.webview.html = pageShell(created.webview, vscode.Uri.joinPath(scripts, 'page.js'), PANEL_TITLE);
  created.webview.onDidReceiveMessage(
    (message: PageMessage) => {
      if (message?.type === 'ready') {
        if (settled === reads) {
          void postPages(context, created);
        }
      } else if (message?.type === 'refresh') {
        void answer(context);
      } else if (message?.type === 'missionTab') {
        if (typeof message.mission === 'string') {
          showRun(message.mission);
        }
      } else if (message?.type === 'runRecipe') {
        runRecipe(context, message.mission, message.recipe, message.variant);
      } else if (message?.type === 'selectVariant') {
        void selectVariant(context, created, message.mission, message.recipe, message.variant);
      } else if (message?.type === 'questionButton') {
        void runQuestionButton(context, message.button, message.mission, message.question, message.variant);
      } else if (message?.type === 'alternativeButton') {
        runAlternativeButton(context, message.mission, message.question, message.alternative, message.variant);
      } else if (message?.type === 'missionButton') {
        void runMissionButton(context, message.button, message.variant);
      } else if (message?.type === 'taskButton') {
        void runTaskButton(context, message.mission, message.variant);
      } else if (message?.type === 'selectButtonVariant') {
        void selectButtonVariant(context, created, message.button, message.mission, message.variant);
      } else if (message?.type === 'selectAlternativeVariant') {
        void selectAlternativeVariant(context, created, message.mission, message.question, message.alternative, message.variant);
      } else if (message?.type === 'previewLoop') {
        void previewLoop(context, created, message.mission, message.recipe, message.variant);
      } else if (message?.type === 'startLoop') {
        runLoop(context, created, message.mission, message.recipe, message.overrides);
      }
    },
    undefined,
    context.subscriptions,
  );
  created.onDidDispose(
    () => {
      if (panel === created) {
        panel = undefined;
        posted = undefined;
        startingPosts = undefined;
        previews.clear();
      }
    },
    undefined,
    context.subscriptions,
  );
}

/**
 * Watches the mission documents under the project root `root`, replacing a watcher created over
 * another root. Each event is handed to the debounce as the effect it asks for.
 */
function watch(root: string): void {
  if (watcher?.root === root) {
    return;
  }
  unwatch();
  const created = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.file(root), WATCHED_PATTERN));
  const event = (kind: FileEventKind) => (uri: vscode.Uri) => {
    const effect = eventEffect(root, uri.fsPath, kind);
    if (effect !== undefined) {
      queue?.add(effect);
    }
  };
  watcher = {
    root,
    disposables: [
      created.onDidCreate(event('created')),
      created.onDidChange(event('changed')),
      created.onDidDelete(event('deleted')),
      created,
    ],
  };
}

function unwatch(): void {
  for (const disposable of watcher?.disposables ?? []) {
    disposable.dispose();
  }
  watcher = undefined;
}

/**
 * What the page of the live mission `mission` draws from its documents `documents` as read and the
 * review commits git holds for it: its diagram's step and count and the pane it opens on.
 */
function readWorkflow(root: string, mission: LiveMission, documents: MissionDocuments): Promise<MissionWorkflow> {
  return missionWorkflow(mission.state, documents.facts, () => reviewCount(root, mission.path));
}

/**
 * Acts on one debounced burst of the watcher's events, whatever is visible: a burst that moves the
 * live list re-reads everything; any other re-reads in process the documents of each live mission
 * it touched, chooses what its diagram draws, and with it the recipes its page lists, and its
 * default pane afresh, keeps it in the session's live read, and posts the fresh parse to the pane
 * while it is shown.
 */
async function flushEvents(context: vscode.ExtensionContext, batch: RefreshBatch): Promise<void> {
  if (queue === undefined) {
    return;
  }
  if (batch.live || current === undefined) {
    void answer(context);
    return;
  }
  const shown = current;
  const sequence = reads;
  const touched = shown.live.filter((mission) => batch.missions.includes(mission.path) && shown.documents.has(mission.path));
  if (touched.length === 0) {
    return;
  }
  const read = touched.map((mission) => ({ mission, documents: readMissionDocuments(shown.root, mission.path) }));
  const workflows = await Promise.all(read.map(({ mission, documents }) => readWorkflow(shown.root, mission, documents)));
  if (sequence !== reads || current !== shown) {
    return;
  }
  read.forEach(({ mission, documents }, index) => {
    shown.documents.set(mission.path, documents);
    shown.workflows.set(mission.path, workflows[index]);
  });
  readKept();
  const target = shownPanel();
  if (target !== undefined) {
    await post(target, publish(context, shown));
  }
}

/** The pane, while the extension holds one and it is shown; a hidden page holds nothing to post to. */
function shownPanel(): vscode.WebviewPanel | undefined {
  return panel !== undefined && panel.visible ? panel : undefined;
}

/**
 * Reads the shipped recipe file and the person's own recipe file into the merged recipe list, the
 * per-user variant store laid over it.
 */
function readAllRecipes(context: vscode.ExtensionContext): Recipe[] {
  const files = recipeFiles(context);
  return readRecipes(files.shipped, files.own, files.store);
}

/** The shipped recipe file, the person's own recipe file, and the per-user variant store file. */
export function recipeFiles(context: vscode.ExtensionContext): { shipped: string; own: string; store: string } {
  const setting = vscode.workspace.getConfiguration('gurita').get<string>('ownRecipesFile');
  const home = os.homedir();
  return { shipped: context.asAbsolutePath('bundled/shipped_recipes.md'), own: ownRecipesFile(setting, home), store: variantStoreFile(home) };
}

/** The commands of the harnesses the Settings window disabled, read afresh from the variant store file. */
function readDisabled(): Harness[] {
  return disabledCommands(readHarnessStates(variantStoreFile(os.homedir())));
}

/**
 * Reads the shipped recipe file and the person's own recipe file into the merged list, with the
 * harnesses the Settings window disabled, or the cause they could not be read.
 */
function readRecipeList(context: vscode.ExtensionContext): RecipeRead {
  try {
    return { state: 'read', recipes: readAllRecipes(context), disabled: readDisabled() };
  } catch (error) {
    return { state: 'failed', cause: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * The recipe list the page of a mission whose diagram fills `step` shows, out of the merged list
 * `read`: the recipes `stageRecipes` keeps for that step, `questionsOpen` whether any question of
 * the mission is open, every recipe when `step` is undefined, as `pageRecipes` lists them for a page holding its mission's path, each recipe's dropdown on the
 * variant `remembered` names for it, every variant with a line on a disabled harness left out. A
 * failed read is posted to the page as it stands.
 */
function missionRecipes(
  read: RecipeRead,
  step: WorkflowStep | undefined,
  questionsOpen: boolean,
  remembered: ReadonlyMap<string, string>,
): RecipePart {
  if (read.state === 'failed') {
    return read;
  }
  return { state: 'read', recipes: pageRecipes(stageRecipes(read.recipes, step, questionsOpen), PAGE_PLACEHOLDERS, remembered, read.disabled) };
}

/** The dropdown selections the project's `workspaceState` remembers, by mission path and recipe name. */
function storedSelections(context: vscode.ExtensionContext): Selections {
  return readSelections(context.workspaceState.get(SELECTIONS_KEY));
}

/**
 * The selections remembered for the live missions `live`, every remembered variant its recipe in
 * the merged list `read` no longer carries dropped from `workspaceState`, so its button falls back
 * to the recipe's current default. A failed read drops nothing.
 */
function liveSelections(context: vscode.ExtensionContext, live: readonly LiveMission[], read: RecipeRead): Selections {
  let selections = storedSelections(context);
  if (read.state === 'failed') {
    return selections;
  }
  let changed = false;
  for (const mission of live) {
    const kept = dropStaleSelections(selections, mission.path, read.recipes);
    if (kept !== undefined) {
      selections = kept;
      changed = true;
    }
  }
  if (changed) {
    void context.workspaceState.update(SELECTIONS_KEY, selections);
  }
  return selections;
}

/**
 * Re-reads everything the session's live read holds, the live missions, every mission's
 * documents, and the recipes, keeps the fresh parse, or the failure state the live read gives, and
 * posts it to the pane while it is shown. Only the latest re-read started keeps and posts its answer.
 */
async function answer(context: vscode.ExtensionContext): Promise<void> {
  const sequence = ++reads;
  try {
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const read: LiveRead = await readLive(folder, context.asAbsolutePath('bundled/missions.py'));
    if (sequence !== reads || queue === undefined) {
      return;
    }
    if (read.state === 'read') {
      const documents = new Map(read.missions.map((mission) => [mission.path, readMissionDocuments(read.root, mission.path)]));
      const workflows = await Promise.all(
        read.missions.map((mission) => readWorkflow(read.root, mission, documents.get(mission.path) as MissionDocuments)),
      );
      if (sequence !== reads || queue === undefined) {
        return;
      }
      watch(read.root);
      current = {
        root: read.root,
        live: read.missions,
        documents,
        workflows: new Map(read.missions.map((mission, index) => [mission.path, workflows[index]])),
        recipes: readRecipeList(context),
      };
      failure = undefined;
    } else {
      posted = undefined;
      current = undefined;
      failure = read.cause;
    }
    settled = sequence;
    readKept();
    const target = shownPanel();
    if (target === undefined) {
      return;
    }
    await post(target, current !== undefined ? publish(context, current) : failureMessage(context, failure as string));
  } finally {
    if (sequence === reads) {
      settled = sequence;
    }
  }
}

/**
 * The failure state's message for `cause`, with what the two mission-starting buttons run, the
 * recipes read afresh, noting it as what the latest answer posted for them.
 */
function failureMessage(context: vscode.ExtensionContext, cause: string): PaneMessage {
  const read = readRecipeList(context);
  const starting = fixedButtons(read, STARTING_BUTTONS, new Map(Object.entries(projectSelections(context, read))));
  startingPosts = starting.posts;
  return { type: 'liveFailure', cause, buttons: starting.entries };
}

/**
 * The dropdown selections of the two mission-starting buttons the project's `workspaceState`
 * remembers, by recipe name, every remembered variant its recipe in the merged list `read` no
 * longer carries dropped from it. A failed read drops nothing.
 */
function projectSelections(context: vscode.ExtensionContext, read: RecipeRead): ProjectSelections {
  const selections = readProjectSelections(context.workspaceState.get(PROJECT_SELECTIONS_KEY));
  if (read.state === 'failed') {
    return selections;
  }
  const kept = dropStaleProjectSelections(selections, read.recipes);
  if (kept === undefined) {
    return selections;
  }
  void context.workspaceState.update(PROJECT_SELECTIONS_KEY, kept);
  return kept;
}

/**
 * Posts the pages again from the session's live read, their recipes re-read, in answer to a ready
 * message and after a change to a remembered selection, so the recipe list's dropdowns and the
 * fixed-name buttons' labels show it at once: the mission pages when the latest read gave them,
 * and the failure state, its buttons re-read, when it gave that.
 */
async function postPages(context: vscode.ExtensionContext, target: vscode.WebviewPanel): Promise<void> {
  if (panel !== target) {
    return;
  }
  if (current !== undefined) {
    current.recipes = readRecipeList(context);
    await post(target, publish(context, current));
  } else if (failure !== undefined) {
    await post(target, failureMessage(context, failure));
  }
}

/**
 * Tells every surface drawn from the recipes that an edit in the Settings window changed them: the
 * side-bar view's two mission-starting rows are redrawn, their recipes read afresh, and the pages
 * are posted again to the pane while it is shown, their recipes re-read. A hidden or closed pane
 * draws them from its next ready message.
 */
export async function recipesChanged(context: vscode.ExtensionContext): Promise<void> {
  startingChanged();
  const target = shownPanel();
  if (target !== undefined) {
    await postPages(context, target);
  }
}

/**
 * What the fixed-name button `key` runs, out of the merged list `read`, as `buttonRecipe` offers
 * it, `remembered` the variant name its dropdown's selection remembers: the variants its dropdown
 * offers, every variant with a line on a disabled harness left out, and the one selected, with its
 * lines; or no variant, every one it could run left out, the button drawn disabled. A button whose
 * recipe cannot be read or run gets no entry and shows its name alone. Beside the entry posted,
 * what the button's click and dropdown are checked against, a refused one with its cause.
 */
function fixedButton(read: RecipeRead, key: FixedButton, remembered: string | undefined): { entry?: FixedButtonEntry; post: ButtonPost } {
  const name = BUTTON_RECIPES[key];
  if (read.state === 'failed') {
    return { post: { state: 'refused', cause: `The recipes could not be read: ${read.cause}` } };
  }
  const found = buttonRecipe(read.recipes, name, BUTTON_PLACEHOLDERS[key], remembered, read.disabled);
  if (found.state === 'found') {
    const lines = [...found.variant.lines];
    return {
      entry: {
        state: 'offered',
        lines,
        variants: found.variants.map((variant) => ({ name: variant.name, own: variant.own })),
        selected: found.selected,
      },
      post: { state: 'offered', recipe: found.recipe.name, lines, variants: found.variants.map((variant) => variant.name), selected: found.selected },
    };
  }
  if (found.state === 'disabled') {
    return { entry: { state: 'disabled', cause: found.cause }, post: { state: 'disabled' } };
  }
  return { post: { state: 'refused', cause: found.cause } };
}

/**
 * What each of the fixed-name buttons `keys` runs, as `fixedButton` gives it, the variant name
 * `remembered` holds for each recipe the dropdown selection remembered for it, a button whose
 * recipe cannot be read or run left out of the entries; beside them, what each button's click and
 * dropdown are checked against.
 */
function fixedButtons(
  read: RecipeRead,
  keys: readonly FixedButton[],
  remembered: ReadonlyMap<string, string>,
): { entries: FixedButtons; posts: ButtonPosts } {
  const entries: FixedButtons = {};
  const posts: ButtonPosts = {};
  for (const key of keys) {
    const { entry, post } = fixedButton(read, key, remembered.get(BUTTON_RECIPES[key]));
    if (entry !== undefined) {
      entries[key] = entry;
    }
    posts[key] = post;
  }
  return { entries, posts };
}

/** The answer-with-alternative selections the project's `workspaceState` remembers, by mission path, Short Title, and Alternative Id. */
function storedAlternativeSelections(context: vscode.ExtensionContext): AlternativeSelections {
  return readAlternativeSelections(context.workspaceState.get(ALTERNATIVE_SELECTIONS_KEY));
}

/**
 * The answer-with-alternative selections, every remembered variant the recipe those buttons run,
 * in the merged list `read`, no longer carries dropped from `workspaceState`, so its button falls
 * back to the recipe's current default. A failed read drops nothing.
 */
function liveAlternativeSelections(context: vscode.ExtensionContext, read: RecipeRead): AlternativeSelections {
  const selections = storedAlternativeSelections(context);
  if (read.state === 'failed') {
    return selections;
  }
  const kept = dropStaleAlternativeSelections(selections, read.recipes.find((recipe) => recipe.name === BUTTON_RECIPES.answerWithAlternative));
  if (kept === undefined) {
    return selections;
  }
  void context.workspaceState.update(ALTERNATIVE_SELECTIONS_KEY, kept);
  return kept;
}

/**
 * What the answer-with-alternative button of every alternative the question view of the mission at
 * `mission` shows runs, out of the merged list `read`, each standing on the variant remembered for
 * that alternative in `selections`, else the recipe's default, as `fixedButton` gives it; a button
 * whose recipe cannot be read or run left out of the entries. Beside them, what each button's
 * click and dropdown are checked against, by Short Title and Alternative Id.
 */
function alternativeButtons(
  read: RecipeRead,
  mission: string,
  documents: MissionDocuments,
  selections: AlternativeSelections,
): { entries: AlternativeButtonEntry[]; posts: Map<string, Map<string, ButtonPost>> } {
  const entries: AlternativeButtonEntry[] = [];
  const posts = new Map<string, Map<string, ButtonPost>>();
  if (documents.questions.state !== 'read') {
    return { entries, posts };
  }
  for (const question of documents.questions.questions) {
    const byAlternative = posts.get(question.id) ?? new Map<string, ButtonPost>();
    posts.set(question.id, byAlternative);
    for (const alternative of question.alternatives) {
      const { entry, post } = fixedButton(read, 'answerWithAlternative', alternativeSelection(selections, mission, question.id, alternative.id));
      if (entry !== undefined) {
        entries.push({ question: question.id, alternative: alternative.id, entry });
      }
      byAlternative.set(alternative.id, post);
    }
  }
  return { entries, posts };
}

/**
 * The page's message for what `shown` holds, each mission carrying the recipe list its page shows
 * for the step its diagram fills, noting what it lists as what the latest answer posted.
 */
function publish(context: vscode.ExtensionContext, shown: Current): PaneMessage {
  const selections = liveSelections(context, shown.live, shown.recipes);
  const chosen = liveAlternativeSelections(context, shown.recipes);
  const starting = fixedButtons(shown.recipes, STARTING_BUTTONS, new Map(Object.entries(projectSelections(context, shown.recipes))));
  startingPosts = starting.posts;
  const buttons = new Map<string, ButtonPosts>();
  const alternatives = new Map<string, Map<string, Map<string, ButtonPost>>>();
  const missions = shown.live.map((mission) => {
    const workflow = shown.workflows.get(mission.path) as MissionWorkflow;
    const documents = shown.documents.get(mission.path) as MissionDocuments;
    const remembered = missionSelections(selections, mission.path);
    const fixed = fixedButtons(shown.recipes, PAGE_BUTTONS, remembered);
    buttons.set(mission.path, fixed.posts);
    const perAlternative = alternativeButtons(shown.recipes, mission.path, documents, chosen);
    alternatives.set(mission.path, perAlternative.posts);
    return {
      ...mission,
      ...documents,
      ...workflow,
      recipes: missionRecipes(shown.recipes, workflow.step, documents.facts.questionsEmpty === false, remembered),
      buttons: fixed.entries,
      alternativeButtons: perAlternative.entries,
    };
  });
  const questions = new Map<string, Map<string, Set<string>>>();
  for (const mission of missions) {
    if (mission.questions.state === 'read') {
      questions.set(
        mission.path,
        new Map(
          mission.questions.questions.map((question) => [
            question.id,
            new Set(question.alternatives.map((alternative) => alternative.id)),
          ]),
        ),
      );
    }
  }
  posted = {
    root: shown.root,
    missions: new Set(shown.live.map((mission) => mission.path)),
    recipes: new Map(missions.map((mission) => [mission.path, mission.recipes.state === 'read' ? mission.recipes.recipes : []])),
    buttons,
    questions,
    alternatives,
  };
  return { type: 'live', missions, running: runningMissions(), buttons: starting.entries };
}

/**
 * The entry of the recipe named `recipe` the latest answer listed on the page of the live mission
 * at `mission`, when its dropdown stood on the variant named `variant`; undefined otherwise, so the
 * pane starts no variant its last posted list lacks.
 */
function postedEntry(mission: string, recipe: string, variant: unknown): PageRecipe | undefined {
  if (posted === undefined || !posted.missions.has(mission)) {
    return undefined;
  }
  const listed = posted.recipes.get(mission)?.find((entry) => entry.name === recipe);
  return listed !== undefined && selectedChoice(listed).name === variant ? listed : undefined;
}

/**
 * Starts the chain of the variant named `variant` of the recipe named `recipe`, as the latest
 * answer listed it, selected, on the page of the live mission at `mission`, for that mission, its
 * path its one value. A mission the latest answer did not list, or a recipe or variant it did not
 * list so on that mission's page, starts nothing.
 */
function runRecipe(context: vscode.ExtensionContext, mission: string, recipe: string, variant: unknown): void {
  const listed = postedEntry(mission, recipe, variant);
  if (posted === undefined || listed === undefined || listed.kind !== 'runnable') {
    return;
  }
  startChain(context, posted.root, mission, listed.name, listed.lines, { path: mission });
}

/**
 * Remembers the variant named `variant` as the one selected in the dropdown of the recipe named
 * `recipe` on the page of the live mission at `mission`, in the project's `workspaceState`, and
 * posts the pages again with it selected. A mission, recipe, or variant the latest answer did not
 * list on that mission's page remembers nothing.
 */
async function selectVariant(
  context: vscode.ExtensionContext,
  target: vscode.WebviewPanel,
  mission: string,
  recipe: string,
  variant: unknown,
): Promise<void> {
  if (posted === undefined || !posted.missions.has(mission) || typeof variant !== 'string') {
    return;
  }
  const listed = posted.recipes.get(mission)?.find((entry) => entry.name === recipe);
  if (listed === undefined || !listed.variants.some((each) => each.name === variant)) {
    return;
  }
  await context.workspaceState.update(SELECTIONS_KEY, rememberSelection(storedSelections(context), mission, recipe, variant));
  if (current !== undefined && panel === target) {
    await post(target, publish(context, current));
  }
}

/**
 * Remembers the variant named `variant` as the one selected in the dropdown beside the fixed-name
 * button `button`, in the project's `workspaceState`: for a button on a mission's page per recipe
 * on the live mission at `mission`, and for a mission-starting button once per project, and posts
 * the pages, or the failure state, again with it selected. A button, mission, or variant the
 * latest answer did not post so remembers nothing.
 */
async function selectButtonVariant(
  context: vscode.ExtensionContext,
  target: vscode.WebviewPanel,
  button: unknown,
  mission: unknown,
  variant: unknown,
): Promise<void> {
  if (typeof button !== 'string' || typeof variant !== 'string') {
    return;
  }
  const offers = (post: ButtonPost | undefined): post is Extract<ButtonPost, { state: 'offered' }> =>
    post?.state === 'offered' && post.variants.includes(variant);
  if ((STARTING_BUTTONS as readonly string[]).includes(button)) {
    const post = startingPosts?.[button as MissionButton];
    if (!offers(post)) {
      return;
    }
    const stored = readProjectSelections(context.workspaceState.get(PROJECT_SELECTIONS_KEY));
    await context.workspaceState.update(PROJECT_SELECTIONS_KEY, { ...stored, [post.recipe]: variant });
    startingChanged();
  } else if ((PAGE_BUTTONS as readonly string[]).includes(button)) {
    if (posted === undefined || typeof mission !== 'string' || !posted.missions.has(mission)) {
      return;
    }
    const post = posted.buttons.get(mission)?.[button as PageButton];
    if (!offers(post)) {
      return;
    }
    await context.workspaceState.update(SELECTIONS_KEY, rememberSelection(storedSelections(context), mission, post.recipe, variant));
  } else {
    return;
  }
  await postPages(context, target);
}

/**
 * Remembers the variant named `variant` as the one selected in the dropdown beside the
 * answer-with-alternative button of the alternative `alternative` on the card of the question
 * `question` of the live mission at `mission`, in the project's `workspaceState`, per mission,
 * question, and alternative, so every other alternative's button stays where it stood, and posts
 * the pages again with it selected. A mission, question, alternative, or variant the latest answer
 * did not post that button offering remembers nothing.
 */
async function selectAlternativeVariant(
  context: vscode.ExtensionContext,
  target: vscode.WebviewPanel,
  mission: unknown,
  question: unknown,
  alternative: unknown,
  variant: unknown,
): Promise<void> {
  if (posted === undefined || typeof mission !== 'string' || typeof question !== 'string' || typeof alternative !== 'string' || typeof variant !== 'string') {
    return;
  }
  if (!posted.missions.has(mission)) {
    return;
  }
  const post = posted.alternatives.get(mission)?.get(question)?.get(alternative);
  if (post?.state !== 'offered' || !post.variants.includes(variant)) {
    return;
  }
  await context.workspaceState.update(
    ALTERNATIVE_SELECTIONS_KEY,
    rememberAlternativeSelection(storedAlternativeSelections(context), mission, question, alternative, variant),
  );
  await postPages(context, target);
}


async function post(target: vscode.WebviewPanel, message: PaneMessage): Promise<void> {
  try {
    await target.webview.postMessage(message);
  } catch {
    // The panel was closed; there is no page left to answer.
  }
}

/**
 * Shows the preview of the variant named `variant` of the looped recipe named `recipe`, as the
 * latest answer listed it, selected, on the page of the live mission at `mission`, for that
 * mission: the recipes read afresh, the named single-task lines gathered from them, and the
 * runner's `preview` run with those lines, the mission, and the rule file, its print posted to the
 * page. A mission the latest answer did not list, a recipe or variant it did not list so on that
 * mission's page, or a mission with a running chain, runs nothing.
 */
async function previewLoop(
  context: vscode.ExtensionContext,
  target: vscode.WebviewPanel,
  mission: string,
  recipe: string,
  variant: unknown,
): Promise<void> {
  const listed = postedEntry(mission, recipe, variant);
  if (posted === undefined || listed === undefined || listed.kind !== 'looped') {
    return;
  }
  if (refuseWhileRunning(mission)) {
    return;
  }
  const root = posted.root;
  let recipes: Recipe[];
  let disabled: Harness[];
  try {
    recipes = readAllRecipes(context);
    disabled = readDisabled();
  } catch (error) {
    previews.delete(mission);
    const cause = `The recipes could not be read: ${error instanceof Error ? error.message : String(error)}`;
    await post(target, { type: 'preview', mission, recipe, lines: listed.lines, names: [], result: { state: 'failed', cause } });
    return;
  }
  const looped = pageRecipes(recipes, PAGE_PLACEHOLDERS, new Map([[recipe, selectedChoice(listed).name]]), disabled).find(
    (entry) => entry.name === recipe && entry.kind === 'looped' && selectedChoice(entry).name === selectedChoice(listed).name,
  );
  if (looped === undefined) {
    previews.delete(mission);
    const cause = `No looped variant named ${selectedChoice(listed).name} of the recipe ${recipe} could be read.`;
    await post(target, { type: 'preview', mission, recipe, lines: listed.lines, names: [], result: { state: 'failed', cause } });
    return;
  }
  const lines = singleTaskLines(recipes);
  const result = await runPreview(runnerFile(context), root, mission, lines);
  if (result.state === 'read') {
    previews.set(mission, { root, recipe, recipeLines: looped.lines, lines });
  } else {
    previews.delete(mission);
  }
  await post(target, { type: 'preview', mission, recipe, lines: looped.lines, names: lines.map((line) => line.name), result });
}

/**
 * Starts the looped run of the recipe named `recipe` for the live mission at `mission`, with the
 * named single-task lines and the looped recipe's lines its latest preview ran with and every
 * override the person picked, whether or not a task is still unresolved. A mission with no
 * preview of that recipe starts nothing, and a mission with a running chain is refused as any
 * click is.
 */
function runLoop(
  context: vscode.ExtensionContext,
  target: vscode.WebviewPanel,
  mission: string,
  recipe: string,
  overrides: unknown,
): void {
  const held = previews.get(mission);
  if (posted === undefined || !posted.missions.has(mission) || held === undefined || held.recipe !== recipe) {
    return;
  }
  const picked: Record<string, string> = {};
  if (typeof overrides === 'object' && overrides !== null) {
    for (const [title, name] of Object.entries(overrides)) {
      if (typeof name === 'string') {
        picked[title] = name;
      }
    }
  }
  const args = loopArguments(
    runnerFile(context),
    mission,
    ruleFile(held.root),
    held.lines,
    runOverrides(picked, held.lines),
    held.recipeLines,
  );
  if (startLoop(held.root, mission, recipe, args)) {
    previews.delete(mission);
    void post(target, { type: 'loopStarted', mission });
  }
}

/** The placeholder values each question-card button fills, beyond the mission's path and the Short Title. */
const QUESTION_BUTTONS: Record<QuestionButton, { typed: string[] }> = {
  discussQuestion: { typed: ['note'] },
  answerQuestion: { typed: ['answer text'] },
  answerWithRecommendation: { typed: [] },
};

/** The placeholder values each mission-starting button has typed, in the order it asks for them. */
const MISSION_BUTTONS: Record<MissionButton, { typed: string[] }> = {
  discussGoal: { typed: ['goal'] },
  defineMission: { typed: ['goal', 'scope'] },
};

/** The placeholders each fixed-name button holds a value for, its click and its label alike. */
const BUTTON_PLACEHOLDERS: Record<FixedButton, readonly string[]> = {
  discussQuestion: ['path', 'Short Title', ...QUESTION_BUTTONS.discussQuestion.typed],
  answerQuestion: ['path', 'Short Title', ...QUESTION_BUTTONS.answerQuestion.typed],
  answerWithRecommendation: ['path', 'Short Title', ...QUESTION_BUTTONS.answerWithRecommendation.typed],
  answerWithAlternative: ['path', 'Short Title', 'Alternative Id'],
  discussGoal: MISSION_BUTTONS.discussGoal.typed,
  defineMission: MISSION_BUTTONS.defineMission.typed,
  discussTask: ['path', 'issue description'],
};

/** The input box's prompt for each typed value. */
const PROMPTS: Record<string, { prompt: string; placeHolder?: string }> = {
  'answer text': { prompt: 'The answer, recorded as the decision' },
  goal: { prompt: "The mission's goal" },
  scope: {
    prompt: 'The scope, the directory holding the core of the work, as a path from the project root',
    placeHolder: '.',
  },
  'issue description': { prompt: 'The issue, to be clarified into tasks for this mission' },
  note: {
    prompt: 'An optional note for the discussion, carried after the Short Title; leave it empty for none',
    placeHolder: 'Optional',
  },
};

/**
 * The recipe's name and the lines the fixed-name button `button` runs when clicked with its
 * dropdown standing on the variant named `variant`, as `posts`, what the latest answer posted for
 * the button's scope, holds it: only when the button was posted standing on that variant. A
 * button posted as refused, its recipe unreadable or one it cannot run, is told in an error
 * notification naming the cause, and every other click yields nothing.
 */
function postedButton(posts: ButtonPosts | undefined, button: FixedButton, variant: unknown): { name: string; lines: string[] } | undefined {
  return postedRun(posts?.[button], variant);
}

/**
 * The recipe's name and the lines a fixed-name button posted as `post` runs when clicked with its
 * dropdown standing on the variant named `variant`: only when it was posted standing on that
 * variant. A button posted as refused is told in an error notification naming the cause, and
 * every other click yields nothing.
 */
function postedRun(post: ButtonPost | undefined, variant: unknown): { name: string; lines: string[] } | undefined {
  if (post?.state === 'refused') {
    void vscode.window.showErrorMessage(post.cause);
    return undefined;
  }
  if (post?.state !== 'offered' || post.variants[post.selected] !== variant) {
    return undefined;
  }
  return { name: post.recipe, lines: [...post.lines] };
}

/**
 * Asks for each of `names` in VS Code's own input box, one box per value in the order given, and
 * returns the values by placeholder name, or undefined when the person dismisses a box. A box
 * for an optional placeholder accepts an empty value; every other box asks for one.
 */
async function askValues(names: readonly string[]): Promise<Record<string, string> | undefined> {
  const values: Record<string, string> = {};
  for (const name of names) {
    const optional = OPTIONAL_PLACEHOLDERS.includes(name);
    const typed = await vscode.window.showInputBox({
      ...PROMPTS[name],
      ignoreFocusOut: true,
      validateInput: (value) =>
        !optional && value.trim() === '' ? 'Type a value, or press Escape to start nothing.' : undefined,
    });
    if (typed === undefined) {
      return undefined;
    }
    values[name] = optional ? typed.trim() : typed;
  }
  return values;
}

/** Whether the latest answer showed the question `question`, and the alternative given, for `mission`. */
function shown(mission: string, question: string, alternative?: string): boolean {
  const alternatives = posted?.questions.get(mission)?.get(question);
  return alternatives !== undefined && (alternative === undefined || alternatives.has(alternative));
}

/**
 * Runs a question card's button for the question `question` of the live mission at `mission`, as
 * the latest answer listed them: the Short Title from the card, the answer text, for the answer
 * button, and the optional discussion note, for the discuss button, typed into an input box, the
 * lines those of the variant named `variant` the latest answer posted the button standing on. A
 * question or mission the latest answer did not show, a variant it did not post the button
 * standing on, a mission with a running chain, or a box dismissed with Escape starts nothing.
 */
async function runQuestionButton(
  context: vscode.ExtensionContext,
  button: QuestionButton,
  mission: string,
  question: string,
  variant: unknown,
): Promise<void> {
  const spec = QUESTION_BUTTONS[button];
  if (spec === undefined || posted === undefined || !posted.missions.has(mission) || !shown(mission, question)) {
    return;
  }
  if (refuseWhileRunning(mission)) {
    return;
  }
  const recipe = postedButton(posted.buttons.get(mission), button, variant);
  if (recipe === undefined) {
    return;
  }
  const root = posted.root;
  const typed = await askValues(spec.typed);
  if (typed === undefined) {
    return;
  }
  startChain(context, root, mission, recipe.name, recipe.lines, { path: mission, 'Short Title': question, ...typed });
}

/**
 * Runs the answer-with-alternative button of the alternative `alternative` on the card of the
 * question `question`, the Short Title and the Alternative Id both from the card clicked, the
 * lines those of the variant named `variant` the latest answer posted that alternative's own
 * dropdown standing on.
 */
function runAlternativeButton(context: vscode.ExtensionContext, mission: string, question: string, alternative: string, variant: unknown): void {
  if (posted === undefined || !posted.missions.has(mission) || !shown(mission, question, alternative)) {
    return;
  }
  if (refuseWhileRunning(mission)) {
    return;
  }
  const recipe = postedRun(posted.alternatives.get(mission)?.get(question)?.get(alternative), variant);
  if (recipe === undefined) {
    return;
  }
  startChain(context, posted.root, mission, recipe.name, recipe.lines, {
    path: mission,
    'Short Title': question,
    'Alternative Id': alternative,
  });
}

/**
 * Runs the new-task button of the live mission at `mission`, as the latest answer listed it: the
 * issue description typed into an input box, the mission's path from the page, the lines those of
 * the variant named `variant` the latest answer posted the button standing on. A mission the
 * latest answer did not list, a variant it did not post the button standing on, or a mission with
 * a running chain, starts nothing.
 */
async function runTaskButton(context: vscode.ExtensionContext, mission: string, variant: unknown): Promise<void> {
  if (posted === undefined || !posted.missions.has(mission)) {
    return;
  }
  if (refuseWhileRunning(mission)) {
    return;
  }
  const recipe = postedButton(posted.buttons.get(mission), 'discussTask', variant);
  if (recipe === undefined) {
    return;
  }
  const root = posted.root;
  const typed = await askValues(['issue description']);
  if (typed === undefined) {
    return;
  }
  startChain(context, root, mission, recipe.name, recipe.lines, { path: mission, ...typed });
}

/**
 * The directory a mission-starting run starts in: the project root the latest answer read, else
 * the top level of the git work tree holding the first workspace folder, else that folder, and
 * undefined when no folder is open.
 */
export async function startingRoot(): Promise<string | undefined> {
  if (posted !== undefined) {
    return posted.root;
  }
  if (current !== undefined) {
    return current.root;
  }
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (folder === undefined) {
    return undefined;
  }
  const top = await projectRoot(folder);
  return 'root' in top ? top.root : folder;
}

/**
 * Runs a mission-starting button: the goal, and for the define button then the scope, typed into
 * input boxes, the run belonging to no mission, the lines those of the variant named `variant` the
 * latest answer, the pages or the failure state, posted the button standing on; any other variant
 * starts nothing.
 */
async function runMissionButton(context: vscode.ExtensionContext, button: MissionButton, variant: unknown): Promise<void> {
  const spec = MISSION_BUTTONS[button];
  if (spec === undefined) {
    return;
  }
  const recipe = postedButton(startingPosts, button, variant);
  if (recipe === undefined) {
    return;
  }
  const typed = await askValues(spec.typed);
  if (typed === undefined) {
    return;
  }
  startChain(context, await startingRoot(), undefined, recipe.name, recipe.lines, typed);
}

/**
 * What the mission-starting control `button` runs, out of the merged list `read` and the variant
 * the project remembers for its recipe, as `buttonRecipe` offers it to the pane's button.
 */
function startingOffer(read: RecipeRead, button: MissionButton, remembered: ProjectSelections): StartingOffer {
  if (read.state === 'failed') {
    return { state: 'refused', cause: `The recipes could not be read: ${read.cause}` };
  }
  const name = BUTTON_RECIPES[button];
  const found = buttonRecipe(read.recipes, name, BUTTON_PLACEHOLDERS[button], remembered[name], read.disabled);
  if (found.state === 'found') {
    return {
      state: 'offered',
      recipe: found.recipe.name,
      variants: found.variants.map((variant) => ({ name: variant.name, lines: [...variant.lines] })),
      selected: found.selected,
    };
  }
  if (found.state === 'disabled') {
    return { state: 'disabled', recipe: found.recipe.name, cause: found.cause };
  }
  return { state: 'refused', cause: found.cause };
}

/** What the two mission-starting controls run, their recipes read afresh, each on the variant the project remembers. */
function readStartingOffers(context: vscode.ExtensionContext): Record<MissionButton, StartingOffer> {
  const read = readRecipeList(context);
  const remembered = projectSelections(context, read);
  return {
    discussGoal: startingOffer(read, 'discussGoal', remembered),
    defineMission: startingOffer(read, 'defineMission', remembered),
  };
}

/**
 * What the side-bar view's two mission-starting rows draw, their recipes read afresh, noted as what
 * a row's click runs.
 */
export function startingOffers(context: vscode.ExtensionContext): Record<MissionButton, StartingOffer> {
  drawnOffers = readStartingOffers(context);
  return drawnOffers;
}

/**
 * Runs the side-bar view's mission-starting row `button` on the variant it last drew: the goal,
 * and for Define mission then the scope, typed into input boxes, the run belonging to no mission.
 * A row drawn with no variant, or whose recipe cannot be read or run, tells why in an error
 * notification, and a box dismissed with Escape starts nothing.
 */
export async function runStartingRow(context: vscode.ExtensionContext, button: MissionButton): Promise<void> {
  const spec = MISSION_BUTTONS[button];
  const offer = drawnOffers?.[button];
  if (spec === undefined || offer === undefined) {
    return;
  }
  if (offer.state !== 'offered') {
    void vscode.window.showErrorMessage(offer.cause);
    return;
  }
  const variant = offer.variants[offer.selected];
  const typed = await askValues(spec.typed);
  if (typed === undefined) {
    return;
  }
  startChain(context, await startingRoot(), undefined, offer.recipe, variant.lines, typed);
}

/**
 * Offers the variants the mission-starting control `button` can run in a QuickPick, each by its
 * name with its harness, model, and effort beside it and the one selected marked, and remembers
 * the variant picked once per project, as the pane's dropdown does, without starting a run; every
 * listener and the pane are told. A control with no variant to offer tells why in an error
 * notification, and a QuickPick dismissed remembers nothing.
 */
export async function pickStartingVariant(context: vscode.ExtensionContext, button: MissionButton): Promise<void> {
  if (MISSION_BUTTONS[button] === undefined) {
    return;
  }
  const offer = readStartingOffers(context)[button];
  if (offer.state !== 'offered') {
    void vscode.window.showErrorMessage(offer.cause);
    return;
  }
  const items = offer.variants.map((variant, index) => ({
    label: variant.name,
    description: variantValues(variant.lines),
    detail: index === offer.selected ? 'Selected' : undefined,
    variant: variant.name,
  }));
  const picked = await vscode.window.showQuickPick(items, {
    title: offer.recipe,
    placeHolder: 'The variant to remember for this control; picking one starts no run',
  });
  if (picked === undefined) {
    return;
  }
  const stored = readProjectSelections(context.workspaceState.get(PROJECT_SELECTIONS_KEY));
  await context.workspaceState.update(PROJECT_SELECTIONS_KEY, { ...stored, [offer.recipe]: picked.variant });
  startingChanged();
  if (panel !== undefined) {
    await postPages(context, panel);
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

/**
 * The page shell `webview.html` is set to once, titled `title`: the stylesheet the pane and the
 * Settings window share and one page script, `script`, the pane's or the Settings window's. The
 * stylesheet centers the workflow diagram's row of blocks horizontally in the pane, as wide as the
 * row itself and never wrapping or scrolling sideways, and under the `vertical` class the page
 * script sets when that row would overflow the pane, it stacks the same blocks in a centered
 * column of equal width joined by the arrows turned downward, a block's name breaking onto a second
 * line only when the pane is narrower than the block itself; the dashed, solid, filled, and pulsing
 * block rules hold in both layouts. It lays a mission page's two pane headers, Open questions and
 * Remaining tasks, out as two columns of equal width that together fill the page's whole width,
 * the selected one underlined, with only the selected pane's content beneath them. It draws every
 * variant dropdown beside a button as its arrow alone, the selected name kept out of sight and
 * the opened list's options in the dropdown's colours, and the selected variant's name on its own
 * line beneath a button's name. Every push button, the `recipe`, `action`, and `control` classes
 * alike, takes one look in one shared rule: the theme's primary button colour, its hover colour,
 * and a 1px outline in the contrast border colour, else the foreground colour, so it stands out
 * against both the page and its own fill. The mission tabs, the two pane headers, and the
 * dependency links keep looks of their own. In the Settings window each variant
 * under Variants and Single-task lines, a deleted one included, is a card of its own: its list
 * indented under the recipe's or line's heading, a vertical line down the card's left edge, and a
 * gap between one card and the next.
 */
export function pageShell(webview: vscode.Webview, script: vscode.Uri, title: string): string {
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
<title>${title}</title>
<style nonce="${token}">
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 0 1em; }
  .tabs { display: flex; flex-wrap: wrap; align-items: center; gap: 0.25em; border-bottom: 1px solid var(--vscode-panel-border); padding: 0.5em 0; }
  .tab-list { display: flex; flex-wrap: wrap; gap: 0.25em; }
  .tabs .ends { margin-left: auto; display: flex; align-items: center; gap: 0.8em; }
  .tabs .starting { display: flex; gap: 0.4em; }
  .tab-list button { background: none; color: var(--vscode-foreground); border: 1px solid transparent; padding: 0.3em 0.8em; cursor: pointer; font: inherit; }
  .tab-list button[aria-selected="true"] { border-color: var(--vscode-focusBorder); background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
  .failure pre, .notice pre { white-space: pre-wrap; font-family: var(--vscode-editor-font-family); }
  .workflow { margin: 1em 0; }
  .workflow .flow { display: flex; flex-wrap: nowrap; align-items: center; gap: 0.4em; width: max-content; margin: 0 auto; }
  .workflow .block { border: 1px solid var(--vscode-descriptionForeground); border-radius: 4px; padding: 0.3em 0.8em; white-space: nowrap; }
  .workflow .block.optional { border-style: dashed; }
  .workflow .block.next { background: #9333ea; border-color: #9333ea; color: #ffffff; }
  .workflow .block.next.optional { border-color: #ffffff; }
  .workflow .block.next.running { animation: running-pulse 1.6s ease-in-out infinite; }
  @keyframes running-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
  .workflow .arrow { opacity: 0.7; }
  .workflow.vertical .flow { flex-direction: column; align-items: stretch; gap: 0.2em; max-width: 100%; }
  .workflow.vertical .block { white-space: normal; text-align: center; }
  .workflow.vertical .arrow { align-self: center; transform: rotate(90deg); }
  .notice { border-left: 3px solid var(--vscode-inputValidation-warningBorder); padding: 0.2em 0.8em; }
  .controls { display: flex; gap: 0.5em; margin-bottom: 0.5em; }
  button.recipe, button.action, button.control { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 1px solid var(--vscode-contrastBorder, var(--vscode-foreground)); padding: 0.3em 0.9em; cursor: pointer; font: inherit; }
  button.recipe:hover:not(:disabled), button.action:hover:not(:disabled), button.control:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }
  button.recipe:disabled, button.action:disabled, button.control:disabled { opacity: 0.5; cursor: default; }
  button.action { white-space: nowrap; }
  .settings { margin-top: 1em; }
  .settings h4 { margin: 0.8em 0 0.3em; }
  .harness-list { list-style: none; margin: 0 0 0.5em; padding: 0; }
  .harness-list li { display: flex; gap: 0.8em; padding: 0.2em 0; }
  .harness-list .harness-name { font-weight: 600; min-width: 8em; }
  .harness-list li.failed .harness-status { color: var(--vscode-errorForeground); }
  .harness-list .harness-enabled { margin-left: auto; display: flex; align-items: center; gap: 0.5em; white-space: nowrap; }
  .harness-lists h5 { margin: 0.5em 0 0.2em; font-size: 1em; }
  .value-list { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.5em; padding: 0.15em 0; }
  .value-list .value-label { min-width: 5em; opacity: 0.8; }
  .value-list ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.4em; }
  .value-list li.value { display: inline-flex; align-items: center; gap: 0.3em; border: 1px solid var(--vscode-panel-border); padding: 0 0 0 0.4em; }
  .value-list li.value-empty { opacity: 0.7; }
  .variant-recipe h5 { margin: 0.6em 0 0.2em; font-size: 1em; }
  .variant-recipe .variant-note { margin: 0 0 0.2em; opacity: 0.8; }
  .single-task-line .line-heading { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.6em; }
  .single-task-line .line-actions { margin-left: auto; display: flex; gap: 0.3em; font-weight: normal; }
  .variant-list { list-style: none; margin: 0 0 0 1em; padding: 0; display: flex; flex-direction: column; gap: 0.5em; }
  .variant-list li.variant { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.6em; }
  .variant-list li.variant-card { border-left: 2px solid var(--vscode-descriptionForeground); padding: 0.3em 0 0.3em 0.8em; }
  .variant-list .variant-origin { opacity: 0.8; }
  .variant-list .variant-default { font-weight: 600; }
  .variant-list li.deleted .variant-name { text-decoration: line-through; opacity: 0.7; }
  .variant-list .variant-actions { margin-left: auto; display: flex; gap: 0.3em; }
  .variant-lines { list-style: none; flex-basis: 100%; margin: 0.1em 0 0.3em; padding: 0 0 0 1em; }
  .variant-lines li.variant-line { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.4em; padding: 0.1em 0; }
  .variant-lines .line-text { flex: 1 1 20em; overflow-wrap: anywhere; font-family: var(--vscode-editor-font-family); }
  .variant-lines .line-label { flex: 1 1 20em; display: inline-flex; align-items: baseline; gap: 0.5em; overflow-wrap: anywhere; }
  .variant-lines .line-skill { font-family: var(--vscode-editor-font-family); }
  .variant-lines .line-interactive { opacity: 0.8; font-style: italic; }
  .variant-lines span.line-harness { opacity: 0.8; }
  .pager { display: flex; align-items: center; gap: 0.8em; margin-bottom: 0.5em; }
  .pager .counter { font-variant-numeric: tabular-nums; min-width: 4em; text-align: center; }
  .card { border: 1px solid var(--vscode-panel-border); padding: 0.6em 0.8em; }
  .card h4, .card h5, .card h6, .card p, .card ul { margin: 0; padding: 0; }
  .card ul { list-style: none; }
  .card h4, .card h5, .card h6 { font-size: 1em; }
  .card-head { display: flex; align-items: center; gap: 0.6em; flex-wrap: nowrap; min-height: 2em; }
  .card-head .short-title { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .card-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.3em; }
  .card .slot { margin: 0; padding: 0.5em 0 0; border-top: 1px solid var(--vscode-panel-border); margin-top: 0.5em; }
  .card .slot h5 { margin-bottom: 0.2em; }
  .card .question-text { box-sizing: border-box; height: 9em; overflow-y: auto; border-top: none; margin-top: 0; }
  .alternative { margin: 0.4em 0 0; padding: 0; }
  .alternative-head { display: flex; align-items: center; gap: 0.6em; }
  .alternative.picked h6 { color: var(--vscode-textLink-foreground); }
  .panes { margin-top: 1em; }
  .pane-tabs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; border-bottom: 1px solid var(--vscode-panel-border); }
  .pane-tabs button { min-width: 0; background: none; color: var(--vscode-foreground); border: none; border-bottom: 2px solid transparent; margin-bottom: -1px; padding: 0.4em 0.8em; cursor: pointer; font: inherit; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pane-tabs button:hover { background: var(--vscode-list-hoverBackground); }
  .pane-tabs button[aria-selected="true"] { border-bottom-color: var(--vscode-focusBorder); font-weight: 600; }
  .pane { padding-top: 0.6em; }
  .recipes h4 { margin: 0.8em 0 0.3em; }
  .recipe-list { display: flex; flex-wrap: wrap; gap: 0.4em; }
  .recipe-entry { display: inline-flex; align-items: stretch; gap: 0.2em; }
  select.recipe-variant { -webkit-appearance: none; appearance: none; box-sizing: border-box; width: 1.8em; min-width: 1.8em; padding: 0; cursor: pointer; font: inherit; color: transparent; border: 1px solid var(--vscode-dropdown-border); background-color: var(--vscode-dropdown-background); background-image: linear-gradient(45deg, transparent 50%, var(--vscode-dropdown-foreground) 50%), linear-gradient(135deg, var(--vscode-dropdown-foreground) 50%, transparent 50%); background-position: calc(50% - 0.2em) 55%, calc(50% + 0.2em) 55%; background-size: 0.4em 0.4em; background-repeat: no-repeat; }
  select.recipe-variant option { color: var(--vscode-dropdown-foreground); background: var(--vscode-dropdown-background); }
  button.recipe .recipe-variant-name, button.action .recipe-variant-name { display: block; font-size: 0.85em; opacity: 0.8; }
  .recipe-unknown { border: 1px dashed var(--vscode-inputValidation-warningBorder); padding: 0.3em 0.9em; opacity: 0.85; }
  .preview { border-top: 1px solid var(--vscode-panel-border); margin-top: 1em; }
  .preview-tasks { border-collapse: collapse; margin: 0.5em 0; width: 100%; }
  .preview-tasks th, .preview-tasks td { text-align: left; padding: 0.25em 0.8em 0.25em 0; vertical-align: top; }
  .preview-tasks tr.unresolved td:nth-child(2) { color: var(--vscode-errorForeground); }
  .preview-tasks select { background: var(--vscode-dropdown-background); color: var(--vscode-dropdown-foreground); border: 1px solid var(--vscode-dropdown-border); font: inherit; }
  button.link { background: none; border: none; padding: 0; color: var(--vscode-textLink-foreground); cursor: pointer; font: inherit; text-decoration: underline; }
</style>
</head>
<body>
<div id="root"></div>
<script nonce="${token}" src="${webview.asWebviewUri(script).toString()}"></script>
</body>
</html>`;
}
