// The mission pane: the one webview panel in the editor area the extension holds. Its
// `webview.html` is set once, to a page shell whose script, loaded from the output directory
// through `asWebviewUri` under a content security policy, posts a ready message on every load
// and draws what the extension answers. The extension answers every ready message with the live
// missions, read afresh, each carrying its documents as the in-process readers parse them and the
// step its workflow diagram fills, the step to run next chosen from its state and its documents'
// facts, with git read for a `Requirements-review:` commit only for a defined mission with no open
// question and no task, and the recipe list every mission page shows, read afresh from the
// shipped snippet file and the person's own recipe file; or with the one failure state the live
// read gives. The page redraws
// its question card in place from every such message. A click on a recipe button starts that recipe's
// chain for the page's mission at once. The buttons outside the chains each run the recipe of
// its fixed name, shipped or replaced by an own recipe of the same name, read afresh at the click,
// through the same run path: on a question's card the discuss, answer, and answer-with-
// recommendation buttons, on an alternative on that card the answer-with-alternative button,
// and on the pane at the tab row's end, in its failure state too, the two mission-starting
// buttons, and on a mission's page, beside its remaining-task headings, the new-task button. The
// Short Title and the Alternative Id come from the card clicked, every typed value from
// VS Code's own input box, one line per value, and each value reaches its line only as its
// `GURITA_*` session variable. When a run's terminal closes the pane is re-read and the fresh parse
// posted to the page. A click on a looped recipe's button shows that recipe's preview on the
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
// the live list last read, choosing its next step afresh, and creating or deleting a
// `requirements.md`, or changing a `TASKS_TODO.md`, also re-runs `missions.py live`. While the panel is hidden an event only marks
// the page stale, and a stale page is re-read when the panel is shown. The refresh control on the
// page and the refresh command each re-read everything, as a fallback. Git state is not watched.
// The page stays on the mission it shows unless that mission is no longer live, when it falls back
// to the first.

import * as os from 'node:os';
import * as vscode from 'vscode';
import { MissionDocuments, readMissionDocuments } from './documents';
import { LiveMission, LiveRead, projectRoot, readLive } from './live';
import { PreviewRead, SingleTaskLine, loopArguments, ruleFile, runOverrides, runPreview, singleTaskLines } from './loop';
import { BUTTON_RECIPES, PageRecipe, Recipe, buttonRecipe, ownRecipesFile, pageRecipes, readRecipes } from './recipes';
import { FileEventKind, RefreshBatch, RefreshQueue, WATCHED_PATTERN, eventEffect } from './refresh';
import { refuseWhileRunning, runnerFile, startChain, startLoop } from './runs';
import { WorkflowStep, missionStep, reviewCommitted } from './workflow';

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
  | { type: 'runRecipe'; mission: string; recipe: string }
  | { type: 'questionButton'; button: QuestionButton; mission: string; question: string }
  | { type: 'alternativeButton'; mission: string; question: string; alternative: string }
  | { type: 'missionButton'; button: MissionButton }
  | { type: 'taskButton'; mission: string }
  | { type: 'previewLoop'; mission: string; recipe: string }
  | { type: 'startLoop'; mission: string; recipe: string; overrides: Record<string, string> };

/** The recipe list every mission page shows, or the cause it could not be read. */
type RecipePart = { state: 'read'; recipes: PageRecipe[] } | { state: 'failed'; cause: string };

/** A message the extension posts to the page. */
type PaneMessage =
  | {
      type: 'live';
      /** Each live mission with its documents and the step its diagram fills, left out when none is chosen. */
      missions: ({ path: string; state: string; title: string; step?: WorkflowStep } & MissionDocuments)[];
      recipes: RecipePart;
    }
  | { type: 'liveFailure'; cause: string }
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
 * What the latest answer posted: the project root, the live missions' paths, the recipes, and the
 * Short Titles each mission's question view showed, each with its alternatives' ids.
 */
interface Posted {
  root: string;
  missions: Set<string>;
  recipes: PageRecipe[];
  questions: Map<string, Map<string, Set<string>>>;
}

/**
 * What the latest successful live read gave and the pane last drew: the project root, the live
 * missions in the order printed, each one's documents as last read and the step its diagram
 * fills, and the recipes.
 */
interface Current {
  root: string;
  live: LiveMission[];
  documents: Map<string, MissionDocuments>;
  steps: Map<string, WorkflowStep | undefined>;
  recipes: RecipePart;
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
      } else if (message?.type === 'runRecipe') {
        runRecipe(context, message.mission, message.recipe);
      } else if (message?.type === 'questionButton') {
        void runQuestionButton(context, message.button, message.mission, message.question);
      } else if (message?.type === 'alternativeButton') {
        runAlternativeButton(context, message.mission, message.question, message.alternative);
      } else if (message?.type === 'missionButton') {
        void runMissionButton(context, message.button);
      } else if (message?.type === 'taskButton') {
        void runTaskButton(context, message.mission);
      } else if (message?.type === 'previewLoop') {
        void previewLoop(context, created, message.mission, message.recipe);
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

/** The step the diagram of the live mission `mission` fills, from its documents `documents` as read. */
function chooseStep(root: string, mission: LiveMission, documents: MissionDocuments): Promise<WorkflowStep | undefined> {
  return missionStep(mission.state, documents.facts, () => reviewCommitted(root, mission.path));
}

/**
 * Acts on one debounced burst of the watcher's events: a hidden panel is only marked stale; a
 * burst that moves the live list re-reads everything; any other re-reads in process the documents
 * of each live mission it touched, chooses its next step afresh, and posts the fresh parse.
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
  const steps = await Promise.all(read.map(({ mission, documents }) => chooseStep(shown.root, mission, documents)));
  if (sequence !== reads || current !== shown || panel !== target) {
    return;
  }
  read.forEach(({ mission, documents }, index) => {
    shown.documents.set(mission.path, documents);
    shown.steps.set(mission.path, steps[index]);
  });
  await post(target, publish(shown));
}

/** Reads the shipped snippet file and the person's own recipe file into the merged recipe list. */
function readAllRecipes(context: vscode.ExtensionContext): Recipe[] {
  const setting = vscode.workspace.getConfiguration('gurita').get<string>('ownRecipesFile');
  return readRecipes(context.asAbsolutePath('bundled/GURITA_USAGE.md'), ownRecipesFile(setting, os.homedir()));
}

/** Reads the shipped snippet file and the person's own recipe file into a page's recipe list. */
function readPageRecipes(context: vscode.ExtensionContext): RecipePart {
  try {
    return { state: 'read', recipes: pageRecipes(readAllRecipes(context), PAGE_PLACEHOLDERS) };
  } catch (error) {
    return { state: 'failed', cause: error instanceof Error ? error.message : String(error) };
  }
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
    const steps = await Promise.all(
      read.missions.map((mission) => chooseStep(read.root, mission, documents.get(mission.path) as MissionDocuments)),
    );
    if (sequence !== reads || panel !== target) {
      return;
    }
    watch(read.root);
    current = {
      root: read.root,
      live: read.missions,
      documents,
      steps: new Map(read.missions.map((mission, index) => [mission.path, steps[index]])),
      recipes: readPageRecipes(context),
    };
    message = publish(current);
  } else {
    posted = undefined;
    current = undefined;
    message = { type: 'liveFailure', cause: read.cause };
  }
  await post(target, message);
}

/** The page's message for what `shown` holds, noting what it lists as what the latest answer posted. */
function publish(shown: Current): PaneMessage {
  const missions = shown.live.map((mission) => ({
    ...mission,
    ...(shown.documents.get(mission.path) as MissionDocuments),
    step: shown.steps.get(mission.path),
  }));
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
    recipes: shown.recipes.state === 'read' ? shown.recipes.recipes : [],
    questions,
  };
  return { type: 'live', missions, recipes: shown.recipes };
}

/**
 * Starts the chain of the recipe named `recipe`, as the latest answer listed it, for the live
 * mission at `mission`, its path its one value. A name or mission the latest answer did not list
 * starts nothing.
 */
function runRecipe(context: vscode.ExtensionContext, mission: string, recipe: string): void {
  const listed = posted?.recipes.find((entry) => entry.name === recipe);
  if (posted === undefined || !posted.missions.has(mission) || listed === undefined || listed.kind !== 'runnable') {
    return;
  }
  startChain(context, posted.root, mission, listed.name, listed.lines, { path: mission });
}

async function post(target: vscode.WebviewPanel, message: PaneMessage): Promise<void> {
  try {
    await target.webview.postMessage(message);
  } catch {
    // The panel was closed; there is no page left to answer.
  }
}

/**
 * Shows the preview of the looped recipe named `recipe`, as the latest answer listed it, for the
 * live mission at `mission`: the recipes read afresh, the named single-task lines gathered from
 * them, and the runner's `preview` run with those lines, the mission, and the rule file, its print
 * posted to the page. A name or mission the latest answer did not list, or a mission with a
 * running chain, runs nothing.
 */
async function previewLoop(context: vscode.ExtensionContext, target: vscode.WebviewPanel, mission: string, recipe: string): Promise<void> {
  const listed = posted?.recipes.find((entry) => entry.name === recipe);
  if (posted === undefined || !posted.missions.has(mission) || listed === undefined || listed.kind !== 'looped') {
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
  const looped = pageRecipes(recipes, PAGE_PLACEHOLDERS).find((entry) => entry.name === recipe && entry.kind === 'looped');
  if (looped === undefined) {
    previews.delete(mission);
    const cause = `No looped recipe is named ${recipe}.`;
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
  discussQuestion: { recipe: BUTTON_RECIPES.discussQuestion, typed: [] },
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
};

/**
 * Reads the recipe of the fixed name `name` afresh from the shipped snippet file and the person's
 * own recipe file, for a button holding values for `fillable`. A recipe that cannot be read or run
 * is told in an error notification and yields nothing.
 */
function readButtonRecipe(context: vscode.ExtensionContext, name: string, fillable: readonly string[]): Recipe | undefined {
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
  return found.recipe;
}

/**
 * Asks for each of `names` in VS Code's own input box, one box per value in the order given, and
 * returns the values by placeholder name, or undefined when the person dismisses a box.
 */
async function askValues(names: readonly string[]): Promise<Record<string, string> | undefined> {
  const values: Record<string, string> = {};
  for (const name of names) {
    const typed = await vscode.window.showInputBox({
      ...PROMPTS[name],
      ignoreFocusOut: true,
      validateInput: (value) => (value.trim() === '' ? 'Type a value, or press Escape to start nothing.' : undefined),
    });
    if (typed === undefined) {
      return undefined;
    }
    values[name] = typed;
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
 * button, typed into an input box. A question or mission the latest answer did not show, or a
 * mission with a running chain, starts nothing.
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
  .workflow { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6em; margin: 1em 0; overflow-x: auto; }
  .workflow .frame { border: 1px solid var(--vscode-panel-border); border-radius: 4px; padding: 0.4em 0.8em 0.6em; }
  .workflow .frame-heading { opacity: 0.8; margin-bottom: 0.4em; }
  .workflow .flow { display: grid; grid-auto-columns: max-content; align-items: center; column-gap: 0.4em; }
  .workflow .block, .workflow .flow > .arrow { grid-row: 1; }
  .workflow .block { border: 1px solid var(--vscode-panel-border); border-radius: 4px; padding: 0.3em 0.8em; white-space: nowrap; }
  .workflow .block.next { background: #9333ea; border-color: #9333ea; color: #ffffff; }
  .workflow .arrow { opacity: 0.7; }
  .workflow .arrow-label { opacity: 0.7; font-size: 0.85em; white-space: nowrap; }
  .workflow .handoff { display: flex; flex-direction: column; align-items: center; }
  .workflow .loop { grid-row: 2; position: relative; box-sizing: border-box; height: 1.2em; margin: 0.2em 1.5em 0.8em; border: 1px dashed var(--vscode-foreground); border-top: none; opacity: 0.7; }
  .workflow .loop::before { content: ''; position: absolute; left: -6px; top: -6px; border: 5px solid transparent; border-top: none; border-bottom: 6px solid var(--vscode-foreground); }
  .workflow .loop .arrow-label { position: absolute; left: 50%; bottom: -0.65em; transform: translateX(-50%); opacity: 1; background: var(--vscode-editor-background); padding: 0 0.3em; line-height: 1.2; }
  .notice { border-left: 3px solid var(--vscode-inputValidation-warningBorder); padding: 0.2em 0.8em; }
  .controls { display: flex; gap: 0.5em; margin-bottom: 0.5em; }
  button.control { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; padding: 0.25em 0.8em; cursor: pointer; font: inherit; }
  button.control:disabled { opacity: 0.5; cursor: default; }
  button.action { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; padding: 0.15em 0.6em; cursor: pointer; font: inherit; white-space: nowrap; }
  button.action:hover { background: var(--vscode-button-secondaryHoverBackground); }
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
  .section-head { display: flex; align-items: center; gap: 0.8em; }
  .section-head h3 { margin: 0.8em 0; }
  .recipes h4 { margin: 0.8em 0 0.3em; }
  .recipe-list { display: flex; flex-wrap: wrap; gap: 0.4em; }
  button.recipe { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 0.3em 0.9em; cursor: pointer; font: inherit; }
  button.recipe:hover { background: var(--vscode-button-hoverBackground); }
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
