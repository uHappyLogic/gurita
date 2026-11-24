import { test } from 'node:test';
import * as assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { COMMIT_FAILURE_LINE, commitHashOf, commitPath, isCommitHash, readCommit } from '../commits';
// The completed tasks' commit documents, against a stub of the `vscode` module standing in for the
// editor: the content provider registered for the extension's own scheme, its content for a commit
// of a git fixture, and the opening of a commit's document in an editor tab with the diff language.
const Module = require('node:module') as {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};

const disposable = { dispose(): void {} };

/** A URI as the stub's editor builds it from its components. */
interface StubUri {
  scheme: string;
  path: string;
  query: string;
}

/** A text document as the stub's editor opens it: its URI and its language. */
interface StubDocument {
  uri: StubUri;
  languageId: string;
}

/** Every content provider registered with the stub's editor, by scheme. */
const providers = new Map<string, { provideTextDocumentContent(uri: StubUri): unknown }>();
/** Every document the stub's editor opened, every language change it made, and every document it showed, in order. */
const opened: StubDocument[] = [];
const languages: [StubDocument, string][] = [];
const shown: { document: StubDocument; options: unknown }[] = [];
const notifications: string[] = [];

const stub = {
  Uri: {
    from: (components: StubUri): StubUri => ({ scheme: components.scheme, path: components.path, query: components.query }),
  },
  workspace: {
    registerTextDocumentContentProvider(scheme: string, provider: { provideTextDocumentContent(uri: StubUri): unknown }) {
      providers.set(scheme, provider);
      return disposable;
    },
    openTextDocument: (uri: StubUri): Promise<StubDocument> => {
      const document = { uri, languageId: 'plaintext' };
      opened.push(document);
      return Promise.resolve(document);
    },
  },
  languages: {
    setTextDocumentLanguage: (document: StubDocument, languageId: string): Promise<StubDocument> => {
      languages.push([document, languageId]);
      return Promise.resolve({ ...document, languageId });
    },
  },
  window: {
    showTextDocument: (document: StubDocument, options: unknown) => {
      shown.push({ document, options });
      return Promise.resolve(undefined);
    },
    showErrorMessage: (message: string) => {
      notifications.push(message);
      return Promise.resolve(undefined);
    },
  },
};

const load = Module._load;
Module._load = (request, parent, isMain) => (request === 'vscode' ? stub : load(request, parent, isMain));
const commitDocuments = require('../commitDocuments') as typeof import('../commitDocuments');
Module._load = load;

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { cwd, encoding: 'utf8' });
}

/** A git fixture: a mission's task list holding one task, then the task's `Task-completion:` commit with its bar, returning the root and that commit's abbreviated hash. */
function fixture(): { root: string; hash: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-commit-'));
  git(root, 'init', '-q');
  const mission = path.join(root, 'mission_done');
  fs.mkdirSync(mission);
  fs.writeFileSync(path.join(mission, 'requirements.md'), '# Done\n');
  fs.writeFileSync(path.join(mission, 'TASKS_TODO.md'), '# TASKS TODO\n\n## A task\n\nA brief of the task.\n\n---\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'Task-derivation: mission_done/');
  fs.writeFileSync(path.join(mission, 'TASKS_TODO.md'), '# TASKS TODO\n');
  fs.writeFileSync(path.join(root, 'made.txt'), 'The deliverable.\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'Task-completion: A task\n\n- The `first` criterion\n- Another criterion');
  return { root, hash: git(root, 'rev-parse', '--short', 'HEAD').trim() };
}

test("the content provider of the extension's own scheme serves a commit's document as git show prints it: its subject, its verified bar as the body, and its whole patch with the brief among the removed lines", async () => {
  const { root, hash } = fixture();
  const context = { subscriptions: [] as unknown[] } as unknown as import('vscode').ExtensionContext;
  commitDocuments.registerCommitDocuments(context);
  assert.strictEqual(commitDocuments.COMMIT_SCHEME, 'gurita-commit');
  const provider = providers.get(commitDocuments.COMMIT_SCHEME);
  assert.ok(provider !== undefined, 'a content provider is registered for the scheme');
  assert.strictEqual(context.subscriptions.length, 1, 'the registration is released with the extension');

  const uri = commitDocuments.commitUri(root, hash) as unknown as StubUri;
  assert.deepStrictEqual(uri, { scheme: 'gurita-commit', path: `/${hash}.diff`, query: root }, 'the hash is its path and the project root its query');
  const content = (await provider.provideTextDocumentContent(uri)) as string;
  assert.strictEqual(content, git(root, 'show', hash), 'the content is the whole print of git show');
  for (const expected of [
    '    Task-completion: A task',
    '    - The `first` criterion',
    '    - Another criterion',
    'diff --git a/mission_done/TASKS_TODO.md b/mission_done/TASKS_TODO.md',
    '-## A task',
    '-A brief of the task.',
    '+The deliverable.',
  ]) {
    assert.ok(content.split('\n').includes(expected), `the document holds the line ${expected}`);
  }
});

test("a commit's document that git cannot read holds the failure line with git's message beneath it, and a path naming no commit reaches no git call", async () => {
  const { root } = fixture();
  const missing = await commitDocuments.commitContent({ path: '/0123abcd.diff', query: root });
  assert.strictEqual(missing.split('\n')[0], COMMIT_FAILURE_LINE);
  assert.match(missing, /0123abcd/, "git's message names the hash");
  const notCommit = await commitDocuments.commitContent({ path: '/--output=x.diff', query: root });
  assert.strictEqual(notCommit.split('\n')[0], COMMIT_FAILURE_LINE);
  assert.ok(!fs.existsSync(path.join(root, 'x.diff')) && !fs.existsSync(path.join(root, 'x')), 'nothing reached git as an option');
  const noGit = await readCommit(root, 'abcdef1', path.join(root, 'no-such-git'));
  assert.strictEqual(noGit.split('\n')[0], COMMIT_FAILURE_LINE, 'a git that cannot be started reads as failed');
});

test('a commit hash is hexadecimal digits only, and its document path carries it with a .diff name', () => {
  for (const hash of ['abc1234', '0123456789abcdef0123456789abcdef01234567']) {
    assert.ok(isCommitHash(hash), hash);
    assert.strictEqual(commitHashOf(commitPath(hash)), hash);
  }
  for (const value of ['', 'abc', 'ABC1234', '--output=x', 'abc1234 HEAD', 'HEAD', 7]) {
    assert.ok(!isCommitHash(value), String(value));
  }
  assert.strictEqual(commitHashOf('/abc1234'), undefined);
  assert.strictEqual(commitHashOf('/x/abc1234.diff'), undefined);
});

test("opening a commit opens its document of the extension's scheme with the diff language in an editor tab of its own, calling no other extension", async () => {
  const { root, hash } = fixture();
  opened.length = 0;
  languages.length = 0;
  shown.length = 0;
  await commitDocuments.openCommit(root, hash);
  assert.deepStrictEqual(
    opened.map((each) => each.uri),
    [{ scheme: 'gurita-commit', path: `/${hash}.diff`, query: root }],
  );
  assert.deepStrictEqual(languages.map(([, language]) => language), ['diff']);
  assert.strictEqual(shown.length, 1, 'the document is shown in one editor tab');
  assert.strictEqual(shown[0].document.languageId, 'diff');
  assert.deepStrictEqual(shown[0].document.uri, opened[0].uri);
  assert.deepStrictEqual(shown[0].options, { preview: false }, 'a tab of its own, not a preview another click replaces');
  assert.deepStrictEqual(notifications, []);
});
