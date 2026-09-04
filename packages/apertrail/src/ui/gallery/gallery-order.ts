/**
 * The gallery grid's order before you ask for one: each entity type in its
 * own natural order, the types themselves in the order their chips read.
 *
 * The per-type orderings are the two retired dashboards' section strips
 * (ui/dashboard/travel-entity-sort.ts), moved here rather than dropped when
 * those views folded into the gallery. Name, rating and last visit are
 * answers to a question you asked; what a list of Trips should look like
 * before you ask anything is a separate judgement, and it had already been
 * made.
 *
 * A rank map keyed by path, rather than a comparator over gallery rows,
 * because the country ordering needs the whole board to resolve a visit no
 * Country note carries -- something a comparator over rows has no way to
 * reach. It also keeps this a pure function of two boards, which the view
 * itself is not.
 */
import { CrmBoard } from '../../crm/types';
import { TravelBoard } from '../../vault/types';
import {
  sortCities,
  sortCountries,
  sortPlaces,
  sortStates,
  sortTrips,
} from '../dashboard/travel-entity-sort';

/** The place kinds in the order their chips read, so the default order groups them the way the filter row does. */
export const PLACE_KIND_ORDER = [
  'accommodation',
  'fnb',
  'landmark',
  'location',
  'photospot',
] as const;

function byName(a: { title: string }, b: { title: string }): number {
  return a.title.localeCompare(b.title);
}

/**
 * Note path to rank. A path the map does not name has no opinion attached to
 * it, and the caller falls back to the title -- so an entity type added to
 * the grid and forgotten here sorts alphabetically rather than arbitrarily.
 *
 * People and companies sort by name alone. They are the two types with no
 * date, no rating and no visit, so there is nothing else to sort them by, and
 * they come last for the same reason their chips do: this is a travel plugin
 * that happens to know who you went with.
 */
export function defaultGalleryRanks(board: TravelBoard, crmBoard: CrmBoard): Map<string, number> {
  const ordered = [
    ...sortTrips(board.trips),
    ...sortCountries(board.countries, board),
    ...sortStates(board.states),
    ...sortCities(board.cities),
    ...PLACE_KIND_ORDER.flatMap((kind) =>
      sortPlaces(board.places.filter((place) => place.kind === kind))
    ),
    ...[...crmBoard.persons].sort(byName),
    ...[...crmBoard.companies].sort(byName),
  ];
  return new Map(ordered.map((entity, index) => [entity.file.path, index]));
}

/** Compares two rows by that map, title-first for anything it does not name and as the tiebreak. */
export function compareByRank(
  ranks: Map<string, number>,
  a: { file: { path: string }; title: string },
  b: { file: { path: string }; title: string }
): number {
  const rankA = ranks.get(a.file.path);
  const rankB = ranks.get(b.file.path);
  if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
  if (rankA !== undefined) return -1;
  if (rankB !== undefined) return 1;
  return a.title.localeCompare(b.title);
}
