/**
 * A day, as a `YYYY-MM-DD` string and as a Date at local midnight.
 *
 * Everything in `dates/` works from a Date's LOCAL calendar fields and returns
 * Dates at LOCAL midnight. That is the one rule this whole module rests on, and
 * it is not a preference.
 *
 * The plugins previously ran two conventions at once: one worked in local
 * fields, the other canonicalised to UTC midnight while still reading its inputs
 * with local getters. Where the two met, a Monday at UTC midnight was read back
 * as the Sunday before it in any timezone west of Greenwich, and the ISO week
 * derived from it was the previous one. Measured over 2015 to 2040: every week
 * from UTC-3 westward resolved to a filename one week early, and nobody noticed
 * because the vault it was built in is UTC+1.
 *
 * A day in a personal vault is a local calendar day. Anything that needs an
 * instant rather than a day is a different type and does not belong here.
 */

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * `YYYY-MM-DD` from a Date's local calendar fields.
 *
 * Never `toISOString()`, which converts to UTC and writes yesterday's date for
 * anything done late in the evening east of Greenwich.
 */
export function formatDayTitle(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * The same function under the name callers use when they mean a date VALUE
 * rather than a note title.
 *
 * One implementation, two names, and the alias is deliberate rather than
 * duplication: a daily note is titled `2026-06-25`, and an order's `orderDate:`
 * is the string `2026-06-25`, and those are the same format for the same reason
 * but they are not the same idea. Renaming either at the call sites would make
 * one of the two read wrongly.
 */
export const localDateISO = formatDayTitle;

const DAY_TITLE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A `YYYY-MM-DD` string as a Date at local midnight, or null when it is not one. */
export function parseDayTitle(title: string): Date | null {
  const match = DAY_TITLE.exec(title.trim());
  if (!match) return null;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * `date` shifted by whole days.
 *
 * Through `setDate` rather than by adding milliseconds, so the 23 and 25 hour
 * days a daylight-saving change produces stay one day.
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Local midnight of the same calendar day, discarding any clock time. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** True when a `YYYY-MM-DD` string names the same day as `date`. */
export function isSameDay(isoDate: string, date: Date): boolean {
  return isoDate === formatDayTitle(date);
}

/** True when a `YYYY-MM-DD` string falls within [start, end], both inclusive. */
export function isWithinRange(isoDate: string, start: Date, end: Date): boolean {
  const parsed = parseDayTitle(isoDate);
  if (!parsed) return false;

  const t = parsed.getTime();
  return t >= startOfDay(start).getTime() && t <= startOfDay(end).getTime();
}
