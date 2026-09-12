/**
 * A clock time, in the reader's own convention.
 *
 * `trail-core`'s formatClock() pins `hour12: false`, which is right for the
 * locale this plugin was written in and wrong for most of the language it
 * is written in: an English-base plugin that renders 5:12 AM as 05:12 for
 * every reader has picked a side of a question `Intl` already answers. So
 * the convention is a setting with three states, and "auto" means the
 * locale decides.
 *
 * The zone is still the spot's own wherever a note names one. A place
 * abroad rendered in the reader's zone is the bug the design named, and no
 * amount of AM/PM changes that.
 *
 * The locale is the vault's display locale rather than the machine's, for the
 * same reason as everything in `shared/display.ts`: which convention a reader
 * uses is a fact about where they are, not about the language their computer
 * is set to.
 */
import { activeDisplayLocale } from './display';

export type ClockFormat = 'auto' | '24h' | '12h';

export const CLOCK_FORMATS: readonly ClockFormat[] = ['auto', '24h', '12h'];

/** Undefined means "let the locale decide", which is what Intl does with an absent hour12. */
export function hour12For(format: ClockFormat): boolean | undefined {
  if (format === '24h') return false;
  if (format === '12h') return true;
  return undefined;
}

/** An unusable zone name falls back to the device rather than throwing: a typo in one note should not take a whole block down. */
export function formatClockIn(date: Date, timeZone?: string, hour12?: boolean): string {
  const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12 };
  try {
    return date.toLocaleTimeString(activeDisplayLocale(), {
      ...options,
      timeZone: timeZone?.trim() || undefined,
    });
  } catch {
    return date.toLocaleTimeString(activeDisplayLocale(), options);
  }
}
