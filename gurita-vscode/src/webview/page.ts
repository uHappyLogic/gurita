// The mission pane's page script. On every load it posts a ready message and draws what the
// extension answers: a row of tabs, one per live mission in the order `missions.py live` prints
// them, each showing the mission's title with its path as a tooltip, and the selected mission's
// page beneath; or the one failure state in place of the pages. Every value is drawn as text,
// never as markup, since it comes from the workspace.

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

(() => {
  interface Mission {
    path: string;
    state: string;
    title: string;
  }

  type PaneMessage =
    | { type: 'live'; missions: Mission[] }
    | { type: 'liveFailure'; cause: string };

  interface PageState {
    selected?: string;
  }

  const FAILURE_LINE = 'The live missions could not be read.';
  const NO_MISSION_LINE = 'No mission is live.';

  const vscode = acquireVsCodeApi();
  const root = document.getElementById('root') as HTMLElement;
  const saved = (vscode.getState() ?? {}) as PageState;
  let selected: string | undefined = saved.selected;
  let missions: Mission[] = [];

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

  function select(path: string): void {
    selected = path;
    vscode.setState({ ...((vscode.getState() ?? {}) as PageState), selected: path });
    draw();
  }

  function drawTabs(): HTMLElement {
    const tabs = element('div', undefined, 'tabs');
    tabs.setAttribute('role', 'tablist');
    for (const mission of missions) {
      const tab = element('button', mission.title);
      tab.type = 'button';
      tab.title = mission.path;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(mission.path === selected));
      tab.addEventListener('click', () => select(mission.path));
      tabs.append(tab);
    }
    return tabs;
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
    page.append(facts);
    return page;
  }

  function draw(): void {
    if (!missions.some((mission) => mission.path === selected)) {
      selected = missions[0]?.path;
    }
    const shown = missions.find((mission) => mission.path === selected);
    root.replaceChildren(drawTabs());
    root.append(shown === undefined ? element('p', NO_MISSION_LINE) : drawPage(shown));
  }

  function drawFailure(cause: string): void {
    const failure = element('section', undefined, 'failure');
    failure.append(element('p', FAILURE_LINE), element('pre', cause));
    root.replaceChildren(failure);
  }

  window.addEventListener('message', (event: MessageEvent<PaneMessage>) => {
    const message = event.data;
    if (message.type === 'live') {
      missions = message.missions;
      draw();
    } else if (message.type === 'liveFailure') {
      drawFailure(message.cause);
    }
  });

  vscode.postMessage({ type: 'ready' });
})();
