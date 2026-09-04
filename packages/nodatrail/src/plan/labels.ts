/**
 * What one period is called, in the reader's own language.
 *
 * These were the navigation block's link labels until the block was retired.
 * They are now what the plan view puts over the period on screen, which is the
 * only place a period's name has to be readable rather than a note title.
 */
import { formatMonthName, isoWeekOf, type PeriodLevel } from 'trail-core';
import { activeDisplayLocale } from '../ui/kit/format';
import { t } from '../lang/I18nManager';

/**
 * One period's name, at the level it is written at.
 *
 * A day reads "Juli 21, 2026", a month reads "Juni", a week reads "Week 30",
 * and a year reads "2026". Those are the shapes the vault's own notes already
 * use, spelled through the translation table so a German vault reads
 * "Woche 30".
 */
export function periodName(level: PeriodLevel, date: Date): string {
  switch (level) {
    case 'day':
      return `${formatMonthName(date.getMonth() + 1, activeDisplayLocale())} ${date.getDate()}, ${date.getFullYear()}`;
    case 'week':
      return t('period.weekNumber', { week: String(isoWeekOf(date).week) });
    case 'month':
      return formatMonthName(date.getMonth() + 1, activeDisplayLocale());
    case 'quarter':
      return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
    case 'year':
      return String(date.getFullYear());
  }
}
