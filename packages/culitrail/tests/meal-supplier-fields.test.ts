/**
 * The two fields a meal gained when it stopped being a recipe: which of the
 * supplier's ranges it belongs to, and what its price is denominated in.
 *
 * The currency is the interesting one, because it is a chain rather than a
 * value. Every view that shows a price walks it, and two of them walking it
 * differently is a bug nothing would surface: both would render a plausible
 * number under a plausible symbol.
 */
import { describe, expect, it } from 'vitest';
import { currencyFor } from '../src/meals/view-model/currency';
import { readMealMeta } from '../src/meals/parser/meal-meta';
import { emptyCompanyTerms } from '../src/crm/company-terms';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';

const settings = { ...DEFAULT_SETTINGS, orderDefaultCurrency: 'CHF' };
const eur = { ...emptyCompanyTerms(), currency: 'EUR' };

describe('the currency chain', () => {
  it('takes the meal, then the supplier, then the vault default', () => {
    expect(currencyFor({ priceCurrency: 'USD' }, eur, settings)).toBe('USD');
    expect(currencyFor({ priceCurrency: null }, eur, settings)).toBe('EUR');
    expect(currencyFor({ priceCurrency: null }, null, settings)).toBe('CHF');
  });

  it('steps past a blank rather than treating it as an answer', () => {
    // A property cleared in the editor is deleted, but a hand-edited note can
    // carry `priceCurrency:` with nothing after it, and reading that as the
    // currency would price the meal in an empty string.
    expect(currencyFor({ priceCurrency: '  ' }, eur, settings)).toBe('EUR');
    expect(currencyFor({ priceCurrency: null }, { currency: '  ' }, settings)).toBe('CHF');
  });
});

describe('what a meal note says about its supplier', () => {
  it('reads the line and the currency under the configured names', () => {
    const meta = readMealMeta({ line: 'Sport', priceCurrency: 'EUR' }, DEFAULT_SETTINGS);
    expect(meta.line).toBe('Sport');
    expect(meta.priceCurrency).toBe('EUR');
  });

  it('reads the aliases a foreign note is likely to use', () => {
    expect(readMealMeta({ range: 'Alltag' }, DEFAULT_SETTINGS).line).toBe('Alltag');
    expect(readMealMeta({ currency: 'GBP' }, DEFAULT_SETTINGS).priceCurrency).toBe('GBP');
  });

  it('is null on a note that names neither', () => {
    const meta = readMealMeta({}, DEFAULT_SETTINGS);
    expect(meta.line).toBeNull();
    expect(meta.priceCurrency).toBeNull();
  });

  it('prefers the configured property over the alias', () => {
    const renamed = { ...DEFAULT_SETTINGS, mealLineProperty: 'linie' };
    expect(readMealMeta({ linie: 'Sport', line: 'Alltag' }, renamed).line).toBe('Sport');
  });
});
