// A mission window's page script. On every load it posts a ready message and draws what the
// extension answers for the window's one mission: that mission's page, with no tab row, no refresh
// control, and no mission-starting button, those belonging to the side-bar view; or, in place of the
// whole page while the live missions cannot be read, the one failure state, the failure line with
// the cause beneath it; or, while the live read does not list the window's mission, one fixed
// notice that the mission is no longer live, drawing no diagram, recipe, pane, or action button. A
// later answer that carries the mission's page draws it again. A page opens on the workflow diagram, drawn by this script
// with no Mermaid: the choices a person makes as one line of seven neutral blocks joined by arrows,
// define, first review round, additional review round, derive tasks, execute tasks, follow up
// tasks, and finish, with no frame, loop arrow, or handoff label, the two optional blocks,
// additional review round and follow up tasks, drawn with a dashed border and the five required
// ones solid. The diagram is centered horizontally in the window and lies in one horizontal row while
// that row fits the window's width; when the row would overflow, the same blocks stack vertically,
// joined by downward arrows and likewise centered, their borders, fill, and pulse unchanged. The
// row is measured afresh on every redraw and every change of the window's width, so the diagram
// switches back to the row once the window is wide enough again, and it never wraps or scrolls
// sideways. The additional review round reads plain while git holds at most one review commit for
// the mission and then carries the count of those beyond the first, as the extension posts it,
// such as "additional review round 2". The block of the step to run next, which the extension
// chooses and posts, is filled purple, and no block is filled when the extension chose none; the
// diagram is display only, its blocks no buttons, gating nothing. Below
// it stand the recipe buttons, then the new-task button, posting the page's mission, in a row of
// its own drawn on every mission page whichever pane is shown and at every step, and then two
// panes behind one row of two headers directly beneath it, Open questions and Remaining tasks, of
// equal width and together filling the window's whole width, with only the selected pane's content
// beneath them: the question view in Open questions, and in Remaining tasks the remaining task
// headings, all drawn from the parse the extension posts. A page opens on the pane the extension posts as the
// mission's default, Remaining tasks when git holds at least one review commit for it and no
// question is open and Open questions otherwise, Open questions too when none is posted. A pane
// header the person clicks stays selected through every redraw while the page stays shown; it
// is held in this script's memory only, never saved with `setState`, so the failure state, the
// no-longer-live notice, and every load of the page, a reopening or a hidden window shown again,
// open on the default afresh. The recipe buttons: the recipe list the extension posts with the page's mission,
// holding only the recipes that fit the step its diagram fills, those declaring that step, beside
// them those declaring the additional review round when derive tasks is filled, or when first
// review round is while any question of the mission is open, and follow up tasks when finish is, and every recipe declaring no step, whichever block is filled, or every recipe
// when no block is filled; first the shipped recipes in
// it, one button each in the order posted, the shipped file's, under no heading of their own, and
// below them the own recipes that carry no shipped recipe's name under "Your recipes", in the own
// file's order, each with a dropdown beside it drawn as its arrow alone, its opened list offering
// the recipe's variants by their bare names, and standing on the variant selected, as the
// extension posts it: the one remembered for the recipe on this mission, else the recipe's
// default. Picking another variant posts it to the extension, which remembers it and posts the
// page again with it selected. Each button shows its recipe's name with the selected variant's
// name beneath it, exactly as the variant is named, carries that variant's lines as written in its
// hover text, and starts that variant's chain for the page's mission when clicked, and a selected
// variant holding a placeholder the extension does not know is shown as a non-runnable entry
// naming it and its file. The five buttons on a mission's page outside the recipe list, which run a
// recipe by its fixed name, take the recipe list's pick mechanics, as the extension posts them with
// the mission: a dropdown beside each, drawn as its arrow alone, offers the variants the
// button can run by their bare names and stands on the one selected, the one remembered for the
// recipe on the mission, else the recipe's default. Each answer-with-alternative button on a
// question card has a dropdown of its own beside it, standing on the variant remembered for that
// alternative of that question on the mission, else the default, so a pick on one alternative
// leaves every other button where it stood; picking another posts it with the button and its
// mission, or with the mission, the Short Title, and the Alternative Id for an
// answer-with-alternative button, to the extension, which remembers it and posts the page again.
// Each button shows its name with the selected variant's
// name beneath it, with that variant's lines as written in its hover text, its click posting that
// variant's name; a button the extension posts with no variant, every one it could run having a
// line on a disabled harness, stays drawn but disabled, with no dropdown, and one posted with
// nothing, its recipe not read or not one it can run, shows its name alone with a hover text
// saying what it does.
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
// posts redraws the card in place and the view keeps its position: the page keeps its mission's
// position, the Short Title shown and its place in the list, saved with `setState` on every move
// and read back with `getState` when the page is re-created, and when a run removes the question
// shown the view stays at the same place in the list, clamped to its last card. A part drawn from
// a file that did not read is replaced by that file's notice alone. While a chain started for the
// mission is running, as the extension posts when a run starts, when its terminal closes, and with
// every redraw, the page draws every action button on it disabled, its recipe buttons,
// its question card's buttons, its preview's start button, and its New task button, and its
// workflow diagram's filled block pulses; the recipe dropdowns and the fixed-name buttons' dropdowns, the question view's
// previous and next buttons and dependency links, the preview's close button, and the two pane
// headers stay enabled, and the left and right arrow keys move the question view only while its
// pane is shown. The page draws no Settings control and nothing from the harness check: the
// settings live in the Settings window of their own, drawn by its own script (`settings.ts`), and a
// disabled harness reaches the page only as the recipe lists and fixed-name buttons the extension
// posts without its variants.
// Every value is drawn as text, never as markup, since it comes from the workspace.

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
    /** What the fixed-name buttons on its page run, which their dropdowns, labels, and hover text show. */
    buttons?: FixedButtons;
    /** What each alternative's answer-with-alternative button on its question cards runs, each with a dropdown of its own. */
    alternativeButtons?: AlternativeButtonEntry[];
  }

  type RecipeGroup = 'shipped' | 'own';

  /** One variant a recipe's dropdown offers, by its name, the one part of what the extension posts for it the page draws. */
  interface PageVariantChoice {
    name: string;
  }

  /** The dropdown beside a recipe: the variants it offers and the index of the selected one, which the entry describes. */
  interface PageChoices {
    variants: PageVariantChoice[];
    selected: number;
  }

  type PageRecipe = PageChoices &
    (
      | { kind: 'runnable'; name: string; group: RecipeGroup; lines: string[] }
      | { kind: 'looped'; name: string; group: RecipeGroup; lines: string[] }
      | { kind: 'unknown'; name: string; group: RecipeGroup; lines: string[]; placeholders: string[]; file: string }
    );

  type RecipePart = { state: 'read'; recipes: PageRecipe[] } | { state: 'failed'; cause: string };

  /** One of the five buttons on a mission's page outside the recipe list, each running the recipe of its fixed name. */
  type FixedButton = 'discussQuestion' | 'answerQuestion' | 'answerWithRecommendation' | 'answerWithAlternative' | 'discussTask';

  /**
   * What a fixed-name button runs, as the extension posts it: the variants its dropdown offers and
   * the one selected, with that variant's lines; or no variant, every one it could
   * run having a line on a disabled harness, the button drawn disabled.
   */
  type FixedButtonEntry =
    | { state: 'offered'; lines: string[]; variants: PageVariantChoice[]; selected: number }
    | { state: 'disabled'; cause: string };

  /** What each fixed-name button runs, by the button; a button whose recipe cannot be read or run is left out. */
  type FixedButtons = Partial<Record<FixedButton, FixedButtonEntry>>;

  /** What the answer-with-alternative button of one alternative of a question runs, by the question's Short Title and the Alternative Id. */
  interface AlternativeButtonEntry {
    question: string;
    alternative: string;
    entry: FixedButtonEntry;
  }

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

  type WindowMessage =
    | { type: 'page'; mission: Mission; running: string[] }
    | { type: 'liveFailure'; cause: string }
    | { type: 'notLive'; path: string }
    | { type: 'running'; missions: string[] }
    | { type: 'preview'; mission: string; recipe: string; lines: string[]; names: string[]; result: PreviewRead }
    | { type: 'loopStarted'; mission: string };

  /** Where a mission's question view stands: the Short Title shown and its place in the list. */
  interface Position {
    title: string;
    index: number;
  }

  interface PageState {
    /** The position of the mission's question view, keyed by mission path. */
    positions?: Record<string, Position>;
  }

  const FAILURE_LINE = 'The live missions could not be read.';
  const NOT_LIVE_LINE = 'This mission is no longer live.';
  const RECIPE_FAILURE_LINE = 'The recipes could not be read.';
  const PREVIEW_FAILURE_LINE = 'The preview could not be run.';
  /** The buttons on a question's card, each with its label and the hover text it shows while its recipe cannot be read. */
  const QUESTION_BUTTONS: [FixedButton, string, string][] = [
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

  const vscode = acquireVsCodeApi();
  const root = document.getElementById('root') as HTMLElement;
  const saved = (vscode.getState() ?? {}) as PageState;
  const positions = new Map<string, Position>(Object.entries(saved.positions ?? {}));
  /** The window's mission as the extension last posted its page. */
  let shownMission: Mission | undefined;
  /** The paths of the missions with a running runner; the page is drawn as running while its mission's is among them. */
  let running = new Set<string>();
  /** What the window last drew from the extension's answer: nothing yet, its mission's page, the failure state, or the no-longer-live notice. */
  let drawn: 'nothing' | 'page' | 'failure' | 'notLive' = 'nothing';
  /** The mission's preview, by its path, while it stands on the page. */
  const previews = new Map<string, Preview>();
  /** The card drawn on the page, so a dependency link can scroll to the card it jumped to. */
  let card: HTMLElement | undefined;
  /** The workflow diagram drawn on the page and its line of blocks, so it can be laid out again whenever the window's width changes. */
  let diagram: { section: HTMLElement; flow: HTMLElement } | undefined;
  /**
   * The pane header the person clicked and the mission it was clicked on, held while the page stays
   * shown and never saved, so the failure state, the notice, or a fresh page opens on the default.
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

  /**
   * A fixed-name button, in the form the recipe list's buttons take: its name, then the name of the
   * variant selected in its dropdown, as the extension posts `entry`, exactly as the variant is
   * named, with that variant's lines as written in its hover text; its name alone with `hover` as its
   * hover text when nothing is posted, its recipe not read or not one it can run; and its name
   * alone, drawn disabled, with the cause beneath `hover` in its hover text, when it offers no
   * variant, every one it could run having a line on a disabled harness. A click hands `onClick`
   * the selected variant's name, none while nothing is posted. Drawn disabled while `busy` too,
   * when given.
   */
  function fixedButton(
    entry: FixedButtonEntry | undefined,
    label: string,
    hover: string,
    className: string,
    busy: boolean | undefined,
    onClick: (variant: string | undefined) => void,
  ): HTMLButtonElement {
    const variant = entry?.state === 'offered' ? entry.variants[entry.selected]?.name : undefined;
    const node = busy === undefined ? button('', className, () => onClick(variant)) : action('', className, busy, () => onClick(variant));
    node.append(element('span', label, 'recipe-name'));
    if (entry?.state === 'offered') {
      if (variant !== undefined) {
        node.append(element('span', variant, 'recipe-variant-name'));
      }
      node.title = entry.lines.join('\n');
    } else if (entry?.state === 'disabled') {
      node.disabled = true;
      node.title = `${hover}\n${entry.cause}`;
    } else {
      node.title = hover;
    }
    return node;
  }

  /**
   * The dropdown beside a fixed-name button, drawn as its arrow alone: one option per variant
   * `entry` offers, in order, by its bare name, standing on the selected one, and none while the
   * button offers no variant or nothing is posted for it. `focus` is its focus key, and picking
   * another option hands `onPick` the variant's name.
   */
  function buttonDropdown(entry: FixedButtonEntry | undefined, label: string, focus: string, onPick: (variant: string) => void): HTMLSelectElement | undefined {
    if (entry?.state !== 'offered') {
      return undefined;
    }
    const choice = variantSelect(`The variant of ${label}`);
    choice.dataset.focus = focus;
    variantOptions(choice, entry.variants, entry.selected);
    choice.addEventListener('change', () => {
      const variant = entry.variants[Number(choice.value)];
      if (variant !== undefined) {
        onPick(variant.name);
      }
    });
    return choice;
  }

  /**
   * The dropdown beside a fixed-name button, as `buttonDropdown` draws it. Picking another posts it
   * to the extension with the button and, for a button on a mission's page, its mission, and the
   * extension remembers it and posts the page again.
   */
  function fixedDropdown(key: FixedButton, entry: FixedButtonEntry | undefined, label: string, mission?: string): HTMLSelectElement | undefined {
    return buttonDropdown(entry, label, `button-variant-${key}`, (variant) =>
      vscode.postMessage({ type: 'selectButtonVariant', button: key, mission, variant }),
    );
  }

  /** A fixed-name button with its dropdown beside it, as `fixedButton` and `fixedDropdown` draw them. */
  function fixedEntry(
    key: FixedButton,
    entry: FixedButtonEntry | undefined,
    label: string,
    hover: string,
    className: string,
    busy: boolean | undefined,
    mission: string | undefined,
    onClick: (variant: string | undefined) => void,
  ): HTMLElement {
    return buttonEntry(fixedButton(entry, label, hover, className, busy, onClick), fixedDropdown(key, entry, label, mission));
  }

  /** A button with the dropdown beside it, when one is drawn, in one entry. */
  function buttonEntry(node: HTMLButtonElement, dropdown: HTMLSelectElement | undefined): HTMLElement {
    const item = element('span', undefined, 'recipe-entry');
    item.append(node);
    if (dropdown !== undefined) {
      item.append(dropdown);
    }
    return item;
  }

  /**
   * The answer-with-alternative button of the alternative `alternative` on the card of the
   * question `question`, with its own dropdown beside it, as the extension posts that
   * alternative's entry: the button shows and runs the variant its own dropdown stands on, and a
   * pick posts the mission, the Short Title, the Alternative Id, and the variant, so the extension
   * remembers it for that alternative alone. `index` is the alternative's place on the card, which
   * keys the dropdown's focus.
   */
  function alternativeEntry(mission: Mission, question: Question, alternative: Alternative, index: number, busy: boolean): HTMLElement {
    const entry = mission.alternativeButtons?.find((each) => each.question === question.id && each.alternative === alternative.id)?.entry;
    const label = 'Answer with this alternative';
    const node = fixedButton(entry, label, `Record ${alternative.id} as the decision`, 'action', busy, (variant) =>
      vscode.postMessage({ type: 'alternativeButton', mission: mission.path, question: question.id, alternative: alternative.id, variant }),
    );
    const dropdown = buttonDropdown(entry, label, `alternative-variant-${index}`, (variant) =>
      vscode.postMessage({ type: 'selectAlternativeVariant', mission: mission.path, question: question.id, alternative: alternative.id, variant }),
    );
    return buttonEntry(node, dropdown);
  }

  function save(): void {
    const state: PageState = { positions: Object.fromEntries(positions) };
    vscode.setState(state);
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

  /** Shows the pane clicked on the mission's page, held while the page stays shown. */
  function pick(mission: string, pane: MissionPane): void {
    picked = { mission, pane };
    draw();
  }

  /** The questions of the page shown, when its Open questions pane is shown and its question view reads and holds any. */
  function shownQuestions(): { mission: string; questions: Question[] } | undefined {
    const mission = drawn === 'page' ? shownMission : undefined;
    if (
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
   * the page is laid out, when the row would overflow the window.
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
   * Lays the drawn workflow diagram out to the window's width: one horizontal row, centered, while
   * that row fits the diagram's width, and otherwise the `vertical` class, under which the page's
   * stylesheet stacks the same blocks in a centered column joined by downward arrows. The row is
   * measured with the class taken off every time, so the diagram switches back to the row once the
   * window is wide enough again; the measurement and the switch both land before the page is painted.
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
      actions.append(
        fixedEntry(kind, mission.buttons?.[kind], label, hover, 'action', busy, mission.path, (variant) =>
          vscode.postMessage({ type: 'questionButton', button: kind, mission: mission.path, question: question.id, variant }),
        ),
      );
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
      for (const [index, alternative] of question.alternatives.entries()) {
        const picked = pick !== undefined && alternative.id === pick.option;
        const entry = element('div', undefined, picked ? 'alternative picked' : 'alternative');
        const line = element('div', undefined, 'alternative-head');
        line.append(element('h6', picked ? `${alternative.id} (picked)` : alternative.id));
        line.append(alternativeEntry(mission, question, alternative, index, busy));
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

  /** The New task button's row of its own, drawn above the pane headers whichever pane is shown. */
  function drawNewTask(mission: Mission, busy: boolean): HTMLElement {
    const row = element('div', undefined, 'controls new-task');
    row.append(
      fixedEntry(
        'discussTask',
        mission.buttons?.discussTask,
        'New task',
        'Type an issue and open an interactive discussion of it into tasks for this mission',
        'action',
        busy,
        mission.path,
        (variant) => vscode.postMessage({ type: 'taskButton', mission: mission.path, variant }),
      ),
    );
    return row;
  }

  /** The Remaining tasks pane: the remaining task headings. */
  function drawTasks(mission: Mission): HTMLElement {
    const view = element('section', undefined, 'pane tasks');
    view.setAttribute('role', 'tabpanel');
    view.setAttribute('aria-label', 'Remaining tasks');
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
   * A recipe's button: its name, then the selected variant's name, exactly as the variant is named,
   * with the variant's lines as written in its hover text.
   */
  function recipeButton(recipe: Extract<PageRecipe, { kind: 'runnable' | 'looped' }>, busy: boolean, onClick: () => void): HTMLButtonElement {
    const node = action('', 'recipe', busy, onClick);
    node.append(element('span', recipe.name, 'recipe-name'));
    const variant = recipe.variants[recipe.selected]?.name;
    if (variant !== undefined) {
      node.append(element('span', variant, 'recipe-variant-name'));
    }
    node.title = recipe.lines.join('\n');
    return node;
  }

  /**
   * The dropdown beside a recipe's entry, drawn as its arrow alone: one option per variant offered,
   * in order, by its bare name, standing on the selected one. Picking another posts it to the
   * extension, which remembers it for the recipe on this mission and posts the page again.
   */
  function variantDropdown(mission: Mission, recipe: PageRecipe): HTMLSelectElement {
    const choice = variantSelect(`The variant of ${recipe.name}`);
    choice.dataset.focus = `variant-${recipe.name}`;
    variantOptions(choice, recipe.variants, recipe.selected);
    choice.addEventListener('change', () => {
      const variant = recipe.variants[Number(choice.value)];
      if (variant !== undefined) {
        vscode.postMessage({ type: 'selectVariant', mission: mission.path, recipe: recipe.name, variant: variant.name });
      }
    });
    return choice;
  }

  /**
   * A variant dropdown, drawn by the stylesheet as its arrow alone, its selected variant's name kept
   * out of sight since the button beside it shows it; `label` names it for a screen reader and in
   * its hover text.
   */
  function variantSelect(label: string): HTMLSelectElement {
    const choice = element('select', undefined, 'recipe-variant');
    choice.setAttribute('aria-label', label);
    choice.title = label;
    return choice;
  }

  /** Appends to `choice` one option per variant of `variants`, in order, each by its bare name, the one at `selected` selected. */
  function variantOptions(choice: HTMLSelectElement, variants: PageVariantChoice[], selected: number): void {
    variants.forEach((variant, index) => {
      const option = element('option', variant.name);
      option.value = String(index);
      option.selected = index === selected;
      choice.append(option);
    });
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
   * The two panes: the New task button's row, then one row of two headers of equal width, Open
   * questions and Remaining tasks, directly beneath it, and beneath them the selected pane's
   * content alone. The headers stay enabled while a chain runs.
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
    panes.append(drawNewTask(mission, busy), headers, shown === 'tasks' ? drawTasks(mission) : drawQuestions(mission, busy));
    return panes;
  }

  function drawPage(mission: Mission): HTMLElement {
    const page = element('section', undefined, 'page');
    page.setAttribute('aria-label', mission.title);
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
   * Redraws the window's page in place from the latest parse of its mission, laying the workflow
   * diagram out to the window's width and keeping the scroll position and the focus on the previous
   * or next button or a pane header when it held it.
   */
  function draw(): void {
    if (drawn !== 'page' || shownMission === undefined) {
      return;
    }
    const scrolled = window.scrollY;
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.focus : undefined;
    if (picked !== undefined && picked.mission !== shownMission.path) {
      picked = undefined;
    }
    card = undefined;
    diagram = undefined;
    root.replaceChildren(drawPage(shownMission));
    fitWorkflow();
    window.scrollTo(0, scrolled);
    if (focused !== undefined) {
      const again = root.querySelector<HTMLButtonElement>(`[data-focus="${focused}"]`);
      if (again !== null && !again.disabled) {
        again.focus();
      }
    }
  }

  /** Draws, in place of the whole page, the failure line with the cause beneath it, and nothing else. */
  function drawFailure(cause: string): void {
    diagram = undefined;
    card = undefined;
    const failure = element('section', undefined, 'failure');
    failure.setAttribute('role', 'alert');
    failure.append(element('p', FAILURE_LINE), element('pre', cause));
    root.replaceChildren(failure);
  }

  /** Draws, in place of the whole page, the one fixed notice that the window's mission is no longer live, and nothing else. */
  function drawNotLive(): void {
    diagram = undefined;
    card = undefined;
    const notice = element('section', undefined, 'not-live');
    notice.setAttribute('role', 'status');
    notice.append(element('p', NOT_LIVE_LINE));
    root.replaceChildren(notice);
  }

  window.addEventListener('message', (event: MessageEvent<WindowMessage>) => {
    const message = event.data;
    if (message.type === 'page') {
      if (shownMission !== undefined && shownMission.path !== message.mission.path) {
        previews.clear();
      }
      if (drawn !== 'page') {
        picked = undefined;
      }
      shownMission = message.mission;
      running = new Set(message.running ?? []);
      drawn = 'page';
      draw();
    } else if (message.type === 'liveFailure') {
      drawn = 'failure';
      picked = undefined;
      drawFailure(message.cause);
    } else if (message.type === 'notLive') {
      drawn = 'notLive';
      picked = undefined;
      previews.clear();
      drawNotLive();
    } else if (message.type === 'running') {
      running = new Set(message.missions);
      draw();
    } else if (message.type === 'preview') {
      if (shownMission === undefined || shownMission.path !== message.mission) {
        return;
      }
      previews.set(message.mission, {
        recipe: message.recipe,
        lines: message.lines,
        names: message.names,
        result: message.result,
        overrides: new Map(),
      });
      draw();
    } else if (message.type === 'loopStarted') {
      previews.delete(message.mission);
      draw();
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

  /** Every change of the window's width lays the workflow diagram out again, as a row or as a stack. */
  window.addEventListener('resize', fitWorkflow);

  vscode.postMessage({ type: 'ready' });
})();
