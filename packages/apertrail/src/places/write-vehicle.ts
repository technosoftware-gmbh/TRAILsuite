/**
 * Vault-write side of a vehicle note -- see places/vehicle-note.ts for the
 * pure build/parse logic this wraps.
 *
 * Its own file for the reason `write-photo-spot.ts` is: creating a vehicle
 * writes a note once, and editing one happens for months afterwards as its
 * cabin catalogue fills in. The edit path brings a requirement creation does
 * not, which is never to clobber the note body -- for a real ship that is
 * where the description and the pictures live.
 */
import { App, TFile } from 'obsidian';
import { APERtrailSettings } from '../settings/types';
import { formatDateTimeStamp } from '@technosoftware/trail-core';
import { vehicleProperties } from '../vault/read-entities';
import { buildVehicleFrontmatter, VehicleInput, vehicleManagedKeys } from './vehicle-note';

/**
 * Updates an existing vehicle note in place through `processFrontMatter()`,
 * so the body survives an edit untouched.
 *
 * Stale keys are cleared before the new values are applied rather than
 * assigned over the top, because the builder only ever emits the keys that
 * SHOULD be present: a cabin removed during this edit would otherwise linger
 * from before it.
 */
export async function updateVehicleNote(
  app: App,
  settings: APERtrailSettings,
  file: TFile,
  input: VehicleInput,
  now: Date = new Date()
): Promise<TFile> {
  const properties = vehicleProperties(settings);
  const yaml = buildVehicleFrontmatter(input, properties);
  const managed = vehicleManagedKeys(properties);

  await app.fileManager.processFrontMatter(file, (fm) => {
    const record = fm as Record<string, unknown>;
    for (const key of managed) delete record[key];
    Object.assign(record, yaml);
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
