import { describe, expect, it } from 'vitest';
import { isSuiteStampShape, readStamp, readStampDate } from '../../src/frontmatter/stamp-read.js';

/** Local components, so an assertion never depends on the runner's timezone. */
function parts(date: Date): [number, number, number, number, number] {
  return [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
  ];
}

describe('the shape this suite writes', () => {
  it('reads a minute-precision stamp', () => {
    const stamp = readStamp('2026-08-04T14:05');
    expect(stamp?.shape).toBe('stamp');
    expect(parts(stamp!.date)).toEqual([2026, 8, 4, 14, 5]);
  });

  it('reads one carrying seconds, which is what Obsidian quotes rather than coerces', () => {
    expect(parts(readStamp('2026-08-04T14:05:30')!.date)).toEqual([2026, 8, 4, 14, 5]);
  });

  it('reads a space where the T should be, because a hand edit produces one', () => {
    expect(readStamp('2026-08-04 14:05')?.shape).toBe('stamp');
  });

  it('reads a native Date, which is what the YAML parser hands over', () => {
    const date = new Date(2026, 7, 4, 14, 5);
    expect(readStamp(date)).toEqual({ date, shape: 'stamp' });
  });

  it('refuses an invalid native Date rather than passing NaN on', () => {
    expect(readStamp(new Date(Number.NaN))).toBeNull();
  });
});

describe("the vault's own shapes", () => {
  it('reads a wikilink to a day note as that day at local midnight', () => {
    const stamp = readStamp('[[2026-07-14]]');
    expect(stamp?.shape).toBe('dayLink');
    expect(parts(stamp!.date)).toEqual([2026, 7, 14, 0, 0]);
  });

  it('reads the legacy clock with a meridiem', () => {
    const stamp = readStamp('2026-07-25 - 04:50 pm');
    expect(stamp?.shape).toBe('legacyClock');
    expect(parts(stamp!.date)).toEqual([2026, 7, 25, 16, 50]);
  });

  it('reads the same shape in the morning', () => {
    expect(parts(readStamp('2026-07-25 - 04:50 am')!.date)).toEqual([2026, 7, 25, 4, 50]);
  });

  it('gets midnight and noon the right way round', () => {
    expect(parts(readStamp('2026-07-25 - 12:00 am')!.date)).toEqual([2026, 7, 25, 0, 0]);
    expect(parts(readStamp('2026-07-25 - 12:00 pm')!.date)).toEqual([2026, 7, 25, 12, 0]);
  });

  it('reads an upper-case meridiem and a one-digit hour', () => {
    expect(parts(readStamp('2026-07-25 - 4:50 PM')!.date)).toEqual([2026, 7, 25, 16, 50]);
  });

  it('reads the same separator with a 24-hour clock and no meridiem', () => {
    expect(parts(readStamp('2026-07-25 - 16:50')!.date)).toEqual([2026, 7, 25, 16, 50]);
  });

  it('reads a bare day as local midnight', () => {
    const stamp = readStamp('2026-07-14');
    expect(stamp?.shape).toBe('date');
    expect(parts(stamp!.date)).toEqual([2026, 7, 14, 0, 0]);
  });
});

describe('what is not a stamp', () => {
  it('refuses a wikilink to something that is not a day', () => {
    // Reading this as a moment would invent one out of a reference.
    expect(readStamp('[[Steuern 2025]]')).toBeNull();
  });

  it('refuses a day that does not exist, rather than rolling it into the next month', () => {
    expect(readStamp('2026-02-30')).toBeNull();
    expect(readStamp('2026-13-01')).toBeNull();
  });

  it('refuses an impossible clock', () => {
    expect(readStamp('2026-07-25T24:00')).toBeNull();
    expect(readStamp('2026-07-25 - 13:00 pm')).toBeNull();
  });

  it('reads blank, absent and the wrong type as nothing', () => {
    expect(readStamp('')).toBeNull();
    expect(readStamp('   ')).toBeNull();
    expect(readStamp(null)).toBeNull();
    expect(readStamp(undefined)).toBeNull();
    expect(readStamp(42)).toBeNull();
  });

  it('refuses free text', () => {
    expect(readStamp('last Tuesday')).toBeNull();
  });
});

describe('readStampDate and isSuiteStampShape', () => {
  it('hands back the moment alone', () => {
    expect(parts(readStampDate('2026-08-04T14:05')!)).toEqual([2026, 8, 4, 14, 5]);
    expect(readStampDate('nonsense')).toBeNull();
  });

  it('tells a converted note from one still carrying an old spelling', () => {
    expect(isSuiteStampShape('2026-08-04T14:05')).toBe(true);
    expect(isSuiteStampShape('[[2026-07-14]]')).toBe(false);
    expect(isSuiteStampShape('2026-07-25 - 04:50 pm')).toBe(false);
    expect(isSuiteStampShape('2026-07-14')).toBe(false);
    expect(isSuiteStampShape(null)).toBe(false);
  });
});
