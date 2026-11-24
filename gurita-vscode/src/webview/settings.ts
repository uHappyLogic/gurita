// The Settings window's page script. On every load, the window opened or shown again included, it
// posts a ready message and draws the settings from what the extension answers. The window belongs
// to no mission, holds buttons and dropdowns only, and draws no close control of its own: it is
// closed as any editor tab is. Its parts stand one beneath the other under their headings,
// Harnesses, Models and efforts, Variants, and Single-task lines, each drawn from what the
// extension last posted for it and redrawn whenever it posts it again.
//
// Under Harnesses the window lists Claude Code, Antigravity, and Codex, each with the checks it
// passed or the one that failed first, named: CLI not found, Gurita plugin not installed, or
// installed version older than the packaged one, with the versions read. For Claude Code it also
// names every scope a Gurita copy applying to the project was detected at: the winning scope first,
// as the one in effect, the others after it as also installed, with the one version the status
// shows being the winner's; a disabled winner's scope is marked disabled. For a copy installed but
// disabled the status says, in place of plugin not installed, that the copy is disabled and must
// be enabled in the harness itself: in Claude Code through its `/plugin` menu or
// `claude plugin enable`, in Antigravity with `agy plugin enable gurita`, and in Codex through its
// own plugin settings; the window adds no control of its own to enable it. When Claude Code's or
// Codex's Gurita copy or its marketplace named `gurita` comes from a source other than the
// harness's distribution repository, the window states the source found and the CLI commands
// that would switch the harness to that repository. Every harness whose check found its CLI and
// that has an install to offer gets an Install control: Antigravity or Codex holding no copy, and
// Claude Code while any of user, project, and local holds no copy applying to the project, a
// disabled copy's scope counting as held, user alone when no workspace folder is open; none is
// drawn for a disabled Antigravity or Codex copy, a copy from another source, or a listing that
// could not be read. A click posts the install to the extension at once, with no confirmation, on
// Claude Code with the scopes on offer, among which VS Code's own quick pick asks for one, and the
// control is drawn disabled while an install or update run is going. Every harness whose check found its CLI and an
// installed Gurita copy gets an Update control, whether or not the copy's version is older than the
// packaged one, and none whose copy is disabled or comes from another source: a click posts the
// update to the extension at once, with no confirmation, on Claude Code over every scope a copy
// applying to the project was detected at, and the control is drawn disabled while an install or
// update run is going. Its check-again
// control, disabled while a check runs and while an install or update run is going, asks the
// extension to run the check afresh. While the extension posts an install or update run as going,
// the window says beneath the harnesses which harness it installs or updates the plugin on, its
// terminal showing the run, and redraws once the extension posts that none is. The extension
// runs the check on the first opening of the window in the extension's session and otherwise
// posts the result it keeps. Beside each harness the window also shows whether it is enabled,
// with one control that disables an enabled harness or enables a disabled one, posted to the
// extension, which stores the state and posts it again. The control is drawn whatever the check
// reports, while it runs or could not run included, and the state is redrawn only from what the
// extension posts. Under Models and efforts the window draws each harness's model list and its
// one effort list, Codex's model list alone: each entry with its remove control, and each list
// with its add control, each posted to the extension, which asks for an added entry in VS Code's
// own input box, writes the change, and posts the lists again. Under Variants the window draws
// every recipe the extension posts, the chains, the seven fixed-name button recipes, and the
// recipes and variants of the own recipe file, the named single-task lines left out: each variant
// with where it comes from, whether it is the recipe's default, and its Duplicate, Rename, Delete,
// and Make default controls, a stored variant the extension posts with the variant it was made
// from also its Reset control, which returns its lines to that variant's and keeps its name, and
// each variant a hiding record hides with its Reset control alone, which shows it again. Each
// control posts its edit to the extension, which asks for a duplicate's name or a new name in
// VS Code's own input box, writes the edit to the variant store, and posts the variants again.
// Beneath each listed variant its line editor draws each line as the row the extension posts for
// it: a line of a known harness running a `gurita:` skill as the skill's bare name, an
// `interactive` mark beside it when the line is not headless, and the line as written in its hover
// text, followed on the right by its harness's name, and every other line, a shell step, the slot
// line `<single-task line>`, and a command the extension does not know, as its text. Only a line
// the extension posts with an editor, a `claude` or `agy` line carrying both `--model` and
// `--effort`, gets a model and an effort dropdown after its harness, a Codex line carrying `-m` its
// model dropdown alone, every other line staying read-only. A line with both dropdowns shows its
// harness as a dropdown offering Claude Code and Antigravity, standing on the one it runs on, in
// the harness's place on a skill row and before the model dropdown on a line drawn as its text; a
// pick of the other posts the line and the harness to the extension, which rewrites the line onto
// it, and every other line keeps its harness as text. The model dropdown offers the harness's
// model list and the effort dropdown its whole effort list, whatever the line's model, as the
// extension last posted them, each standing on the value the line carries, offered too when the
// list lacks it. A model or effort pick posts the line, the kind, and the value to the extension,
// which replaces the value the line carries. Under Single-task lines the window draws every named
// single-task line the extension posts, shipped and own alike: each with where it comes from, its
// Duplicate, Rename, and Delete controls, a stored copy also its Reset control, and its one line
// beneath with the line editor it gets, and each line a hiding record hides with its Reset control
// alone. Under both headings each variant, a deleted one included, is drawn as a card of its own,
// indented under its recipe's or line's heading, a line down its left edge and space between it
// and the next; the cards change only how the window looks. Every value is drawn as text, never as
// markup, since it comes from the workspace and the person's own files. On every load, before
// anything is posted, the page saves one fixed state with `setState` naming the Settings window, so
// a window restored after a restart or a window reload is known to the extension as this one.

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

(() => {
  type RecipeGroup = 'shipped' | 'own';

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
    /** The scopes a copy was detected at, the one in effect first; Claude Code's alone. */
    scopes?: string[];
    /** Set when the harness's copy, Claude Code's in effect at the first of `scopes`, is installed but disabled. */
    disabled?: true;
    /** The other source the copy or the `gurita` marketplace comes from, with the commands that switch it to the distribution repository. */
    source?: { found: string; repository: string; commands: string[] };
  }

  /** The harness check: running, every harness's outcome, or the cause it could not be run. */
  type HarnessCheck = { state: 'running' } | { state: 'checked'; harnesses: HarnessOutcome[] } | { state: 'failed'; cause: string };

  /** The install or update run going: its harness's key, its action, and its Claude Code scopes. */
  interface PluginRun {
    harness: string;
    action: 'install' | 'update';
    scopes: string[];
  }

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

  /** One variant as the window lists it. */
  interface SettingsVariant {
    name: string;
    origin: VariantOrigin;
    /** The shipped or own variant a stored copy stands in for. */
    copies?: ReadVariantRef;
    lines: string[];
    /** The line editor each line gets, in the lines' order, null for a line shown read-only. */
    editors?: (LineEditor | null)[];
    /** The row each line is drawn as, in the lines' order, null for a line drawn as its text. */
    rows?: (LineRow | null)[];
    isDefault: boolean;
    /** For a stored variant, the variant it was made from, whose lines its reset returns it to. */
    from?: { name: string; origin: VariantOrigin; recipe?: string };
  }

  /** The row a line running a `gurita:` skill is drawn as: the skill, whether the line is interactive, and its harness's key. */
  interface LineRow {
    skill: string;
    interactive: boolean;
    harness: string;
  }

  /** The dropdowns one line gets: the harness whose lists they offer, its model, and its effort where it gets an effort dropdown. */
  interface LineEditor {
    harness: string;
    model: string;
    effort?: string;
  }

  /** One recipe as the window lists it, with its variants and those a hiding record hides. */
  interface SettingsRecipe {
    name: string;
    group: RecipeGroup;
    /** Whether a button outside the recipe list runs it by its fixed name. */
    fixed: boolean;
    variants: SettingsVariant[];
    hidden: ReadVariantRef[];
  }

  /** The recipes and variants the window edits, or the cause they could not be read. */
  type VariantsRead = { state: 'read'; recipes: SettingsRecipe[] } | { state: 'failed'; cause: string };

  /** One named single-task line as the window lists it, its variants beneath it. */
  interface SettingsLine {
    /** The line's name, the one the looped run, the rule file, and the override list use. */
    name: string;
    group: RecipeGroup;
    /** Its single-task variants, its `default` and its customs, the default the one the looped run passes. */
    variants: SettingsVariant[];
    /** The shipped and own variants of the line a hiding record hides. */
    hidden: ReadVariantRef[];
    /** The shipped or own line of another name a renamed line stands in for, which its reset shows again. */
    reset?: { recipe: string; original: ReadVariantRef };
  }

  /** The named single-task lines the window edits, or the cause they could not be read. */
  type LinesRead = { state: 'read'; lines: SettingsLine[] } | { state: 'failed'; cause: string };

  type SettingsMessage =
    | { type: 'harnessCheck'; check: HarnessCheck }
    | { type: 'pluginRun'; run: PluginRun | null }
    | { type: 'workspace'; folderOpen: boolean }
    | { type: 'harnessSettings'; settings: HarnessSettings }
    | { type: 'harnessLists'; lists: HarnessLists }
    | { type: 'variants'; variants: VariantsRead }
    | { type: 'singleTaskLines'; lines: LinesRead };

  /** The heading of the settings. */
  const SETTINGS_LABEL = 'Settings';
  /** The state the page saves on every load, naming the Settings window for a restore after a reload. */
  const SAVED_STATE = { window: 'settings' };
  const CHECK_AGAIN_LABEL = 'Check again';
  const HARNESSES_HEADING = 'Harnesses';
  const CHECKING_LINE = 'Checking the harnesses…';
  /** What the window says of the run going beside where it runs. */
  const RUN_TERMINAL_NOTE = 'Its terminal shows the run.';
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
  const FIXED_NOTE = 'Run by a button outside the action list, which runs this default until another variant is selected beside it.';
  const LINES_HEADING = 'Single-task lines';
  const LINES_FAILURE_LINE = 'The single-task lines could not be read.';
  /** The mark beside a skill row whose line is not headless. */
  const INTERACTIVE_MARK = 'interactive';
  /** Each of a harness's two lists, with its kind, its label, and its add control's label. */
  const LISTS: ['model' | 'effort', string, string][] = [
    ['model', 'Models', 'Add model'],
    ['effort', 'Efforts', 'Add effort'],
  ];
  /** The three harnesses the window lists, in its order, each with its key and its name. */
  const HARNESSES: [string, string][] = [
    ['claude', 'Claude Code'],
    ['antigravity', 'Antigravity'],
    ['codex', 'Codex'],
  ];
  /** The harnesses a line's harness dropdown picks between, by key: a Codex line keeps its harness. */
  const LINE_HARNESSES = ['claude', 'antigravity'];
  /** The control that updates a harness's installed Gurita copy. */
  const UPDATE_LABEL = 'Update';
  /** The control that installs the Gurita plugin on a harness. */
  const INSTALL_LABEL = 'Install';
  /** Claude Code's scopes, in the order an update takes them. */
  const CLAUDE_SCOPES = ['user', 'project', 'local'];
  const ENABLED_LABEL = 'Enabled';
  const DISABLED_LABEL = 'Disabled';
  const ENABLE_LABEL = 'Enable';
  const DISABLE_LABEL = 'Disable';
  /** The name of each of a harness's three checks, as the window names the one that failed. */
  const FAILED_CHECKS: Record<FailedCheck, string> = {
    cli: 'CLI not found',
    plugin: 'Gurita plugin not installed',
    version: 'Installed version older than the packaged one',
  };
  /** What the window says of a harness's copy that is installed but disabled, by the harness's key. */
  const DISABLED_COPY_LINES: Record<string, string> = {
    claude:
      'Gurita plugin disabled: the copy in effect is disabled and must be enabled in Claude Code itself, through its /plugin menu or claude plugin enable.',
    antigravity: 'Gurita plugin disabled: the copy is disabled and must be enabled in Antigravity itself, with agy plugin enable gurita.',
    codex: 'Gurita plugin disabled: the copy is disabled and must be enabled in Codex itself, through its own plugin settings.',
  };

  const vscode = acquireVsCodeApi();
  const root = document.getElementById('root') as HTMLElement;
  /** The harness check the extension last posted; undefined until one is posted. */
  let harnessCheck: HarnessCheck | undefined;
  /** The install or update run the extension last posted as going; undefined while none is. */
  let pluginRun: PluginRun | undefined;
  /** Whether a workspace folder is open, as the extension last posted it; none counted until it is posted. */
  let folderOpen = false;
  /** Each harness's enabled state the extension last posted; undefined until one is posted. */
  let harnessSettings: HarnessSettings | undefined;
  /** Each harness's lists the extension last posted; undefined until they are posted. */
  let harnessLists: HarnessLists | undefined;
  /** The recipes and variants the extension last posted; undefined until they are posted. */
  let variantsRead: VariantsRead | undefined;
  /** The named single-task lines the extension last posted; undefined until they are posted. */
  let linesRead: LinesRead | undefined;

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

  /** What a harness's checks gave: every check passing, or the one that failed first, named, with what it read. */
  function harnessStatus(outcome: HarnessOutcome): string {
    const installed = outcome.installed ?? 'unknown';
    const packaged = outcome.packaged ?? 'unknown';
    if (outcome.failed === undefined) {
      return installed === packaged
        ? `Every check passes: Gurita ${installed} is installed, the packaged version.`
        : `Every check passes: Gurita ${installed} is installed, newer than the packaged ${packaged}.`;
    }
    if (outcome.failed === 'cli') {
      return `${FAILED_CHECKS.cli}: the runner's shell finds no ${outcome.cli} command.`;
    }
    if (outcome.failed === 'plugin' && outcome.disabled === true && DISABLED_COPY_LINES[outcome.key] !== undefined) {
      return DISABLED_COPY_LINES[outcome.key];
    }
    if (outcome.failed === 'plugin') {
      return outcome.detail !== undefined ? `${FAILED_CHECKS.plugin}: ${outcome.detail}` : `${FAILED_CHECKS.plugin}.`;
    }
    return `${FAILED_CHECKS.version}: installed ${installed}, packaged ${packaged}.`;
  }

  /**
   * The scopes a harness's copy was detected at: the first, the scope in effect, marked disabled
   * when its copy is, then the others as also installed; undefined when the outcome names none.
   */
  function harnessScopes(outcome: HarnessOutcome): string | undefined {
    const scopes = outcome.scopes ?? [];
    if (scopes.length === 0) {
      return undefined;
    }
    const [winner, ...others] = scopes;
    const inEffect = `In effect at ${winner} scope${outcome.disabled === true ? ', disabled' : ''}`;
    if (others.length === 0) {
      return `${inEffect}.`;
    }
    const also = others.length === 1 ? `${others[0]} scope` : `${others.slice(0, -1).join(', ')} and ${others[others.length - 1]} scopes`;
    return `${inEffect}; also installed at ${also}.`;
  }

  /**
   * The other source a harness's copy or `gurita` marketplace comes from, named, with the CLI
   * commands, one per line, that would switch the harness to its distribution repository;
   * undefined when the outcome names none.
   */
  function drawSource(outcome: HarnessOutcome): HTMLElement | undefined {
    const source = outcome.source;
    if (source === undefined) {
      return undefined;
    }
    const part = element('div', undefined, 'harness-source');
    part.dataset.source = source.found;
    part.append(
      element(
        'p',
        `The Gurita plugin comes from another source: ${source.found}, not the distribution repository ${source.repository}. ` +
          `To switch ${outcome.name} to its distribution repository, run:`,
        'harness-source-line',
      ),
      element('pre', source.commands.join('\n'), 'harness-source-commands'),
    );
    return part;
  }

  /**
   * The scopes an update of a harness's copy acts at, when the window offers one: an update is
   * offered for a harness whose check found its CLI and an installed Gurita copy, whether or not
   * that copy's version is older than the packaged one, and for none whose copy is disabled or comes
   * from another source. On Claude Code it acts at every scope a copy applying to the project was
   * detected at, in the order user, project, local, and is offered only when one was; Antigravity
   * and Codex take no scope. Undefined when no update is offered.
   */
  function updateScopes(outcome: HarnessOutcome): string[] | undefined {
    if (outcome.failed === 'cli' || outcome.failed === 'plugin' || outcome.disabled === true || outcome.source !== undefined) {
      return undefined;
    }
    if (outcome.key !== 'claude') {
      return [];
    }
    const detected = outcome.scopes ?? [];
    const scopes = CLAUDE_SCOPES.filter((scope) => detected.includes(scope));
    return scopes.length === 0 ? undefined : scopes;
  }

  /**
   * A harness's Update control, which starts the update at once, with no confirmation, by posting
   * it to the extension, on Claude Code over `scopes`; drawn disabled while an install or update
   * run is going.
   */
  function drawUpdate(outcome: HarnessOutcome, scopes: string[], going: boolean): HTMLButtonElement {
    const update = button(UPDATE_LABEL, 'action', () =>
      vscode.postMessage({ type: 'runPlugin', harness: outcome.key, action: 'update', ...(outcome.key === 'claude' ? { scopes } : {}) }),
    );
    const at = scopes.length === 0 ? '' : ` at ${scopes.length === 1 ? `${scopes[0]} scope` : `${scopes.slice(0, -1).join(', ')} and ${scopes[scopes.length - 1]} scopes`}`;
    update.title = `Update the Gurita plugin on ${outcome.name} to the latest published release${at}`;
    update.disabled = going;
    update.dataset.harness = outcome.key;
    update.dataset.focus = `update-${outcome.key}`;
    return update;
  }

  /**
   * The scopes an install on a harness is offered at, when the window offers one: none for a CLI
   * not found, a listing that could not be read, or a copy or `gurita` marketplace from another
   * source. Antigravity and Codex are offered an install, at no scope, while they hold no copy, a
   * copy installed but disabled counting as held. Claude Code is offered one at every scope of
   * user, project, and local that holds no copy applying to the project, a disabled copy's scope
   * counting as held, user alone when no workspace folder is open, and only while one is free.
   * Undefined when no install is offered.
   */
  function installScopes(outcome: HarnessOutcome): string[] | undefined {
    if (outcome.failed === 'cli' || outcome.detail !== undefined || outcome.source !== undefined) {
      return undefined;
    }
    if (outcome.key !== 'claude') {
      return outcome.failed === 'plugin' && outcome.disabled !== true ? [] : undefined;
    }
    const held = outcome.scopes ?? [];
    const free = CLAUDE_SCOPES.filter((scope) => !held.includes(scope) && (folderOpen || scope === 'user'));
    return free.length === 0 ? undefined : free;
  }

  /**
   * A harness's Install control, which starts the install at once, with no confirmation, by posting
   * it to the extension, on Claude Code with the scopes on offer, among which VS Code's own quick
   * pick asks for one; drawn disabled while an install or update run is going.
   */
  function drawInstall(outcome: HarnessOutcome, scopes: string[], going: boolean): HTMLButtonElement {
    const install = button(INSTALL_LABEL, 'action', () =>
      vscode.postMessage({ type: 'installPlugin', harness: outcome.key, ...(outcome.key === 'claude' ? { scopes } : {}) }),
    );
    const at =
      scopes.length === 0
        ? ''
        : scopes.length === 1
          ? ` at ${scopes[0]} scope`
          : ` at the scope you pick of ${scopes.slice(0, -1).join(', ')} and ${scopes[scopes.length - 1]}`;
    install.title = `Install the Gurita plugin on ${outcome.name} from the latest published release${at}`;
    install.disabled = going;
    install.dataset.harness = outcome.key;
    install.dataset.focus = `install-${outcome.key}`;
    return install;
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
      ? `Leave every variant with a line on ${name} out of the mission pages' action lists`
      : `List the variants with a line on ${name} on the mission pages again`;
    toggle.setAttribute('aria-pressed', String(!enabled));
    toggle.dataset.focus = `harness-${key}`;
    part.append(element('span', enabled ? ENABLED_LABEL : DISABLED_LABEL, 'harness-state'), toggle);
    return part;
  }

  /**
   * The window's harness part: that the check runs or could not be run, then each harness
   * with what its checks gave, when they gave anything, its Install and Update controls where offered,
   * and whether it is enabled, with its enable or disable control, the install or update run going,
   * when one is, and the check-again control, disabled while a check runs or a run is going, as the
   * Install and Update controls are while a run is going.
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
    const run = pluginRun;
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
        const scopes = harnessScopes(outcome);
        if (scopes !== undefined) {
          const shown = element('span', scopes, outcome.disabled === true ? 'harness-scopes disabled' : 'harness-scopes');
          shown.dataset.scopes = (outcome.scopes ?? []).join(' ');
          item.append(shown);
        }
        const installed = installScopes(outcome);
        if (installed !== undefined) {
          item.append(drawInstall(outcome, installed, run !== undefined));
        }
        const updated = updateScopes(outcome);
        if (updated !== undefined) {
          item.append(drawUpdate(outcome, updated, run !== undefined));
        }
      }
      if (settings?.state === 'read') {
        item.append(drawEnabled(key, outcome?.name ?? name, settings.enabled[key] !== false));
      }
      const source = outcome === undefined ? undefined : drawSource(outcome);
      if (source !== undefined) {
        item.append(source);
      }
      list.append(item);
    }
    part.append(list);
    if (run !== undefined) {
      const name = HARNESSES.find(([key]) => key === run.harness)?.[1] ?? run.harness;
      const going = element('p', `${run.action === 'install' ? 'Installing' : 'Updating'} the Gurita plugin on ${name}… ${RUN_TERMINAL_NOTE}`, 'plugin-run');
      going.dataset.harness = run.harness;
      going.setAttribute('role', 'status');
      part.append(going);
    }
    const controls = element('div', undefined, 'controls');
    const again = button(CHECK_AGAIN_LABEL, 'control', () => vscode.postMessage({ type: 'checkHarnesses' }));
    again.title = "Run the harness check again: each harness's CLI, its Gurita plugin, and that copy's version";
    again.disabled = check === undefined || check.state === 'running' || run !== undefined;
    again.dataset.focus = 'check-again';
    controls.append(again);
    part.append(controls);
    return part;
  }

  /**
   * The window's part of model and effort lists: the cause they could not be read, or for
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

  /** Where a variant comes from, as the window names it. */
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
   * The harness dropdown of a line posted with model and effort dropdowns, offering Claude Code and
   * Antigravity and standing on the harness the line runs on; a pick of the other posts it for the
   * line.
   */
  function harnessDropdown(recipe: string, variant: SettingsVariant, focus: string, lineIndex: number, current: string): HTMLSelectElement {
    const choice = element('select', undefined, 'line-harness');
    choice.setAttribute('aria-label', `The harness of line ${lineIndex + 1} of ${variant.name} in ${recipe}`);
    choice.title = 'Pick the harness this line runs on';
    choice.dataset.focus = `line-harness-${focus}-${lineIndex}`;
    for (const [key, name] of HARNESSES.filter(([key]) => LINE_HARNESSES.includes(key))) {
      const option = element('option', name);
      option.value = key;
      option.selected = key === current;
      choice.append(option);
    }
    choice.addEventListener('change', () => {
      if (choice.value !== current && LINE_HARNESSES.includes(choice.value)) {
        vscode.postMessage({ type: 'replaceLineHarness', recipe, variant: variantTarget(variant), line: lineIndex, harness: choice.value });
      }
    });
    return choice;
  }

  /**
   * A variant's line editor: a line posted with a row as its skill's name, its interactive mark
   * where it is not headless, and its harness, the line as written in its hover text, every other
   * line as its text; a line posted with an editor followed by its model dropdown and, where it
   * gets one, its effort dropdown, every other line read-only. A line with both dropdowns, on
   * Claude Code or Antigravity, shows its harness as a dropdown picking between the two, in the
   * place a skill row's harness stands and before the model dropdown on a line drawn as its text; a
   * Codex line keeps its harness as text.
   */
  function drawLines(recipe: string, variant: SettingsVariant, focus: string): HTMLElement {
    const list = element('ul', undefined, 'variant-lines');
    variant.lines.forEach((line, lineIndex) => {
      const row = variant.rows?.[lineIndex];
      const editor = variant.editors?.[lineIndex];
      const switchable = editor !== undefined && editor !== null && editor.effort !== undefined && LINE_HARNESSES.includes(editor.harness);
      const item = element('li', undefined, row !== undefined && row !== null ? 'variant-line skill-line' : 'variant-line');
      if (row !== undefined && row !== null) {
        const label = element('span', undefined, 'line-label');
        label.title = line;
        label.append(element('code', row.skill, 'line-skill'));
        if (row.interactive) {
          label.append(element('span', INTERACTIVE_MARK, 'line-interactive'));
        }
        item.append(label);
        if (!switchable) {
          const harness = HARNESSES.find(([key]) => key === row.harness)?.[1] ?? row.harness;
          item.append(element('span', harness, 'line-harness'));
        }
      } else {
        item.append(element('code', line, 'line-text'));
      }
      if (switchable) {
        item.append(harnessDropdown(recipe, variant, focus, lineIndex, editor.harness));
      }
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
   * The window's part of variant edits: the cause the variants could not be read, or each
   * recipe with its variants, each named with where it comes from and whether it is the default,
   * and its duplicate, rename, delete, and default controls, a stored variant's reset control too,
   * returning its lines to those of the variant it was made from, and
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
        list.append(drawVariantItem(recipe.name, variant, `variant-%-${recipeIndex}-${variantIndex}`, `${recipeIndex}-${variantIndex}`));
      });
      recipe.hidden.forEach((hidden, hiddenIndex) => {
        list.append(
          drawHiddenItem(hidden, `variant-reset-${recipeIndex}-hidden-${hiddenIndex}`, {
            type: 'resetVariant',
            recipe: recipe.name,
            original: { name: hidden.name, origin: hidden.origin },
          }),
        );
      });
      block.append(list);
      part.append(block);
    });
    return part;
  }

  /**
   * One listed variant of the recipe `recipe` in the window: its name, where it comes from,
   * whether it is the default, its duplicate, rename, delete, and default controls, a stored
   * variant's reset control too, returning its lines to those of the variant it was made from, and
   * beneath them its line editor, drawn as a card of its own. `key` names each control's focus key,
   * its `%` standing for the control, and `focus` the line editor's.
   */
  function drawVariantItem(recipe: string, variant: SettingsVariant, key: string, focus: string): HTMLElement {
    const item = element('li', undefined, variant.isDefault ? 'variant variant-card default' : 'variant variant-card');
    item.dataset.variant = variant.name;
    item.dataset.origin = variant.origin;
    const name = element('span', variant.name, 'variant-name');
    name.title = variant.lines.join('\n');
    item.append(name, element('span', originLabel(variant.origin, variant.copies), 'variant-origin'));
    if (variant.isDefault) {
      item.append(element('span', DEFAULT_MARK, 'variant-default'));
    }
    const actions = element('span', undefined, 'variant-actions');
    const control = (label: string, which: string, hover: string, message: Record<string, unknown>): void => {
      const each = button(label, 'action', () => vscode.postMessage(message));
      each.title = hover;
      each.dataset.focus = key.replace('%', which);
      actions.append(each);
    };
    const named = variantTarget(variant);
    control(DUPLICATE_LABEL, 'duplicate', `Type a name and add a copy of ${variant.name} to ${recipe}`, {
      type: 'duplicateVariant',
      recipe,
      variant: named,
    });
    control(RENAME_LABEL, 'rename', `Type a new name for ${variant.name}`, { type: 'renameVariant', recipe, variant: named });
    control(DELETE_LABEL, 'delete', `Take ${variant.name} out of ${recipe}`, { type: 'deleteVariant', recipe, variant: named });
    if (!variant.isDefault) {
      control(PICK_DEFAULT_LABEL, 'default', `Make ${variant.name} the variant ${recipe} runs by default`, {
        type: 'pickDefault',
        recipe,
        variant: named,
      });
    }
    if (variant.origin === 'stored' && variant.from !== undefined) {
      control(RESET_LABEL, 'reset', `Return the lines of ${variant.name} to those of ${variant.from.name}, keeping its name`, {
        type: 'resetVariantLines',
        recipe,
        variant: named,
      });
    }
    item.append(actions, drawLines(recipe, variant, focus));
    return item;
  }

  /** One shipped or own variant a hiding record hides, marked deleted, drawn as a card of its own with the reset control alone, posting `reset`. */
  function drawHiddenItem(hidden: ReadVariantRef, focus: string, reset: Record<string, unknown>): HTMLElement {
    const item = element('li', undefined, 'variant variant-card deleted');
    item.dataset.variant = hidden.name;
    item.dataset.origin = hidden.origin;
    item.append(
      element('span', hidden.name, 'variant-name'),
      element('span', originLabel(hidden.origin), 'variant-origin'),
      element('span', DELETED_MARK, 'variant-deleted'),
    );
    const actions = element('span', undefined, 'variant-actions');
    const each = button(RESET_LABEL, 'action', () => vscode.postMessage(reset));
    each.title = `Show ${hidden.name} again as its file holds it`;
    each.dataset.focus = focus;
    actions.append(each);
    item.append(actions);
    return item;
  }

  /**
   * The window's part of single-task line edits: the cause the lines could not be read, or
   * each named single-task line under its name, the one the looped run, the rule file, and the
   * override list use, with the line's Duplicate, Rename, and Delete controls, acting on its default
   * variant, and a renamed line's Reset control too, showing the line it stands in for again; beneath
   * it its variants, its `default` and its customs, each drawn with the controls and line editor
   * any recipe's variant gets, Make default choosing the variant the looped run passes as the line's
   * `--line`, and after them each variant a hiding record hides, with its Reset control alone.
   * Every control posts its edit; the list is redrawn only from what the extension posts.
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
    read.lines.forEach((line, lineIndex) => {
      const block = element('div', undefined, 'variant-recipe single-task-line');
      block.dataset.line = line.name;
      const heading = element('h5', undefined, 'line-heading');
      heading.append(element('span', line.name, 'line-name'));
      const standing = line.variants.find((each) => each.isDefault);
      const actions = element('span', undefined, 'line-actions');
      const control = (label: string, key: string, hover: string, message: Record<string, unknown>): void => {
        const each = button(label, 'action', () => vscode.postMessage(message));
        each.title = hover;
        each.dataset.focus = `line-${key}-${lineIndex}`;
        actions.append(each);
      };
      if (standing !== undefined) {
        const named = variantTarget(standing);
        control(DUPLICATE_LABEL, 'duplicate', `Type a name and add a copy of the line ${line.name}`, { type: 'duplicateLine', line: line.name, variant: named });
        control(RENAME_LABEL, 'rename', `Type a new name for the line ${line.name}`, { type: 'renameLine', line: line.name, variant: named });
        control(DELETE_LABEL, 'delete', `Take the line ${line.name} out of the named single-task lines`, { type: 'deleteLine', line: line.name, variant: named });
      }
      if (line.reset !== undefined) {
        control(RESET_LABEL, 'reset', `Remove this stored copy and show ${line.reset.recipe} again as its file holds it`, {
          type: 'resetLine',
          line: line.reset.recipe,
          original: { name: line.reset.original.name, origin: line.reset.original.origin },
        });
      }
      heading.append(actions);
      block.append(heading);
      if (line.reset !== undefined) {
        block.append(element('p', `Renamed from the ${line.reset.original.origin === 'own' ? 'own' : 'shipped'} line ${line.reset.recipe}`, 'variant-note'));
      }
      const list = element('ul', undefined, 'variant-list');
      line.variants.forEach((variant, variantIndex) => {
        list.append(drawVariantItem(line.name, variant, `line-variant-%-${lineIndex}-${variantIndex}`, `single-${lineIndex}-${variantIndex}`));
      });
      line.hidden.forEach((hidden, hiddenIndex) => {
        list.append(
          drawHiddenItem(hidden, `line-reset-${lineIndex}-hidden-${hiddenIndex}`, {
            type: 'resetLine',
            line: line.name,
            original: { name: hidden.name, origin: hidden.origin },
          }),
        );
      });
      block.append(list);
      part.append(block);
    });
    return part;
  }

  /**
   * The settings, belonging to no mission: their heading, then the harness check, the model and
   * effort lists, the variants, and the single-task lines. They hold buttons and dropdowns only.
   */
  function drawSettings(): HTMLElement {
    const view = element('section', undefined, 'settings');
    view.setAttribute('role', 'region');
    view.setAttribute('aria-label', SETTINGS_LABEL);
    view.append(element('h3', SETTINGS_LABEL), drawHarnesses(), drawLists(), drawVariants(), drawSingleTaskLines());
    return view;
  }

  /** Redraws the whole window in place, keeping the scroll position and the focus on the control that held it. */
  function draw(): void {
    const scrolled = window.scrollY;
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.focus : undefined;
    root.replaceChildren(drawSettings());
    window.scrollTo(0, scrolled);
    if (focused !== undefined) {
      const again = root.querySelector<HTMLButtonElement>(`[data-focus="${focused}"]`);
      if (again !== null && !again.disabled) {
        again.focus();
      }
    }
  }

  window.addEventListener('message', (event: MessageEvent<SettingsMessage>) => {
    const message = event.data;
    if (message.type === 'harnessCheck') {
      harnessCheck = message.check;
    } else if (message.type === 'pluginRun') {
      pluginRun = message.run ?? undefined;
    } else if (message.type === 'workspace') {
      folderOpen = message.folderOpen === true;
    } else if (message.type === 'harnessSettings') {
      harnessSettings = message.settings;
    } else if (message.type === 'harnessLists') {
      harnessLists = message.lists;
    } else if (message.type === 'variants') {
      variantsRead = message.variants;
    } else if (message.type === 'singleTaskLines') {
      linesRead = message.lines;
    } else {
      return;
    }
    draw();
  });

  draw();
  vscode.setState(SAVED_STATE);
  vscode.postMessage({ type: 'ready' });
})();
