/**
 * Taking a day out of a trip, and putting one in.
 *
 * "Not two nights in Johannesburg but only one" is a whole day removed from
 * the middle of an itinerary, and everything after it moving up. By hand that
 * is eleven stops, four day titles and a stay, each edited one at a time --
 * which is exactly the arithmetic a plugin should do and a person should not.
 *
 * **This is the operation the relative days were for.** A trip written as day
 * one to day twelve renumbers by subtracting one from some integers. The same
 * edit on a dated itinerary is retyping twelve dates, and it is why the note
 * keeps saying `day: 3` instead of resolving it.
 *
 * **Only stops are deleted.** A stay or a leg on the removed day keeps its
 * number, which now points at the following day. Deleting somebody's booked
 * flight because they cut a day from the plan is the more expensive mistake of
 * the two, and the cheap one -- a stay that now starts a day earlier than
 * intended -- is visible in the itinerary the moment it happens.
 *
 * A stay spanning the removed day comes out one night shorter, which is the
 * case this was asked for: Tag 1 -> Tag 3 becomes Tag 1 -> Tag 2.
 *
 * App-free, and free of the trip schema: it works on any shape carrying these
 * four lists, which is what `TripInput` is.
 */

/** Everything a shift has to renumber. `TripInput` satisfies this structurally. */
export interface ShiftableTrip {
  days: { day: number }[];
  stops: { day: number | null }[];
  nights: { checkInDay: number | null; checkOutDay: number | null }[];
  transport: { day: number | null; toDay: number | null }[];
}

/** A day number moved by `by`, but only when it is at or past `from`. Null and undefined stay as they are. */
function moved(day: number | null | undefined, from: number, by: number): number | null {
  if (day === null || day === undefined) return null;
  return day >= from ? day + by : day;
}

/** Renumbers every day at or past `from` by `by`, in place. */
function shift(trip: ShiftableTrip, from: number, by: number): void {
  for (const day of trip.days) day.day = day.day >= from ? day.day + by : day.day;
  for (const stop of trip.stops) stop.day = moved(stop.day, from, by);
  for (const night of trip.nights) {
    night.checkInDay = moved(night.checkInDay, from, by);
    night.checkOutDay = moved(night.checkOutDay, from, by);
  }
  for (const leg of trip.transport) {
    leg.day = moved(leg.day, from, by);
    leg.toDay = moved(leg.toDay, from, by);
  }
}

/**
 * Takes day `day` out: its own entry, the stops on it, and one off every day
 * after it.
 *
 * The shift starts at `day + 1` rather than at `day`, so nothing that was on
 * the removed day is renumbered onto the one before it. What is left pointing
 * at `day` is a stay or a leg that started there, and it now means what used
 * to be the next day -- see this file's header.
 */
export function removeDay(trip: ShiftableTrip, day: number): void {
  trip.days.splice(0, trip.days.length, ...trip.days.filter((entry) => entry.day !== day));
  trip.stops.splice(0, trip.stops.length, ...trip.stops.filter((stop) => stop.day !== day));
  shift(trip, day + 1, -1);
}

/**
 * Makes room for a new day at `day`, pushing everything from there on up.
 *
 * Nothing is created: the new day is empty until something is put on it, and
 * an empty day with no title does not appear at all. That is the honest
 * outcome -- "we are adding a night in Windhoek" is a day you then fill in,
 * not a day the plugin invents content for.
 */
export function insertDayBefore(trip: ShiftableTrip, day: number): void {
  shift(trip, day, 1);
}
