/**
 * Finding the checkbox lines in the configured folders.
 *
 * The format is the core's, and it is the Obsidian Tasks plugin's rather than
 * this suite's. NODAtrail reads it and can tick one box; it does not own the
 * line. Recurrence, dependencies and the query language stay where they are.
 *
 * **It looks in `taskFolders`, not in the whole vault.** A vault-wide checkbox
 * scan turns a shopping list inside a meal note into a life task, and there is
 * no way to tell the two apart from the line alone.
 *
 * Reading a note's text is asynchronous, so this is too. Every view that shows
 * tasks awaits it once per render rather than caching, which is the suite's
 * rule and the reason a task list can never disagree with the note it came
 * from.
 */
import { App, TFile } from 'obsidian';
import { isUnderAnyFolder, scanTasks, type LocatedTask } from '@technosoftware/trail-core';
import { hostFor } from '../shared/vault-host';
import type { NODAtrailSettings } from '../settings/types';
import { taskFolders } from '../vault/entity-types';

/** A task, and the note it was found in. */
export interface VaultTask extends LocatedTask {
  file: TFile;
}

/**
 * Every checkbox line under the configured folders.
 *
 * A blank folder list finds nothing rather than scanning the vault, which is
 * the same fail-safe direction `readNotesOfType()` takes: a list that shows
 * nothing prompts somebody to check the setting, whereas one that claimed every
 * note would be unusable on the first vault it met.
 */
export async function readTasks(app: App, settings: NODAtrailSettings): Promise<VaultTask[]> {
  const folders = taskFolders(settings);
  if (folders.length === 0) return [];

  const host = hostFor(app);
  const files = host.vault.markdownFiles().filter((file) => isUnderAnyFolder(file.path, folders));

  const found: VaultTask[] = [];
  for (const file of files) {
    const text = await host.vault.read(file);
    // A note with no checkbox at all is the common case, and reading it was
    // unavoidable; skipping the scan when the text plainly has none is not.
    if (!text.includes('- [') && !text.includes('* [') && !text.includes('+ [')) continue;

    for (const task of scanTasks(text)) found.push({ ...task, file });
  }
  return found;
}

/** The tasks in one note, for a block rendered inside it. */
export async function readTasksIn(app: App, file: TFile): Promise<VaultTask[]> {
  const text = await hostFor(app).vault.read(file);
  return scanTasks(text).map((task) => ({ ...task, file }));
}
