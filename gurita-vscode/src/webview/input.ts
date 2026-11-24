// The input panel's page script. On every load it draws one textarea, focused, with Run and Cancel
// beneath it, posts a ready message, and draws above the textarea the prompt the extension answers
// with, the value's prompt. Run posts the text typed, kept as typed, line breaks included, unless
// nothing but blanks is typed, which is refused on the page with one line beneath the textarea and
// posts nothing; Cancel posts the cancellation. The text typed is saved with `setState` as it is
// typed and given back to the textarea on the next load, so a tab hidden and shown again holds it
// still. Every value is drawn as text, never as markup.

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

(() => {
  /** The line the page draws beneath the textarea when Run is pressed with nothing but blanks typed. */
  const REFUSAL = 'Type a value, or press Cancel to start nothing.';

  const vscode = acquireVsCodeApi();
  const root = document.getElementById('root') as HTMLElement;
  const saved = vscode.getState() as { value?: unknown } | undefined;

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

  function button(text: string, onClick: () => void): HTMLButtonElement {
    const node = element('button', text, 'control');
    node.type = 'button';
    node.addEventListener('click', onClick);
    return node;
  }

  const prompt = element('p', '', 'input-prompt');
  const value = element('textarea', undefined, 'input-value');
  value.rows = 12;
  value.value = typeof saved?.value === 'string' ? saved.value : '';
  value.setAttribute('aria-label', 'The value');
  const refusal = element('p', '', 'input-refusal');
  value.addEventListener('input', () => {
    vscode.setState({ value: value.value });
    refusal.textContent = '';
  });
  const controls = element('div', undefined, 'controls');
  controls.append(
    button('Run', () => {
      if (value.value.trim() === '') {
        refusal.textContent = REFUSAL;
        return;
      }
      vscode.postMessage({ type: 'run', value: value.value });
    }),
    button('Cancel', () => vscode.postMessage({ type: 'cancel' })),
  );
  const panel = element('div', undefined, 'input-panel');
  panel.append(prompt, value, refusal, controls);
  root.replaceChildren(panel);
  value.focus();

  window.addEventListener('message', (event: MessageEvent) => {
    const message = event.data;
    if (message?.type === 'input' && typeof message.prompt === 'string') {
      prompt.textContent = message.prompt;
    }
  });

  vscode.postMessage({ type: 'ready' });
})();
