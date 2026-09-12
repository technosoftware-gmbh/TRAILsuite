/**
 * `YYYY-MM-DDTHH:mm`, the minute-precision local timestamp every note header
 * carries as `created:` and `modified:`.
 *
 * **Minute precision is load-bearing, not a rounding.** js-yaml's timestamp type
 * requires seconds, so `2026-08-04T16:33` is dumped unquoted and read back as
 * the string it was written as, while `2026-08-04T16:33:00` is coerced into a
 * native Date and loses its clock time to any day formatter downstream. Adding
 * seconds here would reintroduce a data loss that has already happened once.
 *
 * Local fields, never `toISOString()`: a note written at 00:30 in a UTC+2 vault
 * must not be stamped with the previous day.
 */
import { formatDayTitle, pad2 } from './day.js';

/** `YYYY-MM-DDTHH:mm` from a Date's local calendar fields. */
export function formatDateTimeStamp(date: Date = new Date()): string {
  return `${formatDayTitle(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/**
 * The same function under the name callers use when they mean a datetime VALUE
 * rather than a note header stamp. See `localDateISO` in `day.ts` for why both
 * names exist.
 */
export const localDateTimeISO = formatDateTimeStamp;

/**
 * Quotes a datetime that carries seconds, and leaves a minute-precision one
 * alone.
 *
 * For values this module did not produce: a note can hold
 * `2026-02-26T08:30:00`, from a hand edit or a template, and writing that back
 * unquoted lets the YAML parser turn it into a Date. A minute-precision value
 * needs no quoting and reads better without it, which is what keeps the header
 * stamps matching what every other tool writes into these vaults.
 */
export function quoteDateTime(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.startsWith('"') || trimmed.startsWith("'")) return trimmed;

  return /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/.test(trimmed) ? `"${trimmed}"` : trimmed;
}
