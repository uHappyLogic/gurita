// The mission pane's page script. On every load it posts a ready message and draws what the
// extension answers: a row of tabs, one per live mission in the order `missions.py live` prints
// them, each showing the mission's title with its path as a tooltip, with the two mission-starting
// buttons and the refresh control at the row's end and the selected mission's page beneath; or the
// one failure state in place of the pages, the refresh control and the two mission-starting buttons
// staying on the pane above it. The refresh control asks the extension to re-read everything, and
// after every answer the page stays on the mission it showed unless that mission is no longer
// live, when it falls back to the first. A page opens on the workflow diagram, drawn by this script
// with no Mermaid: eight neutral blocks, define, review, provide alternatives, recommend, and answer
// in the frame "Decide upfront" and derive, complete, and finish in the frame "Hand execution to
// agents", with the arrows between them, the loop from answer back to review until no open
// question remains, and the handoff from answer to derive. The block of the step to run next,
// which the extension chooses and posts, is filled purple, and no block is filled when the
// extension chose none; the diagram is display only, its blocks no buttons, gating nothing. Below
// it stand the recipe buttons, the question view, and the remaining task headings with the
// new-task button beside them, posting the page's mission, all drawn from the parse the extension
// posts. The recipe buttons: the shipped recipes grouped
// under Claude Code and Antigravity and, below them, the own recipes that replace none under
// "Your recipes", each button carrying its recipe's lines as written in its hover text and
// starting that recipe's chain for the page's mission when clicked, and each recipe holding a
// placeholder the extension does not know shown as a non-runnable entry naming it and its file.
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
// workflow diagram's filled block pulses; the tabs, the refresh control, the question view's
// previous and next buttons and dependency links, the preview's close button, the other missions'
// pages, and the two mission-starting buttons stay enabled. Every value is drawn as text, never as
// markup, since it comes from the workspace.

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

  type WorkflowStep = 'define' | 'review' | 'alternatives' | 'recommend' | 'answer' | 'derive' | 'complete' | 'finish';

  interface Mission {
    path: string;
    state: string;
    title: string;
    questions: QuestionPart;
    tasks: TaskPart;
    /** The step to run next, which the diagram fills; absent when none could be chosen. */
    step?: WorkflowStep;
  }

  type RecipeGroup = 'Claude Code' | 'Antigravity' | 'own';

  type PageRecipe =
    | { kind: 'runnable'; name: string; group: RecipeGroup; lines: string[] }
    | { kind: 'looped'; name: string; group: RecipeGroup; lines: string[] }
    | { kind: 'unknown'; name: string; group: RecipeGroup; lines: string[]; placeholders: string[]; file: string };

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

  type PaneMessage =
    | { type: 'live'; missions: Mission[]; recipes: RecipePart; running: string[] }
    | { type: 'liveFailure'; cause: string }
    | { type: 'running'; missions: string[] }
    | { type: 'preview'; mission: string; recipe: string; lines: string[]; names: string[]; result: PreviewRead }
    | { type: 'loopStarted'; mission: string };

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
  /** The buttons on a question's card, each with its label and hover text. */
  const QUESTION_BUTTONS: [string, string, string][] = [
    ['discussQuestion', 'Discuss', 'Type an optional note and open an interactive discussion of this question'],
    ['answerQuestion', 'Answer', 'Record an answer you type as the decision'],
    ['answerWithRecommendation', 'Answer with recommendation', "Record this question's recommendation as the decision"],
  ];
  /** The workflow diagram's two frames, each with its heading and its blocks' steps and names in flow order. */
  const WORKFLOW_FRAMES: [string, string, [WorkflowStep, string][]][] = [
    [
      'decide',
      'Decide upfront',
      [
        ['define', 'define'],
        ['review', 'review'],
        ['alternatives', 'provide alternatives'],
        ['recommend', 'recommend'],
        ['answer', 'answer'],
      ],
    ],
    [
      'execute',
      'Hand execution to agents',
      [
        ['derive', 'derive'],
        ['complete', 'complete'],
        ['finish', 'finish'],
      ],
    ],
  ];
  /** The label of the dashed arrow from answer back to review. */
  const LOOP_LABEL = 'until no open questions remain';
  /** The label of the arrow from answer to derive. */
  const HANDOFF_LABEL = 'handoff';
  /** The page's recipe groups in the order drawn, each with its heading. */
  const RECIPE_GROUPS: [RecipeGroup, string][] = [
    ['Claude Code', 'Claude Code'],
    ['Antigravity', 'Antigravity'],
    ['own', 'Your recipes'],
  ];

  const vscode = acquireVsCodeApi();
  const root = document.getElementById('root') as HTMLElement;
  const saved = (vscode.getState() ?? {}) as PageState;
  let selected: string | undefined = saved.selected;
  const positions = new Map<string, Position>(Object.entries(saved.positions ?? {}));
  let missions: Mission[] = [];
  let recipes: RecipePart = { state: 'read', recipes: [] };
  /** The paths of the missions with a running runner, whose pages are drawn as running. */
  let running = new Set<string>();
  /** What the pane last drew from the extension's answer: nothing yet, the mission pages, or the failure state. */
  let drawn: 'nothing' | 'live' | 'failure' = 'nothing';
  /** Each mission's preview, by its path, while it stands on the page. */
  const previews = new Map<string, Preview>();
  /** The card drawn on the page, so a dependency link can scroll to the card it jumped to. */
  let card: HTMLElement | undefined;

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

  /** The questions of the page shown, when its question view reads and holds any. */
  function shownQuestions(): { mission: string; questions: Question[] } | undefined {
    const mission = missions.find((each) => each.path === selected);
    if (mission === undefined || mission.questions.state !== 'read' || mission.questions.questions.length === 0) {
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

  /** The refresh control and the two mission-starting buttons, belonging to no mission, at the tab row's end. */
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
    ends.append(refresh, starting);
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
      tab.setAttribute('aria-selected', String(mission.path === selected));
      tab.addEventListener('click', () => select(mission.path));
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
   * The workflow diagram: the two frames side by side joined by the handoff arrow, each frame's
   * blocks in a row joined by arrows, and under the first frame's row the dashed loop from answer
   * back to review. The block of `step` is filled, and pulses while `busy`, a chain started for
   * the mission running; every block is display only.
   */
  function drawWorkflow(step: WorkflowStep | undefined, busy: boolean): HTMLElement {
    const diagram = element('section', undefined, 'workflow');
    diagram.setAttribute('aria-label', 'Workflow');
    WORKFLOW_FRAMES.forEach(([kind, heading, blocks], frameIndex) => {
      if (frameIndex > 0) {
        const handoff = element('div', undefined, 'handoff');
        handoff.setAttribute('aria-hidden', 'true');
        handoff.append(element('span', HANDOFF_LABEL, 'arrow-label'), element('span', '\u2192', 'arrow'));
        diagram.append(handoff);
      }
      const frame = element('div', undefined, `frame ${kind}`);
      frame.append(element('div', heading, 'frame-heading'));
      const flow = element('div', undefined, 'flow');
      flow.setAttribute('role', 'list');
      blocks.forEach(([each, name], index) => {
        if (index > 0) {
          const arrow = element('span', '\u2192', 'arrow');
          arrow.setAttribute('aria-hidden', 'true');
          arrow.style.gridColumn = String(index * 2);
          flow.append(arrow);
        }
        const block = element('div', name, each !== step ? 'block' : busy ? 'block next running' : 'block next');
        block.setAttribute('role', 'listitem');
        block.style.gridColumn = String(index * 2 + 1);
        if (each === step) {
          block.setAttribute('aria-current', 'step');
          block.title = busy ? 'The step to run next; a chain is running for this mission' : 'The step to run next';
        }
        flow.append(block);
      });
      const review = blocks.findIndex(([each]) => each === 'review');
      const answer = blocks.findIndex(([each]) => each === 'answer');
      if (review !== -1 && answer !== -1) {
        const loop = element('div', undefined, 'loop');
        loop.setAttribute('aria-label', `answer back to review ${LOOP_LABEL}`);
        loop.style.gridColumn = `${review * 2 + 1} / ${answer * 2 + 2}`;
        loop.append(element('span', LOOP_LABEL, 'arrow-label'));
        flow.append(loop);
      }
      frame.append(flow);
      diagram.append(frame);
    });
    return diagram;
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

  /** The question view: the position counter and its previous and next buttons above the one card shown. */
  function drawQuestions(mission: Mission, busy: boolean): HTMLElement {
    const view = element('section', undefined, 'questions');
    view.append(element('h3', 'Open questions'));
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

  function drawTasks(mission: Mission, busy: boolean): HTMLElement {
    const view = element('section', undefined, 'tasks');
    const head = element('div', undefined, 'section-head');
    const add = action('New task', 'action', busy, () => vscode.postMessage({ type: 'taskButton', mission: mission.path }));
    add.title = 'Type an issue and open an interactive discussion of it into tasks for this mission';
    head.append(element('h3', 'Remaining tasks'), add);
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

  function drawRecipes(mission: Mission, busy: boolean): HTMLElement {
    const view = element('section', undefined, 'recipes');
    view.append(element('h3', 'Recipes'));
    if (recipes.state === 'failed') {
      const box = element('div', undefined, 'notice');
      box.setAttribute('role', 'alert');
      box.append(element('p', RECIPE_FAILURE_LINE), element('pre', recipes.cause));
      view.append(box);
      return view;
    }
    for (const [group, heading] of RECIPE_GROUPS) {
      const entries = recipes.recipes.filter((recipe) => recipe.group === group);
      if (entries.length === 0) {
        continue;
      }
      view.append(element('h4', heading));
      const list = element('div', undefined, 'recipe-list');
      for (const recipe of entries) {
        if (recipe.kind === 'runnable') {
          const run = action(recipe.name, 'recipe', busy, () =>
            vscode.postMessage({ type: 'runRecipe', mission: mission.path, recipe: recipe.name }),
          );
          run.title = recipe.lines.join('\n');
          list.append(run);
        } else if (recipe.kind === 'looped') {
          const preview = action(recipe.name, 'recipe', busy, () =>
            vscode.postMessage({ type: 'previewLoop', mission: mission.path, recipe: recipe.name }),
          );
          preview.title = recipe.lines.join('\n');
          list.append(preview);
        } else {
          const named = recipe.placeholders.map((placeholder) => `<${placeholder}>`).join(', ');
          const entry = element('span', `${recipe.name}: ${recipe.placeholders.length === 1 ? 'unknown placeholder' : 'unknown placeholders'} ${named} in ${recipe.file}`, 'recipe-unknown');
          entry.title = recipe.lines.join('\n');
          list.append(entry);
        }
      }
      view.append(list);
    }
    return view;
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

  function drawPage(mission: Mission): HTMLElement {
    const page = element('section', undefined, 'page');
    page.setAttribute('role', 'tabpanel');
    const busy = running.has(mission.path);
    page.append(drawWorkflow(mission.step, busy), drawRecipes(mission, busy));
    const preview = previews.get(mission.path);
    if (preview !== undefined) {
      page.append(drawPreview(mission, preview, busy));
    }
    page.append(drawQuestions(mission, busy), drawTasks(mission, busy));
    return page;
  }

  /**
   * Redraws the whole pane in place from the latest parse, keeping the scroll position and the
   * focus on the previous or next button when it held it.
   */
  function draw(): void {
    const scrolled = window.scrollY;
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.focus : undefined;
    if (!missions.some((mission) => mission.path === selected)) {
      selected = missions[0]?.path;
    }
    card = undefined;
    const shown = missions.find((mission) => mission.path === selected);
    root.replaceChildren(drawTabs());
    root.append(shown === undefined ? element('p', NO_MISSION_LINE) : drawPage(shown));
    window.scrollTo(0, scrolled);
    if (focused !== undefined) {
      const again = root.querySelector<HTMLButtonElement>(`[data-focus="${focused}"]`);
      if (again !== null && !again.disabled) {
        again.focus();
      }
    }
  }

  function drawFailure(cause: string): void {
    const failure = element('section', undefined, 'failure');
    failure.append(element('p', FAILURE_LINE), element('pre', cause));
    const tabs = element('div', undefined, 'tabs');
    tabs.append(drawStarting());
    root.replaceChildren(tabs, failure);
  }

  window.addEventListener('message', (event: MessageEvent<PaneMessage>) => {
    const message = event.data;
    if (message.type === 'live') {
      missions = message.missions;
      recipes = message.recipes;
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
    }
  });

  /** The left and right arrow keys move the shown page's question view, except while typing or choosing. */
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

  vscode.postMessage({ type: 'ready' });
})();
