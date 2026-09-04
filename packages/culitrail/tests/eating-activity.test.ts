/**
 * The dashboard chart's bucketing.
 *
 * All of it is local-time arithmetic over dates that arrive as strings, which is
 * exactly where an off-by-one day hides. The fixed `now` in every case is what
 * makes these assertions mean anything.
 */
import { describe, expect, it } from 'vitest';
import { buildEatingActivity, granularityFor } from '../src/meals/view-model/eating-activity';
import type { GalleryEntry } from '../src/meals/view-model/gallery-entry';
import type { EatingEntry, MealMeta } from '../src/meals/types';

const NOW = new Date(2026, 7, 11, 14, 0); // Tuesday 11 August 2026

function eaten(date: string): EatingEntry {
  return { date, time: null, rating: null, note: null, person: null, id: null };
}

function entry(title: string, dates: string[], lastEaten: string | null = null): GalleryEntry {
  const meta = {
    eatingHistory: dates.map(eaten),
    lastEaten,
    eatenCount: dates.length || null,
  } as unknown as MealMeta;

  return {
    file: { path: `Eating/Meals/${title}.md` },
    title,
    folder: 'Eating/Meals',
    tags: [],
    meta,
    createdAt: 0,
    modifiedAt: 0,
  } as unknown as GalleryEntry;
}

describe('granularity', () => {
  it('is daily up to four weeks and weekly beyond it', () => {
    expect(granularityFor(1)).toBe('day');
    expect(granularityFor(4)).toBe('day');
    expect(granularityFor(8)).toBe('week');
    expect(granularityFor(12)).toBe('week');
  });
});

describe('bucketing what was eaten', () => {
  it('makes one bucket per day over the range, ending today', () => {
    const { buckets, granularity } = buildEatingActivity([], 2, NOW);

    expect(granularity).toBe('day');
    expect(buckets).toHaveLength(14);
    expect(buckets[13].start).toBe('2026-08-11');
    expect(buckets[0].start).toBe('2026-07-29');
  });

  it('counts a meal on the day it was eaten, not the day before', () => {
    // A bare `new Date('2026-08-10')` is parsed as UTC, which lands on the 9th
    // anywhere west of Greenwich. This is the case that catches that.
    const { buckets } = buildEatingActivity([entry('Norma', ['2026-08-10'])], 1, NOW);
    const tenth = buckets.find((bucket) => bucket.start === '2026-08-10');

    expect(tenth?.count).toBe(1);
    expect(buckets.find((bucket) => bucket.start === '2026-08-09')?.count).toBe(0);
  });

  it('counts every entry in a log, not just the most recent', () => {
    const { buckets } = buildEatingActivity(
      [entry('Norma', ['2026-08-10', '2026-08-10', '2026-08-05'])],
      2,
      NOW
    );

    expect(buckets.find((bucket) => bucket.start === '2026-08-10')?.count).toBe(2);
    expect(buckets.find((bucket) => bucket.start === '2026-08-05')?.count).toBe(1);
  });

  it('ignores an entry outside the range rather than clamping it into the first bucket', () => {
    const { buckets } = buildEatingActivity([entry('Norma', ['2025-01-01'])], 1, NOW);
    expect(buckets.reduce((total, bucket) => total + bucket.count, 0)).toBe(0);
  });

  it('keeps what was eaten, so a bar can list it', () => {
    const { buckets } = buildEatingActivity([entry('Norma', ['2026-08-10'])], 1, NOW);
    const tenth = buckets.find((bucket) => bucket.start === '2026-08-10');

    expect(tenth?.cooks).toEqual([{ title: 'Norma', path: 'Eating/Meals/Norma.md' }]);
  });

  it('falls back to lastEaten for a meal with no log, so such a vault is not shown as empty', () => {
    const { buckets } = buildEatingActivity([entry('Norma', [], '2026-08-07')], 1, NOW);
    expect(buckets.find((bucket) => bucket.start === '2026-08-07')?.count).toBe(1);
  });

  it('prefers the log over lastEaten rather than counting the same meal twice', () => {
    const { buckets } = buildEatingActivity([entry('Norma', ['2026-08-07'], '2026-08-07')], 1, NOW);
    expect(buckets.reduce((total, bucket) => total + bucket.count, 0)).toBe(1);
  });

  it('skips a date it cannot read instead of dropping the whole entry', () => {
    const { buckets } = buildEatingActivity(
      [entry('Norma', ['sometime last winter', '2026-08-10'])],
      1,
      NOW
    );
    expect(buckets.reduce((total, bucket) => total + bucket.count, 0)).toBe(1);
  });
});

describe('weekly buckets', () => {
  it('start on Mondays, matching the ISO weeks the rest of the plugin uses', () => {
    const { buckets, granularity } = buildEatingActivity([], 8, NOW);

    expect(granularity).toBe('week');
    expect(buckets).toHaveLength(8);
    // 11 August 2026 is a Tuesday, so its week starts on the 10th.
    expect(buckets[7].start).toBe('2026-08-10');
    for (const bucket of buckets) {
      expect(new Date(`${bucket.start}T00:00:00`).getDay()).toBe(1);
    }
  });

  it('collapses a week of entries into its Monday bucket', () => {
    const { buckets } = buildEatingActivity(
      [entry('Norma', ['2026-08-11', '2026-08-13', '2026-08-16'])],
      8,
      NOW
    );

    expect(buckets.find((bucket) => bucket.start === '2026-08-10')?.count).toBe(3);
  });
});
