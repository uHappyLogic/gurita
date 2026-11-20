// The mission pane: the one webview panel in the editor area the extension holds. Its
// `webview.html` is set once, to a page shell whose script, loaded from the output directory
// through `asWebviewUri` under a content security policy, posts a ready message on every load
// and draws what the extension answers. The extension answers every ready message with the live
// missions, read afresh, each carrying its documents as the in-process readers parse them, and
// the recipe list every mission page shows, read afresh from the shipped snippet file and the
// person's own recipe file; or with the one failure state the live read gives. The page redraws
// its rows in place from every such message. A click on a recipe button starts that recipe's
// chain for the page's mission at once. The buttons outside the chains each run the recipe of
// its fixed name, shipped or replaced by an own recipe of the same name, read afresh at the click,
// through the same run path: on a question's row the discuss, answer, and answer-with-
// recommendation buttons, on an alternative inside an opened row the answer-with-alternative
// button, and on the pane at the tab row's end, in its failure state too, the two mission-starting
// buttons. The Short Title and the Alternative Id come from the row clicked, every typed value from
// VS Code's own input box, one line per value, and each value reaches its line only as its
// `GURITA_*` session variable. When a run's terminal closes the pane is re-read and the fresh parse
// posted to the page.

import * as os from 'node:os';
import * as vscode from 'vscode';
import { MissionDocuments, readMissionDocuments } from './documents';
import { LiveRead, projectRoot, readLive } from './live';
import { BUTTON_RECIPES, PageRecipe, Recipe, buttonRecipe, ownRecipesFile, pageRecipes, readRecipes } from './recipes';
import { refuseWhileRunning, startChain } from './runs';

const VIEW_TYPE = 'gurita.missionPane';
const PANEL_TITLE = 'Gurita Missions';

/** The placeholders a mission page holds a value for: the mission's own path. */
const PAGE_PLACEHOLDERS = ['path'];

/** A button on a question's row. */
type QuestionButton = 'discussQuestion' | 'answerQuestion' | 'answerWithRecommendation';

/** A mission-starting button at the tab row's end. */
type MissionButton = 'discussGoal' | 'defineMission';

/** A message the page posts to the extension. */
type PageMessage =
  | { type: 'ready' }
  | { type: 'runRecipe'; mission: string; recipe: string }
  | { type: 'questionButton'; button: QuestionButton; mission: string; question: string }
  | { type: 'alternativeButton'; mission: string; question: string; alternative: string }
  | { type: 'missionButton'; button: MissionButton };

/** The recipe list every mission page shows, or the cause it could not be read. */
type RecipePart = { state: 'read'; recipes: PageRecipe[] } | { state: 'failed'; cause: string };

/** A message the extension posts to the page. */
type PaneMessage =
  | {
      type: 'live';
      missions: ({ path: string; state: string; title: string } & MissionDocuments)[];
      recipes: RecipePart;
    }
  | { type: 'liveFailure'; cause: string };

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

let panel: vscode.WebviewPanel | undefined;
let posted: Posted | undefined;

/** Re-reads the pane, when the extension holds one, and posts the fresh parse to its page. */
export function refreshMissionPane(context: vscode.ExtensionContext): void {
  if (panel !== undefined) {
    void answer(context, panel);
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
  created.webview.html = pageShell(created.webview, vscode.Uri.joinPath(scripts, 'page.js'));
  created.webview.onDidReceiveMessage(
    (message: PageMessage) => {
      if (message?.type === 'ready') {
        void answer(context, created);
      } else if (message?.type === 'runRecipe') {
        runRecipe(context, message.mission, message.recipe);
      } else if (message?.type === 'questionButton') {
        void runQuestionButton(context, message.button, message.mission, message.question);
      } else if (message?.type === 'alternativeButton') {
        runAlternativeButton(context, message.mission, message.question, message.alternative);
      } else if (message?.type === 'missionButton') {
        void runMissionButton(context, message.button);
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

/** Reads the shipped snippet file and the person's own recipe file into a page's recipe list. */
function readPageRecipes(context: vscode.ExtensionContext): RecipePart {
  const setting = vscode.workspace.getConfiguration('gurita').get<string>('ownRecipesFile');
  try {
    const recipes = readRecipes(context.asAbsolutePath('bundled/GURITA_USAGE.md'), ownRecipesFile(setting, os.homedir()));
    return { state: 'read', recipes: pageRecipes(recipes, PAGE_PLACEHOLDERS) };
  } catch (error) {
    return { state: 'failed', cause: error instanceof Error ? error.message : String(error) };
  }
}

async function answer(context: vscode.ExtensionContext, target: vscode.WebviewPanel): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const read: LiveRead = await readLive(folder, context.asAbsolutePath('bundled/missions.py'));
  let message: PaneMessage;
  if (read.state === 'read') {
    const recipes = readPageRecipes(context);
    const missions = read.missions.map((mission) => ({ ...mission, ...readMissionDocuments(read.root, mission.path) }));
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
      root: read.root,
      missions: new Set(read.missions.map((mission) => mission.path)),
      recipes: recipes.state === 'read' ? recipes.recipes : [],
      questions,
    };
    message = { type: 'live', missions, recipes };
  } else {
    posted = undefined;
    message = { type: 'liveFailure', cause: read.cause };
  }
  try {
    await target.webview.postMessage(message);
  } catch {
    // The panel was closed while the read ran; there is no page left to answer.
  }
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

/** The placeholder values each question-row button fills, beyond the mission's path and the Short Title. */
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
};

/**
 * Reads the recipe of the fixed name `name` afresh from the shipped snippet file and the person's
 * own recipe file, for a button holding values for `fillable`. A recipe that cannot be read or run
 * is told in an error notification and yields nothing.
 */
function readButtonRecipe(context: vscode.ExtensionContext, name: string, fillable: readonly string[]): Recipe | undefined {
  const setting = vscode.workspace.getConfiguration('gurita').get<string>('ownRecipesFile');
  let recipes: Recipe[];
  try {
    recipes = readRecipes(context.asAbsolutePath('bundled/GURITA_USAGE.md'), ownRecipesFile(setting, os.homedir()));
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
 * Runs a question row's button for the question `question` of the live mission at `mission`, as
 * the latest answer listed them: the Short Title from the row, the answer text, for the answer
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
 * Runs the answer-with-alternative button of the alternative `alternative` inside the opened row
 * of the question `question`, the Short Title and the Alternative Id both from the row clicked.
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
  .tabs .starting { margin-left: auto; display: flex; gap: 0.4em; }
  .tab-list button { background: none; color: var(--vscode-foreground); border: 1px solid transparent; padding: 0.3em 0.8em; cursor: pointer; font: inherit; }
  .tab-list button[aria-selected="true"] { border-color: var(--vscode-focusBorder); background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
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
  .row-line { display: flex; align-items: center; gap: 0.6em; }
  .row-actions { display: flex; gap: 0.3em; flex-shrink: 0; }
  button.action { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; padding: 0.15em 0.6em; cursor: pointer; font: inherit; }
  button.action:hover { background: var(--vscode-button-secondaryHoverBackground); }
  button.row-head { display: flex; gap: 0.6em; flex: 1; min-width: 0; text-align: left; background: none; color: var(--vscode-foreground); border: none; padding: 0.4em 0; cursor: pointer; font: inherit; }
  .row-head .pick-id { margin-left: auto; opacity: 0.75; }
  .row .body { padding: 0 0 0.8em 1.4em; }
  .alternative { margin: 0.4em 0; padding-left: 0.6em; border-left: 2px solid var(--vscode-panel-border); }
  .alternative.picked { border-left-color: var(--vscode-focusBorder); }
  .body h4, .body h5 { margin: 0.6em 0 0.2em; }
  .recipes h4 { margin: 0.8em 0 0.3em; }
  .recipe-list { display: flex; flex-wrap: wrap; gap: 0.4em; }
  button.recipe { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 0.3em 0.9em; cursor: pointer; font: inherit; }
  button.recipe:hover { background: var(--vscode-button-hoverBackground); }
  .recipe-unknown { border: 1px dashed var(--vscode-inputValidation-warningBorder); padding: 0.3em 0.9em; opacity: 0.85; }
  button.link { background: none; border: none; padding: 0; color: var(--vscode-textLink-foreground); cursor: pointer; font: inherit; text-decoration: underline; }
</style>
</head>
<body>
<div id="root"></div>
<script nonce="${token}" src="${webview.asWebviewUri(script).toString()}"></script>
</body>
</html>`;
}
