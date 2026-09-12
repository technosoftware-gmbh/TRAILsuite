/**
 * The `created` and `modified` stamps, over the vault.
 *
 * `NODAtrailSettings` structurally satisfies the core's `NoteStampProperties`,
 * so it is passed straight through and there is nothing to map. `created` is
 * written once at creation and never rewritten or backfilled; `modified` is
 * written by every edit of an existing note.
 *
 * **NODAtrail reads three stamp shapes and writes one.** The reading is the
 * core's `readStamp()`, which understands this vault's `'[[2026-07-14]]'` and
 * `2026-07-25 - 04:50 pm` alongside the suite's own
 * `YYYY-MM-DDTHH:mm`. The writing is only ever the suite's. A note converts the
 * first time NODAtrail writes to it and never before, so the vault becomes
 * consistent one edited note at a time rather than on a single day when every
 * note in it acquires a new modification date.
 */
import { App, TFile } from 'obsidian';
import { readStamp, touchModified as touchModifiedInVault } from '@technosoftware/trail-core';
import type { NoteStampProperties } from '@technosoftware/trail-core';
import { hostFor } from './vault-host';

export function touchModified(
  app: App,
  properties: NoteStampProperties,
  file: TFile
): Promise<void> {
  return touchModifiedInVault(hostFor(app), properties, file);
}

/** When a note says it was last touched, in whichever of the three shapes it says it. */
export function modifiedAt(
  frontmatter: Record<string, unknown> | null,
  properties: NoteStampProperties
): Date | null {
  if (!frontmatter) return null;
  return readStamp(frontmatter[properties.modifiedProperty])?.date ?? null;
}

/** The same for `created`. */
export function createdAt(
  frontmatter: Record<string, unknown> | null,
  properties: NoteStampProperties
): Date | null {
  if (!frontmatter) return null;
  return readStamp(frontmatter[properties.createdProperty])?.date ?? null;
}
