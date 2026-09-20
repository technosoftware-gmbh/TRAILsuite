/**
 * The trip contract: what NODAtrail has to spell the way APERtrail does before
 * it can read a trip note APERtrail wrote.
 *
 * The third of these, and the reason is the same one each time. NODAtrail seeds
 * a day's entries from a trip's itinerary, so it reads a note it does not own;
 * the boundary test forbids importing the reader, and two packages naming the
 * same sub-key from memory is how `person` and `Person` happened. The failure
 * mode is the quiet one this package keeps writing contracts against: a sub-key
 * that does not match yields an entry with no place on it, not an error.
 *
 * **It covers what the seeder reads and no more.** Nights, transport legs,
 * variants, costs, bookings and the rest of the trip note stay APERtrail's
 * alone. A contract that pinned the whole note would have to be revisited every
 * time APERtrail grew a field, and would make NODAtrail ship defaults for
 * things it will never look at.
 *
 * **The `trip` type value is not in here.** It is one of the twelve fixed
 * values in `travel/entity-types.ts`, which both sides import rather than
 * configure; only the folder it lives in is a setting.
 *
 * Each plugin still owns its own settings and a vault may rename any of these.
 * This is the set of DEFAULTS a fresh install of each has to ship, so that two
 * plugins in one empty vault find each other with nothing configured twice.
 */

/** Every field the two plugins have to spell identically. */
export interface TripContract {
  /** The frontmatter key a note's kind is written under. The same one the CRM contract pins. */
  typePropertyName: string;
  /** Where trip notes live. The English default; each plugin resolves a localized name at first run. */
  tripsFolder: string;
  /** Planned, Booked, Over, Cancelled. What tells an intention from a record. */
  travelStatusProperty: string;
  departureProperty: string;
  returnProperty: string;
  /** Who is travelling, on the trip as a whole. */
  personsProperty: string;
  /** The itinerary: the list whose entries become a day's entries. */
  stopsProperty: string;
  /** The place a stop is at. A city or any place note. */
  stopPlaceField: string;
  /** The stop's own clock, which decides the day and the time of the entry written from it. */
  stopFromField: string;
  stopToField: string;
  /** The outing a stop IS, beside the place it happens at. */
  stopExcursionField: string;
  /** Who takes this stop, where that is not everybody on the trip. */
  stopPersonsField: string;
  /**
   * Might not happen, and whether it was taken.
   *
   * In the contract because a seeder that ignored them would write a day's
   * entries for excursions nobody bought. An offer is not a plan.
   */
  stopOptionalField: string;
  stopChosenField: string;
}

/**
 * The agreed defaults, frozen.
 *
 * Frozen rather than `as const` alone so a plugin that spreads this into its
 * own defaults and edits the copy is doing something visible, and one that
 * tries to edit this object fails loudly in development.
 */
export const TRIP_CONTRACT: Readonly<TripContract> = Object.freeze({
  typePropertyName: 'type',
  tripsFolder: 'Trips',
  travelStatusProperty: 'travelStatus',
  departureProperty: 'departure',
  returnProperty: 'return',
  personsProperty: 'persons',
  stopsProperty: 'stops',
  stopPlaceField: 'place',
  stopFromField: 'from',
  stopToField: 'to',
  stopExcursionField: 'excursion',
  stopPersonsField: 'persons',
  stopOptionalField: 'optional',
  stopChosenField: 'chosen',
});

/** Every contract key, for a caller that wants to iterate rather than name them. */
export const TRIP_CONTRACT_KEYS = [
  'typePropertyName',
  'tripsFolder',
  'travelStatusProperty',
  'departureProperty',
  'returnProperty',
  'personsProperty',
  'stopsProperty',
  'stopPlaceField',
  'stopFromField',
  'stopToField',
  'stopExcursionField',
  'stopPersonsField',
  'stopOptionalField',
  'stopChosenField',
] as const satisfies readonly (keyof TripContract)[];

/** One field a plugin's defaults spell differently from the contract. */
export interface TripContractMismatch {
  key: keyof TripContract;
  expected: string;
  actual: unknown;
}

/**
 * Every contract field the given defaults disagree with, in contract order.
 *
 * For a test in each plugin rather than for runtime, exactly as the CRM and
 * order contracts are: a plugin asserts this is empty, and editing one of those
 * defaults then fails that plugin's own suite instead of silently emptying a
 * list in the other.
 *
 * A key the caller does not carry at all is a mismatch with `actual: undefined`
 * rather than a skip. What this answers is what a fresh install SHIPS, and a
 * defaults object missing a key ships nothing for it.
 */
export function tripContractMismatches(defaults: Partial<TripContract>): TripContractMismatch[] {
  const mismatches: TripContractMismatch[] = [];

  for (const key of TRIP_CONTRACT_KEYS) {
    const expected = TRIP_CONTRACT[key];
    const actual = defaults[key];
    if (actual !== expected) mismatches.push({ key, expected, actual });
  }

  return mismatches;
}

/** A one-line report of what disagrees, for a test's failure message. */
export function describeTripContractMismatches(
  mismatches: readonly TripContractMismatch[]
): string {
  return mismatches
    .map((m) => `${m.key}: expected ${JSON.stringify(m.expected)}, got ${JSON.stringify(m.actual)}`)
    .join('; ');
}
