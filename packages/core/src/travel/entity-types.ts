/**
 * The fixed `type:` values a travel note carries.
 *
 * **Here rather than in APERtrail because they describe a file, not a plugin.**
 * A note saying `type: fnb` means the same thing whoever reads it, which is the
 * promotion test a note format meets on its own terms whatever the number of
 * consumers. There is a second consumer now as well: NODAtrail resolves the
 * links on a day entry and says what each one points at, and a restaurant it
 * could not name would be drawn as a bare title beside a project it could. See
 * `packages/nodatrail/docs/design/day-entry-links.md` section E.
 *
 * **The values and nothing else.** No folders, no settings, no reading. Which
 * folder each place type lives in is a map onto APERtrail's own settings keys,
 * which this package cannot see and should not learn: a vault layout is a
 * plugin's business and a type value is the file's.
 *
 * **Person and company are deliberately not here.** They are configurable
 * rather than fixed, which is exactly what `CRM_CONTRACT` is for, and a vault
 * may spell them `Person` or `Kontakt`. These twelve are compared literally.
 */

/**
 * Every travel `type:` value, fixed.
 *
 * Three of the twelve are not places and each is worth knowing about, because
 * the temptation to treat them as places recurs:
 *
 * - `booking` is a purchase belonging to one trip. No coordinates, never an
 *   itinerary stop.
 * - `vehicle` is the thing you travel ON rather than a place you travel to: a
 *   ship, a named train. A leg names it, and its cabins are a catalogue.
 * - `excursion` is what a stop is sold as: a guided tour, a bus to the Nordkap.
 *   It is run rather than gone to, and the place it happens at is the stop it
 *   hangs off. It carries no price, because the same tour is sold at a
 *   different figure on every trip that offers it.
 */
export const TRAVEL_ENTITY_TYPES = [
  'trip',
  'booking',
  'country',
  'state',
  'city',
  'accommodation',
  'fnb',
  'landmark',
  'location',
  'photospot',
  'vehicle',
  'excursion',
] as const;

export type TravelEntityType = (typeof TRAVEL_ENTITY_TYPES)[number];

/**
 * The five that share the place shape: country and city wikilinks, coordinates,
 * a rating, and a visited stamp derived from the trips that stopped there.
 *
 * A photo spot is one of them rather than standing on its own. It needs every
 * one of those fields, and being a member here is what makes it readable,
 * sortable, gallery-visible and valid as an itinerary stop without a line of
 * type-specific code.
 */
export const TRAVEL_PLACE_TYPES = [
  'accommodation',
  'fnb',
  'landmark',
  'location',
  'photospot',
] as const;

export type TravelPlaceType = (typeof TRAVEL_PLACE_TYPES)[number];

/** Whether a value is one of the twelve. For a reader holding whatever a note said. */
export function isTravelEntityType(value: string): value is TravelEntityType {
  return (TRAVEL_ENTITY_TYPES as readonly string[]).includes(value);
}

/** Whether a value is one of the five that are places somebody went to. */
export function isTravelPlaceType(value: string): value is TravelPlaceType {
  return (TRAVEL_PLACE_TYPES as readonly string[]).includes(value);
}
