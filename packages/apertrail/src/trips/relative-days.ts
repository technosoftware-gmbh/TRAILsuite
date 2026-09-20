/**
 * A trip is a shape before it is a set of dates, and the rules for that live in
 * `trail-core` now.
 *
 * Moved rather than copied when NODAtrail became the second reader: `day: 3`
 * on a stop means the third day of the trip whoever reads it, which is the
 * promotion test a note format meets on its own terms. Re-exported from here so
 * the ten call sites in this package did not have to move, and so nothing here
 * imports it from two places.
 */
export {
  clockTime,
  dateOfDay,
  dayOfDate,
  endpointDate,
  dayKey,
  dayOffset,
  tripDayCount,
} from '@technosoftware/trail-core';
export type { RelativeEndpoint } from '@technosoftware/trail-core';
