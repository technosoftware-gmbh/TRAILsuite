/**
 * The money and date formatters, bound to the vault's display locale.
 *
 * **Every call site in this plugin imports these rather than trail-core's.**
 * The core functions all take a `locale` and all default to the machine's, and
 * for as long as they were imported directly nobody ever passed one: the
 * parameter existed, its reasoning was written in `money/format.ts`'s own
 * header, and it was unreachable. A wrapper that already knows the answer is
 * how a value with nowhere to come from gets one.
 *
 * A module-level active locale rather than a parameter on forty call sites,
 * which is the arrangement `lang/I18nManager` already uses for the language and
 * for the same reason: it is one fact about the vault, it changes only when a
 * setting changes, and threading it through every signature would make every
 * caller carry something none of them decide.
 *
 * `settings/store.ts` publishes it on load and on save. Before it does, and in
 * any test that does not set one, the locale is undefined and every function
 * here behaves exactly as the core one did.
 */
import {
  displayLocale,
  formatClock as coreClock,
  formatLongDate as coreLongDate,
  formatMediumDate as coreMediumDate,
  formatMonthName as coreMonthName,
  formatMoney as coreMoney,
  formatMoneyOrNull as coreMoneyOrNull,
  formatShortDate as coreShortDate,
} from 'trail-core';

let active: string | undefined;

/** Called by the settings store. Blank means the machine's own, which is the default. */
export function setDisplayLocale(setting: string): void {
  active = displayLocale(setting);
}

/** For a caller that has to reach `Intl` itself. Undefined means the runtime's own. */
export function activeDisplayLocale(): string | undefined {
  return active;
}

export function formatMoney(amount: number, currency: string | null): string {
  return coreMoney(amount, currency, active);
}

export function formatMoneyOrNull(amount: number | null, currency: string | null): string | null {
  return coreMoneyOrNull(amount, currency, active);
}

export function formatLongDate(date: Date): string {
  return coreLongDate(date, active);
}

export function formatMediumDate(date: Date): string {
  return coreMediumDate(date, active);
}

export function formatShortDate(date: Date): string {
  return coreShortDate(date, active);
}

export function formatMonthName(month: number): string {
  return coreMonthName(month, active);
}

export function formatClock(date: Date, timeZone?: string): string {
  return coreClock(date, timeZone, active);
}
