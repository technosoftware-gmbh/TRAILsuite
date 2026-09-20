/**
 * Which folder each kind of travel note lives in, and where the type values
 * themselves now come from.
 *
 * **The twelve values moved into `trail-core`** and are re-exported here rather
 * than redefined, so nothing in this package imports them from two places. They
 * describe a file rather than a plugin, which is the promotion test a note
 * format meets on its own terms, and there is a second reader now: NODAtrail
 * resolves the links on a day entry and says what each one points at. See
 * `packages/nodatrail/docs/design/day-entry-links.md` section E.
 *
 * **The folder map stayed.** It names `APERtrailSettings` keys, which the core
 * cannot see and should not learn: where a vault keeps its restaurants is this
 * plugin's business, and what a note calls itself is the file's.
 *
 * Person is deliberately not one of the twelve: people are notes the vault
 * already owns, discovered by folder plus type value (see crm/persons.ts), and
 * configurable rather than fixed, which is what `CRM_CONTRACT` is for.
 */
import {
  TRAVEL_ENTITY_TYPES,
  TRAVEL_PLACE_TYPES,
  type TravelEntityType,
  type TravelPlaceType,
} from '@technosoftware/trail-core';
import type { APERtrailSettings } from '../settings/types';

export { TRAVEL_ENTITY_TYPES, TRAVEL_PLACE_TYPES };
export type { TravelEntityType, TravelPlaceType };

/**
 * Which APERtrailSettings folder field each place-type reads/writes notes
 * from. Shared between read-entities.ts and create-entities.ts so the
 * kind-to-folder mapping is defined exactly once.
 */
export const TRAVEL_PLACE_FOLDER_SETTING: Record<TravelPlaceType, keyof APERtrailSettings> = {
  accommodation: 'accommodationFolder',
  fnb: 'fnbFolder',
  landmark: 'landmarksFolder',
  location: 'locationsFolder',
  photospot: 'photoSpotsFolder',
};
