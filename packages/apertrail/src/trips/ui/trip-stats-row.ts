/**
 * The Trip tiles of a dashboard stats row: trip counts by Travel Status, and
 * a countdown to the next upcoming Trip.
 *
 * Two independent point-in-time counts rather than a chart -- there is no
 * time series behind either of them, so there is nothing to plot. See
 * travel-module-plan.md §7.
 */
import { TFile } from 'obsidian';
import { t } from '../../lang/I18nManager';
import { TRAVEL_STATUS_VALUES, TripDashboardStats, TravelStatusValue } from '../trip-stats';
import { createStatCard } from '../../ui/dashboard/stat-card';
import { GalleryTypeFilter } from '../../ui/gallery/travel-gallery-view';
import { formatMoney } from '../../shared/display';

export interface TripStatsRowActions {
  /** Narrows the grid below to one entity type. It used to open a second view; the tiles and the grid now sit in the same one. */
  showType: (typeFilter: GalleryTypeFilter) => void;
  openFile: (file: TFile) => void;
}

const STATUS_LABEL_KEYS: Record<TravelStatusValue, string> = {
  Planned: 'dashboard.stats.statusPlanned',
  Booked: 'dashboard.stats.statusBooked',
  Over: 'dashboard.stats.statusOver',
  Cancelled: 'dashboard.stats.statusCancelled',
};

function renderTripStatusCard(
  row: HTMLElement,
  stats: TripDashboardStats,
  actions: TripStatsRowActions
): void {
  const card = createStatCard(row, () => actions.showType('trip'));
  card.createDiv({
    cls: 'apt-dashboard-card-label',
    text: t('dashboard.stats.tripsByStatus'),
  });
  const list = card.createDiv({ cls: 'apt-dashboard-trip-status-list' });
  for (const status of TRAVEL_STATUS_VALUES) {
    const statusRow = list.createDiv({ cls: 'apt-dashboard-trip-status-row' });
    statusRow.createSpan({ text: t(STATUS_LABEL_KEYS[status]) });
    statusRow.createSpan({
      cls: 'apt-dashboard-trip-status-count',
      text: String(stats.tripCountsByStatus[status]),
    });
  }
}

function renderNextTripCard(
  row: HTMLElement,
  stats: TripDashboardStats,
  actions: TripStatsRowActions
): void {
  // Not a number tile: the label comes first here, and an empty state
  // replaces the number entirely rather than showing a zero.
  const next = stats.nextTrip;
  const card = createStatCard(row, next ? () => actions.openFile(next.trip.file) : undefined);
  card.createDiv({ cls: 'apt-dashboard-card-label', text: t('dashboard.stats.nextTrip') });
  if (!next) {
    card.createDiv({
      cls: 'apt-dashboard-empty-text',
      text: t('dashboard.stats.noUpcomingTrip'),
    });
    return;
  }
  card.createDiv({
    cls: 'apt-dashboard-stat-number',
    text:
      next.daysUntil === 0
        ? t('dashboard.stats.departsToday')
        : t('dashboard.stats.daysUntil', { days: next.daysUntil }),
  });
  card.createDiv({ cls: 'apt-dashboard-empty-text', text: next.trip.title });
}

/**
 * What the next trip is going to cost, against what it was allowed to.
 *
 * Rendered only when that trip has money on it: a tile reading "not yet" on
 * every dashboard would be a permanent reminder to use a feature rather than
 * a fact about a trip.
 */
function renderBudgetCard(
  row: HTMLElement,
  stats: TripDashboardStats,
  actions: TripStatsRowActions
): void {
  const budget = stats.nextTripBudget;
  const next = stats.nextTrip;
  if (!budget || !next) return;

  const card = createStatCard(row, () => actions.openFile(next.trip.file));
  card.createDiv({ cls: 'apt-dashboard-card-label', text: t('dashboard.stats.nextTripBudget') });
  card.createDiv({
    cls: 'apt-dashboard-stat-number',
    text:
      budget.committed === null
        ? t('costs.nothingYet')
        : formatMoney(budget.committed, budget.currency),
  });
  card.createDiv({
    cls: 'apt-dashboard-empty-text',
    text:
      budget.planned === null
        ? t('costs.unbudgeted')
        : t('costs.ofPlanned', { planned: formatMoney(budget.planned, budget.currency) }),
  });
}

export function renderTripStatsRow(
  row: HTMLElement,
  stats: TripDashboardStats,
  actions: TripStatsRowActions
): void {
  renderTripStatusCard(row, stats, actions);
  renderNextTripCard(row, stats, actions);
  renderBudgetCard(row, stats, actions);
}
