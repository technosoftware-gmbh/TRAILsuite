/**
 * The line above the grid: how many meals matched, what narrowed them, and
 * how they are ordered.
 *
 * It exists so that a grid showing eleven meals out of four hundred says
 * why. A filter panel that is collapsed is otherwise invisible, and "my
 * meals are missing" is the report that follows.
 */
import { t } from '../../lang/I18nManager';
import type { GallerySavedState } from '../../settings/types';
import { sortDirectionLabel, sortFieldLabel } from './sort-labels';

function activeFilterLabels(state: GallerySavedState): string[] {
  const labels: string[] = [];

  if (state.folder) labels.push(t('meals.gallery.stats.inFolder', { folder: state.folder }));
  if (state.diet) labels.push(state.diet);
  if (state.tag) labels.push(t('meals.gallery.stats.tagged', { tag: state.tag }));
  if (state.favoriteOnly) labels.push(t('meals.gallery.filters.favoritesOnly'));
  if (state.neverEaten) labels.push(t('meals.gallery.filters.neverEaten'));
  if (state.excludeAllergens) labels.push(t('meals.gallery.filters.excludeAllergens'));

  return labels;
}

export function renderStatsRow(
  container: HTMLElement,
  count: number,
  state: GallerySavedState
): void {
  const row = container.createDiv({ cls: 'culi-gallery-stats' });

  const total = row.createDiv({ cls: 'culi-gallery-stats-count' });
  total.createEl('strong', { text: String(count) });
  total.createSpan({
    text: count === 1 ? t('meals.gallery.stats.oneMeal') : t('meals.gallery.stats.manyMeals'),
  });

  const labels = activeFilterLabels(state);
  if (labels.length > 0) {
    const chips = row.createDiv({ cls: 'culi-gallery-stats-filters' });
    for (const label of labels) chips.createSpan({ cls: 'culi-gallery-stats-chip', text: label });
  }

  // The translated field name, not the stored id. The stored ids are
  // configuration, and a line reading "sorted by last-eaten desc" is the
  // plumbing showing through.
  row.createDiv({
    cls: 'culi-gallery-stats-sort',
    text: t('meals.gallery.stats.sortedBy', {
      field: sortFieldLabel(state.sortField),
      direction: sortDirectionLabel(state.sortDirection),
    }),
  });
}
