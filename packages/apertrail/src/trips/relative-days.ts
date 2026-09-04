/**
 * A trip is a shape before it is a set of dates.
 *
 * The first thing anybody writes down about a trip is what happens on day
 * one, day two, day twelve -- a restaurant, a hotel, a train -- with no idea
 * yet which calendar days those are. A tour operator's brochure is exactly
 * this and never says a date at all. Only later does a departure get fixed,
 * and every one of those days becomes a date.
 *
 * So an itinerary item may say **which day of the trip** it is on instead of
 * saying when. `trip-model-redesign.md` §9 ruled template trips out with "no
 * evidence of need"; the need turned out to be a different one, and this is
 * it. Not a trip that recurs -- a trip that is relative until it is planned.
 *
 * **Nothing is written when the departure is set.** The note goes on saying
 * `day: 3` for as long as it exists, and the calendar date is computed on
 * every render, like every other derived value in this plugin. Moving the
 * departure by a week moves the whole trip and rewrites not one line. A
 * command that turned day numbers into dates would rewrite every stop, every
 * stay and every leg, and would throw away the shape the trip was designed
 * in.
 *
 * **Day 1 is the departure day.** A day number may be 0 or negative and that
 * is not an error: an overnight flight that leaves the evening before is on
 * day 0, and it is better to let somebody write that down than to make them
 * renumber a trip around a red-eye.
 *
 * App-free, and free of the trip schema: it takes the two values it needs.
 */
import { addDays, formatDayTitle, parseDayTitle } from 'trail-core';

/** A bare `HH:mm`, which is what a relative item's `from` and `to` carry. */
const CLOCK = /^(\d{1,2}):(\d{2})/;

/**
 * The `HH:mm` in a value, whichever shape it arrived in.
 *
 * A relative item writes a bare time and an absolute one writes a datetime,
 * and both are read here, because a note that carries a day number *and* a
 * leftover datetime is a note halfway through being edited rather than a note
 * to throw the time away from.
 */
export function clockTime(value: string | null): string | null {
  if (!value) return null;

  const match = CLOCK.exec(value.trim());
  if (match) return `${(match[1] ?? '').padStart(2, '0')}:${match[2]}`;

  const inDateTime = /T(\d{2}:\d{2})/.exec(value);
  return inDateTime ? (inDateTime[1] ?? null) : null;
}

/** The calendar date day `day` of the trip falls on, or null when the trip has no departure yet. */
export function dateOfDay(departure: string | null, day: number): string | null {
  const start = parseDayTitle((departure ?? '').slice(0, 10));
  return start ? formatDayTitle(addDays(start, day - 1)) : null;
}

/**
 * Which day of the trip a calendar date is, or null.
 *
 * The inverse of `dateOfDay`, for turning an absolute item the user typed
 * before the day numbers existed into a day number the editor can show.
 */
export function dayOfDate(departure: string | null, date: string | null): number | null {
  const start = parseDayTitle((departure ?? '').slice(0, 10));
  const at = parseDayTitle((date ?? '').slice(0, 10));
  if (!start || !at) return null;

  return Math.round((at.valueOf() - start.valueOf()) / 86400000) + 1;
}

/** An itinerary item as far as this module cares: a day number, or a value that carries its own date. */
export interface RelativeEndpoint {
  /**
   * Undefined as well as null, for the reason `cleanString` takes it in
   * `trip-note.ts`: an item assembled by hand, or by a caller written before
   * day numbers existed, leaves the sub-key off rather than passing null for
   * it. Reading `undefined` as "this item is relative" would take an absolute
   * item down the relative branch and lose its date -- which is exactly what
   * it did, caught by a fixture that predates the field.
   */
  day: number | null | undefined;
  /** `HH:mm` when `day` is set, `YYYY-MM-DD[THH:mm]` when it is not. */
  value: string | null;
}

/** Whether an endpoint is relative at all. The one place the null-or-undefined question is answered. */
function hasDay(day: number | null | undefined): day is number {
  return day !== null && day !== undefined;
}

/**
 * When an endpoint happens, as a calendar date, or null.
 *
 * A day number wins over anything the value says, because `day` is what marks
 * the item as relative in the first place -- see this file on the halfway
 * note.
 */
export function endpointDate(point: RelativeEndpoint, departure: string | null): string | null {
  if (hasDay(point.day)) return dateOfDay(departure, point.day);
  return point.value ? point.value.slice(0, 10) : null;
}

/**
 * The key consecutive items are grouped under.
 *
 * A resolved date where there is one, and `#3` for a day nobody can date yet,
 * so an undated trip still groups into its twelve days. Null for an item that
 * says neither, which joins whatever day is being built -- the rule
 * `groupStopsByDay` already had.
 */
export function dayKey(point: RelativeEndpoint, departure: string | null): string | null {
  const date = endpointDate(point, departure);
  if (date) return date;
  return hasDay(point.day) ? `#${point.day}` : null;
}

/**
 * How many days later the second endpoint is than the first, or null.
 *
 * What a flight card writes as `+1`. Resolved dates when the trip has them,
 * day numbers before that, and null when either end says nothing -- a leg
 * that names only its departure has no arrival to be later than.
 *
 * Zero is a real answer and is not the same as null: a flight that lands the
 * same evening has an offset of nothing to show, and one whose arrival nobody
 * has written down has nothing to say at all.
 */
export function dayOffset(
  from: RelativeEndpoint,
  to: RelativeEndpoint,
  departure: string | null
): number | null {
  const start = endpointDate(from, departure);
  const end = endpointDate(to, departure);
  if (start && end) {
    const a = parseDayTitle(start);
    const b = parseDayTitle(end);
    return a && b ? Math.round((b.valueOf() - a.valueOf()) / 86400000) : null;
  }

  const fromDay = from.day;
  const toDay = to.day;
  if (fromDay === null || fromDay === undefined) return null;
  if (toDay === null || toDay === undefined) return null;
  return toDay - fromDay;
}

/**
 * How many days a trip runs, when it can be told.
 *
 * From the dates when it has both, and otherwise from the highest day number
 * anything on it names -- which is how a trip that is still relative can
 * still say it is twelve days long.
 */
export function tripDayCount(
  departure: string | null,
  ret: string | null,
  days: readonly (number | null)[]
): number | null {
  const spanned = dayOfDate(departure, ret);
  if (spanned !== null && spanned > 0) return spanned;

  const numbered = days.filter((day): day is number => day !== null);
  return numbered.length === 0 ? null : Math.max(...numbered);
}
