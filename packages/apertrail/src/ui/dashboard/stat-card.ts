/**
 * The pieces a dashboard stats row is built from: the row itself, a plain
 * card the caller fills, and the "big number over a label" tile that most
 * stats turn out to be.
 *
 * `role="button"` and `tabindex` are set only where a click handler was
 * actually given. A tile with nothing to open should not announce itself as
 * pressable, which is the case for the next-trip tile when no trip is
 * upcoming.
 */

export function createStatsRow(grid: HTMLElement): HTMLElement {
  return grid.createDiv({ cls: 'apt-dashboard-stats-row apt-dashboard-span-12' });
}

export function createStatCard(row: HTMLElement, onClick?: () => void): HTMLElement {
  const card = row.createDiv({
    cls: 'apt-dashboard-card',
    attr: onClick ? { role: 'button', tabindex: '0' } : {},
  });
  if (onClick) card.addEventListener('click', onClick);
  return card;
}

export interface NumberStatCardOptions {
  value: string;
  label: string;
  onClick?: () => void;
}

export function renderNumberStatCard(row: HTMLElement, options: NumberStatCardOptions): void {
  const card = createStatCard(row, options.onClick);
  card.addClass('apt-dashboard-stat-card--number');
  card.createDiv({ cls: 'apt-dashboard-stat-number', text: options.value });
  card.createDiv({ cls: 'apt-dashboard-card-label', text: options.label });
}
