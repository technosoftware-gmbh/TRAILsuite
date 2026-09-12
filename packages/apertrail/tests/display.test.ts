/**
 * The bound formatters actually carry the setting.
 *
 * The root suite checks that no call site reaches past this module. This checks
 * the module itself does what those call sites now trust it to do -- otherwise
 * the whole arrangement is a longer way of writing the defect it replaced.
 *
 * The reported case is the last one: the trip document printed `4.298,00 CHF`
 * on a machine set to German, in a vault whose ledger printed `4'298.00`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  formatMediumDate,
  formatMoney,
  formatShortDate,
  setDisplayLocale,
} from '../src/shared/display';

afterEach(() => setDisplayLocale(''));

describe('the plugin display locale', () => {
  it('draws money in the vault convention rather than the machine one', () => {
    setDisplayLocale('de-CH');
    const swiss = formatMoney(4298, 'CHF');

    expect(swiss).toMatch(/298\.00$/);
    expect(swiss).not.toContain('4.298');
    expect(swiss).not.toContain('4,298');
  });

  it('draws dates in it too', () => {
    setDisplayLocale('de-CH');
    expect(formatShortDate(new Date(2026, 7, 31))).toBe('31.08.2026');

    setDisplayLocale('en-US');
    expect(formatShortDate(new Date(2026, 7, 31))).toBe('08/31/2026');
  });

  it('takes a blank setting as the machine, which is what every call site did before', () => {
    setDisplayLocale('   ');
    expect(formatMoney(4298, 'CHF')).toBe(
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'CHF',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(4298)
    );
    expect(formatMediumDate(new Date(2026, 7, 31))).toBe(
      new Date(2026, 7, 31).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    );
  });

  it('changes what is drawn when the setting changes, without a reload', () => {
    setDisplayLocale('de-DE');
    const german = formatMoney(100120.2, 'CHF');
    setDisplayLocale('de-CH');
    const swiss = formatMoney(100120.2, 'CHF');

    expect(german).toContain('100.120,20');
    expect(swiss).not.toContain('100.120,20');
    expect(swiss).toMatch(/100.120\.20/);
  });
});
