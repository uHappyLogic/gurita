// A finished mission's window's page script. On every load it posts a ready message and draws what
// the extension answers for the window's one finished mission: its title as the page's heading, the
// date it was finished beneath it, then, under the heading Summary, the summary its finish commit
// carries, drawn by the text renderer, so its `- ` bullets show as a list and a stretch between
// backticks as code, and then, under the heading Completed tasks, its completed tasks, newest first
// as the missions tool's `tasks <path> --with-body` prints them and the extension posts them, drawn
// as a mission window's Tasks pane draws them: each its title, beneath it a link to its commit,
// naming the commit's hash, which posts the hash with the page's mission so the extension opens that
// commit in an editor tab of its own, and its verified bar beneath that, drawn by the text renderer.
// The completed tasks are shown at once, behind no control. A part that could not be read draws its
// failure line with the cause beneath it in its place, and a mission with no completed task the line
// saying so. Before the first answer the page draws one line saying it is being read. Between the
// heading and the Summary the page draws its one action, the Capture principles button, in the form
// a mission page's fixed-name buttons take: its name, then the name of the variant selected in the
// arrow-only dropdown beside it, with that variant's lines as its hover text, a click posting the
// mission and the variant so the extension runs it; its name alone when the extension posts nothing
// for it, its recipe not read or not one it can run, a click then posting no variant, and drawn
// disabled, with the cause in its hover text, when every variant it could run has a line on a
// disabled harness. A pick in its dropdown posts the variant to the extension, which remembers it
// and answers again. Every value is drawn as text, never as markup, since it comes from the
// workspace.

interface VsCodeApi {
  postMessage(message: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

(() => {
  interface CompletedTask {
    hash: string;
    date: string;
    title: string;
    bar: string;
  }

  type CompletedRead = { state: 'read'; tasks: CompletedTask[] } | { state: 'failed'; cause: string };
  type SummaryRead = { state: 'read'; summary: { date: string; title: string; summary: string } } | { state: 'failed'; cause: string };

  interface VariantChoice {
    name: string;
    own: boolean;
  }

  type ButtonEntry =
    | { state: 'offered'; lines: string[]; variants: VariantChoice[]; selected: number }
    | { state: 'disabled'; cause: string };

  interface FinishedMission {
    path: string;
    title: string;
    summary: SummaryRead;
    completed: CompletedRead;
    capture?: ButtonEntry;
  }

  /** The line the page draws until the extension's first answer. */
  const READING_LINE = 'Reading the finished mission…';
  /** The words before the date a mission was finished. */
  const FINISHED_PREFIX = 'Finished on ';
  const SUMMARY_HEADING = 'Summary';
  const NO_SUMMARY_LINE = 'The finish commit carries no summary.';
  const SUMMARY_FAILURE_LINE = 'The summary could not be read.';
  const COMPLETED_HEADING = 'Completed tasks';
  const NO_COMPLETED_LINE = 'No task is completed.';
  const COMPLETED_FAILURE_LINE = 'The completed tasks could not be read.';
  /** The words before a completed task's commit hash on its commit link, and the link's hover text, as the Tasks pane draws them. */
  const COMMIT_LINK_PREFIX = 'Open commit ';
  const COMMIT_LINK_HOVER = "Open this task's commit, its verified bar and its whole patch, in an editor tab";
  /** The label of the page's one action button, and its hover text while nothing is posted for it. */
  const CAPTURE_LABEL = 'Capture principles';
  const CAPTURE_HOVER = "Open an interactive session distilling this mission's recorded decisions into the project's principle store";

  const vscode = acquireVsCodeApi();
  const root = document.getElementById('root') as HTMLElement;

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

  /** A failure line with the cause beneath it. */
  function failure(line: string, cause: string): HTMLElement {
    const box = element('div', undefined, 'notice');
    box.append(element('p', line), element('pre', cause));
    return box;
  }

  /** The page's heading: the mission's title, and beneath it its path and the date it was finished. */
  function drawHead(mission: FinishedMission): HTMLElement {
    const head = element('section', undefined, 'finished-head');
    const title = mission.summary.state === 'read' && mission.summary.summary.title !== '' ? mission.summary.summary.title : mission.title;
    head.append(element('h2', title));
    const facts = element('p', undefined, 'finished-facts');
    facts.append(element('code', mission.path));
    if (mission.summary.state === 'read') {
      facts.append(document.createTextNode(` · ${FINISHED_PREFIX}${mission.summary.summary.date}`));
    }
    head.append(facts);
    return head;
  }

  /**
   * The page's row of actions: the Capture principles button, its name and the selected variant's
   * name, with the variant's lines as its hover text, and the arrow-only dropdown beside it while it
   * offers a variant; its name alone while nothing is posted for it, and drawn disabled with the
   * cause in its hover text while every variant it could run is left out for a disabled harness.
   */
  function drawActions(mission: FinishedMission): HTMLElement {
    const row = element('div', undefined, 'controls finished-actions');
    const entry = mission.capture;
    const variant = entry?.state === 'offered' ? entry.variants[entry.selected]?.name : undefined;
    const node = element('button', undefined, 'action captureButton');
    node.type = 'button';
    node.append(element('span', CAPTURE_LABEL, 'recipe-name'));
    node.addEventListener('click', () => vscode.postMessage({ type: 'capturePrinciples', mission: mission.path, variant }));
    const item = element('span', undefined, 'recipe-entry');
    item.append(node);
    if (entry?.state === 'offered') {
      if (variant !== undefined) {
        node.append(element('span', variant, 'recipe-variant-name'));
      }
      node.title = entry.lines.join('\n');
      const choice = element('select', undefined, 'recipe-variant');
      const label = `The variant of ${CAPTURE_LABEL}`;
      choice.setAttribute('aria-label', label);
      choice.title = label;
      entry.variants.forEach((each, index) => {
        const option = element('option', each.name);
        option.value = String(index);
        option.selected = index === entry.selected;
        choice.append(option);
      });
      choice.addEventListener('change', () => {
        const picked = entry.variants[Number(choice.value)];
        if (picked !== undefined) {
          vscode.postMessage({ type: 'selectCaptureVariant', mission: mission.path, variant: picked.name });
        }
      });
      item.append(choice);
    } else if (entry?.state === 'disabled') {
      node.disabled = true;
      node.title = `${CAPTURE_HOVER}\n${entry.cause}`;
    } else {
      node.title = CAPTURE_HOVER;
    }
    row.append(item);
    return row;
  }

  /** The Summary part: the summary drawn by the text renderer, the line saying there is none, or the failure. */
  function drawSummary(mission: FinishedMission): HTMLElement {
    const section = element('section', undefined, 'finished-part finished-summary');
    section.setAttribute('aria-label', SUMMARY_HEADING);
    section.append(element('h3', SUMMARY_HEADING, 'task-part-heading'));
    const part = mission.summary;
    if (part.state === 'failed') {
      section.append(failure(SUMMARY_FAILURE_LINE, part.cause));
      return section;
    }
    const blocks = renderText(part.summary.summary);
    if (blocks.length === 0) {
      section.append(element('p', NO_SUMMARY_LINE));
    } else {
      const body = element('div', undefined, 'summary-text');
      body.append(...blocks);
      section.append(body);
    }
    return section;
  }

  /** The Completed tasks part, as a mission window's Tasks pane draws its completed tasks, shown at once. */
  function drawCompleted(mission: FinishedMission): HTMLElement {
    const section = element('section', undefined, 'finished-part completed-tasks');
    section.setAttribute('aria-label', COMPLETED_HEADING);
    section.append(element('h3', COMPLETED_HEADING, 'task-part-heading'));
    const part = mission.completed;
    if (part.state === 'failed') {
      section.append(failure(COMPLETED_FAILURE_LINE, part.cause));
    } else if (part.tasks.length === 0) {
      section.append(element('p', NO_COMPLETED_LINE));
    } else {
      const list = element('ol', undefined, 'task-list completed-list');
      for (const task of part.tasks) {
        list.append(taskItem(mission.path, task));
      }
      section.append(list);
    }
    return section;
  }

  /** One completed task: its title as a heading, beneath it the link to its commit, and beneath that its verified bar, drawn by the text renderer. */
  function taskItem(mission: string, task: CompletedTask): HTMLElement {
    const item = element('li', undefined, 'task completed-task');
    item.append(element('h4', task.title, 'task-title'));
    const line = element('p', undefined, 'task-commit');
    const link = element('button', `${COMMIT_LINK_PREFIX}${task.hash}`, 'link commit-link');
    link.type = 'button';
    link.title = COMMIT_LINK_HOVER;
    link.addEventListener('click', () => vscode.postMessage({ type: 'openCommit', mission, hash: task.hash }));
    line.append(link);
    item.append(line);
    const blocks = renderText(task.bar);
    if (blocks.length > 0) {
      const body = element('div', undefined, 'task-bar');
      body.append(...blocks);
      item.append(body);
    }
    return item;
  }

  function draw(mission: FinishedMission): void {
    const page = element('div', undefined, 'finished');
    page.setAttribute('aria-label', mission.title);
    page.append(drawHead(mission), drawActions(mission), drawSummary(mission), drawCompleted(mission));
    root.replaceChildren(page);
  }

  root.replaceChildren(element('p', READING_LINE, 'finished-reading'));

  window.addEventListener('message', (event: MessageEvent) => {
    const message = event.data;
    if (message?.type === 'finished' && typeof message.mission === 'object' && message.mission !== null) {
      draw(message.mission as FinishedMission);
    }
  });

  vscode.postMessage({ type: 'ready' });
})();
