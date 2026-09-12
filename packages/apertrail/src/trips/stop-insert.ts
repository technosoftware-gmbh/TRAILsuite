/**
 * Where a newly added stop goes in a trip's `stops:` list.
 *
 * **The list is the itinerary's order**, not a hint about it:
 * `groupStopsByDay` walks it once and starts a new day group every time the
 * day changes, so two stops on day 3 are one day only while they are next to
 * each other. That is deliberate -- it is what lets a trip with no departure
 * date still break into its twelve days -- and it is why a stop appended to
 * the end of the list opens a SECOND day-3 group underneath day 12 rather than
 * joining the first.
 *
 * Which is what happened: `addStop` fills the day in from the group it was
 * added under, and its own comment says "a stop added to day 3 has to land on
 * day 3", and then the save appended. The value was right and the position was
 * not.
 *
 * **A day number OR a date**, resolved exactly the way the grouping resolves
 * it. A relative trip's stop carries `day: 3`; a dated trip's carries a date
 * and no number, because a stop saying both would be saying the same thing
 * twice. Ordering on the number alone would have left every dated trip
 * appending as before, which is the same bug wearing the other half of the
 * schema.
 *
 * **Nothing already in the list moves.** The list is somebody's own ordering
 * of their day, and a trip whose stops are deliberately out of day order stays
 * exactly as it is; only the new row is placed. That is the whole reason this
 * inserts rather than sorts.
 */
import { dayOfDate, endpointDate } from './relative-days';

/** A stop as this needs to see it: what it says about when, in either spelling. */
export interface StopPlacement {
  day: number | null;
  from: string | null;
}

/** Which day of the trip a stop falls on, however it says so, or null when it says nothing. */
export function stopDayNumber(stop: StopPlacement, departure: string | null): number | null {
  if (stop.day !== null) return stop.day;
  return dayOfDate(departure, endpointDate({ day: null, value: stop.from }, departure));
}

/**
 * The index the new stop belongs at.
 *
 * After the last stop of its own day, so a second stop added to day 3 follows
 * the first rather than displacing it. Failing that, before the first stop of
 * a later day -- which is index 0 for a stop earlier than everything in the
 * list, and NOT the end: "nothing earlier to follow" and "no day found at all"
 * are different answers, and collapsing them appended a day-1 stop under
 * day 12.
 *
 * A stop that says nothing about when is appended rather than guessed at: it
 * belongs to whatever run it is written next to, and the person adding it is
 * the only one who knows which. One already IN the list is carried along with
 * the run above it for the same reason -- inserting between the two would
 * split a pair somebody wrote together.
 */
export function stopInsertIndex(
  stops: readonly StopPlacement[],
  added: StopPlacement,
  departure: string | null
): number {
  const day = stopDayNumber(added, departure);
  if (day === null) return stops.length;

  let after = -1;
  let before = -1;
  for (let index = 0; index < stops.length; index++) {
    const entry = stops[index];
    if (!entry) continue;
    const existing = stopDayNumber(entry, departure);
    if (existing === null) {
      // Travels with the run above it rather than being stepped over. Before
      // any run it keeps its place at the head, because there is nothing there
      // for it to belong to.
      if (after !== -1) after = index;
      continue;
    }
    if (existing <= day) {
      after = index;
      continue;
    }
    // A later day ends the search: everything past it is further into the
    // trip, and stepping over it would move the new stop beyond a day it does
    // not belong to.
    before = index;
    break;
  }

  if (after !== -1) return after + 1;
  return before === -1 ? stops.length : before;
}
