import { describe, expect, it } from 'vitest';
import {
  ancestorLevels,
  detectPeriodLevel,
  endOfPeriod,
  isInPeriodRange,
  isPeriodLevel,
  parentLevel,
  parsePeriodTitle,
  periodRange,
  periodTitle,
  shiftPeriod,
  startOfPeriod,
} from '../../src/period/levels.js';
import { formatDayTitle } from '../../src/dates/day.js';

/** A Saturday in Q3 2026, in ISO week 34. */
const DATE = new Date(2026, 7, 22);

describe('periodTitle', () => {
  it('names each level the way the vault does', () => {
    expect(periodTitle('day', DATE)).toBe('2026-08-22');
    expect(periodTitle('week', DATE)).toBe('2026-W34');
    expect(periodTitle('month', DATE)).toBe('2026-08');
    expect(periodTitle('quarter', DATE)).toBe('2026-Q3');
    expect(periodTitle('year', DATE)).toBe('2026');
  });
});

describe('parsePeriodTitle', () => {
  it('reverses each of them to the period first day', () => {
    expect(formatDayTitle(parsePeriodTitle('day', '2026-08-22')!)).toBe('2026-08-22');
    expect(formatDayTitle(parsePeriodTitle('week', '2026-W34')!)).toBe('2026-08-17');
    expect(formatDayTitle(parsePeriodTitle('month', '2026-08')!)).toBe('2026-08-01');
    expect(formatDayTitle(parsePeriodTitle('quarter', '2026-Q3')!)).toBe('2026-07-01');
    expect(formatDayTitle(parsePeriodTitle('year', '2026')!)).toBe('2026-01-01');
  });

  it('refuses a title of the wrong level', () => {
    expect(parsePeriodTitle('day', '2026-08')).toBeNull();
    expect(parsePeriodTitle('quarter', '2026-Q5')).toBeNull();
  });
});

describe('detectPeriodLevel', () => {
  it('tells the five shapes apart', () => {
    expect(detectPeriodLevel('2026-08-22')).toBe('day');
    expect(detectPeriodLevel('2026-W34')).toBe('week');
    expect(detectPeriodLevel('2026-08')).toBe('month');
    expect(detectPeriodLevel('2026-Q3')).toBe('quarter');
    expect(detectPeriodLevel('2026')).toBe('year');
  });

  it('does not read a day as a month with something after it', () => {
    expect(detectPeriodLevel('2026-08-22')).not.toBe('month');
  });

  it('answers nothing for a title that is not a period', () => {
    expect(detectPeriodLevel('Finanzen')).toBeNull();
    expect(detectPeriodLevel('2026-Q5')).toBeNull();
    expect(detectPeriodLevel('')).toBeNull();
  });
});

describe('shiftPeriod', () => {
  it('steps each level by one', () => {
    expect(periodTitle('day', shiftPeriod('day', DATE, 1))).toBe('2026-08-23');
    expect(periodTitle('week', shiftPeriod('week', DATE, 1))).toBe('2026-W35');
    expect(periodTitle('month', shiftPeriod('month', DATE, 1))).toBe('2026-09');
    expect(periodTitle('quarter', shiftPeriod('quarter', DATE, 1))).toBe('2026-Q4');
    expect(periodTitle('year', shiftPeriod('year', DATE, 1))).toBe('2027');
  });

  it('steps backwards across a year boundary', () => {
    const january = new Date(2026, 0, 15);
    expect(periodTitle('month', shiftPeriod('month', january, -1))).toBe('2025-12');
    expect(periodTitle('quarter', shiftPeriod('quarter', january, -1))).toBe('2025-Q4');
  });
});

describe('the range of a period', () => {
  it('runs from the first day to the last', () => {
    expect(periodRange('month', DATE)).toEqual({ from: '2026-08-01', to: '2026-08-31' });
    expect(periodRange('quarter', DATE)).toEqual({ from: '2026-07-01', to: '2026-09-30' });
    expect(periodRange('year', DATE)).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });

  it('runs Monday to Sunday for a week', () => {
    expect(periodRange('week', DATE)).toEqual({ from: '2026-08-17', to: '2026-08-23' });
  });

  it('is one day long for a day', () => {
    expect(periodRange('day', DATE)).toEqual({ from: '2026-08-22', to: '2026-08-22' });
  });

  it('ends on a real last day in February', () => {
    expect(periodRange('month', new Date(2028, 1, 10)).to).toBe('2028-02-29');
  });

  it('answers whether a day falls inside', () => {
    expect(isInPeriodRange('2026-08-01', 'month', DATE)).toBe(true);
    expect(isInPeriodRange('2026-08-31', 'month', DATE)).toBe(true);
    expect(isInPeriodRange('2026-09-01', 'month', DATE)).toBe(false);
  });

  it('starts and ends at local midnight', () => {
    expect(startOfPeriod('month', DATE).getHours()).toBe(0);
    expect(endOfPeriod('month', DATE).getHours()).toBe(0);
  });
});

describe('the chain upwards', () => {
  it('names each parent', () => {
    expect(parentLevel('day')).toBe('week');
    expect(parentLevel('week')).toBe('month');
    expect(parentLevel('month')).toBe('quarter');
    expect(parentLevel('quarter')).toBe('year');
    expect(parentLevel('year')).toBeNull();
  });

  it('reads coarsest first, which is how a breadcrumb reads', () => {
    expect(ancestorLevels('day')).toEqual(['year', 'quarter', 'month', 'week']);
    expect(ancestorLevels('month')).toEqual(['year', 'quarter']);
    expect(ancestorLevels('year')).toEqual([]);
  });

  it('recognises a level value', () => {
    expect(isPeriodLevel('quarter')).toBe(true);
    expect(isPeriodLevel('fortnight')).toBe(false);
    expect(isPeriodLevel(3)).toBe(false);
  });
});
