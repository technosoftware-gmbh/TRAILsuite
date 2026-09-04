/**
 * Reading NODAtrail's notes out of the vault.
 *
 * Nothing is cached. Every view re-reads on render, so what a view shows can
 * never drift from what is on disk. The data is never stale; only the pixels
 * can be.
 */
import { App, TFile } from 'obsidian';
import { indexByTitle, readNotesOfType, type VaultNote } from 'trail-core';
import { hostFor } from '../shared/vault-host';
import type { NODAtrailSettings } from '../settings/types';
import { anyQueryFor, archivedQueryFor, queryFor, type NodaFolderType } from './entity-types';

export type NodaNote = VaultNote<TFile>;

/** The live notes of one kind, title sorted. */
export function readNotes(app: App, settings: NODAtrailSettings, type: NodaFolderType): NodaNote[] {
  return readNotesOfType(hostFor(app), queryFor(settings, type));
}

/** The archived notes of one kind. */
export function readArchivedNotes(
  app: App,
  settings: NODAtrailSettings,
  type: NodaFolderType
): NodaNote[] {
  return readNotesOfType(hostFor(app), archivedQueryFor(settings, type));
}

/**
 * Live and archived together.
 *
 * A separate function rather than a flag on `readNotes`, so that no caller ever
 * includes the archive by accident. Including an archived project in a list of
 * active ones is the mistake this shape exists to make impossible to write
 * without meaning to.
 */
export function readAllNotes(
  app: App,
  settings: NODAtrailSettings,
  type: NodaFolderType
): NodaNote[] {
  return readNotesOfType(hostFor(app), anyQueryFor(settings, type));
}

/** True when a note sits under the archive folder for its kind. */
export function isArchivedPath(path: string, archiveRoot: string): boolean {
  const root = archiveRoot.trim();
  return root !== '' && (path === root || path.startsWith(`${root}/`));
}

/** Notes indexed by lower-cased title, for resolving the wikilinks between them. */
export function byTitle(notes: readonly NodaNote[]): Map<string, NodaNote> {
  return indexByTitle(notes);
}
