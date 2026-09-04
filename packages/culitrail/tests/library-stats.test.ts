/**
 * The library counts the dashboard shows.
 *
 * Worth testing because every one of them is a small judgement about what
 * counts: whether a missing eaten count is zero, whether an unrated meal
 * drags the average down, and where the boundary of "recently" sits.
 */
import { describe, expect, it } from 'vitest';
import {
  buildLibraryStats,
  dayTime,
  recentlyAdded,
  recentlyEaten,
} from '../src/meals/view-model/library-stats';
import type { GalleryEntry } from '../src/meals/view-model/gallery-entry';
import type { MealMeta } from '../src/meals/types';

const NOW = new Date(2026, 7, 10);

function entry(title: string, meta: Partial<MealMeta>, createdAt = 0): GalleryEntry {
  return {
    file: { path: `${title}.md` },
    title,
    folder: 'Eating/Meals',
    tags: [],
    createdAt,
    modifiedAt: createdAt,
    hasReheating: false,
    meta: {
      image: null,
      servings: null,
      prepTime: null,
      reheatTime: null,
      totalTime: null,
      diet: [],
      allergens: [],
      tags: [],
      favorite: false,
      lastEaten: null,
      eatenCount: null,
      source: null,
      nutrition: { calories: null, protein: null, fat: null, carbs: null },
      ...meta,
    },
  } as GalleryEntry;
}

describe('dayTime', () => {
  it('reads a date at local midnight, not UTC', () => {
    // Parsed as UTC, this lands on the previous day west of Greenwich.
    expect(dayTime('2026-08-01')).toBe(new Date(2026, 7, 1).getTime());
  });

  it('accepts a datetime by taking its day', () => {
    expect(dayTime('2026-08-01T19:30')).toBe(new Date(2026, 7, 1).getTime());
  });

  it('is null for anything that is not a date', () => {
    expect(dayTime('sometime last winter')).toBeNull();
    expect(dayTime(null)).toBeNull();
  });
});

describe('buildLibraryStats', () => {
  const entries = [
    entry('Risotto', { favorite: true, lastEaten: '2026-08-01', eatenCount: 3 }),
    entry('Lasagne', { lastEaten: '2026-01-04', eatenCount: 1 }),
    entry('Pizza', { favorite: true }),
    entry('Soup', { eatenCount: 0 }),
  ];

  it('counts the library, its favorites and what has never been eaten', () => {
    const stats = buildLibraryStats(entries, 8, NOW);
    expect(stats.total).toBe(4);
    expect(stats.favorites).toBe(2);
    // A missing count and an explicit zero are the same thing.
    expect(stats.neverEaten).toBe(2);
  });

  it('counts only meals eaten inside the activity range', () => {
    expect(buildLibraryStats(entries, 8, NOW).eatenRecently).toBe(1);
    // Widen the range far enough and January comes back into view.
    expect(buildLibraryStats(entries, 52, NOW).eatenRecently).toBe(2);
  });

  it('includes a meal eaten on the first day of the range', () => {
    const onTheEdge = [entry('Edge', { lastEaten: '2026-07-27' })];
    expect(buildLibraryStats(onTheEdge, 2, NOW).eatenRecently).toBe(1);
  });
});

describe('recentlyEaten', () => {
  it('is newest first, and leaves out what has never been eaten', () => {
    const entries = [
      entry('Lasagne', { lastEaten: '2026-01-04' }),
      entry('Pizza', {}),
      entry('Risotto', { lastEaten: '2026-08-01' }),
    ];
    expect(recentlyEaten(entries, 5).map((item) => item.title)).toEqual(['Risotto', 'Lasagne']);
  });

  it('honours the limit', () => {
    const entries = [
      entry('A', { lastEaten: '2026-08-01' }),
      entry('B', { lastEaten: '2026-07-01' }),
      entry('C', { lastEaten: '2026-06-01' }),
    ];
    expect(recentlyEaten(entries, 2).map((item) => item.title)).toEqual(['A', 'B']);
  });
});

describe('recentlyAdded', () => {
  it('is newest first by creation time', () => {
    const entries = [entry('Old', {}, 1000), entry('New', {}, 3000), entry('Mid', {}, 2000)];
    expect(recentlyAdded(entries, 2).map((item) => item.title)).toEqual(['New', 'Mid']);
  });

  it('leaves the array it was given alone', () => {
    const entries = [entry('Old', {}, 1000), entry('New', {}, 3000)];
    recentlyAdded(entries, 2);
    expect(entries.map((item) => item.title)).toEqual(['Old', 'New']);
  });
});
