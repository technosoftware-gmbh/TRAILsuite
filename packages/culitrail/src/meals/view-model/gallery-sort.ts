/**
 * Ordering the gallery grid.
 *
 * Every field computes its natural ascending order and lets one sign flip it,
 * with two deliberate exceptions noted below. Ties fall back to title, so the
 * grid is stable rather than reshuffling every render among meals that
 * share a rating.
 *
 * App-free.
 */
import type {
  CULItrailSettings,
  GallerySortDirection,
  GallerySortField,
} from '../../settings/types';
import type { GalleryEntry } from './gallery-entry';

type Comparator = (a: GalleryEntry, b: GalleryEntry) => number;

function byTitle(a: GalleryEntry, b: GalleryEntry): number {
  return a.title.localeCompare(b.title);
}

function comparator(field: GallerySortField, sign: number): Comparator {
  switch (field) {
    case 'date-added':
      return (a, b) => sign * (a.createdAt - b.createdAt) || byTitle(a, b);

    case 'date-modified':
      return (a, b) => sign * (a.modifiedAt - b.modifiedAt) || byTitle(a, b);

    case 'times-eaten':
      return (a, b) =>
        sign * ((a.meta.eatenCount ?? 0) - (b.meta.eatenCount ?? 0)) || byTitle(a, b);

    case 'last-eaten':
      return (a, b) => {
        // A meal nobody has eaten sorts last in *both* directions. It has
        // no date, so it belongs at neither end of a range of dates, and
        // flipping the sort to find the meal eaten longest ago should not
        // fill the top of the grid with meals that were never eaten.
        // Decided before the sign is applied, which is why this case cannot
        // be written as a plain subtraction.
        if (!a.meta.lastEaten && !b.meta.lastEaten) return byTitle(a, b);
        if (!a.meta.lastEaten) return 1;
        if (!b.meta.lastEaten) return -1;
        return sign * a.meta.lastEaten.localeCompare(b.meta.lastEaten) || byTitle(a, b);
      };

    case 'title':
    default:
      return (a, b) => sign * byTitle(a, b);
  }
}

export function sortGalleryEntries(
  entries: GalleryEntry[],
  field: GallerySortField,
  direction: GallerySortDirection,
  settings: CULItrailSettings
): GalleryEntry[] {
  // Last-eaten needs eating history to mean anything. With it turned off the
  // field is empty on every meal, so the grid would appear to ignore the
  // sort entirely; falling back to date-added at least orders by something.
  const effective = field === 'last-eaten' && !settings.eatingHistoryEnabled ? 'date-added' : field;

  return [...entries].sort(comparator(effective, direction === 'desc' ? -1 : 1));
}
