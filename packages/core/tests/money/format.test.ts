import { describe, expect, it } from 'vitest';
import {
  formatMoney,
  formatMoneyOrNull,
  normalizeCurrency,
  roundCents,
  sumByCurrency,
} from '../../src/money/format.js';

describe('roundCents', () => {
  it('rounds to the cent', () => {
    expect(roundCents(17.499)).toBe(17.5);
    expect(roundCents(17.505)).toBe(17.51);
  });

  it('kills the floating point tail a sum of two-decimal figures leaves', () => {
    expect(roundCents(29.8 + 29.8 + 29.8)).toBe(89.4);
  });

  it('leaves a whole number alone', () => {
    expect(roundCents(12)).toBe(12);
  });
});

describe('formatMoney', () => {
  it('renders two decimals with the code', () => {
    // Not asserted against a locale's exact spacing: Intl decides where the
    // code goes and that is the whole point of routing through it.
    const rendered = formatMoney(187.4, 'CHF');
    expect(rendered).toContain('187.40');
    expect(rendered.toUpperCase()).toContain('CHF');
  });

  it('reads a lower-case code as the code', () => {
    expect(formatMoney(5, 'chf').toUpperCase()).toContain('CHF');
  });

  it('falls back to code and figure for a currency Intl refuses', () => {
    expect(formatMoney(5, 'CH')).toBe('CH 5.00');
  });

  it('renders the bare figure when there is no currency', () => {
    expect(formatMoney(5, null)).toBe('5.00');
    expect(formatMoney(5, '   ')).toBe('5.00');
  });
});

describe('formatMoneyOrNull', () => {
  it('renders nothing for an absent figure, rather than zero', () => {
    expect(formatMoneyOrNull(null, 'CHF')).toBeNull();
  });

  it('renders zero, because a free line is a fact', () => {
    expect(formatMoneyOrNull(0, 'CHF')).not.toBeNull();
  });

  it('renders nothing for a figure that is not finite', () => {
    expect(formatMoneyOrNull(Number.NaN, 'CHF')).toBeNull();
    expect(formatMoneyOrNull(Number.POSITIVE_INFINITY, 'CHF')).toBeNull();
  });
});

describe('normalizeCurrency', () => {
  it('upper-cases and trims', () => {
    expect(normalizeCurrency('  eur ')).toBe('EUR');
  });

  it('reads blank and absent as nothing', () => {
    expect(normalizeCurrency('')).toBeNull();
    expect(normalizeCurrency('   ')).toBeNull();
    expect(normalizeCurrency(null)).toBeNull();
    expect(normalizeCurrency(undefined)).toBeNull();
  });
});

describe('sumByCurrency', () => {
  it('keeps currencies apart', () => {
    const totals = sumByCurrency([
      { amount: 10, currency: 'CHF' },
      { amount: 5, currency: 'EUR' },
      { amount: 2.5, currency: 'chf' },
    ]);

    expect(totals.get('CHF')).toBe(12.5);
    expect(totals.get('EUR')).toBe(5);
    expect(totals.size).toBe(2);
  });

  it('uses the fallback currency only where a line states none', () => {
    const totals = sumByCurrency(
      [
        { amount: 10, currency: null },
        { amount: 5, currency: 'EUR' },
      ],
      'CHF'
    );

    expect(totals.get('CHF')).toBe(10);
    expect(totals.get('EUR')).toBe(5);
  });

  it('returns nothing at all when no line is priced', () => {
    const totals = sumByCurrency([
      { amount: null, currency: 'CHF' },
      { amount: null, currency: 'EUR' },
    ]);

    expect(totals.size).toBe(0);
  });

  it('keeps a genuinely free line, because zero is a figure', () => {
    const totals = sumByCurrency([{ amount: 0, currency: 'CHF' }]);
    expect(totals.get('CHF')).toBe(0);
  });

  it('rounds as it goes, so a long list does not drift', () => {
    const totals = sumByCurrency(
      Array.from({ length: 3 }, () => ({ amount: 29.8, currency: 'CHF' }))
    );
    expect(totals.get('CHF')).toBe(89.4);
  });
});

describe('the locale a figure is written in', () => {
  /**
   * `Intl` separates the code from the figure with a non-breaking space, which
   * is right on screen and invisible in a diff. Normalising it here keeps these
   * assertions about the thing they are testing.
   */
  const plain = (text: string) => text.replace(/\u00a0/g, ' ');

  it('groups the Swiss way when asked, which is what a Swiss household reads', () => {
    // The separator is not a detail: 1.309,98 and 1'309.98 are the same number
    // written by two conventions that disagree about what a dot means.
    expect(plain(formatMoney(1309.98, 'CHF', 'de-CH'))).toBe("CHF 1'309.98");
  });

  it('still groups the German way for a German vault', () => {
    expect(plain(formatMoney(1309.98, 'CHF', 'de-DE'))).toBe('1.309,98 CHF');
  });

  it('carries the locale through the nullable form', () => {
    expect(plain(formatMoneyOrNull(1309.98, 'CHF', 'de-CH') ?? '')).toBe("CHF 1'309.98");
    expect(formatMoneyOrNull(null, 'CHF', 'de-CH')).toBeNull();
  });

  it('falls back to the code and the figure for a currency Intl refuses', () => {
    expect(formatMoney(12.5, 'CH', 'de-CH')).toBe('CH 12.50');
  });
});

describe('a currency code and a minus sign', () => {
  const plain = (text: string) => text.replace(/\u00a0/g, ' ');

  it('keeps them apart, which Swiss German does not', () => {
    // de-CH renders a positive as `CHF 5'000.00` and a negative as
    // `CHF-122.70`. Down a column the figures then start in different places
    // and the minus reads as part of the code.
    expect(plain(formatMoney(-122.7, 'CHF', 'de-CH'))).toBe('CHF -122.70');
    expect(plain(formatMoney(-1370.04, 'CHF', 'de-CH'))).toBe("CHF -1'370.04");
  });

  it('leaves a positive figure exactly as the locale renders it', () => {
    expect(plain(formatMoney(5000, 'CHF', 'de-CH'))).toBe("CHF 5'000.00");
    expect(plain(formatMoney(126.7, 'CHF', 'de-CH'))).toBe('CHF 126.70');
  });

  it('leaves a locale that puts the code last alone', () => {
    expect(plain(formatMoney(-1309.98, 'CHF', 'de-DE'))).toBe('-1.309,98 CHF');
  });

  it('does the same for a code Intl does not know', () => {
    expect(plain(formatMoney(-12.5, 'CH', 'de-CH'))).toBe('CH -12.50');
  });
});
