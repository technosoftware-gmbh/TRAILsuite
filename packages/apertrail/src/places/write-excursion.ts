/**
 * Vault-write side of an excursion note -- see places/excursion-note.ts for
 * the pure build/parse logic this wraps.
 *
 * Its own file for the reason `write-vehicle.ts` is: creating an excursion
 * writes a note once, and editing one happens afterwards, as the brochure
 * paragraph and the pictures arrive. The edit path brings a requirement
 * creation does not, which is never to clobber the note body -- for a real
 * tour that is where its description lives.
 */
import { App, TFile } from 'obsidian';
import { APERtrailSettings } from '../settings/types';
import { formatDateTimeStamp } from '@technosoftware/trail-core';
import { excursionProperties } from '../vault/read-entities';
import { buildCoverFrontmatter, coverManagedKeys, CoverInput } from '../vault/write-cover';
import { buildExcursionFrontmatter, ExcursionInput, excursionManagedKeys } from './excursion-note';

/**
 * Updates an existing excursion note in place through
 * `processFrontMatter()`, so the body survives an edit untouched.
 *
 * Stale keys are cleared before the new values are applied rather than
 * assigned over the top, because the builder only ever emits the keys that
 * SHOULD be present: an operator removed during this edit would otherwise
 * linger from before it.
 */
export async function updateExcursionNote(
  app: App,
  settings: APERtrailSettings,
  file: TFile,
  input: ExcursionInput,
  /**
   * The note's cover, written in the same pass when the caller has one.
   *
   * Two passes over one file are two vault writes and two cache
   * invalidations for one logical edit, which is the reason `modified` is
   * stamped inline here rather than through `touchModified()`. Now that one
   * dialog edits both, the same argument applies to the cover.
   *
   * The cover's keys are cleared with this schema's own, and its values are
   * assigned FIRST, so a key both schemas write -- `description` on a
   * vehicle -- ends up saying what the note's own schema says.
   */
  cover?: CoverInput,
  now: Date = new Date()
): Promise<TFile> {
  const properties = excursionProperties(settings);
  const yaml = buildExcursionFrontmatter(input, properties);
  const managed = [
    ...(cover ? coverManagedKeys(settings) : []),
    ...excursionManagedKeys(properties),
  ];
  const coverYaml = cover ? buildCoverFrontmatter(cover, settings) : {};

  await app.fileManager.processFrontMatter(file, (fm) => {
    const record = fm as Record<string, unknown>;
    for (const key of managed) delete record[key];
    Object.assign(record, coverYaml, yaml);
    // Stamped inside the same pass rather than through touchModified(): two
    // passes over one file are two vault writes and two cache invalidations
    // for one logical edit. A blank setting means "skip that stamp", never a
    // hardcoded fallback.
    if (settings.modifiedProperty) {
      record[settings.modifiedProperty] = formatDateTimeStamp(now);
    }
  });

  return file;
}
