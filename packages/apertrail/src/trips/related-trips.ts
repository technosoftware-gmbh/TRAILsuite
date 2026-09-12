/**
 * The reverse of a Trip's own frontmatter: which trips stopped at a given
 * place or city, and which trips a given person came along on.
 *
 * Pure and App-free, for the same reason itinerary-days.ts is -- the
 * lookup is the part worth testing, and the block that renders it is DOM
 * building. Neither relationship needs new data: a Trip's `stops` already
 * point at places by wikilink and its `persons` already name participants,
 * so both of these are projections over TravelBoard rather than anything
 * written into the note being viewed. That's what makes
 * travel-module-plan.md §6's "Related Trips" section buildable -- before
 * stops existed there was no link to reverse.
 */
import { TravelBoard, TravelTrip, TravelTripStop } from '../vault/types';

export interface RelatedTripVisit {
  trip: TravelTrip;
  /** Every stop on this trip pointing at the note in question -- a trip can visit the same place twice in a day. Empty for a participation match, which is about the trip as a whole. */
  stops: TravelTripStop[];
}

/**
 * Most recent first, by the trip's own departure rather than by status, so
 * an upcoming booked visit sorts alongside past ones instead of into a
 * separate bucket -- on a place note, "when am I next there" and "when was
 * I last there" are the same question asked from two directions, and the
 * same holds for a person. Trips with no departure date sort last.
 */
function byDepartureDesc(a: RelatedTripVisit, b: RelatedTripVisit): number {
  const aDate = a.trip.departure ?? '';
  const bDate = b.trip.departure ?? '';
  if (aDate && bDate) return bDate.localeCompare(aDate);
  if (aDate) return -1;
  if (bDate) return 1;
  return a.trip.title.localeCompare(b.trip.title);
}

/** Trips that stop at `title`, most recent first. */
export function relatedTrips(board: TravelBoard, title: string): RelatedTripVisit[] {
  const matches: RelatedTripVisit[] = [];
  for (const trip of board.trips) {
    const stops = trip.stops.filter((stop) => stop.placeTitle === title);
    if (stops.length > 0) matches.push({ trip, stops });
  }
  return matches.sort(byDepartureDesc);
}

/**
 * Trips that name `title` as a participant, most recent first.
 *
 * Matched against the trip's raw `personTitles` rather than a resolved
 * Person note, because that list is what the trip actually carries: a name
 * typed by hand with no note behind it still means someone came along, and
 * a Person note is not required for the trip to be true. The stops list is
 * empty by construction -- being on a trip is a fact about the whole trip,
 * not about any one stop on it.
 */
export function tripsWithPerson(board: TravelBoard, title: string): RelatedTripVisit[] {
  return board.trips
    .filter((trip) => trip.personTitles.includes(title))
    .map((trip) => ({ trip, stops: [] }))
    .sort(byDepartureDesc);
}

/**
 * Trips with a leg taken on `title`, most recent first.
 *
 * Matched against the leg's raw `vehicleTitle` rather than its resolved
 * vehicle, for the reason `tripsWithPerson` matches raw names: a ship somebody
 * typed the name of, with no note behind it, is still the ship they sailed on.
 * The stops list is empty by construction -- being aboard is a fact about the
 * leg, and the leg is not a stop.
 */
export function tripsOnVehicle(board: TravelBoard, title: string): RelatedTripVisit[] {
  return board.trips
    .filter((trip) => trip.transport.some((leg) => leg.vehicleTitle === title))
    .map((trip) => ({ trip, stops: [] }))
    .sort(byDepartureDesc);
}

/**
 * Trips with a stop that is `title`, most recent first.
 *
 * Matched against the stop's raw `excursionTitle` rather than its resolved
 * excursion, for the reason `tripsOnVehicle` matches raw names: a tour
 * somebody typed the name of, with no note behind it, is still the tour they
 * took. Unlike a vehicle this one DOES carry its stops, because on an
 * excursion note the stops are what somebody wants to see -- which day of
 * which trip, and what it cost that time.
 */
export function tripsWithExcursion(board: TravelBoard, title: string): RelatedTripVisit[] {
  const matches: RelatedTripVisit[] = [];
  for (const trip of board.trips) {
    const stops = trip.stops.filter((stop) => stop.excursionTitle === title);
    if (stops.length > 0) matches.push({ trip, stops });
  }
  return matches.sort(byDepartureDesc);
}

/**
 * Trips that touch any of `titles`, most recent first.
 *
 * What "your trips here" means for a Country, a State or a City, none of which
 * a trip names the way it names a stop. A trip belongs to a country by its
 * `country:`, to a city by its `cities:` list, and to either by stopping
 * somewhere in it -- so the caller hands in the set of names that count (a
 * state passes its cities, a country its cities and itself) and this asks the
 * one question of all of them.
 *
 * Stops are carried where there are any, because on a city note the stops are
 * exactly what somebody wants to see; a trip that only names the region in its
 * frontmatter contributes none, which is honest rather than empty.
 */
export function tripsCovering(board: TravelBoard, titles: readonly string[]): RelatedTripVisit[] {
  // Blank names are dropped rather than matched: an unconfigured or empty
  // title would otherwise match every stop that has none. With nothing left
  // in the set no trip matches, which is the answer a State with no cities
  // written down should get.
  const wanted = new Set(titles.filter((title) => title.trim() !== ''));

  const matches: RelatedTripVisit[] = [];
  for (const trip of board.trips) {
    const stops = trip.stops.filter((stop) => stop.placeTitle && wanted.has(stop.placeTitle));
    const named =
      (trip.countryTitle !== null && wanted.has(trip.countryTitle)) ||
      trip.cityTitles.some((city) => wanted.has(city));
    if (stops.length > 0 || named) matches.push({ trip, stops });
  }
  return matches.sort(byDepartureDesc);
}
