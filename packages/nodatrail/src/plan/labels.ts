/**
 * What one period is called, in the reader's own language.
 *
 * These were the navigation block's link labels until the block was retired.
 * They are now what the plan view puts over the period on screen, which is the
 * only place a period's name has to be readable rather than a note title.
 */
import {
  formatDayTitle,
  formatMonthName,
  isoWeekOf,
  type PeriodLevel,
} from '@technosoftware/trail-core';
import { activeDisplayLocale, day } from '../ui/kit/format';
import { t } from '../lang/I18nManager';

/**
 * One period's name, at the level it is written at.
 *
 * A day reads the way every other date in the views does, "21. Juli 2026" or
 * "July 21, 2026" as the display locale has it, a month reads "Juni", a week
 * reads "Week 30", and a year reads "2026".
 *
 * The day used to be assembled by hand as month, day, comma, year, which is the
 * American order in every language: a German vault read "Sep 15, 2026" over a
 * list whose dates said "15. September 2026". The week is spelled through the
 * translation table, so a German vault reads "Woche 30".
 */
export function periodName(level: PeriodLevel, date: Date): string {
  switch (level) {
    case 'day':
      return day(formatDayTitle(date));
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
