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
// buttons outside the chains, untouched by the step, each run the default variant of the recipe of its fixed name, its shipped variants and those an own recipe of the same name adds, the variant store laid over them, read afresh at the click,
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
// other missions' pages, and the two mission-starting buttons stay enabled. The extension posts the
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
import { BUTTON_RECIPES, PageRecipe, Recipe, buttonRecipe, ownRecipesFile, pageRecipes, readRecipes, selectedChoice, stageRecipes } from './recipes';
import { SELECTIONS_KEY, Selections, dropStaleSelections, missionSelections, readSelections, rememberSelection } from './selections';
import { variantStoreFile } from './variantStore';
import { FileEventKind, RefreshBatch, RefreshQueue, WATCHED_PATTERN, eventEffect } from './refresh';
import { OPTIONAL_PLACEHOLDERS } from './placeholders';
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
  | { type: 'questionButton'; button: QuestionButton; mission: string; question: string }
  | { type: 'alternativeButton'; mission: string; question: string; alternative: string }
  | { type: 'missionButton'; button: MissionButton }
  | { type: 'taskButton'; mission: string }
  | { type: 'previewLoop'; mission: string; recipe: string; variant: string }
  | { type: 'startLoop'; mission: string; recipe: string; overrides: Record<string, string> };

/** The merged recipe list as read from the two recipe files, or the cause it could not be read. */
type RecipeRead = { state: 'read'; recipes: Recipe[] } | { state: 'failed'; cause: string };

/** The recipe list one mission's page shows, or the cause the recipes could not be read. */
type RecipePart = { state: 'read'; recipes: PageRecipe[] } | { state: 'failed'; cause: string };

/** A message the extension posts to the page. */
type PaneMessage =
  | {
      type: 'live';
      /**
       * Each live mission with its documents, the step its diagram fills, left out when none is
       * chosen, the count its additional review round carries, left out while there is none, the
       * pane its page opens on, and the recipe list its page shows, the recipes that fit that step.
       */
      missions: ({ path: string; state: string; title: string } & MissionDocuments & MissionWorkflow & { recipes: RecipePart })[];
      /** The paths of the missions with a running runner, whose pages are drawn as running. */
      running: string[];
    }
  | { type: 'liveFailure'; cause: string }
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
 * mission's page listed, and the Short Titles each mission's question view showed, each with its
 * alternatives' ids.
 */
interface Posted {
  root: string;
  missions: Set<string>;
  recipes: Map<string, PageRecipe[]>;
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
        void runQuestionButton(context, message.button, message.mission, message.question);
      } else if (message?.type === 'alternativeButton') {
        runAlternativeButton(context, message.mission, message.question, message.alternative);
      } else if (message?.type === 'missionButton') {
        void runMissionButton(context, message.button);
      } else if (message?.type === 'taskButton') {
        void runTaskButton(context, message.mission);
      } else if (message?.type === 'previewLoop') {
        void previewLoop(context, created, message.mission, message.recipe, message.variant);
      } else if (message?.type === 'startLoop') {
        runLoop(context, created, message.mission, message.recipe, message.overrides);
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
        stale = false;
        previews.clear();
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
  const setting = vscode.workspace.getConfiguration('gurita').get<string>('ownRecipesFile');
  const home = os.homedir();
  return readRecipes(context.asAbsolutePath('bundled/GURITA_USAGE.md'), ownRecipesFile(setting, home), variantStoreFile(home));
}

/** Reads the shipped snippet file and the person's own recipe file into the merged list, or the cause they could not be read. */
function readRecipeList(context: vscode.ExtensionContext): RecipeRead {
  try {
    return { state: 'read', recipes: readAllRecipes(context) };
  } catch (error) {
    return { state: 'failed', cause: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * The recipe list the page of a mission whose diagram fills `step` shows, out of the merged list
 * `read`: the recipes `stageRecipes` keeps for that step, every recipe when `step` is undefined,
 * as `pageRecipes` lists them for a page holding its mission's path, each recipe's dropdown on the
 * variant `remembered` names for it. A failed read is posted to the page as it stands.
 */
function missionRecipes(read: RecipeRead, step: WorkflowStep | undefined, remembered: ReadonlyMap<string, string>): RecipePart {
  if (read.state === 'failed') {
    return read;
  }
  return { state: 'read', recipes: pageRecipes(stageRecipes(read.recipes, step), PAGE_PLACEHOLDERS, remembered) };
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
    message = publish(context, current);
  } else {
    posted = undefined;
    current = undefined;
    message = { type: 'liveFailure', cause: read.cause };
  }
  await post(target, message);
}

/**
 * The page's message for what `shown` holds, each mission carrying the recipe list its page shows
 * for the step its diagram fills, noting what it lists as what the latest answer posted.
 */
function publish(context: vscode.ExtensionContext, shown: Current): PaneMessage {
  const selections = liveSelections(context, shown.live, shown.recipes);
  const missions = shown.live.map((mission) => {
    const workflow = shown.workflows.get(mission.path) as MissionWorkflow;
    return {
      ...mission,
      ...(shown.documents.get(mission.path) as MissionDocuments),
      ...workflow,
      recipes: missionRecipes(shown.recipes, workflow.step, missionSelections(selections, mission.path)),
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
    questions,
  };
  return { type: 'live', missions, running: runningMissions() };
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
  try {
    recipes = readAllRecipes(context);
  } catch (error) {
    previews.delete(mission);
    const cause = `The recipes could not be read: ${error instanceof Error ? error.message : String(error)}`;
    await post(target, { type: 'preview', mission, recipe, lines: listed.lines, names: [], result: { state: 'failed', cause } });
    return;
  }
  const looped = pageRecipes(recipes, PAGE_PLACEHOLDERS, new Map([[recipe, selectedChoice(listed).name]])).find(
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
const QUESTION_BUTTONS: Record<QuestionButton, { recipe: string; typed: string[] }> = {
  discussQuestion: { recipe: BUTTON_RECIPES.discussQuestion, typed: ['note'] },
  answerQuestion: { recipe: BUTTON_RECIPES.answerQuestion, typed: ['answer text'] },
  answerWithRecommendation: { recipe: BUTTON_RECIPES.answerWithRecommendation, typed: [] },
};

/** The placeholder values each mission-starting button has typed, in the order it asks for them. */
const MISSION_BUTTONS: Record<MissionButton, { recipe: string; typed: string[] }> = {
  discussGoal: { recipe: BUTTON_RECIPES.discussGoal, typed: ['goal'] },
  defineMission: { recipe: BUTTON_RECIPES.defineMission, typed: ['goal', 'scope'] },
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
 * Reads the recipe of the fixed name `name` afresh from the shipped snippet file and the person's
 * own recipe file, for a button holding values for `fillable`, and yields its name with the lines
 * of the variant the button runs. A recipe that cannot be read or run is told in an error
 * notification and yields nothing.
 */
function readButtonRecipe(context: vscode.ExtensionContext, name: string, fillable: readonly string[]): { name: string; lines: string[] } | undefined {
  let recipes: Recipe[];
  try {
    recipes = readAllRecipes(context);
  } catch (error) {
    void vscode.window.showErrorMessage(`The recipes could not be read: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
  const found = buttonRecipe(recipes, name, fillable);
  if (found.state === 'refused') {
    void vscode.window.showErrorMessage(found.cause);
    return undefined;
  }
  return { name: found.recipe.name, lines: found.variant.lines };
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
 * button, and the optional discussion note, for the discuss button, typed into an input box. A
 * question or mission the latest answer did not show, a mission with a running chain, or a box
 * dismissed with Escape starts nothing.
 */
async function runQuestionButton(
  context: vscode.ExtensionContext,
  button: QuestionButton,
  mission: string,
  question: string,
): Promise<void> {
  const spec = QUESTION_BUTTONS[button];
  if (spec === undefined || posted === undefined || !posted.missions.has(mission) || !shown(mission, question)) {
    return;
  }
  if (refuseWhileRunning(mission)) {
    return;
  }
  const recipe = readButtonRecipe(context, spec.recipe, ['path', 'Short Title', ...spec.typed]);
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
 * question `question`, the Short Title and the Alternative Id both from the card clicked.
 */
function runAlternativeButton(context: vscode.ExtensionContext, mission: string, question: string, alternative: string): void {
  if (posted === undefined || !posted.missions.has(mission) || !shown(mission, question, alternative)) {
    return;
  }
  if (refuseWhileRunning(mission)) {
    return;
  }
  const recipe = readButtonRecipe(context, BUTTON_RECIPES.answerWithAlternative, ['path', 'Short Title', 'Alternative Id']);
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
 * issue description typed into an input box, the mission's path from the page. A mission the
 * latest answer did not list, or a mission with a running chain, starts nothing.
 */
async function runTaskButton(context: vscode.ExtensionContext, mission: string): Promise<void> {
  if (posted === undefined || !posted.missions.has(mission)) {
    return;
  }
  if (refuseWhileRunning(mission)) {
    return;
  }
  const recipe = readButtonRecipe(context, BUTTON_RECIPES.discussTask, ['path', 'issue description']);
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
 * input boxes, the run belonging to no mission.
 */
async function runMissionButton(context: vscode.ExtensionContext, button: MissionButton): Promise<void> {
  const spec = MISSION_BUTTONS[button];
  if (spec === undefined) {
    return;
  }
  const recipe = readButtonRecipe(context, spec.recipe, spec.typed);
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
  button.action { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; padding: 0.15em 0.6em; cursor: pointer; font: inherit; white-space: nowrap; }
  button.action:hover:not(:disabled) { background: var(--vscode-button-secondaryHoverBackground); }
  button.action:disabled, button.recipe:disabled { opacity: 0.5; cursor: default; }
  .pager { display: flex; align-items: center; gap: 0.8em; margin-bottom: 0.5em; }
  .pager .counter { font-variant-numeric: tabular-nums; min-width: 4em; text-align: center; }
  .card { border: 1px solid var(--vscode-panel-border); padding: 0.6em 0.8em; }
  .card h4, .card h5, .card h6, .card p, .card ul { margin: 0; padding: 0; }
  .card ul { list-style: none; }
  .card h4, .card h5, .card h6 { font-size: 1em; }
  .card-head { display: flex; align-items: center; gap: 0.6em; flex-wrap: nowrap; height: 2em; }
  .card-head .short-title { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .card-actions { display: flex; gap: 0.3em; flex-shrink: 0; }
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
  select.recipe-variant { background: var(--vscode-dropdown-background); color: var(--vscode-dropdown-foreground); border: 1px solid var(--vscode-dropdown-border); font: inherit; max-width: 14em; }
  button.recipe { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 0.3em 0.9em; cursor: pointer; font: inherit; }
  button.recipe:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }
  button.recipe .recipe-values { display: block; font-size: 0.85em; opacity: 0.8; }
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
