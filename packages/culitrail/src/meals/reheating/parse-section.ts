/**
 * Reading a reheating section into one entry per appliance, as this plugin
 * reads it.
 *
 * The entry building is `trail-core`'s: which heading names which appliance,
 * that `[temp:: 95 °C]` is a value, that a fenced block belongs to whoever
 * claims that language, and that prose with no list marker is one step here.
 * All of that is the note format, which is a statement about what a note may
 * contain and is answered the same way whoever is asking. It is imported rather
 * than reimplemented here, which is what keeps one format from acquiring a
 * second reading of it.
 *
 * What stayed is the half that is CULItrail's: splitting the body with a
 * depth-comparing walker, so a reheating section with group headings behaves
 * the way a reader expects, and naming the sections other features render so
 * none of them is read as an appliance.
 *
 * App-free.
 */
import { parseApplianceEntries, type ApplianceEntry } from 'trail-core';
import type { CULItrailSettings } from '../../settings/types';
import { splitIntoGroups } from '../parser/step-groups';
import { reservedSectionHeadings } from '../parser/section-names';

export function parseReheatSection(body: string, settings: CULItrailSettings): ApplianceEntry[] {
  const heading = settings.reheatingHeading.trim();
  if (!heading) return [];

  return parseApplianceEntries(splitIntoGroups(body, heading).groups, {
    appliances: settings.reheatAppliances,
    fields: { temp: settings.reheatTempField, time: settings.reheatTimeField },
    reserved: reservedSectionHeadings(settings),
  });
}
