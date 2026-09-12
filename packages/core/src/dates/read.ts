/**
 * Reading a frontmatter value that is semantically a date.
 *
 * Tolerant on purpose. A vault's YAML parser hands back a string for some
 * spellings and a native `Date` for others, and a note can hold "sometime last
 * winter" in a date field. Everything here returns a string or null, never a
 * throw, because one unreadable note should not take a whole view down.
 */
import { formatDayTitle } from './day.js';
import { formatDateTimeStamp } from './stamps.js';

/**
 * A date-only value, as a `YYYY-MM-DD` string.
 *
 * Truncating, on both branches. A native `Date` goes through `formatDayTitle`,
 * and a string that leads with a date keeps only that much, so
 * `2026-08-04T16:33` read as a date is `2026-08-04` whichever way the YAML
 * parser happened to hand it over. Two implementations of this had drifted into
 * disagreeing about exactly that: one truncated the string and one returned it
 * whole, so the same note read one way through one code path and another way
 * through the other.
 *
 * Anything that is not date-shaped comes back as the trimmed string it was, so a
 * note holding "sometime last winter" in a date field shows that back rather
 * than nothing.
 *
 * Truncating is correct here and wrong wherever the clock time carries meaning:
 * use `readDateTimeLike` for those.
 */
export function readDateLike(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;

    const dateOnly = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
    return dateOnly ? (dateOnly[1] ?? trimmed) : trimmed;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : formatDayTitle(value);
  }
  return null;
}

/**
 * STRICT: a `YYYY-MM-DD` value, or null when the value is not date-shaped.
 *
 * The counterpart to `readDateLike` for a caller that has a fallback. An order
 * note takes its date from the property when there is one and from its filename
 * otherwise, and `readDateLike` returning "sometime last winter" rather than
 * null means that fallback never fires and the order is dated with a sentence.
 *
 * Two implementations of date reading had disagreed about exactly this: one
 * returned the text, one returned null. Both are wanted, so both are here, named
 * for which they are. Same split, and the same reason, as `wikilinkTarget`
 * against `linkOrText` in `links/wikilink.ts`.
 */
export function readIsoDate(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : formatDayTitle(value);
  }
  if (typeof value !== 'string') return null;

  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match ? (match[1] ?? null) : null;
}

/**
 * A value where the clock time carries meaning: a departure, an itinerary
 * stop's start, a `modified:` stamp.
 *
 * `readDateLike` cannot be used for these, because its `Date` branch truncates
 * to the day. That mattered in practice rather than in theory: a YAML parser
 * turns an unquoted `2026-02-26T08:30:00` into a real Date, which is exactly how
 * a hand-written or template-generated datetime tends to be spelled, so every
 * such value was silently losing its time on the way in.
 */
export function readDateTimeLike(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : formatDateTimeStamp(value);
  }
  return null;
}

/** The date half of a value read by `readDateTimeLike`, unchanged for one that was date-only already. */
export function dateTimeDatePart(value: string): string {
  return value.slice(0, 10);
}

/** The `HH:mm` half, or null when the value carries no time. Tolerates a seconds component. */
export function dateTimeTimePart(value: string): string | null {
  const match = /T(\d{2}:\d{2})/.exec(value);
  return match ? (match[1] ?? null) : null;
}
