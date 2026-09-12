/**
 * The App-bound half of the `created` / `modified` stamps.
 *
 * The rules themselves are trail-core's: create-once for `created`,
 * update-always for `modified`, never backfilled, a blank property name
 * meaning "skip that stamp" rather than a literal fallback.
 * `APERtrailSettings` carries `createdProperty` and `modifiedProperty`, so
 * it satisfies the core's `NoteStampProperties` and can be handed straight
 * through.
 *
 * What is left here is the delegation for the one case that needs a vault:
 * stamping a file that already exists, in a pass of its own.
 */
import { App, TFile } from 'obsidian';
import { touchModified as touchModifiedInVault } from '@technosoftware/trail-core';
import { hostFor } from '../shared/vault-host';
import { APERtrailSettings } from '../settings/types';

/**
 * Stamps `modified` in a pass of its own -- for edits that only touched
 * the body (an appended block) and so have no frontmatter pass to fold
 * into. Prefer core's stampModified() whenever the caller is writing
 * frontmatter anyway: two passes over one file mean two vault writes and
 * two metadata-cache invalidations for a single logical edit.
 *
 * Opens no pass at all when the setting is blank, so a vault that cleared
 * the field pays nothing for calling this.
 */
export function touchModified(
  app: App,
  settings: APERtrailSettings,
  file: TFile,
  now: Date = new Date()
): Promise<void> {
  return touchModifiedInVault(hostFor(app), settings, file, now);
}
