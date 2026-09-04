/**
 * The two stat cards beside the hero: how big the library is, and what gets
 * eaten most.
 *
 * Both counted from the notes on this render. A stored figure would be wrong by
 * the next morning and nothing would notice.
 *
 * The size card carries the whole number at hero scale because it is the one
 * figure somebody glances at rather than reads, and it is clickable because the
 * obvious next thought after seeing it is to go and look at them.
 */
import { t } from '../../lang/I18nManager';
import type { GalleryEntry } from '../../meals/view-model/gallery-entry';
import { buildLibraryStats } from '../../meals/view-model/library-stats';
import { cardLabel, dashboardCard, dashboardColumn, renderEmpty } from './section';
import type { DashboardViewDeps } from './deps';

/** The meal eaten most often, or null when nothing has been. */
function mostEaten(entries: GalleryEntry[]): GalleryEntry | null {
  let best: GalleryEntry | null = null;
  for (const entry of entries) {
    const count = entry.meta.eatenCount ?? 0;
    if (count === 0) continue;
    if (!best || count > (best.meta.eatenCount ?? 0)) best = entry;
  }
  return best;
}

export function renderLibrarySection(
  grid: HTMLElement,
  deps: DashboardViewDeps,
  entries: GalleryEntry[]
): void {
  const settings = deps.getSettings();
  const stats = buildLibraryStats(entries, settings.dashboardActivityRangeWeeks);

  const column = dashboardColumn(grid, 4, ['culi-dashboard-stats-col']);

  const total = dashboardCard(column, 12, [
    'culi-dashboard-stat-card',
    'culi-dashboard-stat-card--number',
  ]);
  total.setAttrs({ role: 'button', tabindex: '0' });
  total.createDiv({ cls: 'culi-dashboard-stat-number', text: String(stats.total) });
  cardLabel(
    total,
    stats.total === 0 ? t('dashboard.library.empty') : t('dashboard.library.mealsInVault')
  );
  total.addEventListener('click', () => deps.openGallery());

  const eaten = dashboardCard(column, 12, ['culi-dashboard-stat-card']);
  cardLabel(eaten, t('dashboard.library.mostEaten'));

  const best = mostEaten(entries);
  if (!best) {
    renderEmpty(eaten, t('dashboard.library.nothingEaten'));
    return;
  }

  const row = eaten.createDiv({
    cls: 'culi-dashboard-most-eaten-row',
    attr: { role: 'button', tabindex: '0' },
  });
  row.createSpan({ cls: 'culi-dashboard-most-eaten-name', text: best.title });
  row.createSpan({
    cls: 'culi-dashboard-most-eaten-count',
    text: t('dashboard.library.eatenCount').replace('{count}', String(best.meta.eatenCount ?? 0)),
  });
  row.addEventListener('click', () => deps.openMeal(best.file.path));
}
