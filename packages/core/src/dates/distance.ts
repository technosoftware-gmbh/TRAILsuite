/**
 * How long ago a date was, in whole days.
 *
 * Both ends are pinned to local midnight before subtracting, so "yesterday" is
 * one day regardless of what time either end fell at, and the result is rounded
 * rather than floored so a daylight-saving change inside the span does not
 * shorten it by an hour and lose a day.
 */
import { parseDayTitle, startOfDay } from './day.js';

/**
 * Whole days between a `YYYY-MM-DD` string and today, or null when it is not a
 * date. Positive for the past.
 *
 * `today` is a parameter so a caller under test is deterministic. Every other
 * date function in this package takes its clock the same way, and this one used
 * to be the exception.
 */
export function daysSince(isoDate: string, today: Date = new Date()): number | null {
  const then = parseDayTitle(isoDate);
  if (!then) return null;

  const elapsed = startOfDay(today).getTime() - then.getTime();
  return Math.round(elapsed / 86_400_000);
}
