/**
 * Putting a period's contents on the day each one belongs to.
 *
 * The plan view used to draw a period as three lists, which is the right shape
 * for a quarter and the wrong one for a week: a week is seven days and reads as
 * seven days. These are the pure half of that -- which days a range covers,
 * which days a month's grid needs, and which items land on each -- so the
 * arithmetic is testable without a DOM and the components above it only draw.
 *
 * Days are ISO strings throughout rather than Dates. A bucket key has to
 * compare by value, and two Dates for the same midnight are not equal.
 */
import { addDays, formatDayTitle, parseDayTitle, startOfIsoWeek } from '@technosoftware/trail-core';

/** One cell of a month grid: the day, and whether it belongs to the month being shown. */
export interface GridDay {
  iso: string;
  inMonth: boolean;
}

/**
 * Every ISO day from `from` to `to`, both ends included.
 *
 * Stepped through `addDays` rather than by adding 86400000 to a timestamp,
 * because a day is not always 24 hours: Switzerland loses an hour in March and
 * gains one in October, and the naive arithmetic silently skips or repeats a
 * day on exactly those two dates. `addDays` moves the calendar field.
 *
 * A range whose end precedes its start is empty rather than an error. It cannot
 * arise from `periodRange`, and a view that drew nothing would be a better
 * failure than one that threw during a render.
 */
export function eachDay(fromIso: string, toIso: string): string[] {
  const start = parseDayTitle(fromIso);
  if (start === null || parseDayTitle(toIso) === null) return [];

  const days: string[] = [];
  // Bounded rather than `while (iso <= toIso)`: a malformed pair that somehow
  // got past the parse cannot spin here. Two years of days is far more than any
  // period this view draws and still finite.
  for (let offset = 0; offset < 800; offset++) {
    const iso = formatDayTitle(addDays(start, offset));
    if (iso > toIso) break;
    days.push(iso);
  }
  return days;
}

/**
 * The days a month's calendar grid covers: whole weeks, Monday to Sunday,
 * from the week containing the 1st to the week containing the last day.
 *
 * Four to six rows depending on the month, never a fixed six. A padded
 * six-row grid puts an empty week under February and makes every month look
 * like the same shape, which is the one thing a calendar is for.
 *
 * Monday-first because `startOfIsoWeek` is, and because the rest of this
 * plugin already counts weeks the ISO way -- the weekly note's own title is an
 * ISO week number. A Sunday-first grid here would disagree with the week the
 * level above it draws.
 */
export function monthGrid(monthStart: Date): GridDay[] {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  const from = formatDayTitle(startOfIsoWeek(first));
  const to = formatDayTitle(addDays(startOfIsoWeek(last), 6));

  return eachDay(from, to).map((iso) => {
    const date = parseDayTitle(iso);
    return {
      iso,
      inMonth: date !== null && date.getFullYear() === year && date.getMonth() === month,
    };
  });
}

/** Days in rows of seven, for a grid that lays weeks out as rows. */
export function weekRows<T>(days: readonly T[]): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < days.length; index += 7) {
    rows.push(days.slice(index, index + 7));
  }
  return rows;
}
