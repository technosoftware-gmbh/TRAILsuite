/**
 * Which folders NODAtrail claims, and what a note sitting in one should be.
 *
 * Pure, and separated from `scan.ts` for a reason the health check learned the
 * hard way: everything here is ordinary data manipulation, and leaving it
 * tangled with `app.vault` meant the whole gathering step had no test. The only
 * thing `scan.ts` should need an `App` for is listing files and reading their
 * frontmatter.
 */
import type { PeriodLevel } from 'trail-core';
import { templateFor, typeValueFor as periodTypeValueFor } from '../../plan/paths';
import type { NODAtrailSettings } from '../../settings/types';
import { archiveFolderFor, folderFor, typeValueFor, type NodaFolderType } from '../entity-types';
import type { FolderNote, StampNote } from './findings';

const FOLDER_TYPES: NodaFolderType[] = [
  'area',
  'goal',
  'project',
  'resource',
  'purchase',
  'bill',
  'recurring',
  'budget',
];

const LEVELS: PeriodLevel[] = ['day', 'week', 'month', 'quarter', 'year'];

/** A folder NODAtrail claims, and the type value a note in it should carry. */
export interface FolderClaim {
  folder: string;
  typeValue: string;
}

/**
 * Every claimed folder, **longest first**.
 *
 * The order is the point rather than tidiness: a note in `6 Archive/Projects`
 * has to be checked against the project type rather than against whatever
 * claims the archive root, and taking the first match of a longest-first list
 * is what makes the most specific claim win.
 *
 * A folder with no type value, or a type value with no folder, is dropped. Both
 * are unconfigured settings, and an unconfigured setting claims nothing here for
 * the same reason it finds nothing in the readers.
 */
export function claimedFolders(settings: NODAtrailSettings): FolderClaim[] {
  const claims: FolderClaim[] = [];

  for (const type of FOLDER_TYPES) {
    const typeValue = typeValueFor(settings, type);
    for (const folder of [folderFor(settings, type), archiveFolderFor(settings, type) ?? '']) {
      if (folder && typeValue) claims.push({ folder, typeValue });
    }
  }

  // The period folders come from the path templates rather than from a folder
  // setting, so they are derived the way the writer derives them: the part of
  // the template before its first token.
  for (const level of LEVELS) {
    const folder = folderPartOf(templateFor(settings, level));
    const typeValue = periodTypeValueFor(settings, level);
    if (folder && typeValue) claims.push({ folder, typeValue });
  }

  return claims.sort((a, b) => b.folder.length - a.folder.length);
}

/** A path template reduced to the folder it always writes under. */
export function folderPartOf(template: string): string {
  const beforeToken = template.split('{')[0] ?? template;
  return beforeToken.replace(/\/$/, '');
}

/** True when a path is at or under a folder. Segment-aware, so `1 Area` does not claim `1 Areas/x.md`. */
export function isUnder(path: string, folder: string): boolean {
  return path === folder || path.startsWith(`${folder}/`);
}

/** The claim covering a path, or null. */
export function claimFor(path: string, claims: readonly FolderClaim[]): FolderClaim | null {
  return claims.find((claim) => isUnder(path, claim.folder)) ?? null;
}

/** A note reduced to what the checks read off one. */
export interface ScannedNote {
  path: string;
  title: string;
  frontmatter: Record<string, unknown>;
}

/**
 * The type as a note states it, read the way `matchesType()` reads it.
 *
 * A property editor turns a value into a list the moment somebody adds a second
 * one, so the first entry of a list counts, and a wikilink-shaped value is
 * unwrapped. Anything else is null, which the checks report as a missing type
 * rather than as a wrong one.
 */
export function statedTypeOf(
  frontmatter: Record<string, unknown>,
  typePropertyName: string
): string | null {
  const raw: unknown = frontmatter[typePropertyName];
  const first: unknown = Array.isArray(raw) ? (raw as unknown[])[0] : raw;
  if (typeof first !== 'string') return null;

  const trimmed = first.trim();
  if (trimmed === '') return null;

  const link = /^!?\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/.exec(trimmed);
  return (link ? (link[1] ?? '').trim() : trimmed) || null;
}

/** The notes in claimed folders, paired with the type each should carry. */
export function folderNotesOf(
  notes: readonly ScannedNote[],
  claims: readonly FolderClaim[],
  typePropertyName: string
): FolderNote[] {
  const found: FolderNote[] = [];

  for (const note of notes) {
    const claim = claimFor(note.path, claims);
    if (!claim) continue;

    found.push({
      path: note.path,
      title: note.title,
      statedType: statedTypeOf(note.frontmatter, typePropertyName),
      expectedType: claim.typeValue,
    });
  }
  return found;
}

/** The stamps carried by the notes in claimed folders. */
export function stampNotesOf(
  notes: readonly ScannedNote[],
  claims: readonly FolderClaim[],
  createdProperty: string,
  modifiedProperty: string
): StampNote[] {
  return notes
    .filter((note) => claimFor(note.path, claims) !== null)
    .map((note) => ({
      path: note.path,
      title: note.title,
      created: note.frontmatter[createdProperty],
      modified: note.frontmatter[modifiedProperty],
    }));
}
