/**
 * Per-type ordering for the gallery's grid (see travel-module-plan.md §7):
 * Trips upcoming-soonest first then most-recent past, Countries
 * most-recently-visited-into first, place types by rating (falling back to
 * most-recently-visited when unrated), and Cities by most-recently-visited
 * alone (City has no rating field -- see types.ts).
 *
 * Kept separate from the *-stats.ts files since these are display orderings,
 * not the stats-row's aggregate numbers, even though both lean on the same
 * countryVisitInfo() derivation.
 *
 * These were the dashboard section strips' orderings until the dashboards
 * folded into the gallery, and they moved rather than being replaced by the
 * gallery's own three sorts: name, rating and last visit are answers to a
 * question you asked, and what a list of Trips should look like before you
 * ask anything is a separate judgement that had already been made here.
 */
import { countryVisitInfo } from '../../places/country-visited';
import {
  TravelBoard,
  TravelCity,
  TravelCountry,
  TravelPlace,
  TravelState,
  TravelTrip,
} from '../../vault/types';

/**
 * Two tiers, not one filter: everything still ahead of you (Planned/Booked)
 * soonest first, then everything else, most recent first.
 *
 * This started as Planned/Booked only, on the reasoning that a dashboard
 * answers "what's next". In a real vault that reads as broken -- four of
 * five trips were over, so the strip showed a single card under a heading
 * counting five. Keeping the upcoming trips *first* preserves the original
 * intent; the rest just fill the slots left over.
 *
 * **Cancelled trips used to be dropped from both tiers and are now ordered
 * like any other.** The reason they were dropped was the heading: a strip
 * capped at six under a count of every trip in the vault looked like it had
 * failed to load, and a cancelled trip was the one status with nothing to
 * contribute. The gallery has no such heading and no such cap -- it shows
 * everything the filters leave, and it carries a Travel-Status facet, so
 * "without the cancelled ones" is now a thing you can ask for rather than a
 * thing this function has to decide on your behalf. A sort that silently
 * removed rows would be a filter wearing a sort's name.
 */
export function sortTrips(trips: TravelTrip[]): TravelTrip[] {
  const upcoming = trips.filter(
    (trip) => trip.effectiveStatus === 'Planned' || trip.effectiveStatus === 'Booked'
  );
  const rest = trips.filter(
    (trip) => trip.effectiveStatus !== 'Planned' && trip.effectiveStatus !== 'Booked'
  );
  return [
    ...upcoming.sort((a, b) => byDeparture(a, b, 'asc')),
    ...rest.sort((a, b) => byDeparture(a, b, 'desc')),
  ];
}

/**
 * Undated trips sort last in either direction -- "no departure yet" is not
 * a date near the start of time, and it should not jump the queue in the
 * descending tier the way a plain reversal would make it.
 */
function byDeparture(a: TravelTrip, b: TravelTrip, order: 'asc' | 'desc'): number {
  if (a.departure && b.departure) {
    const compared = a.departure.localeCompare(b.departure);
    return order === 'asc' ? compared : -compared;
  }
  if (a.departure) return -1;
  if (b.departure) return 1;
  return a.title.localeCompare(b.title);
}

export function sortCountries(countries: TravelCountry[], board: TravelBoard): TravelCountry[] {
  const scored = countries.map((country) => ({ country, info: countryVisitInfo(country, board) }));
  return scored
    .sort((a, b) => {
      // Visited-with-a-date countries first (most recent first), then
      // visited-but-undated ones, then unvisited ones alphabetically --
      // three distinct tiers rather than treating "no date" as either
      // "oldest" or "newest", since neither would be true.
      if (a.info.lastVisit && b.info.lastVisit)
        return b.info.lastVisit.localeCompare(a.info.lastVisit);
      if (a.info.lastVisit) return -1;
      if (b.info.lastVisit) return 1;
      if (a.info.visited && !b.info.visited) return -1;
      if (!a.info.visited && b.info.visited) return 1;
      return a.country.title.localeCompare(b.country.title);
    })
    .map((s) => s.country);
}

export function sortPlaces(places: TravelPlace[]): TravelPlace[] {
  return [...places].sort((a, b) => {
    if (a.rating !== null && b.rating !== null && a.rating !== b.rating) return b.rating - a.rating;
    if (a.rating !== null && b.rating === null) return -1;
    if (a.rating === null && b.rating !== null) return 1;
    if (a.lastVisit && b.lastVisit) return b.lastVisit.localeCompare(a.lastVisit);
    if (a.lastVisit) return -1;
    if (b.lastVisit) return 1;
    return a.title.localeCompare(b.title);
  });
}

/**
 * States, alphabetically.
 *
 * **No visit tier, unlike every other list here, and that is the state's own
 * shape rather than an omission.** A state note carries no `visited` and no
 * `lastVisit`: a trip stops in cities and at places, and nothing derives a
 * visit up to the level above. Sorting by a date none of them have would be
 * sorting by nothing, so the name is the answer.
 */
export function sortStates(states: TravelState[]): TravelState[] {
  return [...states].sort((a, b) => a.title.localeCompare(b.title));
}

export function sortCities(cities: TravelCity[]): TravelCity[] {
  return [...cities].sort((a, b) => {
    if (a.lastVisit && b.lastVisit) return b.lastVisit.localeCompare(a.lastVisit);
    if (a.lastVisit) return -1;
    if (b.lastVisit) return 1;
    return a.title.localeCompare(b.title);
  });
}
