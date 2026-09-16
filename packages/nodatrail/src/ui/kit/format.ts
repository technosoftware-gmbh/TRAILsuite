/**
 * Formatting for the views: money, dates, statuses and counts.
 *
 * Every one of these turns a value into a string somebody reads, which is why
 * none of them lives in `trail-core`. What the core supplies is the arithmetic
 * and the locale-aware money formatter; the vocabulary a product lays over it
 * stays with the product.
 */
import {
  displayLocale,
  formatMediumDate,
  formatMoneyOrNull,
  formatMonthName,
  parseDayTitle,
} from '@technosoftware/trail-core';
import { t } from '../../lang/I18nManager';

/**
 * The conventions money and dates are drawn in, set once when the plugin loads.
 *
 * Module state rather than an argument on every call, because it is one
 * setting read by a hundred call sites and threading it through all of them
 * would say nothing the setting does not. Set from a command rather than from a
 * render, so it can never change halfway down a screen.
 *
 * **It used to be money only, and it used to fall back to a hard-coded Swiss
 * tag.** Dates went on following the machine, so one vault could read a figure
 * in one country's conventions and the date beside it in another's. And the
 * hard fallback was this plugin answering a question the other two never asked:
 * APERtrail's trip document printed `4.298,00 CHF` in the same vault where this
 * ledger printed `4'298.00`. Both are now the one setting shared through
 * trail-core's `DISPLAY_CONTRACT`, and blank means the machine's own for all
 * three rather than Swiss for one of them. `settings/validate.ts` carries the
 * old key across, so no existing vault loses the answer it already gave.
 */
let locale: string | undefined;

export function setDisplayLocale(setting: string): void {
  locale = displayLocale(setting);
}

/** For a caller that has to reach `Intl` itself. Undefined means the runtime's own. */
export function activeDisplayLocale(): string | undefined {
  return locale;
}

/** A figure with its currency, or a dash. A dash rather than nothing, so a column stays a column. */
export function money(amount: number | null, currency: string | null): string {
  return formatMoneyOrNull(amount, currency, locale) ?? '-';
}

/** An ISO day in the reader's own conventions, or ''. */
export function day(iso: string | null): string {
  if (!iso) return '';
  const date = parseDayTitle(iso);
  return date ? formatMediumDate(date, locale) : iso;
}

/** How far off a day is, as a sentence a row can carry. */
export function relativeDay(iso: string | null, today: Date): string {
  if (!iso) return '';

  const target = parseDayTitle(iso);
  if (!target) return iso;

  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return t('common.today');
  return day(iso);
}

/** A count with its noun, in the plural form the language actually has. */
export function count(key: string, value: number): string {
  return t(key, { count: value });
}

/**
 * A figure with no currency, grouped the reader's way: `1'309.98`.
 *
 * For a table whose currency is said once in its header. Sixteen columns of
 * `CHF` would be a sixth of the page saying one thing.
 */
export function figure(amount: number): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** A month's short name, 1 to 12, in the reader's conventions. */
export function monthName(month: number): string {
  return formatMonthName(month, locale);
}

/**
 * The tone of an amount that carries its own sign: red below zero, plain
 * otherwise.
 *
 * Used where a figure is a balance or a total rather than a verdict. A verdict
 * (a variance, a result) is already green or red by what it means; a balance
 * is only red when it has gone below zero, and plain rather than green when it
 * has not, because a positive bank balance is not an achievement to colour.
 * Cents that round to zero are not negative.
 */
export function signTone(amount: number): 'warn' | undefined {
  return Math.round(amount * 100) < 0 ? 'warn' : undefined;
}
