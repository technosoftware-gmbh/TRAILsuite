/**
 * Which legs a given day of the itinerary is to name.
 *
 * Transport has its own band, and keeps it: a leg is edited, priced and
 * booked on its own row, and nothing here is a second copy of that row. What
 * the day-by-day says is that something leaves or lands today, which is the
 * one fact the band cannot state -- it has no days in it.
 *
 * The day-by-day used to say only the second half of that. A leg was named on
 * the day a long voyage ended and nowhere else, on the reasoning that a
 * flight is settled long after the trip is decided and usually falls outside
 * the trip's own days. The reasoning held for the flight and not for the
 * reader: a day one with a flight on it printed nothing about the flight,
 * which is the one thing happening that day. So a leg is now named on the day
 * it leaves as well, and `itinerary-days.ts` draws a day for a leg day the
 * stops do not reach, so that a day 0 outbound and a return the day after the
 * last day have somewhere to be named.
 *
 * A departure is named whether or not the leg runs overnight: a morning
 * flight that lands the same afternoon is the whole of that day and the
 * reason this was asked for. An arrival is named only when it is genuinely
 * later than the departure, which keeps "arrives today" off the day the leg
 * also began on and off a leg whose two ends are the wrong way round.
 *
 * Pure, and free of the trip schema: it takes the endpoints it needs.
 */
import { dayKey, dayOffset, dayOfDate } from './relative-days';

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

function departureKey(leg: ArrivingLeg, departure: string | null): string | null {
  return dayKey({ day: leg.day, value: leg.from }, departure);
}

/**
 * The key of the day a leg lands on, or null for a leg that does not land on
 * a later day than it leaves.
 *
 * The comparison is the offset rather than the two keys, because a leg can
 * name an arrival day *before* its departure -- `day: 1` with `toDay: 0`,
 * which is what somebody writes when they read the field as "how many days
 * later" rather than as a day of the trip. Two different keys would have
 * called that an arrival and named it on a day 0 the trip does not have.
 */
function arrivalKey(leg: ArrivingLeg, departure: string | null): string | null {
  const offset = dayOffset(
    { day: leg.day, value: leg.from },
    { day: leg.toDay, value: leg.to },
    departure
  );
  // A leg that lands the same day has already been read in full on its own
  // row, and one that names no arrival has nothing to say here at all.
  if (offset === null || offset <= 0) return null;
  return dayKey({ day: leg.toDay, value: leg.to }, departure);
}

/**
 * The legs of `legs` that leave on `day`, in the order the note lists them.
 *
 * Every leg is named on its departure day, which is the difference between
 * this and the arrival below: a flight that leaves and lands within one day
 * is exactly the case a brochure day was missing.
 */
export function legsDepartingOn<T extends ArrivingLeg>(
  legs: readonly T[],
  day: ArrivalDay,
  departure: string | null
): T[] {
  const dayId = keyOfDay(day);
  if (dayId === null) return [];
  return legs.filter((leg) => departureKey(leg, departure) === dayId);
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
  return legs.filter((leg) => arrivalKey(leg, departure) === dayId);
}

/**
 * Which days of the trip the legs need, as day numbers.
 *
 * For `itinerary-days.ts`, which draws a day for each of these the stops do
 * not already reach. Only the days something is actually named on: the
 * backwards arrival above contributes nothing, so no empty day 0 is drawn for
 * it.
 *
 * A number rather than a key, because a drawn day has to go in a numbered
 * order and a date alone cannot say where it goes. A leg that names dates on
 * a trip with no departure therefore draws no day: it has no number, and
 * neither has anything else on such a trip, so there would be nothing to put
 * it in front of.
 */
export function legDayNumbers(legs: readonly ArrivingLeg[], departure: string | null): number[] {
  const numbers = new Set<number>();
  const add = (key: string | null, own: number | null): void => {
    if (key === null) return;
    const number = own ?? dayOfDate(departure, key);
    if (number !== null) numbers.add(number);
  };

  for (const leg of legs) {
    add(departureKey(leg, departure), leg.day);
    add(arrivalKey(leg, departure), leg.toDay);
  }
  return [...numbers].sort((a, b) => a - b);
}
