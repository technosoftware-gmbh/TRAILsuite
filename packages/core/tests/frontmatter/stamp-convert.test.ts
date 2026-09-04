/**
 * Re-spelling a stamp without moving the moment it names.
 *
 * The health check reports notes whose `created` or `modified` is in an older
 * shape, and for a long time it could do nothing else: the reasoning was that a
 * bulk rewrite would give every note a new modification date. That was wrong,
 * and this is the function that makes it wrong -- it re-renders the instant the
 * note already carries and never consults a clock. A vault the fix has run over
 * says exactly what it said before, spelt the way the suite spells it.
 *
 * The values below are real ones, out of a vault where 117 stamps across 59
 * notes were in three different older shapes.
 */
import { describe, expect, it } from 'vitest';
import { readStamp, suiteStampShape } from '../../src/frontmatter/stamp-read.js';

describe('suiteStampShape', () => {
  it('converts the twelve-hour spelling to twenty-four', () => {
    expect(suiteStampShape('2026-07-16 - 01:17 pm')).toBe('2026-07-16T13:17');
    expect(suiteStampShape('2026-07-16 - 10:07 am')).toBe('2026-07-16T10:07');
  });

  it('gets noon and midnight right, which is where twelve-hour clocks go wrong', () => {
    // 12 pm is noon and 12 am is midnight, and the naive arithmetic -- add
    // twelve for pm, leave am alone -- gets both of them wrong by twelve hours.
    expect(suiteStampShape('2026-07-16 - 12:30 pm')).toBe('2026-07-16T12:30');
    expect(suiteStampShape('2026-07-16 - 12:05 am')).toBe('2026-07-16T00:05');
  });

  it('reads a day link as the day it links to', () => {
    expect(suiteStampShape('[[2026-07-16]]')).toBe('2026-07-16T00:00');
  });

  it('gives a bare date the midnight it was already being read as', () => {
    // Not an invention: `readStamp` has always treated a bare day as midnight,
    // so this writes down the reading rather than adding to it.
    expect(suiteStampShape('2026-07-15')).toBe('2026-07-15T00:00');
    expect(readStamp('2026-07-15')?.date.getHours()).toBe(0);
  });

  it('says there is nothing to do for a stamp already in shape', () => {
    // Null for "already right" as well as for "cannot be read", so a caller
    // asks one question instead of two.
    expect(suiteStampShape('2026-07-16T13:17')).toBeNull();
  });

  it('refuses a value that is not a moment, rather than inventing one', () => {
    // `created: '[[Steuern]]'` is a link to a note. A converter that answered
    // here would replace somebody's data with a guess.
    expect(suiteStampShape('[[Steuern]]')).toBeNull();
    expect(suiteStampShape('')).toBeNull();
    expect(suiteStampShape(undefined)).toBeNull();
    expect(suiteStampShape(null)).toBeNull();
    expect(suiteStampShape(42)).toBeNull();
  });

  it('never moves the instant, whatever shape it arrived in', () => {
    // The property the bulk fix depends on, stated directly: what comes out
    // parses back to the same moment as what went in.
    for (const value of [
      '2026-07-16 - 01:17 pm',
      '2026-07-16 - 12:05 am',
      '[[2026-07-16]]',
      '2026-07-15',
      '2026-02-26T08:30:00',
    ]) {
      const converted = suiteStampShape(value);
      if (converted === null) continue;
      expect(readStamp(converted)?.date.getTime()).toBe(readStamp(value)?.date.getTime());
    }
  });

  it('is settled after one pass, so running the fix twice changes nothing', () => {
    const once = suiteStampShape('2026-07-16 - 01:17 pm');
    expect(once).not.toBeNull();
    expect(suiteStampShape(once)).toBeNull();
  });
});
