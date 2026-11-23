// The mission pane: the one webview panel in the editor area the extension holds. Its
// `webview.html` is set once, to a page shell whose script, loaded from the output directory
// through `asWebviewUri` under a content security policy, posts a ready message on every load
// and draws what the extension answers. The extension answers every ready message with the live
// missions, read afresh, each carrying its documents as the in-process readers parse them and what
// its seven-block workflow diagram draws: the block filled, the step to run next, chosen from the
// mission's state, its documents' facts, and the number of `Requirements-review:` commits git
// holds for it, and the count of those beyond the first, which the additional review round
// carries once git holds two or more; the pane its page opens on beneath its two pane headers,
// Open questions and Remaining tasks, chosen from the same count: Remaining tasks when git holds
// at least one review commit for the mission and no question is open, and Open questions
// otherwise, a failed git read included; and the recipe list its page shows, out of the recipes
// read afresh from the shipped snippet file and the person's own recipe file: only those whose
// declared stage is the step its diagram fills, beside them the additional review round's when
// derive tasks is filled and follow up tasks' when finish is, and every undeclared recipe, or every
// recipe when no step is chosen, laid out within that by the page's other rules, the shipped
// recipes in the shipped file's order followed by its own group, and the leaving off of a recipe
// holding a placeholder the page cannot fill, each entry carrying the distinct harnesses, models,
// and efforts its variant's lines carry, which its button shows with its name; or with the one
// failure state the live read gives. The recipes are read with the per-user variant store laid over
// them. Each entry offers the recipe's variants for the dropdown beside its button, a person's own
// marked as theirs, and describes the one selected: the variant remembered for the recipe on that
// mission, a remembered selection always winning over the default, and otherwise the recipe's
// default. A selection the page posts is remembered per recipe name on one mission, keyed by the
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
// one selected, its lines and the distinct harnesses, models, and efforts they carry, which the
// button's label and hover text show: the variant remembered for the recipe, a remembered
// selection always winning over the default, where the default or the remembered one is left out
// the default when still offered and otherwise the first offered. The selection is remembered as
// the recipe list's is, per recipe on the mission for the buttons on a mission's page, and once
// per project, in `workspaceState` under a key of its own, for the two mission-starting buttons,
// and a remembered variant its recipe no longer carries is dropped at the next answer. A button
// whose every variant it could run is left out for a disabled harness is posted with none and
// drawn disabled, and one whose recipe cannot be read or run is left out, showing its name alone,
// its click telling why in an error notification. A click runs the variant selected only when the
// latest answer posted the button so, standing on that variant, and runs the lines it posted; they
// run
// through the same run path: on a question's card the discuss, answer, and answer-with-
// recommendation buttons, on an alternative on that card the answer-with-alternative button,
// and on the pane at the tab row's end, in its failure state too, the two mission-starting
// buttons, and on a mission's page, inside its Remaining tasks pane, the new-task button. The
// Short Title and the Alternative Id come from the card clicked, every typed value from
// VS Code's own input box, one line per value, and each value reaches its line only as its
// `GURITA_*` session variable. The discuss button always asks for an optional discussion note,
// the one value a box accepts empty: a note typed is carried after the Short Title as
// `<Short Title>. <note>`, an empty one leaves the line as if it held no note, and Escape starts
// nothing. While a chain started for a mission is running, from its start until its terminal
// closes, that mission's page draws every action button on it disabled, its recipe buttons, its
// question card's buttons, its preview's start button, and its New task button, and pulses its
// workflow diagram's filled block, while the tabs, the two pane headers, the refresh control, the
// other missions' pages, the two mission-starting buttons, and the settings control stay enabled.
// The settings control at the tab row's end swaps the page beneath the row for the settings view
// and back within the page itself, and the extension contributes no command for that view. The
// view shows the harness check: the page posts every opening of the view, and the first opening
// after the panel is created runs the packaged `harness_check.py` through `execFile` from the
// project root, its result posted to the page and kept for the panel's lifetime, every later
// opening posting the result kept without running the check again. Only the view's check-again
// control runs it afresh; no re-read of the pane and no Refresh runs it, and its result reaches
// the settings view alone, the mission pages drawn and their clicks run whatever it reports. The
// view also enables and disables each harness: every opening posts each harness's enabled state, read
// afresh from the harness part of the variant store file, and a click of a harness's enable or
// disable control writes that state there and posts it again with the pages, re-read. Every harness
// starts enabled and stays so until the person disables it, the check never changing it. A variant
// with at least one line on a disabled harness is left out of the list the pane posts, so out of
// its recipe's dropdown and refused on a click as any variant the list lacks is, a recipe whose
// every variant is left out loses its button, and where the remembered variant or the default is
// left out the button stands on the default when it is still listed and otherwise on the first
// listed variant, the remembered selection kept for when the harness is enabled again. The
// fixed-name buttons' dropdowns leave such a variant out in the same way, and the looped run's
// preview, overrides, and lines keep every named single-task line. The view holds each harness's
// model list and its one effort list for the whole harness, Codex a model list alone: every
// opening posts them, derived afresh from the `--model` and `--effort` values, on a Codex line
// `-m`, the lines of the shipped recipes, the own recipes, and the stored variants carry, with the
// person's overlay from the harness part of the variant store file laid over them. A click of a
// list's add control asks for the entry in VS Code's own input box, whose validation refuses an
// empty entry and one the list already offers, and a click of an entry's remove control takes it
// out of the offer; either is written to the overlay and the lists posted again. The view also
// edits variants: every opening posts every recipe but the named single-task lines, the chains,
// the seven fixed-name button recipes, and the recipes and variants of the own recipe file alike,
// each with its variants as the variant store lays them over the two Markdown files, its default
// marked, and the variants a hiding record hides. A click of a variant's duplicate, rename,
// delete, or default control, or of a reset control where a stored copy or a hiding record
// stands, is carried out through the variant store's edits (`variantEdits.ts`); a duplicate's name
// and a rename are asked for in VS Code's own input box, one box per value as `askValues` asks, a
// rename's box opening on the current name, and the box's validation refusing an empty name and
// one the recipe's other variants carry. Each variant is posted with its lines and the line editor
// each gets: a `claude` or `agy` line carrying both `--model` and `--effort` gets model and effort
// dropdowns, a Codex line carrying `-m` its model dropdown alone, and every other line is shown as
// its text, read-only. A pick in a line's dropdown, of a value the harness's model list or its
// whole effort list offers, whatever the line's model, replaces the value the line carries, never
// inserting text into it, through the store's edit (`replaceLineValue`), a shipped or own variant
// getting a stored copy holding the changed line in its place; a pick of a value the list does not
// offer, of the value the line already carries, or on a line or variant the list read afresh does
// not hold with that control writes nothing. The view also edits the named single-task lines:
// every opening posts them, shipped and own alike, each with its one line and line editor, and the
// shipped and own lines a hiding record hides; a click of a line's duplicate, rename, delete, or
// reset control is carried out through the store's line edits, a new name asked for in VS Code's
// own input box, whose validation refuses an empty name and one any recipe or line carries, and a
// pick in its dropdowns as a variant's line pick is. A stored line reaches the merged recipe list
// under its name, so the looped run's lines, the rule file, and the override list see it as any
// named line. Every edit posts the variant and line lists and the harness lists
// again, and the pages with their recipes re-read, or the failure state again while it stands, so
// the mission pages' dropdowns and the fixed-name buttons' dropdowns and labels show it at once.
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
// Beyond its own runs and its opening, the pane is kept current by a file system watcher over the
// mission documents under the project root, created with the first live read that succeeds and
// disposed with the panel, debounced so that a burst of writes causes one re-read. A change to a
// mission's question document or task list re-reads that mission's documents in process against
// the live list last read, choosing its next step, and with it the recipes its page lists, and its
// default pane and counting its review commits afresh, and creating or deleting a `requirements.md`, or changing a `TASKS_TODO.md`, also re-runs
// `missions.py live`. While the panel is hidden an event only marks the page stale, and a stale
// page is re-read when the panel is shown. The refresh control on the page and the refresh command
// each re-read everything, as a fallback. Git state is not watched.
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
  PROJECT_SELECTIONS_KEY,
  ProjectSelections,
  SELECTIONS_KEY,
  Selections,
  dropStaleProjectSelections,
  dropStaleSelections,
  missionSelections,
  readProjectSelections,
  readSelections,
  rememberSelection,
} from './selections';
import { ReadVariantRef, readVariantStore, variantStoreFile } from './variantStore';
import {
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
  replaceLineValue,
  resetLine,
  resetVariant,
  settingsLines,
  settingsRecipes,
} from './variantEdits';
import {
  HarnessKey,
  HarnessLists,
  HarnessStates,
  ListKind,
  disabledCommands,
  editHarnessList,
  holdsList,
  isHarnessKey,
  isListKind,
  readHarnessLists,
  readHarnessStates,
  setHarnessEnabled,
} from './harnessSettings';
import { Harness, VariantValues, variantValues } from './lineValues';
import { FileEventKind, RefreshBatch, RefreshQueue, WATCHED_PATTERN, eventEffect } from './refresh';
import { OPTIONAL_PLACEHOLDERS } from './placeholders';
import { CHECK_SCRIPT, CheckResult, HARNESSES, PLUGIN_VERSION_FILE, readPackagedVersion, runHarnessCheck } from './harnessCheck';
import { refuseWhileRunning, runnerFile, runningMissions, showRun, startChain, startLoop } from './runs';
import { MissionWorkflow, WorkflowStep, missionWorkflow, reviewCount } from './workflow';

const VIEW_TYPE = 'gurita.missionPane';
const PANEL_TITLE = 'Gurita Missions';

/** The placeholders a mission page holds a value for: the mission's own path. */
const PAGE_PLACEHOLDERS = ['path'];

/** A button on a question's card. */
type QuestionButton = 'discussQuestion' | 'answerQuestion' | 'answerWithRecommendation';

/** A mission-starting button at the tab row's end. */
type MissionButton = 'discussGoal' | 'defineMission';

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
  | { type: 'previewLoop'; mission: string; recipe: string; variant: string }
  | { type: 'startLoop'; mission: string; recipe: string; overrides: Record<string, string> }
  | { type: 'settingsOpened' }
  | { type: 'checkHarnesses' }
  | { type: 'setHarnessEnabled'; harness: string; enabled: boolean }
  | { type: 'addHarnessValue'; harness: string; kind: string }
  | { type: 'removeHarnessValue'; harness: string; kind: string; value: string }
  | { type: 'duplicateVariant'; recipe: string; variant: VariantTarget }
  | { type: 'renameVariant'; recipe: string; variant: VariantTarget }
  | { type: 'deleteVariant'; recipe: string; variant: VariantTarget }
  | { type: 'pickDefault'; recipe: string; variant: VariantTarget }
  | { type: 'resetVariant'; recipe: string; original: ReadVariantRef }
  | { type: 'replaceLineValue'; recipe: string; variant: VariantTarget; line: number; kind: string; value: string }
  | { type: 'duplicateLine'; line: string; variant: VariantTarget }
  | { type: 'renameLine'; line: string; variant: VariantTarget }
  | { type: 'deleteLine'; line: string; variant: VariantTarget }
  | { type: 'resetLine'; line: string; original: ReadVariantRef };

/** The harness check as the settings view shows it: running, or what it gave. */
type HarnessCheck = { state: 'running' } | CheckResult;

/**
 * The merged recipe list as read from the two recipe files, with the commands of the harnesses the
 * settings view disabled, or the cause they could not be read.
 */
type RecipeRead = { state: 'read'; recipes: Recipe[]; disabled: Harness[] } | { state: 'failed'; cause: string };

/** Each harness's enabled state as the variant store file holds it, or the cause it could not be read. */
type HarnessSettings = { state: 'read'; enabled: HarnessStates } | { state: 'failed'; cause: string };

/** Each harness's model and effort lists, the overlay laid over them, or the cause they could not be read. */
type HarnessListsRead = { state: 'read'; lists: HarnessLists } | { state: 'failed'; cause: string };

/** The recipes and variants the settings view lists for editing, or the cause they could not be read. */
type VariantsRead = { state: 'read'; recipes: SettingsRecipe[] } | { state: 'failed'; cause: string };

/** The named single-task lines the settings view lists for editing, or the cause they could not be read. */
type LinesRead = ({ state: 'read' } & SettingsLines) | { state: 'failed'; cause: string };

/** The recipe list one mission's page shows, or the cause the recipes could not be read. */
type RecipePart = { state: 'read'; recipes: PageRecipe[] } | { state: 'failed'; cause: string };

/** One of the seven buttons outside the recipe list, each running the recipe of its fixed name. */
type FixedButton = keyof typeof BUTTON_RECIPES;

/** A fixed-name button on a mission's page, its dropdown's selection remembered per recipe on that mission. */
type PageButton = Exclude<FixedButton, MissionButton>;

/** The fixed-name buttons on a mission's page, posted with each mission. */
const PAGE_BUTTONS: readonly PageButton[] = ['discussQuestion', 'answerQuestion', 'answerWithRecommendation', 'answerWithAlternative', 'discussTask'];

/** The two mission-starting buttons, belonging to no mission, their dropdowns' selections remembered once per project. */
const STARTING_BUTTONS: readonly MissionButton[] = ['discussGoal', 'defineMission'];

/**
 * What a fixed-name button runs, as its dropdown, label, and hover text show it: the variants it
 * offers and the one selected, with that variant's lines and their values; or no variant at all,
 * every one it could run having a line on a disabled harness, the button drawn disabled.
 */
type FixedButtonEntry =
  | {
      state: 'offered';
      /** The selected variant's lines as written, placeholders included. */
      lines: string[];
      /** The harnesses, models, and efforts its lines carry, which the button shows with its name. */
      values: VariantValues;
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
        MissionWorkflow & { recipes: RecipePart; buttons: FixedButtons })[];
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
  | { type: 'loopStarted'; mission: string }
  | { type: 'harnessCheck'; check: HarnessCheck }
  | { type: 'harnessSettings'; settings: HarnessSettings }
  | { type: 'harnessLists'; lists: HarnessListsRead }
  | { type: 'variants'; variants: VariantsRead }
  | { type: 'singleTaskLines'; lines: LinesRead };

/** What a mission's latest preview ran with, which starting its run passes on unchanged. */
interface HeldPreview {
  root: string;
  recipe: string;
  recipeLines: string[];
  lines: SingleTaskLine[];
}

/**
 * What the latest answer posted: the project root, the live missions' paths, the recipes each
 * mission's page listed, the fixed-name buttons each mission's page drew, and the Short Titles
 * each mission's question view showed, each with its alternatives' ids.
 */
interface Posted {
  root: string;
  missions: Set<string>;
  recipes: Map<string, PageRecipe[]>;
  buttons: Map<string, ButtonPosts>;
  questions: Map<string, Map<string, Set<string>>>;
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

/** The debounce gathering the watcher's events into one re-read, while the extension holds a panel. */
let queue: RefreshQueue | undefined;

/** Whether an event or a refresh came while the panel was hidden, so it is re-read when shown. */
let stale = false;

/** The number of full re-reads started, so only the latest one started posts its answer. */
let reads = 0;

/** Each mission's latest preview, by the mission's path. */
const previews = new Map<string, HeldPreview>();

/** The harness check kept for the panel's lifetime: undefined until the settings view is first opened. */
let harnessCheck: HarnessCheck | undefined;

/** The number of harness checks started, so only the latest one started keeps its result. */
let checks = 0;

/**
 * Re-reads the pane, when the extension holds one, and posts the fresh parse to its page: the live
 * missions, every mission's documents, and the recipes. A hidden panel is only marked stale, and
 * is re-read when shown.
 */
export function refreshMissionPane(context: vscode.ExtensionContext): void {
  if (panel === undefined) {
    return;
  }
  if (!panel.visible) {
    stale = true;
    return;
  }
  void answer(context, panel);
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
  queue = new RefreshQueue((batch) => void flushEvents(context, created, batch));
  created.webview.html = pageShell(created.webview, vscode.Uri.joinPath(scripts, 'page.js'));
  created.webview.onDidReceiveMessage(
    (message: PageMessage) => {
      if (message?.type === 'ready' || message?.type === 'refresh') {
        void answer(context, created);
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
      } else if (message?.type === 'previewLoop') {
        void previewLoop(context, created, message.mission, message.recipe, message.variant);
      } else if (message?.type === 'startLoop') {
        runLoop(context, created, message.mission, message.recipe, message.overrides);
      } else if (message?.type === 'settingsOpened') {
        settingsOpened(context, created);
      } else if (message?.type === 'checkHarnesses') {
        void checkHarnesses(context, created);
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
        message?.type === 'pickDefault'
      ) {
        void editVariant(context, created, message.type, message.recipe, message.variant);
      } else if (message?.type === 'resetVariant') {
        void resetStoredVariant(context, created, message.recipe, message.original);
      } else if (message?.type === 'replaceLineValue') {
        void editLineValue(context, created, message.recipe, message.variant, message.line, message.kind, message.value);
      } else if (message?.type === 'duplicateLine' || message?.type === 'renameLine' || message?.type === 'deleteLine') {
        void editLine(context, created, message.type, message.line, message.variant);
      } else if (message?.type === 'resetLine') {
        void resetStoredLine(context, created, message.line, message.original);
      }
    },
    undefined,
    context.subscriptions,
  );
  created.onDidChangeViewState(
    (event) => {
      if (panel === created && event.webviewPanel.visible && stale) {
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
        posted = undefined;
        current = undefined;
        failure = undefined;
        startingPosts = undefined;
        stale = false;
        previews.clear();
        harnessCheck = undefined;
        queue?.dispose();
        queue = undefined;
        unwatch();
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
 * Acts on one debounced burst of the watcher's events: a hidden panel is only marked stale; a
 * burst that moves the live list re-reads everything; any other re-reads in process the documents
 * of each live mission it touched, chooses what its diagram draws, and with it the recipes its page
 * lists, and its default pane afresh, and posts the fresh parse.
 */
async function flushEvents(context: vscode.ExtensionContext, target: vscode.WebviewPanel, batch: RefreshBatch): Promise<void> {
  if (panel !== target) {
    return;
  }
  if (!target.visible) {
    stale = true;
    return;
  }
  if (batch.live || current === undefined) {
    void answer(context, target);
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
  if (sequence !== reads || current !== shown || panel !== target) {
    return;
  }
  read.forEach(({ mission, documents }, index) => {
    shown.documents.set(mission.path, documents);
    shown.workflows.set(mission.path, workflows[index]);
  });
  await post(target, publish(context, shown));
}

/**
 * Reads the shipped snippet file and the person's own recipe file into the merged recipe list, the
 * per-user variant store laid over it.
 */
function readAllRecipes(context: vscode.ExtensionContext): Recipe[] {
  const files = recipeFiles(context);
  return readRecipes(files.shipped, files.own, files.store);
}

/** The shipped snippet file, the person's own recipe file, and the per-user variant store file. */
function recipeFiles(context: vscode.ExtensionContext): { shipped: string; own: string; store: string } {
  const setting = vscode.workspace.getConfiguration('gurita').get<string>('ownRecipesFile');
  const home = os.homedir();
  return { shipped: context.asAbsolutePath('bundled/GURITA_USAGE.md'), own: ownRecipesFile(setting, home), store: variantStoreFile(home) };
}

/** The commands of the harnesses the settings view disabled, read afresh from the variant store file. */
function readDisabled(): Harness[] {
  return disabledCommands(readHarnessStates(variantStoreFile(os.homedir())));
}

/**
 * Reads the shipped snippet file and the person's own recipe file into the merged list, with the
 * harnesses the settings view disabled, or the cause they could not be read.
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
 * `read`: the recipes `stageRecipes` keeps for that step, every recipe when `step` is undefined,
 * as `pageRecipes` lists them for a page holding its mission's path, each recipe's dropdown on the
 * variant `remembered` names for it, every variant with a line on a disabled harness left out. A
 * failed read is posted to the page as it stands.
 */
function missionRecipes(read: RecipeRead, step: WorkflowStep | undefined, remembered: ReadonlyMap<string, string>): RecipePart {
  if (read.state === 'failed') {
    return read;
  }
  return { state: 'read', recipes: pageRecipes(stageRecipes(read.recipes, step), PAGE_PLACEHOLDERS, remembered, read.disabled) };
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
 * Re-reads everything the pane draws, the live missions, every mission's documents, and the
 * recipes, and posts the fresh parse to the page, or the failure state the live read gives. Only
 * the latest re-read started posts its answer.
 */
async function answer(context: vscode.ExtensionContext, target: vscode.WebviewPanel): Promise<void> {
  const sequence = ++reads;
  stale = false;
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const read: LiveRead = await readLive(folder, context.asAbsolutePath('bundled/missions.py'));
  if (sequence !== reads || panel !== target) {
    return;
  }
  let message: PaneMessage;
  if (read.state === 'read') {
    const documents = new Map(read.missions.map((mission) => [mission.path, readMissionDocuments(read.root, mission.path)]));
    const workflows = await Promise.all(
      read.missions.map((mission) => readWorkflow(read.root, mission, documents.get(mission.path) as MissionDocuments)),
    );
    if (sequence !== reads || panel !== target) {
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
    message = publish(context, current);
  } else {
    posted = undefined;
    current = undefined;
    failure = read.cause;
    message = failureMessage(context, read.cause);
  }
  await post(target, message);
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
 * Posts the pages again after an edit in the settings view, their recipes re-read, so the recipe
 * list's dropdowns and the fixed-name buttons' labels show it at once: the mission pages when the
 * latest answer drew them, and the failure state, its buttons re-read, when it drew that.
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
 * What each of the fixed-name buttons `keys` runs, out of the merged list `read`, as `buttonRecipe`
 * offers it, the variant name `remembered` holds for each recipe the dropdown selection remembered
 * for it: the variants its dropdown offers, every variant with a line on a disabled harness left
 * out, and the one selected, with its lines and the distinct harnesses, models, and efforts they
 * carry; or no variant, every one it could run left out, the button drawn disabled. A button whose
 * recipe cannot be read or run is left out of the entries and shows its name alone. Beside the
 * entries posted, what each button's click and dropdown are checked against, a refused one with
 * its cause.
 */
function fixedButtons(
  read: RecipeRead,
  keys: readonly FixedButton[],
  remembered: ReadonlyMap<string, string>,
): { entries: FixedButtons; posts: ButtonPosts } {
  const entries: FixedButtons = {};
  const posts: ButtonPosts = {};
  for (const key of keys) {
    const name = BUTTON_RECIPES[key];
    if (read.state === 'failed') {
      posts[key] = { state: 'refused', cause: `The recipes could not be read: ${read.cause}` };
      continue;
    }
    const found = buttonRecipe(read.recipes, name, BUTTON_PLACEHOLDERS[key], remembered.get(name), read.disabled);
    if (found.state === 'found') {
      const lines = [...found.variant.lines];
      entries[key] = {
        state: 'offered',
        lines,
        values: variantValues(lines),
        variants: found.variants.map((variant) => ({ name: variant.name, own: variant.own })),
        selected: found.selected,
      };
      posts[key] = { state: 'offered', recipe: found.recipe.name, lines, variants: found.variants.map((variant) => variant.name), selected: found.selected };
    } else if (found.state === 'disabled') {
      entries[key] = { state: 'disabled', cause: found.cause };
      posts[key] = { state: 'disabled' };
    } else {
      posts[key] = { state: 'refused', cause: found.cause };
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
  const starting = fixedButtons(shown.recipes, STARTING_BUTTONS, new Map(Object.entries(projectSelections(context, shown.recipes))));
  startingPosts = starting.posts;
  const buttons = new Map<string, ButtonPosts>();
  const missions = shown.live.map((mission) => {
    const workflow = shown.workflows.get(mission.path) as MissionWorkflow;
    const remembered = missionSelections(selections, mission.path);
    const fixed = fixedButtons(shown.recipes, PAGE_BUTTONS, remembered);
    buttons.set(mission.path, fixed.posts);
    return {
      ...mission,
      ...(shown.documents.get(mission.path) as MissionDocuments),
      ...workflow,
      recipes: missionRecipes(shown.recipes, workflow.step, remembered),
      buttons: fixed.entries,
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

/** Each harness's enabled state, read afresh from the variant store file, or the cause it could not be read. */
function readHarnessSettings(): HarnessSettings {
  try {
    return { state: 'read', enabled: readHarnessStates(variantStoreFile(os.homedir())) };
  } catch (error) {
    return { state: 'failed', cause: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Answers an opening of the settings view: each harness's enabled state and its model and effort
 * lists are posted, read afresh;
 * the first opening after the panel is created runs the harness check, and every later one posts
 * the check kept, running or done, without running it.
 */
function settingsOpened(context: vscode.ExtensionContext, target: vscode.WebviewPanel): void {
  void post(target, { type: 'harnessSettings', settings: readHarnessSettings() });
  void post(target, { type: 'harnessLists', lists: readListsOf(context) });
  void post(target, { type: 'variants', variants: readVariantList(context) });
  void post(target, { type: 'singleTaskLines', lines: readLineList(context) });
  if (harnessCheck === undefined) {
    void checkHarnesses(context, target);
    return;
  }
  void post(target, { type: 'harnessCheck', check: harnessCheck });
}

/**
 * Runs the harness check afresh, unless one is running: the packaged `harness_check.py` run from
 * the project root, else the home directory when no folder is open, its installed versions
 * compared with the packaged plugin version. The page is told it runs, and then what it gave,
 * which is kept for the panel's lifetime.
 */
async function checkHarnesses(context: vscode.ExtensionContext, target: vscode.WebviewPanel): Promise<void> {
  if (panel !== target || harnessCheck?.state === 'running') {
    return;
  }
  const sequence = ++checks;
  harnessCheck = { state: 'running' };
  await post(target, { type: 'harnessCheck', check: harnessCheck });
  const root = (await startingRoot()) ?? os.homedir();
  const packaged = readPackagedVersion(context.asAbsolutePath(PLUGIN_VERSION_FILE));
  const result = await runHarnessCheck(context.asAbsolutePath(CHECK_SCRIPT), root, packaged);
  if (panel !== target || sequence !== checks) {
    return;
  }
  harnessCheck = result;
  await post(target, { type: 'harnessCheck', check: result });
}

/**
 * Enables or disables the harness `harness` in the harness part of the variant store file, read
 * afresh and written whole, then posts each harness's state and the pages again, their recipes
 * re-read, so a variant on a disabled harness leaves its dropdown at once. A key naming no harness
 * or a state that is not true or false writes nothing; a store that cannot be read or written is
 * told in an error notification, nothing written.
 */
async function enableHarness(context: vscode.ExtensionContext, target: vscode.WebviewPanel, harness: unknown, enabled: unknown): Promise<void> {
  if (panel !== target || !isHarnessKey(harness) || typeof enabled !== 'boolean') {
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
  await postPages(context, target);
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

/** The name the settings view gives the harness `key`. */
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
  if (panel !== target || !isHarnessKey(harness) || !isListKind(kind) || !holdsList(harness, kind)) {
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
  if (typed === undefined || typed.trim() === '' || offered.includes(typed.trim()) || panel !== target) {
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
  if (panel !== target || !isHarnessKey(harness) || !isListKind(kind) || !holdsList(harness, kind) || typeof value !== 'string') {
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
 * The recipes and variants the settings view lists, read afresh: the shipped snippet file and the
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
 * The named single-task lines the settings view lists, read afresh: the shipped snippet file and
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
const EDIT_VERBS: Record<'duplicateVariant' | 'renameVariant' | 'deleteVariant' | 'pickDefault' | 'resetVariant', string> = {
  duplicateVariant: 'duplicated',
  renameVariant: 'renamed',
  deleteVariant: 'deleted',
  pickDefault: 'picked as the default',
  resetVariant: 'reset',
};

/**
 * Makes one edit of the settings view on the variant `variant` of the recipe `recipe`, as the
 * variant list read afresh lists it, through the variant store's edits: a duplicate under a name
 * and a rename to one, each asked for in VS Code's own input box, a rename's box opening on the
 * current name, a delete, or the pick of the variant as its recipe's default. A recipe or variant
 * the list does not hold, or a dismissed box, writes nothing; an edit the store refuses, or a store
 * that cannot be read or written, is told in an error notification. Every edit made posts the
 * variant list, the harness lists, and the pages again, their recipes re-read.
 */
async function editVariant(
  context: vscode.ExtensionContext,
  target: vscode.WebviewPanel,
  edit: 'duplicateVariant' | 'renameVariant' | 'deleteVariant' | 'pickDefault',
  recipe: unknown,
  variant: unknown,
): Promise<void> {
  const named = variantTargetOf(variant);
  if (panel !== target || typeof recipe !== 'string' || named === undefined) {
    return;
  }
  const read = readVariantList(context);
  if (read.state === 'failed') {
    void vscode.window.showErrorMessage(`The variants could not be read: ${read.cause}`);
    return;
  }
  const listed = read.recipes.find((each) => each.name === recipe);
  const index = listed?.variants.findIndex((each) => isTarget(each, named)) ?? -1;
  if (listed === undefined || index < 0) {
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
  if (panel !== target) {
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

/**
 * Resets the shipped or own variant `original` of the recipe `recipe`, removing the stored copy and
 * the hiding record standing for it, so it shows again as its file holds it, then posts the variant
 * list, the harness lists, and the pages again. A variant the list read afresh offers no reset for
 * writes nothing; a store that cannot be read or written is told in an error notification.
 */
async function resetStoredVariant(context: vscode.ExtensionContext, target: vscode.WebviewPanel, recipe: unknown, original: unknown): Promise<void> {
  const ref = readVariantRefOf(original);
  if (panel !== target || typeof recipe !== 'string' || ref === undefined) {
    return;
  }
  const read = readVariantList(context);
  if (read.state === 'failed') {
    void vscode.window.showErrorMessage(`The variants could not be read: ${read.cause}`);
    return;
  }
  const listed = read.recipes.find((each) => each.name === recipe);
  const offered = [...(listed?.variants.flatMap((each) => (each.copies === undefined ? [] : [each.copies])) ?? []), ...(listed?.hidden ?? [])];
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
 * carries with `value`, picked in the line's dropdown in the settings view, through the store's
 * edit, a shipped or own variant getting a stored copy holding the changed line in its place, then
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
    panel !== target ||
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
  const lines = readLineList(context);
  const editor =
    read.recipes.find((each) => each.name === recipe)?.variants.find((each) => isTarget(each, named))?.editors[line] ??
    (lines.state === 'read' && line === 0
      ? lines.lines.find((each) => each.name === recipe && isTarget(each.variant, named))?.editor
      : undefined);
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
  if (!offered.includes(value) || panel !== target) {
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
 * Makes one edit of the settings view on the named single-task line `variant` of the line named
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
  if (panel !== target || typeof line !== 'string' || named === undefined) {
    return;
  }
  const read = readLineList(context);
  if (read.state === 'failed') {
    void vscode.window.showErrorMessage(`The single-task lines could not be read: ${read.cause}`);
    return;
  }
  if (!read.lines.some((each) => each.name === line && isTarget(each.variant, named))) {
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
  if (panel !== target) {
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
  if (panel !== target || typeof line !== 'string' || ref === undefined || ref.recipe !== undefined) {
    return;
  }
  const read = readLineList(context);
  if (read.state === 'failed') {
    void vscode.window.showErrorMessage(`The single-task lines could not be read: ${read.cause}`);
    return;
  }
  const offered = [
    ...read.lines.flatMap((each) => (each.reset === undefined ? [] : [{ name: each.reset.recipe, original: each.reset.original }])),
    ...read.hidden,
  ];
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
  if (panel !== target) {
    return;
  }
  await post(target, { type: 'variants', variants: readVariantList(context) });
  await post(target, { type: 'singleTaskLines', lines: readLineList(context) });
  await post(target, { type: 'harnessLists', lists: readListsOf(context) });
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
  const post = posts?.[button];
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
 * lines those of the variant named `variant` the latest answer posted the card's dropdown standing on.
 */
function runAlternativeButton(context: vscode.ExtensionContext, mission: string, question: string, alternative: string, variant: unknown): void {
  if (posted === undefined || !posted.missions.has(mission) || !shown(mission, question, alternative)) {
    return;
  }
  if (refuseWhileRunning(mission)) {
    return;
  }
  const recipe = postedButton(posted.buttons.get(mission), 'answerWithAlternative', variant);
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
async function startingRoot(): Promise<string | undefined> {
  if (posted !== undefined) {
    return posted.root;
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

function nonce(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';
  for (let index = 0; index < 32; index += 1) {
    value += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return value;
}

/**
 * The page shell `webview.html` is set to once: the pane's stylesheet and the page script. The
 * stylesheet centers the workflow diagram's row of blocks horizontally in the pane, as wide as the
 * row itself and never wrapping or scrolling sideways, and under the `vertical` class the page
 * script sets when that row would overflow the pane, it stacks the same blocks in a centered
 * column of equal width joined by the arrows turned downward, a block's name breaking onto a second
 * line only when the pane is narrower than the block itself; the dashed, solid, filled, and pulsing
 * block rules hold in both layouts. It lays a mission page's two pane headers, Open questions and
 * Remaining tasks, out as two columns of equal width that together fill the page's whole width,
 * the selected one underlined, with only the selected pane's content beneath them.
 */
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
  button.control { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; padding: 0.25em 0.8em; cursor: pointer; font: inherit; }
  button.control:disabled { opacity: 0.5; cursor: default; }
  .tabs button.control[aria-pressed="true"] { outline: 1px solid var(--vscode-focusBorder); }
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
  .variant-list { list-style: none; margin: 0; padding: 0; }
  .variant-list li.variant { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.6em; padding: 0.15em 0; }
  .variant-list .variant-origin { opacity: 0.8; }
  .variant-list .variant-default { font-weight: 600; }
  .variant-list li.deleted .variant-name { text-decoration: line-through; opacity: 0.7; }
  .variant-list .variant-actions { margin-left: auto; display: flex; gap: 0.3em; }
  .variant-lines { list-style: none; flex-basis: 100%; margin: 0.1em 0 0.3em; padding: 0 0 0 1em; }
  .variant-lines li.variant-line { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.4em; padding: 0.1em 0; }
  .variant-lines .line-text { flex: 1 1 20em; overflow-wrap: anywhere; font-family: var(--vscode-editor-font-family); }
  button.action { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; padding: 0.15em 0.6em; cursor: pointer; font: inherit; white-space: nowrap; }
  button.action:hover:not(:disabled) { background: var(--vscode-button-secondaryHoverBackground); }
  button.action:disabled, button.recipe:disabled { opacity: 0.5; cursor: default; }
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
  .alternatives-head { display: flex; align-items: center; gap: 0.6em; }
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
  select.recipe-variant { background: var(--vscode-dropdown-background); color: var(--vscode-dropdown-foreground); border: 1px solid var(--vscode-dropdown-border); font: inherit; max-width: 14em; }
  button.recipe { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 0.3em 0.9em; cursor: pointer; font: inherit; }
  button.recipe:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }
  button.recipe .recipe-values, button.action .recipe-values { display: block; font-size: 0.85em; opacity: 0.8; }
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
