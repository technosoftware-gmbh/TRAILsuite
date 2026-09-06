/**
 * The fixed set of Travel entity `type:` values this plugin understands out
 * of the box, read/written under the configurable `typePropertyName`
 * frontmatter property (default `type`) -- see
 * docs/design/travel-module-plan.md §3. Person is deliberately not one of
 * them: people are notes the vault already owns, discovered by folder plus
 * type value (see crm/persons.ts), not an entity type this plugin
 * creates.
 */
import type { APERtrailSettings } from '../settings/types';

export const TRAVEL_ENTITY_TYPES = [
  'trip',
  // A booking is a fact about a trip rather than a place: no coordinates,
  // never an itinerary stop, and deliberately NOT a member of
  // TRAVEL_PLACE_TYPES below. See docs/design/trip-budget-and-bookings.md §3.
  'booking',
  'country',
  'state',
  'city',
  'accommodation',
  'fnb',
  'landmark',
  'location',
  'photospot',
  // The thing you travel ON, as against the places you travel to: a ship, a
  // named train, a riverboat. Not a member of TRAVEL_PLACE_TYPES for the same
  // reason a booking is not -- it has no coordinates, is never an itinerary
  // stop, and is not somewhere you went. A leg names it; see
  // docs/design/vehicles.md.
  'vehicle',
] as const;

export type TravelEntityType = (typeof TRAVEL_ENTITY_TYPES)[number];

/**
 * The five entity types that share the same "place" shape (country/city
 * wikilinks, geoLocation, rating, visited/lastVisit) -- see
 * travel-module-plan.md §3's data model table. Photo spot joins them rather
 * than standing on its own: it needs every one of those fields, and being a
 * member here is what makes it readable, sortable, gallery-visible and valid
 * as an itinerary stop without a line of type-specific code. See
 * docs/design/photo-spots.md §1.
 */
export const TRAVEL_PLACE_TYPES = [
  'accommodation',
  'fnb',
  'landmark',
  'location',
  'photospot',
] as const;

export type TravelPlaceType = (typeof TRAVEL_PLACE_TYPES)[number];

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
