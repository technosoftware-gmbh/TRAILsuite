/**
 * Derives a Country's "visited" state and most-recent-visit date from its
 * Cities and places -- Country itself carries no `visited`/`lastVisit`
 * frontmatter (see types.ts's own doc comment and travel-module-plan.md
 * §3), so this walks every City and place-type entity that references the
 * country directly (`country:`, not via State) and folds their own
 * visited/lastVisit fields into one answer for the country as a whole.
 * Shared by place-stats.ts (the dashboard's "countries visited" count)
 * and travel-dashboard-sort.ts (the Countries section's most-recent-first
 * ordering), so the two stay consistent with each other by construction.
 */
import { TravelBoard, TravelCountry } from '../vault/types';

export interface CountryVisitInfo {
  visited: boolean;
  /** Latest lastVisit date string among the country's visited children, or null if none of them recorded one. */
  lastVisit: string | null;
}

export function countryVisitInfo(country: TravelCountry, board: TravelBoard): CountryVisitInfo {
  let visited = false;
  let lastVisit: string | null = null;

  for (const city of board.cities) {
    if (city.country?.title !== country.title || !city.visited) continue;
    visited = true;
    if (city.lastVisit && (!lastVisit || city.lastVisit > lastVisit)) lastVisit = city.lastVisit;
  }
  for (const place of board.places) {
    if (place.country?.title !== country.title || !place.visited) continue;
    visited = true;
    if (place.lastVisit && (!lastVisit || place.lastVisit > lastVisit)) lastVisit = place.lastVisit;
  }

  return { visited, lastVisit };
}
