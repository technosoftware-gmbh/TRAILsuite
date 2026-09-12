/**
 * Month, quarter and year: their titles, their boundaries, and stepping between
 * them.
 *
 * The title formats are deliberately not configurable. They are fixed ISO-ish
 * conventions rather than one more user-facing date-format setting, and they are
 * what a planning note is named, so changing one would orphan every note that
 * already exists.
 *
 * Local calendar fields throughout, like the rest of `dates/`.
 */
import { pad2 } from './day.js';

export function formatMonthTitle(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

const MONTH_TITLE = /^(\d{4})-(\d{2})$/;

export function parseMonthTitle(title: string): Date | null {
  const match = MONTH_TITLE.exec(title.trim());
  if (!match) return null;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The 1st of the month containing `date`, at local midnight. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** The last day of the month containing `date`. Day 0 of the next month is the last of this one. */
export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/**
 * The 1st of the month `months` away.
 *
 * **Deliberately snaps to the 1st**, because every caller of this navigates
 * between month notes and a month note is identified by its month rather than
 * by any day in it. A caller that needs the day of the month preserved wants
 * `addMonthsKeepingDay` below, and the two are separate names rather than a
 * flag so that neither call site can be misread.
 */
export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

/**
 * The same day of the month, `months` away, clamped to the target month's
 * length.
 *
 * For a charge that falls on the 15th, or on the 31st. 31 January plus one
 * month is the 28th of February rather than the 3rd of March: a standing charge
 * that skipped February and fell twice in March would be a projection nobody
 * recognises. The clamp is per step and the step is always computed from the
 * original day, so a series anchored on the 31st goes back to the 31st in the
 * months that have one rather than staying on the 28th for good.
 */
export function addMonthsKeepingDay(date: Date, months: number): Date {
  const day = date.getDate();
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();

  return new Date(target.getFullYear(), target.getMonth(), Math.min(day, lastDay));
}

export function formatQuarterTitle(date: Date): string {
  return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
}

const QUARTER_TITLE = /^(\d{4})-Q([1-4])$/;

export function parseQuarterTitle(title: string): Date | null {
  const match = QUARTER_TITLE.exec(title.trim());
  if (!match) return null;

  const date = new Date(Number(match[1]), (Number(match[2]) - 1) * 3, 1);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The 1st day of the quarter containing `date`, at local midnight. */
export function startOfQuarter(date: Date): Date {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
}

/** The last day of the quarter containing `date`. */
export function endOfQuarter(date: Date): Date {
  const start = startOfQuarter(date);
  return new Date(start.getFullYear(), start.getMonth() + 3, 0);
}

export function addQuarters(date: Date, quarters: number): Date {
  return addMonths(startOfQuarter(date), quarters * 3);
}

export function formatYearTitle(date: Date): string {
  return `${date.getFullYear()}`;
}

const YEAR_TITLE = /^(\d{4})$/;

export function parseYearTitle(title: string): Date | null {
  const match = YEAR_TITLE.exec(title.trim());
  if (!match) return null;

  const date = new Date(Number(match[1]), 0, 1);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** January 1st of the year containing `date`, at local midnight. */
export function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

/** December 31st of the year containing `date`. */
export function endOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 11, 31);
}

export function addYears(date: Date, years: number): Date {
  return new Date(date.getFullYear() + years, 0, 1);
}
