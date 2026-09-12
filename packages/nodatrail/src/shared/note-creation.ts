/**
 * Note creation for App-bound callers.
 *
 * Both rules live in trail-core now: "create the folder if it is missing",
 * and "refuse rather than overwrite a note that already exists". What is
 * left here is the App-to-host delegation, so the three creators
 * (vault/create-entities.ts, trips/write-trip.ts, crm/create-crm.ts) keep
 * calling this with the `app` they hold.
 *
 * The `---` fence is no longer here either: `renderFrontmatterBlock()` is
 * the Obsidian adapter's, because the host owns serialisation in both
 * directions and `processFrontMatter()` re-serialises with that same
 * writer. Import it from `@technosoftware/trail-core/obsidian`.
 */
import { App, TFile } from 'obsidian';
import {
  createNote as createNoteInVault,
  ensureFolder as ensureFolderInVault,
} from '@technosoftware/trail-core';
import { hostFor } from './vault-host';

export function ensureFolder(app: App, path: string): Promise<void> {
  return ensureFolderInVault(hostFor(app), path);
}

/** Throws trail-core's `NoteExistsError` when a note is already at the path, which a caller can catch and translate. */
export function createNote(
  app: App,
  folder: string,
  title: string,
  content: string
): Promise<TFile> {
  return createNoteInVault(hostFor(app), folder, title, content);
}
