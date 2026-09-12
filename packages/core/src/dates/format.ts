/**
 * Dates as a reader sees them.
 *
 * Only the display is localized, never what is written back: a note keeps its
 * dates in the unambiguous, sortable forms the rest of `dates/` produces, and
 * these are for putting on screen.
 *
 * Month and weekday names come from `Intl` rather than from a translation
 * table. They are exactly what `Intl` already knows, and a hand-maintained
 * table of them is two dozen strings that can only ever go wrong.
 *
 * **Every one of these takes a `locale`, and every one defaults to the
 * runtime's**, which is what they all did unconditionally before. The reason is
 * the same as `money/format.ts`'s: a formatting convention is a fact about a
 * place rather than about a language, and a Swiss reader on a German machine is
 * shown a date order and a separator they do not use. `settings/display-contract.ts`
 * is where the value comes from; passing nothing is still the old behaviour.
 */

/** Long and weekday-bearing, for example "Tuesday, July 21, 2026". */
export function formatLongDate(date: Date, locale?: string): string {
  return date.toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** For example "July 21, 2026". */
export function formatMediumDate(date: Date, locale?: string): string {
  return date.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Numeric and short, for width-constrained UI: "03.08.2026" in a DD.MM.YYYY
 * locale, "8/3/2026" in a MM/DD/YYYY one. Digit order and separator both come
 * from the locale, so this already matches the reader without a settings knob.
 */
export function formatShortDate(date: Date, locale?: string): string {
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * A month's short name from a 1 to 12 number rather than from a Date, for a
 * caller that has a month and no day to go with it. The year is arbitrary and
 * never shown.
 */
export function formatMonthName(month: number, locale?: string): string {
  return new Date(2000, month - 1, 1).toLocaleDateString(locale, { month: 'short' });
}

/**
 * A clock time, in a named IANA zone or in the device's own.
 *
 * A place abroad carries its own timezone, and rendering its golden hour in the
 * reader's zone instead is the bug that shows up as "golden hour is at 03:40"
 * and nothing else. An unusable zone name falls back to the device rather than
 * throwing: a typo in one note should not take the whole block down.
 */
export function formatClock(date: Date, timeZone?: string, locale?: string): string {
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };

  try {
    return date.toLocaleTimeString(locale, {
      ...options,
      timeZone: timeZone?.trim() || undefined,
    });
  } catch {
    return date.toLocaleTimeString(locale, options);
  }
}
