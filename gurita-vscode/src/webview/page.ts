// The mission pane's page script. On every load it posts a ready message and draws what the
// extension answers: a row of tabs, one per live mission in the order `missions.py live` prints
// them, each showing the mission's title with its path as a tooltip, with the two mission-starting
// buttons at the row's end and the selected mission's page beneath; or the one failure state in
// place of the pages, the two mission-starting buttons staying on the pane above it. A page shows its mission's path,
// title, and state, the label's facts, the question view, and the remaining task headings, all
// drawn from the parse the extension posts, and the recipe buttons: the shipped recipes grouped
// under Claude Code and Antigravity and, below them, the own recipes that replace none under
// "Your recipes", each button carrying its recipe's lines as written in its hover text and
// starting that recipe's chain for the page's mission when clicked, and each recipe holding a
// placeholder the extension does not know shown as a non-runnable entry naming it and its file.
// The question view shows one collapsed row per
// question, its Short Title and the id of its picked alternative, each row opening to everything
// its block holds, with expand-all and collapse-all controls. Each row carries the discuss,
// answer, and answer-with-recommendation buttons, and each alternative inside an opened row the
// answer-with-alternative button, each posting the Short Title and the Alternative Id of the row
// clicked; the extension asks for any typed value in VS Code's own input box. Every message the extension posts
// redraws the rows in place, and the rows open before it stay open: the page keeps its set of
// open Short Titles per mission, saved with `setState` on every toggle and read back with
// `getState` when the page is re-created. A part drawn from a file that did not read is replaced
// by that file's notice alone. Every value is drawn as text, never as markup, since it comes from
// the workspace.

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

  interface LabelFacts {
    lacksAlternatives?: boolean;
    lacksPick?: boolean;
    questionsEmpty?: boolean;
    tasksRemain?: boolean;
  }

  interface Mission {
    path: string;
    state: string;
    title: string;
    questions: QuestionPart;
    tasks: TaskPart;
    facts: LabelFacts;
  }

  type RecipeGroup = 'Claude Code' | 'Antigravity' | 'own';

  type PageRecipe =
    | { kind: 'runnable'; name: string; group: RecipeGroup; lines: string[] }
    | { kind: 'unknown'; name: string; group: RecipeGroup; lines: string[]; placeholders: string[]; file: string };

  type RecipePart = { state: 'read'; recipes: PageRecipe[] } | { state: 'failed'; cause: string };

  type PaneMessage =
    | { type: 'live'; missions: Mission[]; recipes: RecipePart }
    | { type: 'liveFailure'; cause: string };

  interface PageState {
    selected?: string;
    /** The open Short Titles of each mission's question view, keyed by mission path. */
    open?: Record<string, string[]>;
  }

  const FAILURE_LINE = 'The live missions could not be read.';
  const NO_MISSION_LINE = 'No mission is live.';
  const RECIPE_FAILURE_LINE = 'The recipes could not be read.';
  /** The buttons on a question's row, each with its label and hover text. */
  const QUESTION_BUTTONS: [string, string, string][] = [
    ['discussQuestion', 'Discuss', 'Open an interactive discussion of this question'],
    ['answerQuestion', 'Answer', 'Record an answer you type as the decision'],
    ['answerWithRecommendation', 'Answer with recommendation', "Record this question's recommendation as the decision"],
  ];
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
  const open = new Map<string, Set<string>>(
    Object.entries(saved.open ?? {}).map(([mission, titles]) => [mission, new Set(titles)]),
  );
  let missions: Mission[] = [];
  let recipes: RecipePart = { state: 'read', recipes: [] };
  /** The rows of the drawn page by Short Title, so a dependency link can scroll to its sibling. */
  let rows = new Map<string, HTMLElement>();

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

  function save(): void {
    const state: PageState = {
      selected,
      open: Object.fromEntries([...open].map(([mission, titles]) => [mission, [...titles]])),
    };
    vscode.setState(state);
  }

  function openTitles(mission: string): Set<string> {
    let titles = open.get(mission);
    if (titles === undefined) {
      titles = new Set();
      open.set(mission, titles);
    }
    return titles;
  }

  function select(path: string): void {
    selected = path;
    save();
    draw();
  }

  /** Opens or closes one row, saving the open set on every toggle. */
  function toggle(mission: string, title: string): void {
    const titles = openTitles(mission);
    if (titles.has(title)) {
      titles.delete(title);
    } else {
      titles.add(title);
    }
    save();
    draw();
  }

  function setAll(mission: Mission, opened: boolean): void {
    const titles = openTitles(mission.path);
    titles.clear();
    if (opened && mission.questions.state === 'read') {
      for (const question of mission.questions.questions) {
        titles.add(question.id);
      }
    }
    save();
    draw();
  }

  /** Opens the named sibling's row and scrolls it into view. */
  function follow(mission: string, title: string): void {
    openTitles(mission).add(title);
    save();
    draw();
    rows.get(title)?.scrollIntoView({ block: 'start' });
  }

  /** The two mission-starting buttons, belonging to no mission, at the tab row's end. */
  function drawStarting(): HTMLElement {
    const starting = element('div', undefined, 'starting');
    const discuss = button('New mission', 'recipe', () => vscode.postMessage({ type: 'missionButton', button: 'discussGoal' }));
    discuss.title = 'Type a goal and open an interactive discussion of it';
    const define = button('Define mission', 'recipe', () => vscode.postMessage({ type: 'missionButton', button: 'defineMission' }));
    define.title = 'Type a goal and its scope and define the mission';
    starting.append(discuss, define);
    return starting;
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

  function drawLabel(mission: Mission): HTMLElement {
    const label = element('ul', undefined, 'label');
    const facts = mission.facts;
    const items: string[] = [mission.state];
    if (mission.questions.state === 'read') {
      const count = mission.questions.questions.length;
      if (facts.questionsEmpty) {
        items.push('no open question');
      } else {
        items.push(count === 1 ? '1 open question' : `${count} open questions`);
        items.push(facts.lacksAlternatives ? 'a question lacks alternatives' : 'every question has alternatives');
        items.push(facts.lacksPick ? 'a question lacks a pick' : 'every question has a pick');
      }
    }
    if (mission.tasks.state === 'read') {
      items.push(facts.tasksRemain ? 'tasks remain' : 'no task remains');
    }
    for (const item of items) {
      label.append(element('li', item));
    }
    return label;
  }

  function drawList(heading: string, items: string[]): HTMLElement | undefined {
    if (items.length === 0) {
      return undefined;
    }
    const part = element('div', undefined, 'part');
    part.append(element('h4', heading));
    const list = element('ul');
    for (const item of items) {
      list.append(element('li', item));
    }
    part.append(list);
    return part;
  }

  function drawBody(mission: Mission, question: Question, siblings: Set<string>): HTMLElement {
    const body = element('div', undefined, 'body');
    body.append(element('p', question.question, 'question-text'));

    const pick = question.recommendation;
    if (pick !== undefined) {
      const named = question.alternatives.some((alternative) => alternative.id === pick.option);
      const box = element('div', undefined, 'pick');
      box.append(element('h4', named ? `Pick: ${pick.option}` : `Pick: ${pick.option} (names no alternative of this question)`));
      box.append(element('p', pick.rationale));
      body.append(box);
    }

    if (question.alternatives.length > 0) {
      const part = element('div', undefined, 'part');
      part.append(element('h4', 'Alternatives'));
      for (const alternative of question.alternatives) {
        const picked = pick !== undefined && alternative.id === pick.option;
        const box = element('div', undefined, picked ? 'alternative picked' : 'alternative');
        box.append(element('h5', picked ? `${alternative.id} (picked)` : alternative.id));
        const answer = button('Answer with this alternative', 'action', () =>
          vscode.postMessage({ type: 'alternativeButton', mission: mission.path, question: question.id, alternative: alternative.id }),
        );
        answer.title = `Record ${alternative.id} as the decision`;
        box.append(answer);
        if (alternative.text !== '') {
          box.append(element('p', alternative.text));
        }
        const points = element('ul');
        for (const advantage of alternative.advantages) {
          points.append(element('li', `Advantage: ${advantage}`, 'advantage'));
        }
        for (const drawback of alternative.drawbacks) {
          points.append(element('li', `Drawback: ${drawback}`, 'drawback'));
        }
        if (points.childElementCount > 0) {
          box.append(points);
        }
        part.append(box);
      }
      body.append(part);
    }

    if (question.dependsOn.length > 0) {
      const part = element('div', undefined, 'part');
      part.append(element('h4', 'Depends on'));
      const list = element('ul');
      for (const dependency of question.dependsOn) {
        const item = element('li');
        if (siblings.has(dependency.question)) {
          item.append(button(dependency.question, 'link', () => follow(mission.path, dependency.question)));
        } else {
          item.append(element('span', dependency.question));
        }
        item.append(document.createTextNode(` assuming ${dependency.option}`));
        list.append(item);
      }
      part.append(list);
      body.append(part);
    }

    const principles = drawList('Principles applied', question.principles);
    if (principles !== undefined) {
      body.append(principles);
    }
    return body;
  }

  function drawQuestions(mission: Mission): HTMLElement {
    const view = element('section', undefined, 'questions');
    view.append(element('h3', 'Open questions'));
    const part = mission.questions;
    if (part.state === 'failed') {
      view.append(drawNotice(part.notice));
      return view;
    }
    if (part.questions.length === 0) {
      view.append(element('p', 'No open question.'));
      return view;
    }
    const controls = element('div', undefined, 'controls');
    controls.append(
      button('Expand all', 'control', () => setAll(mission, true)),
      button('Collapse all', 'control', () => setAll(mission, false)),
    );
    view.append(controls);
    const titles = openTitles(mission.path);
    const siblings = new Set(part.questions.map((question) => question.id));
    for (const question of part.questions) {
      const opened = titles.has(question.id);
      const row = element('div', undefined, opened ? 'row open' : 'row');
      const head = element('button', undefined, 'row-head');
      head.type = 'button';
      head.setAttribute('aria-expanded', String(opened));
      head.append(element('span', opened ? '▾' : '▸', 'caret'), element('span', question.id, 'short-title'));
      if (question.recommendation !== undefined) {
        head.append(element('span', question.recommendation.option, 'pick-id'));
      }
      head.addEventListener('click', () => toggle(mission.path, question.id));
      const line = element('div', undefined, 'row-line');
      const actions = element('div', undefined, 'row-actions');
      for (const [kind, label, hover] of QUESTION_BUTTONS) {
        const action = button(label, 'action', () =>
          vscode.postMessage({ type: 'questionButton', button: kind, mission: mission.path, question: question.id }),
        );
        action.title = hover;
        actions.append(action);
      }
      line.append(head, actions);
      row.append(line);
      if (opened) {
        row.append(drawBody(mission, question, siblings));
      }
      rows.set(question.id, row);
      view.append(row);
    }
    return view;
  }

  function drawTasks(mission: Mission): HTMLElement {
    const view = element('section', undefined, 'tasks');
    view.append(element('h3', 'Remaining tasks'));
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

  function drawRecipes(mission: Mission): HTMLElement {
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
          const run = button(recipe.name, 'recipe', () =>
            vscode.postMessage({ type: 'runRecipe', mission: mission.path, recipe: recipe.name }),
          );
          run.title = recipe.lines.join('\n');
          list.append(run);
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

  function drawPage(mission: Mission): HTMLElement {
    const page = element('section', undefined, 'page');
    page.setAttribute('role', 'tabpanel');
    const facts = element('dl', undefined, 'facts');
    for (const [label, value] of [
      ['Path', mission.path],
      ['Title', mission.title],
      ['State', mission.state],
    ]) {
      facts.append(element('dt', label), element('dd', value));
    }
    page.append(facts, drawLabel(mission), drawRecipes(mission), drawQuestions(mission), drawTasks(mission));
    return page;
  }

  /** Redraws the whole pane in place from the latest parse, keeping the scroll position. */
  function draw(): void {
    const scrolled = window.scrollY;
    if (!missions.some((mission) => mission.path === selected)) {
      selected = missions[0]?.path;
    }
    rows = new Map();
    const shown = missions.find((mission) => mission.path === selected);
    root.replaceChildren(drawTabs());
    root.append(shown === undefined ? element('p', NO_MISSION_LINE) : drawPage(shown));
    window.scrollTo(0, scrolled);
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
      draw();
    } else if (message.type === 'liveFailure') {
      drawFailure(message.cause);
    }
  });

  vscode.postMessage({ type: 'ready' });
})();
