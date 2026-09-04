/**
 * The names and icons of the sort fields.
 *
 * One table, used by the sort menu and by the stats row that says what the
 * grid is currently sorted by. Two tables would let the menu say "Last
 * eaten" while the line under it said `last-eaten`, which is what the
 * inherited version does.
 */
import { t } from '../../lang/I18nManager';
import type { GallerySortDirection, GallerySortField } from '../../settings/types';

/** In the order the menu offers them. */
export const SORT_FIELDS: GallerySortField[] = [
  'title',
  'date-added',
  'date-modified',
  'last-eaten',
  'times-eaten',
];

export const SORT_FIELD_ICONS: Record<GallerySortField, string> = {
  title: 'type',
  'date-added': 'calendar-plus',
  'date-modified': 'calendar-clock',
  'last-eaten': 'history',
  'times-eaten': 'repeat',
};

export function sortFieldLabel(field: GallerySortField): string {
  switch (field) {
    case 'date-added':
      return t('meals.gallery.sort.dateAdded');
    case 'date-modified':
      return t('meals.gallery.sort.dateModified');
    case 'last-eaten':
      return t('meals.gallery.sort.lastEaten');
    case 'times-eaten':
      return t('meals.gallery.sort.timesEaten');
    case 'title':
    default:
      // `titleField`, not `title`: the latter is the sort menu's own name.
      return t('meals.gallery.sort.titleField');
  }
}

export function sortDirectionLabel(direction: GallerySortDirection): string {
  return direction === 'desc'
    ? t('meals.gallery.sort.descending')
    : t('meals.gallery.sort.ascending');
}
