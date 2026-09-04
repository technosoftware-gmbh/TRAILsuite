/**
 * ISO 8601 weeks, and the `YYYY-Www` title meal plans are
 * keyed on.
 *
 * Week arithmetic is the one place in this family where an off-by-one writes a
 * note into the wrong file rather than merely displaying something odd, so it is
 * owned outright and tested directly, including against every timezone offset.
 *
 * Local calendar fields throughout, and Dates come back at LOCAL midnight. See
 * `day.ts` for why, and for what happened when that was not true.
 */
import { addDays, pad2, startOfDay } from './day.js';

export interface IsoWeek {
  /**
   * The ISO week-numbering year, which is NOT always the calendar year.
   *
   * 2026-01-01 falls in week 1 of 2026, but 2027-01-01 falls in week 53 of 2026.
   * Using the calendar year in a filename would file that day's note under the
   * wrong year's folder, and it would do so silently.
   */
  weekYear: number;
  /** 1 to 53. */
  week: number;
}

/** The Monday of the ISO week containing `date`, at local midnight. */
export function startOfIsoWeek(date: Date): Date {
  const result = startOfDay(date);
  // getDay() is 0 for Sunday; ISO counts Monday as the first day.
  const isoDayIndex = (result.getDay() + 6) % 7;
  return addDays(result, -isoDayIndex);
}

/**
 * The ISO week containing `date`.
 *
 * The Thursday shift encodes the rule: week 1 is the week containing the year's
 * first Thursday, so the calendar year of THIS week's Thursday is the
 * week-numbering year, by definition.
 *
 * The week number is a rounded division rather than a floored one. A daylight
 * saving change inside the span makes the elapsed milliseconds 23 or 25 hours
 * short of a whole number of weeks, and flooring that lands a week early.
 */
export function isoWeekOf(date: Date): IsoWeek {
  const thursday = addDays(startOfIsoWeek(date), 3);
  const firstThursday = addDays(startOfIsoWeek(new Date(thursday.getFullYear(), 0, 4)), 3);
  const week =
    1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));

  return { weekYear: thursday.getFullYear(), week };
}

/** `YYYY-Www`, zero padded so titles sort lexically. */
export function formatWeekTitle(date: Date): string {
  const { weekYear, week } = isoWeekOf(date);
  return `${weekYear}-W${pad2(week)}`;
}

const WEEK_TITLE = /^(\d{4})-W(\d{1,2})$/;

/**
 * `2026-W32` as its parts, or null for anything that is not a week title.
 *
 * Week 0 does not exist and no year has more than 53 weeks. A title outside that
 * range is a typo rather than a week, and null lets the caller treat it as "not
 * a week note" instead of navigating somewhere odd.
 */
export function parseWeekTitle(title: string): IsoWeek | null {
  const match = WEEK_TITLE.exec(title.trim());
  if (!match) return null;

  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;

  return { weekYear: Number(match[1]), week };
}

/**
 * The Monday of a week given by title, at local midnight, or null.
 *
 * Found by walking from the week containing 4 January, which is in week 1 in
 * every year by the ISO rule. Guessing at 1 January instead is wrong in any year
 * that starts on a Friday, Saturday or Sunday.
 *
 * `new Date(weekYear, 0, 4)` and not `Date.UTC(...)`: the whole module reads
 * local fields, and constructing this one date in UTC is what broke week
 * resolution for every timezone west of Greenwich in the code this replaces.
 */
export function startOfWeekTitle(title: string): Date | null {
  const parsed = parseWeekTitle(title);
  if (!parsed) return null;

  const week1Monday = startOfIsoWeek(new Date(parsed.weekYear, 0, 4));
  return addDays(week1Monday, (parsed.week - 1) * 7);
}

/** The title `offset` weeks away from another, for week navigation. Null when the input does not parse. */
export function shiftWeekTitle(title: string, offset: number): string | null {
  const monday = startOfWeekTitle(title);
  return monday ? formatWeekTitle(addDays(monday, offset * 7)) : null;
}

/** Today's week title. Takes `today` so callers under test are deterministic. */
export function currentWeekTitle(today: Date = new Date()): string {
  return formatWeekTitle(today);
}

/** True when a `YYYY-MM-DD` string falls in the same ISO week as `date`. */
export function isWithinWeekOf(isoDate: string, date: Date): boolean {
  const monday = startOfIsoWeek(date);
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;

  const t = startOfDay(parsed).getTime();
  return t >= monday.getTime() && t <= addDays(monday, 6).getTime();
}
