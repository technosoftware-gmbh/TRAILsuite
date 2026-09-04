/**
 * Prep, cook and total, as a fixed row rather than three chips.
 *
 * These are the numbers somebody scans before deciding to cook something, so
 * on a phone they get a row of their own at a size that can be read from
 * across a worktop. Which of the three appear still follows the badge
 * configuration: a vault that turned the Cook badge off does not get a cook
 * column here either.
 */
import { t } from '../../../lang/I18nManager';
import type { CULItrailSettings } from '../../../settings/types';
import { renderStatStrip, type StatCell } from '../../../ui/stat-strip';
import { effectiveTotalTime } from '../../parser/meal-meta';
import { formatMinutes } from '../../view-model/format-time';
import { timeBadgeKind, type TimeBadgeKind } from '../../view-model/time-badges';
import type { MealMeta } from '../../types';

function configuredKinds(settings: CULItrailSettings): Set<TimeBadgeKind> {
  const kinds = new Set<TimeBadgeKind>();
  for (const badge of settings.headerBadges) {
    if (!badge.enabled) continue;
    const kind = timeBadgeKind(badge, settings);
    if (kind) kinds.add(kind);
  }
  return kinds;
}

export function renderMobileStatRow(
  container: HTMLElement,
  meta: MealMeta,
  settings: CULItrailSettings
): void {
  const kinds = configuredKinds(settings);

  const cells: StatCell[] = [];
  const add = (kind: TimeBadgeKind, label: string, minutes: number | null) => {
    if (!kinds.has(kind) || minutes === null) return;
    const text = formatMinutes(minutes);
    if (text) cells.push({ label, value: text });
  };

  add('prep', t('meals.mobile.prep'), meta.prepTime);
  add('cook', t('meals.mobile.cook'), meta.reheatTime);
  // The derived total, same as the badge row uses, so a meal stating only
  // prep and cook still gets a total here rather than an empty column.
  add('total', t('meals.mobile.total'), effectiveTotalTime(meta));

  renderStatStrip(container, cells, { variant: 'boxed' });
}
