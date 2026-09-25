/**
 * Finding NODAtrail's notes of one kind through the core's vault ports.
 *
 * Imports nothing from `obsidian` at runtime, which `tests/host-free.test.ts`
 * enforces, so the same lookup runs inside Obsidian (through read-notes.ts) and
 * over any other `VaultHost`.
 */
import type { TFile } from 'obsidian';
import {
  indexByTitle,
  readNotesOfType,
  type VaultFile,
  type VaultHost,
  type VaultNote,
} from '@technosoftware/trail-core';
import type { NODAtrailSettings } from '../settings/types';
import { anyQueryFor, archivedQueryFor, queryFor, type NodaFolderType } from './entity-types';

export type NodaNote<F extends VaultFile = TFile> = VaultNote<F>;

/** The live notes of one kind, title sorted. */
export function readNotesFrom<F extends VaultFile>(
  host: VaultHost<F>,
  settings: NODAtrailSettings,
  type: NodaFolderType
): NodaNote<F>[] {
  return readNotesOfType(host, queryFor(settings, type));
}

/** The archived notes of one kind. */
export function readArchivedNotesFrom<F extends VaultFile>(
  host: VaultHost<F>,
  settings: NODAtrailSettings,
  type: NodaFolderType
): NodaNote<F>[] {
  return readNotesOfType(host, archivedQueryFor(settings, type));
}

/**
 * Live and archived together.
 *
 * A separate function rather than a flag on `readNotesFrom`, so that no caller
 * ever includes the archive by accident. Including an archived project in a
 * list of active ones is the mistake this shape exists to make impossible to
 * write without meaning to.
 */
export function readAllNotesFrom<F extends VaultFile>(
  host: VaultHost<F>,
  settings: NODAtrailSettings,
  type: NodaFolderType
): NodaNote<F>[] {
  return readNotesOfType(host, anyQueryFor(settings, type));
}

/** True when a note sits under the archive folder for its kind. */
export function isArchivedPath(path: string, archiveRoot: string): boolean {
  const root = archiveRoot.trim();
  return root !== '' && (path === root || path.startsWith(`${root}/`));
}

/** Notes indexed by lower-cased title, for resolving the wikilinks between them. */
export function byTitle<F extends VaultFile>(
  notes: readonly NodaNote<F>[]
): Map<string, NodaNote<F>> {
  return indexByTitle(notes);
}
