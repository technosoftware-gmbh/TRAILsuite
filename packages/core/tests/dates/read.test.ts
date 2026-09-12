/**
 * The date readers, and the strict/lenient split.
 *
 * `readDateLike` and `readIsoDate` differ on exactly one input: a string that is
 * not date-shaped. That is not a detail. A caller with a fallback, such as an
 * order note taking its date from its filename when the property is unusable,
 * needs null there; a caller displaying what the note says needs the text. The
 * pair below is what stops the two being "unified" back into one.
 */
import { describe, expect, it } from 'vitest';
import { readDateLike, readDateTimeLike, readIsoDate } from '../../src/dates/read';

describe('readDateLike and readIsoDate', () => {
  it('agree on a plain date', () => {
    expect(readDateLike('2026-08-04')).toBe('2026-08-04');
    expect(readIsoDate('2026-08-04')).toBe('2026-08-04');
  });

  it('agree on truncating a datetime to its date', () => {
    expect(readDateLike('2026-08-04T16:33')).toBe('2026-08-04');
    expect(readIsoDate('2026-08-04T16:33')).toBe('2026-08-04');
  });

  it('part company on text that is not a date', () => {
    expect(readDateLike('sometime last winter')).toBe('sometime last winter');
    expect(readIsoDate('sometime last winter')).toBeNull();
  });

  it('agree on absence', () => {
    for (const absent of [null, undefined, '', '   ', 42, {}]) {
      expect(readDateLike(absent)).toBeNull();
      expect(readIsoDate(absent)).toBeNull();
    }
  });

  it('agree on a native Date, truncated to its local day', () => {
    const date = new Date(2026, 7, 4, 16, 33);
    expect(readDateLike(date)).toBe('2026-08-04');
    expect(readIsoDate(date)).toBe('2026-08-04');
  });

  it('agree that an invalid Date is absent', () => {
    expect(readDateLike(new Date('nonsense'))).toBeNull();
    expect(readIsoDate(new Date('nonsense'))).toBeNull();
  });
});

describe('readDateTimeLike', () => {
  it('keeps the clock time a string was written with', () => {
    expect(readDateTimeLike('2026-08-04T16:33')).toBe('2026-08-04T16:33');
    expect(readDateTimeLike('2026-02-26T08:30:00')).toBe('2026-02-26T08:30:00');
  });

  it('renders a native Date in full rather than truncating it', () => {
    // The distinction from readDateLike. A YAML parser turns an unquoted
    // datetime into a Date, and reading that with readDateLike drops the time.
    expect(readDateTimeLike(new Date(2026, 7, 4, 16, 33))).toBe('2026-08-04T16:33');
  });

  it('is null for absence', () => {
    for (const absent of [null, undefined, '', '  ', 42]) {
      expect(readDateTimeLike(absent)).toBeNull();
    }
  });
});
