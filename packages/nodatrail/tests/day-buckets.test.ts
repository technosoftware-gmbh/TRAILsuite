/**
 * Putting a period's contents on the right day.
 *
 * The two cases worth writing down are both invisible until the day they are
 * not: a range stepped by adding 24 hours skips or repeats a day at each
 * daylight-saving boundary, and a month grid padded to a fixed six rows makes
 * February the same shape as March.
 */
import { describe, expect, it } from 'vitest';
import { eachDay, monthGrid, weekRows } from '../src/plan/day-buckets';

describe('eachDay', () => {
  it('includes both ends', () => {
    expect(eachDay('2026-08-31', '2026-09-06')).toEqual([
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-09-06',
    ]);
  });

  it('is a single day when both ends are the same', () => {
    expect(eachDay('2026-09-02', '2026-09-02')).toEqual(['2026-09-02']);
  });

  it('crosses the spring clock change', () => {
    // Passes under the naive arithmetic too, and it is worth saying so rather
    // than leaving a comment claiming a catch it does not make: Zurich's
    // spring change is at 02:00, so midnight to midnight across it is still
    // 24 hours. It is here for the other direction -- the autumn case below
    // is the one that fails -- so a future rewrite of the stepping is checked
    // at both boundaries rather than at the one that happened to bite.
    const days = eachDay('2026-03-27', '2026-03-31');
    expect(days).toEqual(['2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31']);
  });

  it('crosses the autumn clock change without repeating a day', () => {
    // This is the one that catches it. 25 October 2026 is 25 hours long in
    // Zurich, so cumulative 24-hour steps from the 24th produce
    // 24, 25, 25, 26: the 25th twice and the 27th never. Verified by breaking
    // eachDay on purpose. It only fails in a timezone that has daylight
    // saving, which is why vitest.config.mts pins one.
    const days = eachDay('2026-10-24', '2026-10-27');
    expect(days).toEqual(['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']);
  });

  it('crosses a leap day', () => {
    expect(eachDay('2028-02-27', '2028-03-01')).toEqual([
      '2028-02-27',
      '2028-02-28',
      '2028-02-29',
      '2028-03-01',
    ]);
  });

  it('is empty for a reversed or unparseable range rather than throwing', () => {
    // Neither can come out of periodRange(). A view that drew nothing would
    // still be a better failure than one that threw mid-render.
    expect(eachDay('2026-09-06', '2026-08-31')).toEqual([]);
    expect(eachDay('not a date', '2026-08-31')).toEqual([]);
    expect(eachDay('2026-08-31', 'not a date')).toEqual([]);
  });
});

describe('monthGrid', () => {
  it('runs whole weeks, Monday to Sunday, around the month', () => {
    // September 2026 starts on a Tuesday and ends on a Wednesday, so the grid
    // opens on Monday 31 August and closes on Sunday 4 October.
    const grid = monthGrid(new Date(2026, 8, 1));
    expect(grid[0]).toEqual({ iso: '2026-08-31', inMonth: false });
    expect(grid[1]).toEqual({ iso: '2026-09-01', inMonth: true });
    expect(grid[grid.length - 1]).toEqual({ iso: '2026-10-04', inMonth: false });
    expect(grid.length % 7).toBe(0);
  });

  it('lands on the month from any day inside it', () => {
    const fromFirst = monthGrid(new Date(2026, 8, 1));
    const fromMiddle = monthGrid(new Date(2026, 8, 17));
    expect(fromMiddle).toEqual(fromFirst);
  });

  it('gives a short month its own shape rather than padding to six rows', () => {
    // February 2027 is exactly four Monday-to-Sunday weeks: it starts on a
    // Monday and ends on a Sunday. A grid padded to six rows would draw two
    // empty weeks under it.
    const grid = monthGrid(new Date(2027, 1, 1));
    expect(grid.length / 7).toBe(4);
    expect(grid[0]).toEqual({ iso: '2027-02-01', inMonth: true });
    expect(grid[grid.length - 1]).toEqual({ iso: '2027-02-28', inMonth: true });
  });

  it('gives a long month six rows when it needs them', () => {
    // May 2027 starts on a Saturday and has 31 days, which is the shape that
    // does not fit in five.
    expect(monthGrid(new Date(2027, 4, 1)).length / 7).toBe(6);
  });

  it('marks every day of the month as in it, and no others', () => {
    const grid = monthGrid(new Date(2026, 8, 1));
    expect(grid.filter((cell) => cell.inMonth).length).toBe(30);
  });
});

describe('weekRows', () => {
  it('chunks into sevens', () => {
    expect(weekRows([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])).toEqual([
      [1, 2, 3, 4, 5, 6, 7],
      [8, 9, 10, 11, 12, 13, 14],
    ]);
  });

  it('is empty for no days', () => {
    expect(weekRows([])).toEqual([]);
  });
});
