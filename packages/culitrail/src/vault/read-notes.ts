/**
 * Reading notes out of the vault by folder and type.
 *
 * The single entry point every area sits on, and a thin one: the
 * folder-AND-type rule itself is `trail-core`'s. What stays here is the half
 * only CULItrail can answer, turning a settings object and one of the four
 * entity types into the query the core takes.
 *
 * Nothing is cached: each call re-reads, so what a view renders can never drift
 * from what is on disk. The data is never stale, the pixels can be.
 */
import type { App, TFile } from 'obsidian';
import {
  isNoteOfType as isNoteOfTypeCore,
  readNotesOfType as readNotesOfTypeCore,
  type NoteKindQuery,
  type VaultNote as CoreVaultNote,
} from '@technosoftware/trail-core';
import { CULItrailSettings } from '../settings/types';
import { hostFor } from '../shared/vault-host';
import { CuliEntityType, foldersFor, typeValueFor } from './entity-types';

/** A note read out of this vault, carrying the real `TFile` rather than the core's structural stand-in. */
export type VaultNote = CoreVaultNote<TFile>;

/**
 * The three pure halves, unchanged.
 *
 * Re-exported rather than wrapped because none of them touches an `App`:
 * `matchesType` decides what a type value means, and the two title functions
 * resolve wikilinks against an index a caller already holds.
 */
export { indexByTitle, matchesType, resolveByTitle } from '@technosoftware/trail-core';

/**
 * Where a kind lives and what marks it, as the core asks for it.
 *
 * The one mapping in this file, and the reason the wrappers below exist: which
 * folders a kind is read from and which `type:` value marks it are CULItrail's
 * settings, and the core deliberately knows nothing about either.
 */
function queryFor(settings: CULItrailSettings, kind: CuliEntityType): NoteKindQuery {
  return {
    folders: foldersFor(settings, kind),
    typePropertyName: settings.typePropertyName,
    typeValue: typeValueFor(settings, kind),
  };
}

/**
 * Every note of one kind, title-sorted.
 *
 * Folder AND type, both required. There is no folder-only fallback for a note
 * missing its type, and no vault-wide search for a type outside its folder.
 * Requiring both is what keeps an unrelated note that happens to say
 * `type: meal` out of the meal library, and it is also why a health check
 * over these folders is worth running now and then: a note that gets moved, or
 * whose type gets typo'd, drops out silently by design.
 */
export function readNotesOfType(
  app: App,
  settings: CULItrailSettings,
  kind: CuliEntityType
): VaultNote[] {
  return readNotesOfTypeCore(hostFor(app), queryFor(settings, kind));
}

/**
 * True when one specific file counts as a given kind.
 *
 * The single-file question, for the code paths that already hold a file and
 * only need to know whether to act on it: whether to swap the Markdown view for
 * the meal view, whether a command applies. Answered on exactly the same
 * terms as the bulk read above, so the two can never disagree about what a
 * meal is.
 */
export function isNoteOfType(
  app: App,
  settings: CULItrailSettings,
  file: TFile,
  kind: CuliEntityType
): boolean {
  return isNoteOfTypeCore(hostFor(app), file, queryFor(settings, kind));
}
