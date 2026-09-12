/**
 * Splitting a day at lunch.
 *
 * Two things here fail silently rather than loudly. An unpadded hour compares
 * as a string the wrong way round -- `'9:00' > '12:00'` -- so every early
 * meeting in a vault that writes `9:00` would land in the afternoon. And a
 * lunch window that is empty or inverted has no correct answer, so what it
 * does instead has to be a decision rather than whatever the comparisons
 * happen to produce.
 */
import { describe, expect, it } from 'vitest';
import { bandOf, isWorkday, normalizeTime } from '../src/plan/day-bands';

describe('normalizeTime', () => {
  it('pads a single-digit hour', () => {
    expect(normalizeTime('9:00')).toBe('09:00');
    expect(normalizeTime('9:30')).toBe('09:30');
  });

  it('leaves a padded one alone', () => {
    expect(normalizeTime('09:00')).toBe('09:00');
    expect(normalizeTime('14:30')).toBe('14:30');
  });

  it('trims, and returns anything else unchanged', () => {
    expect(normalizeTime('  9:00 ')).toBe('09:00');
    expect(normalizeTime('')).toBe('');
    expect(normalizeTime('mittags')).toBe('mittags');
  });
});

describe('bandOf', () => {
  const band = (from: string) => bandOf(from, '12:00', '13:00');

  it('splits at the lunch window', () => {
    expect(band('08:00')).toBe('morning');
    expect(band('11:59')).toBe('morning');
    expect(band('12:00')).toBe('lunch');
    expect(band('12:59')).toBe('lunch');
    expect(band('13:00')).toBe('afternoon');
    expect(band('17:30')).toBe('afternoon');
  });

  it('puts an unpadded morning hour in the morning', () => {
    // The whole reason normalizeTime exists: '9:00' > '12:00' as a string, so
    // without it this is an afternoon meeting.
    expect(band('9:00')).toBe('morning');
    expect(band('8:15')).toBe('morning');
  });

  it('bands a meeting by when it starts, not by where it ends', () => {
    // 10:00-14:00 spans all three. It is a morning meeting that ran long, and
    // showing it under Nachmittag would put it below things it began before.
    expect(band('10:00')).toBe('morning');
  });

  it('degrades to two bands when the window is blank', () => {
    // Not special-cased: every real time sorts after the empty string, so the
    // morning branch never fires and the lunch branch never fires. Asserted
    // because it is still a promise, whether or not code was written to keep
    // it -- see bandOf, where the guard that used to be here was removed for
    // changing no answer.
    expect(bandOf('08:00', '', '')).toBe('afternoon');
    expect(bandOf('17:00', '', '')).toBe('afternoon');
  });

  it('degrades when the window is inverted or empty', () => {
    // 13:00-12:00 and 12:00-12:00 are both mistypes with no correct reading.
    // Neither produces a lunch band, and neither needs code to say so: past
    // `start` is past `end` too when the pair is inverted.
    expect(bandOf('12:30', '13:00', '12:00')).toBe('morning');
    expect(bandOf('13:30', '13:00', '12:00')).toBe('afternoon');
    expect(bandOf('12:00', '12:00', '12:00')).toBe('afternoon');
  });
});

describe('isWorkday', () => {
  it('is Monday to Friday', () => {
    // 31 August 2026 is a Monday, so this walks a full week from it.
    expect(isWorkday('2026-08-31')).toBe(true);
    expect(isWorkday('2026-09-01')).toBe(true);
    expect(isWorkday('2026-09-02')).toBe(true);
    expect(isWorkday('2026-09-03')).toBe(true);
    expect(isWorkday('2026-09-04')).toBe(true);
    expect(isWorkday('2026-09-05')).toBe(false);
    expect(isWorkday('2026-09-06')).toBe(false);
  });

  it('is false for something that is not a day', () => {
    expect(isWorkday('not a day')).toBe(false);
  });
});
