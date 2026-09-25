/**
 * APERtrail's families for the interchange file: the travel board, one list of
 * records per kind of note.
 *
 * Reads through the host-free board reader only, so it runs outside Obsidian,
 * and `tests/host-free.test.ts` at the root walks it like one. A pointer from
 * one record to another note's record (a stop's city, a city's country, a
 * trip's extensions) leaves as `{ ref: path }`: the board is a cycle, and the
 * app should not have to resolve a title the plugin already resolved.
 *
 * **Derived values leave as derived.** A place's `visited` and `lastVisit` are
 * computed from trips and day notes, exactly as the plugin shows them; the
 * note's own claim is in `vault.json`, raw.
 *
 * **People and companies leave here**, though NODAtrail and CULItrail read
 * them too: APERtrail creates and edits CRM notes and reads the most fields of
 * the three, so its reading is the fullest one to hand over.
 */
import {
  familyEntries,
  type FamilyEntry,
  type VaultFile,
  type VaultHost,
} from '@technosoftware/trail-core';
import type { APERtrailSettings } from '../settings/types';
import { readTravelBoardFrom } from '../vault/board-reader';
import { readCrmBoardFrom } from '../crm/crm-reader';

/** The family names, fixed: they are keys an importer on the other side switches on. */
export const APERTRAIL_FAMILIES = [
  'trip',
  'booking',
  'country',
  'state',
  'city',
  'place',
  'vehicle',
  'excursion',
  'person',
  'company',
] as const;

export type AperTrailFamily = (typeof APERTRAIL_FAMILIES)[number];

/**
 * `dayVisits` is which day notes link to which place, keyed by the place's path.
 * Inside Obsidian that is the resolved-link cache; outside it the caller builds
 * it (see scripts/interchange/link-index.ts).
 */
export function apertrailFamilies<F extends VaultFile>(
  host: VaultHost<F>,
  settings: APERtrailSettings,
  dayVisits: Map<string, string[]>,
  today: string
): Record<AperTrailFamily, FamilyEntry[]> {
  const board = readTravelBoardFrom(host, settings, dayVisits, today);
  const crm = readCrmBoardFrom(host, settings);

  return {
    trip: familyEntries(board.trips),
    booking: familyEntries(board.bookings),
    country: familyEntries(board.countries),
    state: familyEntries(board.states),
    city: familyEntries(board.cities),
    place: familyEntries(board.places),
    vehicle: familyEntries(board.vehicles),
    excursion: familyEntries(board.excursions),
    person: familyEntries(crm.persons),
    company: familyEntries(crm.companies),
  };
}
