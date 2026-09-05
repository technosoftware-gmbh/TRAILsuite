/**
 * Groups a Trip's itinerary stops into days for display.
 *
 * Pure and free of any 'obsidian' import, so it can be unit-tested
 * directly -- that is the only reason it lives here rather than inside
 * trips/ui/itinerary-block.ts, which is the sole caller.
 */
import { dateTimeDatePart } from '@technosoftware/trail-core';
import { ParsedTripDay } from './trip-note';
import { TravelTripStop } from '../vault/types';
import { dateOfDay, dayKey, dayOfDate, endpointDate } from './relative-days';

export interface ItineraryDayGroup {
  /** The calendar date, once there is one: from the stop's own, or from its day number through the trip's departure. Null for a day nobody can date yet. */
  date: string | null;
  /**
   * Which day of the trip this is, 1-based.
   *
   * Set for a day the stops number themselves, and derived from the date for
   * a dated trip, so a header can say "Day 3" either way. Null only when
   * neither is knowable -- the leading stops before the first dated one, on a
   * trip with no departure.
   */
  number: number | null;
  /** What the day is called, when it says: "Pretoria" under "1. Tag". */
  title: string | null;
  /** The day's own paragraph, for a brochure that gives one. */
  note: string | null;
  stops: TravelTripStop[];
}

/**
 * Days appear in the order their first stop does, and stops keep their
 * order within a day -- neither is re-sorted. An itinerary's own order is
 * authoritative because an untimed stop has no other way to say where in
 * the day it belongs (see trip-note.ts on why stops aren't time-sorted).
 *
 * **A day is grouped by its key, not by its date.** A stop that says `day: 3`
 * on a trip with no departure has no date at all, and grouping by date would
 * collapse a twelve-day brochure into one undated heap. `dayKey` gives the
 * resolved date where there is one and the day number where there is not, so
 * the same grouping serves a trip before and after it is planned. Passing no
 * departure is the same as a trip that has none.
 *
 * An untimed stop attaches to the day currently being built rather than
 * starting a group of its own: an itinerary reading "outlet, lunch at the
 * Falknis, drive home" where only lunch got a time is one day, not one
 * day plus two orphans.
 */
/**
 * The distinct calendar dates a from/to pair touches, in order.
 *
 * Exists because the itinerary's time gutter carries clock times only,
 * which is right for stops (a day header sits above them) but wrong for
 * transport legs and accommodation nights -- those live in their own
 * bands with no day header, so rendering "08:00 - 15:30" for an outbound
 * leg and "09:00 - 14:00" for an inbound one made two different days look
 * like one. Reported from real use on a multi-day trip.
 *
 * Returns [] when neither value carries a date, one entry when they share
 * a date (or only one is set), and two when the pair crosses midnight --
 * so callers can render "8 August" or "8 August → 12 August" without
 * re-deriving the comparison.
 */
export function spannedDates(from: string | null, to: string | null): string[] {
  const dates = [from, to]
    .filter((v): v is string => typeof v === 'string' && v !== '')
    .map(dateTimeDatePart);
  return [...new Set(dates)];
}

export function groupStopsByDay(
  stops: TravelTripStop[],
  departure: string | null = null
): ItineraryDayGroup[] {
  const groups: ItineraryDayGroup[] = [];
  let current: ItineraryDayGroup | null = null;
  let key: string | null = null;

  for (const stop of stops) {
    // The key rather than the date, so a trip with no departure still breaks
    // into its twelve days: two stops on day 3 group together whether or not
    // anybody knows what day 3 is yet.
    const stopKey = dayKey({ day: stop.day, value: stop.from }, departure);

    if (stopKey !== null && (!current || key !== stopKey)) {
      const date = endpointDate({ day: stop.day, value: stop.from }, departure);
      current = {
        date,
        number: stop.day ?? dayOfDate(departure, date),
        title: null,
        note: null,
        stops: [],
      };
      key = stopKey;
      groups.push(current);
    } else if (!current) {
      current = { date: null, number: null, title: null, note: null, stops: [] };
      groups.push(current);
    }
    current.stops.push(stop);
  }
  return groups;
}

/**
 * The itinerary as days, with each day's own title and paragraph on it.
 *
 * `groupStopsByDay` above knows only about stops, and a day that says
 * something has to appear **even when nothing is booked on it** -- "4. Tag:
 * Seetag" is a real day of a cruise and has no stop to build a group from. So
 * annotated days the stops did not produce are merged in here.
 *
 * **Inserted by number, never by re-sorting.** The rule that days appear in
 * the order their first stop does is older than this and still holds: nothing
 * that came out of `groupStopsByDay` moves. A stopless day goes in front of
 * the first day numbered higher than it, and at the end when there is no such
 * day -- which puts it where a reader expects without touching the order of
 * anything that has stops.
 */
export function itineraryDays(
  stops: TravelTripStop[],
  departure: string | null = null,
  days: readonly ParsedTripDay[] = []
): ItineraryDayGroup[] {
  const groups = groupStopsByDay(stops, departure);
  const annotation = new Map(days.map((day) => [day.day, day]));

  for (const group of groups) {
    const found = group.number === null ? undefined : annotation.get(group.number);
    if (!found) continue;
    group.title = found.title;
    group.note = found.note;
  }

  const covered = new Set(groups.map((group) => group.number));
  for (const day of [...days].sort((a, b) => a.day - b.day)) {
    if (covered.has(day.day)) continue;

    const at = groups.findIndex((group) => group.number !== null && group.number > day.day);
    const group: ItineraryDayGroup = {
      date: dateOfDay(departure, day.day),
      number: day.day,
      title: day.title,
      note: day.note,
      stops: [],
    };
    if (at === -1) groups.push(group);
    else groups.splice(at, 0, group);
    covered.add(day.day);
  }

  return groups;
}
