/**
 * Rendering a date a note holds.
 *
 * A note keeps its dates in ISO form, which is unambiguous and sorts. A
 * reader wants their own format. Only the display is localized, never what is
 * written back.
 *
 * App-free.
 */
import { activeDisplayLocale } from '../../shared/display';

/** A date with no clock time, which is the only shape CULItrail writes for a day. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Formats an ISO date in the reader's locale, or returns the text unchanged.
 *
 * Unchanged rather than blank for anything that is not a plain ISO date: a
 * note can hold "sometime last winter" in a date field, and showing that back
 * is more useful than showing nothing or "Invalid Date".
 */
export function formatIsoDate(value: string): string {
  const text = value.trim();
  if (!DATE_ONLY.test(text)) return value;

  // Midnight local rather than the bare date string, which JavaScript parses
  // as UTC and can therefore render as the day before in a western timezone.
  const date = new Date(`${text}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(activeDisplayLocale(), { dateStyle: 'medium' });
}

/**
 * The same date, short enough for a column on a gallery card.
 *
 * A two-digit year, which is what `dateStyle: 'short'` gives in every locale this
 * ships in. Measured: a card is about 200px wide and its info strip splits that
 * into two columns of roughly 85px, where `06/08/2026` overflows and gets an
 * ellipsis while `06/08/26` fits. The meal view uses the full form.
 */
export function formatIsoDateShort(value: string): string {
  const text = value.trim();
  if (!DATE_ONLY.test(text)) return value;

  const date = new Date(`${text}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(activeDisplayLocale(), { dateStyle: 'short' });
}
