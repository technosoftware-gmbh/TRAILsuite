/**
 * Writing an exported sheet into the vault, and opening it.
 *
 * The four exporters -- trip document, cost sheet, field sheet, prospect --
 * had a copy of this each: work out the path, make the folders, create or
 * replace, say where it went. Four copies of a tail is how the fourth one
 * quietly loses a step, and one of them had: the field sheet skipped
 * `ensureParentFolders` entirely, which was harmless only for as long as it
 * wrote beside a note whose folder already existed.
 *
 * **Replacing rather than versioning** is the older decision this keeps. A
 * sheet is a rendering of a note and can be made again from it, so a folder of
 * "Shongololo 2.html" would be worse than a stale copy overwritten.
 */
import { App, Notice, TFile, normalizePath } from 'obsidian';
import { t } from '../lang/I18nManager';
import { ensureParentFolders } from './note-creation';

export interface SheetLabels {
  /** Names the path, so a person can see where it went -- which is also what says the folder changed. */
  written: string;
  failed: string;
}

/**
 * Writes the sheet and opens it in a new tab.
 *
 * **A new tab, not the active leaf.** The note it was exported from is what
 * somebody was looking at, and taking that away is how a person loses their
 * place.
 *
 * **On a replacement as much as on a first write.** Re-exporting to check a
 * change is exactly the moment the result should be in front of you, and it is
 * what "creating/updating" asked for.
 *
 * The open has a try of its own, and a failure in it is swallowed. A sheet
 * that was written and could not be shown has still been written, so reporting
 * that as a failure would be a lie about the vault -- and every caller does
 * `void exportSomething(...)`, so letting it reject would turn a cosmetic
 * problem into an unhandled rejection.
 */
export async function writeSheet(
  app: App,
  path: string,
  html: string,
  labels: SheetLabels
): Promise<TFile | null> {
  const target = normalizePath(path);
  let file: TFile | null = null;

  try {
    await ensureParentFolders(app, target);
    const existing = app.vault.getFileByPath(target);
    if (existing instanceof TFile) {
      await app.vault.modify(existing, html);
      file = existing;
    } else {
      file = await app.vault.create(target, html);
    }
    new Notice(t(labels.written, { path: target }));
  } catch (err) {
    new Notice(err instanceof Error ? err.message : t(labels.failed));
    return null;
  }

  try {
    await app.workspace.getLeaf('tab').openFile(file);
  } catch {
    // See above: the Notice naming the path has already been shown, which is
    // what the person needs to find it by hand.
  }
  return file;
}
