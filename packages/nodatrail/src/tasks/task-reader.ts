/**
 * Finding the checkbox lines in the configured folders, through the core's
 * vault ports.
 *
 * The format is the core's, and it is the Obsidian Tasks plugin's rather than
 * this suite's. NODAtrail reads it and can tick one box; it does not own the
 * line. Recurrence, dependencies and the query language stay where they are.
 *
 * **It looks in `taskFolders`, not in the whole vault.** A vault-wide checkbox
 * scan turns a shopping list inside a meal note into a life task, and there is
 * no way to tell the two apart from the line alone.
 *
 * Imports nothing from `obsidian`, which `tests/host-free.test.ts` enforces:
 * `read-tasks.ts` runs it inside Obsidian, the interchange export outside it.
 */
import {
  isUnderAnyFolder,
  scanTasks,
  type LocatedTask,
  type VaultFile,
  type VaultHost,
} from '@technosoftware/trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { taskFolders } from '../vault/entity-types';

/** A task, and the note it was found in. The file type defaults to Obsidian's for the plugin's own callers. */
export interface HostTask<F extends VaultFile> extends LocatedTask {
  file: F;
}

/**
 * Every checkbox line under the configured folders.
 *
 * A blank folder list finds nothing rather than scanning the vault, which is
 * the same fail-safe direction `readNotesOfType()` takes: a list that shows
 * nothing prompts somebody to check the setting, whereas one that claimed every
 * note would be unusable on the first vault it met.
 */
export async function readTasksFrom<F extends VaultFile>(
  host: VaultHost<F>,
  settings: NODAtrailSettings
): Promise<HostTask<F>[]> {
  const folders = taskFolders(settings);
  if (folders.length === 0) return [];

  const files = host.vault.markdownFiles().filter((file) => isUnderAnyFolder(file.path, folders));

  const found: HostTask<F>[] = [];
  for (const file of files) {
    const text = await host.vault.read(file);
    // A note with no checkbox at all is the common case, and reading it was
    // unavoidable; skipping the scan when the text plainly has none is not.
    if (!text.includes('- [') && !text.includes('* [') && !text.includes('+ [')) continue;

    for (const task of scanTasks(text)) found.push({ ...task, file });
  }
  return found;
}
