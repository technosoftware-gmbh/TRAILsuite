/**
 * Converting a foreign balance at a rate somebody chose.
 *
 * The rule this exists to protect: a currency with no rate is not converted and
 * not counted, and the caller has to say so. A cash box silently left out of a
 * total makes the total wrong by exactly the amount nobody mentioned.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import { hasRate, rateFor, rateTable, toHome } from '../src/shared/rates';
import type { NODAtrailSettings } from '../src/settings/types';

const settings = (rates: { currency: string; rate: number }[]): NODAtrailSettings => ({
  ...DEFAULT_SETTINGS,
  homeCurrency: 'CHF',
  exchangeRates: rates,
});

const SWISS = settings([
  { currency: 'EUR', rate: 0.94 },
  { currency: 'USD', rate: 0.88 },
]);

describe('the home currency', () => {
  it('needs no rate and is never converted', () => {
    expect(toHome(100, 'CHF', SWISS)).toBe(100);
    expect(toHome(100, null, SWISS)).toBe(100);
    expect(rateFor('CHF', SWISS)).toBe(1);
  });
});

describe('a currency with a rate', () => {
  it('converts at it', () => {
    expect(toHome(289.72, 'EUR', SWISS)).toBe(272.34);
    expect(toHome(396.83, 'USD', SWISS)).toBe(349.21);
  });

  it('does not care how the code was typed', () => {
    expect(toHome(100, 'eur', SWISS)).toBe(94);
  });

  it('says which rate it used, so a converted figure can be checked', () => {
    expect(rateFor('EUR', SWISS)).toBe(0.94);
  });
});

describe('a currency with no rate', () => {
  it('converts to null rather than to zero', () => {
    // Zero would be a lie that adds up. Null forces the caller to say the
    // figure is missing, which is the only honest thing to report.
    expect(toHome(100, 'GBP', SWISS)).toBeNull();
    expect(hasRate('GBP', SWISS)).toBe(false);
    expect(rateFor('GBP', SWISS)).toBeNull();
  });

  it('is what an empty rate table gives for everything foreign', () => {
    const none = settings([]);
    expect(toHome(100, 'EUR', none)).toBeNull();
    expect(toHome(100, 'CHF', none)).toBe(100);
  });
});

describe('the rate table', () => {
  it('ignores a row that says nothing usable', () => {
    const messy = settings([
      { currency: '  ', rate: 1 },
      { currency: 'EUR', rate: 0 },
      { currency: 'USD', rate: -1 },
      { currency: 'GBP', rate: Number.NaN },
      { currency: 'SEK', rate: 0.096 },
    ]);
    expect([...rateTable(messy).keys()]).toEqual(['SEK']);
  });

  it('lets a later row correct an earlier one', () => {
    const corrected = settings([
      { currency: 'EUR', rate: 0.9 },
      { currency: 'EUR', rate: 0.94 },
    ]);
    expect(rateFor('EUR', corrected)).toBe(0.94);
  });
});
