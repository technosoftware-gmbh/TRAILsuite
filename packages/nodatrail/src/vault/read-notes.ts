/**
 * Reading NODAtrail's notes out of Obsidian's vault.
 *
 * One delegation per function to notes-reader.ts through `hostFor()`. Nothing
 * is cached: every view re-reads on render, so what a view shows can never
 * drift from what is on disk. The data is never stale; only the pixels can be.
 */
import { App } from 'obsidian';
import { hostFor } from '../shared/vault-host';
import type { NODAtrailSettings } from '../settings/types';
import type { NodaFolderType } from './entity-types';
import {
  readAllNotesFrom,
  readArchivedNotesFrom,
  readNotesFrom,
  type NodaNote,
} from './notes-reader';

export { byTitle, isArchivedPath, type NodaNote } from './notes-reader';

/** The live notes of one kind, title sorted. */
export function readNotes(app: App, settings: NODAtrailSettings, type: NodaFolderType): NodaNote[] {
  return readNotesFrom(hostFor(app), settings, type);
}

/** The archived notes of one kind. */
export function readArchivedNotes(
  app: App,
  settings: NODAtrailSettings,
  type: NodaFolderType
): NodaNote[] {
  return readArchivedNotesFrom(hostFor(app), settings, type);
}

/** Live and archived together. See notes-reader.ts for why this is not a flag. */
export function readAllNotes(
  app: App,
  settings: NODAtrailSettings,
  type: NodaFolderType
): NodaNote[] {
  return readAllNotesFrom(hostFor(app), settings, type);
}
