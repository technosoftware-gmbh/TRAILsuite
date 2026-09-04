/**
 * How tall a band is, and what happens to what does not fit.
 *
 * The week grid's whole claim is that five columns stand the same height, so
 * the bands line up across them and the thing reads as a timetable. Two
 * arithmetic mistakes would break that claim quietly:
 *
 * - a band whose height came from its own day rather than from the week, which
 *   is the bug this replaced;
 * - a band that drew its rows *and* a "+2 more" line underneath, which is one
 *   row taller than the four beside it -- an off-by-one that looks like a
 *   rendering glitch rather than like a rule.
 *
 * The last case below is the one that matters: whatever the numbers, a band
 * never occupies more rows than it was given.
 */
import { describe, expect, it } from 'vitest';
import { BAND_MAX_ROWS, bandRows, bandSplit } from '../src/ui/views/plan-calendar';

describe('bandRows', () => {
  it('takes the busiest day of the week, not each day its own', () => {
    expect(bandRows([1, 6, 0, 2, 1])).toBe(6);
  });

  it('leaves a quiet band short rather than padding it to a constant', () => {
    // A fixed height would put four blank rows under every afternoon of a week
    // like this one, and then the week no longer fits on a screen.
    expect(bandRows([1, 1, 0, 1, 1])).toBe(1);
  });

  it('gives no rows at all to a band nothing falls in', () => {
    expect(bandRows([0, 0, 0, 0, 0])).toBe(0);
  });

  it('refuses to let one bad day set the height of the screen', () => {
    expect(bandRows([1, 40, 1])).toBe(BAND_MAX_ROWS);
  });

  it('answers for a week with no days in it', () => {
    // A work-week setting and a week that is entirely weekend is not a real
    // case, but Math.max() of nothing is -Infinity and would be a height.
    expect(bandRows([])).toBe(0);
  });
});

describe('bandSplit', () => {
  it('draws everything when everything fits', () => {
    expect(bandSplit(4, 6)).toEqual({ shown: 4, hidden: 0 });
  });

  it('draws everything when it fits exactly', () => {
    expect(bandSplit(6, 6)).toEqual({ shown: 6, hidden: 0 });
  });

  it('gives up a row to the count, so the band stays its height', () => {
    // Seven into six is five drawn and two counted, not six drawn and two
    // counted. The count is a row like any other.
    expect(bandSplit(7, 6)).toEqual({ shown: 5, hidden: 2 });
  });

  it('says only the count when there is room for nothing else', () => {
    expect(bandSplit(3, 1)).toEqual({ shown: 0, hidden: 3 });
  });

  it('never occupies more rows than it was given', () => {
    for (let rows = 0; rows <= 8; rows += 1) {
      for (let total = 0; total <= 20; total += 1) {
        const { shown, hidden } = bandSplit(total, rows);
        expect(shown + (hidden > 0 ? 1 : 0)).toBeLessThanOrEqual(
          Math.max(rows, hidden > 0 ? 1 : 0)
        );
        // And nothing is lost on the way: every meeting is either drawn or
        // counted. A band that silently dropped one would be a day that looks
        // emptier than it is.
        expect(shown + hidden).toBe(total);
      }
    }
  });
});
