/**
 * Turning a foreign figure into the home currency, at a rate somebody chose.
 *
 * **Nothing is fetched.** A rate nobody chose is a rate nobody can check, and a
 * balance sheet that moved overnight because a web service did would be one
 * nobody trusts. The rates live in the settings and change when a person
 * changes them.
 *
 * A currency with no rate is not converted and not counted. It is listed beside
 * the total instead, which is the honest way to say "this is held, and it is
 * not in this figure".
 */
import { roundCents } from 'trail-core';
import type { ExchangeRateSetting, NODAtrailSettings } from '../settings/types';

/** The rates by upper-cased code, last one winning so a corrected row replaces its predecessor. */
export function rateTable(settings: NODAtrailSettings): Map<string, number> {
  const table = new Map<string, number>();
  for (const entry of settings.exchangeRates) {
    const code = entry.currency.trim().toUpperCase();
    if (code && Number.isFinite(entry.rate) && entry.rate > 0) table.set(code, entry.rate);
  }
  return table;
}

/**
 * `amount` in `currency`, expressed in the home currency, or null.
 *
 * Null means "there is no rate for this", which every caller has to handle by
 * saying so rather than by treating it as zero. A cash box left out of a total
 * silently is a total that is wrong by exactly the amount nobody mentioned.
 */
export function toHome(
  amount: number,
  currency: string | null,
  settings: NODAtrailSettings
): number | null {
  const home = settings.homeCurrency.trim().toUpperCase();
  const code = (currency ?? home).trim().toUpperCase();
  if (code === home) return roundCents(amount);

  const rate = rateTable(settings).get(code);
  return rate === undefined ? null : roundCents(amount * rate);
}

/** Whether a rate exists for a currency, for a view deciding what to say. */
export function hasRate(currency: string | null, settings: NODAtrailSettings): boolean {
  return toHome(1, currency, settings) !== null;
}

/** The rate used for a currency, for showing what a converted figure rests on. */
export function rateFor(currency: string | null, settings: NODAtrailSettings): number | null {
  const home = settings.homeCurrency.trim().toUpperCase();
  const code = (currency ?? home).trim().toUpperCase();
  if (code === home) return 1;
  return rateTable(settings).get(code) ?? null;
}

/**
 * The rates as one line of text: `EUR 0.94, USD 1/1.14`.
 *
 * A text row rather than a list editor, because a household has two or three
 * of these and a whole editor for three numbers is a page nobody wants to
 * open. Anything unreadable is dropped rather than rejected, so a half typed
 * line never blocks saving the rest.
 *
 * **`1/1.07` is accepted as well as `0.93457944`.** Other systems quote the
 * pair the other way round, and asking somebody to divide one into the other
 * by hand invites exactly the transcription error the figure is meant to
 * prevent. Written back as whatever it works out to, because that is the
 * number the arithmetic uses and hiding it would make a wrong rate harder to
 * spot.
 */
export function formatRates(rates: readonly ExchangeRateSetting[]): string {
  return rates.map((entry) => `${entry.currency} ${entry.rate}`).join(', ');
}

export function parseRates(value: string): ExchangeRateSetting[] {
  const rates: ExchangeRateSetting[] = [];
  for (const part of value.split(/[,;\n]/)) {
    const match = /^\s*([A-Za-z]{3})\s*[= ]?\s*([\d.,]+)\s*(?:\/\s*([\d.,]+))?\s*$/.exec(part);
    if (!match?.[1] || !match[2]) continue;

    const numerator = Number(match[2].replace(',', '.'));
    const denominator = match[3] === undefined ? 1 : Number(match[3].replace(',', '.'));
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) continue;

    const rate = numerator / denominator;
    if (!Number.isFinite(rate) || rate <= 0) continue;
    rates.push({ currency: match[1].toUpperCase(), rate });
  }
  return rates;
}

export type { ExchangeRateSetting };
