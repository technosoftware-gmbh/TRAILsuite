/**
 * Which currencies a money dropdown offers.
 *
 * The two rules that matter are both about not losing a value: the home
 * currency has to be offerable even when it is not on the list, and a code
 * already written into a note has to survive being opened in an editor and
 * saved again. A dropdown that dropped either would rewrite somebody's
 * money to a currency they never chose.
 */
import { describe, expect, it } from 'vitest';
import { currencyChoices, parseCurrencyOptions } from '../src/trips/costs/currency-options';

describe('parseCurrencyOptions', () => {
  it('reads a comma separated list in the order it was typed', () => {
    expect(parseCurrencyOptions('CHF, EUR, USD')).toEqual(['CHF', 'EUR', 'USD']);
  });

  it('accepts the separators people actually type', () => {
    expect(parseCurrencyOptions('chf;eur usd')).toEqual(['CHF', 'EUR', 'USD']);
  });

  it('is empty for an empty setting rather than holding a blank code', () => {
    expect(parseCurrencyOptions('')).toEqual([]);
    expect(parseCurrencyOptions('  ,  ')).toEqual([]);
  });
});

describe('currencyChoices', () => {
  const configured = 'CHF, EUR, USD';

  it('offers the configured list, in its own order', () => {
    expect(currencyChoices({ configured, homeCurrency: 'CHF' })).toEqual(['CHF', 'EUR', 'USD']);
  });

  it('never repeats a code the list and the home currency share', () => {
    expect(currencyChoices({ configured, homeCurrency: 'EUR', current: 'EUR' })).toEqual([
      'CHF',
      'EUR',
      'USD',
    ]);
  });

  // A vault that plans in a currency it left off the list must still be able
  // to pick it, or the setting could lock somebody out of their own money.
  it('offers the home currency even when the list omits it', () => {
    expect(currencyChoices({ configured, homeCurrency: 'GBP' })).toContain('GBP');
  });

  /**
   * The important one. Open a booking in ZAR in an editor whose list is
   * CHF/EUR/USD, save it, and the currency must still be ZAR.
   */
  it('offers whatever the field already holds, whether or not it is configured', () => {
    const choices = currencyChoices({ configured, homeCurrency: 'CHF', current: 'ZAR' });
    expect(choices).toContain('ZAR');
    expect(choices[choices.length - 1]).toBe('ZAR');
  });

  it('upper-cases a code somebody typed in lower case', () => {
    expect(currencyChoices({ configured: 'chf', homeCurrency: 'chf', current: 'zar' })).toEqual([
      'CHF',
      'ZAR',
    ]);
  });

  // A cleared list is a setting somebody meant, and it still has to leave
  // every field usable rather than offering an empty dropdown.
  it('still offers something when the list has been cleared', () => {
    expect(currencyChoices({ configured: '', homeCurrency: 'CHF' })).toEqual(['CHF']);
  });

  it('ignores a null current value rather than offering a blank option', () => {
    expect(currencyChoices({ configured, homeCurrency: 'CHF', current: null })).toEqual([
      'CHF',
      'EUR',
      'USD',
    ]);
  });
});
