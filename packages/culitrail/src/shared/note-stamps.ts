/**
 * Writing the `created` and `modified` stamps onto a note that already exists.
 *
 * Both passes are `trail-core`'s, and so is the rule they carry: create-once,
 * update-always. `created` is never backfilled onto a note that arrived without
 * one, because the plugin does not know when that note was made and a guessed
 * date reads as a fact. What is here is the `App`-shaped face of them.
 */
import type { App, TFile } from 'obsidian';
import { touchCreated as touchCreatedCore, touchModified as touchModifiedCore } from 'trail-core';
import { hostFor } from './vault-host';
import type { CULItrailSettings } from '../settings/types';

/**
 * The two settings a stamp needs.
 *
 * A narrow bag rather than the whole settings object, so this module has no
 * opinion about anything else and a caller can still pass `settings` straight
 * in. Structurally the core's `NoteStampProperties`, which is what lets these
 * settings go into it unwrapped.
 */
export type NoteStampSettings = Pick<CULItrailSettings, 'createdProperty' | 'modifiedProperty'>;

/** Stamps `created` on a note that was written as text. A blank property name writes nothing at all. */
export function touchCreated(
  app: App,
  settings: NoteStampSettings,
  file: TFile,
  now: Date = new Date()
): Promise<void> {
  return touchCreatedCore(hostFor(app), settings, file, now);
}

/** Stamps `modified` on a note whose write touched only its body. Same guard, same reason. */
export function touchModified(
  app: App,
  settings: NoteStampSettings,
  file: TFile,
  now: Date = new Date()
): Promise<void> {
  return touchModifiedCore(hostFor(app), settings, file, now);
}
