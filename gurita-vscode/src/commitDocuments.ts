// The completed tasks' commits as read-only text documents in an editor tab, inside VS Code only:
// a text-document content provider of the extension's own scheme, whose content for a commit's
// document is `git show <hash>` run from the project root (`commits.ts`), the document's path
// naming the hash and its query the project root. A click on a completed task's commit link on a
// mission's page opens that commit's document, with the diff language, in an editor tab of its own,
// so the tab holds the commit's subject, the verified bar as its body, and its whole patch, the
// task's brief among the removed lines. A document a content provider serves cannot be edited or
// saved. No remote host is involved and no other extension is called.

import * as vscode from 'vscode';
import { commitFailure, commitHashOf, commitPath, readCommit } from './commits';

/** The scheme of the documents the extension serves for the completed tasks' commits. */
export const COMMIT_SCHEME = 'gurita-commit';

/** The language a commit's document is opened with. */
export const COMMIT_LANGUAGE = 'diff';

/** The URI of the document of the commit `hash` in the project at `root`: the scheme, the hash as its path, the root as its query. */
export function commitUri(root: string, hash: string): vscode.Uri {
  return vscode.Uri.from({ scheme: COMMIT_SCHEME, path: commitPath(hash), query: root });
}

/**
 * The content of the commit document `uri`: `git show <hash>` run from the project root its query
 * names, or the failure line when its path names no commit or git could not read it.
 */
export function commitContent(uri: { path: string; query: string }): Promise<string> {
  const hash = commitHashOf(uri.path);
  return hash === undefined ? Promise.resolve(commitFailure(`Not a commit document: ${uri.path}`)) : readCommit(uri.query, hash);
}

/** Registers the content provider of the commit documents' scheme, released as the extension deactivates. */
export function registerCommitDocuments(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(COMMIT_SCHEME, {
      provideTextDocumentContent: (uri: vscode.Uri) => commitContent(uri),
    }),
  );
}

/**
 * Opens the commit `hash` of the project at `root` as a read-only text document in an editor tab
 * of its own, with the diff language, its content as the provider serves it; a document that cannot
 * be opened is told in an error notification.
 */
export async function openCommit(root: string, hash: string): Promise<void> {
  try {
    const opened = await vscode.workspace.openTextDocument(commitUri(root, hash));
    const typed = opened.languageId === COMMIT_LANGUAGE ? opened : await vscode.languages.setTextDocumentLanguage(opened, COMMIT_LANGUAGE);
    await vscode.window.showTextDocument(typed, { preview: false });
  } catch (failure) {
    void vscode.window.showErrorMessage(`The commit ${hash} could not be opened: ${failure instanceof Error ? failure.message : String(failure)}`);
  }
}
