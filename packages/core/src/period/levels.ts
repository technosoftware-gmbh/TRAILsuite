/**
 * The five levels a periodic note can be at, and the arithmetic that moves
 * between them.
 *
 * The date functions this is built on already exist in `dates/`, one set per
 * level. What is here is the dispatch: given a level as a value rather than as
 * a function call, produce the title, parse it back, shift it, and name its
 * parent. A view that navigates five levels needs exactly that, and without it
 * every such view grows the same five-armed switch.
 *
 * App-free, and clock-free.
 */
import { addDays, formatDayTitle, parseDayTitle, startOfDay } from '../dates/day.js';
import { formatWeekTitle, startOfIsoWeek, startOfWeekTitle } from '../dates/iso-week.js';
import {
  addMonths,
  addQuarters,
  addYears,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  formatMonthTitle,
  formatQuarterTitle,
  formatYearTitle,
  parseMonthTitle,
  parseQuarterTitle,
  parseYearTitle,
  startOfMonth,
  startOfQuarter,
  startOfYear,
} from '../dates/periods.js';

/** Finest first, which is also the order a navigation chain reads downwards. */
export const PERIOD_LEVELS = ['day', 'week', 'month', 'quarter', 'year'] as const;
export type PeriodLevel = (typeof PERIOD_LEVELS)[number];

export function isPeriodLevel(value: unknown): value is PeriodLevel {
  return typeof value === 'string' && (PERIOD_LEVELS as readonly string[]).includes(value.trim());
}

/** The note title for the period a date falls in. */
export function periodTitle(level: PeriodLevel, date: Date): string {
  switch (level) {
    case 'day':
      return formatDayTitle(date);
    case 'week':
      return formatWeekTitle(date);
    case 'month':
      return formatMonthTitle(date);
    case 'quarter':
      return formatQuarterTitle(date);
    case 'year':
      return formatYearTitle(date);
  }
}

/** The first day of the period a title names, or null when the title is not of that level. */
export function parsePeriodTitle(level: PeriodLevel, title: string): Date | null {
  switch (level) {
    case 'day':
      return parseDayTitle(title);
    case 'week':
      return startOfWeekTitle(title);
    case 'month':
      return parseMonthTitle(title);
    case 'quarter':
      return parseQuarterTitle(title);
    case 'year':
      return parseYearTitle(title);
  }
}

/**
 * Which level a title is written at, or null.
 *
 * The five shapes cannot collide, which is what makes this answerable at all:
 * `2026`, `2026-08`, `2026-Q3`, `2026-W34` and `2026-08-22` are distinguishable
 * on sight. Checked longest first so `2026-08-22` is never read as the month
 * `2026-08` with something after it.
 */
export function detectPeriodLevel(title: string): PeriodLevel | null {
  const text = title.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return 'day';
  if (/^\d{4}-W\d{2}$/i.test(text)) return 'week';
  if (/^\d{4}-Q[1-4]$/i.test(text)) return 'quarter';
  if (/^\d{4}-\d{2}$/.test(text)) return 'month';
  if (/^\d{4}$/.test(text)) return 'year';
  return null;
}

/** The same period, `offset` steps away. Negative goes back. */
export function shiftPeriod(level: PeriodLevel, date: Date, offset: number): Date {
  switch (level) {
    case 'day':
      return addDays(date, offset);
    case 'week':
      return addDays(date, offset * 7);
    case 'month':
      return addMonths(date, offset);
    case 'quarter':
      return addQuarters(date, offset);
    case 'year':
      return addYears(date, offset);
  }
}

/** The period's first day, at local midnight. */
export function startOfPeriod(level: PeriodLevel, date: Date): Date {
  switch (level) {
    case 'day':
      return startOfDay(date);
    case 'week':
      return startOfIsoWeek(date);
    case 'month':
      return startOfMonth(date);
    case 'quarter':
      return startOfQuarter(date);
    case 'year':
      return startOfYear(date);
  }
}

/**
 * The period's last day, at local midnight.
 *
 * A day rather than an instant, because everything that asks this question is
 * comparing against `YYYY-MM-DD` values read out of frontmatter, and an end
 * expressed as 23:59:59.999 would only invite somebody to compare it against
 * one of those.
 */
export function endOfPeriod(level: PeriodLevel, date: Date): Date {
  switch (level) {
    case 'day':
      return startOfDay(date);
    case 'week':
      return addDays(startOfIsoWeek(date), 6);
    case 'month':
      return startOfDay(endOfMonth(date));
    case 'quarter':
      return startOfDay(endOfQuarter(date));
    case 'year':
      return startOfDay(endOfYear(date));
  }
}

/** The period as two ISO days, inclusive at both ends, which is the shape every frontmatter comparison wants. */
export function periodRange(level: PeriodLevel, date: Date): { from: string; to: string } {
  return {
    from: formatDayTitle(startOfPeriod(level, date)),
    to: formatDayTitle(endOfPeriod(level, date)),
  };
}

/** True when an ISO day falls inside a period. */
export function isInPeriodRange(isoDate: string, level: PeriodLevel, date: Date): boolean {
  const { from, to } = periodRange(level, date);
  return isoDate >= from && isoDate <= to;
}

/**
 * The level above, or null at the top.
 *
 * A week's parent is a month, and that is a deliberate simplification: a week
 * can straddle two months, and this answers with the month its Monday falls in.
 * The alternative is a week with two parents, which no navigation line can
 * render and no reader wants.
 */
export function parentLevel(level: PeriodLevel): PeriodLevel | null {
  switch (level) {
    case 'day':
      return 'week';
    case 'week':
      return 'month';
    case 'month':
      return 'quarter';
    case 'quarter':
      return 'year';
    case 'year':
      return null;
  }
}

/**
 * Every level above a given one, coarsest first.
 *
 * Coarsest first because that is the order a breadcrumb reads: year, then
 * quarter, then month, then week. A day note's chain is all four.
 */
export function ancestorLevels(level: PeriodLevel): PeriodLevel[] {
  const chain: PeriodLevel[] = [];

  let current = parentLevel(level);
  while (current) {
    chain.unshift(current);
    current = parentLevel(current);
  }
  return chain;
}
