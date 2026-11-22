// The mission pane's page script. On every load it posts a ready message and draws what the
// extension answers: a row of tabs, one per live mission in the order `missions.py live` prints
// them, each showing the mission's title with its path as a tooltip, with the two mission-starting
// buttons and the refresh control at the row's end and the selected mission's page beneath; or the
// one failure state in place of the pages, the refresh control and the two mission-starting buttons
// staying on the pane above it. Every click of a mission's tab, the tab already selected included,
// posts the clicked mission's path to the extension, which brings forward and focuses the terminal
// of that mission's running runner when it has one and does nothing more, with no notification,
// when it has none. The refresh control asks the extension to re-read everything, and
// after every answer the page stays on the mission it showed unless that mission is no longer
// live, when it falls back to the first. A page opens on the workflow diagram, drawn by this script
// with no Mermaid: the choices a person makes as one line of seven neutral blocks joined by arrows,
// define, first review round, additional review round, derive tasks, execute tasks, follow up
// tasks, and finish, with no frame, loop arrow, or handoff label, the two optional blocks,
// additional review round and follow up tasks, drawn with a dashed border and the five required
// ones solid. The diagram is centered horizontally in the pane and lies in one horizontal row while
// that row fits the pane's width; when the row would overflow, the same blocks stack vertically,
// joined by downward arrows and likewise centered, their borders, fill, and pulse unchanged. The
// row is measured afresh on every redraw and every change of the pane's width, so the diagram
// switches back to the row once the pane is wide enough again, and it never wraps or scrolls
// sideways. The additional review round reads plain while git holds at most one review commit for
// the mission and then carries the count of those beyond the first, as the extension posts it,
// such as "additional review round 2". The block of the step to run next, which the extension
// chooses and posts, is filled purple, and no block is filled when the extension chose none; the
// diagram is display only, its blocks no buttons, gating nothing. Below
// it stand the recipe buttons and then two panes behind one row of two headers, Open questions and
// Remaining tasks, of equal width and together filling the pane's whole width, with only the
// selected pane's content beneath them: the question view in Open questions, and in Remaining
// tasks the remaining task headings with the new-task button, posting the page's mission, all
// drawn from the parse the extension posts. A page opens on the pane the extension posts as the
// mission's default, Remaining tasks when git holds at least one review commit for it and no
// question is open and Open questions otherwise, Open questions too when none is posted. A pane
// header the person clicks stays selected through every redraw while its mission stays shown; it
// is held in this script's memory only, never saved with `setState`, so every switch of the shown
// mission (a tab click, a preview of another mission, a fall back to the first, the failure
// state) and every load of the page, a reopening or a hidden pane shown again, opens on the
// default afresh. The recipe buttons: the recipe list the extension posts with the page's mission,
// holding only the recipes that fit the step its diagram fills, those declaring that step, beside
// them those declaring the additional review round when derive tasks is filled and follow up tasks
// when finish is, and every recipe declaring no step, whichever block is filled, or every recipe
// when no block is filled, so each mission's page draws its own list; first the shipped recipes in
// it, one button each in the order posted, the shipped file's, under no heading of their own, and
// below them the own recipes that carry no shipped recipe's name under "Your recipes", in the own
// file's order, each with a dropdown beside it offering the recipe's variants, a person's own
// marked as theirs, and standing on the variant selected, as the extension posts it: the one
// remembered for the recipe on this mission, else the recipe's default. Picking another variant
// posts it to the extension, which remembers it and posts the page again with it selected. Each
// button shows its recipe's name with the distinct harnesses, models, and efforts of the selected
// variant, as the extension posts them, a variant none of whose lines is readable showing its name
// alone, carries that variant's lines as written in its hover text, and starts that variant's
// chain for the page's mission when clicked, and a selected variant holding a placeholder the
// extension does not know is shown as a non-runnable entry naming it and its file. The buttons
// outside the recipe list, which run a recipe by its fixed name, carry no dropdown.
// A looped recipe's button asks the extension for its preview instead, drawn on the page beneath
// the recipes: every remaining task with the line the rules give it or as unresolved, naming the
// missing line, and above them what the runner said about a missing or unreadable rule file,
// verbatim. Each task's line may be overridden by picking another named single-task line, and the
// start button starts the run with every override picked, whether or not a task is unresolved.
// The question view shows one fully opened card per question, one card at a time, under a
// position counter such as "3 / 12", moved between by the previous and next buttons and by the
// left and right arrow keys, and a dependency link on a card jumps to the named question's card.
// Each card stacks flat, non-indented slots: its Short Title with the discuss, answer, and
// answer-with-recommendation buttons, the question text in an area of fixed height, so the pick
// starts at the same height on every card, then the pick and its rationale, then the
// alternatives, each with its answer-with-alternative button, the dependencies, and the
// principles. Each button posts the Short Title and the Alternative Id of the card clicked; the
// extension asks for any typed value in VS Code's own input box, the discuss button's optional
// discussion note included. Every message the extension
// posts redraws the card in place and the view keeps its position: the page keeps each mission's
// position, the Short Title shown and its place in the list, saved with `setState` on every move
// and read back with `getState` when the page is re-created, and when a run removes the question
// shown the view stays at the same place in the list, clamped to its last card. A part drawn from
// a file that did not read is replaced by that file's notice alone. While a chain started for a
// mission is running, as the extension posts when a run starts, when its terminal closes, and with
// every redraw, that mission's page draws every action button on it disabled, its recipe buttons,
// its question card's buttons, its preview's start button, and its New task button, and its
// workflow diagram's filled block pulses; the recipe dropdowns, the tabs, the refresh control, the question view's
// previous and next buttons and dependency links, the preview's close button, the other missions'
// pages, the two pane headers, the two mission-starting buttons, and the settings control stay
// enabled, and the left and right arrow keys move the question view only while its pane is shown.
// Every value is drawn as text, never as markup, since it comes from the workspace.
// The settings control at the tab row's very end, beside the refresh control and the two
// mission-starting buttons and drawn in the failure state as they are, swaps whatever stands
// beneath the row, the selected mission's page or the failure state, for the settings view, which
// belongs to no mission and is no tab, holds buttons and dropdowns only, and is opened by nothing
// else. The view's close control swaps back to the mission page or the failure state shown before,
// and a click on any mission tab to that mission's page. The view stays shown through every answer
// the extension posts until one of the two swaps it back, and while it is shown no tab reads
// selected. Every opening of the view is posted to the extension, which runs the harness check on
// the first opening after the panel is created and otherwise posts the result it keeps. The view
// lists Claude Code, Antigravity, and Codex, each with the checks it passed or the one that failed
// first, named: CLI not found, Gurita plugin not installed, or installed version differing from
// the packaged one, with the versions read; and its check-again control, disabled while a check
// runs, asks the extension to run the check afresh. The check is shown in the settings view
// alone: nothing on a mission page is drawn from it.

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

(() => {
  interface Alternative {
    id: string;
    text: string;
    advantages: string[];
    drawbacks: string[];
  }

  interface Question {
    id: string;
    question: string;
    principles: string[];
    dependsOn: { question: string; option: string }[];
    recommendation?: { option: string; rationale: string };
    alternatives: Alternative[];
  }

  interface Notice {
    file: string;
    reason: 'missing' | 'unparsable';
    message?: string;
  }

  type QuestionPart = { state: 'read'; questions: Question[] } | { state: 'failed'; notice: Notice };
  type TaskPart = { state: 'read'; headings: string[] } | { state: 'failed'; notice: Notice };

  type WorkflowStep = 'define' | 'first-review' | 'additional-review' | 'derive' | 'execute' | 'follow-up' | 'finish';

  /** One of the two panes beneath a mission page's pane headers. */
  type MissionPane = 'questions' | 'tasks';

  interface Mission {
    path: string;
    state: string;
    title: string;
    questions: QuestionPart;
    tasks: TaskPart;
    /** The step to run next, which the diagram fills; absent when none could be chosen. */
    step?: WorkflowStep;
    /** The review commits beyond the first, which the additional review round carries; absent while git holds at most one. */
    additionalRounds?: number;
    /** The pane the page opens on; Open questions when absent. */
    defaultPane?: MissionPane;
    /** The recipe list its page shows, the recipes that fit its step, or the cause the recipes could not be read. */
    recipes: RecipePart;
  }

  type RecipeGroup = 'shipped' | 'own';

  /** The distinct harnesses, models, and efforts a variant's lines carry, each in first-appearance order. */
  interface VariantValues {
    harnesses: string[];
    models: string[];
    efforts: string[];
  }

  /** One variant a recipe's dropdown offers: its name, and whether it is the person's own. */
  interface PageVariantChoice {
    name: string;
    own: boolean;
  }

  /** The dropdown beside a recipe: the variants it offers and the index of the selected one, which the entry describes. */
  interface PageChoices {
    variants: PageVariantChoice[];
    selected: number;
  }

  type PageRecipe = PageChoices &
    (
      | { kind: 'runnable'; name: string; group: RecipeGroup; lines: string[]; values: VariantValues }
      | { kind: 'looped'; name: string; group: RecipeGroup; lines: string[]; values: VariantValues }
      | { kind: 'unknown'; name: string; group: RecipeGroup; lines: string[]; placeholders: string[]; file: string }
    );

  type RecipePart = { state: 'read'; recipes: PageRecipe[] } | { state: 'failed'; cause: string };

  interface PreviewTask {
    state: 'resolved' | 'missing';
    name: string;
    title: string;
  }

  type PreviewRead = { state: 'read'; tasks: PreviewTask[]; notice?: string } | { state: 'failed'; cause: string };

  interface Preview {
    recipe: string;
    lines: string[];
    names: string[];
    result: PreviewRead;
    /** The line name picked for each overridden task, by its title. */
    overrides: Map<string, string>;
  }

  /** The check of a harness that failed first: its CLI, its installed plugin, or that copy's version. */
  type FailedCheck = 'cli' | 'plugin' | 'version';

  /** One harness's outcome, as the extension posts it. */
  interface HarnessOutcome {
    key: string;
    name: string;
    cli: string;
    failed?: FailedCheck;
    installed?: string;
    packaged?: string;
    detail?: string;
  }

  /** The harness check: running, every harness's outcome, or the cause it could not be run. */
  type HarnessCheck = { state: 'running' } | { state: 'checked'; harnesses: HarnessOutcome[] } | { state: 'failed'; cause: string };

  type PaneMessage =
    | { type: 'live'; missions: Mission[]; running: string[] }
    | { type: 'liveFailure'; cause: string }
    | { type: 'running'; missions: string[] }
    | { type: 'preview'; mission: string; recipe: string; lines: string[]; names: string[]; result: PreviewRead }
    | { type: 'loopStarted'; mission: string }
    | { type: 'harnessCheck'; check: HarnessCheck };

  /** Where a mission's question view stands: the Short Title shown and its place in the list. */
  interface Position {
    title: string;
    index: number;
  }

  interface PageState {
    selected?: string;
    /** The position of each mission's question view, keyed by mission path. */
    positions?: Record<string, Position>;
  }

  const FAILURE_LINE = 'The live missions could not be read.';
  const NO_MISSION_LINE = 'No mission is live.';
  const RECIPE_FAILURE_LINE = 'The recipes could not be read.';
  const PREVIEW_FAILURE_LINE = 'The preview could not be run.';
  /** The settings control's label, which is also the settings view's heading. */
  const SETTINGS_LABEL = 'Settings';
  const CLOSE_SETTINGS_LABEL = 'Close settings';
  const CHECK_AGAIN_LABEL = 'Check again';
  const HARNESSES_HEADING = 'Harnesses';
  const CHECKING_LINE = 'Checking the harnesses…';
  const CHECK_FAILURE_LINE = 'The harness check could not be run.';
  /** The name of each of a harness's three checks, as the settings view names the one that failed. */
  const FAILED_CHECKS: Record<FailedCheck, string> = {
    cli: 'CLI not found',
    plugin: 'Gurita plugin not installed',
    version: 'Installed version differs from the packaged one',
  };
  /** The buttons on a question's card, each with its label and hover text. */
  const QUESTION_BUTTONS: [string, string, string][] = [
    ['discussQuestion', 'Discuss', 'Type an optional note and open an interactive discussion of this question'],
    ['answerQuestion', 'Answer', 'Record an answer you type as the decision'],
    ['answerWithRecommendation', 'Answer with recommendation', "Record this question's recommendation as the decision"],
  ];
  /** The workflow diagram's seven blocks in flow order, each with its step, its name, and whether it is optional. */
  const WORKFLOW_BLOCKS: [WorkflowStep, string, boolean][] = [
    ['define', 'define', false],
    ['first-review', 'first review round', false],
    ['additional-review', 'additional review round', true],
    ['derive', 'derive tasks', false],
    ['execute', 'execute tasks', false],
    ['follow-up', 'follow up tasks', true],
    ['finish', 'finish', false],
  ];
  /** The two panes beneath a mission page's pane headers, in the order drawn, each with its header. */
  const PANES: [MissionPane, string][] = [
    ['questions', 'Open questions'],
    ['tasks', 'Remaining tasks'],
  ];
  /** The heading of the page's group of own recipes, drawn below the shipped recipes, which have none. */
  const OWN_GROUP_HEADING = 'Your recipes';
  /** The mark between a recipe button's lists of harnesses, models, and efforts. */
  const VALUES_SEPARATOR = ' · ';
  /** The mark a recipe dropdown's option carries after the name of a variant of the person's own. */
  const OWN_VARIANT_MARK = ' (yours)';

  const vscode = acquireVsCodeApi();
  const root = document.getElementById('root') as HTMLElement;
  const saved = (vscode.getState() ?? {}) as PageState;
  let selected: string | undefined = saved.selected;
  const positions = new Map<string, Position>(Object.entries(saved.positions ?? {}));
  let missions: Mission[] = [];
  /** The paths of the missions with a running runner, whose pages are drawn as running. */
  let running = new Set<string>();
  /** What the pane last drew from the extension's answer: nothing yet, the mission pages, or the failure state. */
  let drawn: 'nothing' | 'live' | 'failure' = 'nothing';
  /** Each mission's preview, by its path, while it stands on the page. */
  const previews = new Map<string, Preview>();
  /** Whether the settings view stands beneath the tab row in place of the mission page or the failure state. */
  let settingsShown = false;
  /** The harness check the extension last posted, drawn by the settings view; undefined until one is posted. */
  let harnessCheck: HarnessCheck | undefined;
  /** The cause of the failure state, kept while it is drawn so the settings view can swap back to it. */
  let failureCause = '';
  /** The card drawn on the page, so a dependency link can scroll to the card it jumped to. */
  let card: HTMLElement | undefined;
  /** The workflow diagram drawn on the page and its line of blocks, so it can be laid out again whenever the pane's width changes. */
  let diagram: { section: HTMLElement; flow: HTMLElement } | undefined;
  /**
   * The pane header the person clicked and the mission it was clicked on, held while that mission
   * stays shown and never saved, so a switch of mission or a fresh page opens on the default.
   */
  let picked: { mission: string; pane: MissionPane } | undefined;

  function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (text !== undefined) {
      node.textContent = text;
    }
    if (className !== undefined) {
      node.className = className;
    }
    return node;
  }

  function button(text: string, className: string, onClick: () => void): HTMLButtonElement {
    const node = element('button', text, className);
    node.type = 'button';
    node.addEventListener('click', onClick);
    return node;
  }

  /** An action button of a mission's page, drawn disabled while a chain started for it is running. */
  function action(text: string, className: string, busy: boolean, onClick: () => void): HTMLButtonElement {
    const node = button(text, className, onClick);
    node.disabled = busy;
    return node;
  }

  function save(): void {
    const state: PageState = { selected, positions: Object.fromEntries(positions) };
    vscode.setState(state);
  }

  function select(path: string): void {
    selected = path;
    save();
    draw();
  }

  /**
   * The place in `questions` of the card a mission's view shows: the card of the Short Title it
   * showed when that question still stands, otherwise the same place in the list, clamped to the
   * last card, so a run that removes the question shown leaves the view where it was.
   */
  function shownIndex(mission: string, questions: Question[]): number {
    const position = positions.get(mission);
    if (position === undefined) {
      return 0;
    }
    const found = questions.findIndex((question) => question.id === position.title);
    if (found !== -1) {
      return found;
    }
    return Math.max(0, Math.min(position.index, questions.length - 1));
  }

  /** Shows the card at `index` of the mission's questions, saving the position on every move. */
  function moveTo(mission: string, questions: Question[], index: number): void {
    if (index < 0 || index >= questions.length) {
      return;
    }
    positions.set(mission, { title: questions[index].id, index });
    save();
    draw();
  }

  /** The pane shown beneath the mission's pane headers: the one clicked while it holds, else the mission's default. */
  function shownPane(mission: Mission): MissionPane {
    if (picked !== undefined && picked.mission === mission.path) {
      return picked.pane;
    }
    return mission.defaultPane === 'tasks' ? 'tasks' : 'questions';
  }

  /** Shows the pane clicked on the mission's page, held until the shown mission switches. */
  function pick(mission: string, pane: MissionPane): void {
    picked = { mission, pane };
    draw();
  }

  /** The questions of the page shown, when its Open questions pane is shown and its question view reads and holds any. */
  function shownQuestions(): { mission: string; questions: Question[] } | undefined {
    const mission = missions.find((each) => each.path === selected);
    if (
      settingsShown ||
      mission === undefined ||
      shownPane(mission) !== 'questions' ||
      mission.questions.state !== 'read' ||
      mission.questions.questions.length === 0
    ) {
      return undefined;
    }
    return { mission: mission.path, questions: mission.questions.questions };
  }

  /** Moves the shown page's question view one card back or forward. */
  function step(offset: number): void {
    const shown = shownQuestions();
    if (shown !== undefined) {
      moveTo(shown.mission, shown.questions, shownIndex(shown.mission, shown.questions) + offset);
    }
  }

  /** Jumps to the named sibling's card and scrolls it into view. */
  function follow(mission: string, questions: Question[], title: string): void {
    moveTo(
      mission,
      questions,
      questions.findIndex((question) => question.id === title),
    );
    card?.scrollIntoView({ block: 'start' });
  }

  /**
   * Swaps the settings view in beneath the tab row, or out again, redrawing whatever the pane last
   * drew. Every opening is posted, so the extension runs the harness check or posts the one it keeps.
   */
  function showSettings(shown: boolean): void {
    if (shown && !settingsShown) {
      vscode.postMessage({ type: 'settingsOpened' });
    }
    settingsShown = shown;
    if (drawn === 'failure') {
      drawFailure(failureCause);
    } else {
      draw();
    }
  }

  /** What a harness's checks gave: every check passing, or the one that failed first, named, with what it read. */
  function harnessStatus(outcome: HarnessOutcome): string {
    const installed = outcome.installed ?? 'unknown';
    const packaged = outcome.packaged ?? 'unknown';
    if (outcome.failed === undefined) {
      return `Every check passes: Gurita ${installed} is installed, the packaged version.`;
    }
    if (outcome.failed === 'cli') {
      return `${FAILED_CHECKS.cli}: the runner's shell finds no ${outcome.cli} command.`;
    }
    if (outcome.failed === 'plugin') {
      return outcome.detail !== undefined ? `${FAILED_CHECKS.plugin}: ${outcome.detail}` : `${FAILED_CHECKS.plugin}.`;
    }
    return `${FAILED_CHECKS.version}: installed ${installed}, packaged ${packaged}.`;
  }

  /**
   * The settings view's harness part: each harness with what its checks gave, or that the check
   * runs or could not be run, and the check-again control, disabled while a check runs.
   */
  function drawHarnesses(): HTMLElement {
    const part = element('div', undefined, 'harnesses');
    part.append(element('h4', HARNESSES_HEADING));
    const check = harnessCheck;
    if (check === undefined || check.state === 'running') {
      part.append(element('p', CHECKING_LINE, 'checking'));
    } else if (check.state === 'failed') {
      const box = element('div', undefined, 'notice');
      box.setAttribute('role', 'alert');
      box.append(element('p', CHECK_FAILURE_LINE), element('pre', check.cause));
      part.append(box);
    } else {
      const list = element('ul', undefined, 'harness-list');
      for (const outcome of check.harnesses) {
        const item = element('li', undefined, outcome.failed === undefined ? 'harness passed' : 'harness failed');
        item.dataset.harness = outcome.key;
        if (outcome.failed !== undefined) {
          item.dataset.failed = outcome.failed;
        }
        item.append(element('span', outcome.name, 'harness-name'), element('span', harnessStatus(outcome), 'harness-status'));
        list.append(item);
      }
      part.append(list);
    }
    const controls = element('div', undefined, 'controls');
    const again = button(CHECK_AGAIN_LABEL, 'control', () => vscode.postMessage({ type: 'checkHarnesses' }));
    again.title = "Run the harness check again: each harness's CLI, its Gurita plugin, and that copy's version";
    again.disabled = check === undefined || check.state === 'running';
    again.dataset.focus = 'check-again';
    controls.append(again);
    part.append(controls);
    return part;
  }

  /**
   * The settings view, belonging to no mission: its heading, the control that swaps back to the
   * mission page or failure state shown before, and the harness check. It holds buttons and
   * dropdowns only.
   */
  function drawSettings(): HTMLElement {
    const view = element('section', undefined, 'settings');
    view.setAttribute('role', 'region');
    view.setAttribute('aria-label', SETTINGS_LABEL);
    view.append(element('h3', SETTINGS_LABEL));
    const controls = element('div', undefined, 'controls');
    const close = button(CLOSE_SETTINGS_LABEL, 'control', () => showSettings(false));
    close.title = 'Go back to the page shown before';
    close.dataset.focus = 'close-settings';
    controls.append(close);
    view.append(controls, drawHarnesses());
    return view;
  }

  /**
   * The refresh control, the two mission-starting buttons, and the settings control, belonging to
   * no mission, at the tab row's end.
   */
  function drawStarting(): HTMLElement {
    const ends = element('div', undefined, 'ends');
    const refresh = button('Refresh', 'control', () => vscode.postMessage({ type: 'refresh' }));
    refresh.title = 'Re-read the live missions and their documents';
    const starting = element('div', undefined, 'starting');
    const discuss = button('New mission', 'recipe', () => vscode.postMessage({ type: 'missionButton', button: 'discussGoal' }));
    discuss.title = 'Type a goal and open an interactive discussion of it';
    const define = button('Define mission', 'recipe', () => vscode.postMessage({ type: 'missionButton', button: 'defineMission' }));
    define.title = 'Type a goal and its scope and define the mission';
    starting.append(discuss, define);
    const settings = button(SETTINGS_LABEL, 'control', () => showSettings(true));
    settings.title = 'Open the settings view';
    settings.setAttribute('aria-pressed', String(settingsShown));
    settings.dataset.focus = 'settings';
    ends.append(refresh, starting, settings);
    return ends;
  }

  function drawTabs(): HTMLElement {
    const tabs = element('div', undefined, 'tabs');
    const list = element('div', undefined, 'tab-list');
    list.setAttribute('role', 'tablist');
    tabs.append(list);
    for (const mission of missions) {
      const tab = element('button', mission.title);
      tab.type = 'button';
      tab.title = mission.path;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(!settingsShown && mission.path === selected));
      // Posted on every click, selected or not, so the extension can show the mission's run terminal.
      tab.addEventListener('click', () => {
        vscode.postMessage({ type: 'missionTab', mission: mission.path });
        settingsShown = false;
        select(mission.path);
      });
      list.append(tab);
    }
    tabs.append(drawStarting());
    return tabs;
  }

  function drawNotice(notice: Notice): HTMLElement {
    const box = element('div', undefined, 'notice');
    box.setAttribute('role', 'alert');
    box.append(element('p', notice.reason === 'missing' ? `${notice.file} is missing.` : `${notice.file} does not parse.`));
    if (notice.message !== undefined) {
      box.append(element('pre', notice.message));
    }
    return box;
  }

  /**
   * The workflow diagram: its seven blocks in one line joined by arrows, the optional ones dashed,
   * the additional review round carrying `rounds` when given. The block of `step` is filled, and
   * pulses while `busy`, a chain started for the mission running; every block is display only.
   * The line is drawn as a horizontal row, and `fitWorkflow` turns it into a vertical stack once
   * the page is laid out, when the row would overflow the pane.
   */
  function drawWorkflow(step: WorkflowStep | undefined, rounds: number | undefined, busy: boolean): HTMLElement {
    const section = element('section', undefined, 'workflow');
    section.setAttribute('aria-label', 'Workflow');
    const flow = element('div', undefined, 'flow');
    flow.setAttribute('role', 'list');
    WORKFLOW_BLOCKS.forEach(([each, name, optional], index) => {
      if (index > 0) {
        const arrow = element('span', '\u2192', 'arrow');
        arrow.setAttribute('aria-hidden', 'true');
        flow.append(arrow);
      }
      const label = each === 'additional-review' && rounds !== undefined ? `${name} ${rounds}` : name;
      const kinds = ['block', ...(optional ? ['optional'] : []), ...(each === step ? (busy ? ['next', 'running'] : ['next']) : [])];
      const block = element('div', label, kinds.join(' '));
      block.setAttribute('role', 'listitem');
      const hints: string[] = [];
      if (each === step) {
        block.setAttribute('aria-current', 'step');
        hints.push(busy ? 'The step to run next; a chain is running for this mission' : 'The step to run next');
      }
      if (optional) {
        hints.push('An optional step');
      }
      if (hints.length > 0) {
        block.title = hints.join('. ');
      }
      flow.append(block);
    });
    section.append(flow);
    diagram = { section, flow };
    return section;
  }

  /**
   * Lays the drawn workflow diagram out to the pane's width: one horizontal row, centered, while
   * that row fits the diagram's width, and otherwise the `vertical` class, under which the pane's
   * stylesheet stacks the same blocks in a centered column joined by downward arrows. The row is
   * measured with the class taken off every time, so the diagram switches back to the row once the
   * pane is wide enough again; the measurement and the switch both land before the page is painted.
   */
  function fitWorkflow(): void {
    if (diagram === undefined) {
      return;
    }
    const { section, flow } = diagram;
    section.classList.remove('vertical');
    const overflows = flow.getBoundingClientRect().width > section.getBoundingClientRect().width;
    section.classList.toggle('vertical', overflows);
  }

  /**
   * One question's card, fully opened: flat, non-indented slots stacked as the Short Title with
   * the card's buttons, the question text in its area of fixed height, the pick and its rationale,
   * the alternatives, the dependencies, and the principles.
   */
  function drawCard(mission: Mission, question: Question, questions: Question[], busy: boolean): HTMLElement {
    const body = element('article', undefined, 'card');
    body.setAttribute('aria-label', question.id);

    const head = element('div', undefined, 'card-head');
    const title = element('h4', question.id, 'short-title');
    title.title = question.id;
    const actions = element('div', undefined, 'card-actions');
    for (const [kind, label, hover] of QUESTION_BUTTONS) {
      const run = action(label, 'action', busy, () =>
        vscode.postMessage({ type: 'questionButton', button: kind, mission: mission.path, question: question.id }),
      );
      run.title = hover;
      actions.append(run);
    }
    head.append(title, actions);
    body.append(head);

    body.append(element('p', question.question, 'slot question-text'));

    const pick = question.recommendation;
    const box = element('div', undefined, 'slot pick');
    if (pick !== undefined) {
      const named = question.alternatives.some((alternative) => alternative.id === pick.option);
      box.append(element('h5', named ? `Pick: ${pick.option}` : `Pick: ${pick.option} (names no alternative of this question)`));
      box.append(element('p', pick.rationale));
    } else {
      box.append(element('h5', 'No pick yet'));
    }
    body.append(box);

    if (question.alternatives.length > 0) {
      const part = element('div', undefined, 'slot');
      part.append(element('h5', 'Alternatives'));
      for (const alternative of question.alternatives) {
        const picked = pick !== undefined && alternative.id === pick.option;
        const entry = element('div', undefined, picked ? 'alternative picked' : 'alternative');
        const line = element('div', undefined, 'alternative-head');
        line.append(element('h6', picked ? `${alternative.id} (picked)` : alternative.id));
        const answer = action('Answer with this alternative', 'action', busy, () =>
          vscode.postMessage({ type: 'alternativeButton', mission: mission.path, question: question.id, alternative: alternative.id }),
        );
        answer.title = `Record ${alternative.id} as the decision`;
        line.append(answer);
        entry.append(line);
        if (alternative.text !== '') {
          entry.append(element('p', alternative.text));
        }
        const points = element('ul');
        for (const advantage of alternative.advantages) {
          points.append(element('li', `Advantage: ${advantage}`, 'advantage'));
        }
        for (const drawback of alternative.drawbacks) {
          points.append(element('li', `Drawback: ${drawback}`, 'drawback'));
        }
        if (points.childElementCount > 0) {
          entry.append(points);
        }
        part.append(entry);
      }
      body.append(part);
    }

    if (question.dependsOn.length > 0) {
      const siblings = new Set(questions.map((each) => each.id));
      const part = element('div', undefined, 'slot');
      part.append(element('h5', 'Depends on'));
      const list = element('ul');
      for (const dependency of question.dependsOn) {
        const item = element('li');
        if (siblings.has(dependency.question)) {
          item.append(button(dependency.question, 'link', () => follow(mission.path, questions, dependency.question)));
        } else {
          item.append(element('span', dependency.question));
        }
        item.append(document.createTextNode(` assuming ${dependency.option}`));
        list.append(item);
      }
      part.append(list);
      body.append(part);
    }

    if (question.principles.length > 0) {
      const part = element('div', undefined, 'slot');
      part.append(element('h5', 'Principles applied'));
      const list = element('ul');
      for (const principle of question.principles) {
        list.append(element('li', principle));
      }
      part.append(list);
      body.append(part);
    }
    return body;
  }

  /** The Open questions pane: the position counter and its previous and next buttons above the one card shown. */
  function drawQuestions(mission: Mission, busy: boolean): HTMLElement {
    const view = element('section', undefined, 'pane questions');
    view.setAttribute('role', 'tabpanel');
    view.setAttribute('aria-label', 'Open questions');
    const part = mission.questions;
    if (part.state === 'failed') {
      view.append(drawNotice(part.notice));
      return view;
    }
    const questions = part.questions;
    if (questions.length === 0) {
      view.append(element('p', 'No open question.'));
      return view;
    }
    const index = shownIndex(mission.path, questions);
    const position = positions.get(mission.path);
    if (position === undefined || position.title !== questions[index].id || position.index !== index) {
      positions.set(mission.path, { title: questions[index].id, index });
      save();
    }
    const pager = element('div', undefined, 'pager');
    const previous = button('Previous', 'control', () => moveTo(mission.path, questions, index - 1));
    previous.title = 'Show the previous question (Left Arrow)';
    previous.disabled = index === 0;
    previous.dataset.focus = 'previous';
    const next = button('Next', 'control', () => moveTo(mission.path, questions, index + 1));
    next.title = 'Show the next question (Right Arrow)';
    next.disabled = index === questions.length - 1;
    next.dataset.focus = 'next';
    const counter = element('span', `${index + 1} / ${questions.length}`, 'counter');
    counter.setAttribute('aria-live', 'polite');
    pager.append(previous, counter, next);
    card = drawCard(mission, questions[index], questions, busy);
    view.append(pager, card);
    return view;
  }

  /** The Remaining tasks pane: the New task button above the remaining task headings. */
  function drawTasks(mission: Mission, busy: boolean): HTMLElement {
    const view = element('section', undefined, 'pane tasks');
    view.setAttribute('role', 'tabpanel');
    view.setAttribute('aria-label', 'Remaining tasks');
    const head = element('div', undefined, 'controls');
    const add = action('New task', 'action', busy, () => vscode.postMessage({ type: 'taskButton', mission: mission.path }));
    add.title = 'Type an issue and open an interactive discussion of it into tasks for this mission';
    head.append(add);
    view.append(head);
    const part = mission.tasks;
    if (part.state === 'failed') {
      view.append(drawNotice(part.notice));
    } else if (part.headings.length === 0) {
      view.append(element('p', 'No task remains.'));
    } else {
      const list = element('ol');
      for (const heading of part.headings) {
        list.append(element('li', heading));
      }
      view.append(list);
    }
    return view;
  }

  /** The recipe buttons of the mission's page, drawn from the recipe list posted with the mission. */
  function drawRecipes(mission: Mission, busy: boolean): HTMLElement {
    const view = element('section', undefined, 'recipes');
    view.append(element('h3', 'Recipes'));
    const recipes = mission.recipes;
    if (recipes.state === 'failed') {
      const box = element('div', undefined, 'notice');
      box.setAttribute('role', 'alert');
      box.append(element('p', RECIPE_FAILURE_LINE), element('pre', recipes.cause));
      view.append(box);
      return view;
    }
    const shipped = recipes.recipes.filter((recipe) => recipe.group !== 'own');
    const own = recipes.recipes.filter((recipe) => recipe.group === 'own');
    if (shipped.length > 0) {
      view.append(recipeList(mission, shipped, busy));
    }
    if (own.length > 0) {
      view.append(element('h4', OWN_GROUP_HEADING), recipeList(mission, own, busy));
    }
    return view;
  }

  /**
   * The values a recipe button shows beside its name: the variant's distinct harnesses, models, and
   * efforts, each list joined in its order, the lists that hold a value joined in turn, and nothing
   * for a variant none of whose lines is readable.
   */
  function valuesLabel(values: VariantValues): string {
    return [values.harnesses, values.models, values.efforts]
      .filter((list) => list.length > 0)
      .map((list) => list.join(', '))
      .join(VALUES_SEPARATOR);
  }

  /**
   * A recipe's button: its name, then the values its variant's lines carry, when any is readable,
   * with the variant's lines as written in its hover text.
   */
  function recipeButton(recipe: Extract<PageRecipe, { kind: 'runnable' | 'looped' }>, busy: boolean, onClick: () => void): HTMLButtonElement {
    const node = action('', 'recipe', busy, onClick);
    node.append(element('span', recipe.name, 'recipe-name'));
    const label = valuesLabel(recipe.values);
    if (label !== '') {
      node.append(element('span', label, 'recipe-values'));
    }
    node.title = recipe.lines.join('\n');
    return node;
  }

  /**
   * The dropdown beside a recipe's entry: one option per variant offered, in order, a variant of the
   * person's own marked as theirs, standing on the selected one. Picking another posts it to the
   * extension, which remembers it for the recipe on this mission and posts the page again.
   */
  function variantDropdown(mission: Mission, recipe: PageRecipe): HTMLSelectElement {
    const choice = element('select', undefined, 'recipe-variant');
    choice.setAttribute('aria-label', `The variant of ${recipe.name}`);
    choice.dataset.focus = `variant-${recipe.name}`;
    recipe.variants.forEach((variant, index) => {
      const option = element('option', variant.own ? `${variant.name}${OWN_VARIANT_MARK}` : variant.name);
      option.value = String(index);
      option.selected = index === recipe.selected;
      choice.append(option);
    });
    choice.addEventListener('change', () => {
      const variant = recipe.variants[Number(choice.value)];
      if (variant !== undefined) {
        vscode.postMessage({ type: 'selectVariant', mission: mission.path, recipe: recipe.name, variant: variant.name });
      }
    });
    return choice;
  }

  /** One run of a mission page's recipe entries, in the order given, each with its variant dropdown beside it. */
  function recipeList(mission: Mission, entries: PageRecipe[], busy: boolean): HTMLElement {
    const list = element('div', undefined, 'recipe-list');
    for (const recipe of entries) {
      const variant = recipe.variants[recipe.selected]?.name;
      const item = element('span', undefined, 'recipe-entry');
      if (recipe.kind === 'runnable') {
        item.append(
          recipeButton(recipe, busy, () => vscode.postMessage({ type: 'runRecipe', mission: mission.path, recipe: recipe.name, variant })),
        );
      } else if (recipe.kind === 'looped') {
        item.append(
          recipeButton(recipe, busy, () => vscode.postMessage({ type: 'previewLoop', mission: mission.path, recipe: recipe.name, variant })),
        );
      } else {
        const named = recipe.placeholders.map((placeholder) => `<${placeholder}>`).join(', ');
        const entry = element('span', `${recipe.name}: ${recipe.placeholders.length === 1 ? 'unknown placeholder' : 'unknown placeholders'} ${named} in ${recipe.file}`, 'recipe-unknown');
        entry.title = recipe.lines.join('\n');
        item.append(entry);
      }
      item.append(variantDropdown(mission, recipe));
      list.append(item);
    }
    return list;
  }

  /** What the rules give a task, as the preview printed it. */
  function rulesResult(task: PreviewTask): string {
    if (task.state === 'resolved') {
      return task.name;
    }
    if (task.name !== '') {
      return `Unresolved: the rules name "${task.name}", which no single-task line carries`;
    }
    return 'Unresolved: no rule gives this task a line';
  }

  function drawPreview(mission: Mission, preview: Preview, busy: boolean): HTMLElement {
    const view = element('section', undefined, 'preview');
    view.append(element('h3', `Preview: ${preview.recipe}`));
    const close = button('Close preview', 'control', () => {
      previews.delete(mission.path);
      draw();
    });
    const result = preview.result;
    if (result.state === 'failed') {
      const box = element('div', undefined, 'notice');
      box.setAttribute('role', 'alert');
      box.append(element('p', PREVIEW_FAILURE_LINE), element('pre', result.cause));
      const controls = element('div', undefined, 'controls');
      controls.append(close);
      view.append(box, controls);
      return view;
    }
    if (result.notice !== undefined) {
      const box = element('div', undefined, 'notice');
      box.setAttribute('role', 'alert');
      box.append(element('pre', result.notice));
      view.append(box);
    }
    let unresolved = 0;
    if (result.tasks.length === 0) {
      view.append(element('p', 'No task remains.'));
    } else {
      const table = element('table', undefined, 'preview-tasks');
      const head = element('tr');
      head.append(element('th', 'Task'), element('th', 'The rules give'), element('th', 'Line to run'));
      table.append(head);
      for (const task of result.tasks) {
        const picked = preview.overrides.get(task.title);
        if (picked === undefined && task.state !== 'resolved') {
          unresolved += 1;
        }
        const row = element('tr', undefined, picked === undefined && task.state !== 'resolved' ? 'unresolved' : undefined);
        const choice = element('select');
        choice.setAttribute('aria-label', `The line to run for ${task.title}`);
        const ruled = element('option', task.state === 'resolved' ? `As the rules give: ${task.name}` : 'Unresolved: the run stops here');
        ruled.value = '';
        choice.append(ruled);
        for (const name of preview.names) {
          const option = element('option', name);
          option.value = name;
          option.selected = name === picked;
          choice.append(option);
        }
        choice.addEventListener('change', () => {
          if (choice.value === '') {
            preview.overrides.delete(task.title);
          } else {
            preview.overrides.set(task.title, choice.value);
          }
          draw();
        });
        const cell = element('td');
        cell.append(choice);
        row.append(element('td', task.title), element('td', rulesResult(task)), cell);
        table.append(row);
      }
      view.append(table);
    }
    if (unresolved > 0) {
      view.append(
        element(
          'p',
          unresolved === 1
            ? '1 task is unresolved: the run stops before it, without running it.'
            : `${unresolved} tasks are unresolved: the run stops before the first of them, without running it.`,
        ),
      );
    }
    const controls = element('div', undefined, 'controls');
    const start = action('Start run', 'recipe', busy, () =>
      vscode.postMessage({
        type: 'startLoop',
        mission: mission.path,
        recipe: preview.recipe,
        overrides: Object.fromEntries(preview.overrides),
      }),
    );
    start.title = preview.lines.join('\n');
    controls.append(start, close);
    view.append(controls);
    return view;
  }

  /**
   * The two panes: one row of two headers of equal width, Open questions and Remaining tasks, and
   * beneath it the selected pane's content alone. The headers stay enabled while a chain runs.
   */
  function drawPanes(mission: Mission, busy: boolean): HTMLElement {
    const panes = element('section', undefined, 'panes');
    const shown = shownPane(mission);
    const headers = element('div', undefined, 'pane-tabs');
    headers.setAttribute('role', 'tablist');
    headers.setAttribute('aria-label', 'Mission documents');
    for (const [pane, header] of PANES) {
      const tab = button(header, 'pane-tab', () => pick(mission.path, pane));
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(pane === shown));
      tab.dataset.focus = `pane-${pane}`;
      headers.append(tab);
    }
    panes.append(headers, shown === 'tasks' ? drawTasks(mission, busy) : drawQuestions(mission, busy));
    return panes;
  }

  function drawPage(mission: Mission): HTMLElement {
    const page = element('section', undefined, 'page');
    page.setAttribute('role', 'tabpanel');
    const busy = running.has(mission.path);
    page.append(drawWorkflow(mission.step, mission.additionalRounds, busy), drawRecipes(mission, busy));
    const preview = previews.get(mission.path);
    if (preview !== undefined) {
      page.append(drawPreview(mission, preview, busy));
    }
    page.append(drawPanes(mission, busy));
    return page;
  }

  /**
   * Redraws the whole pane in place from the latest parse, laying the workflow diagram out to the
   * pane's width and keeping the scroll position and the focus on the previous or next button or
   * a pane header when it held it. The pane header clicked gives way to the default once the
   * mission shown is no longer the one it was clicked on.
   */
  function draw(): void {
    const scrolled = window.scrollY;
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.focus : undefined;
    if (!missions.some((mission) => mission.path === selected)) {
      selected = missions[0]?.path;
    }
    if (picked !== undefined && picked.mission !== selected) {
      picked = undefined;
    }
    card = undefined;
    diagram = undefined;
    const shown = missions.find((mission) => mission.path === selected);
    root.replaceChildren(drawTabs());
    if (settingsShown) {
      root.append(drawSettings());
    } else {
      root.append(shown === undefined ? element('p', NO_MISSION_LINE) : drawPage(shown));
    }
    fitWorkflow();
    window.scrollTo(0, scrolled);
    if (focused !== undefined) {
      const again = root.querySelector<HTMLButtonElement>(`[data-focus="${focused}"]`);
      if (again !== null && !again.disabled) {
        again.focus();
      }
    }
  }

  /** Draws the failure state beneath the row of the controls belonging to no mission, or the settings view while it is shown. */
  function drawFailure(cause: string): void {
    failureCause = cause;
    diagram = undefined;
    card = undefined;
    const tabs = element('div', undefined, 'tabs');
    tabs.append(drawStarting());
    if (settingsShown) {
      root.replaceChildren(tabs, drawSettings());
      return;
    }
    const failure = element('section', undefined, 'failure');
    failure.append(element('p', FAILURE_LINE), element('pre', cause));
    root.replaceChildren(tabs, failure);
  }

  window.addEventListener('message', (event: MessageEvent<PaneMessage>) => {
    const message = event.data;
    if (message.type === 'live') {
      missions = message.missions;
      running = new Set(message.running ?? []);
      drawn = 'live';
      for (const mission of [...previews.keys()]) {
        if (!missions.some((each) => each.path === mission)) {
          previews.delete(mission);
        }
      }
      draw();
    } else if (message.type === 'liveFailure') {
      drawn = 'failure';
      picked = undefined;
      drawFailure(message.cause);
    } else if (message.type === 'running') {
      running = new Set(message.missions);
      if (drawn === 'live') {
        draw();
      }
    } else if (message.type === 'preview') {
      previews.set(message.mission, {
        recipe: message.recipe,
        lines: message.lines,
        names: message.names,
        result: message.result,
        overrides: new Map(),
      });
      if (missions.some((mission) => mission.path === message.mission)) {
        selected = message.mission;
        save();
      }
      draw();
    } else if (message.type === 'loopStarted') {
      previews.delete(message.mission);
      draw();
    } else if (message.type === 'harnessCheck') {
      harnessCheck = message.check;
      if (settingsShown) {
        if (drawn === 'failure') {
          drawFailure(failureCause);
        } else {
          draw();
        }
      }
    }
  });

  /** The left and right arrow keys move the shown page's question view while its pane is shown, except while typing or choosing. */
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName))) {
      return;
    }
    if (shownQuestions() === undefined) {
      return;
    }
    event.preventDefault();
    step(event.key === 'ArrowLeft' ? -1 : 1);
  });

  /** Every change of the pane's width lays the workflow diagram out again, as a row or as a stack. */
  window.addEventListener('resize', fitWorkflow);

  vscode.postMessage({ type: 'ready' });
})();
