/**
 * The dashboard's hero: how much eating has been happening.
 *
 * A chart when there is a eating history to chart, and a plain list of what was
 * made most recently when the feature is off. The fallback is not a lesser
 * version of the chart; it answers the one question the chart answers that a
 * vault with no log can still answer.
 */
import { Menu } from 'obsidian';
import type { DashboardActivityRangeWeeks } from '../../settings/types';
import { t } from '../../lang/I18nManager';
import type { GalleryEntry } from '../../meals/view-model/gallery-entry';
import { dayTime } from '../../meals/view-model/library-stats';
import {
  buildEatingActivity,
  type ActivityBucket,
  type ActivityGranularity,
} from '../../meals/view-model/eating-activity';
import { renderBarChart, type ChartBar } from './chart-bars';
import { cardHeader, dashboardCard, renderEmpty } from './section';
import type { DashboardViewDeps } from './deps';
import { activeDisplayLocale } from '../../shared/display';

/**
 * The ranges offered.
 *
 * The settings field is a union of exactly these, so the list is typed rather
 * than a bare number array: the select's value comes back as a string and has to
 * be narrowed to one of them, and a plain cast would let a hand-edited
 * data.json through.
 */
const RANGES: DashboardActivityRangeWeeks[] = [1, 2, 4, 8, 12];

/** Above this many daily bars the labels collide, so every other one is blanked. */
const DENSE_BAR_COUNT = 14;

const RECENTLY_MADE_LIMIT = 3;

function axisLabel(start: string, granularity: ActivityGranularity): string {
  const date = new Date(`${start}T00:00:00`);
  if (Number.isNaN(date.getTime())) return start;
  return granularity === 'day'
    ? date.toLocaleDateString(activeDisplayLocale(), { weekday: 'short' })
    : date.toLocaleDateString(activeDisplayLocale(), { month: 'short', day: 'numeric' });
}

function hoverLabel(bucket: ActivityBucket, granularity: ActivityGranularity): string {
  const date = new Date(`${bucket.start}T00:00:00`);
  const shown = Number.isNaN(date.getTime())
    ? bucket.start
    : date.toLocaleDateString(activeDisplayLocale(), { month: 'short', day: 'numeric' });

  const prefix =
    granularity === 'week' ? t('dashboard.activity.weekOf').replace('{date}', shown) : shown;

  return t('dashboard.activity.hover')
    .replace('{prefix}', prefix)
    .replace('{count}', String(bucket.count));
}

/**
 * What a bucket was made up of, as a menu.
 *
 * An Obsidian `Menu` rather than a second tooltip mechanism. The same meal
 * eaten twice in one bucket is one row with a count, because two identical
 * rows read as a rendering bug.
 */
function openBucketMenu(event: MouseEvent, bucket: ActivityBucket, deps: DashboardViewDeps): void {
  const counts = new Map<string, { title: string; path: string; count: number }>();
  for (const cook of bucket.cooks) {
    const existing = counts.get(cook.path);
    if (existing) existing.count += 1;
    else counts.set(cook.path, { ...cook, count: 1 });
  }

  const menu = new Menu();
  for (const { title, path, count } of counts.values()) {
    menu.addItem((item) =>
      item
        .setTitle(
          count > 1
            ? t('dashboard.activity.eatenTimes')
                .replace('{name}', title)
                .replace('{count}', String(count))
            : title
        )
        .setIcon('utensils')
        .onClick(() => deps.openMeal(path))
    );
  }
  menu.showAtMouseEvent(event);
}

function renderRangeSelect(
  header: HTMLElement,
  current: DashboardActivityRangeWeeks,
  deps: DashboardViewDeps
): void {
  const select = header.createEl('select', { cls: 'culi-dashboard-chart-range-select' });

  for (const weeks of RANGES) {
    const option = select.createEl('option', {
      value: String(weeks),
      // A dedicated singular rather than one interpolated string: "1 weeks" is
      // awkward in English and simply wrong in German.
      text:
        weeks === 1
          ? t('dashboard.activity.oneWeek')
          : t('dashboard.activity.weeks').replace('{count}', String(weeks)),
    });
    if (weeks === current) option.selected = true;
  }

  select.addEventListener('change', () => {
    const chosen = RANGES.find((weeks) => String(weeks) === select.value);
    if (chosen) deps.setActivityRange(chosen);
  });
}

/**
 * The last few meals made, for a vault with eating history switched off.
 *
 * Read from `lastEaten` alone, which is the only thing such a vault has.
 */
function renderRecentlyMade(card: HTMLElement, entries: GalleryEntry[], deps: DashboardViewDeps) {
  const recent = entries
    .filter((entry) => dayTime(entry.meta.lastEaten) !== null)
    .sort((a, b) => (dayTime(b.meta.lastEaten) ?? 0) - (dayTime(a.meta.lastEaten) ?? 0))
    .slice(0, RECENTLY_MADE_LIMIT);

  if (recent.length === 0) {
    renderEmpty(card, t('dashboard.activity.nothingEaten'));
    return;
  }

  const list = card.createDiv({ cls: 'culi-dashboard-recently-made-list' });
  for (const entry of recent) {
    const row = list.createDiv({
      cls: 'culi-dashboard-recently-made-row',
      attr: { role: 'button', tabindex: '0' },
    });
    row.createSpan({ cls: 'culi-dashboard-recently-made-name', text: entry.title });
    row.createSpan({
      cls: 'culi-dashboard-recently-made-date',
      text: entry.meta.lastEaten ?? '',
    });
    row.addEventListener('click', () => deps.openMeal(entry.file.path));
  }
}

export function renderActivitySection(
  grid: HTMLElement,
  deps: DashboardViewDeps,
  entries: GalleryEntry[]
): void {
  const settings = deps.getSettings();
  const card = dashboardCard(grid, 8, ['culi-dashboard-hero']);

  if (!settings.eatingHistoryEnabled) {
    cardHeader(card, { label: t('dashboard.activity.recentlyMade') });
    renderRecentlyMade(card, entries, deps);
    return;
  }

  const weeks = settings.dashboardActivityRangeWeeks;
  const header = card.createDiv({ cls: 'culi-dashboard-chart-label-row' });
  header.createDiv({
    cls: 'culi-dashboard-card-label',
    text: t('dashboard.activity.title'),
  });
  renderRangeSelect(header, weeks, deps);

  const activity = buildEatingActivity(entries, weeks);
  const bars: ChartBar[] = activity.buckets.map((bucket) => ({
    axisLabel: axisLabel(bucket.start, activity.granularity),
    hoverLabel: hoverLabel(bucket, activity.granularity),
    value: bucket.count,
    onClick: bucket.cooks.length > 0 ? (event) => openBucketMenu(event, bucket, deps) : undefined,
  }));

  const labelEvery = activity.granularity === 'day' && bars.length > DENSE_BAR_COUNT ? 2 : 1;
  renderBarChart(card, bars, { labelEvery });
}
