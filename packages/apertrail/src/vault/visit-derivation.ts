/**
 * Derives `visited` / `lastVisit` for Cities and places from the trips
 * that stop at them.
 *
 * Why derive rather than write: a stop on a finished trip IS the evidence
 * that a place was visited, and it already lives in the vault. Stamping
 * that evidence onto every place note would mean the plugin editing notes
 * nobody asked it to edit, as a side effect of editing a different note --
 * and it would immediately go stale the moment a trip's dates or stops
 * changed. Deriving keeps one source of truth. This is the same call
 * trip-note.ts's effectiveTravelStatus() makes for a missing status, for
 * the same reason.
 *
 * An explicit `visited: true` in a note always wins, and an explicit
 * `lastVisit` is folded in alongside the derived dates rather than
 * replaced -- a place visited long before the vault started tracking
 * trips has no trip to derive from, and that hand-written history must
 * not be thrown away.
 *
 * Only trips whose effective status is `Over` count. A Planned or Booked
 * trip is an intention, and a Cancelled one is evidence of the opposite.
 */
import { TravelCity, TravelPlace, TravelTrip } from './types';

export interface DerivedVisit {
  visited: boolean;
  lastVisit: string | null;
  /** True when a finished trip contributed -- lets the UI explain a visited flag the note itself doesn't carry. */
  fromTrips: boolean;
}

/**
 * The date a stop happened, for visit purposes: its own start time,
 * falling back to the trip's return and then departure. A stop with no
 * time of its own on a trip with no dates at all still counts as a visit,
 * just an undated one -- "we went there" is the claim, and the date is
 * extra.
 */
function stopDate(trip: TravelTrip, stopFrom: string | null): string | null {
  const raw = stopFrom ?? trip.return ?? trip.departure;
  return raw ? raw.slice(0, 10) : null;
}

/**
 * Indexes every finished trip's stops by the note title they point at.
 * Built once per board read and shared by the City and place passes,
 * rather than re-walking every trip for every place.
 */
export function buildVisitIndex(trips: TravelTrip[]): Map<string, string[]> {
  const byTitle = new Map<string, string[]>();
  for (const trip of trips) {
    if (trip.effectiveStatus !== 'Over') continue;
    for (const stop of trip.stops) {
      if (!stop.placeTitle) continue;
      const dates = byTitle.get(stop.placeTitle) ?? [];
      const date = stopDate(trip, stop.from);
      // A visit with no resolvable date still has to register as a visit,
      // so the empty string is pushed as a marker rather than skipped --
      // callers only ever compare non-empty values for recency.
      dates.push(date ?? '');
      byTitle.set(stop.placeTitle, dates);
    }
  }
  return byTitle;
}

export function deriveVisit(
  title: string,
  explicitVisited: boolean,
  explicitLastVisit: string | null,
  index: Map<string, string[]>
): DerivedVisit {
  const tripDates = index.get(title) ?? [];
  const fromTrips = tripDates.length > 0;

  const candidates = [explicitLastVisit, ...tripDates].filter(
    (d): d is string => typeof d === 'string' && d !== ''
  );
  const lastVisit = candidates.length > 0 ? candidates.reduce((a, b) => (a > b ? a : b)) : null;

  return {
    visited: explicitVisited || fromTrips,
    lastVisit,
    fromTrips,
  };
}

/**
 * Folds derived visits into the already-built Cities and places, in place.
 *
 * Mutating rather than rebuilding matches how read-entities.ts already
 * resolves the Country/State/City cycle: every consumer holds references
 * to these exact objects by this point, so replacing them would leave the
 * board's own cross-references pointing at stale copies.
 */
export function applyDerivedVisits(
  cities: TravelCity[],
  places: TravelPlace[],
  trips: TravelTrip[]
): void {
  const index = buildVisitIndex(trips);
  for (const city of cities) {
    const derived = deriveVisit(city.title, city.visited, city.lastVisit, index);
    city.visited = derived.visited;
    city.lastVisit = derived.lastVisit;
    city.visitedFromTrips = derived.fromTrips;
  }
  for (const place of places) {
    const derived = deriveVisit(place.title, place.visited, place.lastVisit, index);
    place.visited = derived.visited;
    place.lastVisit = derived.lastVisit;
    place.visitedFromTrips = derived.fromTrips;
  }
}
