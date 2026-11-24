import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';

// A small stand-in for the DOM a webview page script runs against: just the elements, attributes,
// and events the pane's, the Settings window's, and the input panel's scripts use, so a drawn page
// can be walked, and the loader running a compiled page script into a fresh page. This module holds
// no test of its own.

export class FakeText {
  constructor(public textContent: string) {}
}

export class FakeElement {
  textContent = '';
  className = '';
  type = '';
  title = '';
  value = '';
  selected = false;
  disabled = false;
  readonly dataset: Record<string, string> = {};
  readonly style: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  children: (FakeElement | FakeText)[] = [];
  private readonly listeners = new Map<string, ((event: unknown) => void)[]>();

  /** `measure` gives the element's laid-out width, as the test's stand-in for the browser's layout. */
  constructor(
    readonly tagName: string,
    private readonly measure: (element: FakeElement) => number = () => 0,
  ) {}

  /** The class list, kept in `className` as the page script's `element` sets it. */
  get classList(): { remove(name: string): void; toggle(name: string, force: boolean): void } {
    const names = () => this.className.split(' ').filter((name) => name !== '');
    return {
      remove: (name) => {
        this.className = names().filter((each) => each !== name).join(' ');
      },
      toggle: (name, force) => {
        const kept = names().filter((each) => each !== name);
        this.className = (force ? [...kept, name] : kept).join(' ');
      },
    };
  }

  getBoundingClientRect(): { width: number } {
    return { width: this.measure(this) };
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | undefined {
    return this.attributes.get(name);
  }

  append(...nodes: (FakeElement | FakeText)[]): void {
    this.children.push(...nodes);
  }

  replaceChildren(...nodes: (FakeElement | FakeText)[]): void {
    this.children = [...nodes];
  }

  get childElementCount(): number {
    return this.children.filter((child) => child instanceof FakeElement).length;
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  click(): void {
    for (const listener of this.listeners.get('click') ?? []) {
      listener({});
    }
  }

  /** Picks the option of `value` in a select, firing its change event as the browser does. */
  change(value: string): void {
    this.value = value;
    for (const listener of this.listeners.get('change') ?? []) {
      listener({});
    }
  }

  /** Types `value` into a textarea, firing its input event as the browser does. */
  input(value: string): void {
    this.value = value;
    for (const listener of this.listeners.get('input') ?? []) {
      listener({});
    }
  }

  scrollIntoView(): void {}

  /** Whether the page script gave the element the focus. */
  focused = false;

  focus(): void {
    this.focused = true;
  }

  querySelector(selector: string): FakeElement | null {
    const focus = /^\[data-focus="(.*)"\]$/.exec(selector);
    return this.all().find((each) => focus !== null && each.dataset.focus === focus[1]) ?? null;
  }

  /** This element and every element beneath it, in document order. */
  all(): FakeElement[] {
    return [this, ...this.children.flatMap((child) => (child instanceof FakeElement ? child.all() : []))];
  }

  /** Whether the element's class list holds `name`. */
  has(name: string): boolean {
    return this.className.split(' ').includes(name);
  }
}

export interface Page {
  root: FakeElement;
  posted: unknown[];
  /** Every state the page saved with `setState`, in order. */
  saved: unknown[];
  send(message: unknown): void;
  /** Fires the window's resize event, as a change of the pane's width does. */
  resize(): void;
  /** Fires the document's keydown event for `key`, pressed with no modifier outside any input. */
  key(key: string): void;
}

/** What a page is loaded with beyond its script: the data attributes the page shell sets on its root element, and the state `getState` gives back. */
export interface PageLoad {
  dataset?: Record<string, string>;
  state?: unknown;
}

/** The scripts the page shell loads ahead of the page script `script`: the text renderer ahead of a mission window's, nothing ahead of the Settings window's or the input panel's. */
function loadedBefore(script: string): string[] {
  return script === 'page.js' ? ['text.js'] : [];
}

/**
 * Loads the compiled page script `script`, by its file name under `out/webview`, into a fresh page,
 * after the scripts the page shell loads ahead of it,
 * as the pane or the Settings window does each time it is shown, its elements laid out to the
 * widths `measure` gives, its root element carrying the data attributes and `getState` giving the
 * state `loaded` names.
 */
export function loadScript(script: string, measure?: (element: FakeElement) => number, loaded: PageLoad = {}): Page {
  const root = new FakeElement('div', measure);
  Object.assign(root.dataset, loaded.dataset ?? {});
  const posted: unknown[] = [];
  const saved: unknown[] = [];
  const windowListeners: ((event: { data: unknown }) => void)[] = [];
  const resizeListeners: (() => void)[] = [];
  const keyListeners: ((event: unknown) => void)[] = [];
  const context = {
    HTMLElement: FakeElement,
    acquireVsCodeApi: () => ({
      // Cloned, as a posted message is, out of the script's own realm.
      postMessage: (message: unknown) => posted.push(JSON.parse(JSON.stringify(message))),
      getState: () => (loaded.state === undefined ? undefined : JSON.parse(JSON.stringify(loaded.state))),
      setState: (state: unknown) => saved.push(JSON.parse(JSON.stringify(state))),
    }),
    document: {
      activeElement: null,
      getElementById: (id: string) => (id === 'root' ? root : null),
      createElement: (tag: string) => new FakeElement(tag, measure),
      createTextNode: (text: string) => new FakeText(text),
      addEventListener: (type: string, listener: (event: unknown) => void) => {
        if (type === 'keydown') {
          keyListeners.push(listener);
        }
      },
    },
    window: {
      scrollY: 0,
      scrollTo: () => undefined,
      addEventListener: (type: string, listener: (event: { data: unknown }) => void) => {
        if (type === 'message') {
          windowListeners.push(listener);
        } else if (type === 'resize') {
          resizeListeners.push(listener as () => void);
        }
      },
    },
  };
  vm.createContext(context);
  for (const each of [...loadedBefore(script), script]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'webview', each), 'utf8'), context);
  }
  return {
    root,
    posted,
    saved,
    send: (message) => {
      for (const listener of windowListeners) {
        listener({ data: message });
      }
    },
    resize: () => {
      for (const listener of resizeListeners) {
        listener();
      }
    },
    key: (key) => {
      for (const listener of keyListeners) {
        listener({ key, target: null, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, preventDefault: () => undefined });
      }
    },
  };
}

/** The stylesheet the pane and the Settings window share, as the page shell in `src/pane.ts` sets it, as its rules: each selector list split at its commas, with its declarations by property. */
export function stylesheetRules(): { selectors: string[]; declarations: Map<string, string> }[] {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'pane.ts'), 'utf8');
  const sheet = /<style nonce="\$\{token\}">([\s\S]*?)<\/style>/.exec(source);
  assert.ok(sheet !== null, 'the page shell holds the stylesheet');
  return [...sheet[1].matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((rule) => ({
    selectors: rule[1].split(',').map((selector) => selector.trim()),
    declarations: new Map(
      rule[2]
        .split(';')
        .map((declaration) => declaration.trim())
        .filter((declaration) => declaration !== '')
        .map((declaration): [string, string] => {
          const colon = declaration.indexOf(':');
          return [declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()];
        }),
    ),
  }));
}

/** The compiled text renderer (`out/webview/text.js`) loaded into a fresh stand-in DOM, its two functions called from outside it. */
export function loadRenderer(): {
  renderText(text: string): FakeElement[];
  renderInline(text: string): (FakeElement | FakeText)[];
} {
  const context = vm.createContext({
    document: {
      createElement: (tag: string) => new FakeElement(tag),
      createTextNode: (text: string) => new FakeText(text),
    },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'webview', 'text.js'), 'utf8'), context);
  return {
    // Copied into this realm's arrays, so they compare as arrays built here do.
    renderText: (text) => Array.from(vm.runInContext('renderText', context)(text)),
    renderInline: (text) => Array.from(vm.runInContext('renderInline', context)(text)),
  };
}
