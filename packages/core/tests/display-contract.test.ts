/**
 * The display locale reaches the formatters, and blank still means the machine.
 *
 * Both halves matter. The first is the whole point: `formatMoney` has taken a
 * `locale` since it was written, with a header explaining that a Swiss
 * household on a German Mac reads its money in a convention it does not use --
 * and not one caller ever passed one, so the parameter, the reasoning and the
 * fallback were all correct and all unreachable.
 *
 * The second is what makes the change safe to ship: a vault that never opens
 * the setting must see exactly what it saw. `displayLocale('')` is `undefined`
 * rather than `''` because `Intl` treats those as opposites -- the empty string
 * is a RangeError and undefined is the runtime's own.
 */
import { describe, expect, it } from 'vitest';
import { DISPLAY_CONTRACT, displayLocale } from '../src/settings/display-contract';
import { formatMediumDate, formatShortDate, formatClock } from '../src/dates/format';
import { formatMoney } from '../src/money/format';

const AT = new Date(2026, 7, 31, 14, 5);

describe('the display locale', () => {
  it('ships blank, so nothing changes until somebody sets it', () => {
    expect(DISPLAY_CONTRACT.displayLocale).toBe('');
  });

  it('turns blank into the runtime default rather than into a RangeError', () => {
    for (const blank of ['', '   ', null, undefined]) expect(displayLocale(blank)).toBeUndefined();
    expect(displayLocale(' de-CH ')).toBe('de-CH');
  });

  /**
   * The reported case, as the two conventions that disagree about a dot.
   *
   * Asserted structurally rather than character for character: the group
   * separator is ICU's to choose and both U+0027 and U+2019 have shipped as
   * the Swiss one. What must hold is that it is neither of the two characters
   * that would make the figure mean a different number, and that the decimal
   * is a point.
   */
  it('formats a Swiss figure the Swiss way, whatever the machine says', () => {
    const swiss = formatMoney(100120.2, 'CHF', 'de-CH');

    expect(swiss).toMatch(/100.120\.20$/);
    expect(swiss).not.toContain('100.120');
    expect(swiss).not.toContain('100,120');

    // And the convention it was being shown instead.
    expect(formatMoney(100120.2, 'CHF', 'de-DE')).toContain('100.120,20');
  });

  it('reaches the date formatters too', () => {
    expect(formatShortDate(AT, 'de-CH')).toBe('31.08.2026');
    expect(formatShortDate(AT, 'en-US')).toBe('08/31/2026');
    expect(formatMediumDate(AT, 'de-CH')).toContain('August');
    expect(formatClock(AT, undefined, 'de-CH')).toBe('14:05');
  });

  it('falls back to the machine when it is given nothing, exactly as before', () => {
    expect(formatMoney(4298, 'CHF')).toBe(formatMoney(4298, 'CHF', undefined));
    expect(formatShortDate(AT)).toBe(formatShortDate(AT, undefined));
    expect(formatClock(AT)).toBe(formatClock(AT, undefined, undefined));
  });
});
