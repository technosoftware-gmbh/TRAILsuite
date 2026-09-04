/**
 * The Places tiles of the stats row: countries visited (derived, see
 * places/country-visited.ts), landmarks visited vs. total, and photo spots
 * captured vs. total. Each narrows the grid below to its own type.
 *
 * To the type, not to what the tile counted: "3 / 11" filtered down to the
 * three would leave a grid that cannot answer the question the tile raises,
 * which is which of the other eight to go to next. The countries tile could
 * not do it anyway -- a Country's visit is derived rather than written, and
 * the gallery's visited facet excludes countries on purpose (see
 * travel-gallery-view.ts).
 */
import { t } from '../../lang/I18nManager';
import { PlaceDashboardStats } from '../place-stats';
import { renderNumberStatCard } from '../../ui/dashboard/stat-card';
import { GalleryTypeFilter } from '../../ui/gallery/travel-gallery-view';

export interface PlaceStatsRowActions {
  /** Narrows the grid below to one entity type. It used to open a second view; the tiles and the grid now sit in the same one. */
  showType: (typeFilter: GalleryTypeFilter) => void;
}

export function renderPlaceStatsRow(
  row: HTMLElement,
  stats: PlaceDashboardStats,
  actions: PlaceStatsRowActions
): void {
  renderNumberStatCard(row, {
    value: `${stats.countriesVisitedCount} / ${stats.countriesTotalCount}`,
    label: t('dashboard.stats.countriesVisited'),
    onClick: () => actions.showType('country'),
  });
  renderNumberStatCard(row, {
    value: `${stats.landmarksVisitedCount} / ${stats.landmarksTotalCount}`,
    label: t('dashboard.stats.landmarksVisited'),
    onClick: () => actions.showType('landmark'),
  });
  // Captured, not visited: the count that answers "what do I still owe
  // myself", which is the question a photography planner exists for. A spot
  // counts only when every motif it names has been shot, so a two-motif spot
  // with one frame in the bag is honestly still open.
  renderNumberStatCard(row, {
    value: `${stats.photoSpotsCapturedCount} / ${stats.photoSpotsTotalCount}`,
    label: t('dashboard.stats.photoSpotsCaptured'),
    onClick: () => actions.showType('photospot'),
  });
}
