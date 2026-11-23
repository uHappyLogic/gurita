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
// extension does not know is shown as a non-runnable entry naming it and its file. The seven buttons
// outside the recipe list, which run a recipe by its fixed name, take the recipe list's pick
// mechanics, as the extension posts them, the five on a mission's page with that mission and the
// two mission-starting buttons with the pages and with the failure state: a dropdown beside each
// offers the variants the button can run, a person's own marked as theirs, and stands on the one
// selected, the one remembered for the recipe, per mission for the buttons on a mission's page and
// once per project for the two mission-starting buttons, else the recipe's default, a question
// card holding one dropdown beside its Alternatives heading shared by its answer-with-alternative
// buttons; picking another posts it with the button, and its mission for a button on a mission's
// page, to the extension, which remembers it and posts the page again. Each button shows its name
// with the distinct harnesses, models, and efforts of the variant selected, with that variant's
// lines as written in its hover text, its click posting that variant's name; a button the
// extension posts with no variant, every one it could run having a line on a disabled harness,
// stays drawn but disabled, with no dropdown, and one posted with nothing, its recipe not read or
// not one it can run, shows its name alone with a hover text saying what it does, as does a
// variant none of whose lines is readable.
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
// workflow diagram's filled block pulses; the recipe dropdowns and the fixed-name buttons' dropdowns, the tabs, the refresh control, the question view's
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
// alone: nothing on a mission page is drawn from it. Beside each harness the view also shows
// whether it is enabled, as the extension posts it at every opening, with one control that
// disables an enabled harness or enables a disabled one, posted to the extension, which stores the
// state and posts it again with the pages, their recipe lists leaving out every variant with a line
// on a disabled harness. The control is drawn whatever the check reports, while it runs or could
// not run included, and the state is redrawn only from what the extension posts. Under Models and
// efforts the view draws each harness's model list and its one effort list, Codex's model list
// alone, as the extension posts them at every opening: each entry with its remove control, and
// each list with its add control, each posted to the extension, which asks for an added entry in
// VS Code's own input box, writes the change, and posts the lists again; the lists are redrawn
// only from what it posts. Under Variants the view draws every recipe the extension posts at every
// opening, the chains, the seven fixed-name button recipes, and the recipes and variants of the own
// recipe file, the named single-task lines left out: each variant with where it comes from,
// whether it is the recipe's default, and its Duplicate, Rename, Delete, and Make default
// controls, a stored copy also its Reset control, and each variant a hiding record hides with its
// Reset control alone. Each control posts its edit to the extension, which asks for a duplicate's
// name or a new name in VS Code's own input box, writes the edit to the variant store, and posts
// the variants and the pages again; the variants are redrawn only from what it posts. Beneath each
// listed variant its line editor shows every line as its text, and only a line the extension posts
// with an editor, a `claude` or `agy` line carrying both `--model` and `--effort`, gets a model
// and an effort dropdown, a Codex line carrying `-m` its model dropdown alone, every other line
// staying read-only text. The model dropdown offers the harness's model list and the effort
// dropdown its whole effort list, whatever the line's model, as the extension last posted them,
// each standing on the value the line carries, offered too when the list lacks it. A pick posts the
// line, the kind, and the value to the extension, which replaces the value the line carries and
// posts the variants again; the line is redrawn only from what it posts. Under Single-task lines
// the view draws every named single-task line the extension posts, shipped and own alike: each
// with where it comes from, its Duplicate, Rename, and Delete controls, a stored copy also its
// Reset control, and its one line beneath with the line editor it gets, and each line a hiding
// record hides with its Reset control alone, every control posted to the extension and the lines
// redrawn only from what it posts.

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

  /** One of the seven buttons outside the recipe list, each running the recipe of its fixed name. */
  type FixedButton =
    | 'discussQuestion'
    | 'answerQuestion'
    | 'answerWithRecommendation'
    | 'answerWithAlternative'
    | 'discussGoal'
    | 'defineMission'
    | 'discussTask';

  /**
   * What a fixed-name button runs, as the extension posts it: the variants its dropdown offers and
   * the one selected, with that variant's lines and their values; or no variant, every one it could
   * run having a line on a disabled harness, the button drawn disabled.
   */
  type FixedButtonEntry =
    | { state: 'offered'; lines: string[]; values: VariantValues; variants: PageVariantChoice[]; selected: number }
    | { state: 'disabled'; cause: string };

  /** What each fixed-name button runs, by the button; a button whose recipe cannot be read or run is left out. */
  type FixedButtons = Partial<Record<FixedButton, FixedButtonEntry>>;

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

  /** Each harness's enabled state, by its key, or the cause it could not be read. */
  type HarnessSettings = { state: 'read'; enabled: Record<string, boolean> } | { state: 'failed'; cause: string };

  /** One harness's lists: its models, and its efforts where it holds an effort list. */
  interface HarnessList {
    models: string[];
    efforts?: string[];
  }

  /** Each harness's model and effort lists, by its key, or the cause they could not be read. */
  type HarnessLists = { state: 'read'; lists: Record<string, HarnessList> } | { state: 'failed'; cause: string };

  /** Where a variant comes from: the shipped file, the person's own recipe file, or the variant store. */
  type VariantOrigin = 'shipped' | 'own' | 'stored';

  /** A variant read from a file, which a stored copy stands in for or a hiding record hides. */
  interface ReadVariantRef {
    name: string;
    origin: 'shipped' | 'own';
    /** The recipe it belongs to, named where a renamed single-task line copies it under another name. */
    recipe?: string;
  }

  /** One variant as the settings view lists it. */
  interface SettingsVariant {
    name: string;
    origin: VariantOrigin;
    /** The shipped or own variant a stored copy stands in for. */
    copies?: ReadVariantRef;
    lines: string[];
    /** The line editor each line gets, in the lines' order, null for a line shown read-only. */
    editors?: (LineEditor | null)[];
    isDefault: boolean;
  }

  /** The dropdowns one line gets: the harness whose lists they offer, its model, and its effort where it gets an effort dropdown. */
  interface LineEditor {
    harness: string;
    model: string;
    effort?: string;
  }

  /** One recipe as the settings view lists it, with its variants and those a hiding record hides. */
  interface SettingsRecipe {
    name: string;
    group: RecipeGroup;
    /** Whether a button outside the recipe list runs it by its fixed name. */
    fixed: boolean;
    variants: SettingsVariant[];
    hidden: ReadVariantRef[];
  }

  /** The recipes and variants the settings view edits, or the cause they could not be read. */
  type VariantsRead = { state: 'read'; recipes: SettingsRecipe[] } | { state: 'failed'; cause: string };

  /** One named single-task line as the settings view lists it. */
  interface SettingsLine {
    /** The line's name, the one the looped run, the rule file, and the override list use. */
    name: string;
    group: RecipeGroup;
    /** The variant of its recipe the line is. */
    variant: { name: string; origin: VariantOrigin; copies?: ReadVariantRef };
    line: string;
    editor: LineEditor | null;
    /** Whether the looped run takes it for the name. */
    isDefault: boolean;
    /** The shipped or own line a stored copy stands in for, which its reset shows again. */
    reset?: { recipe: string; original: ReadVariantRef };
  }

  /** The named single-task lines the settings view edits, the deleted shipped and own ones apart, or the cause they could not be read. */
  type LinesRead =
    | { state: 'read'; lines: SettingsLine[]; hidden: { name: string; original: ReadVariantRef }[] }
    | { state: 'failed'; cause: string };

  type PaneMessage =
    | { type: 'live'; missions: Mission[]; running: string[]; buttons?: FixedButtons }
    | { type: 'liveFailure'; cause: string; buttons?: FixedButtons }
    | { type: 'running'; missions: string[] }
    | { type: 'preview'; mission: string; recipe: string; lines: string[]; names: string[]; result: PreviewRead }
    | { type: 'loopStarted'; mission: string }
    | { type: 'harnessCheck'; check: HarnessCheck }
    | { type: 'harnessSettings'; settings: HarnessSettings }
    | { type: 'harnessLists'; lists: HarnessLists }
    | { type: 'variants'; variants: VariantsRead }
    | { type: 'singleTaskLines'; lines: LinesRead };

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
  const SETTINGS_FAILURE_LINE = 'The harness settings could not be read.';
  const LISTS_HEADING = 'Models and efforts';
  const LISTS_FAILURE_LINE = 'The model and effort lists could not be read.';
  const REMOVE_LABEL = 'Remove';
  const NO_ENTRY_LINE = 'No entry';
  const VARIANTS_HEADING = 'Variants';
  const VARIANTS_FAILURE_LINE = 'The variants could not be read.';
  const DUPLICATE_LABEL = 'Duplicate';
  const RENAME_LABEL = 'Rename';
  const DELETE_LABEL = 'Delete';
  const PICK_DEFAULT_LABEL = 'Make default';
  const RESET_LABEL = 'Reset';
  const DEFAULT_MARK = 'Default';
  const DELETED_MARK = 'Deleted';
  const FIXED_NOTE = 'Run by a button outside the recipe list, which runs this default until another variant is selected beside it.';
  const LINES_HEADING = 'Single-task lines';
  const LINES_FAILURE_LINE = 'The single-task lines could not be read.';
  const NOT_RUN_MARK = 'Not run';
  /** Each of a harness's two lists, with its kind, its label, and its add control's label. */
  const LISTS: ['model' | 'effort', string, string][] = [
    ['model', 'Models', 'Add model'],
    ['effort', 'Efforts', 'Add effort'],
  ];
  /** The three harnesses the settings view lists, in its order, each with its key and its name. */
  const HARNESSES: [string, string][] = [
    ['claude', 'Claude Code'],
    ['antigravity', 'Antigravity'],
    ['codex', 'Codex'],
  ];
  const ENABLED_LABEL = 'Enabled';
  const DISABLED_LABEL = 'Disabled';
  const ENABLE_LABEL = 'Enable';
  const DISABLE_LABEL = 'Disable';
  /** The name of each of a harness's three checks, as the settings view names the one that failed. */
  const FAILED_CHECKS: Record<FailedCheck, string> = {
    cli: 'CLI not found',
    plugin: 'Gurita plugin not installed',
    version: 'Installed version differs from the packaged one',
  };
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
  /** What the two mission-starting buttons run, as the extension last posted it with the pages or the failure state. */
  let startingButtons: FixedButtons = {};
  /** Whether the settings view stands beneath the tab row in place of the mission page or the failure state. */
  let settingsShown = false;
  /** The harness check the extension last posted, drawn by the settings view; undefined until one is posted. */
  let harnessCheck: HarnessCheck | undefined;
  /** Each harness's enabled state the extension last posted, drawn by the settings view; undefined until one is posted. */
  let harnessSettings: HarnessSettings | undefined;
  /** Each harness's lists the extension last posted, drawn by the settings view; undefined until they are posted. */
  let harnessLists: HarnessLists | undefined;
  /** The recipes and variants the extension last posted, drawn by the settings view; undefined until they are posted. */
  let variantsRead: VariantsRead | undefined;
  /** The named single-task lines the extension last posted, drawn by the settings view; undefined until they are posted. */
  let linesRead: LinesRead | undefined;
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

  /**
   * A fixed-name button, in the form the recipe list's buttons take: its name, then the values the
   * variant selected in its dropdown carries, as the extension posts `entry`, when any is readable,
   * with that variant's lines as written in its hover text; its name alone with `hover` as its
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
      const values = valuesLabel(entry.values);
      if (values !== '') {
        node.append(element('span', values, 'recipe-values'));
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
   * The dropdown beside a fixed-name button, or beside the alternatives of a question's card for
   * their answer-with-alternative buttons, which share it: one option per variant `entry` offers,
   * in order, a variant of the person's own marked as theirs, standing on the selected one, and
   * none while the button offers no variant or nothing is posted for it. Picking another posts it
   * to the extension with the button and, for a button on a mission's page, its mission, and the
   * extension remembers it and posts the page again.
   */
  function fixedDropdown(key: FixedButton, entry: FixedButtonEntry | undefined, label: string, mission?: string): HTMLSelectElement | undefined {
    if (entry?.state !== 'offered') {
      return undefined;
    }
    const choice = element('select', undefined, 'recipe-variant');
    choice.setAttribute('aria-label', `The variant of ${label}`);
    choice.dataset.focus = `button-variant-${key}`;
    variantOptions(choice, entry.variants, entry.selected);
    choice.addEventListener('change', () => {
      const variant = entry.variants[Number(choice.value)];
      if (variant !== undefined) {
        vscode.postMessage({ type: 'selectButtonVariant', button: key, mission, variant: variant.name });
      }
    });
    return choice;
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
    const item = element('span', undefined, 'recipe-entry');
    item.append(fixedButton(entry, label, hover, className, busy, onClick));
    const dropdown = fixedDropdown(key, entry, label, mission);
    if (dropdown !== undefined) {
      item.append(dropdown);
    }
    return item;
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
   * A harness's enabled state and the one control that disables it while enabled and enables it
   * while disabled, posted to the extension, which stores the state and posts it again.
   */
  function drawEnabled(key: string, name: string, enabled: boolean): HTMLElement {
    const part = element('span', undefined, 'harness-enabled');
    const toggle = button(enabled ? DISABLE_LABEL : ENABLE_LABEL, 'action', () =>
      vscode.postMessage({ type: 'setHarnessEnabled', harness: key, enabled: !enabled }),
    );
    toggle.title = enabled
      ? `Leave every variant with a line on ${name} out of the mission pages' recipe lists`
      : `List the variants with a line on ${name} on the mission pages again`;
    toggle.setAttribute('aria-pressed', String(!enabled));
    toggle.dataset.focus = `harness-${key}`;
    part.append(element('span', enabled ? ENABLED_LABEL : DISABLED_LABEL, 'harness-state'), toggle);
    return part;
  }

  /**
   * The settings view's harness part: that the check runs or could not be run, then each harness
   * with what its checks gave, when they gave anything, and whether it is enabled, with its enable
   * or disable control, and the check-again control, disabled while a check runs.
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
    }
    const settings = harnessSettings;
    if (settings !== undefined && settings.state === 'failed') {
      const box = element('div', undefined, 'notice');
      box.setAttribute('role', 'alert');
      box.append(element('p', SETTINGS_FAILURE_LINE), element('pre', settings.cause));
      part.append(box);
    }
    const list = element('ul', undefined, 'harness-list');
    for (const [key, name] of HARNESSES) {
      const outcome = check?.state === 'checked' ? check.harnesses.find((each) => each.key === key) : undefined;
      const item = element('li', undefined, outcome === undefined ? 'harness' : outcome.failed === undefined ? 'harness passed' : 'harness failed');
      item.dataset.harness = key;
      if (outcome?.failed !== undefined) {
        item.dataset.failed = outcome.failed;
      }
      item.append(element('span', outcome?.name ?? name, 'harness-name'));
      if (outcome !== undefined) {
        item.append(element('span', harnessStatus(outcome), 'harness-status'));
      }
      if (settings?.state === 'read') {
        item.append(drawEnabled(key, outcome?.name ?? name, settings.enabled[key] !== false));
      }
      list.append(item);
    }
    part.append(list);
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
   * The settings view's part of model and effort lists: the cause they could not be read, or for
   * each harness its model list and, but for a harness holding none, its effort list, each entry
   * with its remove control and each list with its add control.
   */
  function drawLists(): HTMLElement {
    const part = element('div', undefined, 'harness-values');
    part.append(element('h4', LISTS_HEADING));
    const read = harnessLists;
    if (read === undefined) {
      return part;
    }
    if (read.state === 'failed') {
      const box = element('div', undefined, 'notice');
      box.setAttribute('role', 'alert');
      box.append(element('p', LISTS_FAILURE_LINE), element('pre', read.cause));
      part.append(box);
      return part;
    }
    for (const [key, name] of HARNESSES) {
      const lists = read.lists[key];
      if (lists === undefined) {
        continue;
      }
      const harness = element('div', undefined, 'harness-lists');
      harness.dataset.harness = key;
      harness.append(element('h5', name));
      for (const [kind, label, addLabel] of LISTS) {
        const entries = kind === 'model' ? lists.models : lists.efforts;
        if (entries === undefined) {
          continue;
        }
        const row = element('div', undefined, 'value-list');
        row.dataset.kind = kind;
        row.append(element('span', label, 'value-label'));
        const list = element('ul');
        for (const value of entries) {
          const item = element('li', undefined, 'value');
          item.dataset.value = value;
          const remove = button(REMOVE_LABEL, 'action', () => vscode.postMessage({ type: 'removeHarnessValue', harness: key, kind, value }));
          remove.title = `Remove ${value} from the ${name} ${kind} list`;
          remove.dataset.focus = `remove-${kind}-${key}-${value}`;
          item.append(element('span', value, 'value-name'), remove);
          list.append(item);
        }
        if (entries.length === 0) {
          list.append(element('li', NO_ENTRY_LINE, 'value-empty'));
        }
        const add = button(addLabel, 'action', () => vscode.postMessage({ type: 'addHarnessValue', harness: key, kind }));
        add.title = `Type a ${kind} to add to the ${name} ${kind} list`;
        add.dataset.focus = `add-${kind}-${key}`;
        row.append(list, add);
        harness.append(row);
      }
      part.append(harness);
    }
    return part;
  }

  /** Where a variant comes from, as the settings view names it. */
  function originLabel(origin: VariantOrigin, copies?: ReadVariantRef): string {
    if (origin === 'stored') {
      return copies === undefined ? 'stored' : `stored copy of ${copies.origin === 'own' ? 'your' : 'the shipped'} variant ${copies.name}`;
    }
    return origin === 'own' ? 'yours' : 'shipped';
  }

  /** The variant a control's message names: its name, where it comes from, and, for a stored copy, the variant it stands in for. */
  function variantTarget(variant: { name: string; origin: VariantOrigin; copies?: ReadVariantRef }): {
    name: string;
    origin: VariantOrigin;
    copies?: ReadVariantRef;
  } {
    const copies = variant.copies;
    return {
      name: variant.name,
      origin: variant.origin,
      ...(copies === undefined
        ? {}
        : { copies: { name: copies.name, origin: copies.origin, ...(copies.recipe === undefined ? {} : { recipe: copies.recipe }) } }),
    };
  }

  /**
   * The dropdown of a line's `kind`, offering the harness's list of that kind as the extension last
   * posted it, the line's value `current` offered too when the list lacks it, and standing on it;
   * a pick of another value posts it for the line.
   */
  function lineDropdown(
    recipe: string,
    variant: SettingsVariant,
    focus: string,
    lineIndex: number,
    harness: string,
    kind: 'model' | 'effort',
    current: string,
  ): HTMLSelectElement {
    const lists = harnessLists?.state === 'read' ? harnessLists.lists[harness] : undefined;
    const listed = (kind === 'model' ? lists?.models : lists?.efforts) ?? [];
    const offered = listed.includes(current) ? listed : [current, ...listed];
    const choice = element('select', undefined, kind === 'model' ? 'line-model' : 'line-effort');
    choice.setAttribute('aria-label', `The ${kind} of line ${lineIndex + 1} of ${variant.name} in ${recipe}`);
    choice.title = `Pick the ${kind} this line runs with`;
    choice.dataset.focus = `line-${kind}-${focus}-${lineIndex}`;
    for (const value of offered) {
      const option = element('option', value);
      option.value = value;
      option.selected = value === current;
      choice.append(option);
    }
    choice.addEventListener('change', () => {
      if (choice.value !== current && offered.includes(choice.value)) {
        vscode.postMessage({ type: 'replaceLineValue', recipe, variant: variantTarget(variant), line: lineIndex, kind, value: choice.value });
      }
    });
    return choice;
  }

  /**
   * A variant's line editor: every line as its text, a line posted with an editor followed by its
   * model dropdown and, where it gets one, its effort dropdown, every other line read-only.
   */
  function drawLines(recipe: string, variant: SettingsVariant, focus: string): HTMLElement {
    const list = element('ul', undefined, 'variant-lines');
    variant.lines.forEach((line, lineIndex) => {
      const item = element('li', undefined, 'variant-line');
      item.append(element('code', line, 'line-text'));
      const editor = variant.editors?.[lineIndex];
      if (editor !== undefined && editor !== null) {
        item.append(lineDropdown(recipe, variant, focus, lineIndex, editor.harness, 'model', editor.model));
        if (editor.effort !== undefined) {
          item.append(lineDropdown(recipe, variant, focus, lineIndex, editor.harness, 'effort', editor.effort));
        }
      }
      list.append(item);
    });
    return list;
  }

  /**
   * The settings view's part of variant edits: the cause the variants could not be read, or each
   * recipe with its variants, each named with where it comes from and whether it is the default,
   * and its duplicate, rename, delete, and default controls, a stored copy's reset control too, and
   * after them each variant a hiding record hides, with its reset control. Beneath each listed
   * variant stands its line editor. Every control posts its edit; the list is redrawn only from
   * what the extension posts.
   */
  function drawVariants(): HTMLElement {
    const part = element('div', undefined, 'variant-edits');
    part.append(element('h4', VARIANTS_HEADING));
    const read = variantsRead;
    if (read === undefined) {
      return part;
    }
    if (read.state === 'failed') {
      const box = element('div', undefined, 'notice');
      box.setAttribute('role', 'alert');
      box.append(element('p', VARIANTS_FAILURE_LINE), element('pre', read.cause));
      part.append(box);
      return part;
    }
    read.recipes.forEach((recipe, recipeIndex) => {
      const block = element('div', undefined, 'variant-recipe');
      block.dataset.recipe = recipe.name;
      block.append(element('h5', recipe.name));
      if (recipe.fixed) {
        block.append(element('p', FIXED_NOTE, 'variant-note'));
      }
      const list = element('ul', undefined, 'variant-list');
      recipe.variants.forEach((variant, variantIndex) => {
        const item = element('li', undefined, variant.isDefault ? 'variant default' : 'variant');
        item.dataset.variant = variant.name;
        item.dataset.origin = variant.origin;
        const name = element('span', variant.name, 'variant-name');
        name.title = variant.lines.join('\n');
        item.append(name, element('span', originLabel(variant.origin, variant.copies), 'variant-origin'));
        if (variant.isDefault) {
          item.append(element('span', DEFAULT_MARK, 'variant-default'));
        }
        const actions = element('span', undefined, 'variant-actions');
        const control = (label: string, key: string, hover: string, message: Record<string, unknown>): void => {
          const each = button(label, 'action', () => vscode.postMessage(message));
          each.title = hover;
          each.dataset.focus = `variant-${key}-${recipeIndex}-${variantIndex}`;
          actions.append(each);
        };
        const named = variantTarget(variant);
        control(DUPLICATE_LABEL, 'duplicate', `Type a name and add a copy of ${variant.name} to ${recipe.name}`, {
          type: 'duplicateVariant',
          recipe: recipe.name,
          variant: named,
        });
        control(RENAME_LABEL, 'rename', `Type a new name for ${variant.name}`, { type: 'renameVariant', recipe: recipe.name, variant: named });
        control(DELETE_LABEL, 'delete', `Take ${variant.name} out of ${recipe.name}`, { type: 'deleteVariant', recipe: recipe.name, variant: named });
        if (!variant.isDefault) {
          control(PICK_DEFAULT_LABEL, 'default', `Make ${variant.name} the variant ${recipe.name} runs by default`, {
            type: 'pickDefault',
            recipe: recipe.name,
            variant: named,
          });
        }
        if (variant.copies !== undefined) {
          control(RESET_LABEL, 'reset', `Remove this stored copy and show ${variant.copies.name} again as its file holds it`, {
            type: 'resetVariant',
            recipe: recipe.name,
            original: { name: variant.copies.name, origin: variant.copies.origin },
          });
        }
        item.append(actions, drawLines(recipe.name, variant, `${recipeIndex}-${variantIndex}`));
        list.append(item);
      });
      recipe.hidden.forEach((hidden, hiddenIndex) => {
        const item = element('li', undefined, 'variant deleted');
        item.dataset.variant = hidden.name;
        item.dataset.origin = hidden.origin;
        item.append(
          element('span', hidden.name, 'variant-name'),
          element('span', originLabel(hidden.origin), 'variant-origin'),
          element('span', DELETED_MARK, 'variant-deleted'),
        );
        const actions = element('span', undefined, 'variant-actions');
        const reset = button(RESET_LABEL, 'action', () =>
          vscode.postMessage({ type: 'resetVariant', recipe: recipe.name, original: { name: hidden.name, origin: hidden.origin } }),
        );
        reset.title = `Show ${hidden.name} again as its file holds it`;
        reset.dataset.focus = `variant-reset-${recipeIndex}-hidden-${hiddenIndex}`;
        actions.append(reset);
        item.append(actions);
        list.append(item);
      });
      block.append(list);
      part.append(block);
    });
    return part;
  }

  /** Where a single-task line comes from, as the settings view names it, a stored copy naming the line it stands in for. */
  function lineOriginLabel(line: SettingsLine): string {
    const copies = line.variant.copies;
    if (line.variant.origin === 'stored' && copies !== undefined && line.reset !== undefined) {
      return `stored copy of ${copies.origin === 'own' ? 'your' : 'the shipped'} line ${line.reset.recipe}`;
    }
    return originLabel(line.variant.origin, copies);
  }

  /**
   * The settings view's part of single-task line edits: the cause the lines could not be read, or
   * each named single-task line with its name, where it comes from, its Duplicate, Rename, and
   * Delete controls, a stored copy's Reset control too, and beneath it its one line with the line
   * editor it gets; after them each shipped or own line a hiding record hides, with its Reset
   * control alone. Every control posts its edit; the list is redrawn only from what the extension
   * posts.
   */
  function drawSingleTaskLines(): HTMLElement {
    const part = element('div', undefined, 'line-edits');
    part.append(element('h4', LINES_HEADING));
    const read = linesRead;
    if (read === undefined) {
      return part;
    }
    if (read.state === 'failed') {
      const box = element('div', undefined, 'notice');
      box.setAttribute('role', 'alert');
      box.append(element('p', LINES_FAILURE_LINE), element('pre', read.cause));
      part.append(box);
      return part;
    }
    const list = element('ul', undefined, 'variant-list');
    read.lines.forEach((line, lineIndex) => {
      const item = element('li', undefined, 'variant single-task-line');
      item.dataset.line = line.name;
      item.dataset.variant = line.variant.name;
      item.dataset.origin = line.variant.origin;
      const name = element('span', line.variant.name === line.name ? line.name : `${line.name} — ${line.variant.name}`, 'variant-name');
      name.title = line.line;
      item.append(name, element('span', lineOriginLabel(line), 'variant-origin'));
      if (!line.isDefault) {
        const mark = element('span', NOT_RUN_MARK, 'variant-default');
        mark.title = `The looped run takes another variant of ${line.name}`;
        item.append(mark);
      }
      const actions = element('span', undefined, 'variant-actions');
      const control = (label: string, key: string, hover: string, message: Record<string, unknown>): void => {
        const each = button(label, 'action', () => vscode.postMessage(message));
        each.title = hover;
        each.dataset.focus = `line-${key}-${lineIndex}`;
        actions.append(each);
      };
      const named = variantTarget(line.variant);
      control(DUPLICATE_LABEL, 'duplicate', `Type a name and add a copy of the line ${line.name}`, { type: 'duplicateLine', line: line.name, variant: named });
      control(RENAME_LABEL, 'rename', `Type a new name for the line ${line.name}`, { type: 'renameLine', line: line.name, variant: named });
      control(DELETE_LABEL, 'delete', `Take the line ${line.name} out of the named single-task lines`, { type: 'deleteLine', line: line.name, variant: named });
      if (line.reset !== undefined) {
        control(RESET_LABEL, 'reset', `Remove this stored copy and show ${line.reset.recipe} again as its file holds it`, {
          type: 'resetLine',
          line: line.reset.recipe,
          original: { name: line.reset.original.name, origin: line.reset.original.origin },
        });
      }
      const variant: SettingsVariant = { ...line.variant, lines: [line.line], editors: [line.editor], isDefault: line.isDefault };
      item.append(actions, drawLines(line.name, variant, `single-${lineIndex}`));
      list.append(item);
    });
    read.hidden.forEach((hidden, hiddenIndex) => {
      const item = element('li', undefined, 'variant deleted');
      item.dataset.line = hidden.name;
      item.dataset.variant = hidden.original.name;
      item.dataset.origin = hidden.original.origin;
      item.append(
        element('span', hidden.original.name === hidden.name ? hidden.name : `${hidden.name} — ${hidden.original.name}`, 'variant-name'),
        element('span', originLabel(hidden.original.origin), 'variant-origin'),
        element('span', DELETED_MARK, 'variant-deleted'),
      );
      const actions = element('span', undefined, 'variant-actions');
      const reset = button(RESET_LABEL, 'action', () =>
        vscode.postMessage({ type: 'resetLine', line: hidden.name, original: { name: hidden.original.name, origin: hidden.original.origin } }),
      );
      reset.title = `Show the line ${hidden.name} again as its file holds it`;
      reset.dataset.focus = `line-reset-hidden-${hiddenIndex}`;
      actions.append(reset);
      item.append(actions);
      list.append(item);
    });
    part.append(list);
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
    view.append(controls, drawHarnesses(), drawLists(), drawVariants(), drawSingleTaskLines());
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
    const discuss = fixedEntry('discussGoal', startingButtons.discussGoal, 'New mission', 'Type a goal and open an interactive discussion of it', 'recipe', undefined, undefined, (variant) =>
      vscode.postMessage({ type: 'missionButton', button: 'discussGoal', variant }),
    );
    const define = fixedEntry('defineMission', startingButtons.defineMission, 'Define mission', 'Type a goal and its scope and define the mission', 'recipe', undefined, undefined, (variant) =>
      vscode.postMessage({ type: 'missionButton', button: 'defineMission', variant }),
    );
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
      const alternativesHead = element('div', undefined, 'alternatives-head');
      alternativesHead.append(element('h5', 'Alternatives'));
      const shared = mission.buttons?.answerWithAlternative;
      const dropdown = fixedDropdown('answerWithAlternative', shared, 'Answer with this alternative', mission.path);
      if (dropdown !== undefined) {
        alternativesHead.append(dropdown);
      }
      part.append(alternativesHead);
      for (const alternative of question.alternatives) {
        const picked = pick !== undefined && alternative.id === pick.option;
        const entry = element('div', undefined, picked ? 'alternative picked' : 'alternative');
        const line = element('div', undefined, 'alternative-head');
        line.append(element('h6', picked ? `${alternative.id} (picked)` : alternative.id));
        line.append(
          fixedButton(shared, 'Answer with this alternative', `Record ${alternative.id} as the decision`, 'action', busy, (variant) =>
            vscode.postMessage({ type: 'alternativeButton', mission: mission.path, question: question.id, alternative: alternative.id, variant }),
          ),
        );
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
    head.append(
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
    variantOptions(choice, recipe.variants, recipe.selected);
    choice.addEventListener('change', () => {
      const variant = recipe.variants[Number(choice.value)];
      if (variant !== undefined) {
        vscode.postMessage({ type: 'selectVariant', mission: mission.path, recipe: recipe.name, variant: variant.name });
      }
    });
    return choice;
  }

  /** Appends to `choice` one option per variant of `variants`, in order, a variant of the person's own marked as theirs, the one at `selected` selected. */
  function variantOptions(choice: HTMLSelectElement, variants: PageVariantChoice[], selected: number): void {
    variants.forEach((variant, index) => {
      const option = element('option', variant.own ? `${variant.name}${OWN_VARIANT_MARK}` : variant.name);
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
      startingButtons = message.buttons ?? {};
      drawn = 'live';
      for (const mission of [...previews.keys()]) {
        if (!missions.some((each) => each.path === mission)) {
          previews.delete(mission);
        }
      }
      draw();
    } else if (message.type === 'liveFailure') {
      startingButtons = message.buttons ?? {};
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
    } else if (
      message.type === 'harnessCheck' ||
      message.type === 'harnessSettings' ||
      message.type === 'harnessLists' ||
      message.type === 'variants' ||
      message.type === 'singleTaskLines'
    ) {
      if (message.type === 'harnessCheck') {
        harnessCheck = message.check;
      } else if (message.type === 'harnessSettings') {
        harnessSettings = message.settings;
      } else if (message.type === 'harnessLists') {
        harnessLists = message.lists;
      } else if (message.type === 'variants') {
        variantsRead = message.variants;
      } else {
        linesRead = message.lines;
      }
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
