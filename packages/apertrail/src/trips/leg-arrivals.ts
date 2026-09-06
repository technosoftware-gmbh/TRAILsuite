/**
 * Which legs land on a given day of the itinerary.
 *
 * Transport has its own band, deliberately: a flight is settled long after
 * the trip is decided, and the outbound one usually leaves the day before day
 * one while the return lands the day after the last. Folding legs into the
 * day-by-day would file them under days they do not happen on, or invent a
 * day 0 in the middle of a brochure.
 *
 * That reasoning covers a flight and does not cover a leg that runs for a
 * fortnight. A fifteen-day voyage IS the trip, and the day it ends is a real
 * day of the itinerary with its own stops on it; leaving it out meant the
 * arrival appeared nowhere at all. So a leg is named on the day it arrives
 * when, and only when, that day is one the itinerary already draws:
 *
 * - the leg has to run overnight, so an ordinary same-day leg adds nothing;
 * - the day it lands on has to be a day of the itinerary, which is what keeps
 *   the return flight the day after the trip out of it -- there is no such
 *   day, so there is nothing to add it to.
 *
 * A marker, not a row: the leg's own row in the transport band is still where
 * it is edited, priced and booked. This says only that it ends here.
 *
 * Pure, and free of the trip schema: it takes the endpoints it needs.
 */
import { dayKey } from './relative-days';

/** A leg as this module wants it: its two ends, whichever way they are said. */
export interface ArrivingLeg {
  day: number | null;
  toDay: number | null;
  from: string | null;
  to: string | null;
}

/** A day of the itinerary as this module wants it: however it is identified. */
export interface ArrivalDay {
  date: string | null;
  number: number | null;
}

/** The key a day is identified by, which is the same key the stops were grouped under. */
function keyOfDay(day: ArrivalDay): string | null {
  if (day.date !== null) return day.date;
  return day.number === null ? null : `#${day.number}`;
}

/**
 * The legs of `legs` that arrive on `day`, in the order the note lists them.
 *
 * Empty for every day nothing lands on, which is most of them.
 */
export function legsArrivingOn<T extends ArrivingLeg>(
  legs: readonly T[],
  day: ArrivalDay,
  departure: string | null
): T[] {
  const dayId = keyOfDay(day);
  if (dayId === null) return [];

  return legs.filter((leg) => {
    const arrival = dayKey({ day: leg.toDay, value: leg.to }, departure);
    if (arrival === null || arrival !== dayId) return false;
    // A leg that leaves and lands on the same day has already been read in
    // full on its own row; saying "arrives today" under a day it also began
    // on states nothing the reader did not have.
    const departureKey = dayKey({ day: leg.day, value: leg.from }, departure);
    return departureKey !== arrival;
  });
}
